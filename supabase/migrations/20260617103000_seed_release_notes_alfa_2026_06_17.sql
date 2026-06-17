with previous_release as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version = 'alfa-26.06.15-1'
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
    'alfa-26.06.17-1',
    2026061701,
    'Interfaces oficiais com melhorias do DesignLab',
    'Promocao das melhorias do DesignLab para as rotas oficiais, com navegacao mobile redesenhada, menus neon, ajustes de layout e switch de tema renovado.',
    now(),
    true
  )
  on conflict (version)
  do update set
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
  select id from public.platform_releases where version = 'alfa-26.06.17-1'
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
    ('added', 'Painel de novidades no espaço pessoal', 'O espaço pessoal agora tem uma área dedicada para acompanhar novidades da plataforma por categoria.', 10),
    ('added', 'Navegação do espaço pessoal', 'O espaço pessoal ganhou atalhos para Clínicas, Estatísticas, Novidades e Configurações, com ajuste específico para telas menores.', 20),
    ('added', 'Estatísticas do espaço pessoal', 'Foram incluídos indicadores gerais de pacientes, atendimentos e grupos mais frequentes.', 30),
    ('added', 'Estatísticas completas da clínica', 'A clínica ganhou uma área de estatísticas completas para análises mais detalhadas.', 40),
    ('added', 'Alertas clínicos no paciente', 'A ficha do paciente agora destaca riscos importantes, alergias e risco de queda no cabeçalho.', 50),
    ('added', 'Checklist de riscos no cadastro completo', 'O cadastro completo passou a registrar riscos como queda, alergia, gestação, diabetes, convulsão e outros alertas clínicos.', 60),
    ('added', 'Papéis operacionais personalizáveis', 'Colaboradores e acessos agora permitem organizar permissões por função.', 70),
    ('added', 'Busca mobile expansível na clínica', 'A lista da clínica ganhou busca mobile que se expande ao focar e recolhe os botões de filtro e ordem enquanto o teclado está ativo.', 80),
    ('added', 'Menu inferior mobile da clínica', 'Pacientes, Atendimentos, Novo paciente, Agenda e Estatísticas agora ficam em um rodapé fixo responsivo na página inicial da clínica.', 90),
    ('added', 'Contador de pacientes encontrados', 'A lista de pacientes passou a mostrar a quantidade de pacientes encontrados, assim como já acontecia em atendimentos.', 100),
    ('added', 'Switch visual de tema claro e escuro', 'As configurações ganharam um switch de tema com sol, lua, nuvens e estrelas animadas, mantendo a escolha salva neste dispositivo.', 110),
    ('added', 'Rota de laboratório do espaço pessoal', 'O DesignLab passou a ter uma rota dedicada para o espaço pessoal antes da promoção para as rotas oficiais.', 120),

    ('changed', 'Rota do espaço pessoal', 'A rota principal do espaço pessoal foi ajustada para /espacopessoal.', 10),
    ('changed', 'Fluxo de pré-cadastro de paciente', 'Após o pré-cadastro, o fluxo segue para o cadastro completo do paciente.', 20),
    ('changed', 'Cadastro pendente mais evidente', 'A indicação de cadastro pendente ficou mais chamativa e agora leva diretamente para completar o cadastro.', 30),
    ('changed', 'Texto de ações do paciente', 'Alguns rótulos foram ajustados para deixar mais claro quando a ação mostra todos os dados ou abre o resumo clínico.', 40),
    ('changed', 'Criação de conta principal', 'O cadastro inicial passou a preservar melhor o nome informado para a clínica.', 50),
    ('changed', 'Visual do DesignLab nas rotas oficiais', 'As melhorias testadas no DesignLab foram promovidas para /clinica, /espacopessoal e /configuracoes.', 60),
    ('changed', 'Menus inferiores com neon mais discreto', 'Os menus inferiores mantêm o efeito neon apenas nas bordas e nos ícones, sem preencher o fundo inteiro dos botões.', 70),
    ('changed', 'Toolbar desktop da clínica mais compacta', 'A toolbar da clínica usa botões compactos com rótulos revelados em hover ou foco, preservando mais espaço para a lista.', 80),
    ('changed', 'Alternância entre pacientes e atendimentos', 'O seletor de modo da lista recebeu microinterações e revela o rótulo somente no item sob hover ou foco.', 90),
    ('changed', 'Estrelas do tema noturno reposicionadas', 'No switch de tema, as estrelas do modo noturno foram movidas para a esquerda para não ficarem cobertas pela lua.', 100),
    ('changed', 'Animação das estrelas mais suave', 'O brilho das estrelas do switch de tema ficou mais lento e sutil para reduzir distração visual.', 110),

    ('fixed', 'Permissões do cadastro inicial', 'Foram corrigidas permissões relacionadas à criação da conta principal.', 10),
    ('fixed', 'Nome da clínica no cadastro inicial', 'Foi corrigido o caso em que a clínica podia aparecer com documento no lugar do nome informado.', 20),
    ('fixed', 'Idempotência no cadastro de pacientes', 'O cadastro de pacientes passou a verificar CPF e nome para reduzir duplicidades.', 30),
    ('fixed', 'Campos obrigatórios do pré-cadastro', 'O pré-cadastro de pacientes recebeu validações mais rígidas de preenchimento.', 40),
    ('fixed', 'Link de cadastro completo compartilhável', 'O fluxo de cadastro completo enviado ao paciente recebeu correções de acesso e validação.', 50),
    ('fixed', 'Editor de formulários no mobile', 'Foram corrigidas áreas do editor que apresentavam comportamento inconsistente em telas menores.', 60),
    ('fixed', 'Ícone de ordem no mobile', 'O botão de ordem na lista mobile foi alinhado para manter o ícone centralizado.', 70),
    ('fixed', 'Espaço lateral no desktop da clínica', 'A página oficial da clínica deixou de criar uma área de rolagem interna que podia aparentar um painel lateral vazio.', 80),
    ('fixed', 'Coluna vazia no desktop do espaço pessoal', 'O menu lateral do espaço pessoal deixou de herdar a sombra do rodapé mobile no desktop.', 90),
    ('fixed', 'Largura do menu do espaço pessoal', 'Os itens do menu do espaço pessoal foram ajustados para caberem no mobile sem scroll horizontal e sem cortar rótulos longos.', 100),
    ('fixed', 'Espaçamento do botão de ordem no desktop', 'O botão de ordem da toolbar desktop teve a largura expandida ajustada para remover sobra visual ao revelar o rótulo.', 110)
) as items(category, title, body, sort_order);
