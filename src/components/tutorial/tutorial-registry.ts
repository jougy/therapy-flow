export type TutorialAnimation = "dance" | "pulse" | "bounce" | "glow";
export type TutorialPlacement = "top" | "bottom" | "left" | "right" | "center";

export type VisualPreviewType =
  | "payment-status"
  | "clock-colors"
  | "recurrence-pill"
  | "keyboard-shortcuts"
  | "list-mode"
  | "status-badge"
  | "pain-scale"
  | "custom-badges"
  | "form-field-mock";

export interface VisualPreviewItem {
  label: string;
  badgeText?: string;
  icon?: string;
  colorClass?: string;
  bgClass?: string;
  borderClass?: string;
  desc?: string;
}

export interface KeyboardShortcutItem {
  keys: string[];
  label: string;
  description?: string;
}

export interface TutorialVisualPreviewConfig {
  type: VisualPreviewType;
  title?: string;
  fieldMockType?: string;
  fieldMockConfig?: {
    label?: string;
    placeholder?: string;
    value?: string;
    options?: string[];
    description?: string;
    color?: string;
    badge?: string;
    columns?: string[];
    isRequired?: boolean;
  };
  items?: VisualPreviewItem[];
  shortcuts?: KeyboardShortcutItem[];
  recurrenceDays?: Array<{ letter: string; active?: boolean; dayName?: string }>;
  activeListMode?: "patients" | "sessions";
}

export interface TutorialLearnMoreAction {
  label: string;
  actionType: "navigate_chapter" | "navigate_help" | "navigate_route";
  targetId?: string; // chapterId or helpId
  targetRoute?: string; // route path
  requiresDemoPatient?: boolean;
}

export interface TutorialStep {
  id: string;
  targetSelector?: string;
  title: string;
  description: string;
  tip?: string;
  actionPrompt?: string; // Prompt when the user should click/interact with the element
  requiresAction?: boolean; // If true, highlights that clicking the element advances the tutorial
  interactive?: boolean; // Enables pointer events for this element specifically
  placement?: TutorialPlacement;
  animation?: TutorialAnimation;
  highlightPadding?: number;
  route?: string; // Associated route path for this step in master journey
  chapterId?: string;
  isDemoNotice?: boolean; // If true, shows a notice that this is a simulated demo patient
  visualPreview?: TutorialVisualPreviewConfig;
  learnMoreAction?: TutorialLearnMoreAction;
  requiredPermission?: string; // e.g. "treasury.manage", "forms.manage", "subaccounts.manage", "patients.manage"
  requiredRole?: string[]; // e.g. ["owner", "admin", "professional"]
  onBeforeStep?: () => void | Promise<void>;
  onAfterStep?: () => void | Promise<void>;
}

export interface TutorialChapter {
  id: string;
  chapterNumber: number;
  title: string;
  shortTitle: string;
  description: string;
  badge: string;
  estimatedMinutes: number;
  route: string;
  iconName: string;
  requiredPermission?: string;
  requiredRole?: string[];
  steps: TutorialStep[];
}

export interface PageTutorialConfig {
  pageId: string;
  title: string;
  description: string;
  badge?: string;
  requiredPermission?: string;
  steps: TutorialStep[];
}

export const TUTORIAL_CHAPTERS: TutorialChapter[] = [
  {
    id: "espaco-pessoal",
    chapterNumber: 1,
    title: "Espaço Pessoal & Seleção de Clínicas",
    shortTitle: "Espaço Pessoal",
    description: "Centro de comando para alternar entre clínicas, criar novas unidades e configurar sua conta e CREFITO.",
    badge: "Capítulo 1",
    estimatedMinutes: 2,
    route: "/selecionar-clinica",
    iconName: "Building2",
    steps: [
      {
        id: "welcome-hero",
        targetSelector: "[data-tutorial='personal-welcome']",
        title: "Boas-vindas ao Pluri-Health! 👋",
        description: "Este é o seu centro de comando pessoal. Aqui você gerencia seus acessos profissionais e todas as clínicas das quais faz parte.",
        tip: "Você pode atuar em múltiplas clínicas com papéis independentes (Proprietário, Fisioterapeuta ou Administrador).",
        placement: "bottom",
        animation: "glow",
      },
      {
        id: "clinic-card-select",
        targetSelector: "[data-tutorial='clinic-card-primary']",
        title: "Acessar Clínica Cadastrada 🏥",
        description: "Cada card representa uma clínica ou consultório ativo. Clique no botão de acesso para abrir a rotina de atendimentos.",
        actionPrompt: "Clique no card da clínica para entrar na Home de atendimento",
        requiresAction: true,
        interactive: true,
        placement: "top",
        animation: "dance",
      },
      {
        id: "create-clinic-btn",
        targetSelector: "[data-tutorial='create-clinic-btn']",
        title: "Criar Nova Clínica ou Unidade ➕",
        description: "Precisa abrir outra filial ou consultório? Clique neste botão para iniciar o assistente passo a passo de configuração da clínica.",
        placement: "bottom",
        animation: "pulse",
      },
      {
        id: "theme-toggle-btn",
        targetSelector: "[data-tutorial='personal-theme-switch']",
        title: "Modo Escuro & Claro 🌓",
        description: "Trabalhe no tema que for mais confortável para sua visão. Alterne entre os modos claro e escuro instantaneamente.",
        placement: "bottom",
        animation: "bounce",
      },
      {
        id: "account-security-btn",
        targetSelector: "[data-tutorial='personal-account-btn']",
        title: "Sua Conta & Dados do CREFITO 🔐",
        description: "Gerencie seu registro profissional (CREFITO), altere sua senha de acesso e ative a autenticação em duas etapas (MFA).",
        placement: "bottom",
        animation: "glow",
      },
    ],
  },

  {
    id: "home-clinica",
    chapterNumber: 2,
    title: "Home da Clínica & Gestão de Pacientes",
    shortTitle: "Home & Pacientes",
    description: "Visão geral da recepção digital: barra de busca inteligente, filtros táteis por linhas de cuidado e lista de pacientes.",
    badge: "Capítulo 2",
    estimatedMinutes: 2,
    route: "/clinica/demo",
    iconName: "Users",
    steps: [
      {
        id: "home-intro",
        targetSelector: "[data-tutorial='patient-search-input']",
        title: "Busca Rápida de Pacientes 🔍",
        description: "Localize qualquer paciente instantaneamente digitando parte do nome, CPF, telefone ou número de prontuário.",
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
        animation: "glow",
      },
      {
        id: "home-filter-tags",
        targetSelector: "[data-tutorial='patient-filter-tags']",
        title: "Filtros Táteis & Linhas de Cuidado 🏷️",
        description: "Filtre seus pacientes por especialidades clínicas (Ortopedia, Pilates, Coluna, Postura), status financeiro e datas.",
        tip: "As cores das etiquetas ajudam na rápida identificação visual no dia a dia da clínica.",
        visualPreview: { type: "list-mode" },
        placement: "bottom",
        animation: "pulse",
      },
      {
        id: "home-btn-new-patient",
        targetSelector: "[data-tutorial='patient-add-btn']",
        title: "Cadastrar Novo Paciente 👤",
        description: "Vamos cadastrar um paciente de demonstração para você testar todas as etapas da plataforma de forma 100% segura.",
        tip: "💡 Este paciente será um registro hipotético de teste. Ao concluir ou pular o tutorial, ele será automaticamente removido para não poluir sua clínica!",
        actionPrompt: "Clique em '+ Novo Paciente' para ver como cadastrar",
        requiresAction: true,
        interactive: true,
        learnMoreAction: {
          label: "Aprender cadastro rápido de pacientes",
          actionType: "navigate_chapter",
          targetId: "novo-paciente",
          targetRoute: "/pacientes/novo",
        },
        placement: "bottom",
        animation: "dance",
      },
      {
        id: "home-agenda-widget",
        targetSelector: "[data-tutorial='agenda-widget']",
        title: "Agenda Diária Rápida 📅",
        description: "Acompanhe todos os atendimentos agendados para hoje, navegue pelos dias e inicie consultas com um toque.",
        placement: "bottom",
        animation: "bounce",
      },
    ],
  },

  {
    id: "novo-paciente",
    chapterNumber: 3,
    title: "Cadastro do Novo Paciente",
    shortTitle: "Novo Paciente",
    description: "Aprenda a cadastrar dados pessoais, WhatsApp, busca automática de CEP e os botões de compartilhamento.",
    badge: "Capítulo 3",
    estimatedMinutes: 3,
    route: "/pacientes/novo",
    iconName: "UserPlus",
    requiredPermission: "patients.manage",
    steps: [
      {
        id: "new-patient-basic",
        targetSelector: "[data-tutorial='new-patient-form-basic']",
        title: "Pré-Cadastro Ágil & Objetivo 🆔",
        description: "Formulário rápido para registrar o paciente em menos de 1 minuto na recepção com validação anti-duplicidade em tempo real.",
        tip: "🧪 Estamos usando o 'Paciente Demonstração (Tutorial)', um registro de teste temporário que será excluído no final do tour.",
        isDemoNotice: true,
        placement: "bottom",
        animation: "glow",
      },
      {
        id: "new-patient-name-field",
        targetSelector: "[data-tutorial='new-patient-name']",
        title: "Nome Completo do Paciente ✍️",
        description: "Identificação principal utilizada em toda a plataforma, nas buscas instantâneas e nos cabeçalhos de prontuário.",
        placement: "bottom",
        animation: "pulse",
      },
      {
        id: "new-patient-birth-field",
        targetSelector: "[data-tutorial='new-patient-birth']",
        title: "Data de Nascimento & Idade 🎂",
        description: "Calcula a idade exata automaticamente para protocolos clínicos e relatórios específicos por faixa etária.",
        placement: "bottom",
        animation: "pulse",
      },
      {
        id: "new-patient-document-field",
        targetSelector: "[data-tutorial='new-patient-document']",
        title: "Flexibilidade de Documentos 🔒",
        description: "Suporta CPF do próprio paciente, CPF do responsável (menores/dependentes), RG, Passaporte/ID Estrangeiro ou sem documento.",
        placement: "bottom",
        animation: "pulse",
      },
      {
        id: "new-patient-gender-pronoun-field",
        targetSelector: "[data-tutorial='new-patient-gender-pronoun']",
        title: "Gênero & Pronome de Tratamento 👥",
        description: "Campos opcionais para acolhimento personalizado e respeito à identidade de cada paciente nas comunicações da clínica.",
        placement: "bottom",
        animation: "pulse",
      },
      {
        id: "new-patient-contacts-field",
        targetSelector: "[data-tutorial='new-patient-contacts']",
        title: "WhatsApp & E-mail de Contato 💬",
        description: "Canais diretos para envio de lembretes automáticos de consulta, recibos e abertura de conversa com 1 clique.",
        placement: "bottom",
        animation: "pulse",
      },
      {
        id: "new-patient-submit-btn",
        targetSelector: "[data-tutorial='new-patient-submit-btn']",
        title: "Concluir Pré-Cadastro & Próximos Passos 🚀",
        description: "Ao concluir, você poderá escolher entre compartilhar a ficha para o paciente preencher no celular ou abrir o cadastro completo com 8 abas.",
        placement: "top",
        animation: "dance",
      },
    ],
  },

  {
    id: "card-paciente",
    chapterNumber: 4,
    title: "Anatomia do Card do Paciente",
    shortTitle: "Card do Paciente",
    description: "Entenda o significado de cada símbolo, etiqueta colorida, atalho de WhatsApp e menu do card de paciente.",
    badge: "Capítulo 4",
    estimatedMinutes: 2,
    route: "/clinica/demo",
    iconName: "CreditCard",
    steps: [
      {
        id: "card-first-overview",
        targetSelector: "[data-tutorial='patient-card-first']",
        title: "Card Resumo do Paciente 📋",
        description: "O card condensa todas as informações clínicas e operacionais essenciais do paciente em uma única linha tátil.",
        placement: "top",
        animation: "glow",
      },
      {
        id: "card-status-badge",
        targetSelector: "[data-tutorial='patient-card-status-badge']",
        title: "Status de Atividade (Ativo / Inativo) 🏷️",
        description: "Indica se o paciente está em tratamento contínuo (Ativo), com alta clínica ou inativo.",
        visualPreview: { type: "status-badge" },
        placement: "bottom",
        animation: "pulse",
      },
      {
        id: "card-payment-icon",
        targetSelector: "[data-tutorial='patient-card-payment-icon']",
        title: "Símbolo Financeiro ($) 💳",
        description: "Clique no ícone de cifrão para abrir o resumo financeiro: sessões pagas, valores em aberto ou créditos disponíveis.",
        actionPrompt: "Passe o mouse ou clique no ícone '$' para ver o status financeiro",
        interactive: true,
        requiredPermission: "treasury.manage",
        visualPreview: { type: "payment-status" },
        learnMoreAction: {
          label: "Aprender sobre Gestão Financeira e Cobranças",
          actionType: "navigate_chapter",
          targetId: "dashboard-configuracoes",
        },
        placement: "bottom",
        animation: "bounce",
      },
      {
        id: "card-groups-tags",
        targetSelector: "[data-tutorial='patient-card-groups-tags']",
        title: "Linhas de Cuidado & Sintomas 🎨",
        description: "Tags coloridas que mostram as queixas e especialidades vinculadas ao paciente (ex: Cervicalgia, Pilates, Reabilitação).",
        placement: "bottom",
        animation: "pulse",
      },
      {
        id: "card-recurrence-pill",
        targetSelector: "[data-tutorial='patient-card-recurrence-pill']",
        title: "Dias de Recorrência Programada 🗓️",
        description: "Letras (D, S, T, Q, Q, S, S) destacadas mostram os dias fixos da semana em que o paciente costuma ser atendido.",
        visualPreview: { type: "recurrence-pill" },
        learnMoreAction: {
          label: "Aprender a definir a recorrência semanal",
          actionType: "navigate_chapter",
          targetId: "prontuario-paciente",
        },
        placement: "bottom",
        animation: "glow",
      },
    ],
  },

  {
    id: "agenda-gestao",
    chapterNumber: 5,
    title: "Agendamento & Gestão da Agenda",
    shortTitle: "Agenda Completa",
    description: "Domine a seleção de datas, marcação de consultas, reuniões e navegação entre dias com compromissos.",
    badge: "Capítulo 5",
    estimatedMinutes: 3,
    route: "/clinica/demo",
    iconName: "Calendar",
    steps: [
      {
        id: "agenda-date-picker",
        targetSelector: "[data-tutorial='agenda-date-picker-btn']",
        title: "Botão Central de Data & Calendário 📆",
        description: "Clique no botão do meio com a data para abrir o calendário flutuante e escolher qualquer dia futuro específico.",
        actionPrompt: "Clique na data para abrir o calendário",
        requiresAction: true,
        interactive: true,
        placement: "bottom",
        animation: "dance",
      },
      {
        id: "agenda-nav-arrows",
        targetSelector: "[data-tutorial='agenda-nav-arrows']",
        title: "Navegação Rápida com Setas ⏩",
        description: "As setas contêm badges numéricos que mostram quantos compromissos existem antes ou depois da data atual, pulando dias vazios!",
        placement: "bottom",
        animation: "bounce",
      },
      {
        id: "agenda-add-event-btn",
        targetSelector: "[data-tutorial='agenda-add-btn']",
        title: "Mais que Consultas: Reuniões e Eventos ⏰",
        description: "A agenda permite agendar Consultas Clínicas, Reuniões de Equipe e Eventos Internos com horários e profissionais dedicados.",
        actionPrompt: "Clique em 'Agendar' para abrir o formulário de evento",
        requiresAction: true,
        interactive: true,
        placement: "top",
        animation: "pulse",
      },
      {
        id: "agenda-quick-start-btn",
        targetSelector: "[data-tutorial='agenda-quick-start']",
        title: "Iniciar Atendimento Agora ⚡",
        description: "O paciente acabou de chegar? Clique no botão verde para iniciar a evolução clínica imediatamente sem burocracia.",
        placement: "top",
        animation: "dance",
      },
    ],
  },

  {
    id: "relogio-cores",
    chapterNumber: 6,
    title: "O Relógio do Paciente & Suas Cores",
    shortTitle: "Cores do Relógio",
    description: "Aprenda a ler os 4 estados visuais do relógio que indicam a pontualidade e o status do próximo atendimento.",
    badge: "Capítulo 6",
    estimatedMinutes: 2,
    route: "/clinica/demo",
    iconName: "Clock",
    steps: [
      {
        id: "clock-icon-overview",
        targetSelector: "[data-tutorial='patient-card-clock-icon']",
        title: "O Ícone de Relógio no Card 🕒",
        description: "Quando um paciente tem um agendamento programado, o relógio aparece no card mudando de cor conforme o momento do atendimento.",
        actionPrompt: "Clique no ícone de relógio para abrir o popup com detalhes do horário",
        requiresAction: true,
        interactive: true,
        visualPreview: { type: "clock-colors" },
        placement: "bottom",
        animation: "dance",
      },
      {
        id: "clock-color-green",
        targetSelector: "[data-tutorial='patient-card-clock-icon']",
        title: "🟢 Relógio Verde: Atendimento Hoje",
        description: "Significa que o paciente tem sessão agendada para o dia de hoje e está pronto para ser atendido.",
        visualPreview: { type: "clock-colors" },
        placement: "bottom",
        animation: "pulse",
      },
      {
        id: "clock-color-blue",
        targetSelector: "[data-tutorial='patient-card-clock-icon']",
        title: "🔵 Relógio Azul: Data Futura",
        description: "Indica uma consulta confirmada para uma data posterior (amanhã, próxima semana, etc.).",
        visualPreview: { type: "clock-colors" },
        placement: "bottom",
        animation: "glow",
      },
      {
        id: "clock-color-orange",
        targetSelector: "[data-tutorial='patient-card-clock-icon']",
        title: "🟡 Relógio Laranja: Aguardando / Chegada",
        description: "O paciente já chegou na clínica e está na sala de espera aguardando o início do atendimento.",
        visualPreview: { type: "clock-colors" },
        placement: "bottom",
        animation: "bounce",
      },
      {
        id: "clock-color-red",
        targetSelector: "[data-tutorial='patient-card-clock-icon']",
        title: "🔴 Relógio Vermelho: Horário em Atraso",
        description: "O horário combinado do agendamento já passou e o atendimento ainda não foi iniciado no sistema.",
        visualPreview: { type: "clock-colors" },
        placement: "bottom",
        animation: "dance",
      },
    ],
  },

  {
    id: "prontuario-paciente",
    chapterNumber: 7,
    title: "Prontuário do Paciente & Agenda Interna",
    shortTitle: "Prontuário Completo",
    description: "Explore o prontuário eletrônico: métricas de frequência, agenda interna, histórico de sessões e anexos.",
    badge: "Capítulo 7",
    estimatedMinutes: 3,
    route: "/pacientes/demo",
    iconName: "ClipboardList",
    steps: [
      {
        id: "patient-header-view",
        targetSelector: "[data-tutorial='patient-profile-header']",
        title: "Cabeçalho & Identificação Clínica 👤",
        description: "Resumo com idade, código do prontuário, atalho de WhatsApp e botão de compartilhar cadastro.",
        placement: "bottom",
        animation: "glow",
      },
      {
        id: "patient-metrics-panel",
        targetSelector: "[data-tutorial='patient-metrics-panel']",
        title: "Painel de Métricas & Histórico 📊",
        description: "Consolida o último atendimento realizado, total de sessões concluídas, taxa de presença e saldo financeiro.",
        requiredPermission: "treasury.manage",
        visualPreview: { type: "payment-status" },
        placement: "bottom",
        animation: "pulse",
      },
      {
        id: "patient-internal-agenda",
        targetSelector: "[data-tutorial='patient-internal-agenda']",
        title: "Agenda Interna do Paciente ⏱️",
        description: "Permite iniciar um atendimento neste exato momento ou navegar até o agendamento futuro marcado para iniciar com os dados pré-carregados.",
        actionPrompt: "Veja as opções de 'Iniciar atendimento agora' ou 'Iniciar agendado'",
        placement: "top",
        animation: "dance",
      },
      {
        id: "patient-tab-sessions",
        targetSelector: "[data-tutorial='patient-tab-sessions']",
        title: "Aba Atendimentos & Linha do Tempo 🕒",
        description: "Lista cronológica de todas as sessões passadas com filtros rápidos por sintomas, condutas e nível de dor.",
        placement: "bottom",
        animation: "bounce",
      },
      {
        id: "patient-tab-files",
        targetSelector: "[data-tutorial='patient-tab-files']",
        title: "Aba Arquivos & Exames 📁",
        description: "Anexe PDFs de laudos, exames de ressonância/raio-X e fotos posturais com criptografia segura.",
        placement: "bottom",
        animation: "pulse",
      },
      {
        id: "patient-btn-recurrence",
        targetSelector: "[data-tutorial='patient-btn-recurrence']",
        title: "Configurar Recorrência Automática 🔁",
        description: "Defina os dias da semana e o horário padrão do paciente para manter lembretes automáticos na agenda.",
        visualPreview: { type: "recurrence-pill" },
        placement: "bottom",
        animation: "glow",
      },
    ],
  },

  {
    id: "registro-sessao",
    chapterNumber: 8,
    title: "Sessão de Atendimento & Evolução Clínica",
    shortTitle: "Sessão Clínica",
    description: "Passo a passo do atendimento: cronômetro, régua de dor EVA, conduta SOAP, receituário e conclusão segura.",
    badge: "Capítulo 8",
    estimatedMinutes: 3,
    route: "/pacientes/demo/sessao/demo",
    iconName: "Stethoscope",
    steps: [
      {
        id: "session-timer-presence",
        targetSelector: "[data-tutorial='session-timer']",
        title: "Controle de Presença & Horários ⏱️",
        description: "Registre o horário agendado, a chegada do paciente e o início do atendimento com cálculo automático de pontualidade.",
        placement: "bottom",
        animation: "glow",
      },
      {
        id: "session-carelines-select",
        targetSelector: "[data-tutorial='session-carelines']",
        title: "Sintomas & Linhas de Cuidado da Sessão 🏷️",
        description: "Selecione quais motivos ou queixas foram tratados nesta sessão específica para categorizar a evolução.",
        placement: "bottom",
        animation: "pulse",
      },
      {
        id: "session-pain-scale",
        targetSelector: "[data-tutorial='session-pain-scale']",
        title: "Escala Visual Analógica de Dor (EVA) 🌡️",
        description: "Arraste o slider de 0 a 10 para registrar o nível de dor do paciente e alimentar o gráfico evolutivo.",
        visualPreview: { type: "pain-scale" },
        placement: "top",
        animation: "dance",
      },
      {
        id: "session-custom-forms-box",
        targetSelector: "[data-tutorial='session-custom-forms-box']",
        title: "Fichas Complementares da Clínica ✨",
        description: "Vincule formulários estruturados da sua clínica (ex: Avaliação de Ombro, Questionário Roland-Morris) com 1 clique.",
        learnMoreAction: {
          label: "Aprender a construir modelos no Editor Visual",
          actionType: "navigate_chapter",
          targetId: "dashboard-configuracoes",
        },
        placement: "top",
        animation: "pulse",
      },
      {
        id: "session-conduct-notes",
        targetSelector: "[data-tutorial='session-conduct-notes']",
        title: "Conduta & Evolução Fisioterapêutica ✍️",
        description: "Descreva os procedimentos aplicados: terapia manual, cinesioterapia, eletroterapia e respostas do paciente.",
        placement: "top",
        animation: "glow",
      },
      {
        id: "session-tab-treatment",
        targetSelector: "[data-tutorial='session-tab-treatment']",
        title: "Receituário & Exercícios para Casa 📝",
        description: "Adicione blocos com nomes de exercícios, frequência, séries, repetições e orientações gerais para o paciente.",
        placement: "top",
        animation: "bounce",
      },
      {
        id: "session-tab-payment",
        targetSelector: "[data-tutorial='session-tab-payment']",
        title: "Financeiro & Baixa da Sessão 💳",
        description: "Informe o valor cobrado, método (Pix, Cartão, Dinheiro), descontos ou vincule a um pacote de sessões existente.",
        requiredPermission: "treasury.manage",
        visualPreview: { type: "payment-status" },
        placement: "top",
        animation: "pulse",
      },
      {
        id: "session-finish-btn",
        targetSelector: "[data-tutorial='session-finish-btn']",
        title: "Concluir & Proteger Atendimento ✅",
        description: "Ao finalizar, o atendimento é gravado com auditoria completa. O paciente de demonstração será removido automaticamente para manter seu banco 100% limpo.",
        placement: "top",
        animation: "dance",
      },
    ],
  },

  {
    id: "dashboard-configuracoes",
    chapterNumber: 9,
    title: "Dashboards, Métricas & Configurações",
    shortTitle: "Gestão & Ajustes",
    description: "Analise gráficos gerenciais, crie fichas no construtor no-code, gerencie sua equipe e ative proteção MFA.",
    badge: "Capítulo 9",
    estimatedMinutes: 2,
    route: "/clinica/demo/configuracoes",
    iconName: "Settings",
    steps: [
      {
        id: "settings-general-nav",
        targetSelector: "[data-tutorial='settings-nav-general']",
        title: "Dados da Clínica & Timbrado 🏢",
        description: "Razão social, CNPJ, logotipo oficial e endereço que saem automaticamente em todos os laudos impressos.",
        placement: "right",
        animation: "glow",
      },
      {
        id: "settings-team-nav",
        targetSelector: "[data-tutorial='settings-nav-team']",
        title: "Equipe, Cargos & Permissões 👥",
        description: "Convide fisioterapeutas, recepcionistas e estagiários, definindo limites precisos de acesso aos prontuários e ao financeiro.",
        requiredPermission: "subaccounts.manage",
        placement: "right",
        animation: "dance",
      },
      {
        id: "settings-forms-nav",
        targetSelector: "[data-tutorial='settings-nav-templates']",
        title: "Construtor Visual de Formulários 📝",
        description: "Crie questionários clínicos no-code com réguas EVA, mapas anatômicos e campos personalizados.",
        requiredPermission: "forms.manage",
        placement: "right",
        animation: "pulse",
      },
      {
        id: "settings-security-nav",
        targetSelector: "[data-tutorial='settings-nav-security']",
        title: "Segurança Avançada & MFA 🛡️",
        description: "Ative a verificação em duas etapas e gerencie as sessões ativas para garantir conformidade total com a LGPD.",
        placement: "right",
        animation: "bounce",
      },
    ],
  },
  {
    id: "editor-formularios",
    chapterNumber: 10,
    title: "Editor Visual de Fichas e Anamnese",
    shortTitle: "Editor de Fichas",
    description: "Monte e personalize fichas de avaliação no-code com campos clínicos, escalas EVA, seções e simulação de preenchimento.",
    badge: "Capítulo 10",
    estimatedMinutes: 3,
    route: "/clinica/demo/configuracoes/formularios/novo",
    iconName: "FileEdit",
    requiredPermission: "forms.manage",
    steps: [
      {
        id: "form-editor-title-step",
        targetSelector: "[data-tutorial='form-editor-title-card']",
        title: "📝 Nome e Apresentação da sua Ficha",
        description: "Dê um nome bem acolhedor e intuitivo para a sua ficha, como Ficha de Avaliação Traumato-Ortopédica ou Triagem de Pilates. A descrição serve para orientar os profissionais da sua clínica sobre em quais casos essa avaliação deve ser utilizada.",
        tip: "💡 O nome que você definir aqui aparecerá automaticamente para os profissionais selecionarem durante a consulta!",
        placement: "bottom",
        animation: "glow",
      },
      {
        id: "form-editor-palette-step",
        targetSelector: "[data-tutorial='form-editor-palette']",
        title: "📦 Biblioteca de Componentes Prontos",
        description: "Aqui você encontra tudo o que precisa para montar sua avaliação com carinho: desde campos rápidos de texto e data até escalas visuais de dor e seletores de múltipla escolha.",
        visualPreview: {
          type: "pain-scale",
        },
        tip: "💡 Para adicionar uma pergunta, basta dar um clique no botão de + ou arrastar o bloco diretamente para o local desejado no canvas!",
        placement: "right",
        animation: "dance",
      },
      {
        id: "form-editor-canvas-step",
        targetSelector: "[data-tutorial='form-editor-canvas']",
        title: "🎨 Espaço de Criação e Organização",
        description: "Esta é a sua área de trabalho! Aqui você visualiza as perguntas da sua ficha exatamente como elas vão se comportar. Você pode arrastar as perguntas para mudar a ordem, expandir ou fechar seções e clicar em qualquer item para ajustá-lo com calma.",
        tip: "💡 Se estiver no tablet ou celular, basta tocar e segurar um card para selecionar e reorganizar com facilidade.",
        placement: "left",
        animation: "pulse",
      },
      {
        id: "form-editor-modes-step",
        targetSelector: "[data-tutorial='form-editor-mode-toggle']",
        title: "🎮 Modo Editor e Teste em Tempo Real",
        description: "Você pode alternar entre o Modo Editor (onde você monta e ajusta as perguntas) e o Modo Testar Preenchimento. No modo de teste, você simula a experiência real de responder as perguntas como se já estivesse na consulta, sem gravar nada no prontuário!",
        tip: "💡 Vale muito a pena fazer uma simulação de teste para ter certeza de que o fluxo de perguntas ficou bem confortável para o seu dia a dia.",
        placement: "bottom",
        animation: "bounce",
      },
      {
        id: "form-editor-history-step",
        targetSelector: "[data-tutorial='form-editor-history-actions']",
        title: "↩️ Histórico Seguro e Edição Tranquila",
        description: "Pode criar e experimentar sem medo de errar! Se você mudar de ideia, use o Desfazer (Ctrl+Z) para voltar atrás ou o Refazer (Ctrl+Y) para restaurar. E com o Selecionar Todos (Ctrl+A), você move ou duplica vários blocos de uma vez só.",
        visualPreview: {
          type: "keyboard-shortcuts",
          shortcuts: [
            { keys: ["Ctrl", "Z"], label: "Desfazer alteração" },
            { keys: ["Ctrl", "Y"], label: "Refazer alteração" },
            { keys: ["Ctrl", "A"], label: "Selecionar todos os campos" },
          ],
        },
        tip: "💡 Fique em paz: se a aba do navegador fechar sem querer, o sistema guarda um rascunho automático para você não perder nada!",
        placement: "bottom",
        animation: "glow",
      },
      {
        id: "form-editor-flow-step",
        targetSelector: "[data-tutorial='form-editor-inspector-flow']",
        title: "🗂️ Aba Fluxo: Visão Geral da Estrutura",
        description: "Aqui na lateral direita, a aba Fluxo mostra toda a árvore da sua ficha de forma limpa e estruturada. É o lugar mais prático para mover perguntas de lugar usando as setinhas para cima e para baixo ou mover blocos para dentro de seções.",
        tip: "💡 Você também pode acompanhar o contador de capacidade da ficha para manter sua avaliação leve e rápida de preencher.",
        placement: "left",
        animation: "pulse",
      },
      {
        id: "form-editor-props-step",
        targetSelector: "[data-tutorial='form-editor-inspector-props']",
        title: "⚙️ Aba Propriedades: Personalize os Detalhes",
        description: "Ao clicar em qualquer pergunta da ficha, esta aba se abre para você ajustar o título, colocar exemplos de preenchimento, escolher se o campo é obrigatório e até definir regras lógicas para exibir perguntas apenas quando necessário.",
        tip: "💡 Experimente colocar cores de destaque nas seções para deixar sua ficha com a identidade visual da sua clínica!",
        placement: "left",
        animation: "dance",
      },
      {
        id: "form-editor-save-step",
        targetSelector: "[data-tutorial='form-editor-actions']",
        title: "💾 Salvar e Disponibilizar para a Equipe",
        description: "Quando sua ficha estiver prontinha, basta clicar em Salvar Ficha para que ela fique imediatamente disponível para toda a equipe utilizar nos atendimentos. Você também pode exportar ou importar modelos compartilhados por outros colegas!",
        learnMoreAction: {
          label: "Quer ver como as fichas são preenchidas durante o atendimento?",
          actionType: "navigate_chapter",
          targetId: "registro-sessao",
        },
        placement: "top",
        animation: "glow",
      },
    ],
  },
];

export type ComponentHelpEntry = TutorialStep | TutorialStep[];

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
      title: "🏠 Espaço Pessoal — Objetivo & Visão Geral",
      description: "Seu hub profissional independente. Aqui você gerencia todas as clínicas onde atua, visualiza estatísticas consolidadas e configura seus dados cadastrais e de segurança.",
      tip: "💡 Veja a seguir os principais recursos disponíveis no seu espaço pessoal!",
      placement: "bottom",
      animation: "glow",
    },
    {
      id: "help-personal-theme",
      targetSelector: "[data-tutorial='personal-theme-switch']",
      title: "Alternador de Tema (Claro / Escuro) 🌓",
      description: "Permite alternar a interface entre os modos Claro e Escuro para maior conforto visual durante seus atendimentos em qualquer ambiente.",
      placement: "bottom",
      animation: "bounce",
    },
    {
      id: "help-personal-account",
      targetSelector: "[data-tutorial='personal-account-btn']",
      title: "Perfil Pessoal & Segurança MFA 🔐",
      description: "Acesse suas informações cadastrais (CREFITO, e-mail, telefone) e configure a autenticação em duas etapas para proteger seus acessos.",
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
      targetSelector: "[data-tutorial='session-carelines']",
      title: "🏷️ Linhas de Cuidado & Queixas Clínicas — Objetivo Clínico",
      description: "Organiza o histórico de atendimentos por sintomas ou queixas clínicas (ex: Lombalgia, Pós-operatório), permitindo acompanhar a evolução isolada de cada diagnóstico.",
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
      description: "Seus dados cadastrais como pessoa física (Nome completo, Nome social, CPF, Foto e E-mail global). Permanecem com você em qualquer clínica onde atue.",
      placement: "bottom",
      animation: "glow",
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

  "settings-treasury-block": [
    {
      id: "help-settings-treasury-guide",
      targetSelector: "[data-tutorial='settings-treasury-card']",
      title: "💳 Tesouraria & Configurações Financeiras",
      description: "Configure chaves Pix da clínica, contas bancárias padrão, regras de parcelamento de pacotes e modelos de recibos.",
      requiredPermission: "treasury.manage",
      visualPreview: { type: "payment-status" },
      placement: "bottom",
      animation: "glow",
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

/**
 * Registry dictionary keyed by chapter id for quick lookups.
 */
export const TUTORIAL_REGISTRY: Record<string, PageTutorialConfig> = TUTORIAL_CHAPTERS.reduce(
  (acc, chapter) => {
    acc[chapter.id] = {
      pageId: chapter.id,
      title: chapter.title,
      description: chapter.description,
      badge: chapter.badge,
      steps: chapter.steps,
    };
    return acc;
  },
  {} as Record<string, PageTutorialConfig>
);

/**
 * Helper to match a current browser URL path to the best corresponding chapter.
 */
export function getTutorialConfigForPath(pathname: string): PageTutorialConfig | null {
  const cleanPath = pathname.replace(/^\/designlabs?/, "");

  if (cleanPath === "" || cleanPath === "/" || cleanPath.startsWith("/espacopessoal") || cleanPath.startsWith("/selecionar-clinica")) {
    return TUTORIAL_REGISTRY["espaco-pessoal"];
  }
  if (cleanPath.includes("/configuracoes/formularios/")) {
    return TUTORIAL_REGISTRY["editor-formularios"] || TUTORIAL_REGISTRY["dashboard-configuracoes"];
  }
  if (cleanPath.endsWith("/configuracoes") || cleanPath.includes("/configuracoes")) {
    return TUTORIAL_REGISTRY["dashboard-configuracoes"];
  }
  if (cleanPath.includes("/dashboard")) {
    return TUTORIAL_REGISTRY["dashboard-configuracoes"];
  }
  if (cleanPath.includes("/pacientes/novo")) {
    return TUTORIAL_REGISTRY["novo-paciente"];
  }
  if (cleanPath.includes("/sessao/")) {
    return TUTORIAL_REGISTRY["registro-sessao"];
  }
  if (cleanPath.includes("/pacientes/")) {
    return TUTORIAL_REGISTRY["prontuario-paciente"];
  }
  if (cleanPath.startsWith("/clinica/")) {
    return TUTORIAL_REGISTRY["home-clinica"];
  }

  return TUTORIAL_REGISTRY["home-clinica"] || null;
}
