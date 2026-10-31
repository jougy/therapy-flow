export type FeatureFlagCategory = 
  | 'Governança'
  | 'Storage/Arquivos'
  | 'Notificações'
  | 'Dashboards'
  | 'Formulários'
  | 'Prontuário/Atendimentos'
  | 'Impressão'
  | 'UI/Experiência'
  | 'Tutoriais & Ajuda'
  | 'Assinaturas'
  | 'Agenda';

export interface FeatureFlagDefinition {
  key: string;
  label: string;
  description: string;
  category: FeatureFlagCategory;
  hasConfiguration: boolean;
  hasToggle?: boolean;
}

export const featureFlagsCatalog: FeatureFlagDefinition[] = [
  // Agenda da Clínica
  {
    key: 'agenda_module',
    label: 'Módulo da Agenda Clínica',
    description: 'Controla a exibição e funcionamento global da agenda clínica (/clinica/:clinicKey/agenda), widget na home e atalhos rápidos de compromissos.',
    category: 'Agenda',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'agenda_night_dawn_shift',
    label: 'Turno de Madrugada (00h00 às 06h59)',
    description: 'Habilita o 4º bloco de horários na visão diária e semanal cobrindo as 24 horas contínuas sem lacunas (Madrugada 00:00–06:59).',
    category: 'Agenda',
    hasConfiguration: false,
    hasToggle: true,
  },
  {
    key: 'agenda_conflict_warning',
    label: 'Alerta de Conflitos e Sobreposições em Tempo Real',
    description: 'Exibe banner de aviso em tempo real no modal de agendamento ao selecionar horários que colidem com outros compromissos ativos do dia.',
    category: 'Agenda',
    hasConfiguration: false,
    hasToggle: true,
  },
  {
    key: 'agenda_slot_condenser',
    label: 'Motor de Blocos Condensados de Horários Livres',
    description: 'Agrupa lacunas contíguas de horários disponíveis em botões compactos de agendamento direto com um clique, substituindo colunas extensas vazias.',
    category: 'Agenda',
    hasConfiguration: false,
    hasToggle: true,
  },
  {
    key: 'agenda_master_onboarding',
    label: 'Agenda Master de Onboarding (Backoffice)',
    description: 'Agendamentos estratégicos de demonstração, onboarding e alinhamento de clínicas com a equipe Pluri Health.',
    category: 'Agenda',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'agenda_whatsapp_booking_flow',
    label: 'Agendamento Interativo via Bot WhatsApp',
    description: 'Fluxo interativo conversacional no WhatsApp para marcação automatizada de consultas e reuniões.',
    category: 'Agenda',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'agenda_google_calendar_sync',
    label: 'Sincronização em Tempo Real com Google Calendar (iCal)',
    description: 'Integração bidirecional e feed iCal com o Google Calendar e calendários externos.',
    category: 'Agenda',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'agenda_smart_blocks_buffers',
    label: 'Bloqueios Inteligentes & Margem de Segurança (Buffers)',
    description: 'Intervalos automáticos de respiro entre atendimentos, bloqueio de almoço e descansos programados.',
    category: 'Agenda',
    hasConfiguration: true,
    hasToggle: true,
  },
  // Assinaturas & Financeiro
  {
    key: 'subscriptions_module',
    label: 'Módulo de Assinaturas e Cobrança',
    description: 'Controla a exibição e funcionamento global do sistema de faturamento recorrente, catálogo de planos (/planos), checkout e faturamento.',
    category: 'Assinaturas',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'subscription_free_trial_enabled',
    label: 'Teste Gratuito (Free Tier / Trial)',
    description: 'Habilita o período e cota de teste gratuito no onboarding e seleção de planos sem exigir cartão de crédito inicial.',
    category: 'Assinaturas',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'subscription_payment_methods',
    label: 'Métodos de Pagamento (PIX, Cartão, Boleto)',
    description: 'Configura e habilita os métodos de pagamento suportados no checkout com as respectivas regras de desconto e parcelamento.',
    category: 'Assinaturas',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'subscription_coupons_enabled',
    label: 'Cupons de Desconto Promocionais',
    description: 'Habilita a validação e aplicação de cupons promocionais na página de planos e no checkout oficial da plataforma.',
    category: 'Assinaturas',
    hasConfiguration: true,
    hasToggle: true,
  },
  // Storage/Arquivos
  {
    key: 'storage_s3_integration',
    label: 'Anexo de Arquivos & Mídias (Storage)',
    description: 'Habilita o módulo de anexo de documentos, PDFs e imagens clínicas de pacientes e atendimentos.',
    category: 'Storage/Arquivos',
    hasConfiguration: true,
  },
  
  // Notificações (Adicionado para preencher a categoria, caso hajam features futuras ou para o lab)
  {
    key: 'notifications_email_sms',
    label: 'Notificações por Email/SMS',
    description: 'Habilita o envio de lembretes e notificações transacionais aos pacientes via Email e SMS.',
    category: 'Notificações',
    hasConfiguration: true,
  },
  {
    key: 'notifications_whatsapp_onboarding',
    label: 'WhatsApp: Boas-Vindas & Onboarding Automático',
    description: 'Disparo automático de boas-vindas, orientações iniciais e link de primeiro acesso para novos usuários via WhatsApp.',
    category: 'Notificações',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'notifications_whatsapp_transbordo',
    label: 'WhatsApp: Transbordo para Comercial Humano',
    description: 'Roteamento inteligente e transbordo de leads e clientes com dúvidas para o atendimento comercial humano oficial.',
    category: 'Notificações',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'notifications_whatsapp_billing',
    label: 'WhatsApp: Confirmação de Assinaturas & Upgrade (Asaas)',
    description: 'Notificações automáticas de confirmação de pagamento, liberação de planos e avisos de renovação/upgrade via Asaas.',
    category: 'Notificações',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'notifications_telegram_admin',
    label: 'Telegram: Alertas em Tempo Real do Administrador',
    description: 'Canal de telemetria e bot do Telegram para a diretoria receber eventos críticos (novos cadastros, pagamentos e incidentes).',
    category: 'Notificações',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'whatsapp_flows_enabled',
    label: 'WhatsApp Flows (Formulários Nativos Deslizantes)',
    description: 'Ativa o preenchimento interativo de fichas e triagem via WhatsApp Flows nativo deslizante da Meta, com fallback inteligente para chat.',
    category: 'Notificações',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'notifications_patient_reminders',
    label: 'Lembretes de Consultas e Atendimentos (WhatsApp/SMS)',
    description: 'Envio programado de confirmação e lembretes de sessões para pacientes com antecedência configurável.',
    category: 'Notificações',
    hasConfiguration: true,
    hasToggle: true,
  },

  // Dashboards
  {
    key: 'dashboards_general',
    label: 'Dashboard Geral',
    description: 'Habilita a visualização do painel de métricas e gráficos gerais da clínica.',
    category: 'Dashboards',
    hasConfiguration: false,
  },
  {
    key: 'dashboards_user',
    label: 'Dashboard do Usuário',
    description: 'Habilita a área de métricas individuais para o profissional (usuário logado).',
    category: 'Dashboards',
    hasConfiguration: false,
  },
  {
    key: 'dashboards_patient',
    label: 'Dashboard do Paciente',
    description: 'Habilita gráficos de evolução e sumário de dados no perfil do paciente.',
    category: 'Dashboards',
    hasConfiguration: true,
  },

  // Formulários
  {
    key: 'forms_creator',
    label: 'Criador de Formulários',
    description: 'Ativa o módulo de criação dinâmica de formulários (anamnese, evolução, etc).',
    category: 'Formulários',
    hasConfiguration: false,
  },
  {
    key: 'forms_editor',
    label: 'Editor de Formulários',
    description: 'Controla a disponibilidade de componentes da paleta, propriedades dos campos, menus do editor e opções interativas no construtor de formulários.',
    category: 'Formulários',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'forms_download_upload',
    label: 'Permissões de Download/Upload em Formulários',
    description: 'Permite que formulários preenchidos possam ser baixados em PDF ou anexem arquivos.',
    category: 'Formulários',
    hasConfiguration: true,
  },

  // Prontuário/Atendimentos
  {
    key: 'records_summary_blocks',
    label: 'Configuração de Blocos de Resumo',
    description: 'Permite customizar e ordenar os blocos de resumo exibidos na tela principal do prontuário.',
    category: 'Prontuário/Atendimentos',
    hasConfiguration: true,
  },
  {
    key: 'clinic_sessions_list',
    label: 'Lista Geral de Atendimentos',
    description: 'Habilita a visualização da lista geral de atendimentos na página principal da clínica, com opções avançadas de edição.',
    category: 'Prontuário/Atendimentos',
    hasConfiguration: true,
  },

  // Impressão & Segurança
  {
    key: 'anti_print_protection',
    label: 'Proteção Anti-Print Screen (Captura de Tela)',
    description: 'Bloqueia atalhos de captura de tela, desfoca a página e registra auditoria com selo de data/hora no Backoffice para rotas protegidas.',
    category: 'Impressão',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'print_general',
    label: 'Permitir Impressões no Sistema (Opção Global)',
    description: 'Habilita ou desabilita globalmente todas as rotinas e botões de impressão em papel e exportação física na plataforma.',
    category: 'Impressão',
    hasConfiguration: false,
  },
  {
    key: 'print_clinic_stats',
    label: 'Impressão de Estatísticas da Clínica',
    description: 'Exibe ou oculta o botão de impressão personalizada de relatórios e blocos de estatísticas da clínica.',
    category: 'Impressão',
    hasConfiguration: false,
  },
  {
    key: 'forms_blank_print',
    label: 'Impressão de Fichas em Branco (Kit Offline)',
    description: 'Exibe ou oculta o botão de impressão de modelos e fichas de atendimento/cadastro em branco no gerenciador de formulários da clínica.',
    category: 'Impressão',
    hasConfiguration: false,
  },
  {
    key: 'records_print_layout',
    label: 'Layout de Impressão do Prontuário',
    description: 'Habilita configurações avançadas de layout (cabeçalho, rodapé, logo) para impressão do prontuário.',
    category: 'Impressão',
    hasConfiguration: true,
  },
  {
    key: 'records_session_print',
    label: 'Impressão de Documentos de Atendimento',
    description: 'Exibe ou oculta a opção de impressão de atestados, receitas, declarações e evoluções de atendimentos.',
    category: 'Impressão',
    hasConfiguration: false,
  },

  // Governança & Compliance
  {
    key: 'terms_of_service_management',
    label: 'Termos de Uso e Consentimento',
    description: 'Gerenciamento dos Termos de Uso (Owner/Usuários, BR e Internacional, Responsabilidade de Impressão, Menor de Idade LGPD) e disparo de obrigatoriedade.',
    category: 'Governança',
    hasConfiguration: true,
    hasToggle: false,
  },
  {
    key: 'require_owner_terms_on_clinic_creation',
    label: 'Exigir Termos de Consentimento do Titular na Criação de Clínica',
    description: 'Exige o consentimento explícito dos Termos de Uso e Responsabilidade do Titular antes de criar um novo espaço.',
    category: 'Governança',
    hasConfiguration: false,
    hasToggle: true,
  },
  {
    key: 'observability_multicloud_engine',
    label: 'Motor de Telemetria Multicloud & Proteção de Disk I/O (10k+ CCU)',
    description: 'Controla o roteamento da matriz canônica de tempo por tela (Upstash Redis / Buffer Local / Supabase Batch), ingestão de erros (Axiom 500GB Free / Buffer Local), sanitizador LGPD Zero-PHI e taxa de amostragem para alta escala.',
    category: 'Governança',
    hasConfiguration: true,
    hasToggle: true,
  },
  {
    key: 'ui_animations_toggle',
    label: 'Ligar/Desligar Animações UI',
    description: 'Habilita opções para o usuário final reduzir ou desligar micro-animações do sistema.',
    category: 'UI/Experiência',
    hasConfiguration: false,
  },
  {
    key: 'ui_advanced_settings',
    label: 'Configurações Avançadas de UI',
    description: 'Libera temas extras e opções de densidade visual na interface da plataforma.',
    category: 'UI/Experiência',
    hasConfiguration: true,
  },
  {
    key: 'clinical_portfolio_enabled',
    label: 'Portfólio Clínico Profissional (Acervo Pessoal)',
    description: 'Habilita o acervo técnico seguro e o histórico de atendimentos realizados sob a responsabilidade do profissional no Espaço Pessoal (/espacopessoal).',
    category: 'UI/Experiência',
    hasConfiguration: true,
    hasToggle: true,
  },

  // Tutoriais & Ajuda
  {
    key: 'tutorial_training_center',
    label: 'Central de Treinamento & Mini Cursos',
    description: 'Habilita o botão de Guia/Tutorial, a Central de Treinamento com mini cursos em capítulos e o assistente de jornada linear.',
    category: 'Tutoriais & Ajuda',
    hasConfiguration: false,
    hasToggle: true,
  },
  {
    key: 'system_helpers',
    label: 'Botões de Ajuda Rápida & Helpers Contextuais (?)',
    description: 'Controla a exibição dos botões de interrogação (?) com explicações contextuais por página, permitindo ocultar/exibir itens e editar as mensagens de ajuda.',
    category: 'Tutoriais & Ajuda',
    hasConfiguration: true,
    hasToggle: true,
  },
];

export interface FormEditorFlagConfig {
  enabled?: boolean;
  components: {
    // Básicos
    short_text: boolean;
    long_text: boolean;
    simple_list: boolean;
    number: boolean;
    date: boolean;
    // Opções & Seleção
    select: boolean;
    multiple_choice: boolean;
    checklist: boolean;
    tags: boolean;
    slider: boolean;
    // Estrutura & Agrupamento
    section: boolean;
    horizontal_section: boolean;
    section_selector: boolean;
    radar_section: boolean;
    // Especiais
    table: boolean;
    address_block: boolean;
    calculated: boolean;
  };
  properties: {
    required: boolean;
    showInPatientList: boolean;
    includeInGlobalDashboard: boolean;
    enableFilter: boolean;
    enableGrouping: boolean;
  };
  menus: {
    palette_sidebar: boolean;
    flow: boolean;
    properties: boolean;
    settings: boolean;
    design: boolean;
    logic: boolean;
  };
  options: {
    // Opções do Fluxo
    flow_reorder: boolean;
    flow_duplicate: boolean;
    flow_delete: boolean;
    flow_move_root: boolean;
    // Opções de Ajustes
    settings_field_type: boolean;
    settings_label: boolean;
    settings_help_text: boolean;
    settings_placeholder: boolean;
    settings_advanced_options: boolean;
    // Opções de Design
    design_accent_color: boolean;
    design_section_color: boolean;
    design_color_palette: boolean;
    design_action_buttons: boolean;
    // Opções de Regras (Lógica / Comportamento)
    logic_parent_section: boolean;
    logic_conditional_visibility: boolean;
  };
}

export const DEFAULT_FORM_EDITOR_FLAG_CONFIG: FormEditorFlagConfig = {
  enabled: true,
  components: {
    short_text: true,
    long_text: true,
    simple_list: true,
    number: true,
    date: true,
    select: true,
    multiple_choice: true,
    checklist: true,
    tags: true,
    slider: true,
    section: true,
    horizontal_section: true,
    section_selector: true,
    radar_section: true,
    table: true,
    address_block: true,
    calculated: true,
  },
  properties: {
    required: true,
    showInPatientList: true,
    includeInGlobalDashboard: true,
    enableFilter: true,
    enableGrouping: true,
  },
  menus: {
    palette_sidebar: true,
    flow: true,
    properties: true,
    settings: true,
    design: true,
    logic: true,
  },
  options: {
    flow_reorder: true,
    flow_duplicate: true,
    flow_delete: true,
    flow_move_root: true,
    settings_field_type: true,
    settings_label: true,
    settings_help_text: true,
    settings_placeholder: true,
    settings_advanced_options: true,
    design_accent_color: true,
    design_section_color: true,
    design_color_palette: true,
    design_action_buttons: true,
    logic_parent_section: true,
    logic_conditional_visibility: true,
  },
};

export interface AgendaFlagConfig {
  enabled?: boolean;
  allowedViews: {
    day: boolean;
    week: boolean;
    month: boolean;
    year: boolean;
  };
  defaultView: "day" | "week" | "month" | "year";
  defaultDurationMinutes: number;
  enableDawnShift: boolean;
  enableConflictWarning: boolean;
  enableCondensedSlots: boolean;
  showEndTimeOnCards: boolean;
  showSpanningBadges: boolean;
  maintenanceMessage?: string;
}

export const DEFAULT_AGENDA_FLAG_CONFIG: AgendaFlagConfig = {
  enabled: true,
  allowedViews: {
    day: true,
    week: true,
    month: true,
    year: true,
  },
  defaultView: "day",
  defaultDurationMinutes: 50,
  enableDawnShift: true,
  enableConflictWarning: true,
  enableCondensedSlots: true,
  showEndTimeOnCards: true,
  showSpanningBadges: true,
  maintenanceMessage: "",
};

// --- NOVAS FLAGS: NOTIFICAÇÕES ---

export interface WhatsAppOnboardingFlagConfig {
  enabled?: boolean;
  delaySeconds: number;
  botPhoneNumber: string;
  welcomeMessageTemplate: string;
  sendFirstAccessLink: boolean;
  notifyOnWeekend: boolean;
}

export const DEFAULT_WHATSAPP_ONBOARDING_FLAG_CONFIG: WhatsAppOnboardingFlagConfig = {
  enabled: true,
  delaySeconds: 15,
  botPhoneNumber: "5511980113936",
  welcomeMessageTemplate: "Olá {{nome}}! Seja muito bem-vindo(a) ao Pluri Health. Seu espaço clínico seguro já está pronto para uso: {{link_acesso}}",
  sendFirstAccessLink: true,
  notifyOnWeekend: false,
};

export interface WhatsAppTransbordoFlagConfig {
  enabled?: boolean;
  destinationPhoneNumber: string;
  alertTypes: {
    suporte: boolean;
    novos_agendamentos: boolean;
    duvidas_planos: boolean;
    reclamacoes: boolean;
  };
  officeHoursOnly: boolean;
  fallbackMessage: string;
}

export const DEFAULT_WHATSAPP_TRANSBORDO_FLAG_CONFIG: WhatsAppTransbordoFlagConfig = {
  enabled: true,
  destinationPhoneNumber: "5511980113936",
  alertTypes: {
    suporte: true,
    novos_agendamentos: true,
    duvidas_planos: true,
    reclamacoes: true,
  },
  officeHoursOnly: false,
  fallbackMessage: "Entendido! Estou transferindo seu atendimento para o nosso especialista humano. Em instantes você será atendido.",
};

export interface WhatsAppBillingFlagConfig {
  enabled?: boolean;
  thankYouMessageTemplate: string;
  systemLoginLink: string;
  notifyUpgrade: boolean;
  notifySubscriptionRenew: boolean;
  notifyPaymentFailed: boolean;
}

export const DEFAULT_WHATSAPP_BILLING_FLAG_CONFIG: WhatsAppBillingFlagConfig = {
  enabled: true,
  thankYouMessageTemplate: "Olá {{nome}}, confirmamos com sucesso a sua assinatura do plano {{plano}} via Asaas! Obrigado por confiar no Pluri Health.",
  systemLoginLink: "https://plurihealth.com.br/login",
  notifyUpgrade: true,
  notifySubscriptionRenew: true,
  notifyPaymentFailed: true,
};

export interface TelegramAdminFlagConfig {
  enabled?: boolean;
  botTokenConfigured?: boolean;
  chatId: string;
  events: {
    newRegistrations: boolean;
    newBookings: boolean;
    asaasPayments: boolean;
    errorAlerts: boolean;
  };
  silentNotifications: boolean;
}

export const DEFAULT_TELEGRAM_ADMIN_FLAG_CONFIG: TelegramAdminFlagConfig = {
  enabled: true,
  botTokenConfigured: true,
  chatId: "-100234567890",
  events: {
    newRegistrations: true,
    newBookings: true,
    asaasPayments: true,
    errorAlerts: true,
  },
  silentNotifications: false,
};

export interface PatientRemindersFlagConfig {
  enabled?: boolean;
  channels: {
    whatsapp: boolean;
    sms: boolean;
    email: boolean;
  };
  remind24hBefore: boolean;
  remind2hBefore: boolean;
  allowPatientConfirmation: boolean;
  reminderMessageTemplate: string;
}

export const DEFAULT_PATIENT_REMINDERS_FLAG_CONFIG: PatientRemindersFlagConfig = {
  enabled: true,
  channels: {
    whatsapp: true,
    sms: false,
    email: true,
  },
  remind24hBefore: true,
  remind2hBefore: true,
  allowPatientConfirmation: true,
  reminderMessageTemplate: "Olá {{paciente}}, lembramos de sua consulta agendada para {{data_hora}} com {{profissional}}. Responda 1 para confirmar ou 2 para remarcar.",
};

export interface WhatsAppFlowsConfig {
  enabled: boolean;
  flow_id: string;
  fallback_to_chat: boolean;
  mode: 'draft' | 'published';
}

export const DEFAULT_WHATSAPP_FLOWS_CONFIG: WhatsAppFlowsConfig = {
  enabled: false,
  flow_id: '',
  fallback_to_chat: true,
  mode: 'draft',
};

// --- NOVAS FLAGS: AGENDA ---

export interface AgendaMasterFlagConfig {
  enabled?: boolean;
  defaultDurationMinutes: number;
  meetingRoomUrl: string;
  allowLeadReschedule: boolean;
  sendCalendarInvite: boolean;
  sendWhatsAppConfirmation: boolean;
}

export const DEFAULT_AGENDA_MASTER_FLAG_CONFIG: AgendaMasterFlagConfig = {
  enabled: true,
  defaultDurationMinutes: 15,
  meetingRoomUrl: "https://meet.google.com/pluri-onboarding",
  allowLeadReschedule: true,
  sendCalendarInvite: true,
  sendWhatsAppConfirmation: true,
};

export interface AgendaWhatsAppBookingFlagConfig {
  enabled?: boolean;
  startHour: string;
  endHour: string;
  workDays: ("seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom")[];
  intervalMinutes: number;
  autoConfirmBooking: boolean;
}

export const DEFAULT_AGENDA_WHATSAPP_BOOKING_FLAG_CONFIG: AgendaWhatsAppBookingFlagConfig = {
  enabled: true,
  startHour: "08:00",
  endHour: "18:00",
  workDays: ["seg", "ter", "qua", "qui", "sex"],
  intervalMinutes: 30,
  autoConfirmBooking: true,
};

export interface AgendaGoogleCalendarSyncFlagConfig {
  enabled?: boolean;
  iCalFeedUrl: string;
  cacheDurationMinutes: number;
  syncReminders: boolean;
  autoSyncIntervalMinutes: number;
}

export const DEFAULT_AGENDA_GOOGLE_CALENDAR_SYNC_FLAG_CONFIG: AgendaGoogleCalendarSyncFlagConfig = {
  enabled: true,
  iCalFeedUrl: "https://calendar.google.com/calendar/ical/plurihealth/public/basic.ics",
  cacheDurationMinutes: 15,
  syncReminders: true,
  autoSyncIntervalMinutes: 30,
};

export interface AgendaSmartBlocksBuffersFlagConfig {
  enabled?: boolean;
  defaultBufferMinutes: number;
  blockThursdayMorning: boolean;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  enforceBreakBetweenPatients: boolean;
}

export const DEFAULT_AGENDA_SMART_BLOCKS_BUFFERS_FLAG_CONFIG: AgendaSmartBlocksBuffersFlagConfig = {
  enabled: true,
  defaultBufferMinutes: 30,
  blockThursdayMorning: true,
  lunchBreakStart: "12:00",
  lunchBreakEnd: "13:00",
  enforceBreakBetweenPatients: true,
};


