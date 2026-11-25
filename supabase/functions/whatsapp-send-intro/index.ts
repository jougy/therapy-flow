// supabase/functions/whatsapp-send-intro/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";
import { WhatsAppClient, sanitizeWhatsAppNumber } from "../_shared/whatsapp-client.ts";
import { checkRateLimit, rateLimitExceededResponse } from "../_shared/rate-limit.ts";
import { reportError } from "../_shared/error-dedup.ts";

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

    const rl = await checkRateLimit({
      preset: "whatsapp_intro_user",
      identifier: user.id,
      service: "whatsapp-send-intro",
      route: "whatsapp-send-intro",
    });
    if (!rl.allowed) {
      return rateLimitExceededResponse(rl, corsHeaders, undefined, { success: false });
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
      `• Emitir termos de consentimento e acessar links seguros de prontuários\n` +
      `• Acessar o financeiro da sua clínica e suporte direto\n\n` +
      `🚀 *Acesso Prático e Imediato:*\n` +
      `Seu número de celular já foi reconhecido pelo sistema! Basta responder com *menu* ou *entrar* para começar a usar.\n\n` +
      `🔒 *Dica de Privacidade:* Recomendamos ativar a opção *Trancar Conversa* (com biometria/FaceID) nas configurações deste contato no WhatsApp.`;

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
    await reportError({
      service: "whatsapp-send-intro",
      level: "critical",
      code: "edge_unhandled_500",
      route: "whatsapp-send-intro",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao enviar mensagem",
    }, 500);
  }
});
