import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingClinica from "@/pages/OnboardingClinica";
import { useAuth } from "@/hooks/useAuth";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

describe("OnboardingClinica", () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset();
    supabaseMocks.rpc.mockReset();
  });

  it("allows a subaccount user to create their own new clinic when purchasing a solo plan", async () => {
    const mockSelectClinic = vi.fn().mockResolvedValue(undefined);
    const mockRefreshAuthState = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useAuth).mockReturnValue({
      clinic: {
        account_owner_user_id: "other-owner-id", // User is subaccount in Dr. Joao's clinic
        id: "employer-clinic-id",
        name: "Clínica do Empregador",
      },
      profile: {
        cpf: "12345678901",
        email: "colaborador@exemplo.com",
        full_name: "Dra. Maria Subconta",
      },
      session: {
        user: { id: "subaccount-user-id", email: "colaborador@exemplo.com" },
      },
      selectClinic: mockSelectClinic,
      refreshAuthState: mockRefreshAuthState,
    } as unknown as ReturnType<typeof useAuth>);

    supabaseMocks.rpc.mockResolvedValue({
      data: { clinic_id: "new-solo-clinic-id" },
      error: null,
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    supabaseMocks.from.mockReturnValue({
      update: mockUpdate,
    });

    render(
      <MemoryRouter initialEntries={["/onboarding-clinica?plan=solo"]}>
        <OnboardingClinica />
      </MemoryRouter>
    );

    // Fill in clinic name for the new clinic
    const nameInput = screen.getByLabelText(/Nome da Clínica/i);
    fireEvent.change(nameInput, { target: { value: "Consultório Dra. Maria Solo" } });

    // Fill in street and city
    const streetInput = screen.getByLabelText(/Logradouro/i);
    fireEvent.change(streetInput, { target: { value: "Rua Principal" } });

    const cityInput = screen.getByLabelText(/Cidade/i);
    fireEvent.change(cityInput, { target: { value: "Manaus" } });

    const stateInput = screen.getByLabelText(/UF/i);
    fireEvent.change(stateInput, { target: { value: "AM" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Ativar Assinatura no Asaas/i });
    fireEvent.click(submitBtn);

    // Verify button goes disabled with loading text immediately
    expect(submitBtn).toBeDisabled();

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("handle_signup", expect.objectContaining({
        _user_id: "subaccount-user-id",
        _subscription_plan: "solo",
        _clinic_name: "Consultório Dra. Maria Solo",
      }));
      expect(mockRefreshAuthState).toHaveBeenCalled();
      expect(mockSelectClinic).toHaveBeenCalledWith("new-solo-clinic-id");
    });
  });

  it("enforces minimum of 2 concurrent accesses for clinic plan and updates clinic payload", async () => {
    const mockSelectClinic = vi.fn().mockResolvedValue(undefined);
    const mockRefreshAuthState = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useAuth).mockReturnValue({
      clinic: null,
      profile: { cpf: "12345678901" },
      session: { user: { id: "user-clinic-1", email: "clinic@exemplo.com" } },
      selectClinic: mockSelectClinic,
      refreshAuthState: mockRefreshAuthState,
    } as unknown as ReturnType<typeof useAuth>);

    supabaseMocks.rpc.mockResolvedValue({
      data: { clinic_id: "new-team-clinic-id" },
      error: null,
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    supabaseMocks.from.mockReturnValue({
      update: mockUpdate,
    });

    render(
      <MemoryRouter initialEntries={["/onboarding-clinica?plan=clinic"]}>
        <OnboardingClinica />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nome da Clínica/i), { target: { value: "Clínica Equipe Alfa" } });
    fireEvent.change(screen.getByLabelText(/Logradouro/i), { target: { value: "Av. Brasil" } });
    fireEvent.change(screen.getByLabelText(/Cidade/i), { target: { value: "Curitiba" } });
    fireEvent.change(screen.getByLabelText(/UF/i), { target: { value: "PR" } });

    const concurrentInput = screen.getByLabelText(/Acessos Simultâneos/i);
    expect(concurrentInput).toHaveAttribute("min", "2");

    // Try setting 1, form should floor to 2
    fireEvent.change(concurrentInput, { target: { value: "1" } });

    const submitBtn = screen.getByRole("button", { name: /Ativar Assinatura no Asaas/i });
    const form = submitBtn.closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_plan: "clinic",
          subaccount_limit: 30,
          concurrent_access_limit: 2,
        })
      );
    });
  });

  it("shows confirmation dialog when owner attempts to create another clinic under same CNPJ", async () => {
    vi.mocked(useAuth).mockReturnValue({
      clinic: null,
      profile: { cpf: "12345678901" },
      session: { user: { id: "user-owner-1", email: "owner@exemplo.com" } },
    } as unknown as ReturnType<typeof useAuth>);

    supabaseMocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "OWNER_HAS_CLINIC_WITH_CNPJ:Clínica Bem Estar Matriz" },
    });

    render(
      <MemoryRouter initialEntries={["/onboarding-clinica?plan=solo"]}>
        <OnboardingClinica />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nome da Clínica/i), { target: { value: "Clínica Bem Estar Filial" } });
    fireEvent.change(screen.getByLabelText(/Logradouro/i), { target: { value: "Rua Nova" } });
    fireEvent.change(screen.getByLabelText(/Cidade/i), { target: { value: "Manaus" } });
    fireEvent.change(screen.getByLabelText(/UF/i), { target: { value: "AM" } });

    const submitBtn = screen.getByRole("button", { name: /Ativar Assinatura no Asaas/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/CNPJ Já Possui um Espaço Cadastrado/i)).toBeInTheDocument();
    expect(screen.getByText(/Clínica Bem Estar Matriz/i)).toBeInTheDocument();

    // Click confirm button
    supabaseMocks.rpc.mockResolvedValueOnce({
      data: { clinic_id: "filial-clinic-id" },
      error: null,
    });

    const confirmBtn = screen.getByRole("button", { name: /Sim, Criar Nova Unidade sob este CNPJ/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenLastCalledWith(
        "handle_signup",
        expect.objectContaining({
          _allow_duplicate_cnpj: true,
        })
      );
    });
  });
});
