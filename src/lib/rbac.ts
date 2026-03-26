export type SubscriptionPlan = "solo" | "clinic";
export type AccountRole = "account_owner" | null;
export type OperationalRole = "owner" | "admin" | "professional" | "assistant" | null;
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

export const hasCapability = (context: MembershipContext, capability: AccessCapability) => {
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
    case "schedule.read":
    case "schedule.write":
      return hasOperationalRole(context, ["owner", "admin", "professional", "assistant"]);

    case "patients.write":
      return hasOperationalRole(context, ["owner", "admin", "professional", "assistant"]);

    case "sessions.read":
      return hasOperationalRole(context, ["owner", "admin", "professional"]);

    case "sessions.write":
    case "session.delete_draft":
      return hasOperationalRole(context, ["owner", "admin", "professional"]);

    default:
      return false;
  }
};
