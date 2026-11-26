-- Migration: Seed Release Notes beta-26.11.26-1
-- Descrição: Registro oficial do lançamento beta-26.11.26-1 no painel de novidades (sem dados internos de backoffice)

with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'beta-26.11.26-1'
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
    'beta-26.11.26-1',
    2026112601,
    'Pluri-Health Beta: Agendamento Atômico, Lembretes WhatsApp, Local-First Offline & Performance Extrema',
    'Atualização focada em velocidade, confiabilidade e experiência clínica: agendamento atômico sem conflitos de horário com lembretes automáticos via WhatsApp; sincronização Local-First com cache inteligente e modo offline resiliente; login social, branding e exportação de termos; apps desktop na página de download; e otimizações de performance (Core Web Vitals) e acessibilidade WCAG AAA.',
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
  select id from public.platform_releases where version = 'beta-26.11.26-1'
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
    ('added', 'Agendamento Atômico & Lembretes Automáticos via WhatsApp', 'Reserva atômica de horários na agenda evitando conflitos simultâneos entre profissionais, integrada ao envio automático de lembretes de consulta via WhatsApp.', 10),
    ('added', 'Sincronização Local-First & Banner Discreto de Progresso', 'Cache inteligente em memória e IndexedDB com sincronização incremental e banner discreto de progresso, garantindo abertura instantânea e salvamento seguro mesmo em conexões instáveis.', 20),
    ('added', 'Login Social, Branding & Exportação Profissional de Termos', 'Suporte a autenticação social, identidade visual refinada da clínica e exportação estruturada de termos de consentimento (TCLE) e documentos clínicos.', 30),
    ('added', 'Builds Desktop Nativos & Refinamentos na Dock Mobile', 'Disponibilização de instaladores desktop na página de download e otimizações ergonômicas na barra de navegação inferior para smartphones.', 40),

    ('changed', 'Performance Extrema (Core Web Vitals) & Acessibilidade WCAG AAA', 'Carregamento sob demanda de layouts, dashboards e analytics, reduzindo o tempo de resposta inicial e elevando o contraste visual para o padrão WCAG AAA.', 10),
    ('changed', 'Contadores Inteligentes e Filtros na Home da Clínica', 'Formatação normalizada de pluralização nos contadores de pacientes e atendimentos, com filtros e ordenação mais ágeis na listagem principal.', 20),

    ('fixed', 'Resiliência no Roteamento de Atendimentos & Prontuário', 'Correções na resolução de atendimentos por código amigável (ATD-*), prevenção de loops de renderização e maior estabilidade em reconexões.', 10),
    ('fixed', 'Blindagem de Segurança, Rate Limiting & Integridade Multi-Clínica', 'Proteção reforçada contra excesso de requisições e ajustes de estabilidade na comunicação com o servidor.', 20)
) as items(category, title, body, sort_order);
