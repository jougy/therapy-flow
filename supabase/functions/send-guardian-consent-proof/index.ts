import { ResendClient } from "../_shared/resend-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { to, patientName, guardianName, signedAt, clinicName = "Pluri-Health" } = body;

    if (!to || !patientName) {
      return json({ error: "Destinatário ou paciente ausente." }, 400);
    }

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

    <p>Olá, <strong>${guardianName || "Responsável Legal"}</strong>,</p>
    <p>Confirmamos o registro da sua autorização formal para o atendimento e tratamento de dados de saúde do(a) menor <strong>${patientName}</strong> na plataforma <strong>${clinicName}</strong>.</p>

    <div class="info-box">
      <div class="info-row">
        <span class="label">Paciente:</span>
        <span class="value">${patientName}</span>
      </div>
      <div class="info-row">
        <span class="label">Responsável Legal:</span>
        <span class="value">${guardianName || "Declarado no ato"}</span>
      </div>
      <div class="info-row">
        <span class="label">Data e Hora do Aceite:</span>
        <span class="value">${formattedDate}</span>
      </div>
      <div class="info-row">
        <span class="label">Canal:</span>
        <span class="value">Assinatura Digital Segura</span>
      </div>
    </div>

    <p>Este comprovante foi emitido para seus arquivos pessoais. Você tem o direito de solicitar esclarecimentos, cópias de prontuário e retificações a qualquer momento junto à clínica.</p>

    <div class="footer">
      ${clinicName} • Gestão Clínica em conformidade com a LGPD e Ética Profissional.
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
      text: `Olá, ${guardianName}! Confirmamos o registro do seu consentimento formal como responsável legal pelo(a) menor ${patientName} em ${formattedDate}. Plataforma: ${clinicName}.`,
    });

    if (result.error) {
      console.error("[send-guardian-consent-proof] Erro ao enviar:", result.error);
      return json({ error: result.error.message }, 500);
    }

    return json({ success: true, id: result.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro inesperado";
    console.error("[send-guardian-consent-proof] Exceção:", msg);
    return json({ error: msg }, 500);
  }
});
