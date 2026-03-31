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

  const createSelectBuilder = (table: string, selectClause?: string) => {
    const normalizedSelect = selectClause ?? "";

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

    if (table === "user_roles") {
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
  const { clinic, loading, session } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="session">{session ? "signed-in" : "signed-out"}</span>
      <span data-testid="limit">{clinic?.concurrent_access_limit ?? "missing"}</span>
    </div>
  );
};

describe("useAuth runtime resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not crash or sign out when the backend is still on the old schema", async () => {
    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("session")).toHaveTextContent("signed-in");
    expect(screen.getByTestId("limit")).toHaveTextContent("4");
    expect(supabaseMocks.signOut).not.toHaveBeenCalled();
  });
});
