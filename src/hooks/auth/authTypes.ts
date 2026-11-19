import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  ACCESS_CAPABILITIES,
  type AccessCapability,
  type AccountRole,
  type MembershipStatus,
  type OperationalRole,
  type SubscriptionPlan,
} from "@/lib/rbac";

export type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "address"
  | "avatar_url"
  | "cpf"
  | "bio"
  | "clinic_id"
  | "email"
  | "full_name"
  | "job_title"
  | "last_password_changed_at"
  | "last_seen_at"
  | "password_temporary"
  | "phone"
  | "professional_license"
  | "public_code"
  | "social_name"
  | "specialty"
  | "working_hours"
  | "birth_date"
  | "profession"
  | "council_name"
>;

export type Membership = Database["public"]["Tables"]["clinic_memberships"]["Row"] & {
  role_key?: string | null;
};

export type PlatformSupportRole = NonNullable<OperationalRole>;

export type ClinicSummary = Pick<
  Database["public"]["Tables"]["clinics"]["Row"],
  | "account_owner_user_id"
  | "concurrent_access_limit"
  | "id"
  | "logo_url"
  | "name"
  | "route_key"
  | "subaccount_limit"
  | "subscription_plan"
> & {
  subproduct_key?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
};

export interface AccessibleClinic {
  membership: Membership;
  clinic: ClinicSummary;
  activeAccessCount: number;
  activeAccessUsers: Array<{
    device_label?: string | null;
    email?: string | null;
    full_name?: string | null;
    last_seen_at?: string | null;
    user_id: string;
  }>;
}

export interface PlatformClinicAccess {
  clinic: ClinicSummary;
  reason: string;
  simulatedRole: PlatformSupportRole;
  simulatedPlan?: SubscriptionPlan;
  isSimulation?: boolean;
}

export interface AuthContextType {
  accountRole: AccountRole;
  accessibleClinics: AccessibleClinic[];
  can: (capability: AccessCapability) => boolean;
  capabilities: Record<AccessCapability, boolean>;
  clinic: ClinicSummary | null;
  clinicId: string | null;
  endPlatformClinicAccess?: () => Promise<void>;
  isSuperAdmin: boolean;
  isPlatformOwner?: boolean;
  isPasswordRecovery?: boolean;
  clearPasswordRecovery?: () => void;
  platformMfaVerified?: boolean;
  loading: boolean;
  membership: Membership | null;
  membershipStatus: MembershipStatus | null;
  operationalRole: OperationalRole;
  platformAccess?: PlatformClinicAccess | null;
  setPlatformSupportRole?: (role: PlatformSupportRole) => Promise<void>;
  setPlatformSimulatedPlan?: (plan: SubscriptionPlan) => void;
  startPlatformClinicSimulation?: (clinicId?: string) => Promise<PlatformClinicAccess>;
  simulatedRoleCapabilityOverrides?: Partial<Record<AccessCapability, boolean>>;
  setPlatformRoleCapabilityOverride?: (capability: AccessCapability, enabled: boolean) => void;
  resetPlatformRoleCapabilityOverrides?: () => void;
  profile: Profile | null;
  leaveClinic: () => Promise<void>;
  refreshMfaAssurance: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
  selectClinic: (clinicId: string) => Promise<void>;
  selectClinicByRouteKey: (routeKey: string) => Promise<void>;
  session: Session | null;
  isSigningOut?: boolean;
  signOut: () => Promise<void>;
  startPlatformClinicAccess?: (clinicId: string, reason: string, simulatedRole?: PlatformSupportRole) => Promise<PlatformClinicAccess>;
  subscriptionPlan: SubscriptionPlan | null;
  user: User | null;
}

export type RoleCapabilityOverride = {
  capability: AccessCapability;
  enabled: boolean;
  operational_role: string;
};

export const emptyCapabilities = Object.fromEntries(
  ACCESS_CAPABILITIES.map((capability) => [capability, false])
) as Record<AccessCapability, boolean>;

export const DEFAULT_CONCURRENT_ACCESS_LIMIT_BY_PLAN: Record<SubscriptionPlan, number> = {
  solo: 1,
  prof_basico: 1,
  prof_medio: 1,
  prof_top: 2,
  clinica_basico: 2,
  clinica_medio: 4,
  clinic: 4,
  clinica_top: 8,
  enterprise: 8,
};

export const ACTIVE_CLINIC_STORAGE_KEY = "therapy-flow.activeClinicId";
