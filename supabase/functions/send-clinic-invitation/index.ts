import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
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

const requiredEnv = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Variavel de ambiente ausente: ${key}`);
  return value;
};

const supabaseUrl = requiredEnv("SUPABASE_URL");
const anonKey = requiredEnv("SUPABASE_ANON_KEY");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const normalizeToken = (value: unknown) =>
  String(value ?? "")
    .replace(/[^a-f0-9]/gi, "")
    .slice(0, 128);

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador(a)",
  professional: "Profissional",
  assistant: "Assistente",
  estagiario: "Estagiário(a)",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    const bearer = authorization?.replace(/^Bearer\s+/i, "");
    if (!bearer) return json({ error: "Token ausente." }, 401);

    const body = await req.json().catch(() => ({}));
    const token = normalizeToken(body.token);
    const inviteUrl = String(body.inviteUrl ?? "").trim();

    if (!token || !inviteUrl) {
      return json({ error: "Convite inválido ou URL ausente." }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(bearer);
    if (authError || !authData.user) return json({ error: "Usuário não autenticado." }, 401);

    const { data: invitation, error: invitationError } = await admin.rpc(
      "get_clinic_collaborator_invitation",
      { _token: token }
    );
    if (invitationError) throw new Error(invitationError.message);

    const clinicId = String(invitation?.clinic_id ?? "");
    const email = String(invitation?.email ?? "").trim().toLowerCase();
    const existingUser = Boolean(invitation?.existing_user);
    const status = String(invitation?.status ?? "");
    const clinicName = String(invitation?.clinic_name ?? "Clínica");
    const operationalRole = String(invitation?.operational_role ?? "professional");
    const roleLabel = ROLE_LABELS[operationalRole] || operationalRole;
    const jobTitle = invitation?.job_title ? String(invitation.job_title) : "";
    const specialty = invitation?.specialty ? String(invitation.specialty) : "";

    if (!clinicId || !email || status !== "pending") {
      return json({ error: "Convite não está mais pendente." }, 400);
    }

    const [{ data: canManage }, { data: isPlatformOwner }] = await Promise.all([
      userClient.rpc("current_user_can", {
        _capability: "subaccounts.manage",
        _clinic_id: clinicId,
      }),
      userClient.rpc("is_platform_owner_mfa_verified"),
    ]);

    if (canManage !== true && isPlatformOwner !== true) {
      return json({ error: "Você não tem permissão para enviar este convite." }, 403);
    }

    // Obter o nome de quem convidou
    const { data: inviterProfile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", authData.user.id)
      .maybeSingle();

    const inviterName =
      inviterProfile?.full_name || inviterProfile?.email || "A administração da clínica";

    const resend = new ResendClient();

    let emailSubject = "";
    let emailHtml = "";
    let destinationUrl = inviteUrl;

    if (existingUser) {
      // Usuário existente -> Link leva para o Espaço Pessoal onde responderá o convite
      const origin = new URL(inviteUrl).origin;
      destinationUrl = `${origin}/espacopessoal`;
      emailSubject = `Você foi convidado para participar da clínica ${clinicName} - Pluri-Health`;
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
            .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .header { text-align: center; margin-bottom: 24px; }
            .logo { font-size: 20px; font-weight: 700; color: #0284c7; letter-spacing: -0.5px; }
            .title { font-size: 22px; font-weight: 700; color: #0f172a; margin: 12px 0 8px 0; }
            .subtitle { font-size: 15px; color: #475569; line-height: 1.5; }
            .card { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 20px; margin: 24px 0; }
            .card-title { font-size: 16px; font-weight: 600; color: #0369a1; margin-bottom: 6px; }
            .card-item { font-size: 14px; color: #0c4a6e; margin: 4px 0; }
            .button-wrapper { text-align: center; margin: 32px 0 16px 0; }
            .button { display: inline-block; background-color: #059669; color: #ffffff !important; font-weight: 600; font-size: 16px; padding: 14px 28px; border-radius: 10px; text-decoration: none; box-shadow: 0 2px 8px rgba(5,150,105,0.25); }
            .footer { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Pluri-Health</div>
              <div class="title">Novo convite de equipe</div>
              <div class="subtitle"><strong>${inviterName}</strong> convidou você para fazer parte da clínica <strong>${clinicName}</strong>.</div>
            </div>
            
            <div class="card">
              <div class="card-title">Detalhes do Acesso</div>
              <div class="card-item"><strong>Clínica:</strong> ${clinicName}</div>
              <div class="card-item"><strong>Papel:</strong> ${roleLabel}</div>
              ${jobTitle ? `<div class="card-item"><strong>Cargo:</strong> ${jobTitle}</div>` : ""}
              ${specialty ? `<div class="card-item"><strong>Especialidade:</strong> ${specialty}</div>` : ""}
            </div>

            <p style="font-size: 14px; color: #475569; text-align: center;">
              Como você já possui cadastro no Pluri-Health, o convite já está disponível no seu <strong>Espaço Pessoal</strong> para você aceitar ou recusar.
            </p>

            <div class="button-wrapper">
              <a href="${destinationUrl}" class="button" target="_blank">Acessar Meu Espaço Pessoal</a>
            </div>

            <div class="footer">
              Você recebeu este e-mail porque foi convidado para uma clínica na plataforma Pluri-Health.<br>
              Se você não esperava por este convite, pode recusá-lo com segurança no sistema.
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      // Novo usuário -> Link leva para a página de onboarding /convite/clinica/:token
      destinationUrl = inviteUrl;
      emailSubject = `Convite para ingressar na equipe da clínica ${clinicName} - Pluri-Health`;
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
            .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .header { text-align: center; margin-bottom: 24px; }
            .logo { font-size: 20px; font-weight: 700; color: #0284c7; letter-spacing: -0.5px; }
            .title { font-size: 22px; font-weight: 700; color: #0f172a; margin: 12px 0 8px 0; }
            .subtitle { font-size: 15px; color: #475569; line-height: 1.5; }
            .card { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 20px; margin: 24px 0; }
            .card-title { font-size: 16px; font-weight: 600; color: #0369a1; margin-bottom: 6px; }
            .card-item { font-size: 14px; color: #0c4a6e; margin: 4px 0; }
            .button-wrapper { text-align: center; margin: 32px 0 16px 0; }
            .button { display: inline-block; background-color: #0284c7; color: #ffffff !important; font-weight: 600; font-size: 16px; padding: 14px 28px; border-radius: 10px; text-decoration: none; box-shadow: 0 2px 8px rgba(2,132,199,0.25); }
            .footer { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Pluri-Health</div>
              <div class="title">Você foi convidado para uma equipe!</div>
              <div class="subtitle"><strong>${inviterName}</strong> convidou você para fazer parte de <strong>${clinicName}</strong> na plataforma Pluri-Health.</div>
            </div>
            
            <div class="card">
              <div class="card-title">Detalhes do Convite</div>
              <div class="card-item"><strong>Clínica:</strong> ${clinicName}</div>
              <div class="card-item"><strong>Papel:</strong> ${roleLabel}</div>
              ${jobTitle ? `<div class="card-item"><strong>Cargo:</strong> ${jobTitle}</div>` : ""}
              ${specialty ? `<div class="card-item"><strong>Especialidade:</strong> ${specialty}</div>` : ""}
            </div>

            <p style="font-size: 14px; color: #475569; text-align: center;">
              Seu e-mail <strong>${email}</strong> já está validado para este acesso. Clique no botão abaixo para concluir seu cadastro e entrar diretamente na clínica.
            </p>

            <div class="button-wrapper">
              <a href="${destinationUrl}" class="button" target="_blank">Completar Cadastro e Acessar</a>
            </div>

            <div class="footer">
              Este convite é intransferível e válido por 14 dias.<br>
              Se o botão não funcionar, copie e cole o link no seu navegador: <br>
              <span style="color: #64748b; word-break: break-all;">${destinationUrl}</span>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    const emailResult = await resend.sendEmail({
      to: email,
      subject: emailSubject,
      html: emailHtml,
    });

    if (emailResult.error) {
      throw new Error(`Falha ao despachar e-mail: ${emailResult.error.message}`);
    }

    return json({
      sent: true,
      email,
      existingUser,
      destinationUrl,
      emailId: emailResult.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar convite.";
    return json({ error: message }, 400);
  }
});
