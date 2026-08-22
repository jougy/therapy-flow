import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClinicTeamSection } from "./ClinicTeamSection";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/contexts/TutorialContext", () => ({
  useTutorial: () => ({
    showComponentHelp: vi.fn(),
  }),
}));

describe("ClinicTeamSection", () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset();
    supabaseMocks.rpc.mockReset();

    mockUseAuth.mockReturnValue({
      accountRole: "account_owner",
      operationalRole: "owner",
      clinicId: "clinic-1",
      subscriptionPlan: "clinic",
      can: () => true,
      user: { id: "owner-1" },
    });

    supabaseMocks.rpc.mockImplementation((fn: string) => {
      if (fn === "get_clinic_pending_collaborator_invitations") {
        return Promise.resolve({ data: [], error: null });
      }
      if (fn === "get_clinic_concurrent_access_overview") {
        return Promise.resolve({
          data: {
            active_sessions: [],
            available: 4,
            limit: 4,
            occupied: 0,
            reached: false,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const createChain = (data: any = []) => {
      const fn = () => {
        const p: any = Promise.resolve({ data, error: null });
        p.select = fn;
        p.eq = fn;
        p.neq = fn;
        p.order = fn;
        p.upsert = vi.fn(() => Promise.resolve({ data: null, error: null }));
        p.delete = fn;
        return p;
      };
      return fn();
    };

    supabaseMocks.from.mockImplementation(() => createChain([]));
  });

  it("renders the team section and opens the operational roles modal", async () => {
    render(<ClinicTeamSection />);

    await waitFor(() => expect(screen.getByText("Colaboradores e acessos")).toBeInTheDocument());

    const openRolesBtn = screen.getByRole("button", { name: /gerenciar papéis operacionais/i });
    expect(openRolesBtn).toBeInTheDocument();
    fireEvent.click(openRolesBtn);

    await waitFor(() => expect(screen.getByText("Hierarquias")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Administrador(a)")).toBeInTheDocument();
  });

  it("allows owner to edit permissions and toggle switches with smart coupling", async () => {
    render(<ClinicTeamSection />);

    await waitFor(() => expect(screen.getByText("Colaboradores e acessos")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /gerenciar papéis operacionais/i }));

    await waitFor(() => expect(screen.getByDisplayValue("Administrador(a)")).toBeInTheDocument());

    // Switch should not be disabled for Owner
    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBeGreaterThan(0);
    expect(switches[0]).not.toBeDisabled();

    // Click a switch to toggle permission
    fireEvent.click(switches[0]);
    await waitFor(() => {
      expect(supabaseMocks.from).toHaveBeenCalledWith("clinic_operational_role_capabilities");
    });
  });

  it("allows owner to rename any role including owner role", async () => {
    render(<ClinicTeamSection />);

    await waitFor(() => expect(screen.getByText("Colaboradores e acessos")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /gerenciar papéis operacionais/i }));

    // Select Owner role
    fireEvent.click(screen.getByRole("button", { name: /Proprietário\(a\)/i }));
    await waitFor(() => expect(screen.getByDisplayValue("Proprietário(a)")).toBeInTheDocument());

    const input = screen.getByDisplayValue("Proprietário(a)");
    expect(input).not.toBeDisabled();

    fireEvent.change(input, { target: { value: "Diretor Geral" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(supabaseMocks.from).toHaveBeenCalledWith("clinic_operational_roles");
    });
  });

  it("disables editing for non-owner when targeting same or higher level", async () => {
    mockUseAuth.mockReturnValue({
      accountRole: "subaccount",
      operationalRole: "admin",
      clinicId: "clinic-1",
      subscriptionPlan: "clinic",
      can: (cap: string) => cap === "subaccounts_roles.manage",
      user: { id: "admin-1" },
    });

    render(<ClinicTeamSection />);

    await waitFor(() => expect(screen.getByText("Colaboradores e acessos")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /gerenciar papéis operacionais/i }));

    // Admin opens modal -> Administrador(a) is selected by default -> Admin cannot edit same level (Admin)
    await waitFor(() => expect(screen.getByDisplayValue("Administrador(a)")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Administrador(a)")).toBeDisabled();
    expect(screen.getByText(/somente leitura/i)).toBeInTheDocument();

    // Select lower role: Profissional -> Admin can edit Profissional
    fireEvent.click(screen.getByRole("button", { name: /Profissional/i }));
    await waitFor(() => expect(screen.getByDisplayValue("Profissional")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Profissional")).not.toBeDisabled();
  });
});
