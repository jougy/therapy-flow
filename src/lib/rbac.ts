export type SubscriptionPlan = "solo" | "clinic";
export type AccountRole = "account_owner" | null;
export type OperationalRole = "owner" | "admin" | "professional" | "assistant" | "estagiario" | null;
export type MembershipStatus = "invited" | "active" | "inactive" | "suspended";

export type AccessCapability =
  | "clinic_profile.manage"
  | "forms.manage"
  | "subaccounts.manage"
  | "subaccounts_roles.manage"
  | "subscription_billing.manage"
  | "treasury.manage"
  | "agenda.delete_events"
  | "subaccounts_analytics.read"
  | "team_development.manage"
  | "patients.read"
  | "patients.write"
  | "patients.delete"
  | "patients.manage_groups"
  | "schedule.read"
  | "schedule.write"
  | "schedule.write_others"
  | "sessions.read"
  | "sessions.write"
  | "sessions.read_all"
  | "sessions.write_others"
  | "sessions.share"
  | "sessions.delete"
  | "session.delete_draft"
  | "system.print";

export const ACCESS_CAPABILITIES: AccessCapability[] = [
  "clinic_profile.manage",
  "forms.manage",
  "subaccounts.manage",
  "subaccounts_roles.manage",
  "subscription_billing.manage",
  "treasury.manage",
  "agenda.delete_events",
  "subaccounts_analytics.read",
  "team_development.manage",
  "patients.read",
  "patients.write",
  "patients.delete",
  "patients.manage_groups",
  "schedule.read",
  "schedule.write",
  "schedule.write_others",
  "sessions.read",
  "sessions.write",
  "sessions.read_all",
  "sessions.write_others",
  "sessions.share",
  "sessions.delete",
  "session.delete_draft",
  "system.print",
];

export const ACCESS_CAPABILITY_LABELS: Record<AccessCapability, { description: string; label: string }> = {
  "agenda.delete_events": {
    description: "Pode excluir eventos da agenda da clínica.",
    label: "Excluir eventos da agenda",
  },
  "clinic_profile.manage": {
    description: "Pode editar dados institucionais, marca e preferências da clínica.",
    label: "Gerenciar perfil da clínica",
  },
  "forms.manage": {
    description: "Pode criar, editar, importar e remover modelos de formulários.",
    label: "Gerenciar formulários",
  },
  "patients.delete": {
    description: "Pode remover e excluir cadastros de pacientes da clínica.",
    label: "Excluir pacientes",
  },
  "patients.manage_groups": {
    description: "Pode criar, alterar e organizar grupos e categorias de pacientes.",
    label: "Gerenciar grupos de pacientes",
  },
  "patients.read": {
    description: "Pode visualizar pacientes e suas informações cadastrais.",
    label: "Visualizar pacientes",
  },
  "patients.write": {
    description: "Pode criar e editar cadastros e dados operacionais de pacientes.",
    label: "Editar pacientes",
  },
  "schedule.read": {
    description: "Pode visualizar agenda e compromissos da clínica.",
    label: "Visualizar agenda",
  },
  "schedule.write": {
    description: "Pode criar e editar eventos na própria agenda.",
    label: "Editar própria agenda",
  },
  "schedule.write_others": {
    description: "Pode agendar e alterar compromissos na agenda de outros profissionais.",
    label: "Editar agenda de outros colaboradores",
  },
  "session.delete_draft": {
    description: "Pode excluir rascunhos de atendimentos.",
    label: "Excluir rascunhos de atendimento",
  },
  "sessions.delete": {
    description: "Pode excluir registros concluídos e histórico de atendimentos.",
    label: "Excluir histórico de atendimentos",
  },
  "sessions.read": {
    description: "Pode visualizar atendimentos, evolução e fichas clínicas próprias.",
    label: "Visualizar próprios atendimentos",
  },
  "sessions.read_all": {
    description: "Pode visualizar atendimentos de toda a equipe da clínica.",
    label: "Visualizar todos os atendimentos",
  },
  "sessions.share": {
    description: "Pode compartilhar registros de atendimentos com outros colaboradores.",
    label: "Compartilhar atendimentos",
  },
  "sessions.write": {
    description: "Pode criar e editar atendimentos e registros clínicos próprios.",
    label: "Editar próprios atendimentos",
  },
  "sessions.write_others": {
    description: "Pode editar atendimentos e registros criados por outros profissionais.",
    label: "Editar atendimentos de outros colaboradores",
  },
  "subaccounts.manage": {
    description: "Pode criar, editar, suspender e deslogar colaboradores.",
    label: "Gerenciar colaboradores",
  },
  "subaccounts_analytics.read": {
    description: "Pode visualizar analytics e desenvolvimento da equipe.",
    label: "Ver analytics da equipe",
  },
  "subaccounts_roles.manage": {
    description: "Pode alterar hierarquias e poderes dos papéis operacionais.",
    label: "Gerenciar papéis operacionais",
  },
  "subscription_billing.manage": {
    description: "Pode ver e alterar assinatura, cobrança e limites comerciais.",
    label: "Gerenciar assinatura",
  },
  "system.print": {
    description: "Pode exportar e imprimir estatísticas, fichas, relatórios e prontuários.",
    label: "Impressão no sistema",
  },
  "team_development.manage": {
    description: "Pode avaliar, definir metas e acompanhar evolução interna de colaboradores.",
    label: "Gerenciar desenvolvimento da equipe",
  },
  "treasury.manage": {
    description: "Pode visualizar e gerenciar dados financeiros e tesouraria.",
    label: "Gerenciar tesouraria",
  },
};

export interface MembershipContext {
  accountRole: AccountRole;
  isActive: boolean;
  membershipStatus: MembershipStatus | null;
  operationalRole: OperationalRole;
  subscriptionPlan: SubscriptionPlan;
}

const isMembershipUsable = (context: MembershipContext) =>
  context.isActive && context.membershipStatus === "active";

const isAccountOwner = (context: MembershipContext) => context.accountRole === "account_owner";

const hasOperationalRole = (context: MembershipContext, roles: OperationalRole[]) =>
  context.operationalRole !== null && roles.includes(context.operationalRole);

export const canHaveSubaccounts = (plan: SubscriptionPlan) => plan === "clinic";

export const hasDefaultCapability = (context: MembershipContext, capability: AccessCapability) => {
  if (!isMembershipUsable(context)) {
    return false;
  }

  if (isAccountOwner(context)) {
    return true;
  }

  switch (capability) {
    case "clinic_profile.manage":
    case "forms.manage":
    case "treasury.manage":
    case "agenda.delete_events":
    case "subaccounts_analytics.read":
    case "team_development.manage":
    case "sessions.read_all":
    case "sessions.write_others":
    case "sessions.delete":
    case "patients.delete":
      return hasOperationalRole(context, ["owner", "admin"]);

    case "subaccounts.manage":
    case "subaccounts_roles.manage":
      return canHaveSubaccounts(context.subscriptionPlan) && hasOperationalRole(context, ["owner", "admin"]);

    case "subscription_billing.manage":
      return false;

    case "patients.read":
    case "patients.write":
    case "patients.manage_groups":
    case "system.print":
      return hasOperationalRole(context, ["owner", "admin", "professional", "assistant", "estagiario"]);

    case "schedule.read":
    case "schedule.write":
      return hasOperationalRole(context, ["owner", "admin", "professional", "assistant"]);

    case "schedule.write_others":
      return hasOperationalRole(context, ["owner", "admin", "assistant"]);

    case "sessions.read":
    case "sessions.write":
      return hasOperationalRole(context, ["owner", "admin", "professional", "estagiario"]);

    case "sessions.share":
    case "session.delete_draft":
      return hasOperationalRole(context, ["owner", "admin", "professional"]);

    default:
      return false;
  }
};

export const applyCapabilityOverrides = (
  defaults: Record<AccessCapability, boolean>,
  overrides: Partial<Record<AccessCapability, boolean>>,
) =>
  Object.fromEntries(
    ACCESS_CAPABILITIES.map((capability) => [
      capability,
      overrides[capability] ?? defaults[capability],
    ]),
  ) as Record<AccessCapability, boolean>;

export const buildCapabilitiesForContext = (
  context: MembershipContext,
  overrides: Partial<Record<AccessCapability, boolean>> = {},
) => {
  const defaults = Object.fromEntries(
    ACCESS_CAPABILITIES.map((capability) => [capability, hasDefaultCapability(context, capability)]),
  ) as Record<AccessCapability, boolean>;

  if (!isMembershipUsable(context) || isAccountOwner(context)) {
    return defaults;
  }

  return applyCapabilityOverrides(defaults, overrides);
};

export const hasCapability = (
  context: MembershipContext,
  capability: AccessCapability,
  overrides: Partial<Record<AccessCapability, boolean>> = {},
) => buildCapabilitiesForContext(context, overrides)[capability];
