-- RLS policies allowing Master / Platform Owners to manage platform releases and items
drop policy if exists "Platform owners manage platform releases" on public.platform_releases;
create policy "Platform owners manage platform releases" on public.platform_releases
for all to authenticated
using (public.is_platform_owner(auth.uid()))
with check (public.is_platform_owner(auth.uid()));

drop policy if exists "Authenticated users read active platform releases" on public.platform_releases;
drop policy if exists "Authenticated users read platform releases" on public.platform_releases;
create policy "Authenticated users read platform releases" on public.platform_releases
for select to authenticated
using (is_active = true or public.is_platform_owner(auth.uid()));

drop policy if exists "Platform owners manage platform release note items" on public.platform_release_note_items;
create policy "Platform owners manage platform release note items" on public.platform_release_note_items
for all to authenticated
using (public.is_platform_owner(auth.uid()))
with check (public.is_platform_owner(auth.uid()));

drop policy if exists "Authenticated users read active release note items" on public.platform_release_note_items;
drop policy if exists "Authenticated users read release note items" on public.platform_release_note_items;
create policy "Authenticated users read release note items" on public.platform_release_note_items
for select to authenticated
using (
  exists (
    select 1
    from public.platform_releases
    where platform_releases.id = platform_release_note_items.release_id
      and (platform_releases.is_active = true or public.is_platform_owner(auth.uid()))
  )
);

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
    'Novo bloco de endereço nos formulários com consulta CEP/geolocalização, geração de kits impressos offline e fluxo de aceite dos termos de serviço.',
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
    ('added', 'Bloco de endereço completo no formulário', 'Adicionada a estrutura de endereço com busca automática por CEP (ViaCEP), autopreenchimento de campos e preenchimento de coordenadas de localização.', 10),
    ('added', 'Impressão de Kit de Anamnese Offline', 'Nova funcionalidade para gerar e imprimir fichas de anamnese em branco formatadas para preenchimento físico em papel durante o atendimento.', 20),
    ('added', 'Confirmação e aceite dos Termos de Uso', 'Adicionado modal explicativo para atualização e aceite dos termos de serviço da plataforma para os responsáveis pela conta.', 30),

    ('changed', 'Desempenho e responsividade em dispositivos móveis', 'Melhorias de fluidez no carregamento de tabelas e listas de atendimento em navegadores de smartphones.', 10),
    ('changed', 'Navegação e filtros de busca', 'Ajustes no tempo de resposta ao alternar abas e aplicar ordenações no painel pessoal.', 20),

    ('fixed', 'Validação de campos obrigatórios de endereço', 'Corrigido comportamento de validação e foco visual em complemento e número nos formulários de pacientes.', 10),
    ('fixed', 'Ajuste de alinhamento visual nas abas', 'Corrigida a exibição de bordas e animação ao navegar entre seções no painel principal.', 20)
) as items(category, title, body, sort_order);
