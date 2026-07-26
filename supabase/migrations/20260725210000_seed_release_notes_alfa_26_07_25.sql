with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'alfa-26.07.25-01'
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
    'alfa-26.07.25-01',
    2026072501,
    'Seleção touch mobile, controle inteligente de notificações e ajustes visuais',
    'Melhorias na experiência mobile com seleção de atendimentos por toque longo, otimização de alertas de login de segurança por dispositivo e ajustes de precisão no switch de alternância.',
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
  select id from public.platform_releases where version = 'alfa-26.07.25-01'
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
    ('added', 'Seleção de atendimentos via toque longo no mobile', 'Segurar um atendimento em telas de toque no smartphone agora ativa o modo de seleção em lote com resposta imediata e intuitiva.', 10),
    ('added', 'Controle inteligente de notificações de login', 'O sistema passou a agrupar alertas de segurança por dispositivo, evitando o envio repetido de notificações de Novo login registrado a cada verificação no mesmo navegador.', 20),
    ('added', 'Registro de aceite dos Termos do Owner', 'Adicionada a gravação de confirmação de termos na conta ao contratar planos de clínica.', 30),

    ('changed', 'Persistência de sessão de segurança', 'A identificação do dispositivo no navegador passou a utilizar armazenamento persistente (localStorage), mantendo o contexto de segurança entre abas e recarregamentos.', 10),
    ('changed', 'Sincronização dinâmica no switch de visualização', 'O indicador visual entre Pacientes e Atendimentos passou a monitorar todos os botões simultaneamente, adaptando o fundo azul em tempo real durante a expansão das abas.', 20),

    ('fixed', 'Ajuste visual no indicador do LiquidTabs', 'Corrigida a proporção do filtro de efeito líquido no PC para evitar encolhimento das bordas e garantir preenchimento completo das abas.', 10),
    ('fixed', 'Prevenção de cancelamento por micro-movimentos', 'Ajustada a tolerância de toque mobile para que pequenas vibrações ou deslocamentos mínimos do dedo não cancelem o temporizador de seleção em lote.', 20),
    ('fixed', 'Deduplicação visual de grupos na seleção em lote', 'Organização da lista de seleção para ocultar grupos com nomes repetidos, mantendo a interface limpa e a integridade dos IDs.', 30)
) as items(category, title, body, sort_order);
