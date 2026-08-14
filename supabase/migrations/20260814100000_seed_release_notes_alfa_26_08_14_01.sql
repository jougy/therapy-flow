with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'alfa-26.08.14-01'
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
    'alfa-26.08.14-01',
    2026081401,
    'URLs amigáveis para pacientes, atalhos de resumo clínico e navegação otimizada',
    'Lançamento com links e URLs amigáveis para prontuários de pacientes, atalho rápido de resumo clínico no cabeçalho, exibição da data de cadastro e melhorias na gestão de anexos.',
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
  select id from public.platform_releases where version = 'alfa-26.08.14-01'
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
    ('added', 'URLs Amigáveis e Links Diretos para Pacientes', 'Agora a plataforma utiliza códigos e identificadores amigáveis nas URLs dos pacientes, facilitando o compartilhamento e acesso direto aos prontuários na clínica.', 10),
    ('added', 'Atalho para Resumo Clínico no Cabeçalho do Prontuário', 'Novo botão "Resumo clínico" integrado diretamente no cabeçalho da ficha do paciente para acesso imediato ao histórico de evolução e dados clínicos.', 20),

    ('changed', 'Exibição Detalhada da Data de Cadastro', 'Inclusão da data e hora exata em que o paciente foi cadastrado na clínica dentro do painel de informações gerais.', 10),
    ('changed', 'Navegação e Acesso a Anexos por Código de Paciente', 'Atualização no sistema de arquivos e sessões para suporte completo a links amigáveis sem perda de contexto dos documentos anexados.', 20),

    ('fixed', 'Redirecionamento Canônico em Links de Pacientes', 'Redirecionamento automático e transparente para a URL oficial da clínica ao abrir prontuários a partir de atalhos antigos ou notificações.', 10)
) as items(category, title, body, sort_order);
