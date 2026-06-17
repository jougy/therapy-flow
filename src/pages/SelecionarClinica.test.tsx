import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SelecionarClinica from "@/pages/SelecionarClinica";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("SelecionarClinica", () => {
  beforeEach(() => {
    global.ResizeObserver = class ResizeObserver {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
    };
    navigateMock.mockReset();
    vi.mocked(supabase.from).mockReset();
  });

  const buildAuthMock = (overrides = {}) => ({
    accessibleClinics: [
      {
        activeAccessCount: 3,
        activeAccessUsers: [
          {
            device_label: "Chrome • Linux",
            email: "owner@example.com",
            full_name: "Owner Example",
            last_seen_at: new Date().toISOString(),
            user_id: "user-1",
          },
        ],
        clinic: {
          account_owner_user_id: "user-1",
          concurrent_access_limit: 4,
          id: "clinic-1",
          logo_url: null,
          name: "Clinica Aurora",
          route_key: "clinic-route-1",
          subaccount_limit: 4,
          subscription_plan: "clinic",
        },
        membership: {
          account_role: "account_owner",
          clinic_id: "clinic-1",
          created_at: "2026-05-29T00:00:00.000Z",
          ended_at: null,
          id: "membership-1",
          invited_by: null,
          is_active: true,
          joined_at: "2026-05-29T00:00:00.000Z",
          membership_status: "active",
          operational_role: "owner",
          updated_at: "2026-05-29T00:00:00.000Z",
          user_id: "user-1",
        },
      },
    ],
    accountRole: null,
    can: () => false,
    capabilities: {} as never,
    clinic: null,
    clinicId: null,
    isSuperAdmin: false,
    isPlatformOwner: false,
    loading: false,
    membership: null,
    membershipStatus: null,
    operationalRole: null,
    platformMfaVerified: false,
    profile: {
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
    },
    refreshAuthState: vi.fn(async () => {}),
    selectClinic: vi.fn(async () => {}),
    selectClinicByRouteKey: vi.fn(async () => {}),
    session: null,
    signOut: vi.fn(async () => {}),
    subscriptionPlan: null,
    user: { email: "owner@example.com", id: "user-1" } as never,
    ...overrides,
  });

  it("renders the personal panel and lets the user choose a clinic", async () => {
    const selectClinic = vi.fn(async () => {});
    const signOut = vi.fn(async () => {});

    vi.mocked(useAuth).mockReturnValue(buildAuthMock({ selectClinic, signOut }) as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/espacopessoal"]}>
        <SelecionarClinica />
      </MemoryRouter>
    );

    expect(screen.getByText("Espaço pessoal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clínicas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /minhas estatísticas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /novidades/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Configurações$/i })).toBeInTheDocument();
    expect(screen.getAllByText("Owner Example").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /ver acessos online/i })).toHaveTextContent("3/4");

    fireEvent.click(screen.getAllByRole("button", { name: /abrir configurações pessoais/i })[0]!);
    expect(navigateMock).toHaveBeenCalledWith("/configuracoes?secao=profile&origem=pessoal");

    fireEvent.click(screen.getAllByRole("button", { name: /clinica aurora/i })[0]!);

    await waitFor(() => expect(selectClinic).toHaveBeenCalledWith("clinic-1"));
    expect(navigateMock).toHaveBeenCalledWith("/clinica/clinic-route-1", { replace: true });
  });

  it("shows online access details for each clinic", () => {
    vi.mocked(useAuth).mockReturnValue(buildAuthMock() as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/espacopessoal"]}>
        <SelecionarClinica />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /ver acessos online/i }));

    expect(screen.getByText("Acessos online")).toBeInTheDocument();
    expect(screen.getByText(/3 de 4 em uso/i)).toBeInTheDocument();
    expect(screen.getAllByText("Owner Example")).toHaveLength(2);
  });

  it("shows attendance metrics in personal statistics", async () => {
    const sessionsQuery = {
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            clinic_id: "clinic-1",
            group_id: "group-1",
            id: "session-1",
            patient_id: "patient-1",
            session_date: new Date().toISOString(),
            status: "concluido",
          },
          {
            clinic_id: "clinic-1",
            group_id: "group-1",
            id: "session-2",
            patient_id: "patient-1",
            session_date: new Date().toISOString(),
            status: "concluido",
          },
          {
            clinic_id: "clinic-1",
            group_id: "group-2",
            id: "session-3",
            patient_id: "patient-2",
            session_date: new Date().toISOString(),
            status: "concluido",
          },
          {
            clinic_id: "clinic-1",
            group_id: "group-2",
            id: "session-draft",
            patient_id: "patient-3",
            session_date: new Date().toISOString(),
            status: "rascunho",
          },
        ],
        error: null,
      }),
      order: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    };
    const groupsQuery = {
      in: vi.fn().mockResolvedValue({
        data: [
          { color: "sky", id: "group-1", name: "Terapia manual" },
          { color: "sage", id: "group-2", name: "Retorno" },
        ],
        error: null,
      }),
      select: vi.fn().mockReturnThis(),
    };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(sessionsQuery as never)
      .mockReturnValueOnce(groupsQuery as never);
    vi.mocked(useAuth).mockReturnValue(buildAuthMock() as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/espacopessoal"]}>
        <SelecionarClinica />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /minhas estatísticas/i }));

    await waitFor(() => expect(screen.getByText("Quantidade de atendimentos")).toBeInTheDocument());

    expect(screen.getByText("Total de pacientes atendidos")).toBeInTheDocument();
    expect(screen.getByText("Total de atendimentos")).toBeInTheDocument();
    expect(screen.getByText("Top 5 grupos de atendimentos")).toBeInTheDocument();
    expect(screen.getByText("Grupos recorrentes por semana do mês")).toBeInTheDocument();
    expect(screen.getByText("Terapia manual")).toBeInTheDocument();
    expect(screen.getByText("Retorno")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("opens the platform panel from the clinics section for platform owners", () => {
    vi.mocked(useAuth).mockReturnValue(buildAuthMock({
      accessibleClinics: [],
      isPlatformOwner: true,
      platformMfaVerified: true,
      profile: {
        address: null,
        avatar_url: null,
        bio: null,
        birth_date: null,
        clinic_id: null,
        cpf: null,
        email: "master@example.com",
        full_name: "Master User",
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
      },
      user: { email: "master@example.com", id: "master-user" } as never,
    }) as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/espacopessoal"]}>
        <SelecionarClinica />
      </MemoryRouter>
    );

    expect(screen.getByText("Use o painel administrativo global para acessar clínicas como suporte.")).toBeInTheDocument();
    expect(screen.queryByText("Escolha a clínica")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhuma clínica ativa encontrada")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /abrir painel global/i }));
    expect(navigateMock).toHaveBeenCalledWith("/platform");
  });

  it("renders release notes in the personal news panel", async () => {
    const releasesQuery = {
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: "release-1",
            published_at: "2026-06-08T12:00:00.000Z",
            summary: "Resumo",
            title: "Atualização",
            version: "alfa-26.06.08-1",
            version_order: 2026060801,
          },
        ],
        error: null,
      }),
      order: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    };
    const itemsQuery = {
      order: vi.fn().mockResolvedValue({
        data: [
          {
            body: "Novo painel de novidades.",
            category: "added",
            id: "item-1",
            release_id: "release-1",
            sort_order: 1,
            title: "Painel de novidades",
          },
          {
            body: "Correção importante.",
            category: "fixed",
            id: "item-2",
            release_id: "release-1",
            sort_order: 2,
            title: "Correção de acesso",
          },
        ],
        error: null,
      }),
      select: vi.fn().mockReturnThis(),
    };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(releasesQuery as never)
      .mockReturnValueOnce(itemsQuery as never);
    vi.mocked(useAuth).mockReturnValue(buildAuthMock() as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/espacopessoal"]}>
        <SelecionarClinica />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /novidades/i }));

    await waitFor(() => expect(screen.getByText("Painel de novidades")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /reparado/i }));
    expect(screen.getByText("Correção de acesso")).toBeInTheDocument();
  });

  it("opens personal settings from the lateral menu", async () => {
    vi.mocked(useAuth).mockReturnValue(buildAuthMock() as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/espacopessoal"]}>
        <SelecionarClinica />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /^Configurações$/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/configuracoes?secao=profile&origem=pessoal"));
  });

  it("asks before signing out from the personal panel", () => {
    const signOut = vi.fn(async () => {});
    vi.mocked(useAuth).mockReturnValue(buildAuthMock({ signOut }) as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/espacopessoal"]}>
        <SelecionarClinica />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /^sair$/i }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/voltará para a tela inicial de login/i)).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /sair da conta/i }));

    expect(signOut).toHaveBeenCalled();
  });
});
