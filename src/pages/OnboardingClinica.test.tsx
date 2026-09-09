import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingClinica from "@/pages/OnboardingClinica";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

const asaasMocks = vi.hoisted(() => ({
  createClinicWithVerifiedCard: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  },
}));

vi.mock("@/services/asaasService", () => ({
  createClinicWithVerifiedCard: asaasMocks.createClinicWithVerifiedCard,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: vi.fn(),
}));

describe("OnboardingClinica", () => {
  const fillValidCard = () => {
    fireEvent.change(screen.getByLabelText(/Nome Impresso no Cartão/i), { target: { value: "DRA MARIA SILVA" } });
    fireEvent.change(screen.getByLabelText(/Número do Cartão/i), { target: { value: "4111 1111 1111 1111" } });
    fireEvent.change(screen.getByLabelText(/Validade/i), { target: { value: "12/30" } });
    fireEvent.change(screen.getByLabelText(/Código de Segurança/i), { target: { value: "123" } });
  };

  beforeEach(() => {
    supabaseMocks.from.mockReset();
    supabaseMocks.rpc.mockReset();
    asaasMocks.createClinicWithVerifiedCard.mockReset();
    asaasMocks.createClinicWithVerifiedCard.mockResolvedValue({
      success: true,
      clinic_id: "new-solo-clinic-id",
      clinic_name: "Consultório Dra. Maria Solo",
      creditCardToken: "tok_card_123",
      source: "EDGE_FUNCTION",
    });
    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: {},
      loading: false,
      isFeatureEnabled: vi.fn().mockReturnValue(true),
      flagOverrides: {},
      setFlagOverride: vi.fn(),
      resetFlagOverrides: vi.fn(),
    });
  });

  it("does not render the obsolete plan summary card", () => {
    vi.mocked(useAuth).mockReturnValue({
      clinic: null,
      profile: { cpf: "12345678901" },
      session: { user: { id: "user-1", email: "user@exemplo.com" } },
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/onboarding-clinica?plan=solo"]}>
        <OnboardingClinica />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Resumo do Plano Selecionado/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/DIGITE O CUPOM/i)).not.toBeInTheDocument();
  });

  it("renders credit card fields in create mode (isCreateMode=true)", () => {
    vi.mocked(useAuth).mockReturnValue({
      clinic: null,
      profile: { cpf: "12345678901" },
      session: { user: { id: "user-1", email: "user@exemplo.com" } },
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/onboarding-clinica?plan=solo"]}>
        <OnboardingClinica />
      </MemoryRouter>
    );

    expect(screen.getByText(/Cartão de Crédito para Ativação \(Obrigatório\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome Impresso no Cartão/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Número do Cartão/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Validade/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Código de Segurança/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verificar Cartão e Criar Clínica/i })).toBeInTheDocument();
  });

  it("blocks submission and keeps submit button disabled until terms of consent are accepted", async () => {
    vi.mocked(useAuth).mockReturnValue({
      clinic: null,
      profile: { cpf: "12345678901" },
      session: { user: { id: "user-1", email: "user@exemplo.com" } },
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/onboarding-clinica?plan=solo"]}>
        <OnboardingClinica />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nome da Clínica/i), { target: { value: "Minha Clínica Teste" } });
    fireEvent.change(screen.getByLabelText(/Logradouro/i), { target: { value: "Rua Teste" } });
    fireEvent.change(screen.getByLabelText(/Cidade/i), { target: { value: "São Paulo" } });
    fireEvent.change(screen.getByLabelText(/UF/i), { target: { value: "SP" } });

    const submitBtn = screen.getByRole("button", { name: /Verificar Cartão e Criar Clínica/i });
    expect(submitBtn).toBeDisabled();

    const termsCheckbox = screen.getByRole("checkbox");
    expect(termsCheckbox).not.toBeChecked();

    // Check the terms
    fireEvent.click(termsCheckbox);
    expect(termsCheckbox).toBeChecked();
    expect(submitBtn).not.toBeDisabled();
  });

  it("allows opening the TermsOfServiceModal and accepting terms from modal", async () => {
    vi.mocked(useAuth).mockReturnValue({
      clinic: null,
      profile: { cpf: "12345678901" },
      session: { user: { id: "user-1", email: "user@exemplo.com" } },
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/onboarding-clinica?plan=solo"]}>
        <OnboardingClinica />
      </MemoryRouter>
    );

    const openModalLink = screen.getByRole("button", { name: /Termos de Uso e Responsabilidade do Titular/i });
    fireEvent.click(openModalLink);

    expect(await screen.findByText(/Termos de Uso e Consentimento \(LGPD\)/i)).toBeInTheDocument();

    const acceptModalBtn = screen.getByRole("button", { name: /Li e Aceito os Termos/i });
    fireEvent.click(acceptModalBtn);

    const submitBtn = screen.getByRole("button", { name: /Verificar Cartão e Criar Clínica/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it("allows a subaccount user to create their own new clinic with verified card and calls createClinicWithVerifiedCard", async () => {
    const mockSelectClinic = vi.fn().mockResolvedValue(undefined);
    const mockRefreshAuthState = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useAuth).mockReturnValue({
      clinic: {
        account_owner_user_id: "other-owner-id",
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

    fireEvent.change(screen.getByLabelText(/Nome da Clínica/i), { target: { value: "Consultório Dra. Maria Solo" } });
    fireEvent.change(screen.getByLabelText(/Logradouro/i), { target: { value: "Rua Principal" } });
    fireEvent.change(screen.getByLabelText(/Cidade/i), { target: { value: "Manaus" } });
    fireEvent.change(screen.getByLabelText(/UF/i), { target: { value: "AM" } });

    fillValidCard();

    // Accept terms
    const termsCheckbox = screen.getByRole("checkbox");
    fireEvent.click(termsCheckbox);

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Verificar Cartão e Criar Clínica/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(asaasMocks.createClinicWithVerifiedCard).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_type: "solo",
          cpf_cnpj: "12345678901",
          clinic_data: expect.objectContaining({
            name: "Consultório Dra. Maria Solo",
          }),
          credit_card_data: expect.objectContaining({
            card: expect.objectContaining({
              holderName: "DRA MARIA SILVA",
              number: "4111111111111111",
              expiryMonth: "12",
              expiryYear: "2030",
              ccv: "123",
            }),
          }),
        })
      );
      expect(supabaseMocks.from).toHaveBeenCalledWith("profiles");
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        owner_terms_accepted_at: expect.any(String),
      }));
      expect(mockRefreshAuthState).toHaveBeenCalled();
      expect(mockSelectClinic).toHaveBeenCalledWith("new-solo-clinic-id");
    });
  });

  it("enforces minimum of 2 concurrent accesses for clinic plan", async () => {
    vi.mocked(useAuth).mockReturnValue({
      clinic: null,
      profile: { cpf: "12345678901" },
      session: { user: { id: "user-clinic-1", email: "clinic@exemplo.com" } },
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/onboarding-clinica?plan=clinic"]}>
        <OnboardingClinica />
      </MemoryRouter>
    );

    const concurrentInput = screen.getByLabelText(/Acessos Simultâneos/i);
    expect(concurrentInput).toHaveAttribute("min", "2");
  });

  it("shows confirmation dialog when owner attempts to create another clinic under duplicate CNPJ", async () => {
    vi.mocked(useAuth).mockReturnValue({
      clinic: null,
      profile: { cpf: "12345678901" },
      session: { user: { id: "user-owner-1", email: "owner@exemplo.com" } },
    } as unknown as ReturnType<typeof useAuth>);

    asaasMocks.createClinicWithVerifiedCard.mockResolvedValueOnce({
      success: false,
      error: "OWNER_HAS_CLINIC_WITH_CNPJ:Clínica Bem Estar Matriz",
      source: "EDGE_FUNCTION",
    });

    render(
      <MemoryRouter initialEntries={["/onboarding-clinica?plan=solo"]}>
        <OnboardingClinica />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nome da Clínica/i), { target: { value: "Clínica Bem Estar Filial" } });
    fireEvent.change(screen.getByLabelText(/CNPJ da Clínica/i), { target: { value: "59.955.007/0001-00" } });
    fireEvent.change(screen.getByLabelText(/Logradouro/i), { target: { value: "Rua Nova" } });
    fireEvent.change(screen.getByLabelText(/Cidade/i), { target: { value: "Manaus" } });
    fireEvent.change(screen.getByLabelText(/UF/i), { target: { value: "AM" } });

    fillValidCard();

    // Accept terms
    fireEvent.click(screen.getByRole("checkbox"));

    const submitBtn = screen.getByRole("button", { name: /Verificar Cartão e Criar Clínica/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/CNPJ Já Possui um Espaço Cadastrado/i)).toBeInTheDocument();
    expect(screen.getByText(/Clínica Bem Estar Matriz/i)).toBeInTheDocument();

    // Click confirm button
    asaasMocks.createClinicWithVerifiedCard.mockResolvedValueOnce({
      success: true,
      clinic_id: "filial-clinic-id",
      source: "EDGE_FUNCTION",
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    supabaseMocks.from.mockReturnValue({
      update: mockUpdate,
    });

    const confirmBtn = screen.getByRole("button", { name: /Sim, Criar Nova Unidade sob este CNPJ/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(asaasMocks.createClinicWithVerifiedCard).toHaveBeenLastCalledWith(
        expect.objectContaining({
          allow_duplicate_cnpj: true,
        })
      );
    });
  });

  it("updates existing clinic without requesting credit card when not in create mode", async () => {
    vi.mocked(useAuth).mockReturnValue({
      clinic: {
        id: "existing-clinic-123",
        account_owner_user_id: "owner-123",
        name: "Minha Clínica Antiga",
      },
      profile: { cpf: "11144477735" },
      session: { user: { id: "owner-123", email: "owner@exemplo.com" } },
    } as unknown as ReturnType<typeof useAuth>);

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    supabaseMocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "existing-clinic-123",
              name: "Minha Clínica Antiga",
              cnpj: "59.955.007/0001-00",
              address: {
                street: "Rua Teste",
                city: "São Paulo",
                state: "SP",
              },
            },
            error: null,
          }),
        }),
      }),
      update: mockUpdate,
    });

    render(
      <MemoryRouter initialEntries={["/onboarding-clinica"]}>
        <OnboardingClinica />
      </MemoryRouter>
    );

    // In edit mode, card section should NOT be displayed
    expect(screen.queryByText(/Cartão de Crédito para Ativação \(Obrigatório\)/i)).not.toBeInTheDocument();
    const saveBtn = screen.getByRole("button", { name: /Salvar Alterações/i });
    expect(saveBtn).toBeInTheDocument();

    // Accept terms if required
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(saveBtn.closest("form")!);

    await waitFor(() => {
      expect(supabaseMocks.from).toHaveBeenCalledWith("clinics");
      expect(mockUpdate).toHaveBeenCalled();
      expect(asaasMocks.createClinicWithVerifiedCard).not.toHaveBeenCalled();
    });
  });
});


