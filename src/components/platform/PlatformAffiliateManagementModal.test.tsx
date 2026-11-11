import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PlatformAffiliateManagementModal } from "./PlatformAffiliateManagementModal";
import { supabase } from "@/integrations/supabase/client";

const mockToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

describe("PlatformAffiliateManagementModal", () => {
  const mockAffiliateId = "aff-test-1234-uuid";

  const defaultAffiliateData = {
    id: mockAffiliateId,
    user_id: "usr-001",
    clinic_id: "clinic-001",
    coupon_code: "CAMILA30",
    referral_slug: "dra-camila",
    asaas_account_id: "sub_acc_998877",
    asaas_wallet_id: "wal_112233",
    status: "active",
    locked_reason: null,
    tier: "gold",
    minimum_tier_floor: "silver",
    is_tier_manual_override: false,
    manual_tier_notes: "Parceira estratégica regional",
    pix_key: "camila@pix.com.br",
    pix_key_type: "email",
    first_month_commission_percent: 40,
    recurring_commission_percent: 16,
    is_subscription_waived: true,
    is_waiver_manual_override: false,
    active_referrals_count: 15,
    total_sales_count: 48,
    lifetime_commission_cents: 285000, // R$ 2.850,00
    profile: {
      id: "usr-001",
      full_name: "Dra. Camila Albuquerque",
      email: "fiscal@camila.com.br",
      cpf: "123.456.789-00",
    },
  };

  let updateMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "affiliates") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { ...defaultAffiliateData },
                error: null,
              }),
            }),
          }),
          update: updateMock,
        } as any;
      }
      return {} as any;
    });
  });

  it("renders modal header, loading spinner and then affiliate details", async () => {
    render(
      <PlatformAffiliateManagementModal
        affiliateId={mockAffiliateId}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Gestão Soberana de Afiliado")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("CAMILA30")).toBeInTheDocument();
      expect(screen.getByText("Dra. Camila Albuquerque")).toBeInTheDocument();
      expect(screen.getByText("123.456.789-00")).toBeInTheDocument();
      expect(screen.getByText("fiscal@camila.com.br")).toBeInTheDocument();
      expect(screen.getByText("camila@pix.com.br")).toBeInTheDocument();
      expect(screen.getByText("sub_acc_998877")).toBeInTheDocument();
      expect(screen.getByText("wal_112233")).toBeInTheDocument();
    });
  });

  it("displays aggregated metrics correctly formatted", async () => {
    render(
      <PlatformAffiliateManagementModal
        affiliateId={mockAffiliateId}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("metric-active-referrals")).toHaveTextContent("15");
      expect(screen.getByTestId("metric-total-sales")).toHaveTextContent("48");
      // 285000 cents -> R$ 2.850,00
      expect(screen.getByTestId("metric-lifetime-commission")).toHaveTextContent("2.850,00");
    });
  });

  it("renders KYC APPROVED badge when active with Asaas account", async () => {
    render(
      <PlatformAffiliateManagementModal
        affiliateId={mockAffiliateId}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      const kycBadge = screen.getByTestId("kyc-badge");
      expect(kycBadge).toHaveTextContent("KYC: APPROVED");
    });
  });

  it("renders KYC REJECTED badge when affiliate is banned or suspended", async () => {
    vi.mocked(supabase.from).mockImplementationOnce((table: string) => {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { ...defaultAffiliateData, status: "suspended", locked_reason: "Irregularidade de CPF" },
              error: null,
            }),
          }),
        }),
      } as any;
    });

    render(
      <PlatformAffiliateManagementModal
        affiliateId={mockAffiliateId}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      const kycBadge = screen.getByTestId("kyc-badge");
      expect(kycBadge).toHaveTextContent("KYC: REJECTED");
    });
  });

  it("allows toggling switches and inputs for tier, rates and waiver", async () => {
    render(
      <PlatformAffiliateManagementModal
        affiliateId={mockAffiliateId}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("tier-override-switch")).toBeInTheDocument();
    });

    // Toggle override manual de tier
    const tierOverrideSwitch = screen.getByTestId("tier-override-switch");
    fireEvent.click(tierOverrideSwitch);

    // Update first month percentage
    const firstMonthInput = screen.getByTestId("first-month-input");
    fireEvent.change(firstMonthInput, { target: { value: "50" } });
    expect(firstMonthInput).toHaveValue(50);

    // Update recurring percentage
    const recurringInput = screen.getByTestId("recurring-input");
    fireEvent.change(recurringInput, { target: { value: "25" } });
    expect(recurringInput).toHaveValue(25);

    // Toggle subscription waiver switches
    const waiverSwitch = screen.getByTestId("subscription-waived-switch");
    fireEvent.click(waiverSwitch);

    const waiverOverrideSwitch = screen.getByTestId("waiver-override-switch");
    fireEvent.click(waiverOverrideSwitch);

    // Update notes
    const notesInput = screen.getByTestId("manual-notes-input");
    fireEvent.change(notesInput, { target: { value: "Acordo comercial VIP firmado em congresso." } });
    expect(notesInput).toHaveValue("Acordo comercial VIP firmado em congresso.");
  });

  it("requires mandatory locked_reason when status is suspended or banned", async () => {
    vi.mocked(supabase.from).mockImplementationOnce((table: string) => {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { ...defaultAffiliateData, status: "suspended", locked_reason: "" },
              error: null,
            }),
          }),
        }),
        update: updateMock,
      } as any;
    });

    render(
      <PlatformAffiliateManagementModal
        affiliateId={mockAffiliateId}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("locked-reason-input")).toBeInTheDocument();
    });

    // Attempt to save with empty locked reason
    const saveBtn = screen.getByTestId("save-affiliate-btn");
    fireEvent.click(saveBtn);

    expect(updateMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("validation-error")).toHaveTextContent(
      "O motivo é obrigatório para suspender ou banir o afiliado."
    );

    // Provide reason and save again
    const reasonInput = screen.getByTestId("locked-reason-input");
    fireEvent.change(reasonInput, { target: { value: "Suspeita de autopagamento e fraude de split." } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
    });
  });

  it("submits changes and calls onSuccess and onClose", async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <PlatformAffiliateManagementModal
        affiliateId={mockAffiliateId}
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("save-affiliate-btn")).toBeInTheDocument();
    });

    const saveBtn = screen.getByTestId("save-affiliate-btn");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
      expect(handleSuccess).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Afiliado atualizado com sucesso!",
      })
    );
  });

  it("calls onClose when Cancel button is clicked", async () => {
    const handleClose = vi.fn();

    render(
      <PlatformAffiliateManagementModal
        affiliateId={mockAffiliateId}
        isOpen={true}
        onClose={handleClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Cancelar")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancelar"));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("handles fetch error gracefully", async () => {
    vi.mocked(supabase.from).mockImplementationOnce((table: string) => {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: new Error("Falha de conexão com o banco"),
            }),
          }),
        }),
      } as any;
    });

    render(
      <PlatformAffiliateManagementModal
        affiliateId={mockAffiliateId}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Falha ao carregar",
          variant: "destructive",
        })
      );
      expect(screen.getByText("Não foi possível carregar os dados deste afiliado.")).toBeInTheDocument();
    });
  });
});
