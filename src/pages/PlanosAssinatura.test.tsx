import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlanosAssinatura from "@/pages/PlanosAssinatura";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: supabaseMocks.rpc,
    from: supabaseMocks.from,
  },
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: vi.fn(),
}));

describe("PlanosAssinatura", () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset();
    supabaseMocks.from.mockReset();
    supabaseMocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    vi.mocked(useFeatureFlags).mockReturnValue({
      isFeatureEnabled: () => true,
      loading: false,
    } as any);
  });

  it("renders plans page, allows entering coupon, and calculates real-time recurring price", async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: {
        valid: true,
        code: "BETA50",
        discount_type: "PERCENTAGE",
        discount_value: 50,
        description: "50% de desconto promocional Beta",
      },
      error: null,
    });

    render(
      <MemoryRouter>
        <PlanosAssinatura />
      </MemoryRouter>
    );

    // Verify main title and plans cards exist
    expect(screen.getByText(/Escolha o Plano Ideal para seu Espaço/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Profissional Solo/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Clínica Pro/i).length).toBeGreaterThan(0);

    // Enter coupon
    const couponInput = screen.getByPlaceholderText(/EX: PRIMEIROMES100/i);
    fireEvent.change(couponInput, { target: { value: "beta50" } });

    const applyBtn = screen.getByRole("button", { name: /Aplicar/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("validate_subscription_coupon", expect.objectContaining({
        _code: "BETA50",
      }));
      expect(screen.getByText(/50% OFF/i)).toBeInTheDocument();
    });
  });

  it("switches billing cycle and updates prices accurately", async () => {
    render(
      <MemoryRouter>
        <PlanosAssinatura />
      </MemoryRouter>
    );

    // Default is annual: Solo is R$ 44.00/mês
    expect(screen.getAllByText(/44.00/i).length).toBeGreaterThan(0);

    // Click Mensal
    const monthlyBtn = screen.getByRole("button", { name: /^Mensal$/i });
    fireEvent.click(monthlyBtn);

    // Solo should become R$ 59.00/mês
    expect(screen.getAllByText(/59.00/i).length).toBeGreaterThan(0);

    // Click Trimestral
    const quarterlyBtn = screen.getByRole("button", { name: /Trimestral/i });
    fireEvent.click(quarterlyBtn);

    // Solo should become R$ 53.00/mês
    expect(screen.getAllByText(/53.00/i).length).toBeGreaterThan(0);
  });

  it("switches to Degustação Grátis cycle and displays Grátis prices", async () => {
    render(
      <MemoryRouter>
        <PlanosAssinatura />
      </MemoryRouter>
    );

    const freeCycleBtn = screen.getByRole("button", { name: /Degustação Grátis/i });
    fireEvent.click(freeCycleBtn);

    expect(screen.getAllByText(/Grátis/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Ativar Degustação Solo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ativar Degustação Clínica/i })).toBeInTheDocument();
  });

  it("increments and decrements extra seats for clinic plan", async () => {
    render(
      <MemoryRouter>
        <PlanosAssinatura />
      </MemoryRouter>
    );

    // Initial base seats count: 4 acessos
    expect(screen.getAllByText(/4 acessos/i).length).toBeGreaterThan(0);

    // Click '+' to add extra seat on clinic plan
    const plusBtn = screen.getAllByRole("button", { name: /Aumentar acessos simultâneos/i })[0];
    fireEvent.click(plusBtn);

    expect(screen.getAllByText(/5 acessos/i).length).toBeGreaterThan(0);

    // Click '-' to decrease
    const minusBtn = screen.getAllByRole("button", { name: /Diminuir acessos simultâneos/i })[0];
    fireEvent.click(minusBtn);

    expect(screen.getAllByText(/4 acessos/i).length).toBeGreaterThan(0);
  });

  it("hides trial buttons/cycle if user already has an active paid subscription for existing clinic", async () => {
    supabaseMocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { status: "ACTIVE", is_free_trial: false },
            error: null,
          }),
        }),
      }),
    });

    render(
      <MemoryRouter initialEntries={["/planos?clinicId=clinic-active-1"]}>
        <PlanosAssinatura />
      </MemoryRouter>
    );

    // Initial render might show, wait for subscription check to complete and hide trial tab/cycle
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Degustação Grátis/i })).not.toBeInTheDocument();
    });
  });

  it("activates free trial plan via activate_clinic_free_trial RPC when trial button is clicked and clinic has card token", async () => {
    supabaseMocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { trial_card_token: "tok_verified_card_123" },
            error: null,
          }),
        }),
      }),
    });

    supabaseMocks.rpc.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/planos?clinicId=clinic-test-1"]}>
        <PlanosAssinatura />
      </MemoryRouter>
    );

    const freeCycleBtn = screen.getByRole("button", { name: /Degustação Grátis/i });
    fireEvent.click(freeCycleBtn);

    const activateSoloTrialBtn = screen.getByRole("button", { name: /Ativar Degustação Solo/i });
    fireEvent.click(activateSoloTrialBtn);

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("activate_clinic_free_trial", {
        _clinic_id: "clinic-test-1",
        _plan_type: "solo",
      });
    });
  });

  it("opens PlanDetailsModal when clicking 'Ver todos os recursos e detalhes'", async () => {
    render(
      <MemoryRouter>
        <PlanosAssinatura />
      </MemoryRouter>
    );

    const detailsButtons = screen.getAllByRole("button", { name: /Ver todos os recursos e detalhes/i });
    expect(detailsButtons.length).toBeGreaterThanOrEqual(3);

    // Click on the first one (Solo)
    fireEvent.click(detailsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Capacidade & Acessos/i)).toBeInTheDocument();
      expect(screen.getByText(/Prontuário & Formulários/i)).toBeInTheDocument();
    });
  });

  it("opens PlanFAQModal when clicking 'Dúvidas Frequentes & Garantias'", async () => {
    render(
      <MemoryRouter>
        <PlanosAssinatura />
      </MemoryRouter>
    );

    const faqBtn = screen.getByRole("button", { name: /Dúvidas Frequentes & Garantias/i });
    fireEvent.click(faqBtn);

    await waitFor(() => {
      expect(screen.getByText(/Perguntas Frequentes & Garantias/i)).toBeInTheDocument();
      expect(screen.getByText(/Preciso cadastrar cartão de crédito/i)).toBeInTheDocument();
    });
  });
});

