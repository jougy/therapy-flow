import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Configuracoes from "@/pages/Configuracoes";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const createQueryBuilder = (table: string) => {
    const resolveData = () => {
      switch (table) {
        case "user_security_settings":
          return null;
        case "clinic_memberships":
          return [
            {
              account_role: "account_owner",
              clinic_id: "clinic-1",
              created_at: "2026-03-30T12:00:00.000Z",
              ended_at: null,
              id: "membership-owner",
              invited_by: null,
              is_active: true,
              joined_at: "2026-03-30T12:00:00.000Z",
              membership_status: "active",
              operational_role: "owner",
              updated_at: "2026-03-30T12:00:00.000Z",
              user_id: "owner-1",
            },
            {
              account_role: null,
              clinic_id: "clinic-1",
              created_at: "2026-03-30T13:00:00.000Z",
              ended_at: null,
              id: "membership-1",
              invited_by: "owner-1",
              is_active: true,
              joined_at: "2026-03-30T13:00:00.000Z",
              membership_status: "active",
              operational_role: "estagiario",
              updated_at: "2026-03-30T13:00:00.000Z",
              user_id: "user-1",
            },
          ];
        case "profiles":
          return [
            {
              address: {
                cep: "01310-930",
                city: "Sao Paulo",
                complement: "Sala 10",
                neighborhood: "Bela Vista",
                number: "100",
                state: "SP",
                street: "Av. Paulista",
              },
              birth_date: "1990-01-01",
              cpf: "12345678901",
              email: "owner@aurora.test",
              full_name: "Alice",
              id: "owner-1",
              job_title: "Owner",
              last_password_changed_at: null,
              last_seen_at: "2026-03-31T12:00:00.000Z",
              password_temporary: false,
              phone: "11999998888",
              professional_license: "CREFITO 123",
              public_code: "A-001",
              social_name: "Alice Aurora",
              specialty: null,
              working_hours: null,
            },
            {
              address: null,
              birth_date: null,
              cpf: null,
              email: "estagiario@aurora.test",
              full_name: "Bianca",
              id: "user-1",
              job_title: "Estagiário",
              last_password_changed_at: null,
              last_seen_at: "2026-03-31T12:04:00.000Z",
              password_temporary: false,
              phone: null,
              professional_license: null,
              public_code: "B-001",
              social_name: null,
              specialty: null,
              working_hours: null,
            },
          ];
        case "clinics":
          return {
            account_owner_user_id: "owner-1",
            address: null,
            anamnesis_base_schema: [
              { id: "base-section", label: "Base", type: "section" },
              { groupKey: "base-section", id: "base-field", label: "Queixa", type: "long_text" },
            ],
            business_hours: null,
            concurrent_access_limit: 4,
            email: "contato@aurora.test",
            legal_name: "Clinica Aurora LTDA",
            logo_url: null,
            name: "Clinica Aurora",
            phone: "11999999999",
            subaccount_limit: 4,
          };
        case "anamnesis_form_templates":
          return [
            {
              clinic_id: "clinic-1",
              created_at: "2026-03-30T12:00:00.000Z",
              description: "Triagem padrão",
              id: "template-1",
              is_active: true,
              is_system_default: false,
              name: "Ficha ortopédica",
              schema: [
                { id: "section_1", label: "Contexto", type: "section" },
                { groupKey: "section_1", id: "field_1", label: "Queixa", type: "long_text" },
              ],
              updated_at: "2026-03-30T12:00:00.000Z",
              user_id: "owner-1",
            },
          ];
        case "sessions":
          return [
            {
              anamnesis_template_id: "template-1",
              provider_id: "owner-1",
              session_date: "2026-03-31",
              status: "draft",
              user_id: "owner-1",
            },
          ];
        default:
          return [];
      }
    };

    const builder = {
      delete: () => builder,
      eq: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve({ data: resolveData(), error: null }),
      or: () => builder,
      order: () => builder,
      select: () => builder,
      single: () => Promise.resolve({ data: resolveData(), error: null }),
      update: () => builder,
      then: (resolve: (value: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: resolveData(), error: null }).then(resolve, reject),
    };

    return builder;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => createQueryBuilder(table)),
      rpc: vi.fn((fn: string) => {
        if (fn === "get_clinic_concurrent_access_overview") {
          return Promise.resolve({
            data: {
              active_sessions: [
                {
                  browser: "Chrome",
                  device_label: "Chrome • macOS",
                  last_seen_at: "2026-03-31T12:05:00.000Z",
                  platform: "macOS",
                  session_key: "session-1",
                  user_id: "user-1",
                },
              ],
              available: 4,
              limit: 4,
              occupied: 1,
              reached: false,
            },
            error: null,
          });
        }

        if (fn === "end_clinic_user_security_sessions") {
          return Promise.resolve({ data: { ended_count: 1 }, error: null });
        }

        return Promise.resolve({ data: null, error: null });
      }),
    },
  };
});

const buildUseAuthMock = (overrides = {}) => ({
  accountRole: "account_owner",
  can: (capability: string) => capability !== "treasury.manage",
  capabilities: {} as never,
  clinic: {
    account_owner_user_id: "owner-1",
    id: "clinic-1",
    logo_url: null,
    name: "Clinica Aurora",
    concurrent_access_limit: 4,
    subaccount_limit: 4,
    subscription_plan: "clinic",
  },
  clinicId: "clinic-1",
  isSuperAdmin: false,
  loading: false,
  membership: null,
  membershipStatus: "active",
  operationalRole: "owner",
  profile: {
    address: {
      cep: "01310-930",
      city: "Sao Paulo",
      complement: "Sala 10",
      neighborhood: "Bela Vista",
      number: "100",
      state: "SP",
      street: "Av. Paulista",
    },
    avatar_url: null,
    bio: null,
    birth_date: "1990-01-01",
    clinic_id: "clinic-1",
    cpf: "12345678901",
    email: "owner@aurora.test",
    full_name: "Alice",
    job_title: null,
    last_password_changed_at: null,
    last_seen_at: null,
    password_temporary: false,
    phone: "11999998888",
    professional_license: "CREFITO 123",
    public_code: "A-001",
    social_name: "Alice Aurora",
    specialty: null,
    working_hours: null,
  },
  refreshAuthState: vi.fn(async () => {}),
  session: {
    access_token: "token",
  } as never,
  signOut: vi.fn(async () => {}),
  subscriptionPlan: "clinic",
  user: {
    email: "owner@aurora.test",
    id: "owner-1",
  } as never,
  ...overrides,
});

describe("Configuracoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(buildUseAuthMock() as ReturnType<typeof useAuth>);

    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === "get_clinic_concurrent_access_overview") {
        return Promise.resolve({
          data: {
            active_sessions: [
              {
                browser: "Chrome",
                device_label: "Chrome • macOS",
                last_seen_at: "2026-03-31T12:05:00.000Z",
                platform: "macOS",
                session_key: "session-1",
                user_id: "user-1",
              },
            ],
            available: 4,
            limit: 4,
            occupied: 1,
            reached: false,
          },
          error: null,
        });
      }

      if (fn === "end_clinic_user_security_sessions") {
        return Promise.resolve({ data: { ended_count: 1 }, error: null });
      }

      return Promise.resolve({ data: null, error: null });
    });
  });

  it("renders the settings page and opens support without crashing", async () => {
    render(
      <MemoryRouter initialEntries={["/configuracoes"]}>
        <Configuracoes />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Configurações")).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: /suporte/i })[0]);
    expect(screen.getByText("Abrir contato")).toBeInTheDocument();
    expect(screen.getByText("jougy@gmx.com")).toBeInTheDocument();
  });

  it("shows simultaneous access language for clinic team settings", async () => {
    render(
      <MemoryRouter initialEntries={["/configuracoes"]}>
        <Configuracoes />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Configurações")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Colaboradores e acessos" }));

    await waitFor(() => {
      expect(screen.getByText("Limite atual de acessos simultâneos")).toBeInTheDocument();
    });

    expect(screen.queryByText("Limite atual de subcontas")).not.toBeInTheDocument();
  });

  it("keeps rendering when the concurrent access overview RPC is unavailable", async () => {
    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === "get_clinic_concurrent_access_overview") {
        return Promise.resolve({
          data: null,
          error: { message: "function public.get_clinic_concurrent_access_overview does not exist" },
        });
      }

      return Promise.resolve({ data: null, error: null });
    });

    render(
      <MemoryRouter initialEntries={["/configuracoes"]}>
        <Configuracoes />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Configurações")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Colaboradores e acessos" }));

    await waitFor(() => {
      expect(screen.getByText("Limite atual de acessos simultâneos")).toBeInTheDocument();
    });
  });

  it("shows estagiario role help and operational role controls for team admins", async () => {
    render(
      <MemoryRouter initialEntries={["/configuracoes"]}>
        <Configuracoes />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Configurações")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Colaboradores e acessos" }));

    expect(screen.getByText("Estagiário")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /explicar os papéis operacionais/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar colaborador")).toBeInTheDocument();
  });

  it("shows import and export controls in manage forms", async () => {
    render(
      <MemoryRouter initialEntries={["/configuracoes"]}>
        <Configuracoes />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Configurações")).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: /gerenciar formulários/i })[0]);

    await waitFor(() => expect(screen.getByText("Bloco padrão universal")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /importar modelo/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /exportar modelo/i }).length).toBeGreaterThan(0);
  });

  it("shows fixed profile actions only after editing and allows canceling changes", async () => {
    render(
      <MemoryRouter initialEntries={["/configuracoes"]}>
        <Configuracoes />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Configurações")).toBeInTheDocument());
    expect(screen.queryByRole("region", { name: /ações de edição/i })).not.toBeInTheDocument();

    const ownEmailInput = screen.getByDisplayValue("owner@aurora.test");
    fireEvent.change(ownEmailInput, { target: { value: "novo@aurora.test" } });

    const floatingActions = screen.getByRole("region", { name: /ações de edição/i });
    expect(within(floatingActions).getByRole("button", { name: "Salvar perfil" })).toBeInTheDocument();

    fireEvent.click(within(floatingActions).getByRole("button", { name: "Cancelar" }));

    expect(screen.getByDisplayValue("owner@aurora.test")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /ações de edição/i })).not.toBeInTheDocument();
  });

  it("keeps prefilled own profile fields editable for the clinic owner", async () => {
    render(
      <MemoryRouter initialEntries={["/configuracoes"]}>
        <Configuracoes />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Configurações")).toBeInTheDocument());

    expect(screen.getByText(/como owner da clínica, você pode ajustar seus dados cadastrais/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alice")).not.toBeDisabled();
    expect(screen.getByDisplayValue("Alice Aurora")).not.toBeDisabled();
    expect(screen.getByDisplayValue("1990-01-01")).not.toBeDisabled();
    expect(screen.getByDisplayValue("123.456.789-01")).not.toBeDisabled();
    expect(screen.getByDisplayValue("(11) 99999-8888")).not.toBeDisabled();
    expect(screen.getByDisplayValue("CREFITO 123")).not.toBeDisabled();
    expect(screen.getByDisplayValue("01310-930")).not.toBeDisabled();
    expect(screen.getByDisplayValue("Av. Paulista")).not.toBeDisabled();
  });

  it("keeps prefilled own profile fields editable for the operational owner without account owner role", async () => {
    vi.mocked(useAuth).mockReturnValue(
      buildUseAuthMock({
        accountRole: null,
        operationalRole: "owner",
      }) as ReturnType<typeof useAuth>
    );

    render(
      <MemoryRouter initialEntries={["/configuracoes"]}>
        <Configuracoes />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Configurações")).toBeInTheDocument());

    expect(screen.getByText(/como owner da clínica, você pode ajustar seus dados cadastrais/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alice")).not.toBeDisabled();
    expect(screen.getByDisplayValue("Av. Paulista")).not.toBeDisabled();
  });

  it("keeps prefilled own profile fields editable for clinic admins", async () => {
    vi.mocked(useAuth).mockReturnValue(
      buildUseAuthMock({
        accountRole: null,
        operationalRole: "admin",
      }) as ReturnType<typeof useAuth>
    );

    render(
      <MemoryRouter initialEntries={["/configuracoes"]}>
        <Configuracoes />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Configurações")).toBeInTheDocument());

    expect(screen.getByText(/como administrador da clínica, você pode ajustar seus dados cadastrais/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alice")).not.toBeDisabled();
    expect(screen.getByDisplayValue("Av. Paulista")).not.toBeDisabled();
  });

  it("shows fixed clinic actions only after editing and allows canceling changes", async () => {
    render(
      <MemoryRouter initialEntries={["/configuracoes"]}>
        <Configuracoes />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Configurações")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Perfil da clínica" }));

    const clinicNameInput = await screen.findByDisplayValue("Clinica Aurora");
    fireEvent.change(clinicNameInput, { target: { value: "Clinica Aurora Prime" } });

    const floatingActions = screen.getByRole("region", { name: /ações de edição/i });
    expect(within(floatingActions).getByRole("button", { name: "Salvar perfil da clínica" })).toBeInTheDocument();

    fireEvent.click(within(floatingActions).getByRole("button", { name: "Cancelar" }));

    expect(screen.getByDisplayValue("Clinica Aurora")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /ações de edição/i })).not.toBeInTheDocument();
  });

  it("shows fixed collaborator actions only after editing and allows canceling the draft", async () => {
    render(
      <MemoryRouter initialEntries={["/configuracoes"]}>
        <Configuracoes />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Configurações")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Colaboradores e acessos" }));
    fireEvent.click(screen.getByRole("button", { name: /editar campos/i }));

    const collaboratorNameInput = await screen.findByDisplayValue("Bianca");
    fireEvent.change(collaboratorNameInput, { target: { value: "Bianca Nova" } });

    const floatingActions = screen.getByRole("region", { name: /ações de edição/i });
    expect(within(floatingActions).getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();

    fireEvent.click(within(floatingActions).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByDisplayValue("Bianca Nova")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /ações de edição/i })).not.toBeInTheDocument();
  });

  it("limits oversized clinic and support text inputs before they become payloads", async () => {
    render(
      <MemoryRouter initialEntries={["/configuracoes"]}>
        <Configuracoes />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Configurações")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Perfil da clínica" }));
    const clinicNameInput = await screen.findByDisplayValue("Clinica Aurora");
    fireEvent.change(clinicNameInput, { target: { value: `Clinica ${"😀".repeat(300)}` } });
    expect(Array.from((clinicNameInput as HTMLInputElement).value)).toHaveLength(120);

    fireEvent.click(screen.getAllByRole("button", { name: /suporte/i })[0]);
    const supportMessage = await screen.findByPlaceholderText("Descreva o problema, a dúvida ou a melhoria sugerida.");
    fireEvent.change(supportMessage, { target: { value: `Linha 1\u0000\r\n${"A".repeat(5000)}` } });

    expect((supportMessage as HTMLTextAreaElement).value).not.toContain("\u0000");
    expect(Array.from((supportMessage as HTMLTextAreaElement).value).length).toBeLessThanOrEqual(2000);
  });
});
