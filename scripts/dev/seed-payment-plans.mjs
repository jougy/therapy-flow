import { createPrivateKey, sign } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const execFileAsync = promisify(execFile);

const generateEs256TokenFromDocker = async () => {
  const { stdout: psStdout } = await execFileAsync("docker", [
    "ps",
    "--filter",
    "name=supabase_auth_",
    "--format",
    "{{.Names}}",
  ]);
  const containerName = psStdout.trim().split("\n")[0];
  const { stdout: envStdout } = await execFileAsync("docker", [
    "exec",
    containerName,
    "env",
  ]);

  const jwtKeysMatch = envStdout.match(/^GOTRUE_JWT_KEYS=(.*)$/m);
  const jwkList = JSON.parse(jwtKeysMatch[1]);
  const es256Jwk = jwkList.find((key) => key.alg === "ES256" && key.d);
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
};

const CLINIC_ID = "f4318cd7-9089-453b-a793-f9bbca8550fd";
const USER_ID = "fb266abe-87ad-4f19-a60a-07c0ccdc23e5";

async function seedPlans() {
  const token = await generateEs256TokenFromDocker();
  const supabase = createClient("http://127.0.0.1:54321", token);

  const { data: patients } = await supabase
    .from("patients")
    .select("id, name, patient_code")
    .eq("clinic_id", CLINIC_ID);

  const patientMap = Object.fromEntries((patients || []).map(p => [p.patient_code, p]));

  const plansToInsert = [
    {
      patient_code: "PAC-002",
      name: "Pacote Reabilitação Esportiva - 10 Sessões",
      total_sessions: 10,
      used_sessions: 4,
      total_amount_cents: 150000,
      session_unit_amount_cents: 15000,
      payment_method: "cartao_credito",
      payment_installments: 3,
      payment_status: "pago",
      payment_status_date: "2026-08-10",
      start_date: "2026-08-10",
      notes: "Pacote de reabilitação patelar e retorno ao esporte."
    },
    {
      patient_code: "PAC-003",
      name: "Pacote Coluna & Pilates - 10 Sessões",
      total_sessions: 10,
      used_sessions: 4,
      total_amount_cents: 160000,
      session_unit_amount_cents: 16000,
      payment_method: "pix",
      payment_installments: 1,
      payment_status: "pago",
      payment_status_date: "2026-08-08",
      start_date: "2026-08-08",
      notes: "Tratamento de hérnia de disco lombar e transição para pilates."
    },
    {
      patient_code: "PAC-004",
      name: "Pacote Terapia Manual de Ombro - 5 Sessões",
      total_sessions: 5,
      used_sessions: 4,
      total_amount_cents: 75000,
      session_unit_amount_cents: 15000,
      payment_method: "cartao_credito",
      payment_installments: 2,
      payment_status: "parcial",
      payment_status_date: "2026-08-09",
      start_date: "2026-08-09",
      notes: "Ciclo intensivo de liberação articular e capsulite adesiva."
    },
    {
      patient_code: "PAC-005",
      name: "Pacote Recuperação de Tornozelo - 4 Sessões",
      total_sessions: 4,
      used_sessions: 4,
      total_amount_cents: 56000,
      session_unit_amount_cents: 14000,
      payment_method: "pix",
      payment_installments: 1,
      payment_status: "pago",
      payment_status_date: "2026-08-11",
      start_date: "2026-08-11",
      notes: "Recuperação de entorse grau II e treino proprioceptivo (concluído com alta)."
    },
    {
      patient_code: "PAC-006",
      name: "Pacote Cervical & Postura - 8 Sessões",
      total_sessions: 8,
      used_sessions: 4,
      total_amount_cents: 128000,
      session_unit_amount_cents: 16000,
      payment_method: "transferencia",
      payment_installments: 2,
      payment_status: "pendente",
      payment_status_date: "2026-08-07",
      start_date: "2026-08-07",
      notes: "Reeducação postural e liberação miofascial cervical."
    }
  ];

  for (const item of plansToInsert) {
    const p = patientMap[item.patient_code];
    if (!p) continue;

    const { data: plan, error } = await supabase
      .from("patient_payment_plans")
      .insert({
        clinic_id: CLINIC_ID,
        patient_id: p.id,
        name: item.name,
        total_sessions: item.total_sessions,
        used_sessions: item.used_sessions,
        total_amount_cents: item.total_amount_cents,
        session_unit_amount_cents: item.session_unit_amount_cents,
        payment_method: item.payment_method,
        payment_installments: item.payment_installments,
        payment_status: item.payment_status,
        payment_status_date: item.payment_status_date,
        start_date: item.start_date,
        notes: item.notes,
        created_by_user_id: USER_ID
      })
      .select()
      .single();

    if (error) {
      console.error(`Erro ao inserir plano para ${item.patient_code}:`, error);
    } else {
      console.log(`✅ Plano criado para ${p.name} (${item.patient_code}): ID ${plan.id} - ${plan.name} (${plan.used_sessions}/${plan.total_sessions} sessões)`);
      
      // Vincular as sessões do paciente a este plano
      const { data: patientSessions } = await supabase
        .from("sessions")
        .select("id, session_date")
        .eq("patient_id", p.id)
        .order("session_date", { ascending: true })
        .limit(item.used_sessions);

      if (patientSessions) {
        for (let idx = 0; idx < patientSessions.length; idx++) {
          await supabase
            .from("sessions")
            .update({
              payment_plan_id: plan.id,
              payment_plan_session_index: idx + 1
            })
            .eq("id", patientSessions[idx].id);
        }
        console.log(`   -> Vinculadas ${patientSessions.length} sessões ao plano`);
      }
    }
  }

  // Testar chamada à RPC de analytics
  const { data: analyticsRes, error: aErr } = await supabase.rpc("get_clinic_dashboard_analytics", {
    _clinic_id: CLINIC_ID
  });

  console.log("\nResultado RPC Package Analytics:", JSON.stringify(analyticsRes?.packageAnalytics, null, 2));
}

seedPlans();
