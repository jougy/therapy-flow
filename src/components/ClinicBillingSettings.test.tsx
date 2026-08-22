import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClinicBillingSettings } from "@/components/ClinicBillingSettings";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  functions: {
    invoke: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
    functions: supabaseMocks.functions,
  },
}));

describe("ClinicBillingSettings", () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset();
    supabaseMocks.rpc.mockReset();
    supabaseMocks.functions.invoke.mockReset();
  });

  it("renders billing settings summary, capacity cards, and invoice history", async () => {
    supabaseMocks.rpc.mockImplementation((name: string) => {
      if (name === "get_clinic_subscription_summary") {
        return Promise.resolve({
          data: [
            {
              subscription_id: "sub-123",
              clinic_id: "clinic-1",
              plan_type: "clinic",
              status: "active",
              billing_cycle: "MONTHLY",
              payment_method: "PIX",
              base_monthly_price: 60.0,
              total_recurring_monthly_price: 80.0,
              base_subaccount_limit: 30,
              purchased_subaccount_extra_count: 10,
              total_subaccount_limit: 40,
              base_concurrent_access_count: 2,
              additional_concurrent_access_count: 2,
              total_concurrent_access_limit: 4,
              coupon_code: "BETA50",
              discount_percentage: 50,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const mockSelectMemberships = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ count: 5, error: null }),
    });

    const mockSelectInvoices = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "inv-1",
            asaas_payment_id: "pay-1",
            charge_type: "RECURRING_SUBSCRIPTION",
            status: "CONFIRMED",
            value: 80.0,
            due_date: "2026-08-30",
            payment_date: "2026-08-15",
            billing_type: "PIX",
            created_at: "2026-08-15T10:00:00Z",
          },
        ],
        error: null,
      }),
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_memberships") return { select: mockSelectMemberships };
      if (table === "subscription_invoices") return { select: mockSelectInvoices };
      return { select: vi.fn() };
    });

    render(
      <ClinicBillingSettings
        clinicId="clinic-1"
        currentPlan="clinic"
        accountRole="account_owner"
      />
    );

    expect(await screen.findByText(/Clínica com Equipe/i)).toBeInTheDocument();
    expect(screen.getByText(/Cupom: BETA50/i)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$ 80.00/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cadastro Ilimitado/i)).toBeInTheDocument();
    expect(screen.getByText(/5 pessoa\(s\)/i)).toBeInTheDocument();
    expect(screen.getByText(/4 Acessos Concorrentes/i)).toBeInTheDocument();
    expect(screen.getByText(/Histórico de Faturas e Cobranças/i)).toBeInTheDocument();
  });

  it("blocks downgrade to solo if clinic has active collaborators", async () => {
    supabaseMocks.rpc.mockImplementation((name: string) => {
      if (name === "get_clinic_subscription_summary") {
        return Promise.resolve({
          data: [
            {
              clinic_id: "clinic-1",
              plan_type: "clinic",
              status: "active",
              total_recurring_monthly_price: 60.0,
              base_subaccount_limit: 30,
              purchased_subaccount_extra_count: 0,
              total_subaccount_limit: 30,
              base_concurrent_access_count: 2,
              additional_concurrent_access_count: 0,
              total_concurrent_access_limit: 2,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const mockSelectMemberships = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ count: 3, error: null }),
    });

    const mockSelectInvoices = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_memberships") return { select: mockSelectMemberships };
      if (table === "subscription_invoices") return { select: mockSelectInvoices };
      return { select: vi.fn() };
    });

    render(
      <ClinicBillingSettings
        clinicId="clinic-1"
        currentPlan="clinic"
        accountRole="account_owner"
      />
    );

    const btn = await screen.findByRole("button", { name: /Alterar Plano/i });
    fireEvent.click(btn);

    const soloOption = await screen.findByText(/Para atendimento individual sem equipe/i);
    fireEvent.click(soloOption.closest("div")!);

    expect(await screen.findByText(/Bloqueio de Downgrade/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmar Alteração de Plano/i })).toBeDisabled();
  });
});
