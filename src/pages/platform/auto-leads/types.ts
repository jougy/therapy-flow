export type AutoLeadIcpTier =
  | "clinic_owner"
  | "solo_physio"
  | "studio_pilates"
  | "student"
  | "other";

export type AutoLeadSourcePlatform =
  | "facebook_group"
  | "instagram"
  | "google_maps"
  | "lindy_agent"
  | "apify_direct"
  | "csv_import"
  | "whatsapp_inbound";

export type AutoLeadStage =
  | "new"
  | "qualified"
  | "assigned"
  | "contacted"
  | "replied"
  | "meeting_scheduled"
  | "converted_trial"
  | "discarded";

export type AutoLeadMeetingStatus =
  | "none"
  | "attempted_bot"
  | "handed_off_commercial"
  | "scheduled"
  | "rescheduled"
  | "completed"
  | "canceled"
  | "no_show";

export type AutoLeadChannel =
  | "whatsapp_bot_5511960474566"
  | "whatsapp_commercial_5511980113936"
  | "backoffice_agenda";

export type SubagentRole =
  | "fb_group_intent_hunter"
  | "cross_channel_enricher"
  | "lindy_sdr_qualifier"
  | "full_pipeline";

export interface PlatformAutoLead {
  id: string;
  routine_id?: string | null;
  full_name: string;
  phone?: string | null;
  normalized_phone_key?: string | null;
  email?: string | null;
  instagram_handle?: string | null;
  facebook_profile_url?: string | null;
  facebook_group_name?: string | null;
  facebook_group_url?: string | null;
  linkedin_url?: string | null;
  website_url?: string | null;
  city?: string | null;
  state?: string | null;
  clinic_name?: string | null;
  specialty?: string | null;
  icp_tier: AutoLeadIcpTier;
  source_platform: AutoLeadSourcePlatform;
  source_post_url?: string | null;
  source_post_excerpt?: string | null;
  ai_score: number;
  ai_qualification_summary?: string | null;
  ai_icebreaker_message?: string | null;
  subagent_captured_by?: string | null;
  stage: AutoLeadStage;
  assigned_affiliate_id?: string | null;
  assigned_at?: string | null;
  converted_clinic_id?: string | null;
  meeting_id?: string | null;
  meeting_status: AutoLeadMeetingStatus;
  meeting_scheduled_at?: string | null;
  meeting_duration_minutes?: number | null;
  meeting_channel?: AutoLeadChannel | null;
  meeting_booked_by?: string | null;
  last_scheduling_attempt_at?: string | null;
  scheduling_attempt_summary?: string | null;
  external_lead_key: string;
  apify_run_id?: string | null;
  lindy_task_id?: string | null;
  notes?: string | null;
  last_contacted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutoLeadRoutineTargetGroup {
  name: string;
  url: string;
}

export interface AutoLeadRoutine {
  id: string;
  name: string;
  description?: string | null;
  subagent_role: SubagentRole;
  apify_actor_id: string;
  target_groups: AutoLeadRoutineTargetGroup[];
  search_keywords: string[];
  enable_cross_enrichment: boolean;
  enable_lindy_qualification: boolean;
  schedule_cron: string;
  frequency_label: string;
  min_score_auto_assign: number;
  auto_assign_affiliate_id?: string | null;
  is_active: boolean;
  last_run_at?: string | null;
  last_run_status: "idle" | "running_apify" | "enriching_lindy" | "succeeded" | "failed";
  total_leads_captured: number;
}

export interface AutoLeadRun {
  id: string;
  routine_id?: string | null;
  run_type: "subagent_routine" | "apify_scrape" | "lindy_webhook" | "csv_import";
  subagent_stage: string;
  status: "running" | "succeeded" | "failed" | "partial";
  external_run_id?: string | null;
  leads_found_count: number;
  leads_inserted_count: number;
  leads_updated_count: number;
  error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface AutoLeadAffiliateSummary {
  id: string;
  coupon_code?: string | null;
  referral_slug?: string | null;
  tier?: string | null;
  full_name: string;
}

export type AutoLeadSortField =
  | "selected"
  | "name"
  | "origin"
  | "score"
  | "agenda"
  | "stage_affiliate"
  | "has_whatsapp";

export type AutoLeadSortDirection = "asc" | "desc";

export interface AutoLeadSortState {
  field: AutoLeadSortField;
  direction: AutoLeadSortDirection;
}

export type AutoLeadPhoneFilter = "all" | "with_whatsapp" | "without_whatsapp";

export interface AutoLeadFilterState {
  search: string;
  stage: AutoLeadStage | "all";
  agendaFilter: "all" | "scheduled" | "attempted" | "none";
  minScore: "all" | "70" | "85";
  onlyWithPhone: boolean;
  phoneFilter: AutoLeadPhoneFilter;
  affiliateId: string;
}

export const WHATSAPP_BOT_PHONE = "5511960474566";
export const WHATSAPP_COMMERCIAL_PHONE = "5511980113936";

export const AUTO_LEAD_CHANNEL_LABELS: Record<AutoLeadChannel, string> = {
  whatsapp_bot_5511960474566: "WhatsApp Bot (+55 11 96047-4566)",
  whatsapp_commercial_5511980113936: "WhatsApp Comercial (+55 11 98011-3936)",
  backoffice_agenda: "Agenda Backoffice",
};

export const AUTO_LEAD_STAGE_META: Record<
  AutoLeadStage,
  { label: string; badgeClass: string }
> = {
  new: {
    label: "Novo Capturado",
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-300/60",
  },
  qualified: {
    label: "Qualificado IA",
    badgeClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-400/40",
  },
  assigned: {
    label: "Distribuído",
    badgeClass: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-400/40",
  },
  contacted: {
    label: "Abordado",
    badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-400/40",
  },
  replied: {
    label: "Respondeu",
    badgeClass: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-400/40",
  },
  meeting_scheduled: {
    label: "Reunião Marcada",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/50",
  },
  converted_trial: {
    label: "Converteu Trial",
    badgeClass: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400/50",
  },
  discarded: {
    label: "Descartado",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-400/40",
  },
};

export const AUTO_LEAD_MEETING_STATUS_META: Record<
  AutoLeadMeetingStatus,
  { label: string; badgeClass: string }
> = {
  none: {
    label: "Sem Tentativa",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
  attempted_bot: {
    label: "Tentou Agendar (Bot)",
    badgeClass: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400/50",
  },
  handed_off_commercial: {
    label: "Conversa Comercial",
    badgeClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-400/50",
  },
  scheduled: {
    label: "Reunião Agendada",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/50",
  },
  rescheduled: {
    label: "Remarcada",
    badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/50",
  },
  completed: {
    label: "Reunião Concluída",
    badgeClass: "bg-emerald-600/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/50",
  },
  canceled: {
    label: "Cancelada",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-400/40",
  },
  no_show: {
    label: "Não Compareceu",
    badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-400/40",
  },
};

export const SUBAGENT_ROLE_LABELS: Record<SubagentRole, string> = {
  fb_group_intent_hunter: "Subagente 1: FB Group Intent Hunter (Apify)",
  cross_channel_enricher: "Subagente 2: Cross-Channel Enricher (IG + Maps)",
  lindy_sdr_qualifier: "Subagente 3: Lindy AI SDR Qualifier",
  full_pipeline: "Pipeline Completo (3 Subagentes em Cadeia)",
};

export const DEFAULT_SEED_ROUTINES: AutoLeadRoutine[] = [
  {
    id: "11111111-1111-4111-8111-111111111001",
    name: "Subagente 1: Caçador de Intenção (Grupos FB Fisioterapia)",
    description: "Varre posts pedindo indicação de prontuário, agenda, gestão e software para fisioterapia.",
    subagent_role: "fb_group_intent_hunter",
    apify_actor_id: "apify/facebook-groups-scraper",
    target_groups: [
      { name: "Fisioterapia Brasil - Gestão e Clínica", url: "https://www.facebook.com/groups/fisioterapiabrasilgestao" },
      { name: "Donos de Clínicas de Fisioterapia", url: "https://www.facebook.com/groups/donosclinicasfisio" },
    ],
    search_keywords: ["sistema", "prontuário", "software", "agenda", "abrir clínica", "indicação"],
    enable_cross_enrichment: true,
    enable_lindy_qualification: true,
    schedule_cron: "0 8 * * *",
    frequency_label: "Diário às 08:00",
    min_score_auto_assign: 75,
    is_active: true,
    last_run_status: "idle",
    total_leads_captured: 0,
  },
  {
    id: "11111111-1111-4111-8111-111111111002",
    name: "Subagente 2: Mapeador Pilates & Ortopedia (Cross-Enrichment)",
    description: "Extrai perfis de grupos de Pilates e cruza com Instagram e Google Maps via Apify + Lindy AI.",
    subagent_role: "cross_channel_enricher",
    apify_actor_id: "apify/facebook-groups-scraper",
    target_groups: [
      { name: "Pilates Clínico & Estúdios Brasil", url: "https://www.facebook.com/groups/pilatesclinico" },
    ],
    search_keywords: ["pilates", "controle de alunos", "avaliação postural", "planilha", "whatsapp"],
    enable_cross_enrichment: true,
    enable_lindy_qualification: true,
    schedule_cron: "0 13 * * *",
    frequency_label: "Diário às 13:00",
    min_score_auto_assign: 70,
    is_active: true,
    last_run_status: "idle",
    total_leads_captured: 0,
  },
  {
    id: "11111111-1111-4111-8111-111111111003",
    name: "Subagente 3: Reconciliador de Agendas (Bot + Comercial)",
    description: "Monitora tentativas no Bot (+5511960474566) e Comercial (+5511980113936) e gera icebreakers.",
    subagent_role: "lindy_sdr_qualifier",
    apify_actor_id: "apify/facebook-groups-scraper",
    target_groups: [
      { name: "Reabilitação e Empreendedorismo em Saúde", url: "https://www.facebook.com/groups/empreendedorismofisio" },
    ],
    search_keywords: ["consultório", "atendimento domiciliar", "evolução", "assinatura digital"],
    enable_cross_enrichment: true,
    enable_lindy_qualification: true,
    schedule_cron: "0 */6 * * *",
    frequency_label: "A cada 6 horas",
    min_score_auto_assign: 65,
    is_active: true,
    last_run_status: "idle",
    total_leads_captured: 0,
  },
];
