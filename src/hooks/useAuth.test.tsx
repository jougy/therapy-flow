import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const supabaseMocks = vi.hoisted(() => {
  const fakeSession = {
    access_token: "access-token",
    user: { id: "user-1", email: "owner@example.com" },
  };

  const createQueryResult = (data: unknown, error: unknown = null) =>
    Promise.resolve({ data, error });

  const profileUpdateBuilder = {
    eq: vi.fn(() => createQueryResult(null)),
  };

  let mockPlatformAdminRole: "platform_owner" | "platform_marketing" | null = null;
  let mockPlatformFeatureFlags: Record<string, boolean> | null = null;

  const createSelectBuilder = (table: string, selectClause?: string) => {
    const normalizedSelect = selectClause ?? "";

    if (table === "platform_admins") {
      const builder = {
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(() =>
          createQueryResult(
            mockPlatformAdminRole
              ? {
                  role: mockPlatformAdminRole,
                  is_active: true,
                  ...(mockPlatformFeatureFlags ? { feature_flags: mockPlatformFeatureFlags } : {}),
                }
              : null
          )
        ),
      };
      return builder;
    }

    if (table === "profiles" && normalizedSelect.includes("address")) {
      return {
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            createQueryResult({
              address: null,
              avatar_url: null,
              bio: null,
              birth_date: null,
              clinic_id: "clinic-1",
              cpf: null,
              email: "owner@example.com",
              full_name: "Owner Example",
              job_title: null,
              last_password_changed_at: null,
              last_seen_at: null,
              password_temporary: false,
              phone: null,
              professional_license: null,
              public_code: "001",
              social_name: null,
              specialty: null,
              working_hours: null,
            })
          ),
        })),
      };
    }

    if (table === "user_roles" || table === "clinic_operational_role_capabilities") {
      return {
        eq: vi.fn(() => createQueryResult([])),
      };
    }


    if (table === "clinic_memberships") {
      const builder = {
        eq: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        maybeSingle: vi.fn(() =>
          createQueryResult({
            account_role: "account_owner",
            clinic_id: "clinic-1",
            created_at: "2026-03-31T00:00:00.000Z",
            id: "membership-1",
            is_active: true,
            membership_status: "active",
            operational_role: "owner",
            updated_at: "2026-03-31T00:00:00.000Z",
            user_id: "user-1",
          })
        ),
        order: vi.fn(() => builder),
      };

      return builder;
    }

    if (table === "clinics") {
      const legacySelect = !normalizedSelect.includes("concurrent_access_limit");

      return {
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            legacySelect
              ? createQueryResult({
                  account_owner_user_id: "user-1",
                  id: "clinic-1",
                  logo_url: null,
                  name: "Clinica Example",
                  route_key: "clinic-route-1",
                  subaccount_limit: 4,
                  subscription_plan: "clinic",
                })
              : createQueryResult(null, { message: 'column clinics.concurrent_access_limit does not exist' })
          ),
        })),
      };
    }

    throw new Error(`Unexpected select builder request for table "${table}" and select "${normalizedSelect}"`);
  };

  const from = vi.fn((table: string) => ({
    select: vi.fn((selectClause?: string) => createSelectBuilder(table, selectClause)),
    update: vi.fn(() => {
      if (table === "profiles") {
        return profileUpdateBuilder;
      }

      throw new Error(`Unexpected update request for table "${table}"`);
    }),
  }));

  return {
    fakeSession,
    from,
    setMockPlatformAdminRole: (role: "platform_owner" | "platform_marketing" | null) => {
      mockPlatformAdminRole = role;
    },
    setMockPlatformFeatureFlags: (flags: Record<string, boolean> | null) => {
      mockPlatformFeatureFlags = flags;
    },
    onAuthStateChange: vi.fn((callback: (event: string, session: typeof fakeSession | null) => void) => {
      callback("SIGNED_IN", fakeSession);

      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    }),
    rpc: vi.fn((fn: string) => {
    if (fn === "register_current_security_session") {
      return createQueryResult(null, { message: "function public.register_current_security_session does not exist" });
    }

    if (fn === "list_current_user_clinics") {
      return createQueryResult([
        {
          account_role: "account_owner",
          clinic_active_access_count: 0,
          clinic_active_access_users: [],
          clinic_account_owner_user_id: "user-1",
          clinic_concurrent_access_limit: null,
          clinic_id: "clinic-1",
          clinic_logo_url: null,
          clinic_name: "Clinica Example",
          clinic_route_key: "clinic-route-1",
          clinic_subaccount_limit: 4,
          clinic_subscription_plan: "clinic",
          is_active: true,
          joined_at: "2026-03-31T00:00:00.000Z",
          membership_id: "membership-1",
          membership_status: "active",
          operational_role: "owner",
          role_key: null,
        },
      ]);
    }

    if (fn === "set_current_user_active_clinic") {
      return createQueryResult({ clinic_id: "clinic-1" });
    }

    if (fn === "upsert_user_telemetry_summary") {
      return createQueryResult({ success: true });
    }

    throw new Error(`Unexpected rpc "${fn}"`);
  }),
    signOut: vi.fn(() => createQueryResult(null)),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: supabaseMocks.fakeSession } })),
      onAuthStateChange: supabaseMocks.onAuthStateChange,
      signOut: supabaseMocks.signOut,
    },
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

const AuthStateProbe = () => {
  const { accessibleClinics, clinic, loading, session } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="session">{session ? "signed-in" : "signed-out"}</span>
      <span data-testid="limit">{clinic?.concurrent_access_limit ?? "missing"}</span>
      <span data-testid="clinics">{accessibleClinics.length}</span>
    </div>
  );
};

describe("useAuth runtime resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.setMockPlatformAdminRole(null);
    supabaseMocks.setMockPlatformFeatureFlags(null);
    window.sessionStorage.setItem("therapy-flow.activeClinicId", "clinic-1");
  });

  it("loads accessible clinics without restoring an active clinic implicitly", async () => {
    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("session")).toHaveTextContent("signed-in");
    expect(screen.getByTestId("clinics")).toHaveTextContent("1");
    expect(screen.getByTestId("limit")).toHaveTextContent("missing");
    expect(supabaseMocks.signOut).not.toHaveBeenCalled();
  });

  it("preserves active clinic and membership during background auth state refresh", async () => {
    let selectClinicFn: (id: string) => Promise<void> = async () => {};
    let refreshFn: () => Promise<void> = async () => {};

    const ClinicTestProbe = () => {
      const { clinic, refreshAuthState, selectClinic } = useAuth();
      selectClinicFn = selectClinic;
      refreshFn = refreshAuthState;

      return <span data-testid="clinic-id">{clinic?.id ?? "none"}</span>;
    };

    render(
      <AuthProvider>
        <ClinicTestProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("clinic-id")).toHaveTextContent("none");
    });

    await waitFor(async () => {
      await selectClinicFn("clinic-1");
    });
    expect(screen.getByTestId("clinic-id")).toHaveTextContent("clinic-1");

    // Trigger background refresh (simulating tab switch / token refresh)
    await waitFor(async () => {
      await refreshFn();
    });

    // The active clinic should be preserved seamlessly without resetting to "none"
    expect(screen.getByTestId("clinic-id")).toHaveTextContent("clinic-1");
  });

  it("populates role_key in membership and respects effectiveRoleKey in capabilities", async () => {
    let currentMembership: Membership | null = null;
    let canFn: ((capability: AccessCapability) => boolean) | null = null;

    const MembershipProbe = () => {
      const { can, membership, selectClinic } = useAuth();
      currentMembership = membership;
      canFn = can;

      return (
        <button
          onClick={() => void selectClinic("clinic-1")}
          data-testid="select-clinic"
        >
          Select
        </button>
      );
    };

    render(
      <AuthProvider>
        <MembershipProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("select-clinic")).toBeInTheDocument();
    });

    screen.getByTestId("select-clinic").click();

    await waitFor(() => {
      expect(currentMembership).not.toBeNull();
    });

    expect(currentMembership?.role_key).toBeNull();
    expect(currentMembership?.operational_role).toBe("owner");
    expect(canFn?.("patients.read")).toBe(true);
  });

  it("persists active clinic in localStorage on selectClinic and clears both localStorage and sessionStorage on signOut", async () => {
    let selectClinicFn: (id: string) => Promise<void> = async () => {};
    let signOutFn: () => Promise<void> = async () => {};

    const PersistenceProbe = () => {
      const { selectClinic, signOut } = useAuth();
      selectClinicFn = selectClinic;
      signOutFn = signOut;

      return <div>Persistence Test Probe</div>;
    };

    window.localStorage.clear();
    window.sessionStorage.clear();

    render(
      <AuthProvider>
        <PersistenceProbe />
      </AuthProvider>
    );

    await waitFor(async () => {
      await selectClinicFn("clinic-1");
    });

    expect(window.localStorage.getItem("therapy-flow.activeClinicId")).toBe("clinic-1");
    expect(window.sessionStorage.getItem("therapy-flow.activeClinicId")).toBeNull();

    await signOutFn();

    expect(window.localStorage.getItem("therapy-flow.activeClinicId")).toBeNull();
    expect(window.sessionStorage.getItem("therapy-flow.activeClinicId")).toBeNull();
  });

  it("flushes telemetry and signs out user on signOut", async () => {
    let signOutFn: () => Promise<void> = async () => {};

    const SignOutProbe = () => {
      const { signOut } = useAuth();
      signOutFn = signOut;

      return <button onClick={() => void signOut()} data-testid="sign-out">Sign Out</button>;
    };

    render(
      <AuthProvider>
        <SignOutProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("sign-out")).toBeInTheDocument();
    });

    await signOutFn();

    expect(supabaseMocks.signOut).toHaveBeenCalledTimes(1);
  });

  it("exposes platformRole and isPlatformMarketing when user has active platform_marketing role", async () => {
    supabaseMocks.setMockPlatformAdminRole("platform_marketing");

    const PlatformRoleProbe = () => {
      const { loading, platformRole, isPlatformMarketing, isPlatformOwner } = useAuth();
      if (loading) return <span>loading</span>;
      return (
        <div>
          <span data-testid="platform-role">{platformRole ?? "none"}</span>
          <span data-testid="is-marketing">{String(isPlatformMarketing)}</span>
          <span data-testid="is-owner">{String(isPlatformOwner)}</span>
        </div>
      );
    };

    render(
      <AuthProvider>
        <PlatformRoleProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("platform-role")).toHaveTextContent("platform_marketing");
    });

    expect(screen.getByTestId("is-marketing")).toHaveTextContent("true");
    expect(screen.getByTestId("is-owner")).toHaveTextContent("false");
  });

  it("exposes platformFeatureFlags and hasPlatformFlag from platform_admins and grants all flags to platform_owner", async () => {
    supabaseMocks.setMockPlatformAdminRole("platform_marketing");
    supabaseMocks.setMockPlatformFeatureFlags({
      marketing: true,
      agenda: false,
      billing: true,
      simulation: false,
    });

    const FlagsProbe = () => {
      const { loading, platformFeatureFlags, hasPlatformFlag } = useAuth();
      if (loading) return <span>loading</span>;
      return (
        <div>
          <span data-testid="flag-marketing">{String(hasPlatformFlag("marketing"))}</span>
          <span data-testid="flag-agenda">{String(hasPlatformFlag("agenda"))}</span>
          <span data-testid="flag-billing">{String(hasPlatformFlag("billing"))}</span>
          <span data-testid="flag-logs">{String(hasPlatformFlag("logs"))}</span>
          <span data-testid="raw-billing">{String(platformFeatureFlags.billing)}</span>
        </div>
      );
    };

    const { unmount } = render(
      <AuthProvider>
        <FlagsProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("flag-marketing")).toHaveTextContent("true");
    });
    expect(screen.getByTestId("flag-agenda")).toHaveTextContent("false");
    expect(screen.getByTestId("flag-billing")).toHaveTextContent("true");
    expect(screen.getByTestId("flag-logs")).toHaveTextContent("false");
    expect(screen.getByTestId("raw-billing")).toHaveTextContent("true");

    unmount();
    supabaseMocks.setMockPlatformAdminRole("platform_owner");
    supabaseMocks.setMockPlatformFeatureFlags({ billing: false, logs: false });

    render(
      <AuthProvider>
        <FlagsProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("flag-logs")).toHaveTextContent("true");
    });
    expect(screen.getByTestId("flag-agenda")).toHaveTextContent("true");
    expect(screen.getByTestId("flag-billing")).toHaveTextContent("true");
  });
});
