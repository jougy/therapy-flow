import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureConfigModal } from "@/components/FeatureConfigModal";

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

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("FeatureConfigModal - Assinaturas", () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset();
    supabaseMocks.rpc.mockReset();

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    supabaseMocks.from.mockReturnValue({
      select: mockSelect,
    });
  });

  it("renders subscription_module official pricing matrix and security shield without exposing secrets", () => {
    render(
      <FeatureConfigModal
        featureKey="subscriptions_module"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Tabela de Preços e Ciclos Oficiais/i)).toBeInTheDocument();
    expect(screen.getByText(/Plano Profissional Solo/i)).toBeInTheDocument();
    expect(screen.getByText(/Plano Clínica com Equipe/i)).toBeInTheDocument();
    expect(screen.getByText(/Ambiente Seguro & Proteção de Credenciais/i)).toBeInTheDocument();
    expect(screen.getByText(/ASAAS_API_KEY/i)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$ 52,00/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$ 78,00/i).length).toBeGreaterThan(0);
  });

  it("renders subscription_free_trial_enabled config and allows customizing duration and max sessions", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });

    const onSave = vi.fn();
    render(
      <FeatureConfigModal
        featureKey="subscription_free_trial_enabled"
        isOpen={true}
        onClose={vi.fn()}
        onSave={onSave}
        initialData={{ trialDurationDays: 14, trialMaxSessions: 10 }}
      />
    );

    expect(screen.getByText(/Degustação Gratuita \(Trial Volumétrico \/ Free Tier\)/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("14")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: /Salvar configurações/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("upsert_feature_flag", expect.objectContaining({
        _key: "subscription_free_trial_enabled",
        _value: expect.objectContaining({
          trialDurationDays: 14,
          trialMaxSessions: 10,
        }),
      }));
      expect(onSave).toHaveBeenCalled();
    });
  });

  it("renders subscription_payment_methods config with PIX, card and boleto controls", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });

    const onSave = vi.fn();
    render(
      <FeatureConfigModal
        featureKey="subscription_payment_methods"
        isOpen={true}
        onClose={vi.fn()}
        onSave={onSave}
        initialData={{ allowPix: true, allowCreditCard: true, allowBoleto: false, pixDiscountPercent: 5 }}
      />
    );

    expect(screen.getByText(/Métodos de Pagamento Habilitados/i)).toBeInTheDocument();
    expect(screen.getByText(/PIX Instantâneo/i)).toBeInTheDocument();
    expect(screen.getByText(/Cartão de Crédito/i)).toBeInTheDocument();
    expect(screen.getByText(/Boleto Bancário/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("5")).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: /Salvar configurações/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("upsert_feature_flag", expect.objectContaining({
        _key: "subscription_payment_methods",
      }));
    });
  });

  it("renders subscription_coupons_enabled config with discount policies", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });

    render(
      <FeatureConfigModal
        featureKey="subscription_coupons_enabled"
        isOpen={true}
        onClose={vi.fn()}
        initialData={{ showCouponInCheckout: true, allowCumulativePix: true }}
      />
    );

    expect(screen.getByText(/Políticas de Cupons Promocionais/i)).toBeInTheDocument();
    expect(screen.getByText(/Habilitar Campo de Cupom no Checkout/i)).toBeInTheDocument();
    expect(screen.getByText(/Acumular Cupom com Desconto PIX \(5%\)/i)).toBeInTheDocument();
  });
});
