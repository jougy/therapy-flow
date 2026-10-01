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
    expect(screen.getByText(/Planos que cabem no momento do seu trabalho/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Para Profissional/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Para Clínica/i })).toBeInTheDocument();
    // Default audience is 'prof', with Básico, Médio and Top
    expect(screen.getByRole("heading", { name: /^Básico$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Médio$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Top$/i })).toBeInTheDocument();

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

    // Default is annual: prof_medio is R$ 44,99/mês, prof_basico is R$ 26,66/mês
    expect(screen.getAllByText(/44[,.]99/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/26[,.]66/i).length).toBeGreaterThan(0);

    // Click Mensal
    const monthlyBtn = screen.getByRole("button", { name: /^Mensal$/i });
    fireEvent.click(monthlyBtn);

    // prof_medio should become R$ 59,99/mês, prof_basico R$ 39,99/mês
    expect(screen.getAllByText(/59[,.]99/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/39[,.]99/i).length).toBeGreaterThan(0);

    // Click Trimestral
    const quarterlyBtn = screen.getByRole("button", { name: /Trimestral/i });
    fireEvent.click(quarterlyBtn);

    // prof_medio should become R$ 53,99/mês, prof_basico R$ 35,99/mês
    expect(screen.getAllByText(/53[,.]99/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/35[,.]99/i).length).toBeGreaterThan(0);
  });

  it("switches to Teste gratuito (7 dias) cycle and displays single Clínica Médio option", async () => {
    render(
      <MemoryRouter>
        <PlanosAssinatura />
      </MemoryRouter>
    );

    const freeCycleBtn = screen.getByRole("button", { name: /Teste gratuito \(7 dias\)/i });
    fireEvent.click(freeCycleBtn);

    expect(screen.getAllByText(/Grátis/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Clínica Médio/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Iniciar Teste Gratuito \(7 dias\)/i })).toBeInTheDocument();
    // Paid selection buttons should not be present
    expect(screen.queryByRole("button", { name: /Escolher Básico/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Escolher Top/i })).not.toBeInTheDocument();
  });

  it("switches audience to Para Clínica and increments/decrements extra seats for clinic plans", async () => {
    render(
      <MemoryRouter>
        <PlanosAssinatura />
      </MemoryRouter>
    );

    // Switch to Clinic audience
    const clinicTab = screen.getByRole("tab", { name: /Para Clínica/i });
    fireEvent.click(clinicTab);

    // Should see Clinic base seats labels
    expect(screen.getByText(/Base 4 acessos/i)).toBeInTheDocument();
    expect(screen.getByText(/Base 2 acessos/i)).toBeInTheDocument();
    expect(screen.getByText(/Base 8 acessos/i)).toBeInTheDocument();

    // Click '+' to add extra seat on clinic plans
    const plusButtons = screen.getAllByRole("button", { name: /Aumentar acessos simultâneos/i });
    expect(plusButtons.length).toBeGreaterThan(0);
    fireEvent.click(plusButtons[0]);

    expect(screen.getAllByText(/\+1/i).length).toBeGreaterThan(0);

    // Click '-' to decrease
    const minusButtons = screen.getAllByRole("button", { name: /Diminuir acessos simultâneos/i });
    fireEvent.click(minusButtons[0]);

    expect(screen.getAllByText(/\+0/i).length).toBeGreaterThan(0);
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
      expect(screen.queryByRole("button", { name: /Teste gratuito \(7 dias\)/i })).not.toBeInTheDocument();
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

    const freeCycleBtn = screen.getByRole("button", { name: /Teste gratuito \(7 dias\)/i });
    fireEvent.click(freeCycleBtn);

    const activateTrialBtn = screen.getByRole("button", { name: /Iniciar Teste Gratuito \(7 dias\)/i });
    fireEvent.click(activateTrialBtn);

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("activate_clinic_free_trial", {
        _clinic_id: "clinic-test-1",
        _plan_type: "clinica_medio",
      });
    });
  });

  it("opens PlanDetailsModal when clicking 'Ver detalhes e comparativo'", async () => {
    render(
      <MemoryRouter>
        <PlanosAssinatura />
      </MemoryRouter>
    );

    const detailsButtons = screen.getAllByRole("button", { name: /Ver detalhes e comparativo/i });
    expect(detailsButtons.length).toBeGreaterThanOrEqual(3);

    // Click on the first one (Básico)
    fireEvent.click(detailsButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Profissional Básico/i })).toBeInTheDocument();
      expect(screen.getAllByText(/Capacidade & Acessos/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Recursos Clínicos/i).length).toBeGreaterThan(0);
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

