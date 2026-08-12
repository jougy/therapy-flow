with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'alfa-26.08.12-01'
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
    'alfa-26.08.12-01',
    2026081201,
    'Gestão de assinaturas da clínica, exportação segura de estatísticas e melhorias de navegação',
    'Lançamento com módulo financeiro integrado para gestão de planos e faturas da clínica, proteção anti-print na exportação de relatórios, validação otimizada de subcontas e usabilidade mobile aprimorada.',
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
  select id from public.platform_releases where version = 'alfa-26.08.12-01'
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
    ('added', 'Módulo Integrado de Assinaturas e Faturas da Clínica', 'Gestão completa de planos de assinatura, histórico de faturas, comprovantes e opções de pagamento via Pix, Cartão de Crédito e Boleto diretamente no painel de configurações.', 10),
    ('added', 'Proteção Anti-Print e Confirmação de Responsabilidade', 'Ao exportar ou imprimir relatórios e estatísticas da clínica, o sistema solicita confirmação de responsabilidade sobre dados sensíveis e insere proteção com marca d''água.', 20),

    ('changed', 'Controle e Alertas de Limites de Subcontas', 'Validação aprimorada da quantidade de profissionais e colaboradores com alertas de capacidade do plano contratado durante os convites e onboarding.', 10),
    ('changed', 'Menu Mobile e Transição Contínua Entre Clínicas', 'Barra de navegação inferior mobile ajustada para telas touch e manutenção do estado da clínica ativa durante a alternância de navegação.', 20),

    ('fixed', 'Filtro de Sessões Ativas e Permissões de Acesso', 'Correção no carregamento e filtragem de sessões compartilhadas do usuário ao alternar entre múltiplos espaços e clínicas.', 10)
) as items(category, title, body, sort_order);
