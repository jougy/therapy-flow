import { describe, it, expect, vi, beforeEach } from "vitest";
import { processAsaasPayment, getPixQrCode, checkAsaasPaymentStatus } from "./asaasService";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      functions: {
        invoke: vi.fn(),
      },
      from: vi.fn(),
    },
  };
});

describe("asaasService - Client-side safe gateway caller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processAsaasPayment", () => {
    it("successfully delegates payment creation to asaas-subscription Edge Function", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: {
          success: true,
          subscription: { id: "sub-1", status: "ACTIVE" },
          invoice: { id: "inv-1", status: "RECEIVED" },
          invoiceUrl: "https://sandbox.asaas.com/i/1",
          pixQrCode: "data:image/png;base64,...",
          pixCopyPaste: "000201...",
        },
        error: null,
      });

      const res = await processAsaasPayment({
        action: "CREATE",
        clinic_id: "clinic-123",
        plan_type: "clinic",
        billing_cycle: "annual",
        billing_type: "PIX",
      });

      expect(res.success).toBe(true);
      expect(res.source).toBe("EDGE_FUNCTION");
      expect(res.invoiceUrl).toBe("https://sandbox.asaas.com/i/1");
      expect(supabase.functions.invoke).toHaveBeenCalledWith("asaas-subscription", {
        body: expect.objectContaining({
          action: "CREATE",
          clinic_id: "clinic-123",
        }),
      });
    });

    it("handles Edge Function error response gracefully", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: { message: "Internal server error" } as any,
      });

      const res = await processAsaasPayment({
        action: "CREATE",
        clinic_id: "clinic-123",
        plan_type: "solo",
        billing_type: "PIX",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Internal server error");
      expect(res.source).toBe("EDGE_FUNCTION");
    });
  });

  describe("getPixQrCode", () => {
    it("returns cached QR code from subscription_invoices if present", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { pix_qr_code: "cached-qr-code", pix_copy_paste: "cached-pix-payload" },
            error: null,
          }),
        }),
      });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const qr = await getPixQrCode("pay-123");
      expect(qr).toEqual({
        encodedImage: "cached-qr-code",
        payload: "cached-pix-payload",
      });
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    });

    it("calls Edge Function if QR code is not cached locally", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { encodedImage: "edge-qr-code", payload: "edge-pix-payload" },
        error: null,
      });

      const qr = await getPixQrCode("pay-123", "clinic-123");
      expect(qr).toEqual({
        encodedImage: "edge-qr-code",
        payload: "edge-pix-payload",
      });
      expect(supabase.functions.invoke).toHaveBeenCalledWith("asaas-subscription", {
        body: {
          action: "GET_PIX_QR_CODE",
          payment_id: "pay-123",
          clinic_id: "clinic-123",
        },
      });
    });
  });

  describe("checkAsaasPaymentStatus", () => {
    it("returns confirmed if status in local DB is already RECEIVED", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { status: "RECEIVED", paid_at: "2026-08-29T00:00:00Z", asaas_payment_id: "pay-123" },
            error: null,
          }),
        }),
      });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const status = await checkAsaasPaymentStatus("pay-123");
      expect(status.confirmed).toBe(true);
      expect(status.status).toBe("RECEIVED");
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    });

    it("calls Edge Function if status in local DB is pending", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { status: "PENDING", asaas_payment_id: "pay-123" },
            error: null,
          }),
        }),
      });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: {
          status: "RECEIVED",
          confirmed: true,
          refused: false,
          paymentDate: "2026-08-29",
          paymentId: "pay-123",
        },
        error: null,
      });

      const status = await checkAsaasPaymentStatus("pay-123", "sub-1", "cus-1", "clinic-1");
      expect(status.confirmed).toBe(true);
      expect(status.status).toBe("RECEIVED");
      expect(supabase.functions.invoke).toHaveBeenCalledWith("asaas-subscription", {
        body: {
          action: "CHECK_PAYMENT_STATUS",
          payment_id: "pay-123",
          subscription_id: "sub-1",
          customer_id: "cus-1",
          clinic_id: "clinic-1",
        },
      });
    });
  });
});
