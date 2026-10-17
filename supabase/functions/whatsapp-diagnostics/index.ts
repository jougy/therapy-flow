// supabase/functions/whatsapp-diagnostics/index.ts
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
      return json({ success: false, error: "Configuração do servidor Supabase ausente" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ success: false, error: "Autorização necessária" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ success: false, error: "Usuário não autenticado" }, 401);
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Dados do perfil do usuário
    const { data: profile, error: profileErr } = await adminSupabase
      .from("profiles")
      .select("id, full_name, phone, totp_enabled, totp_enabled_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      return json({ success: false, error: "Erro ao buscar dados do perfil", detail: profileErr }, 500);
    }

    // 2. Configurações da API de WhatsApp
    const whatsAppClient = new WhatsAppClient();
    const provider = whatsAppClient.provider;
    const isConfigured = whatsAppClient.isConfigured();
    const businessPhone = whatsAppClient.getBusinessPhone();
    const adminCommercialPhone = whatsAppClient.getAdminCommercialPhone();

    // Diagnóstico das credenciais sem expor tokens completos
    const hasApiKey = Boolean(whatsAppClient.apiKey && whatsAppClient.apiKey.length > 5);
    const hasPhoneNumberId = Boolean(whatsAppClient.phoneNumberId);
    const hasApiUrl = Boolean(whatsAppClient.apiUrl);

    // 3. Status da Sessão do WhatsApp do Usuário
    let sessionData: Record<string, unknown> | null = null;
    let cleanPhone: string | null = null;

    if (profile?.phone) {
      cleanPhone = sanitizeWhatsAppNumber(profile.phone);
      if (cleanPhone) {
        const { data: session } = await adminSupabase
          .from("whatsapp_chat_sessions")
          .select("id, phone, current_step, is_authenticated, auth_expires_at, authenticated_at, last_message_at, metadata")
          .eq("phone", cleanPhone)
          .maybeSingle();

        sessionData = session;
      }
    }

    // 4. Últimos eventos de auditoria ou logs de erro do WhatsApp
    const { data: errorLogs } = await adminSupabase
      .from("platform_error_logs")
      .select("id, error_type, scope, message, context, created_at")
      .or(`scope.ilike.%whatsapp%,error_type.ilike.%whatsapp%`)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: auditEvents } = await adminSupabase
      .from("platform_audit_events")
      .select("id, event_type, created_at, payload")
      .eq("target_user_id", user.id)
      .ilike("event_type", "%whatsapp%")
      .order("created_at", { ascending: false })
      .limit(5);

    // 5. Se o usuário solicitou um ping / envio de teste no body
    let testSendResult: Record<string, unknown> | null = null;
    const reqBody = await req.json().catch(() => null);
    if (reqBody && reqBody.action === "test_ping" && cleanPhone) {
      if (!isConfigured) {
        testSendResult = {
          success: false,
          error: "Credenciais de WhatsApp não estão configuradas nas variáveis de ambiente do Supabase (WHATSAPP_API_KEY ou META_WHATSAPP_TOKEN).",
        };
      } else {
        const pingMsg = `🩺 *Diagnóstico Pluri-Health*\n\nConexão com o WhatsApp testada e operacional com sucesso! 🚀\nHorário: ${new Date().toLocaleTimeString("pt-BR")}`;
        const sendRes = await whatsAppClient.sendTextMessage(cleanPhone, pingMsg);
        testSendResult = sendRes;
      }
    }

    return json({
      success: true,
      diagnostic: {
        timestamp: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email,
          full_name: profile?.full_name || null,
          phone: profile?.phone || null,
          clean_phone: cleanPhone,
          totp_enabled: !!profile?.totp_enabled,
          totp_enabled_at: profile?.totp_enabled_at || null,
        },
        whatsapp_config: {
          provider,
          is_configured: isConfigured,
          has_api_key: hasApiKey,
          has_phone_number_id: hasPhoneNumberId,
          has_api_url: hasApiUrl,
          business_phone: businessPhone,
          admin_commercial_phone: adminCommercialPhone,
        },
        session: sessionData,
        test_send_result: testSendResult,
        recent_error_logs: errorLogs || [],
        recent_audit_events: auditEvents || [],
      },
    });
  } catch (error) {
    console.error("[whatsapp-diagnostics] Erro ao executar diagnóstico:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao executar diagnóstico",
    }, 500);
  }
});
