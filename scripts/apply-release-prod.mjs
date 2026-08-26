import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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

async function deployProdRelease() {
  console.log('Conectando ao Supabase de Produção em:', SUPABASE_URL);

  const version = 'alfa-26.08.26-01';
  const version_order = 2026082601;
  const title = 'Evolução Clínica de Pacientes, Otimização de Performance e Deploy Contínuo';
  const summary = 'Atualização com suporte à estruturação de grupos e linhagem de evolução clínica para pacientes, otimização profunda de performance no seletor de clínicas e no dashboard, arrastar recursivo no editor de formulários e pipeline automatizado de deploy contínuo.';

  // 1. Desativar releases ativas anteriores em produção
  const { error: deactivateError } = await supabase
    .from('platform_releases')
    .update({ is_active: false })
    .neq('version', version);

  if (deactivateError) {
    console.warn('Aviso ao desativar versões anteriores em produção:', deactivateError.message);
  }

  // 2. Upsert da release alfa-26.08.26-01
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
    console.error('Erro ao inserir release em produção:', releaseError);
    process.exit(1);
  }

  console.log('Release alfa-26.08.26-01 gravada com sucesso em produção! ID:', releaseData.id);

  // 3. Limpar itens antigos dessa release se existirem
  await supabase
    .from('platform_release_note_items')
    .delete()
    .eq('release_id', releaseData.id);

  // 4. Inserir todos os tópicos filtrados (sem dados confidenciais de backoffice)
  const items = [
    {
      release_id: releaseData.id,
      category: 'added',
      title: 'Estruturação de Ciclos e Grupos de Evolução Clínica',
      body: 'Nova camada de evolução para vincular e agrupar atendimentos ao longo do tratamento do paciente, permitindo histórico contínuo e linhagem entre sessões.',
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: 'added',
      title: 'Pipeline Automatizado de Deploy Contínuo (CI/CD)',
      body: 'Automação de compilação, testes e publicação no Cloudflare Workers para garantir entregas ágeis e alta disponibilidade do sistema.',
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: 'changed',
      title: 'Otimização de Performance no Seletor de Clínicas e Sessões',
      body: 'Implementação de novos índices compostos e parciais no banco de dados, reduzindo o tempo de resposta e acelerando a alternância entre clínicas.',
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: 'changed',
      title: 'Agilização de Métricas do Dashboard da Clínica',
      body: 'Aprimoramento do motor analítico de consultas para cálculo instantâneo de produtividade, faturamento e fluxo de atendimentos sem lentidão.',
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: 'changed',
      title: 'Arrastar e Reordenar Recursivo no Editor de Formulários',
      body: 'Melhoria no construtor de anamneses para mover blocos de campos filhos e contêineres de maneira íntegra e fluida na árvore do formulário.',
      sort_order: 30,
    },
    {
      release_id: releaseData.id,
      category: 'fixed',
      title: 'Exibição e Contagem de Campos na Biblioteca Comunitária',
      body: 'Ajuste na contagem de campos exibida nos cards e modal de pré-visualização de modelos da comunidade, evitando inconsistências visuais.',
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: 'fixed',
      title: 'Otimização nas Políticas de Leitura de Perfis',
      body: 'Refinamento das consultas de segurança com subqueries escalares para acelerar o carregamento de membros e colaboradores.',
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: 'fixed',
      title: 'Estabilidade na Suíte de Testes e Simulações',
      body: 'Ajustes em mocks de tela, fallbacks do cliente de dados e isolamento de ambiente para testes automatizados mais rápidos e consistentes.',
      sort_order: 30,
    },
  ];

  const { error: itemsError } = await supabase
    .from('platform_release_note_items')
    .insert(items);

  if (itemsError) {
    console.error('Erro ao inserir itens da release em produção:', itemsError);
    process.exit(1);
  }

  console.log('✅ 8 tópicos de novidades publicados com sucesso na base de PRODUÇÃO!');
}

deployProdRelease().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
