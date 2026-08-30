import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClinicBillingSettings } from "@/components/ClinicBillingSettings";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

const createChainedSelectMock = () => {
  const mockObj: any = {};
  mockObj.select = vi.fn(() => mockObj);
  mockObj.eq = vi.fn(() => mockObj);
  mockObj.neq = vi.fn(() => mockObj);
  mockObj.order = vi.fn(() => mockObj);
  mockObj.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  mockObj.single = vi.fn().mockResolvedValue({ data: null, error: null });
  mockObj.then = (resolve: any) => Promise.resolve({ count: 0, data: [], error: null }).then(resolve);
  return mockObj;
};

describe("ClinicBillingSettings", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
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
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        }),
      }),
    });

    const mockSelectInvoices = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
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
      }),
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_memberships") return { select: mockSelectMemberships };
      if (table === "subscription_invoices") return { select: mockSelectInvoices };
      return createChainedSelectMock();
    });

    render(
      <MemoryRouter>
        <ClinicBillingSettings
          clinicId="clinic-1"
          currentPlan="clinic"
          accountRole="account_owner"
        />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Clínica com Equipe/i)).toBeInTheDocument();
    expect(screen.getByText(/Cupom: BETA50/i)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$ 80.00/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/4 Acessos Concorrentes/i)).toBeInTheDocument();
    expect(screen.getByText(/Histórico de Faturas e Cobranças/i)).toBeInTheDocument();
  });

  it("renders Free Trial volumetric quota consumption and upgrade button navigating to /planos", async () => {
    supabaseMocks.rpc.mockImplementation((name: string) => {
      if (name === "get_clinic_subscription_summary") {
        return Promise.resolve({
          data: [
            {
              subscription_id: "sub-trial-1",
              clinic_id: "clinic-trial",
              plan_type: "solo",
              status: "TRIAL",
              is_free_trial: true,
              billing_cycle: "ANNUAL",
              payment_method: "TRIAL",
              base_monthly_price: 40.0,
              total_recurring_monthly_price: 0,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_subscriptions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  status: "TRIAL",
                  is_free_trial: true,
                  trial_max_attendances: 20,
                  trial_max_patients: 5,
                  trial_max_custom_forms: 1,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "sessions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({ count: 7, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "patients") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
            }),
          }),
        };
      }
      if (table === "anamnesis_form_templates") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "subscription_invoices") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "clinic_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  neq: vi.fn().mockResolvedValue({ count: 0, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return createChainedSelectMock();
    });

    render(
      <MemoryRouter>
        <ClinicBillingSettings
          clinicId="clinic-trial"
          currentPlan="solo"
          accountRole="account_owner"
        />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Plano Gratuito \/ Degustação/i)).toBeInTheDocument();
    expect(screen.getByText(/Sem prazo de expiração/i)).toBeInTheDocument();
    expect(screen.getByText(/Consumo de Cotas da Degustação/i)).toBeInTheDocument();

    const upgradeButtons = screen.getAllByText(/Fazer Upgrade para Plano Ilimitado|Fazer Upgrade para Ilimitado/i);
    expect(upgradeButtons.length).toBeGreaterThan(0);

    fireEvent.click(upgradeButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith("/planos?clinicId=clinic-trial");
  });

  it("opens Alterar Plano modal and allows direct navigation to Checkout", async () => {
    supabaseMocks.rpc.mockImplementation((name: string) => {
      if (name === "get_clinic_subscription_summary") {
        return Promise.resolve({
          data: [
            {
              clinic_id: "clinic-1",
              plan_type: "solo",
              status: "ACTIVE",
              billing_cycle: "MONTHLY",
              total_recurring_monthly_price: 52.0,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  neq: vi.fn().mockResolvedValue({ count: 0, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "subscription_invoices") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return createChainedSelectMock();
    });

    render(
      <MemoryRouter>
        <ClinicBillingSettings
          clinicId="clinic-1"
          currentPlan="solo"
          accountRole="account_owner"
        />
      </MemoryRouter>
    );

    const changePlanBtn = await screen.findByRole("button", { name: /Alterar Plano/i });
    fireEvent.click(changePlanBtn);

    expect(await screen.findByText(/Alterar Plano de Assinatura/i)).toBeInTheDocument();

    const checkoutBtn = screen.getByRole("button", { name: /Ir para Checkout \/ Pagamento/i });
    expect(checkoutBtn).toBeInTheDocument();

    fireEvent.click(checkoutBtn);
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("/pagamento/clinic-1?plan="));
  });

  it("opens Ajustar Acessos modal and allows direct navigation to Checkout", async () => {
    supabaseMocks.rpc.mockImplementation((name: string) => {
      if (name === "get_clinic_subscription_summary") {
        return Promise.resolve({
          data: [
            {
              clinic_id: "clinic-1",
              plan_type: "clinic",
              status: "ACTIVE",
              billing_cycle: "ANNUAL",
              base_concurrent_access_count: 2,
              additional_concurrent_access_count: 1,
              total_concurrent_access_limit: 3,
              total_recurring_monthly_price: 70.0,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  neq: vi.fn().mockResolvedValue({ count: 0, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "subscription_invoices") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return createChainedSelectMock();
    });

    render(
      <MemoryRouter>
        <ClinicBillingSettings
          clinicId="clinic-1"
          currentPlan="clinic"
          accountRole="account_owner"
        />
      </MemoryRouter>
    );

    const adjustSeatsBtn = await screen.findByRole("button", { name: /Ajustar Acessos Simultâneos/i });
    fireEvent.click(adjustSeatsBtn);

    expect(await screen.findByText(/Ajustar Acessos Simultâneos Extras/i)).toBeInTheDocument();

    const checkoutBtn = screen.getByRole("button", { name: /Pagar via Checkout/i });
    expect(checkoutBtn).toBeInTheDocument();

    fireEvent.click(checkoutBtn);
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("/pagamento/clinic-1?plan=clinic"));
  });

  it("opens PIX modal and displays pix_copy_paste code correctly", async () => {
    supabaseMocks.rpc.mockImplementation((name: string) => {
      if (name === "get_clinic_subscription_summary") {
        return Promise.resolve({
          data: [
            {
              clinic_id: "clinic-1",
              plan_type: "solo",
              status: "ACTIVE",
              total_recurring_monthly_price: 52.0,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  neq: vi.fn().mockResolvedValue({ count: 0, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "subscription_invoices") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "inv-pix-1",
                    asaas_payment_id: "pay-pix-1",
                    charge_type: "RECURRING_SUBSCRIPTION",
                    status: "PENDING",
                    value: 52.0,
                    due_date: "2026-08-30",
                    billing_type: "PIX",
                    pix_copy_paste: "00020126580014br.gov.bcb.pix0136test-copy-paste-code",
                    created_at: "2026-08-20T10:00:00Z",
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return createChainedSelectMock();
    });

    render(
      <MemoryRouter>
        <ClinicBillingSettings
          clinicId="clinic-1"
          currentPlan="solo"
          accountRole="account_owner"
        />
      </MemoryRouter>
    );

    const payPixBtn = await screen.findByRole("button", { name: /Pagar via PIX/i });
    fireEvent.click(payPixBtn);

    expect(await screen.findByText(/Pagamento via PIX Oficial/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("00020126580014br.gov.bcb.pix0136test-copy-paste-code")).toBeInTheDocument();
  });
});

