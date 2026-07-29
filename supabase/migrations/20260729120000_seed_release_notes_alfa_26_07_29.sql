with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'alfa-26.07.29-01'
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
    'alfa-26.07.29-01',
    2026072901,
    'Bloco de endereço inteligente, kit impresso de anamnese e gestão de termos',
    'Novo bloco de endereço nos formulários com consulta CEP/geolocalização, geração de kits impressos offline, fluxo de aceite de termos e tags para feature flags.',
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
  select id from public.platform_releases where version = 'alfa-26.07.29-01'
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
    ('added', 'Bloco de endereço com CEP e geolocalização', 'Adicionada a estrutura de endereço completo no criador de anamnese com busca automática por CEP (ViaCEP) e preenchimento inteligente de coordenadas.', 10),
    ('added', 'Impressão de Kit de Anamnese Offline', 'Nova funcionalidade para gerar e imprimir fichas de anamnese em branco formatadas para preenchimento físico em papel.', 20),
    ('added', 'Prompt de aceite de Termos de Uso do Owner', 'Adicionado modal interativo para atualização e aceite dos termos de serviço da plataforma.', 30),

    ('changed', 'Feature Flags com segmentação por Tags de Clínica', 'O painel administrativo agora suporta distribuição de funcionalidades por tags de clínica (beta, parceiros, VIP).', 10),
    ('changed', 'Resiliência e onboarding de clínicas', 'Otimização do fluxo de registro e onboarding com verificação aprimorada de permissões do colaborador.', 20),

    ('fixed', 'Ajustes no painel de notificações de segurança', 'Corrigida a atualização em tempo real de alertas no botão de notificações pessoais.', 10),
    ('fixed', 'Validação de campos obrigatórios de endereço', 'Corrigido comportamento de foco e validação de complemento/número nos formulários públicos.', 20)
) as items(category, title, body, sort_order);
