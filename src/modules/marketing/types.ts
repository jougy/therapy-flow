/**
 * Pluri-Health Marketing & CRM Module Types
 * Modelos de dados e adaptadores para o CRM Polimórfico de Pacientes e Afiliados.
 */

export type CrmTargetType = 'patient' | 'affiliate_lead';

export type CrmStageKey = 'new' | 'active' | 'stalled' | 'grace_period' | 'churn';

export interface CrmMetricSummary {
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
}

export interface CrmContact {
  id: string;
  targetType: CrmTargetType;
  fullName: string;
  phone: string;
  email?: string;
  avatarUrl?: string;
  badgeLabel: string;
  stage: CrmStageKey;
  lastInteractionAt?: string;
  clinicalOrBusinessMetric: CrmMetricSummary;
  templateVariables: Record<string, string>;
}

export interface CrmInteractionLog {
  id: string;
  contactId: string;
  actionType: 'whatsapp_contact' | 'note' | 'stage_change' | 'churn_alert';
  content: string;
  createdAt: string;
  authorName?: string;
}

export interface CrmStageDefinition {
  key: CrmStageKey;
  label: string;
  colorClass: string;
}

export interface MarketingCrmAdapter {
  targetType: CrmTargetType;
  title: string;
  subtitle: string;
  stages: CrmStageDefinition[];
  contacts: CrmContact[];
  isLoading: boolean;
  onContactSelect?: (contact: CrmContact) => void;
  onStageChange?: (contactId: string, newStage: CrmStageKey) => Promise<void>;
  onAddNote?: (contactId: string, note: string) => Promise<void>;
}

export const DEFAULT_CRM_STAGES: CrmStageDefinition[] = [
  { key: 'new', label: 'Novos', colorClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { key: 'active', label: 'Em Contato', colorClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  { key: 'stalled', label: 'Pausado', colorClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  { key: 'grace_period', label: 'Em Carência', colorClass: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  { key: 'churn', label: 'Churn / Inativo', colorClass: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
];
