import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformCouponsManager } from "@/components/platform/PlatformCouponsManager";

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

describe("PlatformCouponsManager", () => {
  const mockCoupons = [
    {
      id: "coupon-1",
      code: "SOUPLURIBETA",
      description: "Acesso Beta Gratuito por 6 Meses",
      discount_type: "TRIAL_DAYS",
      discount_value: 180,
      discount_duration_type: "FOREVER",
      discount_duration_months: null,
      max_redemptions: null,
      times_redeemed: 5,
      valid_from: "2026-01-01T00:00:00Z",
      valid_until: null,
      is_active: true,
      applicable_plans: null,
      eligibility_rules: {
        first_subscription_only: true,
        collaborators: { enabled: true, operator: "gte", value: 3 },
      },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "coupon-2",
      code: "PROMO50",
      description: "50% OFF por 3 meses",
      discount_type: "PERCENTAGE",
      discount_value: 50,
      discount_duration_type: "REPEATING",
      discount_duration_months: 3,
      max_redemptions: 100,
      times_redeemed: 10,
      valid_from: "2026-01-01T00:00:00Z",
      valid_until: "2026-12-31T23:59:59Z",
      is_active: true,
      applicable_plans: ["clinic"],
      eligibility_rules: {
        sessions: { enabled: true, operator: "gte", value: 20 },
      },
      created_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    },
  ];

  let mockSelect: any;
  let mockInsert: any;
  let mockUpdate: any;
  let mockDelete: any;

  beforeEach(() => {
    supabaseMocks.from.mockReset();
    supabaseMocks.rpc.mockReset();

    mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mockSelect = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: mockCoupons, error: null }),
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "subscription_coupons") {
        return {
          select: mockSelect,
          insert: mockInsert,
          update: mockUpdate,
          delete: mockDelete,
        };
      }
      return { select: vi.fn() };
    });
  });

  it("renders KPIs, list of coupons, and badges correctly", async () => {
    render(<PlatformCouponsManager />);

    expect(await screen.findByText(/SOUPLURIBETA/i)).toBeInTheDocument();
    expect(screen.getByText(/PROMO50/i)).toBeInTheDocument();
    expect(screen.getAllByText(/50% OFF/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/180 dias grátis/i)).toBeInTheDocument();
    expect(screen.getByText(/Total de Cupons/i)).toBeInTheDocument();

    // Check badges
    expect(screen.getByText(/1ª Assinatura/i)).toBeInTheDocument();
    expect(screen.getByText(/Colabs ≥ 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Atendimentos ≥ 20/i)).toBeInTheDocument();
  });

  it("filters coupons by search query", async () => {
    render(<PlatformCouponsManager />);
    expect(await screen.findByText(/SOUPLURIBETA/i)).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Buscar por código ou descrição/i);
    fireEvent.change(searchInput, { target: { value: "PROMO" } });

    expect(screen.getByText(/PROMO50/i)).toBeInTheDocument();
    expect(screen.queryByText(/SOUPLURIBETA/i)).not.toBeInTheDocument();
  });

  it("opens create modal and saves new coupon with duration and eligibility rules", async () => {
    render(<PlatformCouponsManager />);

    const newBtn = await screen.findByRole("button", { name: /Novo Cupom/i });
    fireEvent.click(newBtn);

    expect(await screen.findByText(/Criar Novo Cupom Promocional/i)).toBeInTheDocument();

    // Fill Basic Tab
    const codeInput = screen.getByLabelText(/Código do Cupom/i);
    fireEvent.change(codeInput, { target: { value: "NOVOANUAL25" } });

    const descInput = screen.getByLabelText(/Descrição do Benefício/i);
    fireEvent.change(descInput, { target: { value: "25% OFF no plano anual" } });

    // Switch to Eligibility Tab
    const eligibilityTab = screen.getByRole("tab", { name: /3\. Condições da Conta/i });
    fireEvent.focus(eligibilityTab);
    fireEvent.keyDown(eligibilityTab, { key: "Enter" });
    fireEvent.click(eligibilityTab);

    expect(await screen.findByText(/Data de Cadastro da Clínica/i)).toBeInTheDocument();
    expect(screen.getByText(/Apenas Primeira Assinatura/i)).toBeInTheDocument();

    // Submit form
    const saveBtn = screen.getByRole("button", { name: /Criar Cupom/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.code).toBe("NOVOANUAL25");
      expect(insertCall.discount_type).toBe("PERCENTAGE");
      expect(insertCall.discount_duration_type).toBe("FOREVER");
    });
  });

  it("allows toggling coupon active status directly from table", async () => {
    render(<PlatformCouponsManager />);
    expect(await screen.findByText(/SOUPLURIBETA/i)).toBeInTheDocument();

    const switchToggle = screen.getByLabelText(/Alternar status do cupom SOUPLURIBETA/i);
    fireEvent.click(switchToggle);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
        })
      );
    });
  });

  it("allows duplicating an existing coupon", async () => {
    render(<PlatformCouponsManager />);
    expect(await screen.findByText(/SOUPLURIBETA/i)).toBeInTheDocument();

    const duplicateButtons = screen.getAllByTitle(/Duplicar \/ Clonar Cupom/i);
    fireEvent.click(duplicateButtons[0]);

    expect(await screen.findByText(/Criar Novo Cupom Promocional/i)).toBeInTheDocument();
    const codeInput = screen.getByLabelText(/Código do Cupom/i) as HTMLInputElement;
    expect(codeInput.value).toBe("SOUPLURIBETA_COPIA");
  });
});
