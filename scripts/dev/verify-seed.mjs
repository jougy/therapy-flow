import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createPrivateKey, sign } from "node:crypto";

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

async function verify() {
  const token = await generateEs256TokenFromDocker();
  const supabase = createClient("http://127.0.0.1:54321", token);
  const clinicId = "f4318cd7-9089-453b-a793-f9bbca8550fd";

  const { data: patients } = await supabase.from("patients").select("id, name, patient_code, status").eq("clinic_id", clinicId).order("patient_code");
  console.log("Total patients in clinic:", patients.length);
  for (const p of patients) {
    const { data: pSessions } = await supabase.from("sessions").select("id, session_date, payment_method, payment_status, amount_paid_cents, status").eq("patient_id", p.id).order("session_date");
    console.log(`- ${p.patient_code}: ${p.name} | Atendimentos: ${pSessions?.length}`);
    for (const s of pSessions || []) {
      console.log(`    [${s.session_date.slice(0, 10)}] ${s.payment_method} - R$ ${(s.amount_paid_cents / 100).toFixed(2)} - Status: ${s.payment_status} (${s.status})`);
    }
  }
}
verify();
