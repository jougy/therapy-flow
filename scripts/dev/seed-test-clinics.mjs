#!/usr/bin/env node

import { createPrivateKey, sign } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const execFileAsync = promisify(execFile);
const DEFAULT_PASSWORD = "Senha123456!";

const generateEs256TokenFromDocker = async () => {
  try {
    const { stdout: psStdout } = await execFileAsync("docker", [
      "ps",
      "--filter",
      "name=supabase_auth_",
      "--format",
      "{{.Names}}",
    ]);
    const containerName = psStdout.trim().split("\n")[0];
    if (!containerName) return null;

    const { stdout: envStdout } = await execFileAsync("docker", [
      "exec",
      containerName,
      "env",
    ]);

    const jwtKeysMatch = envStdout.match(/^GOTRUE_JWT_KEYS=(.*)$/m);
    if (!jwtKeysMatch) return null;

    const jwkList = JSON.parse(jwtKeysMatch[1]);
    const es256Jwk = jwkList.find((key) => key.alg === "ES256" && key.d);
    if (!es256Jwk) return null;

    const key = createPrivateKey({ key: es256Jwk, format: "jwk" });
    const header = Buffer.from(
      JSON.stringify({ alg: "ES256", kid: es256Jwk.kid, typ: "JWT" })
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        iss: "supabase-demo",
        role: "service_role",
        exp: Math.floor(Date.now() / 1000) + 10 * 365 * 86400,
      })
    ).toString("base64url");
    const signature = sign("SHA256", Buffer.from(`${header}.${payload}`), {
      key,
      dsaEncoding: "ieee-p1363",
    }).toString("base64url");

    return `${header}.${payload}.${signature}`;
  } catch (err) {
    console.error("Erro ao gerar token JWT do Docker:", err);
    return null;
  }
};

const getAdminClient = async () => {
  const token = await generateEs256TokenFromDocker();
  if (!token) {
    throw new Error("Não foi possível gerar token de serviço do Docker.");
  }
  return createClient("http://127.0.0.1:54321", token, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const CLINICS_TO_SEED = [
  {
    name: "Clínica Fisioterapia Alfa",
    cnpj: "11111111000111",
    owner: { name: "Dr. Carlos Eduardo Alfa", email: "owner_alfa@test.com" },
    users: [
      { name: "Mariana Silva (Admin 1)", email: "admin1_alfa@test.com", role: "admin" },
      { name: "Roberto Souza (Admin 2)", email: "admin2_alfa@test.com", role: "admin" },
      { name: "Dra. Ana Paula (Pro 1)", email: "pro1_alfa@test.com", role: "professional" },
      { name: "Dr. Bruno Lima (Pro 2)", email: "pro2_alfa@test.com", role: "professional" },
      { name: "Dra. Camilla Ramos (Pro 3)", email: "pro3_alfa@test.com", role: "professional" },
      { name: "Dr. Daniel Costa (Pro 4)", email: "pro4_alfa@test.com", role: "professional" },
      { name: "Fernanda Oliveira (Assistente 1)", email: "ast1_alfa@test.com", role: "assistant" },
      { name: "Gabriel Santos (Assistente 2)", email: "ast2_alfa@test.com", role: "assistant" },
      { name: "Lucas Pereira (Estagiário)", email: "est_alfa@test.com", role: "estagiario" },
    ],
  },
  {
    name: "Centro de Reabilitação Beta",
    cnpj: "22222222000122",
    owner: { name: "Dra. Beatriz Mendes Beta", email: "owner_beta@test.com" },
    users: [
      { name: "Felipe Rocha (Admin 1)", email: "admin1_beta@test.com", role: "admin" },
      { name: "Patricia Lima (Admin 2)", email: "admin2_beta@test.com", role: "admin" },
      { name: "Dr. Rodrigo Alves (Pro 1)", email: "pro1_beta@test.com", role: "professional" },
      { name: "Dra. Juliana Martins (Pro 2)", email: "pro2_beta@test.com", role: "professional" },
      { name: "Dr. Marcelo Vieira (Pro 3)", email: "pro3_beta@test.com", role: "professional" },
      { name: "Dra. Vanessa Ribeiro (Pro 4)", email: "pro4_beta@test.com", role: "professional" },
      { name: "Camila Barbosa (Assistente 1)", email: "ast1_beta@test.com", role: "assistant" },
      { name: "Thiago Carvalho (Assistente 2)", email: "ast2_beta@test.com", role: "assistant" },
      { name: "Amanda Cardoso (Estagiária)", email: "est_beta@test.com", role: "estagiario" },
    ],
  },
  {
    name: "Instituto de Movimento Gama",
    cnpj: "33333333000133",
    owner: { name: "Dr. Guilherme Arantes Gama", email: "owner_gama@test.com" },
    users: [
      { name: "Sabrina Nogueira (Admin 1)", email: "admin1_gama@test.com", role: "admin" },
      { name: "Eduardo Castro (Admin 2)", email: "admin2_gama@test.com", role: "admin" },
      { name: "Dr. Vinicius Gomes (Pro 1)", email: "pro1_gama@test.com", role: "professional" },
      { name: "Dra. Tatiane Dias (Pro 2)", email: "pro2_gama@test.com", role: "professional" },
      { name: "Dr. Henrique Faria (Pro 3)", email: "pro3_gama@test.com", role: "professional" },
      { name: "Dra. Leticia Monteiro (Pro 4)", email: "pro4_gama@test.com", role: "professional" },
      { name: "Rafael Araujo (Assistente 1)", email: "ast1_gama@test.com", role: "assistant" },
      { name: "Isabela Moreira (Assistente 2)", email: "ast2_gama@test.com", role: "assistant" },
      { name: "Renato Peixoto (Estagiário)", email: "est_gama@test.com", role: "estagiario" },
    ],
  },
  {
    name: "Clínica Saúde Integrada Delta",
    cnpj: "44444444000144",
    owner: { name: "Dra. Danielle Siqueira Delta", email: "owner_delta@test.com" },
    users: [
      { name: "Andre Luiz (Admin 1)", email: "admin1_delta@test.com", role: "admin" },
      { name: "Clarissa Franco (Admin 2)", email: "admin2_delta@test.com", role: "admin" },
      { name: "Dr. Gustavo Pinheiro (Pro 1)", email: "pro1_delta@test.com", role: "professional" },
      { name: "Dra. Natalia Borges (Pro 2)", email: "pro2_delta@test.com", role: "professional" },
      { name: "Dr. Leandro Xavier (Pro 3)", email: "pro3_delta@test.com", role: "professional" },
      { name: "Dra. Monique Rezende (Pro 4)", email: "pro4_delta@test.com", role: "professional" },
      { name: "Samuel Aguiar (Assistente 1)", email: "ast1_delta@test.com", role: "assistant" },
      { name: "Renata Guimaraes (Assistente 2)", email: "ast2_delta@test.com", role: "assistant" },
      { name: "Igor Fernandes (Estagiário)", email: "est_delta@test.com", role: "estagiario" },
    ],
  },
];

async function seed() {
  console.log("🚀 Iniciando geração de dados de teste (4 Clínicas x 10 Usuários)...");
  const client = await getAdminClient();

  for (const cData of CLINICS_TO_SEED) {
    console.log(`\n🏥 Processando: ${cData.name} (CNPJ: ${cData.cnpj})...`);

    // 1. Criar usuário Owner no Auth
    const { data: ownerAuth, error: ownerAuthErr } = await client.auth.admin.createUser({
      email: cData.owner.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      app_metadata: { admin_status: "active" },
    });

    if (ownerAuthErr) {
      if (ownerAuthErr.message.includes("already registered")) {
        console.log(`  ℹ Owner ${cData.owner.email} já existe. Pulando criação.`);
      } else {
        console.error(`  ❌ Erro ao criar owner ${cData.owner.email}:`, ownerAuthErr.message);
        continue;
      }
    }

    const ownerUserId = ownerAuth?.user?.id;

    if (ownerUserId) {
      // Executa handle_signup para criar a clínica e vincular o owner
      const { error: signupErr } = await client.rpc("handle_signup", {
        _clinic_name: cData.name,
        _cnpj: cData.cnpj,
        _email: cData.owner.email,
        _full_name: cData.owner.name,
        _subscription_plan: "clinic",
        _user_id: ownerUserId,
      });

      if (signupErr) {
        console.error(`  ❌ Erro no handle_signup da clínica ${cData.name}:`, signupErr.message);
      } else {
        console.log(`  ✅ Owner ${cData.owner.name} (${cData.owner.email}) criado e vinculado!`);
      }
    }

    // Busca o ID da clínica recém-criada
    const { data: clinicRes, error: clinicErr } = await client
      .from("clinics")
      .select("id")
      .eq("cnpj", cData.cnpj)
      .single();

    if (clinicErr || !clinicRes) {
      console.error(`  ❌ Clínica ${cData.name} não foi encontrada no banco:`, clinicErr?.message);
      continue;
    }

    const clinicId = clinicRes.id;

    // Atualiza nome da clínica e garante limite de subcontas/acesso concorrente amplo
    await client.from("clinics").update({
      name: cData.name,
      subaccount_limit: 20,
      concurrent_access_limit: 10,
    }).eq("id", clinicId);

    // 2. Criar os 9 colaboradores (subcontas) com papéis variados
    for (const u of cData.users) {
      const { data: userAuth, error: userAuthErr } = await client.auth.admin.createUser({
        email: u.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        app_metadata: { admin_status: "active" },
      });

      if (userAuthErr) {
        if (userAuthErr.message.includes("already registered")) {
          console.log(`  ℹ Colaborador ${u.email} já existe.`);
        } else {
          console.error(`  ❌ Erro ao criar colaborador ${u.email}:`, userAuthErr.message);
        }
        continue;
      }

      const subUserId = userAuth.user.id;

      // Inserir perfil
      await client.from("profiles").upsert({
        id: subUserId,
        email: u.email,
        full_name: u.name,
        clinic_id: clinicId,
      });

      // Inserir user_roles
      await client.from("user_roles").upsert(
        { user_id: subUserId, role: "user" },
        { onConflict: "user_id,role" }
      );

      // Inserir clinic_memberships com papel operacional correto
      const { error: membErr } = await client.from("clinic_memberships").insert({
        clinic_id: clinicId,
        user_id: subUserId,
        operational_role: u.role,
        is_active: true,
        membership_status: "active",
      });

      if (membErr) {
        console.error(`  ❌ Erro membership de ${u.name}:`, membErr.message);
      } else {
        console.log(`  ✨ Colaborador [${u.role.toUpperCase()}] ${u.name} (${u.email}) criado.`);
      }
    }
  }

  console.log("\n🎉 Geração concluída com sucesso! 4 Clínicas e 40 Usuários provisionados.");
  console.log(`🔑 Senha padrão para todos os usuários criados: ${DEFAULT_PASSWORD}`);
}

seed().catch((err) => {
  console.error("Fatal error during seeding:", err);
  process.exit(1);
});
