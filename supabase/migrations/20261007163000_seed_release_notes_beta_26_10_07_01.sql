-- Migration: Seed Release Notes beta-26.10.07-01
-- Descrição: Registro oficial do lançamento beta-26.10.07-01 no painel de novidades

with previous_releases as (
  update public.platform_releases
  set
    is_active = false,
    updated_at = now()
  where version <> 'beta-26.10.07-01'
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
    'beta-26.10.07-01',
    2026100701,
    'Therapy-Flow Beta: URLs Amigáveis de Atendimento, Fórmulas Clínicas, Gestão de Termos/TCLE, Lixeira, Cobrança Customizada e Nova Experiência Mobile',
    'Grande atualização com suporte a URLs elegantes para atendimentos e pacientes (/pacientes/PAC-045/sessao/ATD-1), campos calculados e fórmulas matemáticas no DesignLab (ex: IMC e escalas), módulo completo de termos/TCLE com scanner inteligente, lixeira clínica com contagem regressiva de retenção legal (soft-delete), emissão e configuração de NFS-e com stepper horizontal, fluxo de recuperação e cadastro por CPF, reformulação master de onboarding com identidade profissional (CREFITO) e clínica solo automática com trial de 7 dias, janela mensal customizável de débito de assinaturas, notificações instantâneas no Telegram com deep link WhatsApp, confirmação transacional de e-mail via Resend, dock dupla de configurações e refinamento de layout mobile-first.',
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
  select id from public.platform_releases where version = 'beta-26.10.07-01'
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
    ('added', 'URLs Elegantes e Amigáveis para Pacientes e Atendimentos', 'Navegação limpa com links curtos (/pacientes/PAC-045/sessao/ATD-1), resolução flexível de prefixos (ATD-1, ATD-001, 1), canonicidade e proteção multi-tenant.', 10),
    ('added', 'Campos Calculados e Fórmulas em Fichas Clínicas (DesignLab)', 'Suporte completo a variáveis, operações matemáticas seguras (safe-math-evaluator), faixas interpretativas e cálculo em tempo real durante avaliações e sessões (ex: IMC, EVA, índices funcionais).', 20),
    ('added', 'Gestão de Termos da Clínica e Impressão de TCLE', 'Seção dedicada em configurações com scanner inteligente de termos (termDocumentScanner), suporte a Markdown, upload customizado e modais de impressão de Termos de Consentimento (TCLE) para adultos e responsáveis por menores.', 30),
    ('added', 'Lixeira da Clínica com Ciclo de Vida e Restauração Segura (Soft-Delete)', 'Módulo de lixeira com contagem regressiva de retenção legal, restauração de cadastros em 1 clique e expurgo permanente seguro com RPCs e RLS.', 40),
    ('added', 'Janela Mensal de Débito e Vencimento de Assinaturas', 'Possibilidade de escolher a melhor janela de cobrança mensal da clínica (dias 01–05, 10–15 ou 25–30), sincronizado com o gateway Asaas e protegido com regra de ciclo subsequente.', 50),
    ('added', 'Notificações Instantâneas no Telegram com Link WhatsApp', 'Alertas em tempo real enviados ao administrador a cada novo cadastro orgânico e venda de plano, com botão de contato direto no WhatsApp (wa.me) e simulador de testes no Backoffice.', 60),
    ('added', 'Dock Dupla de Configurações e Top Dock de Simulação no Mobile', 'Acesso rápido por toque/long-press às configurações da clínica e conta pessoal na barra inferior, além de barra flutuante no topo para simulação ágil de papéis e suporte.', 70),
    ('added', 'Módulo de Emissão e Parametrização Fiscal de NFS-e', 'Suporte à configuração de notas fiscais de serviço (NFS-e) com fluxo visual em stepper horizontal na tesouraria e configurações.', 80),
    ('added', 'Identidade Profissional no Cadastro e Perfil (CREFITO)', 'Seleção de profissão (Fisioterapia / Terapia Ocupacional), campo dinâmico de conselho regional e auto-criação instantânea de clínica solo com 7 dias de trial.', 90),

    ('changed', 'Redesign do Header e Ergonomia de Navegação Mobile', 'Header minimalista focado na identidade da clínica e notificações no smartphone, reduzindo o ruído visual e melhorando a usabilidade.', 10),
    ('changed', 'Bifurcação de Planos e Onboarding Transparente sem Cartão Obrigatório', 'Seleção clara entre Solo vs Equipe vs Enterprise, upgrade contínuo de consultório individual para clínica com equipe e onboarding sem trava obrigatória de cartão de crédito em conformidade com PCI-DSS.', 20),
    ('changed', 'Confirmação Transacional de E-mail via Resend', 'Disparo ágil de links de ativação com layout institucional HTML, proteção anti-reload e bloqueio de adulteração na tela de espera.', 30),
    ('changed', 'Atualização Canônica da Tabela de Preços SaaS', 'Sincronização integral dos pacotes de assinatura e precificação no SaaS, modais comparativos e integração do checkout Asaas.', 40),
    ('changed', 'Isolamento LGPD no Portfólio de Profissionais Desligados', 'Adequação da privacidade clínica limitando a visualização detalhada de prontuários apenas a vínculos ativos, preservando as métricas históricas agregadas de acervo técnico.', 50),

    ('fixed', 'Responsividade Mobile e Eliminação de Overflow no Resumo de Atendimento', 'Ajuste de largura e grids responsivos nos blocos de presença e cobrança financeira da sessão clínica em telas de smartphones (375px–390px).', 10),
    ('fixed', 'Compartilhamento de Fichas de Atendimento e Resiliência de Realtime', 'Correção na visibilidade de atendimentos compartilhados entre profissionais da equipe no prontuário e nas listagens gerais, eliminando inconsistências no canal Realtime.', 20),
    ('fixed', 'Blindagem do Carregamento de Clínicas no Espaço Pessoal', 'Eliminação do estado vazio prematuro e prevenção contra criação redundante de consultórios durante o login.', 30),
    ('fixed', 'Recuperação de Senha por CPF e Regularização de Cadastros', 'Fluxo aprimorado de redefinição de credenciais via CPF, identificação visual de membros sem CPF na equipe e envio facilitado de links de regularização.', 40),
    ('fixed', 'Otimização de Banco de Dados e Hibernação Automática de Clínicas Inativas', 'Compressão e rotina de hibernação segura para clínicas sem acesso por mais de 30 dias, reduzindo a carga do banco e aumentando a eficiência global.', 50)
) as items(category, title, body, sort_order);
