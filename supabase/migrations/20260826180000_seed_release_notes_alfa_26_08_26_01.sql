with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'alfa-26.08.26-01'
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
    'alfa-26.08.26-01',
    2026082601,
    'Evolução Clínica de Pacientes, Otimização de Performance e Deploy Contínuo',
    'Atualização com suporte à estruturação de grupos e linhagem de evolução clínica para pacientes, otimização profunda de performance no seletor de clínicas e no dashboard, arrastar recursivo no editor de formulários e pipeline automatizado de deploy contínuo.',
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
  select id from public.platform_releases where version = 'alfa-26.08.26-01'
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
    ('added', 'Estruturação de Ciclos e Grupos de Evolução Clínica', 'Nova camada de evolução para vincular e agrupar atendimentos ao longo do tratamento do paciente, permitindo histórico contínuo e linhagem entre sessões.', 10),
    ('added', 'Pipeline Automatizado de Deploy Contínuo (CI/CD)', 'Automação de compilação, testes e publicação no Cloudflare Workers para garantir entregas ágeis e alta disponibilidade do sistema.', 20),

    ('changed', 'Otimização de Performance no Seletor de Clínicas e Sessões', 'Implementação de novos índices compostos e parciais no banco de dados, reduzindo o tempo de resposta e acelerando a alternância entre clínicas.', 10),
    ('changed', 'Agilização de Métricas do Dashboard da Clínica', 'Aprimoramento do motor analítico de consultas para cálculo instantâneo de produtividade, faturamento e fluxo de atendimentos sem lentidão.', 20),
    ('changed', 'Arrastar e Reordenar Recursivo no Editor de Formulários', 'Melhoria no construtor de anamneses para mover blocos de campos filhos e contêineres de maneira íntegra e fluida na árvore do formulário.', 30),

    ('fixed', 'Exibição e Contagem de Campos na Biblioteca Comunitária', 'Ajuste na contagem de campos exibida nos cards e modal de pré-visualização de modelos da comunidade, evitando inconsistências visuais.', 10),
    ('fixed', 'Otimização nas Políticas de Leitura de Perfis', 'Refinamento das consultas de segurança com subqueries escalares para acelerar o carregamento de membros e colaboradores.', 20),
    ('fixed', 'Estabilidade na Suíte de Testes e Simulações', 'Ajustes em mocks de tela, fallbacks do cliente de dados e isolamento de ambiente para testes automatizados mais rápidos e consistentes.', 30)
) as items(category, title, body, sort_order);
