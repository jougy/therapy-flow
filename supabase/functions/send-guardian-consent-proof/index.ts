import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  extractClientIp,
  rateLimitExceededResponse,
} from "../_shared/rate-limit.ts";
import { reportError } from "../_shared/error-dedup.ts";
import { ResendClient } from "../_shared/resend-client.ts";
import { enqueueToQStash } from "../_shared/qstash.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, ...extraHeaders, "Content-Type": "application/json" },
    status,
  });

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  try {
    const clientIp = extractClientIp(req);
    const ipLimit = await checkRateLimit({
      preset: "guardian_consent_ip",
      identifier: clientIp,
      service: "send-guardian-consent-proof",
      route: "send-guardian-consent-proof",
    });
    if (!ipLimit.allowed) {
      return rateLimitExceededResponse(ipLimit, corsHeaders);
    }

    const rlHeaders = buildRateLimitHeaders(ipLimit);
    const body = await req.json().catch(() => ({}));
    const rawToken = typeof body?.token === "string" ? body.token.trim() : "";
    const to = typeof body?.to === "string" ? body.to.trim().toLowerCase() : "";
    const patientName = typeof body?.patientName === "string" ? body.patientName.trim().slice(0, 140) : "";
    const guardianName = typeof body?.guardianName === "string" ? body.guardianName.trim().slice(0, 140) : "";
    const signedAt = body?.signedAt;
    const clinicName =
      typeof body?.clinicName === "string" && body.clinicName.trim()
        ? body.clinicName.trim().slice(0, 140)
        : "Pluri-Health";

    if (!rawToken || !/^[a-zA-Z0-9_-]{12,128}$/.test(rawToken)) {
      return json({ error: "Token de consentimento ausente ou inválido." }, 403, rlHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Configuração do servidor incompleta." }, 500, rlHeaders);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: linkRow, error: linkErr } = await admin
      .from("patient_registration_links")
      .select("id, clinic_id")
      .eq("token", rawToken)
      .maybeSingle();

    if (linkErr || !linkRow) {
      return json({ error: "Link de consentimento não encontrado ou expirado." }, 403, rlHeaders);
    }

    if (!to || !patientName) {
      return json({ error: "Destinatário ou paciente ausente." }, 400, rlHeaders);
    }

    const emailLimit = await checkRateLimit({
      preset: "guardian_consent_email",
      identifier: to,
      service: "send-guardian-consent-proof",
      route: "send-guardian-consent-proof",
    });
    if (!emailLimit.allowed) {
      return rateLimitExceededResponse(emailLimit, corsHeaders);
    }

    const safePatientName = escapeHtml(patientName);
    const safeGuardianName = escapeHtml(guardianName || "Responsável Legal");
    const safeClinicName = escapeHtml(clinicName);

    const formattedDate = signedAt
      ? new Date(signedAt).toLocaleString("pt-BR")
      : new Date().toLocaleString("pt-BR");

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Comprovante de Consentimento do Menor (LGPD)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px; margin: 0; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px; }
    .badge { display: inline-block; background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; }
    h1 { font-size: 20px; margin: 12px 0 6px 0; color: #0f172a; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
    .info-box { background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; padding: 16px; margin-bottom: 20px; font-size: 13px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .info-row:last-child { margin-bottom: 0; }
    .label { color: #64748b; }
    .value { font-weight: 600; color: #0f172a; }
    .footer { font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">✓ Consentimento Confirmado</span>
      <h1>Comprovante de Autorização de Menor</h1>
      <p>Termo de Consentimento Livre e Esclarecido • Art. 14 da LGPD (Lei 13.709/2018)</p>
    </div>

    <p>Olá, <strong>${safeGuardianName}</strong>,</p>
    <p>Confirmamos o registro da sua autorização formal para o atendimento e tratamento de dados de saúde do(a) menor <strong>${safePatientName}</strong> na plataforma <strong>${safeClinicName}</strong>.</p>

    <div class="info-box">
      <div class="info-row">
        <span class="label">Paciente:</span>
        <span class="value">${safePatientName}</span>
      </div>
      <div class="info-row">
        <span class="label">Responsável Legal:</span>
        <span class="value">${guardianName ? safeGuardianName : "Declarado no ato"}</span>
      </div>
      <div class="info-row">
        <span class="label">Data e Hora do Aceite:</span>
        <span class="value">${escapeHtml(formattedDate)}</span>
      </div>
      <div class="info-row">
        <span class="label">Canal:</span>
        <span class="value">Assinatura Digital Segura</span>
      </div>
    </div>

    <p>Este comprovante foi emitido para seus arquivos pessoais. Você tem o direito de solicitar esclarecimentos, cópias de prontuário e retificações a qualquer momento junto à clínica.</p>

    <div class="footer">
      ${safeClinicName} • Gestão Clínica em conformidade com a LGPD e Ética Profissional.
    </div>
  </div>
</body>
</html>
    `;

    const resend = new ResendClient();
    const result = await resend.sendEmail({
      to,
      subject: `[${clinicName}] Comprovante de Autorização de Menor (LGPD) - ${patientName}`,
      html: htmlContent,
      text: `Olá, ${guardianName || "Responsável Legal"}! Confirmamos o registro do seu consentimento formal como responsável legal pelo(a) menor ${patientName} em ${formattedDate}. Plataforma: ${clinicName}.`,
    });

    if (result.error) {
      const emailPayload = {
        to,
        subject: `[${clinicName}] Comprovante de Autorização de Menor (LGPD) - ${patientName}`,
        html: htmlContent,
        text: `Olá, ${guardianName || "Responsável Legal"}! Confirmamos o registro do seu consentimento formal como responsável legal pelo(a) menor ${patientName} em ${formattedDate}. Plataforma: ${clinicName}.`,
      };
      const supabaseBase = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
      const qRes = supabaseBase
        ? await enqueueToQStash("notifications-reliable", {
            targetUrl: `${supabaseBase}/functions/v1/platform-observability`,
            body: { action: "retry_transactional_email", emailPayload },
            retries: 5,
            deduplicationId: `consent-proof:${linkRow.id}:${to}`,
          })
        : { queued: false };

      if (qRes.queued) {
        return json({ success: true, queued: true, messageId: qRes.messageId }, 202, rlHeaders);
      }

      console.error("[send-guardian-consent-proof] Erro ao enviar:", result.error);
      await reportError({
        service: "send-guardian-consent-proof",
        code: "resend_send_failed",
        route: "send-guardian-consent-proof",
        message: result.error.message || "Falha ao enviar comprovante via Resend",
        metadata: { clinic_id: linkRow.clinic_id },
      });
      return json({ error: result.error.message }, 500, rlHeaders);
    }

    return json({ success: true, id: result.id }, 200, rlHeaders);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro inesperado";
    console.error("[send-guardian-consent-proof] Exceção:", msg);
    await reportError({
      service: "send-guardian-consent-proof",
      level: "critical",
      code: "edge_unhandled_500",
      route: "send-guardian-consent-proof",
      message: msg,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return json({ error: msg }, 500);
  }
});
