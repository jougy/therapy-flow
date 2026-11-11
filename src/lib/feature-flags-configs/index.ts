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

export interface SystemHelpersConfig {
  enabled?: boolean;
  activeHelperKeys: string[];
  customTooltips: Record<string, string>;
}

export const DEFAULT_SYSTEM_HELPERS_CONFIG: SystemHelpersConfig = {
  enabled: true,
  activeHelperKeys: [
    "dashboard_stats",
    "patient_status_filter",
    "anamnesis_drag_drop",
    "evolution_soap_fields",
    "session_timeline_navigation",
    "document_security_hash",
  ],
  customTooltips: {},
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

// --- FLAGS: AGENDA ---

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
