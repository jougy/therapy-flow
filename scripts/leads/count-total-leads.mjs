import { createClient } from "@supabase/supabase-js";

// Função para buscar leads via RPC ou consulta autenticada
const client = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

// Chama uma RPC que roda com SECURITY DEFINER para checar os leads reais
const testRes = await client.rpc("upsert_platform_auto_leads_batch", {
  p_leads: [],
  p_run_id: null,
  p_routine_id: null
});
console.log("RPC Check:", testRes);

