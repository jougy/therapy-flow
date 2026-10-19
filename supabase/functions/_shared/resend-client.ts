// Cliente Resend compartilhado para Supabase Edge Functions (Deno)

export interface SendEmailPayload {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  reply_to?: string | string[];
}

export interface SendEmailResponse {
  id?: string;
  error?: {
    message: string;
    name?: string;
    statusCode?: number;
  };
}

export class ResendClient {
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey?: string, defaultFrom?: string) {
    this.apiKey =
      apiKey ||
      Deno.env.get("RESEND_API_KEY") ||
      "";
    this.defaultFrom =
      defaultFrom ||
      Deno.env.get("RESEND_DEFAULT_FROM") ||
      "Pluri-Health <convite@pluri.health>";
  }

  async sendEmail(payload: SendEmailPayload): Promise<SendEmailResponse> {
    if (!this.apiKey) {
      throw new Error(
        "RESEND_API_KEY não configurada. Defina a variável de ambiente nas secrets do Supabase."
      );
    }

    const fromAddress = payload.from || this.defaultFrom;
    const maxAttempts = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: Array.isArray(payload.to) ? payload.to : [payload.to],
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
            reply_to: payload.reply_to,
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const status = response.status;
          console.error(`[ResendClient] Tentativa ${attempt}/${maxAttempts} falhou com status ${status}:`, data);
          
          if ((status === 429 || status >= 500) && attempt < maxAttempts) {
            const delay = attempt * 700;
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }

          return {
            error: {
              message: data?.message || `Erro ao enviar e-mail via Resend (Status ${status})`,
              statusCode: status,
              name: data?.name,
            },
          };
        }

        return { id: data.id };
      } catch (err) {
        lastError = err;
        console.error(`[ResendClient] Erro de rede na tentativa ${attempt}/${maxAttempts}:`, err);
        if (attempt < maxAttempts) {
          const delay = attempt * 700;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }
    }

    return {
      error: {
        message: lastError?.message || "Erro de conexão ao enviar e-mail após múltiplas tentativas.",
        statusCode: 500,
      },
    };
  }
}

export const getResendClient = () => new ResendClient();
