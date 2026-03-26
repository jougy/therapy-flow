import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { type Session, type User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  ACCESS_CAPABILITIES,
  hasCapability,
  type AccessCapability,
  type AccountRole,
  type MembershipStatus,
  type OperationalRole,
  type SubscriptionPlan,
} from "@/lib/rbac";

type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "address"
  | "avatar_url"
  | "cpf"
  | "bio"
  | "clinic_id"
  | "email"
  | "full_name"
  | "job_title"
  | "last_seen_at"
  | "phone"
  | "professional_license"
  | "public_code"
  | "social_name"
  | "specialty"
  | "working_hours"
  | "birth_date"
>;

type Membership = Database["public"]["Tables"]["clinic_memberships"]["Row"];
type ClinicSummary = Pick<
  Database["public"]["Tables"]["clinics"]["Row"],
  | "account_owner_user_id"
  | "id"
  | "name"
  | "subaccount_limit"
  | "subscription_plan"
>;

interface AuthContextType {
  accountRole: AccountRole;
  can: (capability: AccessCapability) => boolean;
  capabilities: Record<AccessCapability, boolean>;
  clinic: ClinicSummary | null;
  clinicId: string | null;
  isSuperAdmin: boolean;
  loading: boolean;
  membership: Membership | null;
  membershipStatus: MembershipStatus | null;
  operationalRole: OperationalRole;
  profile: Profile | null;
  session: Session | null;
  signOut: () => Promise<void>;
  subscriptionPlan: SubscriptionPlan | null;
  user: User | null;
}

const emptyCapabilities = Object.fromEntries(
  ACCESS_CAPABILITIES.map((capability) => [capability, false])
) as Record<AccessCapability, boolean>;

const AuthContext = createContext<AuthContextType>({
  accountRole: null,
  can: () => false,
  capabilities: emptyCapabilities,
  clinic: null,
  clinicId: null,
  isSuperAdmin: false,
  loading: true,
  membership: null,
  membershipStatus: null,
  operationalRole: null,
  profile: null,
  session: null,
  signOut: async () => {},
  subscriptionPlan: null,
  user: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [clinic, setClinic] = useState<ClinicSummary | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchAuthState = async (userId: string) => {
    await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId);

    const [profileRes, roleRes, membershipRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("address, avatar_url, bio, birth_date, clinic_id, cpf, email, full_name, job_title, last_seen_at, phone, professional_license, public_code, social_name, specialty, working_hours")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("clinic_memberships")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .eq("membership_status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const nextProfile = profileRes.data ?? null;
    const nextMembership = membershipRes.data ?? null;
    const nextClinicId = nextMembership?.clinic_id ?? nextProfile?.clinic_id ?? null;

    setProfile(nextProfile);
    setMembership(nextMembership);
    setIsSuperAdmin((roleRes.data ?? []).some((role) => role.role === "super_admin"));

    if (nextClinicId) {
      const clinicRes = await supabase
        .from("clinics")
        .select("account_owner_user_id, id, name, subaccount_limit, subscription_plan")
        .eq("id", nextClinicId)
        .maybeSingle();

      setClinic(clinicRes.data ?? null);
    } else {
      setClinic(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession?.user) {
        setTimeout(() => {
          void fetchAuthState(nextSession.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setProfile(null);
        setMembership(null);
        setClinic(null);
        setIsSuperAdmin(false);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      setSession(nextSession);

      if (nextSession?.user) {
        void fetchAuthState(nextSession.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const capabilities = useMemo(() => {
    if (!membership || !clinic) {
      return emptyCapabilities;
    }

    return Object.fromEntries(
      ACCESS_CAPABILITIES.map((capability) => [
        capability,
        hasCapability(
          {
            accountRole: membership.account_role as AccountRole,
            isActive: membership.is_active,
            membershipStatus: membership.membership_status as MembershipStatus,
            operationalRole: membership.operational_role as OperationalRole,
            subscriptionPlan: clinic.subscription_plan as SubscriptionPlan,
          },
          capability
        ),
      ])
    ) as Record<AccessCapability, boolean>;
  }, [clinic, membership]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const can = (capability: AccessCapability) => capabilities[capability];

  return (
    <AuthContext.Provider
      value={{
        accountRole: (membership?.account_role as AccountRole) ?? null,
        can,
        capabilities,
        clinic,
        clinicId: clinic?.id ?? profile?.clinic_id ?? null,
        isSuperAdmin,
        loading,
        membership,
        membershipStatus: (membership?.membership_status as MembershipStatus) ?? null,
        operationalRole: (membership?.operational_role as OperationalRole) ?? null,
        profile,
        session,
        signOut,
        subscriptionPlan: (clinic?.subscription_plan as SubscriptionPlan) ?? null,
        user: session?.user ?? null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
