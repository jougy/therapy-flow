with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'alfa-26.08.30-01'
    and is_active = true
  returning id
),
release_upsert as (
  insert into public.platform_releases (
    version,
    version_order,
    title,
    summary,
    published_at,
    is_active
  )
  values (
    'alfa-26.08.30-01',
    2026083001,
    'Métricas de Pacotes no Dashboard, Ciclos de Assinatura e Aplicativo PWA',
    'Lançamento com acompanhamento analítico e gestão de pacotes de sessões no dashboard da clínica, novos ciclos de assinatura flexíveis com checkout transparente, período de teste gratuito (Free Trial), central de instalação como aplicativo (PWA) e aprimoramentos nas avaliações clínicas.',
    now(),
    true
  )
  on conflict (version)
  do update set
    version_order = excluded.version_order,
    title = excluded.title,
    summary = excluded.summary,
    published_at = excluded.published_at,
    is_active = excluded.is_active,
    updated_at = now()
  returning id
),
target_release as (
  select id from release_upsert
  union
  select id from public.platform_releases where version = 'alfa-26.08.30-01'
  limit 1
),
deleted_items as (
  delete from public.platform_release_note_items
  where release_id in (select id from target_release)
)
insert into public.platform_release_note_items (
  release_id,
  category,
  title,
  body,
  sort_order
)
select
  target_release.id,
  items.category::public.platform_release_note_category,
  items.title,
  items.body,
  items.sort_order
from target_release
cross join (
  values
    ('added', 'Gestão e Métricas de Pacotes de Sessões no Dashboard', 'Acompanhamento analítico completo de pacotes de sessões contratados pelos pacientes diretamente no dashboard da clínica, incluindo visualização de sessões consumidas versus restantes, taxa de utilização e métricas consolidadas.', 10),
    ('added', 'Planos de Assinatura com Ciclos Flexíveis e Checkout Transparente', 'Disponibilização de opções de assinatura com ciclos mensal, semestral e anual com descontos progressivos, além de fluxo de contratação com prévia detalhada de faturas e suporte a cupons promocionais.', 20),
    ('added', 'Período de Teste Gratuito (Free Trial) com Indicadores de Quota', 'Ativação de período de degustação gratuita para novas clínicas explorarem todos os recursos da plataforma, com exibição visual dos dias restantes e do consumo de cotas de profissionais e pacientes em tempo real.', 30),
    ('added', 'Suporte a Aplicativo Web Progressivo (PWA) e Central de Instalação', 'Possibilidade de instalar o Pluri-Health como aplicativo nativo no computador (Chrome, Edge, Brave) e em dispositivos móveis (Android e iOS), com acesso rápido e página dedicada de download.', 40),

    ('changed', 'Gráficos de Avaliação Física e Geração de Kits de Impressão em Branco', 'Aprimoramentos visuais nos gráficos de radar das fichas de avaliação clínica e geração otimizada de folhas de anamnese em branco com identidade visual padronizada da clínica para prontuários físicos.', 10),
    ('changed', 'Gerenciamento de Múltiplas Unidades e Filiais por CNPJ', 'Flexibilização no cadastro de clínicas que permite ao mesmo proprietário criar e administrar múltiplas filiais sob o mesmo CNPJ com total isolamento de dados.', 20),
    ('changed', 'Aprimoramento na Navegação de Configurações e Planos', 'Reorganização intuitiva dos painéis de perfil pessoal e configurações da clínica, facilitando a transição entre planos, dados cadastrais e opções de segurança.', 30),

    ('fixed', 'Resiliência no Motor Analítico e Permissões do Dashboard', 'Correção no cálculo de agregações e permissões para garantir que todos os colaboradores autorizados visualizem métricas de produtividade e faturamento sem inconsistências.', 10),
    ('fixed', 'Preservação de Histórico para Planos em Modo Somente Leitura', 'Tratamento aprimorado para clínicas com planos expirados, assegurando que o histórico de prontuários e atendimentos permaneça consultável com segurança e integridade.', 20),
    ('fixed', 'Estabilidade na Sincronização de Indicadores de Uso e Alertas', 'Ajuste fino na atualização em tempo real de contadores de colaboradores ativos e cotas de uso do plano para evitar atrasos na interface.', 30)
) as items(category, title, body, sort_order);
