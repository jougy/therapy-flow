with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'alfa-26.08.03-02'
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
    'alfa-26.08.03-02',
    2026080302,
    'Importação/exportação de formulários e melhorias na impressão de fichas em branco',
    'Atualização com recursos de importação e exportação de formulários, correção do nome do PDF e layout A4 hierárquico com subseções em colunas para impressão de fichas em branco.',
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
  select id from public.platform_releases where version = 'alfa-26.08.03-02'
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
    ('added', 'Importação e Exportação de Formulários', 'Possibilidade de importar e exportar modelos de formulários da clínica no painel de gerenciamento de formulários.', 10),

    ('changed', 'Impressão de Fichas em Branco em Layout A4 Hierárquico', 'Subseções agrupadas em blocos de colunas proporcionais, opções de seleção organizadas em lista vertical e remoção de textos de instrução.', 10),

    ('fixed', 'Nomeação do Arquivo PDF na Impressão', 'O arquivo impresso/salvo em PDF passa a ser nomeado automaticamente com o título da ficha e o nome da clínica.', 10),
    ('fixed', 'Isolamento do Layout na Impressão', 'Ocultação da interface do sistema durante a geração da ficha em branco, eliminando sobreposições e páginas duplicadas.', 20)
) as items(category, title, body, sort_order);
