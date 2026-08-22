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

  const version = 'alfa-26.08.22-01';
  const version_order = 2026082201;
  const title = 'Novo Editor de Formulários, Sistema de Tags, Tutoriais Guiados e Redesenho de Configurações';
  const summary = 'Grande atualização com o novo construtor modular de formulários de anamnese, evolução dos grupos de atendimento para Sistema de Tags e Linhas de Cuidado, novo visual da tela de atendimentos, área de configurações e perfil totalmente reestruturadas, sistema interativo de tutoriais em toda a plataforma e Biblioteca Comunitária de modelos.';

  // 1. Desativar releases ativas anteriores em produção
  const { error: deactivateError } = await supabase
    .from('platform_releases')
    .update({ is_active: false })
    .neq('version', version);

  if (deactivateError) {
    console.warn('Aviso ao desativar versões anteriores em produção:', deactivateError.message);
  }

  // 2. Upsert da release alfa-26.08.22-01
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

  console.log('Release alfa-26.08.22-01 gravada com sucesso em produção! ID:', releaseData.id);

  // 3. Limpar itens antigos dessa release se existirem
  await supabase
    .from('platform_release_note_items')
    .delete()
    .eq('release_id', releaseData.id);

  // 4. Inserir todos os 13 tópicos filtrados (sem dados confidenciais de backoffice)
  const items = [
    {
      release_id: releaseData.id,
      category: 'added',
      title: 'Sistema Completo de Tutoriais Guiados',
      body: 'Nova experiência interativa com guias passo a passo ilustrados por toda a plataforma, ajudando profissionais e recepcionistas a aproveitarem todos os recursos de prontuário, agenda e configurações.',
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: 'added',
      title: 'Biblioteca Pública da Comunidade de Formulários',
      body: 'Galeria colaborativa para descobrir, pré-visualizar, curtir, comentar e clonar modelos de anamneses e fichas de avaliação compartilhados por outros profissionais da saúde.',
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: 'added',
      title: 'Compartilhamento e Pré-Cadastro de Pacientes via Link',
      body: 'Envie um link seguro para o próprio paciente preencher seu cadastro antes da consulta, com salvamento automático de rascunhos e validação dinâmica.',
      sort_order: 30,
    },
    {
      release_id: releaseData.id,
      category: 'added',
      title: 'Gestão Completa de Convites Pendentes de Colaboradores',
      body: 'Painel dedicado nas configurações da clínica para visualizar convites pendentes, reenviar links de acesso, editar cargos/permissões ou cancelar convites.',
      sort_order: 40,
    },
    {
      release_id: releaseData.id,
      category: 'added',
      title: 'Impressão de Kits Offline e Fichas em Branco',
      body: 'Exportação e impressão rápida de kits e formulários em branco com termos de responsabilidade para preenchimento físico offline.',
      sort_order: 50,
    },
    {
      release_id: releaseData.id,
      category: 'changed',
      title: 'Novo Construtor e Editor Modular de Formulários',
      body: 'Editor de anamneses totalmente reformulado com paleta lateral inteligente, edição e ações em lote, pré-visualização ao vivo, recuperação de rascunho e paletas de cores personalizadas por seção.',
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: 'changed',
      title: 'Evolução dos Grupos de Atendimento para Sistema de Tags',
      body: 'Substituição dos grupos fixos por um moderno Sistema de Tags e Linhas de Cuidado com cores customizáveis e classificação rápida para filtrar e organizar prontuários.',
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: 'changed',
      title: 'Novo Visual e Experiência na Tela de Atendimentos',
      body: 'Interface do atendimento redesenhada com cabeçalho de navegação ágil entre sessões, resumo clínico integrado, formulários em runtime fluido e registro simplificado de valores.',
      sort_order: 30,
    },
    {
      release_id: releaseData.id,
      category: 'changed',
      title: 'Redesenho das Configurações da Clínica e "Meu Perfil"',
      body: 'Estrutura separada em abas dedicadas para dados pessoais, notificações e segurança individual, além de gestão de equipe, modelos, faturamento e dados da clínica.',
      sort_order: 40,
    },
    {
      release_id: releaseData.id,
      category: 'changed',
      title: 'Dashboard da Clínica com Gráficos e Rótulos Claros',
      body: 'Inclusão de rótulos visuais de valores nas linhas e barras de faturamento e atendimentos, identificação nominal de colaboradores e filtros aprimorados.',
      sort_order: 50,
    },
    {
      release_id: releaseData.id,
      category: 'fixed',
      title: 'Fluxo de Entrada e Aceitação de Convites de Colaboradores',
      body: 'Detecção inteligente de e-mails já cadastrados na plataforma com alternância direta entre criação de conta e login seguro.',
      sort_order: 10,
    },
    {
      release_id: releaseData.id,
      category: 'fixed',
      title: 'Performance e Carregamento Client-First',
      body: 'Otimização com persistência em IndexedDB, redução de chamadas repetidas ao carregar dados do paciente e sincronização estável de arquivos e anexos.',
      sort_order: 20,
    },
    {
      release_id: releaseData.id,
      category: 'fixed',
      title: 'Ajustes de Rolagem e Responsividade Mobile',
      body: 'Correções em contêineres de scroll, modais e seletores touch para garantir navegação fluida em celulares e tablets.',
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

  console.log('✅ 13 tópicos de novidades publicados com sucesso na base de PRODUÇÃO!');
}

deployProdRelease().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
