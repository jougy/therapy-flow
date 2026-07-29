with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'alfa-26.07.29-02'
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
    'alfa-26.07.29-02',
    2026072902,
    'Manutenção de formulários ao alternar abas e rolagem otimizada no mobile',
    'Melhorias na preservação de dados de formulários ao alternar janelas e aprimoramento da rolagem em dispositivos móveis.',
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
  select id from public.platform_releases where version = 'alfa-26.07.29-02'
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
    ('added', 'Bloco de endereço completo no formulário', 'Adicionada a estrutura de endereço com busca automática por CEP (ViaCEP), autopreenchimento de campos e preenchimento de coordenadas de localização.', 10),
    ('added', 'Impressão de Kit de Anamnese Offline', 'Nova funcionalidade para gerar e imprimir fichas de anamnese em branco formatadas para preenchimento físico em papel durante o atendimento.', 20),

    ('changed', 'Preservação de formulários ao alternar abas', 'Os campos preenchidos e formulários em andamento agora permanecem intactos se você alternar de aba no navegador ou usar outro aplicativo.', 10),
    ('changed', 'Fluidez e rolagem vertical no mobile', 'Melhorias no scroll e na navegação de modais, gavetas e listas em telas de smartphones.', 20),

    ('fixed', 'Validação e retenção do estado de preenchimento', 'Corrigido comportamento que reiniciava a página ou limpava os campos de formulários ao restaurar o foco do navegador.', 10)
) as items(category, title, body, sort_order);
