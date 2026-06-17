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
  | "patients.read"
  | "patients.write"
  | "schedule.read"
  | "schedule.write"
  | "sessions.read"
  | "sessions.write"
  | "session.delete_draft";

export const ACCESS_CAPABILITIES: AccessCapability[] = [
  "clinic_profile.manage",
  "forms.manage",
  "subaccounts.manage",
  "subaccounts_roles.manage",
  "subscription_billing.manage",
  "treasury.manage",
  "agenda.delete_events",
  "subaccounts_analytics.read",
  "patients.read",
  "patients.write",
  "schedule.read",
  "schedule.write",
  "sessions.read",
  "sessions.write",
  "session.delete_draft",
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
  "patients.read": {
    description: "Pode visualizar pacientes e suas informações cadastrais.",
    label: "Visualizar pacientes",
  },
  "patients.write": {
    description: "Pode criar e editar cadastros, grupos e dados operacionais de pacientes.",
    label: "Editar pacientes",
  },
  "schedule.read": {
    description: "Pode visualizar agenda e compromissos da clínica.",
    label: "Visualizar agenda",
  },
  "schedule.write": {
    description: "Pode criar e editar eventos da agenda.",
    label: "Editar agenda",
  },
  "session.delete_draft": {
    description: "Pode excluir rascunhos de atendimentos.",
    label: "Excluir rascunhos de atendimento",
  },
  "sessions.read": {
    description: "Pode visualizar atendimentos, evolução e fichas clínicas.",
    label: "Visualizar atendimentos",
  },
  "sessions.write": {
    description: "Pode criar e editar atendimentos e registros clínicos.",
    label: "Editar atendimentos",
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
      return hasOperationalRole(context, ["owner", "admin"]);

    case "subaccounts.manage":
    case "subaccounts_roles.manage":
      return canHaveSubaccounts(context.subscriptionPlan) && hasOperationalRole(context, ["owner", "admin"]);

    case "subscription_billing.manage":
      return false;

    case "patients.read":
    case "patients.write":
      return hasOperationalRole(context, ["owner", "admin", "professional", "assistant", "estagiario"]);

    case "schedule.read":
    case "schedule.write":
      return hasOperationalRole(context, ["owner", "admin", "professional", "assistant"]);

    case "sessions.read":
    case "sessions.write":
      return hasOperationalRole(context, ["owner", "admin", "professional", "estagiario"]);

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
