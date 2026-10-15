// supabase/functions/whatsapp-send-intro/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";
import { WhatsAppClient, sanitizeWhatsAppNumber } from "../_shared/whatsapp-client.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json({ success: false, error: "Configuração do servidor ausente" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ success: false, error: "Autorização necessária" }, 401);
    }

    // Valida usuário chamador
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ success: false, error: "Usuário não autenticado" }, 401);
    }

    // Busca perfil com service role
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileErr } = await adminSupabase
      .from("profiles")
      .select("id, full_name, phone, totp_enabled")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return json({ success: false, error: "Perfil do usuário não encontrado" }, 404);
    }

    const rawPhone = profile.phone;
    if (!rawPhone || !rawPhone.trim()) {
      return json({ success: false, error: "Nenhum número de celular cadastrado no seu perfil" }, 400);
    }

    const cleanPhone = sanitizeWhatsAppNumber(rawPhone);
    if (!cleanPhone) {
      return json({ success: false, error: "Número de celular inválido para envio de WhatsApp" }, 400);
    }

    const whatsAppClient = new WhatsAppClient();
    const userName = profile.full_name ? profile.full_name.split(" ")[0] : "Profissional";
    const has2fa = !!profile.totp_enabled;

    let introMessage =
      `👋 *Olá, ${userName}! Tudo bem?*\n\n` +
      `Aqui é o seu *Copiloto Oficial Pluri-Health / PluriFisio* no WhatsApp!\n\n` +
      `Por aqui você poderá:\n` +
      `• Consultar e gerenciar sua agenda e próximos pacientes\n` +
      `• Realizar pré-cadastro rápido de novos pacientes\n` +
      `• Emitir termos de consentimento e consultar prontuários\n` +
      `• Acessar o financeiro da sua clínica e suporte direto\n\n`;

    if (has2fa) {
      introMessage +=
        `🔒 *Sua conta já possui a verificação em 2 fatores (2FA) configurada!*\n` +
        `Para começar agora, basta responder com *login* ou *entrar* e digitar o código gerado no seu aplicativo *Ente Auth*.`;
    } else {
      introMessage +=
        `⚙️ *Para sua segurança, o acesso aos comandos exige a ativação do 2FA:*\n` +
        `Acesse *Configurações* > *Segurança Pessoal* na plataforma web e ative a Autenticação em Dois Fatores com o app *Ente Auth*.\n\n` +
        `Assim que ativar, basta responder aqui com *login*!`;
    }

    const sendRes = await whatsAppClient.sendTextMessage(cleanPhone, introMessage);

    if (!sendRes.success) {
      console.error("[whatsapp-send-intro] Falha no envio da mensagem via WhatsApp:", sendRes);
      return json({
        success: false,
        error: sendRes.error || "Não foi possível entregar a mensagem no WhatsApp. Verifique as credenciais ou a conexão da instância.",
        detail: sendRes,
      }, 502);
    }

    // Registra evento de auditoria
    await adminSupabase.from("platform_audit_events").insert({
      actor_user_id: user.id,
      target_user_id: user.id,
      event_type: "whatsapp_intro_message_sent",
      visibility_scope: "personal",
      payload: {
        phone: cleanPhone,
        has_2fa: has2fa,
        sent_at: new Date().toISOString(),
      },
    });

    return json({
      success: true,
      message: "Mensagem de apresentação enviada com sucesso!",
      phone: cleanPhone,
      result: sendRes,
    });
  } catch (error) {
    console.error("[whatsapp-send-intro] Erro ao enviar mensagem:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao enviar mensagem",
    }, 500);
  }
});
