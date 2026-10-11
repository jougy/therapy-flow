import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { RELEASE_BETA_26_10_10_01 } from './release-beta261010.data.mjs';

const ENV_PATH = process.env.THERAPY_FLOW_ADMIN_PROD_ENV || path.join(process.env.HOME, '.therapy-flow-admin-prod/supabase.env');

if (!fs.existsSync(ENV_PATH)) {
  console.error(`Arquivo de credenciais de produção não encontrado em: ${ENV_PATH}`);
  process.exit(1);
}

const envContent = fs.readFileSync(ENV_PATH, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Credenciais inválidas no arquivo:', ENV_PATH);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function deployRelease() {
  console.log('Conectando ao Supabase de Produção em:', SUPABASE_URL);

  const { version, version_order, title, summary, items } = RELEASE_BETA_26_10_10_01;

  // 1. Desativar releases ativas anteriores em produção
  const { error: deactivateError } = await supabase
    .from('platform_releases')
    .update({ is_active: false })
    .neq('version', version);

  if (deactivateError) {
    console.warn('Aviso ao desativar versões anteriores em produção:', deactivateError.message);
  }

  // 2. Upsert da release beta-26.10.10-01
  const { data: releaseData, error: releaseError } = await supabase
    .from('platform_releases')
    .upsert({
      version,
      version_order,
      title,
      summary,
      is_active: true,
      published_at: new Date().toISOString(),
    }, { onConflict: 'version' })
    .select()
    .single();

  if (releaseError) {
    console.error('Erro ao inserir/atualizar versão em produção:', releaseError);
    process.exit(1);
  }

  console.log(`Versão ${version} salva com sucesso! ID:`, releaseData.id);

  // 3. Remover tópicos anteriores da mesma versão para idempotência
  const { error: deleteError } = await supabase
    .from('platform_release_note_items')
    .delete()
    .eq('release_id', releaseData.id);

  if (deleteError) {
    console.error('Erro ao limpar tópicos anteriores da release:', deleteError);
    process.exit(1);
  }

  // 4. Inserir os novos tópicos associados à release
  const releaseItems = items.map((item) => ({
    ...item,
    release_id: releaseData.id,
  }));

  const { error: itemsError } = await supabase
    .from('platform_release_note_items')
    .insert(releaseItems);

  if (itemsError) {
    console.error('Erro ao inserir tópicos da release em produção:', itemsError);
    process.exit(1);
  }

  console.log(`✅ Release ${version} publicada com sucesso no banco de dados (${releaseItems.length} tópicos)!`);
}

deployRelease().catch(err => {
  console.error('Erro fatal durante a publicação da release:', err);
  process.exit(1);
});
