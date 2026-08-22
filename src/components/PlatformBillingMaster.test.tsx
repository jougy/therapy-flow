import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformBillingMaster } from "@/components/PlatformBillingMaster";

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
      return { select: vi.fn() };
    });

    supabaseMocks.rpc.mockImplementation((name: string) => {
      if (name === "get_asaas_webhook_logs") {
        return Promise.resolve({
          data: [
            {
              id: "log-1",
              event: "PAYMENT_RECEIVED",
              payment_id: "pay-100",
              customer_id: "cus-100",
              subscription_id: "sub-100",
              error_message: null,
              signature: "sig-123",
              created_at: "2026-08-18T11:00:00Z",
              payload: { event: "PAYMENT_RECEIVED", payment: { value: 60 } },
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
});
