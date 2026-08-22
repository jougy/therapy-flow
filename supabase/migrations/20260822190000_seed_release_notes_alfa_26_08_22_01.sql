with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'alfa-26.08.22-01'
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
    'alfa-26.08.22-01',
    2026082201,
    'Novo Editor de Formulários, Sistema de Tags, Tutoriais Guiados e Redesenho de Configurações',
    'Grande atualização com o novo construtor modular de formulários de anamnese, evolução dos grupos de atendimento para Sistema de Tags e Linhas de Cuidado, novo visual da tela de atendimentos, área de configurações e perfil totalmente reestruturadas, sistema interativo de tutoriais em toda a plataforma e Biblioteca Comunitária de modelos.',
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
  select id from public.platform_releases where version = 'alfa-26.08.22-01'
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
    ('added', 'Sistema Completo de Tutoriais Guiados', 'Nova experiência interativa com guias passo a passo ilustrados por toda a plataforma, ajudando profissionais e recepcionistas a aproveitarem todos os recursos de prontuário, agenda e configurações.', 10),
    ('added', 'Biblioteca Pública da Comunidade de Formulários', 'Galeria colaborativa para descobrir, pré-visualizar, curtir, comentar e clonar modelos de anamneses e fichas de avaliação compartilhados por outros profissionais da saúde.', 20),
    ('added', 'Compartilhamento e Pré-Cadastro de Pacientes via Link', 'Envie um link seguro para o próprio paciente preencher seu cadastro antes da consulta, com salvamento automático de rascunhos e validação dinâmica.', 30),
    ('added', 'Gestão Completa de Convites Pendentes de Colaboradores', 'Painel dedicado nas configurações da clínica para visualizar convites pendentes, reenviar links de acesso, editar cargos/permissões ou cancelar convites.', 40),
    ('added', 'Impressão de Kits Offline e Fichas em Branco', 'Exportação e impressão rápida de kits e formulários em branco com termos de responsabilidade para preenchimento físico offline.', 50),

    ('changed', 'Novo Construtor e Editor Modular de Formulários', 'Editor de anamneses totalmente reformulado com paleta lateral inteligente, edição e ações em lote, pré-visualização ao vivo, recuperação de rascunho e paletas de cores personalizadas por seção.', 10),
    ('changed', 'Evolução dos Grupos de Atendimento para Sistema de Tags', 'Substituição dos grupos fixos por um moderno Sistema de Tags e Linhas de Cuidado com cores customizáveis e classificação rápida para filtrar e organizar prontuários.', 20),
    ('changed', 'Novo Visual e Experiência na Tela de Atendimentos', 'Interface do atendimento redesenhada com cabeçalho de navegação ágil entre sessões, resumo clínico integrado, formulários em runtime fluido e registro simplificado de valores.', 30),
    ('changed', 'Redesenho das Configurações da Clínica e "Meu Perfil"', 'Estrutura separada em abas dedicadas para dados pessoais, notificações e segurança individual, além de gestão de equipe, modelos, faturamento e dados da clínica.', 40),
    ('changed', 'Dashboard da Clínica com Gráficos e Rótulos Claros', 'Inclusão de rótulos visuais de valores nas linhas e barras de faturamento e atendimentos, identificação nominal de colaboradores e filtros aprimorados.', 50),

    ('fixed', 'Fluxo de Entrada e Aceitação de Convites de Colaboradores', 'Detecção inteligente de e-mails já cadastrados na plataforma com alternância direta entre criação de conta e login seguro.', 10),
    ('fixed', 'Performance e Carregamento Client-First', 'Otimização com persistência em IndexedDB, redução de chamadas repetidas ao carregar dados do paciente e sincronização estável de arquivos e anexos.', 20),
    ('fixed', 'Ajustes de Rolagem e Responsividade Mobile', 'Correções em contêineres de scroll, modais e seletores touch para garantir navegação fluida em celulares e tablets.', 30)
) as items(category, title, body, sort_order);
