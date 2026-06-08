import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { type Session, type User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { logRuntimeError } from "@/lib/runtime-debug";
import { clearSecuritySessionKey, createSecuritySessionKey, parseSecurityUserAgent } from "@/lib/security-settings";
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
type PlatformSupportRole = NonNullable<OperationalRole>;
type ClinicSummary = Pick<
  Database["public"]["Tables"]["clinics"]["Row"],
  | "account_owner_user_id"
  | "concurrent_access_limit"
  | "id"
  | "logo_url"
  | "name"
  | "route_key"
  | "subaccount_limit"
  | "subscription_plan"
>;

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
}

interface AuthContextType {
  accountRole: AccountRole;
  accessibleClinics: AccessibleClinic[];
  can: (capability: AccessCapability) => boolean;
  capabilities: Record<AccessCapability, boolean>;
  clinic: ClinicSummary | null;
  clinicId: string | null;
  endPlatformClinicAccess?: () => Promise<void>;
  isSuperAdmin: boolean;
  isPlatformOwner?: boolean;
  platformMfaVerified?: boolean;
  loading: boolean;
  membership: Membership | null;
  membershipStatus: MembershipStatus | null;
  operationalRole: OperationalRole;
  platformAccess?: PlatformClinicAccess | null;
  setPlatformSupportRole?: (role: PlatformSupportRole) => Promise<void>;
  profile: Profile | null;
  leaveClinic: () => Promise<void>;
  refreshMfaAssurance: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
  selectClinic: (clinicId: string) => Promise<void>;
  selectClinicByRouteKey: (routeKey: string) => Promise<void>;
  session: Session | null;
  signOut: () => Promise<void>;
  startPlatformClinicAccess?: (clinicId: string, reason: string, simulatedRole?: PlatformSupportRole) => Promise<PlatformClinicAccess>;
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
const ACTIVE_CLINIC_STORAGE_KEY = "therapy-flow.activeClinicId";

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

const isForcedSignOutError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("sessao encerrada") || message.includes("sessão encerrada");
};

const isDuplicateSecuritySessionError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("duplicate key value") &&
    message.includes("user_security_sessions_session_key_key")
  );
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
  accessibleClinics: [],
  can: () => false,
  capabilities: emptyCapabilities,
  clinic: null,
  clinicId: null,
  endPlatformClinicAccess: async () => {},
  isSuperAdmin: false,
  isPlatformOwner: false,
  platformMfaVerified: false,
  loading: true,
  membership: null,
  membershipStatus: null,
  operationalRole: null,
  platformAccess: null,
  profile: null,
  leaveClinic: async () => {},
  refreshMfaAssurance: async () => {},
  refreshAuthState: async () => {},
  selectClinic: async () => {},
  selectClinicByRouteKey: async () => {},
  session: null,
  signOut: async () => {},
  setPlatformSupportRole: async () => {},
  startPlatformClinicAccess: async () => {
    throw new Error("Acesso de plataforma indisponivel.");
  },
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
  const [accessibleClinics, setAccessibleClinics] = useState<AccessibleClinic[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [platformMfaVerified, setPlatformMfaVerified] = useState(false);
  const [platformAccess, setPlatformAccess] = useState<PlatformClinicAccess | null>(null);
  const currentSecuritySessionKeyRef = useRef<string | null>(null);

  const getStoredActiveClinicId = () => {
    if (typeof window === "undefined") {
      return null;
    }

    return window.sessionStorage.getItem(ACTIVE_CLINIC_STORAGE_KEY);
  };

  const setStoredActiveClinicId = (clinicId: string | null) => {
    if (typeof window === "undefined") {
      return;
    }

    if (clinicId) {
      window.sessionStorage.setItem(ACTIVE_CLINIC_STORAGE_KEY, clinicId);
      return;
    }

    window.sessionStorage.removeItem(ACTIVE_CLINIC_STORAGE_KEY);
  };

  const endCurrentSecuritySession = useCallback(async (options?: { keepalive?: boolean; session?: Session | null }) => {
    const nextSession = options?.session ?? session;
    const accessToken = nextSession?.access_token;
    if (!accessToken) {
      clearSecuritySessionKey();
      currentSecuritySessionKeyRef.current = null;
      return;
    }

    const sessionKey = currentSecuritySessionKeyRef.current ?? await createSecuritySessionKey();
    currentSecuritySessionKeyRef.current = sessionKey;

    const request = fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/end_current_security_session`, {
      method: "POST",
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ _session_key: sessionKey }),
      keepalive: options?.keepalive ?? false,
    });

    try {
      await request;
    } catch {
      // Best-effort shutdown for abandoned tabs.
    } finally {
      clearSecuritySessionKey();
      currentSecuritySessionKeyRef.current = null;
    }
  }, [session]);

  const registerSecuritySession = useCallback(async (nextSession: Session) => {
    const browserInfo = parseSecurityUserAgent(
      typeof navigator === "undefined" ? null : navigator.userAgent
    );
    const sessionKey = currentSecuritySessionKeyRef.current ?? await createSecuritySessionKey();
    currentSecuritySessionKeyRef.current = sessionKey;

    const { error } = await supabase.rpc("register_current_security_session", {
      _browser: browserInfo.browser,
      _device_label: `${browserInfo.browser} • ${browserInfo.platform}`,
      _platform: browserInfo.platform,
      _session_key: sessionKey,
      _user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
    });

    if (error) {
      if (isDuplicateSecuritySessionError(error)) {
        return;
      }

      throw error;
    }
  }, []);

  const fetchAccessibleClinics = useCallback(async (userId: string): Promise<AccessibleClinic[]> => {
    const { data, error } = await supabase.rpc("list_current_user_clinics");

    if (error) {
      logRuntimeError("auth.list_current_user_clinics", error);
      return [];
    }

    return (data ?? []).map((row) => {
      const subscriptionPlan = row.clinic_subscription_plan as SubscriptionPlan;
      const subaccountLimit = row.clinic_subaccount_limit ?? DEFAULT_CONCURRENT_ACCESS_LIMIT_BY_PLAN[subscriptionPlan];

      return {
        clinic: {
          account_owner_user_id: row.clinic_account_owner_user_id,
          concurrent_access_limit:
            row.clinic_concurrent_access_limit ??
            deriveConcurrentAccessLimit({
              subaccount_limit: subaccountLimit,
              subscription_plan: subscriptionPlan,
            }),
          id: row.clinic_id,
          logo_url: row.clinic_logo_url,
          name: row.clinic_name,
          route_key: row.clinic_route_key,
          subaccount_limit: subaccountLimit,
          subscription_plan: subscriptionPlan,
        },
        activeAccessCount: row.clinic_active_access_count ?? 0,
        activeAccessUsers: Array.isArray(row.clinic_active_access_users)
          ? row.clinic_active_access_users.filter((item): item is AccessibleClinic["activeAccessUsers"][number] => {
              return !!item && typeof item === "object" && "user_id" in item && typeof item.user_id === "string";
            })
          : [],
        membership: {
          account_role: row.account_role,
          clinic_id: row.clinic_id,
          created_at: row.joined_at,
          ended_at: null,
          id: row.membership_id,
          invited_by: null,
          is_active: row.is_active,
          joined_at: row.joined_at,
          membership_status: row.membership_status,
          operational_role: row.operational_role,
          updated_at: row.joined_at,
          user_id: userId,
        },
      };
    });
  }, []);

  const fetchAuthState = useCallback(async (userId: string, nextSession?: Session | null) => {
    await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId);

    const platformOwnerRequest = async () => {
      try {
        return await supabase.rpc("is_platform_owner" as never, { _user_id: userId } as never) as {
          data: unknown;
          error: unknown;
        };
      } catch {
        return { data: false, error: null };
      }
    };

    const [profileRes, roleRes, clinicOptions, platformOwnerRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "address, avatar_url, bio, birth_date, clinic_id, cpf, email, full_name, job_title, last_password_changed_at, last_seen_at, password_temporary, phone, professional_license, public_code, social_name, specialty, working_hours"
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      fetchAccessibleClinics(userId),
      platformOwnerRequest(),
    ]);

    const nextProfile = profileRes.data ?? null;
    const nextIsPlatformOwner = platformOwnerRes.data === true;
    let nextPlatformMfaVerified = false;

    if (nextIsPlatformOwner) {
      try {
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        nextPlatformMfaVerified = data.currentLevel === "aal2";
      } catch {
        nextPlatformMfaVerified = false;
      }
    }

    setProfile(nextProfile);
    setAccessibleClinics(clinicOptions);
    setMembership(null);
    setClinic(null);
    setIsSuperAdmin((roleRes.data ?? []).some((role) => role.role === "super_admin"));
    setIsPlatformOwner(nextIsPlatformOwner);
    setPlatformMfaVerified(nextPlatformMfaVerified);
    setPlatformAccess(null);
  }, [fetchAccessibleClinics]);

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
        currentSecuritySessionKeyRef.current = null;
        setProfile(null);
        setMembership(null);
        setClinic(null);
        setAccessibleClinics([]);
        setStoredActiveClinicId(null);
        setIsSuperAdmin(false);
        setIsPlatformOwner(false);
        setPlatformMfaVerified(false);
        setPlatformAccess(null);
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
    if (!session?.user || !session.access_token || !clinic) {
      return;
    }

    const heartbeat = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      void supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", session.user.id);
      void registerSecuritySession(session).catch((error) => {
        logRuntimeError("auth.register_current_security_session.heartbeat", error, {
          userId: session.user.id,
        });

        if (isForcedSignOutError(error)) {
          void supabase.auth.signOut();
          toast({
            title: "Sessão encerrada",
            description: getErrorMessage(error),
            variant: "destructive",
          });
        }
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        heartbeat();
      }
    };

    const handlePageHide = () => {
      void endCurrentSecuritySession({ keepalive: true, session });
    };

    const interval = window.setInterval(heartbeat, 60 * 1000);
    heartbeat();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [clinic, endCurrentSecuritySession, registerSecuritySession, session]);

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
    await endCurrentSecuritySession({ session });
    setStoredActiveClinicId(null);
    setPlatformAccess(null);
    setPlatformMfaVerified(false);
    await supabase.auth.signOut();
  };

  const refreshAuthState = async () => {
    const nextUserId = session?.user?.id;
    if (!nextUserId) {
      return;
    }

    await fetchAuthState(nextUserId, session);
  };

  const refreshMfaAssurance = async () => {
    if (!session?.user || !isPlatformOwner) {
      setPlatformMfaVerified(false);
      return;
    }

    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error) {
      throw error;
    }

    setPlatformMfaVerified(data.currentLevel === "aal2");
  };

  const can = (capability: AccessCapability) => capabilities[capability];

  const leaveClinic = async () => {
    await endCurrentSecuritySession({ session });
    setStoredActiveClinicId(null);
    setPlatformAccess(null);
    setMembership(null);
    setClinic(null);
  };

  const activateClinic = async (
    selectedClinic: AccessibleClinic | undefined,
    activate: () => Promise<{ error: unknown }>
  ) => {
    if (!selectedClinic) {
      throw new Error("Clinica indisponivel para este usuario.");
    }

    const { error } = await activate();

    if (error) {
      throw error;
    }

    setStoredActiveClinicId(selectedClinic.clinic.id);
    setMembership(selectedClinic.membership);
    setClinic(selectedClinic.clinic);

    if (session) {
      try {
        await registerSecuritySession(session);
      } catch (error) {
        logRuntimeError("auth.register_current_security_session", error, {
          userId: session.user.id,
        });

        if (isSimultaneousAccessLimitError(error) || isForcedSignOutError(error)) {
          const message = getErrorMessage(error);

          await supabase.auth.signOut();
          toast({
            title: isForcedSignOutError(error) ? "Sessão encerrada" : "Acesso simultaneo indisponivel",
            description: message,
            variant: "destructive",
          });
          throw error;
        }
      }
    }
  };

  const selectClinic = async (clinicId: string) => {
    const selectedClinic = accessibleClinics.find((option) => option.clinic.id === clinicId);

    await activateClinic(selectedClinic, () =>
      supabase.rpc("set_current_user_active_clinic", {
        _clinic_id: clinicId,
      })
    );
  };

  const selectClinicByRouteKey = async (routeKey: string) => {
    const selectedClinic = accessibleClinics.find((option) => option.clinic.route_key === routeKey);

    await activateClinic(selectedClinic, () =>
      supabase.rpc("set_current_user_active_clinic_by_route_key", {
        _route_key: routeKey,
      })
    );
  };

  const buildPlatformMembership = (userId: string, clinicId: string, role: PlatformSupportRole): Membership => ({
    account_role: role === "owner" ? "account_owner" : null,
    clinic_id: clinicId,
    created_at: new Date().toISOString(),
    ended_at: null,
    id: `platform-${clinicId}`,
    invited_by: null,
    is_active: true,
    joined_at: new Date().toISOString(),
    membership_status: "active",
    operational_role: role,
    updated_at: new Date().toISOString(),
    user_id: userId,
  });

  const startPlatformClinicAccess = async (
    clinicId: string,
    reason: string,
    simulatedRole: PlatformSupportRole = "owner"
  ) => {
    const { data, error } = await supabase.rpc("start_platform_clinic_access" as never, {
      _clinic_id: clinicId,
      _reason: `${reason} | visão simulada: ${simulatedRole}`,
    } as never) as {
      data: { clinic?: ClinicSummary; reason?: string } | null;
      error: unknown;
    };

    if (error) {
      throw error;
    }

    if (!data?.clinic || !session?.user.id) {
      throw new Error("Acesso de plataforma indisponivel.");
    }

    const nextAccess = {
      clinic: data.clinic,
      reason,
      simulatedRole,
    };

    setStoredActiveClinicId(data.clinic.id);
    setMembership(buildPlatformMembership(session.user.id, data.clinic.id, simulatedRole));
    setClinic(data.clinic);
    setPlatformAccess(nextAccess);

    return nextAccess;
  };

  const setPlatformSupportRole = async (role: PlatformSupportRole) => {
    if (!platformAccess || !session?.user.id) {
      return;
    }

    setMembership(buildPlatformMembership(session.user.id, platformAccess.clinic.id, role));
    setPlatformAccess({ ...platformAccess, simulatedRole: role });

    try {
      await supabase.rpc("log_platform_audit_event" as never, {
        _clinic_id: platformAccess.clinic.id,
        _event_type: "platform_support_view_changed",
        _metadata: {
          simulated_role: role,
        },
        _reason: platformAccess.reason,
      } as never);
    } catch {
      // Best-effort audit logging: the support UI should not break if telemetry fails locally.
    }
  };

  const endPlatformClinicAccess = async () => {
    const { error } = await supabase.rpc("end_platform_clinic_access" as never, undefined as never) as {
      error: unknown;
    };

    if (error) {
      throw error;
    }

    setStoredActiveClinicId(null);
    setPlatformAccess(null);
    setMembership(null);
    setClinic(null);
  };

  return (
    <AuthContext.Provider
      value={{
        accountRole: (membership?.account_role as AccountRole) ?? null,
        accessibleClinics,
        can,
        capabilities,
        clinic,
        clinicId: clinic?.id ?? null,
        endPlatformClinicAccess,
        isSuperAdmin,
        isPlatformOwner,
        platformMfaVerified,
        loading,
        membership,
        membershipStatus: (membership?.membership_status as MembershipStatus) ?? null,
        operationalRole: (membership?.operational_role as OperationalRole) ?? null,
        platformAccess,
        profile,
        leaveClinic,
        refreshMfaAssurance,
        refreshAuthState,
        selectClinic,
        selectClinicByRouteKey,
        session,
        signOut,
        setPlatformSupportRole,
        startPlatformClinicAccess,
        subscriptionPlan: (clinic?.subscription_plan as SubscriptionPlan) ?? null,
        user: session?.user ?? null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
