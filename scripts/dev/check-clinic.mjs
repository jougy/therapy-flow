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

async function run() {
  const token = await generateEs256TokenFromDocker();
  const supabase = createClient("http://127.0.0.1:54321", token);
  
  const clinicId = "f4318cd7-9089-453b-a793-f9bbca8550fd";
  
  const { data: groups } = await supabase.from("patient_groups").select("*").eq("clinic_id", clinicId);
  console.log("Groups:", groups);

  const { data: sessions } = await supabase.from("sessions").select("*").eq("clinic_id", clinicId);
  console.log("Sessions count:", sessions?.length);
  if (sessions && sessions.length > 0) {
    console.log("Sample session:", JSON.stringify(sessions[0], null, 2));
  }
}
run();
