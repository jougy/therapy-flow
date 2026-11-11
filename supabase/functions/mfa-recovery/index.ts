// supabase/functions/mfa-recovery/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";
import { WhatsAppClient, sanitizeWhatsAppNumber } from "../_shared/whatsapp-client.ts";
import { ResendClient } from "../_shared/resend-client.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const maskPhone = (rawPhone: string): string => {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length < 10) return "(**) *****-****";
  const ddd = digits.slice(-11, -9);
  const lastFour = digits.slice(-4);
  return `(${ddd}) 9****-**${lastFour.slice(-2)}`;
};

const maskEmail = (emailStr: string): string => {
  const [user, domain] = emailStr.split("@");
  if (!user || !domain) return "***@***";
  const first = user[0] || "*";
  return `${first}***@${domain}`;
};

const hashCode = async (code: string): Promise<string> => {
  const msgUint8 = new TextEncoder().encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ success: false, error: "Configuração do servidor Supabase ausente." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ success: false, error: "Cabeçalho de autenticação ausente." }, 401);
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ success: false, error: "Usuário não autenticado no 1º fator." }, 401);
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // 1. Obter canais disponíveis com mascaramento
    if (action === "get_channels") {
      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("id, email, phone, full_name")
        .eq("id", user.id)
        .maybeSingle();

      const userEmail = profile?.email || user.email || "";
      const userPhone = profile?.phone || "";

      return json({
        success: true,
        user: {
          id: user.id,
          name: profile?.full_name || "Usuário",
          email_available: Boolean(userEmail.trim()),
          email_masked: userEmail.trim() ? maskEmail(userEmail.trim()) : null,
          whatsapp_available: Boolean(userPhone.trim() && userPhone.replace(/\D/g, "").length >= 10),
          whatsapp_masked: userPhone.trim() ? maskPhone(userPhone.trim()) : null,
        },
      });
    }

    // 2. Solicitar envio de código de recuperação (WhatsApp ou E-mail)
    if (action === "request_code") {
      const channel = body?.channel;
      if (channel !== "whatsapp" && channel !== "email") {
        return json({ success: false, error: "Canal inválido. Escolha 'whatsapp' ou 'email'." }, 400);
      }

      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("id, email, phone, full_name")
        .eq("id", user.id)
        .maybeSingle();

      const userEmail = profile?.email || user.email || "";
      const userPhone = profile?.phone || "";

      // Rate limit recente (não gerar mais de 1 código por minuto para o mesmo usuário)
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const { data: recentChallenges } = await adminSupabase
        .from("mfa_recovery_challenges")
        .select("id")
        .eq("user_id", user.id)
        .gt("created_at", oneMinuteAgo);

      if (recentChallenges && recentChallenges.length > 0) {
        return json(
          { success: false, error: "Aguarde 1 minuto antes de solicitar um novo código de recuperação." },
          429
        );
      }

      // Gerar OTP criptográfico de 6 dígitos
      const randomArray = new Uint32Array(1);
      crypto.getRandomValues(randomArray);
      const otpCode = String(100000 + (randomArray[0] % 900000));
      const codeHash = await hashCode(otpCode);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      let targetMasked = "";

      if (channel === "whatsapp") {
        if (!userPhone.trim() || userPhone.replace(/\D/g, "").length < 10) {
          return json({ success: false, error: "Telefone com WhatsApp não configurado no perfil." }, 400);
        }
        targetMasked = maskPhone(userPhone);

        const cleanPhone = sanitizeWhatsAppNumber(userPhone);
        const whatsAppClient = new WhatsAppClient();
        const msg = `🔐 *Pluri Health - Recuperação de Acesso 2FA*\n\nSeu código de segurança para redefinir o Ente Auth é:\n\n*${otpCode}*\n\n⏱️ Válido por 10 minutos. Nunca compartilhe este código com ninguém.`;

        const sendRes = await whatsAppClient.sendTextMessage(cleanPhone, msg);
        if (!sendRes.success) {
          console.error("[mfa-recovery] Erro ao enviar WhatsApp:", sendRes.error);
          return json({ success: false, error: `Falha no envio via WhatsApp: ${sendRes.error}` }, 502);
        }
      } else {
        if (!userEmail.trim()) {
          return json({ success: false, error: "E-mail não encontrado na conta." }, 400);
        }
        targetMasked = maskEmail(userEmail);

        const resendClient = new ResendClient();
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 20px; background-color: #ffffff; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 28px;">
              <h2 style="color: #0284c7; margin: 0; font-size: 22px;">Pluri Health</h2>
              <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Recuperação do Segundo Fator de Autenticação (2FA)</p>
            </div>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <p style="font-size: 14px; color: #475569; margin-top: 0;">Use o código abaixo para redefinir seu autenticador Ente Auth:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a; font-family: monospace; padding: 12px 0;">
                ${otpCode}
              </div>
              <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">Válido pelos próximos 10 minutos.</p>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5;">Se você não solicitou esta recuperação, verifique sua conta imediatamente. Por segurança, nossa equipe nunca pedirá este código.</p>
          </div>
        `;

        const emailRes = await resendClient.sendEmail({
          to: userEmail.trim(),
          subject: `${otpCode} é seu código de recuperação 2FA - Pluri Health`,
          html: emailHtml,
          text: `Seu código de recuperação 2FA no Pluri Health é: ${otpCode}. Válido por 10 minutos.`,
        });

        if (!emailRes.success) {
          console.error("[mfa-recovery] Erro ao enviar E-mail:", emailRes.error);
          return json({ success: false, error: `Falha no envio de e-mail: ${emailRes.error?.message || "Serviço indisponível"}` }, 502);
        }
      }

      // Gravar registro na tabela mfa_recovery_challenges
      await adminSupabase.from("mfa_recovery_challenges").insert({
        user_id: user.id,
        channel,
        target_masked: targetMasked,
        code_hash: codeHash,
        expires_at: expiresAt,
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
        user_agent: req.headers.get("user-agent") || null,
      });

      return json({
        success: true,
        channel,
        target_masked: targetMasked,
        expires_at: expiresAt,
      });
    }

    // 3. Validar código recebido e purgar fator TOTP antigo
    if (action === "verify_code") {
      const code = String(body?.code || "").trim();
      if (!/^\d{6}$/.test(code)) {
        return json({ success: false, error: "Código deve conter exatamente 6 dígitos numéricos." }, 400);
      }

      const inputHash = await hashCode(code);
      const nowIso = new Date().toISOString();

      // Buscar desafio ativo mais recente
      const { data: challenge, error: challengeErr } = await adminSupabase
        .from("mfa_recovery_challenges")
        .select("id, attempts, max_attempts, expires_at, code_hash")
        .eq("user_id", user.id)
        .is("verified_at", null)
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (challengeErr || !challenge) {
        return json(
          { success: false, error: "Nenhum código ativo encontrado ou o código expirou. Solicite um novo." },
          400
        );
      }

      if (challenge.attempts >= challenge.max_attempts) {
        return json(
          { success: false, error: "Número máximo de tentativas excedido. Solicite um novo código." },
          403
        );
      }

      if (challenge.code_hash !== inputHash) {
        await adminSupabase
          .from("mfa_recovery_challenges")
          .update({ attempts: challenge.attempts + 1 })
          .eq("id", challenge.id);

        const remaining = challenge.max_attempts - (challenge.attempts + 1);
        return json(
          {
            success: false,
            error: `Código incorreto. ${remaining > 0 ? `Você tem mais ${remaining} tentativa(s).` : "Tentativas esgotadas."}`,
          },
          400
        );
      }

      // Marcar desafio como verificado
      await adminSupabase
        .from("mfa_recovery_challenges")
        .update({ verified_at: nowIso })
        .eq("id", challenge.id);

      // Purgar fatores TOTP do Supabase Auth para permitir novo recadastro
      const { data: factorData } = await adminSupabase.auth.admin.mfa.listFactors({
        userId: user.id,
      });

      if (factorData?.factors) {
        for (const factor of factorData.factors) {
          await adminSupabase.auth.admin.mfa.deleteFactor({
            userId: user.id,
            id: factor.id,
          });
        }
      }

      // Limpar tabelas auxiliares de MFA
      await adminSupabase.from("user_mfa_credentials").delete().eq("user_id", user.id);
      await adminSupabase.from("profiles").update({
        totp_secret: null,
        totp_enabled: false,
        totp_enabled_at: null,
        updated_at: nowIso,
      }).eq("id", user.id);

      return json({
        success: true,
        message: "Autenticação em dois fatores resetada com sucesso. Você já pode recadastrar seu QR Code.",
      });
    }

    return json({ success: false, error: "Ação não suportada." }, 400);
  } catch (error: unknown) {
    console.error("[mfa-recovery] Erro não tratado:", error);
    const msg = error instanceof Error ? error.message : "Erro interno no servidor";
    return json({ success: false, error: msg }, 500);
  }
});
