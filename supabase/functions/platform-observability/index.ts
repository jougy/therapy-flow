import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { corsHeaders } from "../_shared/cors.ts";

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

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 1. Validar autenticação do usuário
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  // 2. Validação RBAC soberana: Master / Platform Admin
  let isAllowed = false;

  try {
    const { data: isOwner } = await admin.rpc("is_platform_owner", { _user_id: user.id });
    if (isOwner === true) {
      isAllowed = true;
    }
  } catch {
    // segue verificação
  }

  if (!isAllowed) {
    try {
      const { data: isAdmin } = await admin.rpc("is_platform_admin", { _user_id: user.id });
      if (isAdmin === true) {
        isAllowed = true;
      }
    } catch {
      // segue verificação
    }
  }

  if (!isAllowed) {
    const { data: adminRecord } = await admin
      .from("platform_admins")
      .select("id, role, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (adminRecord) {
      isAllowed = true;
    }
  }

  if (!isAllowed) {
    return json({ error: "Forbidden: Access restricted to Platform Admins" }, 403);
  }

  // 3. Processar Ação
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // AÇÃO A: Consulta de Logs no Axiom Cloud
    if (action === "query_axiom_logs") {
      if (!axiomToken) {
        return json({ error: "Axiom token not configured in secrets", records: [] }, 200);
      }

      const limit = Math.min(Number(body.limit) || 100, 250);
      const filters: string[] = [];

      if (body.service) {
        filters.push(`service == '${body.service}'`);
      }
      if (body.eventType && body.eventType !== "all") {
        filters.push(`event_type == '${body.eventType}'`);
      }
      if (body.scope && body.scope !== "all") {
        filters.push(`scope == '${body.scope}'`);
      }
      if (body.clinicId) {
        filters.push(`clinic_id == '${body.clinicId}'`);
      }
      if (body.userId) {
        filters.push(`user_id == '${body.userId}'`);
      }
      if (body.search && typeof body.search === "string" && body.search.trim()) {
        const cleanSearch = body.search.replace(/'/g, "\\'");
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

    // AÇÃO B: Consulta de Telemetria no Upstash Redis
    if (action === "query_upstash_telemetry") {
      if (!upstashUrl || !upstashToken) {
        return json({ error: "Upstash not configured", telemetry: null }, 200);
      }

      const targetUserId = body.userId;
      const targetClinicId = body.clinicId;

      const pipeline: Array<[string, ...string[]]> = [];
      if (targetUserId) {
        pipeline.push(["HGETALL", `telemetry:user:${targetUserId}`]);
        pipeline.push(["HGETALL", `telemetry:user:${targetUserId}:counters`]);
      } else if (targetClinicId) {
        pipeline.push(["HGETALL", `telemetry:clinic:${targetClinicId}`]);
      } else {
        return json({ error: "userId or clinicId required" }, 400);
      }

      const pipelineUrl = upstashUrl.endsWith("/") ? `${upstashUrl}pipeline` : `${upstashUrl}/pipeline`;
      const res = await fetch(pipelineUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pipeline),
      });

      if (!res.ok) {
        return json({ error: `Upstash query error: ${res.status}`, telemetry: null }, 200);
      }

      const data = await res.json();
      return json({ telemetry: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[platform-observability] Unexpected error:", message);
    return json({ error: message }, 500);
  }
});
