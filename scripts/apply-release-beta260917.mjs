import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { RELEASE_BETA_26_09_17_01 } from './release-beta260917.data.mjs';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("Conectando ao Supabase em:", SUPABASE_URL);
  console.log("Autenticando como Administrador Mestre...");
  
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL || "jougy@gmx.com";
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || "Senha123456!";

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (authError) {
    console.error("Erro na autenticação:", authError);
    process.exit(1);
  }

  console.log("Autenticado como:", authData.user.email);

  const { version, version_order, title, summary, items } = RELEASE_BETA_26_09_17_01;

  // 1. Desativar versão ativa atual
  const { error: deactivateError } = await supabase
    .from("platform_releases")
    .update({ is_active: false })
    .neq("version", version);

  if (deactivateError) {
    console.warn("Aviso ao desativar versões anteriores:", deactivateError.message);
  }

  // 2. Salvar/Upsert nova versão
  const { data: releaseData, error: releaseError } = await supabase
    .from("platform_releases")
    .upsert({
      version,
      version_order,
      title,
      summary,
      is_active: true,
      published_at: new Date().toISOString(),
    }, { onConflict: "version" })
    .select()
    .single();

  if (releaseError) {
    console.error("Erro ao inserir/atualizar versão:", releaseError);
    process.exit(1);
  }

  console.log("Versão salva com sucesso! ID:", releaseData.id);

  // 3. Remover tópicos anteriores da mesma versão
  const { error: deleteError } = await supabase
    .from("platform_release_note_items")
    .delete()
    .eq("release_id", releaseData.id);

  if (deleteError) {
    console.error("Erro ao limpar tópicos anteriores da release:", deleteError);
    process.exit(1);
  }

  // 4. Inserir tópicos mapeados com o ID da release
  const releaseItems = items.map((item) => ({
    ...item,
    release_id: releaseData.id,
  }));

  const { error: itemsError } = await supabase
    .from("platform_release_note_items")
    .insert(releaseItems);

  if (itemsError) {
    console.error("Erro ao inserir tópicos da release:", itemsError);
    process.exit(1);
  }

  console.log(`✅ Novidades da versão ${version} publicadas com sucesso no banco de dados (${releaseItems.length} itens)!`);
}

main().catch(err => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
