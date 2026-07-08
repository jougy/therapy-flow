with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'alfa-26.07.08-1'
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
    'alfa-26.07.08-1',
    2026070801,
    'Dashboard de anamnese e cadastro mais inteligente',
    'Nova leitura visual das respostas de anamnese dentro da ficha do paciente, com graficos configuraveis, e pre-cadastro mais flexivel para familias, pediatria e contatos compartilhados.',
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
  select id from public.platform_releases where version = 'alfa-26.07.08-1'
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
    ('added', 'Dashboard de anamnese do paciente', 'A ficha do paciente ganhou um dashboard que transforma respostas das anamneses em indicadores, graficos e ultimas respostas por campo.', 10),
    ('added', 'Alternancia entre atendimentos e dashboard', 'Na pagina do paciente, a area principal agora pode alternar entre Grupos e Atendimentos e Dashboard, mantendo a analise no mesmo contexto clinico.', 20),
    ('added', 'Graficos configuraveis por campo', 'Campos numericos e categoricos podem ser visualizados com opcoes compativeis, incluindo linha, barras, area, pizza e barra proporcional.', 30),
    ('added', 'CPF do responsavel no pre-cadastro', 'O cadastro rapido ganhou uma opcao para pacientes sem CPF proprio, permitindo informar o CPF do responsavel sem confundir esse dado com o CPF do paciente.', 40),

    ('changed', 'Contatos mais flexiveis', 'Telefone e e-mail deixaram de ser obrigatorios no pre-cadastro e podem ser reutilizados entre familiares sem bloquear o cadastro.', 10),
    ('changed', 'Identificacao de pacientes mais precisa', 'A checagem de duplicidade passou a considerar CPF proprio quando houver e nome com data de nascimento como fallback, reduzindo falsos bloqueios por contato compartilhado.', 20),
    ('changed', 'Dashboard de anamnese responsivo', 'Os cards, filtros, seletores de grafico e visualizacoes do dashboard foram ajustados para funcionar melhor em desktop e mobile.', 30),
    ('changed', 'Preferencias visuais salvas no navegador', 'As escolhas de grafico do dashboard de anamnese ficam salvas por clinica, paciente e campo, sem alterar os dados clinicos.', 40),

    ('fixed', 'Bloqueio claro de paciente duplicado', 'Ao preencher dados de um paciente ja cadastrado, a tela mostra um aviso no topo com botao para abrir o cadastro existente e impede novo cadastro duplicado.', 10),
    ('fixed', 'Mensagens de cadastro mais humanas', 'Erros tecnicos do pre-cadastro foram traduzidos para orientacoes legiveis, evitando mensagens internas de banco de dados para o usuario.', 20),
    ('fixed', 'Atualizacao de cache da RPC de pacientes', 'A migration do cadastro passou a solicitar recarregamento do schema para reduzir falhas apos mudancas na funcao de criacao idempotente.', 30)
) as items(category, title, body, sort_order);
