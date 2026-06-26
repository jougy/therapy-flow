import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppLayout from "@/components/AppLayout";
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

describe("AppLayout", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  const setupAuthMock = () => {
    const signOut = vi.fn(async () => {});
    const leaveClinic = vi.fn(async () => {});

    vi.mocked(useAuth).mockReturnValue({
      accessibleClinics: [],
      accountRole: null,
      can: () => false,
      capabilities: {} as never,
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
      clinicId: "clinic-1",
      isSuperAdmin: false,
      loading: false,
      leaveClinic,
      membership: null,
      membershipStatus: null,
      operationalRole: null,
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
      signOut,
      subscriptionPlan: "clinic",
      user: { email: "owner@example.com", id: "user-1" } as never,
    });

    return { leaveClinic, signOut };
  };

  it("opens personal settings from the user area and clinic settings from the gear", () => {
    setupAuthMock();

    render(
      <MemoryRouter>
        <AppLayout>
          <div>Conteúdo da clínica</div>
        </AppLayout>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /abrir configurações pessoais/i }));
    expect(navigateMock).toHaveBeenCalledWith("/clinica/clinic-route-1/configuracoes?secao=profile");

    fireEvent.click(screen.getByRole("button", { name: /editar clínica/i }));
    expect(navigateMock).toHaveBeenCalledWith("/clinica/clinic-route-1/configuracoes?secao=clinic");
  });

  it("hides clinic settings when personal settings were opened from the personal space", () => {
    const { signOut } = setupAuthMock();

    render(
      <MemoryRouter initialEntries={["/configuracoes?secao=profile&origem=pessoal"]}>
        <AppLayout>
          <div>Configurações pessoais</div>
        </AppLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: /abrir configurações pessoais/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar clínica/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /voltar ao painel pessoal/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ir para o espaço pessoal/i }));
    expect(navigateMock).toHaveBeenCalledWith("/espacopessoal");

    fireEvent.click(screen.getByRole("button", { name: /sair da conta/i }));
    expect(signOut).toHaveBeenCalled();
  });

  it("returns to the personal clinic selector without signing out", () => {
    const { leaveClinic, signOut } = setupAuthMock();

    render(
      <MemoryRouter>
        <AppLayout>
          <div>Conteúdo da clínica</div>
        </AppLayout>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /voltar ao painel pessoal/i }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/libera a vaga de acesso simultâneo/i)).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalledWith("/espacopessoal");

    fireEvent.click(screen.getByRole("button", { name: /voltar e liberar acesso/i }));
    expect(leaveClinic).toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
});
