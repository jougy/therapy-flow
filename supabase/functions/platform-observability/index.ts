import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { corsHeaders } from "../_shared/cors.ts";
import { flushPendingErrors, flushPendingErrorsIfDue, reportError } from "../_shared/error-dedup.ts";
import { dispatchAdminErrorAlert, runBackgroundSafe } from "../_shared/error-alert.ts";
import { ingestToAxiom } from "../_shared/telemetry-axiom.ts";
import { checkRateLimit, rateLimitExceededResponse } from "../_shared/rate-limit.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const axiomDataset = Deno.env.get("AXIOM_DATASET") || "pluri-health-logs";
const axiomToken = Deno.env.get("AXIOM_TOKEN") || "";
const upstashUrl = Deno.env.get("UPSTASH_REDIS_REST_URL") || "";
const upstashToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN") || "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_IDENT_RE = /^[a-zA-Z0-9._:-]{1,80}$/;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runUpstashPipeline(commands: Array<Array<string | number>>): Promise<Array<{ result: unknown }> | null> {
  if (!upstashUrl || !upstashToken || commands.length === 0) return null;
  const pipelineUrl = upstashUrl.endsWith("/") ? `${upstashUrl}pipeline` : `${upstashUrl}/pipeline`;
  try {
    const res = await fetch(pipelineUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${upstashToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Array<{ result: unknown }>;
  } catch {
    return null;
  }
}

async function isPlatformAdminUser(userId: string): Promise<boolean> {
  try {
    const { data: isOwner } = await admin.rpc("is_platform_owner", { _user_id: userId });
    if (isOwner === true) return true;
  } catch {
    // segue verificação
  }
  try {
    const { data: isAdmin } = await admin.rpc("is_platform_admin", { _user_id: userId });
    if (isAdmin === true) return true;
  } catch {
    // segue verificação
  }
  const { data: adminRecord } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return Boolean(adminRecord);
}

async function verifyServiceRoleJwt(token: string): Promise<boolean> {
  if (Boolean(serviceRoleKey) && token === serviceRoleKey) {
    return true;
  }
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    if (payload?.role !== "service_role") return false;
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: token,
      },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const isServiceRoleCall = await verifyServiceRoleJwt(token);

  let user: { id: string } | null = null;
  if (!isServiceRoleCall) {
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user: fetchedUser },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !fetchedUser) {
      return json({ error: "Unauthorized" }, 401);
    }
    user = fetchedUser;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";

    // =========================================================================
    // CAMADA 1: Ações autenticadas (Telemetria, Erros, Presença, Slots Cache)
    // =========================================================================
    if (action === "ingest_telemetry") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      const rlTel = await checkRateLimit({
        preset: "obs_telemetry_user",
        identifier: user.id,
        service: "platform-observability",
        route: "ingest_telemetry",
      });
      if (!rlTel.allowed) return rateLimitExceededResponse(rlTel, corsHeaders);

      if (!upstashUrl || !upstashToken) {
        return json({ ok: false, reason: "upstash_not_configured" }, 200);
      }

      const clinicId = typeof body.clinicId === "string" && UUID_RE.test(body.clinicId) ? body.clinicId : null;
      const matrix = body.matrix && typeof body.matrix === "object" ? (body.matrix as Record<string, unknown>) : {};
      const counters = body.counters && typeof body.counters === "object" ? (body.counters as Record<string, unknown>) : {};

      const commands: Array<Array<string | number>> = [];
      for (const [col, seconds] of Object.entries(matrix)) {
        if (SAFE_IDENT_RE.test(col) && typeof seconds === "number" && seconds > 0 && seconds < 86400) {
          commands.push(["HINCRBY", `telemetry:user:${user.id}`, col, Math.round(seconds)]);
          if (clinicId) {
            commands.push(["HINCRBY", `telemetry:clinic:${clinicId}`, col, Math.round(seconds)]);
          }
        }
      }
      for (const [key, val] of Object.entries(counters)) {
        if (SAFE_IDENT_RE.test(key) && typeof val === "number" && val > 0 && val < 10000) {
          commands.push(["HINCRBY", `telemetry:user:${user.id}:counters`, key, Math.round(val)]);
        }
      }

      if (commands.length === 0) return json({ ok: true, commands: 0 });
      const res = await runUpstashPipeline(commands);
      return json({ ok: res !== null, commands: commands.length });
    }

    if (action === "ingest_error") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      const rlErr = await checkRateLimit({
        preset: "obs_error_user",
        identifier: user.id,
        service: "platform-observability",
        route: "ingest_error",
      });
      if (!rlErr.allowed) return rateLimitExceededResponse(rlErr, corsHeaders);

      const scope = typeof body.scope === "string" ? body.scope.slice(0, 80) : "runtime";
      const route = typeof body.route === "string" ? body.route.slice(0, 160) : "/";
      const message = typeof body.message === "string" ? body.message.slice(0, 500) : "Unknown error";
      const clinicId = typeof body.clinic_id === "string" && UUID_RE.test(body.clinic_id) ? body.clinic_id : null;
      const stack = typeof body.stack === "string" ? body.stack.slice(0, 1000) : undefined;
      const level = body.level === "warn" ? "warn" : body.level === "critical" ? "critical" : "error";
      const service = typeof body.service === "string" ? body.service.slice(0, 60) : "pluri-health-client";

      const result = await reportError({
        service,
        level,
        code: scope,
        route,
        message,
        stack,
        windowSec: 60,
        metadata: {
          clinic_id: clinicId,
          user_id: user.id,
          stack,
          context: typeof body.context === "object" && body.context !== null ? body.context : undefined,
        },
      });
      await runBackgroundSafe(flushPendingErrorsIfDue(60), 1000);
      return json({ ok: true, ...result });
    }

    if (action === "heartbeat_presence") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      const rlHb = await checkRateLimit({
        preset: "obs_telemetry_user",
        identifier: user.id,
        service: "platform-observability",
        route: "heartbeat_presence",
      });
      if (!rlHb.allowed) return rateLimitExceededResponse(rlHb, corsHeaders);

      if (!upstashUrl || !upstashToken) {
        return json({ ok: false, reason: "upstash_not_configured" }, 200);
      }
      const clinicId = typeof body.clinicId === "string" && UUID_RE.test(body.clinicId) ? body.clinicId : null;
      if (!clinicId) return json({ error: "clinicId required" }, 400);

      // TTL de 720s (12 min) alinhado ao heartbeat de 10 min do cliente
      const res = await runUpstashPipeline([
        ["SET", `presence:clinic:${clinicId}:user:${user.id}`, new Date().toISOString(), "EX", 720],
      ]);
      return json({ ok: res !== null });
    }

    if (action === "query_slots_cache" || action === "invalidate_slots_cache") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      const rlSlots = await checkRateLimit({
        preset: "obs_slots_user",
        identifier: user.id,
        service: "platform-observability",
        route: action,
      });
      if (!rlSlots.allowed) return rateLimitExceededResponse(rlSlots, corsHeaders);

      if (!upstashUrl || !upstashToken) {
        return json({ ok: false, result: null }, 200);
      }
      const clinicId = typeof body.clinicId === "string" && UUID_RE.test(body.clinicId) ? body.clinicId : null;
      const providerId = typeof body.providerId === "string" && UUID_RE.test(body.providerId) ? body.providerId : "all";
      const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
      if (!clinicId || !date) return json({ error: "clinicId and date required" }, 400);

      const cacheKey = `schedule:slots:${clinicId}:${providerId}:${date}`;
      if (action === "query_slots_cache") {
        if (Array.isArray(body.setSlots)) {
          const ttl = Math.min(Math.max(Number(body.ttl) || 120, 30), 600);
          const res = await runUpstashPipeline([["SET", cacheKey, JSON.stringify(body.setSlots), "EX", ttl]]);
          return json({ ok: res !== null });
        }
        const res = await runUpstashPipeline([["GET", cacheKey]]);
        return json({ ok: res !== null, result: res?.[0]?.result ?? null });
      }

      const cmds: Array<Array<string | number>> = [["DEL", cacheKey]];
      if (providerId !== "all") {
        cmds.push(["DEL", `schedule:slots:${clinicId}:all:${date}`]);
      }
      const res = await runUpstashPipeline(cmds);
      return json({ ok: res !== null });
    }

    // =========================================================================
    // CAMADA 2: Ações administrativas (Platform Admin / Owner / service_role)
    // =========================================================================
    const isAllowed = isServiceRoleCall ? true : user ? await isPlatformAdminUser(user.id) : false;
    if (!isAllowed) {
      return json({ error: "Forbidden: Access restricted to Platform Admins" }, 403);
    }

    if (!isServiceRoleCall && user) {
      const rlAdmin = await checkRateLimit({
        preset: "obs_admin_query",
        identifier: user.id,
        service: "platform-observability",
        route: action || "admin",
      });
      if (!rlAdmin.allowed) return rateLimitExceededResponse(rlAdmin, corsHeaders);
    }

    if (action === "test_error_alert") {
      const alertRes = await dispatchAdminErrorAlert({
        fingerprint: `healthcheck-${Date.now()}`,
        force: true,
        level: "warn",
        service: "platform-observability",
        route: "test_error_alert",
        code: "HEALTHCHECK_ALERT",
        message: "Teste automático de alerta Pluri-Health (Telegram + E-mail + Axiom)",
        metadata: {
          triggered_by: isServiceRoleCall ? "service_role" : user?.id || "admin",
        },
      });
      await ingestToAxiom([
        {
          level: "info",
          service: "platform-observability",
          route: "test_error_alert",
          message: "Healthcheck alert triggered",
          metadata: {
            event_type: "healthcheck_alert",
            telegramSent: alertRes.telegramSent,
            emailSent: alertRes.emailSent,
          },
        },
      ]);
      return json({ ok: true, ...alertRes });
    }

    if (action === "flush_pending_errors") {
      const flushed = await flushPendingErrors();
      return json({ ok: true, flushed });
    }

    if (action === "query_axiom_logs") {
      if (!axiomToken) {
        return json({ error: "Axiom token not configured in secrets", records: [] }, 200);
      }

      const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 250);
      const filters: string[] = [];

      if (typeof body.service === "string" && SAFE_IDENT_RE.test(body.service)) {
        filters.push(`service == '${body.service}'`);
      }
      if (typeof body.eventType === "string" && body.eventType !== "all" && SAFE_IDENT_RE.test(body.eventType)) {
        filters.push(`event_type == '${body.eventType}'`);
      }
      if (typeof body.scope === "string" && body.scope !== "all" && SAFE_IDENT_RE.test(body.scope)) {
        filters.push(`scope == '${body.scope}'`);
      }
      if (typeof body.clinicId === "string" && UUID_RE.test(body.clinicId)) {
        filters.push(`clinic_id == '${body.clinicId}'`);
      }
      if (typeof body.userId === "string" && UUID_RE.test(body.userId)) {
        filters.push(`user_id == '${body.userId}'`);
      }
      if (typeof body.search === "string" && body.search.trim()) {
        const cleanSearch = body.search.trim().slice(0, 100).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        filters.push(`(message contains '${cleanSearch}' or scope contains '${cleanSearch}' or route contains '${cleanSearch}')`);
      }

      const whereClause = filters.length > 0 ? `| where ${filters.join(" and ")}` : "";
      const apl = `['${axiomDataset}'] ${whereClause} | sort by _time desc | limit ${limit}`;

      const res = await fetch("https://api.axiom.co/v1/datasets/_apl?format=tabular", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${axiomToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apl }),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("[platform-observability] Axiom API error:", res.status, errText);
        return json({ error: `Axiom query error: ${res.status}`, records: [] }, 200);
      }

      const data = await res.json();
      if (!data.tables || !data.tables[0]) {
        return json({ records: [] });
      }

      const table = data.tables[0];
      const fields: string[] = table.fields.map((f: { name: string }) => f.name);
      const columns: unknown[][] = table.columns || [];
      const rowCount = columns[0]?.length || 0;

      const records: Record<string, unknown>[] = [];
      for (let r = 0; r < rowCount; r++) {
        const item: Record<string, unknown> = {};
        fields.forEach((fieldName, colIdx) => {
          item[fieldName] = columns[colIdx]?.[r];
        });
        records.push({
          id: (item.id as string) || (item._sysTime as string) || (item._time as string) || `${Date.now()}-${r}`,
          _time: (item._time as string) || new Date().toISOString(),
          _sysTime: item._sysTime as string,
          environment: item.environment as string,
          service: item.service as string,
          event_type: item.event_type as string,
          scope: item.scope as string,
          message: item.message as string,
          stack: item.stack as string,
          context: typeof item.context === "object" && item.context !== null ? item.context : undefined,
          route: item.route as string,
          clinic_id: item.clinic_id as string,
          user_id: item.user_id as string,
        });
      }
      return json({ records });
    }

    if (action === "query_upstash_telemetry") {
      if (!upstashUrl || !upstashToken) {
        return json({ error: "Upstash not configured", telemetry: null }, 200);
      }
      const targetUserId = typeof body.userId === "string" && UUID_RE.test(body.userId) ? body.userId : null;
      const targetClinicId = typeof body.clinicId === "string" && UUID_RE.test(body.clinicId) ? body.clinicId : null;

      const pipeline: Array<[string, ...string[]]> = [];
      if (targetUserId) {
        pipeline.push(["HGETALL", `telemetry:user:${targetUserId}`]);
        pipeline.push(["HGETALL", `telemetry:user:${targetUserId}:counters`]);
      } else if (targetClinicId) {
        pipeline.push(["HGETALL", `telemetry:clinic:${targetClinicId}`]);
      } else {
        return json({ error: "userId or clinicId required" }, 400);
      }

      const data = await runUpstashPipeline(pipeline);
      if (!data) {
        return json({ error: "Upstash query error", telemetry: null }, 200);
      }
      return json({ telemetry: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[platform-observability] Unexpected error:", message);
    await reportError({
      service: "platform-observability",
      level: "critical",
      code: "edge_unhandled_500",
      route: "platform-observability",
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return json({ error: message }, 500);
  }
});
