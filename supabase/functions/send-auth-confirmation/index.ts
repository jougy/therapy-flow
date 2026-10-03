import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { corsHeaders } from "../_shared/cors.ts";
import { ResendClient } from "../_shared/resend-client.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const DEFAULT_ORIGIN =
  Deno.env.get("SITE_URL") ||
  Deno.env.get("PUBLIC_APP_URL") ||
  "https://pluri.health";

// Whitelist de domínios confiáveis para prevenir ataques de Open Redirect
const TRUSTED_DOMAINS = [
  "pluri.health",
  "www.pluri.health",
  "fisioterapia.prontohealth.workers.dev",
  "plurifisio.com.br",
  "www.plurifisio.com.br",
  "plurihealth.com.br",
  "www.plurihealth.com.br",
  "app.plurihealth.com.br",
  "localhost",
  "127.0.0.1",
];

const isTrustedOrigin = (originUrl: string): boolean => {
  try {
    const url = new URL(originUrl);
    const hostname = url.hostname.toLowerCase();

    if (TRUSTED_DOMAINS.includes(hostname)) {
      return true;
    }

    // Permitir subdomínios oficiais de workers.dev / pages.dev do projeto
    if (hostname.endsWith(".workers.dev") || hostname.endsWith(".pages.dev") || hostname.endsWith(".supabase.co")) {
      return true;
    }

    const defaultUrl = new URL(DEFAULT_ORIGIN);
    if (url.origin === defaultUrl.origin) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
};

const buildConfirmationRedirectUrl = (customRedirectTo?: string, reqOrigin?: string | null): string => {
  if (customRedirectTo) {
    try {
      // Bloquear injeção de quebras de linha
      if (/[\r\n\0]/.test(customRedirectTo)) {
        throw new Error("Invalid characters in redirectTo");
      }

      const parsed = new URL(customRedirectTo);
      if (["http:", "https:"].includes(parsed.protocol) && isTrustedOrigin(parsed.origin)) {
        // Garantir que o redirect aponte para rota segura de autenticação
        if (parsed.pathname.startsWith("/auth/") || parsed.pathname === "/auth") {
          return customRedirectTo;
        }
      }
    } catch {
      // Fallback seguro caso falhe a validação
    }
  }

  let baseOrigin = DEFAULT_ORIGIN;
  if (reqOrigin && isTrustedOrigin(reqOrigin)) {
    baseOrigin = reqOrigin;
  }

  const cleanOrigin = baseOrigin.replace(/\/+$/, "");
  return `${cleanOrigin}/auth/confirmado`;
};

// Sanitização e validação rigorosa de e-mail (RFC 5322 simplificada, anti-injection)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const sanitizeEmail = (value: unknown): string | null => {
  if (!value || typeof value !== "string") return null;
  const raw = value.trim();

  // Bloquear e-mails com caracteres de controle (prevenção de Header Injection)
  if (/[\r\n\0]/.test(raw) || raw.length > 254) {
    return null;
  }

  const normalized = raw.toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    return null;
  }

  return normalized;
};

// Rate limiting in-memory por IP e por e-mail para prevenir spam e exaustão de quota
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const emailLimiter = new Map<string, RateLimitEntry>();
const ipLimiter = new Map<string, RateLimitEntry>();

const checkRateLimit = (
  map: Map<string, RateLimitEntry>,
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfter?: number } => {
  const now = Date.now();
  const entry = map.get(key);

  // Limpeza de entradas expiradas periodicamente se o mapa crescer muito
  if (map.size > 2000) {
    for (const [k, v] of map.entries()) {
      if (now > v.resetTime) {
        map.delete(k);
      }
    }
  }

  if (!entry || now > entry.resetTime) {
    map.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count += 1;
  return { allowed: true };
};


const EMBEDDED_CONFIRMATION_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Confirme sua conta Pluri-Health</title>
  </head>
  <body style="margin:0;background:#eef8f7;color:#0f172a;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef8f7;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d9e8ef;border-radius:20px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.08);">
            <tr>
              <td style="height:6px;background:linear-gradient(90deg,#0ea5e9,#22d3ee,#34d399);"></td>
            </tr>
            <tr>
              <td style="padding:34px 30px 14px;text-align:left;">
                <p style="margin:0 0 10px;color:#0369a1;font-size:14px;font-weight:700;letter-spacing:0.02em;">Pluri-Health</p>
                <h1 style="margin:0;color:#0f172a;font-size:28px;line-height:1.18;font-weight:800;">Confirme sua conta alfa</h1>
                <p style="margin:16px 0 0;color:#475569;font-size:16px;line-height:1.6;">
                  Recebemos a criação de uma conta para organizar sua rotina clínica no Pluri-Health. Confirme seu e-mail para liberar o acesso com segurança.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px 8px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;border-radius:12px;padding:14px 20px;font-size:16px;font-weight:700;">
                  Confirmar minha conta
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px 0;">
                <div style="border:1px solid #bae6fd;background:#f0f9ff;border-radius:14px;padding:14px 16px;color:#075985;font-size:14px;line-height:1.55;">
                  Se o botão não abrir, copie e cole este link no navegador:<br>
                  <a href="{{ .ConfirmationURL }}" style="color:#0369a1;word-break:break-all;">{{ .ConfirmationURL }}</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 30px 30px;color:#64748b;font-size:13px;line-height:1.55;">
                Este link é pessoal e expira por segurança. Se você não criou uma conta no Pluri-Health, ignore esta mensagem.
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
            Pluri-Health · Gestão clínica com contexto, segurança e continuidade.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const EMBEDDED_CONFIRMATION_TEXT = `Pluri-Health

Confirme sua conta alfa

Recebemos a criação de uma conta para organizar sua rotina clínica no Pluri-Health. Confirme seu e-mail para liberar o acesso com segurança.

Confirmar minha conta:
{{ .ConfirmationURL }}

Este link é pessoal e expira por segurança. Se você não criou uma conta no Pluri-Health, ignore esta mensagem.`;

interface SendAuthConfirmationPayload {
  email?: string;
  redirectTo?: string;
  actionType?: "signup" | "magiclink";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes.");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Extração de IP e verificação de Rate Limit por IP
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown-ip";

    const ipLimit = checkRateLimit(ipLimiter, clientIp, 15, 60_000); // 15 reqs/min por IP
    if (!ipLimit.allowed) {
      return json(
        {
          error: "Limite de solicitações atingido para este IP. Por favor, aguarde alguns instantes.",
          retryAfter: ipLimit.retryAfter,
        },
        429
      );
    }

    const body: SendAuthConfirmationPayload = await req.json().catch(() => ({}));
    const email = sanitizeEmail(body.email);

    if (!email) {
      return json({ error: "Endereço de e-mail inválido ou ausente." }, 400);
    }

    // 2. Verificação de Rate Limit por e-mail (max 3 disparos por minuto por endereço)
    const emailLimit = checkRateLimit(emailLimiter, email, 3, 60_000);
    if (!emailLimit.allowed) {
      return json(
        {
          error: `Muitas tentativas de envio para este e-mail. Aguarde ${emailLimit.retryAfter} segundos.`,
          retryAfter: emailLimit.retryAfter,
        },
        429
      );
    }

    const originHeader = req.headers.get("origin") || req.headers.get("referer");
    let detectedOrigin: string | null = null;
    if (originHeader) {
      try {
        detectedOrigin = new URL(originHeader).origin;
      } catch {
        // Ignora erro de parse de URL
      }
    }

    const redirectUrl = buildConfirmationRedirectUrl(body.redirectTo, detectedOrigin);

    let confirmationUrl = "";

    // 1. Tentar gerar link tipo 'signup'
    try {
      const { data, error } = await admin.auth.admin.generateLink({
        type: "signup",
        email,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        throw error;
      }

      confirmationUrl = data?.properties?.action_link ?? "";
    } catch (signupError) {
      console.warn(
        `[send-auth-confirmation] generateLink(signup) falhou para ${email}:`,
        signupError instanceof Error ? signupError.message : signupError,
        "Tentando fallback para magiclink..."
      );

      // 2. Fallback para magiclink se o usuário já existir/estiver cadastrado
      const { data: magicData, error: magicError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (magicError || !magicData?.properties?.action_link) {
        const errorMsg =
          magicError?.message ||
          (signupError instanceof Error ? signupError.message : "Não foi possível gerar o link de confirmação.");
        console.error(`[send-auth-confirmation] generateLink(magiclink) também falhou:`, errorMsg);
        return json({ error: "Não foi possível gerar o link de ativação da conta." }, 400);
      }

      confirmationUrl = magicData.properties.action_link;
    }

    if (!confirmationUrl) {
      return json({ error: "Link de confirmação gerado vazio." }, 500);
    }

    // Tentar ler template do disco se disponível no runtime, com fallback para o template embutido
    let rawHtml = EMBEDDED_CONFIRMATION_HTML;
    let rawText = EMBEDDED_CONFIRMATION_TEXT;

    try {
      const templatePath = new URL("../../templates/confirm-signup.html", import.meta.url);
      const fileContent = await Deno.readTextFile(templatePath);
      if (fileContent && fileContent.includes("{{ .ConfirmationURL }}")) {
        rawHtml = fileContent;
      }
    } catch {
      // Fallback para EMBEDDED_CONFIRMATION_HTML
    }

    try {
      const textTemplatePath = new URL("../../templates/confirm-signup.txt", import.meta.url);
      const textContent = await Deno.readTextFile(textTemplatePath);
      if (textContent && textContent.includes("{{ .ConfirmationURL }}")) {
        rawText = textContent;
      }
    } catch {
      // Fallback para EMBEDDED_CONFIRMATION_TEXT
    }

    const html = rawHtml.replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, confirmationUrl);
    const text = rawText.replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, confirmationUrl);

    const resend = new ResendClient();
    const sendResult = await resend.sendEmail({
      to: email,
      subject: "Confirme sua conta Pluri-Health",
      html,
      text,
    });

    if (sendResult.error) {
      console.error("[send-auth-confirmation] Erro no envio via Resend:", sendResult.error);
      return json(
        { error: "Falha temporária no provedor de e-mail. Tente novamente em instantes." },
        500
      );
    }

    return json({
      ok: true,
      message: "E-mail de confirmação enviado com sucesso via Resend.",
      emailId: sendResult.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado ao processar confirmação.";
    console.error("[send-auth-confirmation] Erro interno:", message);
    return json({ error: "Erro interno ao processar a confirmação de e-mail." }, 500);
  }
});
