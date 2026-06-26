with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'alfa-26.06.26-1'
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
    'alfa-26.06.26-1',
    2026062601,
    'Colaboracao, notificacoes e mobile refinados',
    'Melhorias no fluxo de convites e acessos da clinica, central de notificacoes, papeis operacionais, docks mobile e paineis responsivos.',
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
  select id from public.platform_releases where version = 'alfa-26.06.26-1'
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
    ('added', 'Convites de colaboradores por e-mail', 'A clínica agora convida colaboradores informando e-mail, papel, cargo e especialidade. Contas existentes recebem convite no espaço pessoal; contas novas recebem link para completar cadastro.', 10),
    ('added', 'Aceite de convites no espaço pessoal', 'Convites pendentes aparecem no espaço pessoal com ações para confirmar entrada na clínica ou recusar o convite.', 20),
    ('added', 'Remoção voluntária de acesso', 'O usuário pode sair de uma clínica pelo espaço pessoal com confirmação explícita, preservando seus dados pessoais.', 30),
    ('added', 'Remoção administrativa de acesso', 'Administradores podem remover o acesso de colaboradores da clínica com alertas de consentimento e registro do evento.', 40),
    ('added', 'Central de notificações', 'A barra superior ganhou uma área de notificações com histórico, contagem real de não lidas, exclusão por item e limpeza do histórico.', 50),
    ('added', 'Configurações de notificações', 'O usuário pode escolher som, toque e quais categorias de avisos deseja receber.', 60),
    ('added', 'Segurança pessoal e segurança da clínica', 'As configurações foram separadas entre proteção da conta pessoal e visão administrativa de segurança da clínica.', 70),
    ('added', 'Recuperação de senha personalizada', 'A tela de login ganhou recuperação de senha com validação de e-mail e CPF, e-mails personalizados e página para definir nova senha.', 80),
    ('added', 'Página de conta confirmada', 'O fluxo de confirmação de cadastro agora direciona para uma página própria da Pluri-Health.', 90),
    ('added', 'E-mails da Pluri-Health', 'Os modelos de confirmação, convite e recuperação passaram a usar linguagem e visual alinhados à plataforma.', 100),

    ('changed', 'Cadastro de colaboradores mais leve', 'A criação de subcontas foi substituída por convite de colaborador, evitando senha provisória e separando melhor dados pessoais de dados da clínica.', 10),
    ('changed', 'Edição de colaboradores limitada à clínica', 'A clínica edita apenas cargo, especialidade, papel operacional, horário de trabalho e status de atividade. Nome, e-mail e dados pessoais ficam no espaço pessoal.', 20),
    ('changed', 'Papéis operacionais reorganizados', 'Permissões parecidas foram agrupadas por categoria e cada função passou a ter controles separados para ver e editar.', 30),
    ('changed', 'Switches de permissão mais claros', 'As permissões ganharam switches customizados para visualização e edição, com ícones e estados mais fáceis de interpretar.', 40),
    ('changed', 'Modal de papéis mais fluido', 'Alterações de permissões foram otimizadas para não causar fechamento e reabertura visual do gerenciador.', 50),
    ('changed', 'Docks mobile estilo compacto', 'As páginas mobile passaram a usar docks compactas que expandem na interação, exibem balões acima do item pressionado e recolhem ao rolar a página.', 60),
    ('changed', 'Espaço pessoal no mobile', 'A navegação inferior do espaço pessoal foi atualizada para o novo modelo de dock com ícones compactos e rótulos contextuais.', 70),
    ('changed', 'Estatísticas da clínica no mobile', 'A página de estatísticas completas foi reorganizada em categorias para reduzir rolagem horizontal e melhorar leitura em telas pequenas.', 80),
    ('changed', 'Resumo financeiro do paciente', 'O gráfico financeiro agora diferencia valores acertados, crédito e valores em aberto, evitando tratar em aberto como dívida.', 90),
    ('changed', 'Mensagens de segurança mais específicas', 'Notificações de segurança passaram a descrever melhor o evento registrado, como login, alteração de alerta ou encerramento de sessões.', 100),

    ('fixed', 'Duplicidade de ID em colaboradores', 'A numeração interna de colaboradores na clínica foi ajustada para manter o dono como 001 e seguir sequência única para os demais acessos.', 10),
    ('fixed', 'Erro operational_role_type em formulários', 'Consultas que comparavam papel operacional com texto foram corrigidas para evitar erro ao carregar formulários.', 20),
    ('fixed', 'Permissões aplicadas ao subusuário', 'O fluxo de papéis operacionais foi revisado para refletir alterações de acesso no usuário colaborador.', 30),
    ('fixed', 'Botão de notificações em todas as páginas', 'O atalho de notificações foi incluído na barra superior das telas principais da plataforma.', 40),
    ('fixed', 'Contagem de notificações não lidas', 'O badge agora mostra a quantidade real antes da abertura e zera quando as notificações são visualizadas.', 50),
    ('fixed', 'Scroll das configurações de notificação', 'O painel de configurações de notificações passou a rolar corretamente em telas menores.', 60),
    ('fixed', 'Menu lateral do espaço pessoal no desktop', 'A navegação lateral do espaço pessoal deixou de herdar dimensões da dock mobile e voltou a ocupar a largura correta no PC.', 70),
    ('fixed', 'Scroll horizontal indevido no mobile', 'Páginas com docks e dashboards receberam ajustes para evitar largura excedente em telas mobile.', 80),
    ('fixed', 'Espaço lateral no desktop', 'Foram corrigidos casos em que simulações e layouts responsivos deixavam uma área vazia lateral no desktop.', 90),
    ('fixed', 'Layout do painel de estatísticas', 'Cards e gráficos do dashboard da clínica foram ajustados para respeitar a largura disponível em mobile.', 100)
) as items(category, title, body, sort_order);
