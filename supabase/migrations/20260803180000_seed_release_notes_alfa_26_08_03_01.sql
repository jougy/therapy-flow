with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'alfa-26.08.03-01'
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
    'alfa-26.08.03-01',
    2026080301,
    'Cadastro pessoal sem clínica inicial, melhorias de acessos e menus de configurações',
    'Atualização com cadastro simplificado de conta pessoal, ajuste no onboarding de clínicas com equipe, compartilhamento de evoluções e aprimoramento da navegação nas configurações.',
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
  select id from public.platform_releases where version = 'alfa-26.08.03-01'
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
    ('added', 'Cadastro Pessoal Independente', 'Novo fluxo de registro simplificado para criar conta pessoal antes de contratar planos ou receber convites de clínicas.', 10),
    ('added', 'Validação de Acessos Simultâneos na Clínica', 'Configuração e limite mínimo de 2 acessos simultâneos no onboarding do Plano Clínica com Equipe.', 20),

    ('changed', 'Redirecionamento Pós-Onboarding', 'Após criar ou configurar uma clínica, o sistema salva e redireciona automaticamente para o Espaço Pessoal do usuário.', 10),
    ('changed', 'Centralização e Rolagem do Menu de Configurações', 'Gaveta lateral de configurações perfeitamente centralizada na vertical e menu mobile inferior alinhado no centro sem perder animações.', 20),

    ('fixed', 'Compartilhamento de Evoluções e Permissões Operacionais', 'Corrigida a restrição de papéis operacionais e a liberação para iniciar novos atendimentos compartilhados entre colaboradores.', 10),
    ('fixed', 'Prevenção de Duplo Clique no Onboarding', 'Bloqueio imediato do botão de salvar com indicador de carregamento durante a criação e configuração de espaços.', 20)
) as items(category, title, body, sort_order);
