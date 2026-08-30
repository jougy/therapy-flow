import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { SimulationDebugPanel } from "./SimulationDebugPanel";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { supabase } from "@/integrations/supabase/client";
import { addDebugEvent, clearDebugEvents } from "@/lib/runtime-debug";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe("SimulationDebugPanel", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    clearDebugEvents();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.mocked(useAuth).mockReturnValue({
      can: vi.fn((cap) => cap === "treasury.manage" || cap === "patients.read"),
      clinic: {
        id: "clinic-guardian-123",
        name: "Ins. Guardian of the Amazon",
        slug: "guardian-of-the-amazon",
        route_key: "guardian-amazon",
        subscription_plan: "clinic",
      },
      clinicId: "clinic-guardian-123",
      isPlatformOwner: true,
      isSuperAdmin: false,
      membership: { account_role: "account_owner" },
      operationalRole: "owner",
      platformAccess: {
        clinic: { id: "clinic-guardian-123", name: "Ins. Guardian of the Amazon" },
        isSimulation: true,
        simulatedPlan: "clinic",
        simulatedRole: "owner",
      },
      platformMfaVerified: false,
      profile: { full_name: "Jougy Admin", email: "jougy@guardians.com" },
      simulatedRoleCapabilityOverrides: {},
      subscriptionPlan: "clinic",
      user: { id: "user-jougy-123", email: "jougy@guardians.com" },
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: { dashboards_general: true, print_clinic_stats: true },
      flagOverrides: {},
      isFeatureEnabled: vi.fn(() => true),
      resetFlagOverrides: vi.fn(),
      setFlagOverride: vi.fn(),
    } as unknown as ReturnType<typeof useFeatureFlags>);
  });

  const renderComponent = (props = { open: true, onOpenChange: vi.fn() }) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/clinica/guardian-amazon"]}>
          <SimulationDebugPanel {...props} />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("renders the debug panel with title, backoffice badge and clinic context", () => {
    renderComponent();

    expect(screen.getByText(/Painel de Debug & Diagnóstico em Tempo Real/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Backoffice/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Ins. Guardian of the Amazon/i)).toBeInTheDocument();
    expect(screen.getByText(/\/clinica\/guardian-amazon/i)).toBeInTheDocument();
  });

  it("allows switching between navigation tabs", async () => {
    renderComponent();

    // Switch to Permissions tab
    const permissionsTab = screen.getByRole("tab", { name: /Papel & Permissões/i });
    fireEvent.click(permissionsTab);

    expect(screen.getByText(/Identidade do Usuário/i)).toBeInTheDocument();
    expect(screen.getByText(/Jougy Admin/i)).toBeInTheDocument();
    expect(screen.getByText(/Matriz de Avaliação RBAC na Página Atual/i)).toBeInTheDocument();

    // Switch to Flags tab
    const flagsTab = screen.getByRole("tab", { name: /Flags/i });
    fireEvent.click(flagsTab);

    expect(screen.getByText(/Feature Flags da Sessão/i)).toBeInTheDocument();
    expect(screen.getByText(/dashboards_general/i)).toBeInTheDocument();

    // Switch to React Query tab
    const queriesTab = screen.getByRole("tab", { name: /React Query/i });
    fireEvent.click(queriesTab);

    expect(screen.getByText(/Cache TanStack Query/i)).toBeInTheDocument();
  });

  it("executes manual RPC test when clicking Testar RPC em Tempo Real button", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        totalPatients: 41,
        totalSessions: 0,
        paidSessions: 0,
        financialTotals: { paid: 0, forecastRevenueCents: 0 },
      },
      error: null,
    } as never);

    renderComponent();

    const testRpcBtn = screen.getByRole("button", { name: /Testar RPC em Tempo Real/i });
    fireEvent.click(testRpcBtn);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith("get_clinic_dashboard_analytics", {
        _clinic_id: "clinic-guardian-123",
        _year: new Date().getFullYear(),
      });
      expect(screen.getByText(/Resultado do Teste RPC Direto/i)).toBeInTheDocument();
      expect(screen.getByText(/200 OK/i)).toBeInTheDocument();
    });
  });

  it("renders live runtime error logs and allows clearing them", async () => {
    addDebugEvent("error", "test.scope", "Erro simulado para debug", { test: true });

    renderComponent();

    const logsTab = screen.getByRole("tab", { name: /Logs em Tempo Real/i });
    fireEvent.click(logsTab);

    expect(screen.getByText(/Erro simulado para debug/i)).toBeInTheDocument();
    expect(screen.getByText(/test.scope/i)).toBeInTheDocument();

    const clearBtn = screen.getByRole("button", { name: /Limpar/i });
    fireEvent.click(clearBtn);

    expect(screen.getByText(/Nenhum log ou evento capturado/i)).toBeInTheDocument();
  });
});
