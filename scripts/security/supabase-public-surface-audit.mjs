import { assertLocalTarget, loadAppEnv, safeJson, summarizeFindings, writeReport } from "./common.mjs";

const env = await loadAppEnv();
const supabaseUrl = process.env.ATTACK_SUPABASE_URL || env.VITE_SUPABASE_URL;
const anonKey = process.env.ATTACK_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error("Defina ATTACK_SUPABASE_URL/ATTACK_SUPABASE_ANON_KEY ou VITE_SUPABASE_* em .env.local.");
}

assertLocalTarget(supabaseUrl, "supabase");

const headers = {
  apikey: anonKey,
  authorization: `Bearer ${anonKey}`,
  accept: "application/json",
  "content-type": "application/json",
};

const tableProbes = [
  "patients",
  "sessions",
  "agenda_events",
  "clinics",
  "clinic_memberships",
  "profiles",
  "user_roles",
  "user_security_sessions",
  "security_events",
  "anamnesis_form_templates",
];

const rpcProbes = [
  { name: "list_current_user_clinics", body: {} },
  { name: "set_current_user_active_clinic", body: { _clinic_id: "00000000-0000-0000-0000-000000000000" } },
  { name: "set_current_user_active_clinic_by_route_key", body: { _route_key: "invalid" } },
  { name: "register_current_security_session", body: {
    _session_key: "attack-probe",
    _device_label: "attack-probe",
    _browser: "node",
    _platform: "local",
    _user_agent: "local-security-audit",
  } },
];

const probeTable = async (table) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, { headers });
  const body = await safeJson(response);
  const rowCount = Array.isArray(body) ? body.length : null;
  const exposed = response.ok && Array.isArray(body) && body.length > 0;

  return {
    type: "supabase-table-anon",
    table,
    status: response.status,
    severity: exposed ? "critical" : "ok",
    notes: exposed ? ["Consulta anonima retornou linhas. Verificar RLS imediatamente."] : [],
    bodyPreview: exposed ? body : Array.isArray(body) ? [] : body,
    rowCount,
  };
};

const probeRpc = async ({ name, body }) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await safeJson(response);
  const returnedUsefulData =
    response.ok &&
    payload !== null &&
    !(Array.isArray(payload) && payload.length === 0) &&
    payload !== false;

  return {
    type: "supabase-rpc-anon",
    rpc: name,
    status: response.status,
    severity: returnedUsefulData ? "high" : "ok",
    notes: returnedUsefulData ? ["RPC respondeu com dados/efeito aparente sem usuario autenticado."] : [],
    bodyPreview: returnedUsefulData ? payload : typeof payload === "string" ? payload.slice(0, 300) : payload,
  };
};

const run = async () => {
  const checks = [];
  for (const table of tableProbes) {
    checks.push(await probeTable(table));
  }
  for (const rpc of rpcProbes) {
    checks.push(await probeRpc(rpc));
  }

  const report = {
    target: supabaseUrl,
    createdAt: new Date().toISOString(),
    summary: summarizeFindings(checks),
    checks,
  };
  const filePath = await writeReport("supabase-public-surface-audit", report);
  console.log(JSON.stringify({ report: filePath, summary: report.summary }, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
