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

describe("PlanosAssinatura (Bento Interativo)", () => {
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

  it("renders Bento plans page, allows entering coupon, and calculates real-time recurring price", async () => {
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

    // Verify main Bento title and controls
    expect(screen.getByText(/Um sistema que cresce com o seu atendimento/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Profissional Solo/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Clínica com Equipe/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Enterprise/i })).toBeInTheDocument();

    // Default step is Médio (featured)
    expect(screen.getByRole("heading", { name: /^Médio$/i })).toBeInTheDocument();
    expect(screen.getByText(/Bônus de lançamento incluso/i)).toBeInTheDocument();

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

    // Default is annual: prof_medio is R$ 57/mês
    expect(screen.getAllByText(/57/i).length).toBeGreaterThan(0);

    // Click Mensal
    const monthlyBtn = screen.getByRole("button", { name: /^Mensal$/i });
    fireEvent.click(monthlyBtn);

    // prof_medio should become R$ 87/mês
    expect(screen.getAllByText(/87/i).length).toBeGreaterThan(0);

    // Click Trimestral
    const quarterlyBtn = screen.getByRole("button", { name: /Trimestral/i });
    fireEvent.click(quarterlyBtn);

    // prof_medio should become R$ 67/mês
    expect(screen.getAllByText(/67/i).length).toBeGreaterThan(0);
  });

  it("switches plan using the interactive stepper (Básico, Médio, Top)", async () => {
    render(
      <MemoryRouter>
        <PlanosAssinatura />
      </MemoryRouter>
    );

    // Switch to Básico
    const basicoStepBtn = screen.getByRole("button", { name: /Básico/i });
    fireEvent.click(basicoStepBtn);
    expect(screen.getByRole("heading", { name: /^Básico$/i })).toBeInTheDocument();
    expect(screen.getByText(/Profissional autônomo iniciando consultório/i)).toBeInTheDocument();

    // Switch to Top
    const topStepBtn = screen.getByRole("button", { name: /Top/i });
    fireEvent.click(topStepBtn);
    expect(screen.getByRole("heading", { name: /^Top$/i })).toBeInTheDocument();
    expect(screen.getByText(/Máxima autonomia e apoio de secretária/i)).toBeInTheDocument();
  });

  it("switches audience to Para Clínica and increments/decrements extra seats for clinic plans", async () => {
    render(
      <MemoryRouter>
        <PlanosAssinatura />
      </MemoryRouter>
    );

    // Switch to Clinic audience
    const clinicTab = screen.getByRole("tab", { name: /Clínica com Equipe/i });
    fireEvent.click(clinicTab);

    // Should see Clinic base seats label
    expect(screen.getByText(/Base 4 acessos/i)).toBeInTheDocument();

    // Click '+' to add extra seat on clinic plan
    const plusButton = screen.getByRole("button", { name: /Aumentar acessos simultâneos/i });
    fireEvent.click(plusButton);

    expect(screen.getByText(/\+1/i)).toBeInTheDocument();

    // Click '-' to decrease
    const minusButton = screen.getByRole("button", { name: /Diminuir acessos simultâneos/i });
    fireEvent.click(minusButton);

    expect(screen.getByText(/\+0/i)).toBeInTheDocument();
  });

  it("switches to Enterprise profile and displays corporate solutions card with WhatsApp CTA", async () => {
    render(
      <MemoryRouter>
        <PlanosAssinatura />
      </MemoryRouter>
    );

    const enterpriseTab = screen.getByRole("tab", { name: /Enterprise/i });
    fireEvent.click(enterpriseTab);

    expect(screen.getByText(/Soluções corporativas sob medida/i)).toBeInTheDocument();
    expect(screen.getByText(/Migração Assistida VIP/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Contratar Enterprise/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Falar com consultor/i })).toBeInTheDocument();
  });

  it("opens PlanDetailsModal when clicking 'Ver detalhes e comparativo'", async () => {
    render(
      <MemoryRouter>
        <PlanosAssinatura />
      </MemoryRouter>
    );

    const detailsButton = screen.getByRole("button", { name: /Ver detalhes e comparativo/i });
    fireEvent.click(detailsButton);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Profissional Médio/i })).toBeInTheDocument();
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
