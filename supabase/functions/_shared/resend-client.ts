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
      "Pluri-Health <onboarding@resend.dev>";
  }

  async sendEmail(payload: SendEmailPayload): Promise<SendEmailResponse> {
    if (!this.apiKey) {
      throw new Error(
        "RESEND_API_KEY não configurada. Defina a variável de ambiente nas secrets do Supabase."
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: payload.from || this.defaultFrom,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        reply_to: payload.reply_to,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        error: {
          message: data?.message || `Erro ao enviar e-mail via Resend (Status ${response.status})`,
          statusCode: response.status,
          name: data?.name,
        },
      };
    }

    return { id: data.id };
  }
}

export const getResendClient = () => new ResendClient();
