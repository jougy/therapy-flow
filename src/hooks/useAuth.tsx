import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { type Session, type User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { logRuntimeError } from "@/lib/runtime-debug";
import { createSecuritySessionKey, parseSecurityUserAgent } from "@/lib/security-settings";
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
>;

type Membership = Database["public"]["Tables"]["clinic_memberships"]["Row"];
type ClinicSummary = Pick<
  Database["public"]["Tables"]["clinics"]["Row"],
  | "account_owner_user_id"
  | "concurrent_access_limit"
  | "id"
  | "logo_url"
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
  refreshAuthState: () => Promise<void>;
  session: Session | null;
  signOut: () => Promise<void>;
  subscriptionPlan: SubscriptionPlan | null;
  user: User | null;
}

const emptyCapabilities = Object.fromEntries(
  ACCESS_CAPABILITIES.map((capability) => [capability, false])
) as Record<AccessCapability, boolean>;

const DEFAULT_CONCURRENT_ACCESS_LIMIT_BY_PLAN: Record<SubscriptionPlan, number> = {
  clinic: 4,
  solo: 1,
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : String(message);
  }

  return String(error);
};

const isSimultaneousAccessLimitError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("limite de acessos simultaneos");
};

const deriveConcurrentAccessLimit = (clinicSummary: {
  subaccount_limit: number | null;
  subscription_plan: SubscriptionPlan;
}) => {
  if (clinicSummary.subscription_plan === "solo") {
    return DEFAULT_CONCURRENT_ACCESS_LIMIT_BY_PLAN.solo;
  }

  return Math.max(
    clinicSummary.subaccount_limit ?? DEFAULT_CONCURRENT_ACCESS_LIMIT_BY_PLAN.clinic,
    DEFAULT_CONCURRENT_ACCESS_LIMIT_BY_PLAN.clinic
  );
};

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
  refreshAuthState: async () => {},
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

  const registerSecuritySession = useCallback(async (nextSession: Session) => {
    const browserInfo = parseSecurityUserAgent(
      typeof navigator === "undefined" ? null : navigator.userAgent
    );
    const sessionKey = await createSecuritySessionKey(nextSession.access_token);

    const { error } = await supabase.rpc("register_current_security_session", {
      _browser: browserInfo.browser,
      _device_label: `${browserInfo.browser} • ${browserInfo.platform}`,
      _platform: browserInfo.platform,
      _session_key: sessionKey,
      _user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
    });

    if (error) {
      throw error;
    }
  }, []);

  const fetchClinicSummary = useCallback(async (clinicId: string) => {
    const primaryRes = await supabase
      .from("clinics")
      .select("account_owner_user_id, concurrent_access_limit, id, logo_url, name, subaccount_limit, subscription_plan")
      .eq("id", clinicId)
      .maybeSingle();

    if (!primaryRes.error) {
      return primaryRes.data ?? null;
    }

    logRuntimeError("auth.fetchClinicSummary.primary", primaryRes.error, {
      clinicId,
      note: "Falling back to legacy clinic query without concurrent_access_limit.",
    });

    const fallbackRes = await supabase
      .from("clinics")
      .select("account_owner_user_id, id, logo_url, name, subaccount_limit, subscription_plan")
      .eq("id", clinicId)
      .maybeSingle();

    if (fallbackRes.error) {
      logRuntimeError("auth.fetchClinicSummary.fallback", fallbackRes.error, { clinicId });
      return null;
    }

    if (!fallbackRes.data) {
      return null;
    }

    return {
      ...fallbackRes.data,
      concurrent_access_limit: deriveConcurrentAccessLimit({
        subaccount_limit: fallbackRes.data.subaccount_limit,
        subscription_plan: fallbackRes.data.subscription_plan as SubscriptionPlan,
      }),
    };
  }, []);

  const fetchAuthState = useCallback(async (userId: string, nextSession?: Session | null) => {
    await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId);

    try {
      if (nextSession?.access_token) {
        await registerSecuritySession(nextSession);
      }
    } catch (error) {
      logRuntimeError("auth.register_current_security_session", error, { userId });

      if (isSimultaneousAccessLimitError(error)) {
        const message = getErrorMessage(error);

        await supabase.auth.signOut();
        toast({
          title: "Acesso simultaneo indisponivel",
          description: message,
          variant: "destructive",
        });
        throw error;
      }
    }

    const [profileRes, roleRes, membershipRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "address, avatar_url, bio, birth_date, clinic_id, cpf, email, full_name, job_title, last_password_changed_at, last_seen_at, password_temporary, phone, professional_license, public_code, social_name, specialty, working_hours"
        )
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
      setClinic(await fetchClinicSummary(nextClinicId));
    } else {
      setClinic(null);
    }
  }, [fetchClinicSummary, registerSecuritySession]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession?.user) {
        setTimeout(() => {
          void fetchAuthState(nextSession.user.id, nextSession)
            .catch(() => undefined)
            .finally(() => setLoading(false));
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
        void fetchAuthState(nextSession.user.id, nextSession)
          .catch(() => undefined)
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchAuthState]);

  useEffect(() => {
    if (!session?.user || !session.access_token) {
      return;
    }

    const interval = window.setInterval(() => {
      void supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", session.user.id);
      void registerSecuritySession(session).catch((error) => {
        logRuntimeError("auth.register_current_security_session.heartbeat", error, {
          userId: session.user.id,
        });
      });
    }, 5 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [registerSecuritySession, session]);

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

  const refreshAuthState = async () => {
    const nextUserId = session?.user?.id;
    if (!nextUserId) {
      return;
    }

    await fetchAuthState(nextUserId, session);
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
        refreshAuthState,
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
