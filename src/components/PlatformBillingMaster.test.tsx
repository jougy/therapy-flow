import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformBillingMaster } from "@/components/PlatformBillingMaster";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
    functions: {
      invoke: supabaseMocks.invoke,
    },
  },
}));

describe("PlatformBillingMaster", () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset();
    supabaseMocks.rpc.mockReset();
  });

  it("renders subscriptions list, allows searching, and opens master override modal", async () => {
    const mockSelectSubs = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "sub-1",
            clinic_id: "clinic-alfa",
            plan_type: "clinic",
            status: "active",
            subaccount_limit: 30,
            concurrent_access_limit: 2,
            coupon_code: "BETA50",
            total_recurring_monthly_price: 60.0,
            override_reason: null,
            updated_at: "2026-08-18T10:00:00Z",
            clinics: { name: "Clínica Alfa Teste" },
          },
        ],
        error: null,
      }),
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_subscriptions") return { select: mockSelectSubs };
      if (table === "subscription_coupons") {
        return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      if (table === "subscription_invoices") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "inv-1",
                    clinic_id: "clinic-alfa",
                    asaas_payment_id: "pay_test_real_123",
                    status: "RECEIVED",
                    value: 99.0,
                    net_value: 97.01,
                    billing_type: "PIX",
                    due_date: "2026-09-30",
                    payment_date: "2026-09-30T10:00:00Z",
                    invoice_url: "https://asaas.com/i/test",
                    bank_slip_url: null,
                    pix_qr_code: null,
                    nfe_number: "001452",
                    nfe_pdf_url: "https://asaas.com/nfe/test.pdf",
                    created_at: "2026-09-30T09:00:00Z",
                    clinics: { name: "Clínica Alfa Teste" },
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    supabaseMocks.rpc.mockImplementation((name: string) => {
      if (name === "get_asaas_webhook_logs") {
        return Promise.resolve({
          data: [
            {
              id: "log-1",
              event_type: "PAYMENT_RECEIVED",
              asaas_event_id: "evt-123",
              error_message: null,
              signature: "sig-123",
              created_at: "2026-08-18T11:00:00Z",
              payload: {
                event: "PAYMENT_RECEIVED",
                payment: { id: "pay_test_real_123", customer: "cus_123", subscription: "sub_123", value: 99 },
              },
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<PlatformBillingMaster />);

    expect(await screen.findByText(/Clínica Alfa Teste/i)).toBeInTheDocument();
    expect(screen.getByText(/BETA50/i)).toBeInTheDocument();

    // Click Override Master button
    const overrideBtn = screen.getByRole("button", { name: /Override Master/i });
    fireEvent.click(overrideBtn);

    expect(await screen.findByText(/Override Auditado: Clínica Alfa Teste/i)).toBeInTheDocument();

    // Verify submit button is disabled when audit reason is empty
    const confirmBtn = screen.getByRole("button", { name: /Confirmar Override Auditado/i });
    expect(confirmBtn).toBeDisabled();

    // Type valid audit reason (>8 chars)
    const reasonArea = screen.getByPlaceholderText(/Ex: Concessão especial/i);
    fireEvent.change(reasonArea, { target: { value: "Concessão aprovada no ticket #9901" } });

    expect(confirmBtn).not.toBeDisabled();
  });

  it("renders invoices tab with real payment data and links", async () => {
    const mockSelectSubs = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_subscriptions") return { select: mockSelectSubs };
      if (table === "subscription_coupons") {
        return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      if (table === "subscription_invoices") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "inv-99",
                    clinic_id: "clinic-beta",
                    asaas_payment_id: "pay_pix_real_888",
                    status: "RECEIVED",
                    value: 139.0,
                    net_value: 137.01,
                    billing_type: "PIX",
                    due_date: "2026-09-30",
                    payment_date: "2026-09-30T11:00:00Z",
                    invoice_url: "https://asaas.com/i/pix_real",
                    bank_slip_url: null,
                    pix_qr_code: null,
                    nfe_number: "98765",
                    nfe_pdf_url: "https://asaas.com/nfe/real.pdf",
                    created_at: "2026-09-30T10:00:00Z",
                    clinics: { name: "Clínica Fisioterapia Viva" },
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    supabaseMocks.rpc.mockResolvedValue({ data: [], error: null });

    render(<PlatformBillingMaster />);

    // Click on Cobranças & Faturas Tab
    const invoicesTab = await screen.findByRole("tab", { name: /Cobranças & Faturas/i });
    fireEvent.focus(invoicesTab);
    fireEvent.keyDown(invoicesTab, { key: "Enter" });
    fireEvent.click(invoicesTab);

    // Verify invoice elements
    expect(await screen.findByText(/Clínica Fisioterapia Viva/i)).toBeInTheDocument();
    expect(screen.getByText(/pay_pix_real_888/i)).toBeInTheDocument();
    expect(screen.getByText(/RECEBIDO/i)).toBeInTheDocument();
    expect(screen.getByText(/Nº 98765/i)).toBeInTheDocument();
  });

  it("renders coupons tab, lists SOUPLURIBETA, and opens new coupon modal", async () => {
    const mockSelectSubs = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const mockCoupons = [
      {
        id: "cupom-1",
        code: "SOUPLURIBETA",
        description: "Acesso Beta Tester Gratuito por 6 Meses",
        discount_type: "TRIAL_DAYS",
        discount_value: 180.0,
        max_redemptions: null,
        times_redeemed: 3,
        valid_from: "2026-08-01T00:00:00Z",
        valid_until: null,
        is_active: true,
        applicable_plans: null,
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      },
    ];

    const mockInsertCoupon = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSelectCoupons = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: mockCoupons,
        error: null,
      }),
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_subscriptions") return { select: mockSelectSubs };
      if (table === "subscription_coupons") {
        return {
          select: mockSelectCoupons,
          insert: mockInsertCoupon,
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === "subscription_invoices") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    supabaseMocks.rpc.mockResolvedValue({ data: [], error: null });

    render(<PlatformBillingMaster />);

    // Click on Cupons Promocionais Tab
    const couponsTab = await screen.findByRole("tab", { name: /Cupons Promocionais/i });
    fireEvent.focus(couponsTab);
    fireEvent.keyDown(couponsTab, { key: "Enter" });
    fireEvent.click(couponsTab);

    // Verify SOUPLURIBETA is rendered
    expect(await screen.findByText(/SOUPLURIBETA/i)).toBeInTheDocument();
    expect(screen.getByText(/Acesso Beta Tester Gratuito por 6 Meses/i)).toBeInTheDocument();
    expect(screen.getByText(/180 dias/i)).toBeInTheDocument();

    // Click Novo Cupom
    const newCouponBtn = screen.getByRole("button", { name: /Novo Cupom/i });
    fireEvent.click(newCouponBtn);

    expect(await screen.findByText(/Criar Novo Cupom Promocional/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Código do Cupom/i)).toBeInTheDocument();

    // Fill form
    const codeInput = screen.getByLabelText(/Código do Cupom/i);
    fireEvent.change(codeInput, { target: { value: "PROMO2026" } });
    expect((codeInput as HTMLInputElement).value).toBe("PROMO2026");
  });

  it("renders telegram alerts tab, shows status cards and preview mockup, and triggers test notification successfully", async () => {
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_subscriptions") {
        return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      if (table === "subscription_coupons") {
        return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      if (table === "subscription_invoices") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    supabaseMocks.rpc.mockResolvedValue({ data: [], error: null });
    supabaseMocks.invoke.mockResolvedValue({
      data: { success: true, message: "Mensagem de teste enviada com sucesso ao canal de avisos!" },
      error: null,
    });

    render(<PlatformBillingMaster />);

    // Switch to Telegram Tab
    const telegramTab = await screen.findByRole("tab", { name: /Alertas Telegram & Teste/i });
    fireEvent.focus(telegramTab);
    fireEvent.keyDown(telegramTab, { key: "Enter" });
    fireEvent.click(telegramTab);

    // Verify Title & Rule Cards
    expect(await screen.findByText(/Central de Alertas & Notificações Telegram/i)).toBeInTheDocument();
    expect(screen.getByText(/Novo Cadastro Orgânico/i)).toBeInTheDocument();
    expect(screen.getByText(/Pagamento de Plano Asaas/i)).toBeInTheDocument();

    // Verify Preview Mockup
    expect(screen.getByText(/Pré-visualização do Layout no Telegram/i)).toBeInTheDocument();
    expect(screen.getByText(/🌱 NOVO CADASTRO NA PLATAFORMA/i)).toBeInTheDocument();
    expect(screen.getByText(/💰 NOVA VENDA \/ PAGAMENTO CONFIRMADO/i)).toBeInTheDocument();

    // Trigger Telegram Test
    const triggerBtn = await screen.findByRole("button", { name: /Disparar Mensagem de Teste no Telegram/i });
    fireEvent.click(triggerBtn);

    // Verify invoke payload
    await waitFor(() => {
      expect(supabaseMocks.invoke).toHaveBeenCalledWith("notify-admin-telegram", {
        body: { action: "SEND_TEST_NOTIFICATION" },
      });
    });

    // Verify success result displayed
    expect(await screen.findByText(/Sucesso no envio/i)).toBeInTheDocument();
    expect(screen.getByText(/Mensagem de teste enviada com sucesso ao canal de avisos!/i)).toBeInTheDocument();
  });

  it("handles error when triggering telegram test notification", async () => {
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_subscriptions") {
        return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      if (table === "subscription_coupons") {
        return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      if (table === "subscription_invoices") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    supabaseMocks.rpc.mockResolvedValue({ data: [], error: null });
    supabaseMocks.invoke.mockResolvedValue({
      data: null,
      error: { message: "TELEGRAM_BOT_TOKEN não configurado no Supabase Vault" },
    });

    render(<PlatformBillingMaster />);

    const telegramTab = await screen.findByRole("tab", { name: /Alertas Telegram & Teste/i });
    fireEvent.focus(telegramTab);
    fireEvent.keyDown(telegramTab, { key: "Enter" });
    fireEvent.click(telegramTab);

    const triggerBtn = await screen.findByRole("button", { name: /Disparar Mensagem de Teste no Telegram/i });
    fireEvent.click(triggerBtn);

    await waitFor(() => {
      expect(supabaseMocks.invoke).toHaveBeenCalledWith("notify-admin-telegram", {
        body: { action: "SEND_TEST_NOTIFICATION" },
      });
    });

    expect(await screen.findByText(/Falha no envio/i)).toBeInTheDocument();
    expect(screen.getByText(/TELEGRAM_BOT_TOKEN não configurado no Supabase Vault/i)).toBeInTheDocument();
  });
});
