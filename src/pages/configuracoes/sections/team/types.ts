import type { Database } from "@/integrations/supabase/types";
import type { AccessCapability } from "@/lib/rbac";

export type SubaccountOperationalRole = "admin" | "professional" | "assistant" | "estagiario";
export type ClinicOperationalRoleDefinition = Database["public"]["Tables"]["clinic_operational_roles"]["Row"];
export type RoleCapabilityRow = Database["public"]["Tables"]["clinic_operational_role_capabilities"]["Row"];

export type PendingCollaboratorInvitation = {
  id: string;
  clinic_id: string;
  email: string;
  operational_role: SubaccountOperationalRole;
  job_title: string | null;
  specialty: string | null;
  status: "pending" | "accepted" | "cancelled" | "expired";
  created_at: string;
  expires_at: string;
  account_state: "registered_unconfirmed" | "registered_confirmed_pending_acceptance" | "invite_sent";
  pending_reason: string;
  last_resent_at?: string | null;
};

export type ActiveMember = {
  id: string;
  user_id: string;
  operational_role: SubaccountOperationalRole | "owner";
  membership_status: "active" | "suspended" | "inactive" | "invited" | string;
  is_active: boolean;
  created_at: string;
  full_name: string;
  email: string;
  job_title?: string | null;
  specialty?: string | null;
  working_hours?: string | null;
  last_seen_at?: string | null;
};

export { parseSpecialties } from "./components/SpecialtyTags";

export type ActiveSessionRow = {
  session_key: string;
  user_id: string;
  browser?: string;
  platform?: string;
  device_label?: string;
  last_seen_at?: string | null;
  full_name?: string;
  email?: string;
};

export type RolePermissionCategoryId = "all" | "clinical" | "agenda" | "team" | "admin" | "finance";
export type RolePermissionSwitchKind = "view" | "edit" | "delete" | "share" | "finance" | "print" | "manage";

export type RolePermissionAction = {
  kind: RolePermissionSwitchKind;
  capability: AccessCapability;
  label?: string;
};

export type RolePermissionItem = {
  category: RolePermissionCategoryId;
  description: string;
  details: string;
  key: string;
  title: string;
  actions: RolePermissionAction[];
};

export const OPERATIONAL_ROLE_LABELS: Record<string, string> = {
  admin: "Administrador(a)",
  professional: "Profissional",
  assistant: "Assistente",
  estagiario: "Estagiário(a)",
  owner: "Proprietário(a)",
};

export const OPERATIONAL_ROLE_DESCRIPTIONS: Record<SubaccountOperationalRole, string> = {
  admin: "Acompanha a equipe, ajusta acessos e gerencia configurações operacionais da clínica.",
  assistant: "Apoia a operação com pacientes e agenda, mas não entra nas áreas clínicas mais sensíveis.",
  estagiario: "Acesso mais restrito. Atua apenas no próprio fluxo de atendimentos e só vê/edita atendimentos criados por ele.",
  professional: "Fluxo clínico completo para pacientes e atendimentos, sem poderes administrativos da clínica.",
};

export const OPERATIONAL_ROLE_MANAGEMENT_ORDER: Array<SubaccountOperationalRole | "owner"> = [
  "owner",
  "admin",
  "professional",
  "assistant",
  "estagiario",
];

export const SYSTEM_OPERATIONAL_ROLE_DEFINITIONS: ClinicOperationalRoleDefinition[] = OPERATIONAL_ROLE_MANAGEMENT_ORDER.map((role, index) => ({
  base_operational_role: role,
  clinic_id: "",
  description: role === "owner" ? "Conta principal da clínica. Gestão irrestrita das diretrizes operacionais." : OPERATIONAL_ROLE_DESCRIPTIONS[role],
  is_system: true,
  label: OPERATIONAL_ROLE_LABELS[role],
  role_key: role,
  sort_order: index * 10,
}));

export const ROLE_PERMISSION_CATEGORIES: Array<{ id: RolePermissionCategoryId; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "clinical", label: "Clínico" },
  { id: "agenda", label: "Agenda" },
  { id: "team", label: "Equipe" },
  { id: "admin", label: "Administração" },
  { id: "finance", label: "Financeiro" },
];

export const ROLE_PERMISSION_ITEMS: RolePermissionItem[] = [
  // Clínico
  {
    category: "clinical",
    key: "patients",
    title: "Pacientes",
    description: "Cadastro, contato e dados operacionais dos pacientes.",
    details: "Controla visualização da lista e cadastro, edição de informações e exclusão de fichas de pacientes.",
    actions: [
      { kind: "view", capability: "patients.read", label: "Ver" },
      { kind: "edit", capability: "patients.write", label: "Editar" },
      { kind: "delete", capability: "patients.delete", label: "Excluir" },
    ],
  },
  {
    category: "clinical",
    key: "patients-groups",
    title: "Grupos de pacientes",
    description: "Criação, alteração e organização de grupos e categorias de pacientes.",
    details: "Controla o acesso à estrutura de grupos e marcadores para classificar pacientes.",
    actions: [
      { kind: "view", capability: "patients_groups.read", label: "Ver" },
      { kind: "edit", capability: "patients.manage_groups", label: "Editar" },
    ],
  },
  {
    category: "clinical",
    key: "sessions-own",
    title: "Atendimentos próprios",
    description: "Evolução, fichas clínicas e histórico dos próprios atendimentos.",
    details: "Controla o histórico clínico e preenchimento de evoluções dos atendimentos realizados pelo colaborador.",
    actions: [
      { kind: "view", capability: "sessions.read", label: "Ver" },
      { kind: "edit", capability: "sessions.write", label: "Editar" },
      { kind: "delete", capability: "session.delete_draft", label: "Excluir" },
    ],
  },
  {
    category: "clinical",
    key: "sessions-team",
    title: "Atendimentos da equipe",
    description: "Visualização e alteração de atendimentos e evoluções de outros profissionais.",
    details: "Controla leitura de prontuários de outros colegas, edição de registros de terceiros, compartilhamento e exclusão consolidada.",
    actions: [
      { kind: "view", capability: "sessions.read_all", label: "Ver" },
      { kind: "edit", capability: "sessions.write_others", label: "Editar" },
      { kind: "share", capability: "sessions.share", label: "Enviar" },
      { kind: "delete", capability: "sessions.delete", label: "Excluir" },
    ],
  },

  // Agenda
  {
    category: "agenda",
    key: "schedule-own",
    title: "Agenda própria",
    description: "Visualização e agendamento na própria agenda do profissional.",
    details: "Controla a visualização da agenda pessoal e a marcação de compromissos.",
    actions: [
      { kind: "view", capability: "schedule.read", label: "Ver" },
      { kind: "edit", capability: "schedule.write", label: "Agendar" },
    ],
  },
  {
    category: "agenda",
    key: "schedule-team",
    title: "Agenda da equipe",
    description: "Visualização e encaixe de horários na agenda de outros colegas.",
    details: "Permite agendar, mover e cancelar compromissos no calendário de outros membros da clínica.",
    actions: [
      { kind: "view", capability: "schedule.read_all", label: "Ver" },
      { kind: "edit", capability: "schedule.write_others", label: "Agendar" },
      { kind: "delete", capability: "agenda.delete_events", label: "Excluir" },
    ],
  },

  // Equipe
  {
    category: "team",
    key: "subaccounts",
    title: "Colaboradores da clínica",
    description: "Cadastro, convites, alteração de cargos e revogação de acessos da equipe.",
    details: "Controla a visualização da lista, envio de novos convites, edição de cargos/especialidades/status e exclusão/revogação do vínculo na clínica.",
    actions: [
      { kind: "view", capability: "subaccounts.read", label: "Ver" },
      { kind: "edit", capability: "subaccounts.write", label: "Convidar" },
      { kind: "manage", capability: "subaccounts.manage", label: "Editar" },
      { kind: "delete", capability: "subaccounts.delete", label: "Excluir" },
    ],
  },
  {
    category: "team",
    key: "roles",
    title: "Papéis operacionais & Hierarquias",
    description: "Configuração de poderes e personalização da matriz de permissões.",
    details: "Controla a visualização e edição da matriz de permissões e papéis operacionais da clínica.",
    actions: [
      { kind: "view", capability: "subaccounts_roles.read", label: "Ver" },
      { kind: "manage", capability: "subaccounts_roles.manage", label: "Gerenciar" },
    ],
  },
  {
    category: "team",
    key: "team-analytics",
    title: "Analytics & Metas da equipe",
    description: "Acompanhamento de métricas de produtividade, metas e desenvolvimento.",
    details: "Controla gráficos de desempenho, taxa de ocupação, metas e avaliações internas.",
    actions: [
      { kind: "view", capability: "subaccounts_analytics.read", label: "Métricas" },
      { kind: "edit", capability: "team_development.manage", label: "Metas" },
    ],
  },

  // Financeiro
  {
    category: "finance",
    key: "treasury",
    title: "Caixa & Pagamentos de Pacientes",
    description: "Lançamento de recebimentos, baixa de sessões e controle financeiro de pacientes.",
    details: "Controla o registro de pagamentos, recibos e fluxo de caixa de atendimentos.",
    actions: [
      { kind: "view", capability: "treasury.read", label: "Extrato" },
      { kind: "finance", capability: "treasury.manage", label: "Receber" },
    ],
  },
  {
    category: "finance",
    key: "billing",
    title: "Assinatura & Plano Therapy-Flow",
    description: "Gestão da assinatura da clínica, faturas e contratação de acessos simultâneos.",
    details: "Controla o plano da clínica junto ao Therapy-Flow, upgrade e histórico de faturamento.",
    actions: [
      { kind: "view", capability: "subscription_billing.read", label: "Ver" },
      { kind: "manage", capability: "subscription_billing.manage", label: "Gerenciar" },
    ],
  },

  // Administração
  {
    category: "admin",
    key: "clinic-profile",
    title: "Perfil institucional da clínica",
    description: "Razão social, logotipo, CNPJ, endereço e preferências gerais.",
    details: "Controla as informações públicas e institucionais da clínica.",
    actions: [
      { kind: "view", capability: "clinic_profile.read", label: "Ver" },
      { kind: "manage", capability: "clinic_profile.manage", label: "Editar" },
    ],
  },
  {
    category: "admin",
    key: "forms",
    title: "Modelos de formulários",
    description: "Criação, edição, importação e exportação de modelos de anamnese.",
    details: "Controla a biblioteca de formulários clínicos e fichas da clínica.",
    actions: [
      { kind: "view", capability: "forms.read", label: "Ver" },
      { kind: "manage", capability: "forms.manage", label: "Gerenciar" },
    ],
  },
  {
    category: "admin",
    key: "system-print",
    title: "Impressão & Documentos físicos",
    description: "Exportação e impressão física de fichas, declarações e prontuários.",
    details: "Controla a autorização para impressão e geração física de documentos clínicos.",
    actions: [
      { kind: "print", capability: "system.print", label: "Imprimir" },
    ],
  },
];

export const ROLE_PERMISSION_CATEGORY_COUNTS: Record<RolePermissionCategoryId, number> = {
  all: ROLE_PERMISSION_ITEMS.reduce((acc, item) => acc + item.actions.length, 0),
  clinical: ROLE_PERMISSION_ITEMS.filter((item) => item.category === "clinical").reduce((acc, item) => acc + item.actions.length, 0),
  agenda: ROLE_PERMISSION_ITEMS.filter((item) => item.category === "agenda").reduce((acc, item) => acc + item.actions.length, 0),
  team: ROLE_PERMISSION_ITEMS.filter((item) => item.category === "team").reduce((acc, item) => acc + item.actions.length, 0),
  admin: ROLE_PERMISSION_ITEMS.filter((item) => item.category === "admin").reduce((acc, item) => acc + item.actions.length, 0),
  finance: ROLE_PERMISSION_ITEMS.filter((item) => item.category === "finance").reduce((acc, item) => acc + item.actions.length, 0),
};

