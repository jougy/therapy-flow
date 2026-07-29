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
    const submitBtn = screen.getByRole("button", { name: /Salvar e Continuar/i });
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

  it("displays explicit error message from Supabase when handle_signup fails", async () => {
    vi.mocked(useAuth).mockReturnValue({
      clinic: null,
      profile: { cpf: "12345678901" },
      session: { user: { id: "user-1", email: "test@example.com" } },
    } as unknown as ReturnType<typeof useAuth>);

    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Já existe uma clínica cadastrada com este CPF/CNPJ." },
    });

    render(
      <MemoryRouter initialEntries={["/onboarding-clinica?plan=solo"]}>
        <OnboardingClinica />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nome da Clínica/i), { target: { value: "Minha Clínica" } });
    fireEvent.change(screen.getByLabelText(/Logradouro/i), { target: { value: "Rua A" } });
    fireEvent.change(screen.getByLabelText(/Cidade/i), { target: { value: "São Paulo" } });
    fireEvent.change(screen.getByLabelText(/UF/i), { target: { value: "SP" } });

    fireEvent.click(screen.getByRole("button", { name: /Salvar e Continuar/i }));

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("handle_signup", expect.anything());
    });
  });
});
