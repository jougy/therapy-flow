import type { ComponentHelpEntry } from "./types";
import { TUTORIAL_CHAPTERS } from "./chapters";

/**
 * Universal Registry for Individual Component Help & Composite Block Tours ('?' buttons).
 * Keyed by component/block help ID. Supports single step or multi-step breakdown of composite blocks.
 */
export const COMPONENT_HELP_REGISTRY: Record<string, ComponentHelpEntry> = {
  // ==========================================
  // 1. ESPAÇO PESSOAL (/selecionar-clinica)
  // ==========================================
  "personal-welcome-block": [
    {
      id: "help-personal-welcome-overview",
      targetSelector: "[data-tutorial='personal-welcome']",
      title: "🏠 Espaço Pessoal — Visão Geral",
      description: "Seu espaço individual na plataforma. Aqui você escolhe qual clínica deseja acessar, acompanha seus resumos e acessa seu perfil.",
      tip: "💡 Toque no botão 'Próximo' para conhecer o atalho para seus dados pessoais.",
      placement: "bottom",
      animation: "glow",
    },
    {
      id: "help-personal-account",
      targetSelector: "[data-tutorial='personal-account-btn']",
      title: "Meu Perfil e Dados Pessoais 👤",
      description: "Toque aqui no seu nome para abrir seus dados cadastrais (como e-mail, telefone e conselho profissional), escolher o tema visual e gerenciar sua senha com segurança.",
      placement: "bottom",
      animation: "dance",
    },
  ],

  "personal-clinics-block": [
    {
      id: "help-personal-clinics-overview",
      targetSelector: "[data-tutorial='clinic-card-primary']",
      title: "🏢 Escolha de Clínica — Objetivo & Acesso",
      description: "Lista todas as clínicas às quais você possui acesso, mostrando seu cargo operacional (Dono, Admin, Profissional, Assistente, Estagiário) e o status do vínculo.",
      placement: "top",
      animation: "glow",
    },
    {
      id: "help-personal-clinic-create",
      targetSelector: "[data-tutorial='create-clinic-btn']",
      title: "Botão '+ Comprar Meu Próprio Espaço' ➕",
      description: "Deseja abrir sua própria clínica ou consultório independente? Clique aqui para escolher um plano e criar uma nova unidade em segundos.",
      placement: "bottom",
      animation: "dance",
    },
  ],

  // ==========================================
  // 2. HOME DA CLÍNICA & TRIAGEM (/clinica/:route)
  // ==========================================
  "agenda-widget": [
    {
      id: "help-agenda-overview",
      targetSelector: "[data-tutorial='agenda-widget']",
      title: "📅 Agenda Integrada da Clínica — Objetivo & Visão Geral",
      description: "Centraliza a escala diária de consultas, reuniões de equipe e eventos internos da clínica. Permite acompanhar os compromissos em tempo real, navegar entre datas e iniciar atendimentos sem burocracia.",
      tip: "💡 Acompanhe a seguir a função de cada componente e botão interno deste bloco!",
      placement: "bottom",
      animation: "glow",
    },
    {
      id: "help-agenda-nav-arrows",
      targetSelector: "[data-tutorial='agenda-nav-arrows']",
      title: "Setas de Navegação & Badges Inteligentes ⏩",
      description: "As setas (< e >) avançam ou retrocedem diretamente para os dias que contêm agendamentos, ignorando dias vazios. O badge numérico indica quantos compromissos existem antes ou depois da data exibida.",
      tip: "Pula automaticamente os dias sem atendimentos marcados para economizar seu tempo.",
      placement: "bottom",
      animation: "bounce",
    },
    {
      id: "help-agenda-date-picker",
      targetSelector: "[data-tutorial='agenda-date-picker-btn']",
      title: "Seletor Central de Data & Calendário Flutuante 📆",
      description: "Exibe o dia selecionado por extenso (ex: 21 de agosto). Ao clicar no botão, um calendário flutuante se abre para você saltar diretamente para qualquer dia do mês.",
      tip: "Dias com agendamentos marcados aparecem destacados em negrito no calendário.",
      placement: "bottom",
      animation: "dance",
    },
    {
      id: "help-agenda-events-list",
      targetSelector: "[data-tutorial='agenda-events-list']",
      title: "Lista de Agendamentos & Botão 'Iniciar' 🕒",
      description: "Exibe o horário (ex: 10:00), tipo (Atendimento/Reunião), status (Confirmado/Aguardando) e o nome do paciente. Clicar no item abre detalhes de remarcação e o botão azul 'Iniciar' abre a evolução clínica imediatamente.",
      placement: "bottom",
      animation: "pulse",
    },
    {
      id: "help-agenda-add-btn",
      targetSelector: "[data-tutorial='agenda-add-btn']",
      title: "Botão '+' (Criar Agendamento / Evento) ➕",
      description: "Abre o assistente para marcar consultas de pacientes, reuniões da equipe ou lembretes internos na agenda compartilhada da clínica.",
      placement: "top",
      animation: "bounce",
    },
    {
      id: "help-agenda-quick-start",
      targetSelector: "[data-tutorial='agenda-quick-start']",
      title: "Botão Rápido 'Iniciar Atendimento Agora' ⚡",
      description: "O paciente chegou para a consulta? Clique no botão verde para iniciar o atendimento clínico imediatamente, registrando o horário e a presença em tempo real no prontuário.",
      tip: "Elimina burocracia e economiza tempo precioso na recepção.",
      placement: "top",
      animation: "dance",
    },
  ],

  "patient-search-toolbar": [
    {
      id: "help-search-overview",
      targetSelector: "[data-tutorial='patient-search-input']",
      title: "🔍 Busca Inteligente de Pacientes — Objetivo & Velocidade",
      description: "Localize qualquer paciente em milissegundos por nome, CPF, telefone ou prontuário, sem precisar recarregar a página.",
      visualPreview: {
        type: "keyboard-shortcuts",
        shortcuts: [
          { keys: ["⌘K", "Ctrl+K"], label: "Focar barra de busca de pacientes" },
          { keys: ["/"], label: "Ativar busca de pacientes instantaneamente" },
          { keys: ["N"], label: "Abrir cadastro de novo paciente" },
          { keys: ["Esc"], label: "Limpar busca ou fechar janelas" },
        ],
      },
      placement: "bottom",
      animation: "pulse",
    },
    {
      id: "help-search-filter-tags",
      targetSelector: "[data-tutorial='patient-filter-tags']",
      title: "Filtros Avançados & Linhas de Cuidado 🏷️",
      description: "Refine a lista por status (Ativo/Inativo), situação de pagamento, agendamento, recorrência, grupos e colaboradores.",
      visualPreview: { type: "list-mode" },
      placement: "bottom",
      animation: "bounce",
    },
    {
      id: "help-search-add-patient",
      targetSelector: "[data-tutorial='patient-add-btn']",
      title: "Botão '+ Novo Paciente' 👤",
      description: "Abre o formulário de pré-cadastro ágil para registrar um paciente em menos de 1 minuto ou gerar link de auto-preenchimento para o celular.",
      learnMoreAction: {
        label: "Ver tutorial completo de cadastro de paciente",
        actionType: "navigate_chapter",
        targetId: "novo-paciente",
        targetRoute: "/pacientes/novo",
      },
      placement: "bottom",
      animation: "dance",
    },
    {
      id: "help-card-overview",
      targetSelector: "[data-tutorial='patient-card-first']",
      title: "📋 Anatomia do Card do Paciente — Resumo Tátil",
      description: "Condensa todas as informações clínicas, operacionais e financeiras essenciais do paciente em uma única linha interativa.",
      placement: "top",
      animation: "glow",
    },
    {
      id: "help-card-status",
      targetSelector: "[data-tutorial='patient-card-status-badge']",
      title: "Status de Atividade (Ativo / Inativo) 🏷️",
      description: "Indica se o paciente está atualmente em tratamento ativo na clínica, com alta fisioterapêutica ou em pausa.",
      visualPreview: { type: "status-badge" },
      placement: "bottom",
      animation: "pulse",
    },
    {
      id: "help-card-payment",
      targetSelector: "[data-tutorial='patient-card-payment-icon']",
      title: "Símbolo Financeiro ($) 💳",
      description: "Exibe a situação financeira consolidada: quitado (verde), pendente (amarelo), débito (vermelho) ou crédito disponível. Clicar no '$' abre o extrato financeiro rápido.",
      requiredPermission: "treasury.manage",
      visualPreview: { type: "payment-status" },
      learnMoreAction: {
        label: "Quer saber mais sobre Gestão Financeira?",
        actionType: "navigate_chapter",
        targetId: "dashboard-configuracoes",
      },
      placement: "bottom",
      animation: "bounce",
    },
    {
      id: "help-card-clock",
      targetSelector: "[data-tutorial='patient-card-clock-icon']",
      title: "Relógio do Agendamento & 4 Cores 🕒",
      description: "Muda de cor conforme o momento do agendamento: 🟢 Verde (Hoje), 🔵 Azul (Data futura), 🟡 Laranja (Aguardando na recepção) e 🔴 Vermelho (Horário em atraso).",
      tip: "Clique no relógio para ver o horário exato e atualizar o status de chegada.",
      visualPreview: { type: "clock-colors" },
      placement: "bottom",
      animation: "dance",
    },
    {
      id: "help-card-recurrence",
      targetSelector: "[data-tutorial='patient-card-recurrence-pill']",
      title: "Recorrência Semanal (D, S, T, Q, Q, S, S) 🗓️",
      description: "Destaca os dias fixos da semana em que o paciente frequenta a clínica (ex: Segundas e Quartas), facilitando a gestão da agenda.",
      visualPreview: { type: "recurrence-pill" },
      learnMoreAction: {
        label: "Quer saber como definir a recorrência de um paciente?",
        actionType: "navigate_chapter",
        targetId: "prontuario-paciente",
      },
      placement: "bottom",
      animation: "glow",
    },
    {
      id: "help-card-groups",
      targetSelector: "[data-tutorial='patient-card-groups-tags']",
      title: "Linhas de Cuidado & Queixas Clínicas 🎨",
      description: "Etiquetas coloridas que identificam as especialidades e motivos do tratamento do paciente (ex: Cervicalgia, Pilates, Ortopedia).",
      placement: "bottom",
      animation: "pulse",
    },
  ],

  "patient-card": [
    {
      id: "help-card-overview",
      targetSelector: "[data-tutorial='patient-card-first']",
      title: "📋 Card do Paciente — Objetivo & Resumo Tátil",
      description: "Condensa todas as informações clínicas, operacionais e financeiras essenciais do paciente em uma única linha interativa.",
      tip: "💡 Veja a seguir o significado de cada símbolo e controle no card!",
      placement: "top",
      animation: "glow",
    },
    {
      id: "help-card-status",
      targetSelector: "[data-tutorial='patient-card-status-badge']",
      title: "Status de Atividade (Ativo / Inativo) 🏷️",
      description: "Indica se o paciente está atualmente em tratamento ativo na clínica, com alta fisioterapêutica ou em pausa.",
      visualPreview: { type: "status-badge" },
      placement: "bottom",
      animation: "pulse",
    },
    {
      id: "help-card-payment",
      targetSelector: "[data-tutorial='patient-card-payment-icon']",
      title: "Símbolo Financeiro ($) 💳",
      description: "Exibe a situação financeira consolidada do paciente: quitado, pendente, débito ou crédito disponível. Clicar no '$' abre o extrato financeiro rápido.",
      requiredPermission: "treasury.manage",
      visualPreview: { type: "payment-status" },
      learnMoreAction: {
        label: "Quer saber como gerenciar finanças e pacotes?",
        actionType: "navigate_chapter",
        targetId: "dashboard-configuracoes",
      },
      placement: "bottom",
      animation: "bounce",
    },
    {
      id: "help-card-clock",
      targetSelector: "[data-tutorial='patient-card-clock-icon']",
      title: "Relógio do Agendamento & 4 Cores 🕒",
      description: "Muda de cor conforme o momento do agendamento: 🟢 Verde (Hoje), 🔵 Azul (Data futura), 🟡 Laranja (Aguardando na recepção) e 🔴 Vermelho (Horário em atraso).",
      tip: "Clique no relógio para ver o horário exato e atualizar o status de chegada.",
      visualPreview: { type: "clock-colors" },
      placement: "bottom",
      animation: "dance",
    },
    {
      id: "help-card-recurrence",
      targetSelector: "[data-tutorial='patient-card-recurrence-pill']",
      title: "Recorrência Semanal (D, S, T, Q, Q, S, S) 🗓️",
      description: "Destaca os dias fixos da semana em que o paciente frequenta a clínica (ex: Segundas e Quartas), facilitando a gestão da agenda.",
      visualPreview: { type: "recurrence-pill" },
      learnMoreAction: {
        label: "Quer saber como definir a recorrência de um paciente?",
        actionType: "navigate_chapter",
        targetId: "prontuario-paciente",
      },
      placement: "bottom",
      animation: "glow",
    },
    {
      id: "help-card-groups",
      targetSelector: "[data-tutorial='patient-card-groups-tags']",
      title: "Linhas de Cuidado & Queixas Clínicas 🎨",
      description: "Etiquetas coloridas que identificam as especialidades e motivos do tratamento do paciente (ex: Cervicalgia, Pilates, Ortopedia).",
      placement: "bottom",
      animation: "pulse",
    },
  ],

  // ==========================================
  // 3. CADASTRO DE NOVO PACIENTE (/pacientes/novo)
  // ==========================================
  "new-patient-form-basic": [
    {
      id: "help-new-patient-overview",
      targetSelector: "[data-tutorial='new-patient-form-basic']",
      title: "👤 Pré-Cadastro Rápido — Objetivo & Agilidade",
      description: "Formulário otimizado para cadastrar novos pacientes em menos de 1 minuto na recepção, garantindo segurança cadastral e evitando duplicidades.",
      tip: "💡 Acompanhe a seguir a função de cada campo e o fluxo pós-cadastro!",
      placement: "bottom",
      animation: "glow",
    },
    {
      id: "help-new-patient-name",
      targetSelector: "[data-tutorial='new-patient-name']",
      title: "Nome Completo do Paciente ✍️",
      description: "Identificação principal do paciente. Usado na busca rápida inteligente, nos relatórios clínicos, prontuários e recibos fiscais.",
      placement: "bottom",
      animation: "pulse",
    },
    {
      id: "help-new-patient-birth",
      targetSelector: "[data-tutorial='new-patient-birth']",
      title: "Data de Nascimento & Idade 🎂",
      description: "Permite ao sistema calcular a idade exata automaticamente, auxiliando na triagem e na aplicação de protocolos específicos por faixa etária.",
      placement: "bottom",
      animation: "pulse",
    },
    {
      id: "help-new-patient-document",
      targetSelector: "[data-tutorial='new-patient-document']",
      title: "Documento & Opções de Identificação 🔒",
      description: "Permite selecionar CPF do paciente, CPF do responsável legal (para crianças/dependentes), RG, Passaporte/ID Estrangeiro ou identificação sem documento.",
      placement: "bottom",
      animation: "pulse",
    },
    {
      id: "help-new-patient-gender-pronoun",
      targetSelector: "[data-tutorial='new-patient-gender-pronoun']",
      title: "Gênero & Pronome de Tratamento 👥",
      description: "Campos opcionais para personalizar a abordagem, os termos de tratamento e a comunicação humanizada com o paciente.",
      placement: "bottom",
      animation: "pulse",
    },
    {
      id: "help-new-patient-contacts",
      targetSelector: "[data-tutorial='new-patient-contacts']",
      title: "WhatsApp & E-mail de Contato 💬",
      description: "Habilita o envio de lembretes automáticos de agendamento, recibos fiscais e abertura de mensagens no WhatsApp com 1 clique.",
      placement: "bottom",
      animation: "pulse",
    },
    {
      id: "help-new-patient-submit-btn",
      targetSelector: "[data-tutorial='new-patient-submit-btn']",
      title: "Botão 'Concluir Pré-Cadastro' & Fluxo Inteligente 🚀",
      description: "Salva o paciente e abre o assistente com opções de: (1) Compartilhar link seguro para preenchimento no celular, (2) Abrir cadastro completo com 8 abas, ou (3) Ir direto para o prontuário.",
      tip: "Você escolhe o melhor fluxo para a sua rotina no momento do cadastro!",
      placement: "top",
      animation: "dance",
    },
  ],

  // ==========================================
  // 4. PRONTUÁRIO ELETRÔNICO (/pacientes/:id)
  // ==========================================
  "patient-metrics-panel": [
    {
      id: "help-patient-metrics-overview",
      targetSelector: "[data-tutorial='patient-metrics-panel']",
      title: "📊 Painel de Métricas do Paciente — Objetivo Clínico",
      description: "Consolida a frequência do paciente, o total de atendimentos realizados, a taxa de comparecimento e a situação financeira em aberto ou em crédito.",
      placement: "bottom",
      animation: "glow",
    },
    {
      id: "help-patient-internal-agenda",
      targetSelector: "[data-tutorial='patient-internal-agenda']",
      title: "Agenda Interna & Início Rápido de Sessão ⏱️",
      description: "Permite agendar sessões futuras e iniciar o atendimento imediatamente a partir do compromisso marcado na recepção.",
      placement: "top",
      animation: "bounce",
    },
  ],

  "patient-tab-sessions": [
    {
      id: "help-patient-history-overview",
      targetSelector: "[data-tutorial='patient-tab-sessions']",
      title: "📋 Histórico de Atendimentos — Linha do Tempo",
      description: "Exibe todas as evoluções clínicas em ordem cronológica com data, profissional responsável, procedimentos aplicados e escala de dor.",
      placement: "bottom",
      animation: "glow",
    },
  ],

  // ==========================================
  // 5. SESSÃO CLÍNICA (/pacientes/:id/sessao/:id)
  // ==========================================
  "session-timer": [
    {
      id: "help-session-timer-overview",
      targetSelector: "[data-tutorial='session-timer']",
      title: "⏱️ Controle de Presença & Horários — Objetivo & Pontualidade",
      description: "Registra o horário combinado, a chegada do paciente e o início do atendimento com cálculo automático de pontualidade e duração total da consulta.",
      tip: "Clique nos botões 'Agora' para preencher instantaneamente com 1 toque.",
      placement: "bottom",
      animation: "glow",
    },
  ],

  "session-carelines": [
    {
      id: "help-session-carelines-overview",
      targetSelector: "[data-tutorial='session-anamnesis-form']",
      title: "📋 Avaliação & Anamnese Clínica",
      description: "Acompanhe e registre a evolução personalizada através dos campos modulares da clínica configurados para o atendimento.",
      placement: "bottom",
      animation: "glow",
    },
    {
      id: "help-session-custom-forms",
      targetSelector: "[data-tutorial='session-custom-forms-box']",
      title: "Fichas Complementares Estruturadas ✨",
      description: "Deseja aprofundar a avaliação? Ative formulários clínicos específicos criados pela sua clínica (ex: Avaliação de Ombro, Questionário de Incapacidade).",
      placement: "top",
      animation: "bounce",
    },
  ],

  "session-conduct-notes": [
    {
      id: "help-session-conduct-overview",
      targetSelector: "[data-tutorial='session-conduct-notes']",
      title: "✍️ Conduta & Evolução Clínica — Registro Estruturado",
      description: "Campo para descrever os procedimentos fisioterapêuticos aplicados (terapia manual, cinesioterapia, eletroterapia, orientações) e as respostas funcionais do paciente.",
      tip: "Os registros possuem assinatura e timestamp protegidos por auditoria.",
      placement: "top",
      animation: "bounce",
    },
  ],

  "session-tab-treatment": [
    {
      id: "help-session-treatment-overview",
      targetSelector: "[data-tutorial='session-tab-treatment']",
      title: "📝 Receituário & Exercícios para Casa — Prescrição Clara",
      description: "Monte blocos de orientações com nome do exercício, séries, repetições, frequência e instruções passo a passo para o paciente manter a adesão ao tratamento fora da clínica.",
      placement: "top",
      animation: "pulse",
    },
  ],

  "session-tab-payment": [
    {
      id: "help-session-payment-overview",
      targetSelector: "[data-tutorial='session-tab-payment']",
      title: "💳 Financeiro da Sessão — Objetivo & Baixa",
      description: "Permite registrar o status financeiro da consulta, dar baixa imediata nos valores pagos, calcular troco/débito ou vincular a sessão a um pacote contratado.",
      placement: "top",
      animation: "glow",
    },
  ],

  // ==========================================
  // 6. DASHBOARDS DA CLÍNICA (/dashboard)
  // ==========================================
  "clinic-kpis-block": [
    {
      id: "help-clinic-kpis-overview",
      targetSelector: "[data-tutorial='clinic-kpis-block']",
      title: "📊 Dashboard da Clínica — Visão Geral Executiva",
      description: "Centraliza os indicadores operacionais e financeiros da clínica: receita total, taxa de comparecimento, cancelamentos e pacientes ativos.",
      placement: "bottom",
      animation: "glow",
    },
  ],

  // ==========================================
  // ==========================================
  // 7. CONFIGURAÇÕES & ADMINISTRAÇÃO (/configuracoes)
  // ==========================================
  "settings-team-block": [
    {
      id: "help-settings-team-overview",
      targetSelector: "[data-tutorial='settings-team-card']",
      title: "👥 Gestão da Equipe & Permissões — Visão Geral",
      description: "Gerencie os membros da equipe clínica, envie convites para novos profissionais, acompanhe quem está online e administre os poderes de acesso.",
      visualPreview: {
        type: "custom-badges",
        title: "Papéis Operacionais da Equipe",
        badges: [
          { label: "Dono", variant: "default" },
          { label: "Admin", variant: "secondary" },
          { label: "Profissional", variant: "outline" },
          { label: "Assistente", variant: "secondary" },
          { label: "Estagiário", variant: "outline" },
        ],
      },
      placement: "bottom",
      animation: "glow",
    },
    {
      id: "help-settings-team-roles",
      targetSelector: "[data-tutorial='settings-team-roles-tab']",
      title: "Matriz de Permissões (RBAC) 🛡️",
      description: "Personalize detalhadamente o que cada cargo operacional pode Ver e Editar no sistema (ex: pacientes, agendas, financeiro, exclusões).",
      requiredPermission: "subaccounts_roles.manage",
      learnMoreAction: {
        label: "Quer entender como funciona a Matriz de Permissões?",
        actionType: "navigate_chapter",
        targetId: "dashboard-configuracoes",
      },
      placement: "bottom",
      animation: "bounce",
    },
    {
      id: "help-settings-team-invite",
      targetSelector: "[data-tutorial='settings-team-invite-btn']",
      title: "Convidar Novo Colaborador ✉️",
      description: "Cadastre novos profissionais ou estagiários por e-mail com cargo e especialidade definidos.",
      placement: "top",
      animation: "pulse",
    },
    {
      id: "help-settings-team-concurrent",
      targetSelector: "[data-tutorial='settings-team-concurrent-badge']",
      title: "Lotação Simultânea de Acessos ⏱️",
      description: "Monitore quantos usuários estão logados ao mesmo tempo e os limites de conexões do plano contratado.",
      placement: "top",
      animation: "glow",
    },
  ],

  "settings-team-invite-block": [
    {
      id: "help-settings-invite-overview",
      targetSelector: "[data-tutorial='settings-team-invite-card']",
      title: "✉️ Convidar Colaborador — Objetivo do Bloco",
      description: "Este bloco é o ponto de entrada para adicionar novos membros à equipe da sua clínica. Ele permite enviar convites seguros para profissionais e assistentes, integrando-os aos prontuários e à rotina da clínica enquanto cada usuário mantém sua conta pessoal e dados de segurança independentes.",
      tip: "💡 Novos usuários recebem um link guiado de cadastro; usuários que já usam a plataforma recebem o convite direto no Espaço Pessoal.",
      placement: "top",
      animation: "glow",
    },
    {
      id: "help-settings-invite-email",
      targetSelector: "[data-tutorial='settings-invite-email']",
      title: "📧 E-mail do Colaborador",
      description: "Informe o e-mail que o profissional usará para acessar a plataforma.\n• Se a conta já existir no sistema: ela recebe um convite instantâneo para ingressar na equipe da clínica;\n• Se a conta ainda não existir: o sistema gera um link de convite exclusivo com cadastro guiado.",
      tip: "💡 Dica: Certifique-se de digitar o e-mail correto para que o colaborador receba a notificação e consiga ativar o acesso.",
      placement: "top",
      animation: "bounce",
    },
    {
      id: "help-settings-invite-role",
      targetSelector: "[data-tutorial='settings-invite-role']",
      title: "🛡️ Papel Operacional (Hierarquia & Permissões)",
      description: "Define os poderes de acesso e o que o usuário pode ver ou editar no software:\n• Administrador(a): Gestão geral da clínica, configurações e equipe;\n• Profissional: Atendimento clínico, prontuários, avaliações e evoluções;\n• Assistente: Recepção, marcação de consultas, cadastro de pacientes e triagem;\n• Estagiário(a): Atendimentos com visualização supervisionada.",
      visualPreview: {
        type: "custom-badges",
        title: "Níveis de Acesso na Plataforma",
        badges: [
          { label: "Admin: Gestão Ampla & Configurações", variant: "default" },
          { label: "Profissional: Prontuários & Consultas", variant: "secondary" },
          { label: "Assistente: Recepção & Agenda", variant: "outline" },
          { label: "Estagiário: Supervisionado", variant: "secondary" },
        ],
      },
      tip: "💡 O papel operacional pode ser personalizado com controle fino Ver/Editar na matriz RBAC.",
      placement: "top",
      animation: "pulse",
    },
    {
      id: "help-settings-invite-job",
      targetSelector: "[data-tutorial='settings-invite-job']",
      title: "👔 Cargo Pré-definido (Função na Clínica)",
      description: "Representa a ocupação, profissão ou função real exercida pelo colaborador no dia a dia da clínica.\n• Exemplos: Fisioterapeuta, Psicólogo(a), Fonoaudiólogo(a), Recepcionista, Secretária, Serviços Gerais / Faxineiro(a).",
      tip: "💡 O cargo é o título profissional exibido no cabeçalho de laudos, documentos e no diretório da clínica.",
      placement: "top",
      animation: "bounce",
    },
    {
      id: "help-settings-invite-specialty",
      targetSelector: "[data-tutorial='settings-invite-specialty']",
      title: "🏷️ Especialidades & Tags com Ponto e Vírgula (;)",
      description: "As áreas de especialização e linhas de cuidado do profissional. Você pode cadastrar várias especialidades separando-as por ponto e vírgula (;). A plataforma gera tags visuais automáticas em tempo real!",
      visualPreview: {
        type: "custom-badges",
        title: "Exemplos de Tags de Especialidade",
        badges: [
          { label: "Fisio: Saúde da Mulher; Pélvica; Pilates", variant: "secondary" },
          { label: "Psico: TCC; Terapia de Casal; Infantil", variant: "secondary" },
          { label: "Geral: Traumato-Ortopedia; Respiratória", variant: "secondary" },
        ],
      },
      tip: "💡 Exemplo de preenchimento: 'Saúde da Mulher; Pediatria; TCC'. Tags aparecem nos prontuários e buscas.",
      placement: "top",
      animation: "dance",
    },
    {
      id: "help-settings-invite-submit",
      targetSelector: "[data-tutorial='settings-team-invite-btn']",
      title: "📲 Preparar e Enviar Convite",
      description: "Após preencher os dados, clique em 'Preparar convite'. Você poderá:\n1. Enviar o link automaticamente por e-mail;\n2. Copiar a mensagem pronta com link exclusivo para enviar diretamente pelo WhatsApp do colaborador.\nO convite ficará monitorado no bloco de 'Pendências de Cadastro' até o aceite.",
      learnMoreAction: {
        label: "Quer saber como gerenciar a matriz de permissões finas (RBAC)?",
        actionType: "navigate_chapter",
        targetId: "dashboard-configuracoes",
      },
      placement: "top",
      animation: "glow",
    },
  ],

  "settings-team-pending-block": [
    {
      id: "help-settings-pending-overview",
      targetSelector: "[data-tutorial='settings-team-pending-box']",
      title: "⏳ Pendências de Cadastro — Objetivo & Acompanhamento",
      description: "Centraliza todos os convites emitidos que aguardam confirmação de e-mail ou primeiro login do colaborador na plataforma.",
      visualPreview: {
        type: "custom-badges",
        title: "Estados dos Convites Pendentes",
        badges: [
          { label: "Aguardando login", variant: "outline" },
          { label: "E-mail não verificado", variant: "destructive" },
          { label: "Convite pendente", variant: "secondary" },
        ],
      },
      placement: "top",
      animation: "glow",
    },
    {
      id: "help-settings-pending-actions",
      targetSelector: "[data-tutorial='settings-team-pending-box']",
      title: "Ações Rápidas de Gestão de Convites ⚡",
      description: "Reenvie convites com proteção de cooldown, copie o link direto para retransmitir, altere o cargo/papel atribuído ou cancele o convite com segurança.",
      placement: "top",
      animation: "bounce",
    },
  ],

  "settings-team-directory-block": [
    {
      id: "help-settings-directory-search",
      targetSelector: "[data-tutorial='settings-team-directory-box']",
      title: "🔍 Diretório de Colaboradores & Busca Rápida",
      description: "Localize qualquer membro da equipe por nome, e-mail, cargo ou papel operacional. Utilize filtros por status (online/inativo) e ordene por hierarquia.",
      visualPreview: {
        type: "keyboard-shortcuts",
        shortcuts: [
          { keys: ["⌘K", "Ctrl+K"], label: "Focar barra de busca" },
          { keys: ["Esc"], label: "Limpar filtros" },
        ],
      },
      placement: "top",
      animation: "pulse",
    },
    {
      id: "help-settings-directory-security",
      targetSelector: "[data-tutorial='settings-team-directory-box']",
      title: "Desconexão Remota & Gestão de Vínculos 🔒",
      description: "Administradores podem forçar o encerramento de sessões ativas de colaboradores em caso de emergência ou desativar o vínculo de membros que deixaram a clínica.",
      requiredPermission: "subaccounts.manage",
      placement: "top",
      animation: "glow",
    },
  ],

  "settings-team-concurrent-block": [
    {
      id: "help-settings-concurrent-capacity",
      targetSelector: "[data-tutorial='settings-team-concurrent-badge']",
      title: "⏱️ Acessos Simultâneos da Equipe",
      description: "Entenda a capacidade contratada: no plano Clínica, sua equipe tem cadastro ilimitado. Os 'Acessos Simultâneos' definem quantas pessoas podem usar a clínica ao mesmo tempo.",
      tip: "💡 Se atingir o limite simultâneo, você pode adicionar novos acessos simultâneos no painel de faturamento por +R$ 10/mês.",
      placement: "top",
      animation: "glow",
    },
  ],

  "settings-team-roles-modal-block": [
    {
      id: "help-settings-roles-modal-overview",
      targetSelector: "[data-tutorial='settings-team-roles-tab']",
      title: "🛡️ Matriz de Permissões (RBAC) — Controle Fino",
      description: "Configure com precisão cirúrgica o que cada papel operacional pode acessar, visualizar e editar em cada módulo da clínica.",
      placement: "bottom",
      animation: "glow",
    },
    {
      id: "help-settings-roles-modal-capabilities",
      targetSelector: "[data-tutorial='settings-team-roles-tab']",
      title: "Módulos & Níveis de Poder ⚙️",
      description: "Ative ou desative permissões para Prontuários, Gestão de Pacientes, Agenda da Clínica, Tesouraria & Faturamento, Edição de Fichas e Exclusões de Dados.",
      placement: "bottom",
      animation: "bounce",
    },
  ],

  "settings-clinic-profile-block": [
    {
      id: "help-settings-clinic-brand",
      targetSelector: "[data-tutorial='settings-clinic-profile-card']",
      title: "🏢 Perfil da Clínica & Identidade Visual",
      description: "Personalize a marca da clínica, definindo o nome oficial, logotipo institucional, e-mail e telefone de contato.",
      tip: "💡 O logo e dados cadastrados aqui são estampados automaticamente nos cabeçalhos de impressões de prontuários e laudos.",
      placement: "bottom",
      animation: "glow",
    },
  ],

  "settings-clinic-legal-block": [
    {
      id: "help-settings-clinic-legal",
      targetSelector: "[data-tutorial='settings-clinic-legal-card']",
      title: "📋 Dados Institucionais & Horário de Funcionamento",
      description: "Mantenha a Razão Social, CNPJ e os horários de atendimento da clínica atualizados para fins fiscais e operacionais.",
      placement: "bottom",
      animation: "pulse",
    },
  ],

  "settings-clinic-address-block": [
    {
      id: "help-settings-clinic-address",
      targetSelector: "[data-tutorial='settings-clinic-address-card']",
      title: "📍 Endereço Estruturado da Clínica",
      description: "Preenchimento completo de CEP, rua, número, bairro, cidade e estado para uso nos comprovantes e no agendamento dos pacientes.",
      placement: "bottom",
      animation: "glow",
    },
  ],

  "settings-profile-personal-block": [
    {
      id: "help-settings-profile-personal",
      targetSelector: "[data-tutorial='settings-profile-personal-card']",
      title: "👤 Perfil Pessoal do Profissional",
      description: "Seus dados cadastrais como pessoa física (Nome completo, Nome social, CPF, Foto e E-mail de login). Permanecem com você em qualquer clínica onde atue.",
      placement: "bottom",
      animation: "glow",
    },
    {
      id: "help-settings-profile-theme",
      targetSelector: "[data-tutorial='settings-profile-theme']",
      title: "Alternador de Tema (Claro / Escuro) 🌓",
      description: "Permite alternar a interface entre os modos Claro e Escuro para maior conforto visual durante seus atendimentos em qualquer ambiente.",
      placement: "top",
      animation: "bounce",
    },
  ],

  "settings-profile-license-block": [
    {
      id: "help-settings-profile-license",
      targetSelector: "[data-tutorial='settings-profile-license-card']",
      title: "📜 Registro Profissional & Conselho Regional",
      description: "Informe seu número de registro (CREFITO, CRM, etc.), especialidades clínicas e grade de horários de atendimento.",
      placement: "bottom",
      animation: "pulse",
    },
  ],

  "settings-forms-block": [
    {
      id: "help-settings-forms-overview",
      targetSelector: "[data-tutorial='settings-forms-card']",
      title: "📝 Construtor de Fichas & Anamneses — Visão Geral",
      description: "Configure formulários clínicos, questionários personalizados e fichas de avaliação específicas para as especialidades da sua clínica.",
      placement: "bottom",
      animation: "glow",
    },
    {
      id: "help-settings-forms-universal",
      targetSelector: "[data-tutorial='settings-forms-universal-block']",
      title: "Bloco Padrão Universal 🌐",
      description: "A estrutura de anamnese base obrigatória que é aplicada em todos os atendimentos da clínica com histórico unificado de evolução.",
      placement: "bottom",
      animation: "glow",
    },
    {
      id: "help-settings-forms-new-btn",
      targetSelector: "[data-tutorial='settings-forms-new-btn']",
      title: "Criar ou Importar Ficha Complementar ➕",
      description: "Crie fichas complementares do zero com perguntas personalizadas ou importe modelos JSON compartilhados entre clínicas.",
      placement: "bottom",
      animation: "bounce",
    },
  ],

  "settings-forms-universal-block": [
    {
      id: "help-settings-forms-universal-guide",
      targetSelector: "[data-tutorial='settings-forms-universal-block']",
      title: "🌐 Bloco Padrão Universal de Anamnese",
      description: "Contém as perguntas essenciais que são preenchidas para todos os pacientes da clínica. Mantenha os campos alinhados aos padrões do conselho de classe.",
      tip: "💡 Você pode exportar e importar modelos em JSON para compartilhar sua estrutura entre diferentes clínicas.",
      placement: "bottom",
      animation: "glow",
    },
  ],

  "settings-forms-extras-block": [
    {
      id: "help-settings-forms-extras-guide",
      targetSelector: "[data-tutorial='settings-forms-extras-block']",
      title: "✨ Fichas & Questionários Complementares",
      description: "Crie avaliações específicas para cada especialidade (ex: Avaliação de Ombro, Escala de Incapacidade Lombar, Triagem de Pilates).",
      learnMoreAction: {
        label: "Quer ver como as fichas são preenchidas durante o atendimento?",
        actionType: "navigate_chapter",
        targetId: "registro-sessao",
      },
      placement: "bottom",
      animation: "bounce",
    },
  ],

  "settings-forms-analytics-block": [
    {
      id: "help-settings-forms-analytics-guide",
      targetSelector: "[data-tutorial='settings-forms-analytics-block']",
      title: "📊 Analytics & Métricas de Formulários",
      description: "Visualize a taxa de preenchimento dos questionários, o tempo médio de resposta dos pacientes e as queixas mais recorrentes registradas.",
      placement: "bottom",
      animation: "pulse",
    },
  ],

  "settings-security-personal-block": [
    {
      id: "help-settings-security-personal-guide",
      targetSelector: "[data-tutorial='settings-security-personal-card']",
      title: "🔐 Segurança Pessoal & Autenticação MFA (2FA)",
      description: "Altere sua senha de acesso, configure a verificação em duas etapas via aplicativo autenticador (TOTP) e gerencie seus aparelhos conectados.",
      placement: "bottom",
      animation: "glow",
    },
  ],

  "settings-security-clinic-block": [
    {
      id: "help-settings-security-clinic-guide",
      targetSelector: "[data-tutorial='settings-security-clinic-card']",
      title: "🛡️ Segurança da Clínica & Proteção de Dados LGPD",
      description: "Ative a proteção anti-print com marca d'água dinâmica do CPF do usuário logado e consulte o log de auditoria de acessos aos prontuários.",
      placement: "bottom",
      animation: "pulse",
    },
  ],

  "settings-billing-block": [
    {
      id: "help-settings-billing-guide",
      targetSelector: "[data-tutorial='settings-billing-card']",
      title: "📦 Planos, Assinatura & Cotas",
      description: "Acompanhe o consumo da sua cota de pacientes ativos e acessos simultâneos, faça upgrade de plano e consulte o histórico de notas e faturas.",
      placement: "bottom",
      animation: "glow",
    },
  ],

  // ==========================================
  // 8. COMPONENTES INDIVIDUAIS AVULSOS
  // ==========================================
  "patient-search": {
    id: "help-patient-search",
    targetSelector: "[data-tutorial='patient-search-input']",
    title: "Busca Rápida de Pacientes 🔍",
    description: "Filtra instantaneamente os pacientes cadastrados por nome, CPF, telefone ou número de prontuário à medida que você digita.",
    placement: "bottom",
    animation: "pulse",
  },
  "patient-filter-tags": {
    id: "help-patient-filter-tags",
    targetSelector: "[data-tutorial='patient-filter-tags']",
    title: "Linhas de Cuidado & Filtros Rápidos 🏷️",
    description: "Pílulas táteis com as especialidades e queixas da sua clínica (ex: Ortopedia, Coluna, Pilates). Clique para filtrar a lista.",
    placement: "bottom",
    animation: "bounce",
  },
  "patient-add-btn": {
    id: "help-patient-add-btn",
    targetSelector: "[data-tutorial='patient-add-btn']",
    title: "Botão '+ Novo Paciente' 👤",
    description: "Abre o assistente de pré-cadastro ágil para registrar um paciente em menos de 1 minuto ou enviar link de auto-preenchimento.",
    placement: "bottom",
    animation: "dance",
  },
  "patient-card-clock": {
    id: "help-patient-card-clock",
    targetSelector: "[data-tutorial='patient-card-clock-icon']",
    title: "Cores do Relógio do Paciente 🕒",
    description: "Indica o status do próximo agendamento: 🟢 Verde (Hoje), 🔵 Azul (Data futura), 🟡 Laranja (Aguardando na recepção) e 🔴 Vermelho (Horário atrasado).",
    tip: "Clique no relógio para ver o horário exato e trocar de status.",
    placement: "bottom",
    animation: "pulse",
  },
  "patient-card-payment": {
    id: "help-patient-card-payment",
    targetSelector: "[data-tutorial='patient-card-payment-icon']",
    title: "Status Financeiro do Paciente ($) 💳",
    description: "Mostra a situação financeira consolidada: quitado, pendente, débito ou crédito disponível. Clique para abrir o extrato rápido.",
    placement: "bottom",
    animation: "bounce",
  },
  "patient-card-recurrence": {
    id: "help-patient-card-recurrence",
    targetSelector: "[data-tutorial='patient-card-recurrence-pill']",
    title: "Recorrência Semanal 🗓️",
    description: "As letras (D, S, T, Q, Q, S, S) destacam os dias da semana em que o paciente possui horários fixos na clínica.",
    placement: "bottom",
    animation: "glow",
  },
  "session-pain-scale": {
    id: "help-session-pain-scale",
    targetSelector: "[data-tutorial='session-pain-scale']",
    title: "Escala Visual Analógica de Dor (EVA) 🌡️",
    description: "Slider de 0 a 10 para mensurar a intensidade da dor relatada pelo paciente, gerando automaticamente a curva de evolução gráfica.",
    placement: "top",
    animation: "dance",
  },
  "session-custom-forms": {
    id: "help-session-custom-forms",
    targetSelector: "[data-tutorial='session-custom-forms-box']",
    title: "Fichas Complementares da Clínica ✨",
    description: "Permite vincular formulários estruturados da sua clínica (ex: Avaliação de Ombro, Questionário de Incapacidade) com um clique.",
    placement: "top",
    animation: "glow",
  },

  // ==========================================
  // 9. EDITOR VISUAL DE FICHAS & ANAMNESE
  // ==========================================
  "form-editor-tour": TUTORIAL_CHAPTERS.find((c) => c.id === "editor-formularios")?.steps || [],
  "form-editor": TUTORIAL_CHAPTERS.find((c) => c.id === "editor-formularios")?.steps || [],
  "form-editor-palette": {
    id: "help-form-palette",
    targetSelector: "[data-tutorial='form-editor-palette']",
    title: "📦 Biblioteca de Componentes Clínicos",
    description: "Adicione campos básicos (texto, número, data), seletores (múltipla escolha, checklist, droplist), seções sanfona e escalas clínicas avançadas (dor EVA, mapa corporal).",
    tip: "💡 Clique no '+' ou arraste para o canvas para posicionar onde desejar.",
    placement: "right",
    animation: "dance",
  },
  "form-palette-cat-basicos": [
    {
      id: "help-cat-basicos-overview",
      targetSelector: "[data-tutorial='form-palette-cat-basicos']",
      title: "📝 Categoria Básicos: Coleta Direta",
      description: "Estes são os blocos essenciais para registrar respostas diretas, relatos livres, medidas corporais e datas durante a consulta com muita praticidade.",
      placement: "right",
      animation: "glow",
    },
    {
      id: "help-item-short_text",
      targetSelector: "[data-tutorial='form-palette-item-short_text']",
      title: "🔤 Texto Curto (Resposta Rápida)",
      description: "Perfeito para respostas pontuais que cabem em uma linha, como Profissão do paciente, Médico solicitante, Esporte praticado ou Diagnóstico prévio.",
      visualPreview: {
        type: "form-field-mock",
        fieldMockType: "short_text",
      },
      tip: "💡 Excelente para dados rápidos que você quer bater o olho no cabeçalho da avaliação!",
      placement: "right",
      animation: "bounce",
    },
    {
      id: "help-item-long_text",
      targetSelector: "[data-tutorial='form-palette-item-long_text']",
      title: "📄 Texto Longo (Espaço para Detalhes)",
      description: "Uma área de texto livre e acolhedora para relatos detalhados. Ideal para a História da Doença Atual (H.D.A.), queixa principal com as palavras do paciente e condutas terapêuticas.",
      visualPreview: {
        type: "form-field-mock",
        fieldMockType: "long_text",
      },
      tip: "💡 A caixa se expande suavemente conforme você digita durante o atendimento.",
      placement: "right",
      animation: "bounce",
    },
    {
      id: "help-item-number",
      targetSelector: "[data-tutorial='form-palette-item-number']",
      title: "🔢 Apenas Números (Medidas e Contagens)",
      description: "Aceita somente números, garantindo precisão em medidas como Idade, Peso em kg, Altura em cm, Frequência Cardíaca e Graus de Amplitude de Movimento.",
      visualPreview: {
        type: "form-field-mock",
        fieldMockType: "number",
      },
      tip: "💡 Ajuda muito na geração de relatórios e no acompanhamento da evolução métrica do paciente!",
      placement: "right",
      animation: "bounce",
    },
    {
      id: "help-item-date",
      targetSelector: "[data-tutorial='form-palette-item-date']",
      title: "📅 Data (Calendário Interativo)",
      description: "Abre um calendário super prático com formatação automática no padrão brasileiro (dia/mês/ano). Indispensável para marcar a Data da Cirurgia, Início dos Sintomas ou Data do Trauma.",
      visualPreview: {
        type: "form-field-mock",
        fieldMockType: "date",
      },
      placement: "right",
      animation: "bounce",
    },
  ],
  "form-palette-cat-opcoes": [
    {
      id: "help-cat-opcoes-overview",
      targetSelector: "[data-tutorial='form-palette-cat-opcoes']",
      title: "🎯 Opções & Seleção: Preenchimento com 1 Toque",
      description: "Criados para você economizar tempo de digitação na consulta! Permite responder perguntas com apenas um toque no tablet ou clique no computador, padronizando os registros da clínica.",
      placement: "right",
      animation: "glow",
    },
    {
      id: "help-item-select",
      targetSelector: "[data-tutorial='form-palette-item-select']",
      title: "🔽 Droplist (Menu Suspenso Compacto)",
      description: "Um menu retrátil super elegante que ocupa pouco espaço na tela. Ideal quando você tem muitas opções para escolher, como Lado Acometido (Direito, Esquerdo ou Bilateral), Convênio ou Região Anatômica.",
      visualPreview: {
        type: "form-field-mock",
        fieldMockType: "select",
      },
      placement: "right",
      animation: "bounce",
    },
    {
      id: "help-item-multiple_choice",
      targetSelector: "[data-tutorial='form-palette-item-multiple_choice']",
      title: "🔘 Múltipla Escolha (Opção Única na Tela)",
      description: "Mostra as opções já visíveis na tela para o profissional selecionar apenas uma delas. Perfeito para perguntas diretas, como Fumante (Sim ou Não) ou Classificação da Dor (Aguda, Crônica ou Insidiosa).",
      visualPreview: {
        type: "form-field-mock",
        fieldMockType: "multiple_choice",
      },
      placement: "right",
      animation: "bounce",
    },
    {
      id: "help-item-checklist",
      targetSelector: "[data-tutorial='form-palette-item-checklist']",
      title: "☑️ Checklist (Múltiplas Opções)",
      description: "Permite marcar quantas alternativas forem necessárias ao mesmo tempo. Excelente para listar Sintomas Associados (como Edema, Calor e Crepitação) ou Comorbidades (Hipertensão, Diabetes).",
      visualPreview: {
        type: "form-field-mock",
        fieldMockType: "checklist",
      },
      placement: "right",
      animation: "bounce",
    },
    {
      id: "help-item-slider",
      targetSelector: "[data-tutorial='form-palette-item-slider']",
      title: "🎚️ Slidebar (Escala Deslizante de Dor)",
      description: "Uma régua deslizante horizontal que facilita muito mensurar intensidades de 0 a 10, como a Escala Visual Analógica de Dor (EVA) ou o Nível de Esforço percebido pelo paciente.",
      visualPreview: {
        type: "form-field-mock",
        fieldMockType: "slider",
      },
      tip: "💡 Os pacientes acham super intuitivo e visual apontar o nível de dor na régua colorida!",
      placement: "right",
      animation: "bounce",
    },
  ],
  "form-palette-cat-estrutura": [
    {
      id: "help-cat-estrutura-overview",
      targetSelector: "[data-tutorial='form-palette-cat-estrutura']",
      title: "🏗️ Estrutura & Agrupamento: Organização Visual",
      description: "Ajuda a deixar fichas longas muito mais leves, elegantes e fáceis de navegar, organizando as perguntas em blocos bem definidos e seções coloridas.",
      placement: "right",
      animation: "glow",
    },
    {
      id: "help-item-section",
      targetSelector: "[data-tutorial='form-palette-item-section']",
      title: "📂 Seção Sanfona (Bloco Retrátil com Cores)",
      description: "Cria blocos sanfonados que podem ser abertos e recolhidos com um clique. Perfeito para organizar sua ficha em etapas claras, como Anamnese Inicial, Exame Físico, Testes Especiais e Conduta Terapêutica.",
      visualPreview: {
        type: "form-field-mock",
        fieldMockType: "section",
      },
      tip: "💡 Você pode escolher uma cor especial para cada seção nas propriedades, tornando a navegação visual muito agradável!",
      placement: "right",
      animation: "bounce",
    },
    {
      id: "help-item-horizontal_section",
      targetSelector: "[data-tutorial='form-palette-item-horizontal_section']",
      title: "↔️ Seção Horizontal (Perguntas Lado a Lado)",
      description: "Permite colocar duas ou mais perguntas curtas na mesma linha com rolagem suave. Ótimo para avaliações bilaterais comparativas (Membro Direito e Membro Esquerdo) ou Pressão Arterial e Frequência Cardíaca juntos.",
      visualPreview: {
        type: "form-field-mock",
        fieldMockType: "horizontal_section",
      },
      placement: "right",
      animation: "bounce",
    },
    {
      id: "help-item-section_selector",
      targetSelector: "[data-tutorial='form-palette-item-section_selector']",
      title: "🔀 Seletor de Seções (Módulos Condicionais)",
      description: "Adiciona botões de ligar e desligar no início da ficha para ativar módulos inteiros sob demanda, como ativar o Módulo Joelho ou Módulo Coluna apenas quando o paciente tiver aquela queixa.",
      visualPreview: {
        type: "form-field-mock",
        fieldMockType: "section_selector",
      },
      placement: "right",
      animation: "bounce",
    },
  ],
  "form-palette-cat-especiais": [
    {
      id: "help-cat-especiais-overview",
      targetSelector: "[data-tutorial='form-palette-cat-especiais']",
      title: "🌟 Componentes Especiais: Recursos Avançados",
      description: "Componentes inteligentes prontos para prescrições em tabela e localização rápida de endereço do paciente.",
      placement: "right",
      animation: "glow",
    },
    {
      id: "help-item-table",
      targetSelector: "[data-tutorial='form-palette-item-table']",
      title: "📊 Tabela (Grade com Colunas Personalizadas)",
      description: "Uma grade estruturada onde você pode definir colunas personalizadas como Exercício, Séries, Repetições e Carga. Perfeita para prescrição de exercícios e testes de força muscular.",
      visualPreview: {
        type: "form-field-mock",
        fieldMockType: "table",
      },
      placement: "right",
      animation: "bounce",
    },
    {
      id: "help-item-address_block",
      targetSelector: "[data-tutorial='form-palette-item-address_block']",
      title: "📍 Bloco de Endereço Inteligente",
      description: "Conjunto completo de campos de endereço com busca automática por CEP, preenchendo rua, bairro, cidade e estado em um piscar de olhos.",
      visualPreview: {
        type: "form-field-mock",
        fieldMockType: "address_block",
      },
      placement: "right",
      animation: "bounce",
    },
  ],
  "form-editor-canvas": {
    id: "help-form-canvas",
    targetSelector: "[data-tutorial='form-editor-canvas']",
    title: "🎨 Canvas de Construção Visual",
    description: "Organize e edite os campos do seu formulário. Clique em um campo para abrir suas propriedades ou arraste para reorganizar.",
    placement: "left",
    animation: "pulse",
  },
  "form-editor-inspector": {
    id: "help-form-inspector",
    targetSelector: "[data-tutorial='form-editor-inspector']",
    title: "⚙️ Painel de Fluxo e Propriedades",
    description: "Alterne entre a aba 'Fluxo' (para reorganizar a árvore de perguntas e ver limites) e a aba 'Propriedades' (para editar título, obrigatoriedade, regras lógicas e cores).",
    placement: "left",
    animation: "glow",
  },
};
