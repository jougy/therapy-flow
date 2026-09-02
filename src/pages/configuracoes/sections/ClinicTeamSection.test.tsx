import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClinicTeamSection } from "./ClinicTeamSection";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  upsert: vi.fn(),
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

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) => (
    <button type="button" onClick={onClick} className={className}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

describe("ClinicTeamSection", () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset();
    supabaseMocks.rpc.mockReset();
    supabaseMocks.upsert.mockReset();
    supabaseMocks.upsert.mockImplementation(() => Promise.resolve({ data: null, error: null }));

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
        p.in = fn;
        p.order = fn;
        p.upsert = supabaseMocks.upsert;
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

    const openRolesBtn = screen.getByRole("button", { name: /^gerenciar papéis operacionais$/i });
    expect(openRolesBtn).toBeInTheDocument();
    fireEvent.click(openRolesBtn);

    await waitFor(() => expect(screen.getByText("Hierarquias")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Administrador(a)")).toBeInTheDocument();
  });

  it("allows owner to edit permissions and toggle switches with smart coupling", async () => {
    render(<ClinicTeamSection />);

    await waitFor(() => expect(screen.getByText("Colaboradores e acessos")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^gerenciar papéis operacionais$/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /^gerenciar papéis operacionais$/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /^gerenciar papéis operacionais$/i }));

    // Admin opens modal -> Administrador(a) is selected by default -> Admin cannot edit same level (Admin)
    await waitFor(() => expect(screen.getByDisplayValue("Administrador(a)")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Administrador(a)")).toBeDisabled();
    expect(screen.getByText(/somente leitura/i)).toBeInTheDocument();

    // Select lower role: Profissional -> Admin can edit Profissional
    fireEvent.click(screen.getByRole("button", { name: /Profissional/i }));
    await waitFor(() => expect(screen.getByDisplayValue("Profissional")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Profissional")).not.toBeDisabled();
  });

  it("loads and displays active collaborators in the team directory", async () => {
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_memberships") {
        const chain: any = Promise.resolve({
          data: [
            {
              id: "mem-1",
              user_id: "user-1",
              operational_role: "admin",
              membership_status: "active",
              is_active: true,
              created_at: "2026-01-01T00:00:00Z",
            },
            {
              id: "mem-2",
              user_id: "user-2",
              operational_role: "professional",
              membership_status: "active",
              is_active: true,
              created_at: "2026-01-02T00:00:00Z",
            },
          ],
          error: null,
        });
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.neq = () => chain;
        chain.in = () => chain;
        return chain;
      }
      if (table === "profiles") {
        const chain: any = Promise.resolve({
          data: [
            {
              id: "user-1",
              full_name: "Arthur Mendes Carvalho",
              email: "arthur@example.com",
              job_title: "Fisioterapeuta",
              specialty: "Ortopedia",
              last_seen_at: null,
            },
            {
              id: "user-2",
              full_name: "Dra. Beatriz Santos",
              email: "beatriz@example.com",
              job_title: "Psicóloga",
              specialty: "TCC",
              last_seen_at: null,
            },
          ],
          error: null,
        });
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.neq = () => chain;
        chain.in = () => chain;
        return chain;
      }

      const defaultChain: any = Promise.resolve({ data: [], error: null });
      defaultChain.select = () => defaultChain;
      defaultChain.eq = () => defaultChain;
      defaultChain.neq = () => defaultChain;
      defaultChain.in = () => defaultChain;
      return defaultChain;
    });

    render(<ClinicTeamSection />);

    await waitFor(() => {
      expect(screen.getByText("Arthur Mendes Carvalho")).toBeInTheDocument();
      expect(screen.getByText("Dra. Beatriz Santos")).toBeInTheDocument();
    });

    expect(screen.getByText("arthur@example.com")).toBeInTheDocument();
    expect(screen.getByText("beatriz@example.com")).toBeInTheDocument();
    expect(screen.getByText("Colaboradores vinculados à clínica (2 membros).")).toBeInTheDocument();
  });

  it("allows owner to open edit collaborator modal and save changes via RPC", async () => {
    supabaseMocks.rpc.mockImplementation((fn: string) => {
      if (fn === "update_clinic_member_operational_fields") {
        return Promise.resolve({ data: { membership_id: "mem-2" }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_memberships") {
        const chain: any = Promise.resolve({
          data: [
            {
              id: "mem-2",
              user_id: "user-2",
              operational_role: "professional",
              membership_status: "active",
              is_active: true,
              created_at: "2026-01-02T00:00:00Z",
            },
          ],
          error: null,
        });
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.neq = () => chain;
        chain.in = () => chain;
        return chain;
      }
      if (table === "profiles") {
        const chain: any = Promise.resolve({
          data: [
            {
              id: "user-2",
              full_name: "Dra. Beatriz Santos",
              email: "beatriz@example.com",
              job_title: "Psicóloga",
              specialty: "TCC",
              working_hours: "Seg a Sex, 08h às 17h",
              last_seen_at: null,
            },
          ],
          error: null,
        });
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.neq = () => chain;
        chain.in = () => chain;
        return chain;
      }
      const defaultChain: any = Promise.resolve({ data: [], error: null });
      defaultChain.select = () => defaultChain;
      defaultChain.eq = () => defaultChain;
      defaultChain.neq = () => defaultChain;
      defaultChain.in = () => defaultChain;
      return defaultChain;
    });

    render(<ClinicTeamSection />);

    await waitFor(() => expect(screen.getByText("Dra. Beatriz Santos")).toBeInTheDocument());

    const menuBtn = screen.getByRole("button", { name: /opções para dra\. beatriz santos/i });
    expect(menuBtn).toBeInTheDocument();
    fireEvent.click(menuBtn);

    const editItem = screen.getByText("Editar dados e cargo");
    expect(editItem).toBeInTheDocument();
    fireEvent.click(editItem);

    await waitFor(() => expect(screen.getByText("Editar Colaborador")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Psicóloga")).toBeInTheDocument();

    const jobInput = screen.getByDisplayValue("Psicóloga");
    fireEvent.change(jobInput, { target: { value: "Neuropsicóloga" } });

    const saveBtn = screen.getByRole("button", { name: /salvar alterações/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("update_clinic_member_operational_fields", expect.objectContaining({
        _membership_id: "mem-2",
        _job_title: "Neuropsicóloga",
      }));
    });
  });

  it("allows owner to revoke collaborator access with confirmation dialog", async () => {
    supabaseMocks.rpc.mockImplementation((fn: string) => {
      if (fn === "revoke_clinic_member_access") {
        return Promise.resolve({ data: { membership_id: "mem-2", status: "inactive" }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_memberships") {
        const chain: any = Promise.resolve({
          data: [
            {
              id: "mem-2",
              user_id: "user-2",
              operational_role: "professional",
              membership_status: "active",
              is_active: true,
              created_at: "2026-01-02T00:00:00Z",
            },
          ],
          error: null,
        });
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.neq = () => chain;
        chain.in = () => chain;
        return chain;
      }
      if (table === "profiles") {
        const chain: any = Promise.resolve({
          data: [
            {
              id: "user-2",
              full_name: "Dra. Beatriz Santos",
              email: "beatriz@example.com",
              job_title: "Psicóloga",
              specialty: "TCC",
              last_seen_at: null,
            },
          ],
          error: null,
        });
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.neq = () => chain;
        chain.in = () => chain;
        return chain;
      }
      const defaultChain: any = Promise.resolve({ data: [], error: null });
      defaultChain.select = () => defaultChain;
      defaultChain.eq = () => defaultChain;
      defaultChain.neq = () => defaultChain;
      defaultChain.in = () => defaultChain;
      return defaultChain;
    });

    render(<ClinicTeamSection />);

    await waitFor(() => expect(screen.getByText("Dra. Beatriz Santos")).toBeInTheDocument());

    const menuBtn = screen.getByRole("button", { name: /opções para dra\. beatriz santos/i });
    fireEvent.click(menuBtn);

    const revokeMenuItem = screen.getByText("Revogar acesso");
    fireEvent.click(revokeMenuItem);

    await waitFor(() => expect(screen.getByText("Revogar Acesso à Clínica")).toBeInTheDocument());

    const confirmBtn = screen.getByRole("button", { name: /revogar acesso/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("revoke_clinic_member_access", {
        _membership_id: "mem-2",
      });
    });
  });

  it("enforces vertical power hierarchy in team directory for non-owner admin", async () => {
    mockUseAuth.mockReturnValue({
      accountRole: "subaccount",
      operationalRole: "admin",
      clinicId: "clinic-1",
      subscriptionPlan: "clinic",
      can: (cap: string) => cap === "subaccounts.manage" || cap === "subaccounts_roles.manage",
      user: { id: "admin-user-1" },
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_memberships") {
        const chain: any = Promise.resolve({
          data: [
            {
              id: "mem-owner",
              user_id: "user-owner",
              operational_role: "owner",
              membership_status: "active",
              is_active: true,
              created_at: "2026-01-01T00:00:00Z",
            },
            {
              id: "mem-peer-admin",
              user_id: "user-peer-admin",
              operational_role: "admin",
              membership_status: "active",
              is_active: true,
              created_at: "2026-01-02T00:00:00Z",
            },
            {
              id: "mem-sub-pro",
              user_id: "user-sub-pro",
              operational_role: "professional",
              membership_status: "active",
              is_active: true,
              created_at: "2026-01-03T00:00:00Z",
            },
          ],
          error: null,
        });
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.neq = () => chain;
        chain.in = () => chain;
        return chain;
      }
      if (table === "profiles") {
        const chain: any = Promise.resolve({
          data: [
            {
              id: "user-owner",
              full_name: "Proprietário da Silva",
              email: "owner@example.com",
              job_title: "Diretor Clínico",
              specialty: "Gestão",
              last_seen_at: null,
            },
            {
              id: "user-peer-admin",
              full_name: "Administrador Par",
              email: "admin2@example.com",
              job_title: "Gerente",
              specialty: "Administração",
              last_seen_at: null,
            },
            {
              id: "user-sub-pro",
              full_name: "Profissional Subordinado",
              email: "pro@example.com",
              job_title: "Fisioterapeuta",
              specialty: "Pilates",
              last_seen_at: null,
            },
          ],
          error: null,
        });
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.in = () => chain;
        return chain;
      }
      const defaultChain: any = Promise.resolve({ data: [], error: null });
      defaultChain.select = () => defaultChain;
      defaultChain.eq = () => defaultChain;
      defaultChain.in = () => defaultChain;
      return defaultChain;
    });

    render(<ClinicTeamSection />);

    await waitFor(() => {
      expect(screen.getByText("Proprietário da Silva")).toBeInTheDocument();
      expect(screen.getByText("Administrador Par")).toBeInTheDocument();
      expect(screen.getByText("Profissional Subordinado")).toBeInTheDocument();
    });

    // Owner has owner shield
    expect(screen.getByTitle("Conta Proprietária")).toBeInTheDocument();

    // Peer admin has "Somente leitura" badge
    expect(screen.getByText("Somente leitura")).toBeInTheDocument();

    // Subordinate professional has actionable menu button
    const proMenuBtn = screen.getByRole("button", { name: /opções para profissional subordinado/i });
    expect(proMenuBtn).toBeInTheDocument();
  });

  it("renders granular CRUD switches for colaboradores and allows toggling in operational roles modal", async () => {
    render(<ClinicTeamSection />);

    await waitFor(() => expect(screen.getByText("Colaboradores e acessos")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^gerenciar papéis operacionais$/i }));

    await waitFor(() => expect(screen.getByText("Hierarquias")).toBeInTheDocument());

    // Switch category filter to "Equipe"
    const equipeTab = screen.getByRole("button", { name: /^Equipe/i });
    fireEvent.click(equipeTab);

    await waitFor(() => {
      expect(screen.getByText("Colaboradores da clínica")).toBeInTheDocument();
      expect(screen.getAllByRole("switch", { name: /Ver/i }).length).toBeGreaterThan(0);
      expect(screen.getByRole("switch", { name: /Convidar/i })).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: /Editar/i })).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: /Excluir/i })).toBeInTheDocument();
    });

    const inviteSwitch = screen.getByRole("switch", { name: /Convidar/i });
    fireEvent.click(inviteSwitch);

    await waitFor(() => {
      expect(supabaseMocks.from).toHaveBeenCalledWith("clinic_operational_role_capabilities");
    });
  });

  it("renders distinct switches for each permission item and decouples Ver and Editar/Gerenciar", async () => {
    render(<ClinicTeamSection />);

    await waitFor(() => expect(screen.getByText("Colaboradores e acessos")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^gerenciar papéis operacionais$/i }));

    await waitFor(() => expect(screen.getByText("Hierarquias")).toBeInTheDocument());

    // Select Estagiário role (where forms.read and forms.manage are false)
    fireEvent.click(screen.getByRole("button", { name: /Estagiário\(a\)/i }));
    await waitFor(() => expect(screen.getByDisplayValue("Estagiário(a)")).toBeInTheDocument());

    // Switch to Administração tab
    const adminTab = screen.getByRole("button", { name: /^Administração/i });
    fireEvent.click(adminTab);

    await waitFor(() => {
      expect(screen.getByText("Perfil institucional da clínica")).toBeInTheDocument();
      expect(screen.getByText("Modelos de formulários")).toBeInTheDocument();
    });

    // In "Modelos de formulários", find the Ver switch
    const formsHeading = screen.getByText("Modelos de formulários");
    const formsCard = formsHeading.closest(".flex.flex-col")!;
    const verSwitch = formsCard.querySelector('button[data-kind="view"]')!;
    const manageSwitch = formsCard.querySelector('button[data-kind="manage"]')!;

    expect(verSwitch).toBeInTheDocument();
    expect(manageSwitch).toBeInTheDocument();
    expect(verSwitch).toHaveAttribute("aria-checked", "false");
    expect(manageSwitch).toHaveAttribute("aria-checked", "false");

    // Toggle Ver switch ON: should ONLY upsert forms.read = true, not forms.manage
    supabaseMocks.upsert.mockClear();
    fireEvent.click(verSwitch);

    await waitFor(() => {
      expect(supabaseMocks.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            clinic_id: "clinic-1",
            operational_role: "estagiario",
            capability: "forms.read",
            enabled: true,
          }),
        ]),
        expect.anything()
      );
      expect(supabaseMocks.upsert).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ capability: "forms.manage" }),
        ]),
        expect.anything()
      );
    });
  });

  it("smart coupling: activating Editar/Gerenciar automatically activates Ver if inactive", async () => {
    render(<ClinicTeamSection />);

    await waitFor(() => expect(screen.getByText("Colaboradores e acessos")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^gerenciar papéis operacionais$/i }));

    await waitFor(() => expect(screen.getByText("Hierarquias")).toBeInTheDocument());

    // Select Estagiário role (where forms.read and forms.manage are false)
    fireEvent.click(screen.getByRole("button", { name: /Estagiário\(a\)/i }));
    await waitFor(() => expect(screen.getByDisplayValue("Estagiário(a)")).toBeInTheDocument());

    // Switch to Administração tab
    const adminTab = screen.getByRole("button", { name: /^Administração/i });
    fireEvent.click(adminTab);

    await waitFor(() => expect(screen.getByText("Modelos de formulários")).toBeInTheDocument());

    const formsHeading = screen.getByText("Modelos de formulários");
    const formsCard = formsHeading.closest(".flex.flex-col")!;
    const manageSwitch = formsCard.querySelector('button[data-kind="manage"]')!;

    supabaseMocks.upsert.mockClear();
    fireEvent.click(manageSwitch);

    await waitFor(() => {
      // Should batch upsert forms.manage = true AND forms.read = true
      expect(supabaseMocks.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            clinic_id: "clinic-1",
            operational_role: "estagiario",
            capability: "forms.manage",
            enabled: true,
          }),
          expect.objectContaining({
            clinic_id: "clinic-1",
            operational_role: "estagiario",
            capability: "forms.read",
            enabled: true,
          }),
        ]),
        expect.anything()
      );
    });
  });

  it("smart coupling: disabling Ver automatically disables dependent actions", async () => {
    render(<ClinicTeamSection />);

    await waitFor(() => expect(screen.getByText("Colaboradores e acessos")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^gerenciar papéis operacionais$/i }));

    await waitFor(() => expect(screen.getByText("Hierarquias")).toBeInTheDocument());

    // Administrador has forms.read = true and forms.manage = true by default
    const adminTab = screen.getByRole("button", { name: /^Administração/i });
    fireEvent.click(adminTab);

    await waitFor(() => expect(screen.getByText("Modelos de formulários")).toBeInTheDocument());

    const formsHeading = screen.getByText("Modelos de formulários");
    const formsCard = formsHeading.closest(".flex.flex-col")!;
    const verSwitch = formsCard.querySelector('button[data-kind="view"]')!;

    expect(verSwitch).toHaveAttribute("aria-checked", "true");

    supabaseMocks.upsert.mockClear();
    // Toggle Ver switch OFF: should disable forms.read and forms.manage
    fireEvent.click(verSwitch);

    await waitFor(() => {
      expect(supabaseMocks.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            clinic_id: "clinic-1",
            operational_role: "admin",
            capability: "forms.read",
            enabled: false,
          }),
          expect.objectContaining({
            clinic_id: "clinic-1",
            operational_role: "admin",
            capability: "forms.manage",
            enabled: false,
          }),
        ]),
        expect.anything()
      );
    });
  });

  it("renders and supports switches for all new capability domains (Financeiro, Agenda, Clínico)", async () => {
    render(<ClinicTeamSection />);

    await waitFor(() => expect(screen.getByText("Colaboradores e acessos")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^gerenciar papéis operacionais$/i }));

    await waitFor(() => expect(screen.getByText("Hierarquias")).toBeInTheDocument());

    // Check Financeiro tab
    const financeTab = screen.getByRole("button", { name: /^Financeiro/i });
    fireEvent.click(financeTab);

    await waitFor(() => {
      expect(screen.getByText("Caixa & Pagamentos de Pacientes")).toBeInTheDocument();
      expect(screen.getByText("Assinatura & Plano Therapy-Flow")).toBeInTheDocument();
    });

    // Check Agenda tab
    const agendaTab = screen.getByRole("button", { name: /^Agenda/i });
    fireEvent.click(agendaTab);

    await waitFor(() => {
      expect(screen.getByText("Agenda própria")).toBeInTheDocument();
      expect(screen.getByText("Agenda da equipe")).toBeInTheDocument();
    });

    // Check Clínico tab
    const clinicoTab = screen.getByRole("button", { name: /^Clínico/i });
    fireEvent.click(clinicoTab);

    await waitFor(() => {
      expect(screen.getByText("Pacientes")).toBeInTheDocument();
      expect(screen.getByText("Grupos de pacientes")).toBeInTheDocument();
      expect(screen.getByText("Atendimentos próprios")).toBeInTheDocument();
      expect(screen.getByText("Atendimentos da equipe")).toBeInTheDocument();
    });
  });

  it("disables invite button for collaborator without subaccounts.write or subaccounts.manage capability", async () => {
    mockUseAuth.mockReturnValue({
      accountRole: "subaccount",
      operationalRole: "assistant",
      clinicId: "clinic-1",
      subscriptionPlan: "clinic",
      can: (cap: string) => cap === "subaccounts.read",
      user: { id: "assistant-user-1" },
    });

    render(<ClinicTeamSection />);

    await waitFor(() => expect(screen.getByText("Colaboradores e acessos")).toBeInTheDocument());

    const inviteBtn = screen.getByRole("button", { name: /enviar convite por e-mail/i });
    expect(inviteBtn).toBeDisabled();
    expect(screen.getByText(/seu papel atual não possui permissão para convidar novos colaboradores/i)).toBeInTheDocument();
  });

  it("renders structured Skeleton loaders (anti-CLS) while loading team data", () => {
    let resolveMembers: any;
    const pendingPromise = new Promise((resolve) => {
      resolveMembers = resolve;
    });

    const createPendingChain = () => {
      const fn = () => {
        const p: any = pendingPromise;
        p.select = fn;
        p.eq = fn;
        p.neq = fn;
        p.in = fn;
        p.order = fn;
        return p;
      };
      return fn();
    };

    supabaseMocks.from.mockImplementation(() => createPendingChain());

    render(<ClinicTeamSection />);

    expect(screen.getByTestId("clinic-team-skeleton")).toBeInTheDocument();

    resolveMembers({ data: [], error: null });
  });

  it("renders Error Banner with 'Tentar novamente' button and retries loading when clicked", async () => {
    let shouldFail = true;

    const createResolvedChain = (data: any = []) => {
      const fn = () => {
        const p: any = Promise.resolve({ data, error: null });
        p.select = fn;
        p.eq = fn;
        p.neq = fn;
        p.in = fn;
        p.order = fn;
        return p;
      };
      return fn();
    };

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_memberships" && shouldFail) {
        const fn = () => {
          const p: any = Promise.resolve({
            data: null,
            error: new Error("Falha na conexão com o banco de dados"),
          });
          p.select = fn;
          p.eq = fn;
          p.neq = fn;
          p.in = fn;
          p.order = fn;
          return p;
        };
        return fn();
      }
      return createResolvedChain([]);
    });

    render(<ClinicTeamSection />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Falha na conexão com o banco de dados")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /tentar novamente/i });
    expect(retryBtn).toBeInTheDocument();

    shouldFail = false;
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText("Colaboradores e acessos")).toBeInTheDocument();
    });
  });
});
