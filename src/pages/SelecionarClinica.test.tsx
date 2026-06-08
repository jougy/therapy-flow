import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SelecionarClinica from "@/pages/SelecionarClinica";
import { useAuth } from "@/hooks/useAuth";

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

describe("SelecionarClinica", () => {
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
      <MemoryRouter initialEntries={["/clinicas"]}>
        <SelecionarClinica />
      </MemoryRouter>
    );

    expect(screen.getByText("Espaço pessoal")).toBeInTheDocument();
    expect(screen.getByText("Owner Example")).toBeInTheDocument();
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
      <MemoryRouter initialEntries={["/clinicas"]}>
        <SelecionarClinica />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /ver acessos online/i }));

    expect(screen.getByText("Acessos online")).toBeInTheDocument();
    expect(screen.getByText(/3 de 4 em uso/i)).toBeInTheDocument();
    expect(screen.getAllByText("Owner Example")).toHaveLength(2);
  });

  it("shows personal reports instead of clinic list for platform owners", () => {
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
      <MemoryRouter initialEntries={["/clinicas"]}>
        <SelecionarClinica />
      </MemoryRouter>
    );

    expect(screen.getByText("Relatórios pessoais")).toBeInTheDocument();
    expect(screen.getByText("2FA validado")).toBeInTheDocument();
    expect(screen.getByText("Sem vínculo pessoal com clínicas específicas.")).toBeInTheDocument();
    expect(screen.queryByText("Escolha a clínica")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhuma clínica ativa encontrada")).not.toBeInTheDocument();
  });

  it("asks before signing out from the personal panel", () => {
    const signOut = vi.fn(async () => {});
    vi.mocked(useAuth).mockReturnValue(buildAuthMock({ signOut }) as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/clinicas"]}>
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
