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

  const version = 'alfa-26.08.30-01';
  const version_order = 2026083001;
  const title = 'Métricas de Pacotes no Dashboard, Ciclos de Assinatura e Aplicativo PWA';
  const summary = 'Lançamento com acompanhamento analítico e gestão de pacotes de sessões no dashboard da clínica, novos ciclos de assinatura flexíveis com checkout transparente, período de teste gratuito (Free Trial), central de instalação como aplicativo (PWA) e aprimoramentos nas avaliações clínicas.';

  // 1. Desativar releases ativas anteriores em produção
  const { error: deactivateError } = await supabase
    .from('platform_releases')
    .update({ is_active: false })
    .neq('version', version);

  if (deactivateError) {
    console.warn('Aviso ao desativar versões anteriores em produção:', deactivateError.message);
  }

  // 2. Upsert da release alfa-26.08.30-01
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

  console.log('Release alfa-26.08.30-01 gravada com sucesso em produção! ID:', releaseData.id);

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
      title: 'Gestão e Métricas de Pacotes de Sessões no Dashboard',
      body: 'Acompanhamento analítico completo de pacotes de sessões contratados pelos pacientes diretamente no dashboard da clínica, incluindo visualização de sessões consumidas versus restantes, taxa de utilização e métricas consolidadas.',
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: 'added',
      title: 'Planos de Assinatura com Ciclos Flexíveis e Checkout Transparente',
      body: 'Disponibilização de opções de assinatura com ciclos mensal, semestral e anual com descontos progressivos, além de fluxo de contratação com prévia detalhada de faturas e suporte a cupons promocionais.',
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: 'added',
      title: 'Período de Teste Gratuito (Free Trial) com Indicadores de Quota',
      body: 'Ativação de período de degustação gratuita para novas clínicas explorarem todos os recursos da plataforma, com exibição visual dos dias restantes e do consumo de cotas de profissionais e pacientes em tempo real.',
      sort_order: 30,
    },
    {
      release_id: releaseData.id,
      category: 'added',
      title: 'Suporte a Aplicativo Web Progressivo (PWA) e Central de Instalação',
      body: 'Possibilidade de instalar o Pluri-Health como aplicativo nativo no computador (Chrome, Edge, Brave) e em dispositivos móveis (Android e iOS), com acesso rápido e página dedicada de download.',
      sort_order: 40,
    },
    {
      release_id: releaseData.id,
      category: 'changed',
      title: 'Gráficos de Avaliação Física e Geração de Kits de Impressão em Branco',
      body: 'Aprimoramentos visuais nos gráficos de radar das fichas de avaliação clínica e geração otimizada de folhas de anamnese em branco com identidade visual padronizada da clínica para prontuários físicos.',
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: 'changed',
      title: 'Gerenciamento de Múltiplas Unidades e Filiais por CNPJ',
      body: 'Flexibilização no cadastro de clínicas que permite ao mesmo proprietário criar e administrar múltiplas filiais sob o mesmo CNPJ com total isolamento de dados.',
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: 'changed',
      title: 'Aprimoramento na Navegação de Configurações e Planos',
      body: 'Reorganização intuitiva dos painéis de perfil pessoal e configurações da clínica, facilitando a transição entre planos, dados cadastrais e opções de segurança.',
      sort_order: 30,
    },
    {
      release_id: releaseData.id,
      category: 'fixed',
      title: 'Resiliência no Motor Analítico e Permissões do Dashboard',
      body: 'Correção no cálculo de agregações e permissões para garantir que todos os colaboradores autorizados visualizem métricas de produtividade e faturamento sem inconsistências.',
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: 'fixed',
      title: 'Preservação de Histórico para Planos em Modo Somente Leitura',
      body: 'Tratamento aprimorado para clínicas com planos expirados, assegurando que o histórico de prontuários e atendimentos permaneça consultável com segurança e integridade.',
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: 'fixed',
      title: 'Estabilidade na Sincronização de Indicadores de Uso e Alertas',
      body: 'Ajuste fino na atualização em tempo real de contadores de colaboradores ativos e cotas de uso do plano para evitar atrasos na interface.',
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

  console.log('✅ 10 tópicos de novidades publicados com sucesso na base de PRODUÇÃO!');
}

deployProdRelease().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
