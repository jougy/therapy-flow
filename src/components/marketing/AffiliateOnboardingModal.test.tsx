import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AffiliateOnboardingModal } from "./AffiliateOnboardingModal";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-test-123" } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "aff-123", coupon_code: "CARLOS30" },
        error: null,
      }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: { success: true, accountId: "acc_123" },
        error: null,
      }),
    },
  },
}));

describe("AffiliateOnboardingModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    onNavigateToPanel: vi.fn(),
    defaultName: "Carlos Silva",
    defaultEmail: "carlos@exemplo.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders modal with header and Step 1 fields when open", () => {
    render(<AffiliateOnboardingModal {...defaultProps} />);

    expect(screen.getByText("Credenciamento de Afiliado")).toBeInTheDocument();
    expect(screen.getByTestId("step-1-container")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-pf")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-pj")).toBeInTheDocument();
    expect(screen.getByTestId("input-name")).toHaveValue("Carlos Silva");
    expect(screen.getByTestId("input-email")).toHaveValue("carlos@exemplo.com");
    expect(screen.getByTestId("btn-step1-next")).toBeDisabled();
  });

  it("does not render modal when isOpen is false", () => {
    render(<AffiliateOnboardingModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId("affiliate-onboarding-modal")).not.toBeInTheDocument();
  });

  it("toggles between PF and PJ mode updating input labels and placeholders", () => {
    render(<AffiliateOnboardingModal {...defaultProps} />);

    expect(screen.getByText(/Nome Completo/i)).toBeInTheDocument();
    expect(screen.getByText(/CPF/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("toggle-pj"));
    expect(screen.getByText(/Razão Social/i)).toBeInTheDocument();
    expect(screen.getByText(/CNPJ/i)).toBeInTheDocument();
  });

  it("validates required fields in Step 1 and enables next button only when complete", async () => {
    render(<AffiliateOnboardingModal {...defaultProps} />);

    const nextBtn = screen.getByTestId("btn-step1-next");
    expect(nextBtn).toBeDisabled();

    // Fill remaining required fields in Step 1
    fireEvent.change(screen.getByTestId("input-cpf-cnpj"), {
      target: { value: "12345678901" },
    });
    fireEvent.change(screen.getByTestId("input-phone"), {
      target: { value: "11987654321" },
    });
    fireEvent.change(screen.getByTestId("input-cep"), {
      target: { value: "01310100" },
    });
    fireEvent.change(screen.getByTestId("input-address"), {
      target: { value: "Avenida Paulista" },
    });
    fireEvent.change(screen.getByTestId("input-number"), {
      target: { value: "1000" },
    });

    expect(nextBtn).not.toBeDisabled();
  });

  it("advances to Step 2 and validates banking/PIX fields", async () => {
    render(<AffiliateOnboardingModal {...defaultProps} />);

    // Complete Step 1
    fireEvent.change(screen.getByTestId("input-cpf-cnpj"), { target: { value: "12345678901" } });
    fireEvent.change(screen.getByTestId("input-phone"), { target: { value: "11987654321" } });
    fireEvent.change(screen.getByTestId("input-cep"), { target: { value: "01310100" } });
    fireEvent.change(screen.getByTestId("input-address"), { target: { value: "Avenida Paulista" } });
    fireEvent.change(screen.getByTestId("input-number"), { target: { value: "1000" } });

    fireEvent.click(screen.getByTestId("btn-step1-next"));

    expect(screen.getByTestId("step-2-container")).toBeInTheDocument();
    const nextToStep3Btn = screen.getByTestId("btn-step2-next");
    expect(nextToStep3Btn).toBeDisabled();

    // Fill Step 2 fields
    fireEvent.change(screen.getByTestId("input-pix-key"), { target: { value: "carlos@pix.com" } });
    fireEvent.change(screen.getByTestId("input-bank-name"), { target: { value: "Nubank" } });
    fireEvent.change(screen.getByTestId("input-bank-agency"), { target: { value: "0001" } });
    fireEvent.change(screen.getByTestId("input-bank-account"), { target: { value: "12345-6" } });

    expect(nextToStep3Btn).not.toBeDisabled();

    // Back button returns to Step 1
    fireEvent.click(screen.getByTestId("btn-step2-back"));
    expect(screen.getByTestId("step-1-container")).toBeInTheDocument();
  });

  it("blocks submission in Step 3 if 2FA code is incomplete or terms are not accepted", async () => {
    render(<AffiliateOnboardingModal {...defaultProps} />);

    // Step 1
    fireEvent.change(screen.getByTestId("input-cpf-cnpj"), { target: { value: "12345678901" } });
    fireEvent.change(screen.getByTestId("input-phone"), { target: { value: "11987654321" } });
    fireEvent.change(screen.getByTestId("input-cep"), { target: { value: "01310100" } });
    fireEvent.change(screen.getByTestId("input-address"), { target: { value: "Avenida Paulista" } });
    fireEvent.change(screen.getByTestId("input-number"), { target: { value: "1000" } });
    fireEvent.click(screen.getByTestId("btn-step1-next"));

    // Step 2
    fireEvent.change(screen.getByTestId("input-pix-key"), { target: { value: "carlos@pix.com" } });
    fireEvent.change(screen.getByTestId("input-bank-name"), { target: { value: "Nubank" } });
    fireEvent.change(screen.getByTestId("input-bank-agency"), { target: { value: "0001" } });
    fireEvent.change(screen.getByTestId("input-bank-account"), { target: { value: "12345-6" } });
    fireEvent.click(screen.getByTestId("btn-step2-next"));

    // Step 3
    expect(screen.getByTestId("step-3-container")).toBeInTheDocument();
    const submitBtn = screen.getByTestId("btn-submit-onboarding");
    expect(submitBtn).toBeDisabled();

    const totpInput = screen.getByTestId("input-totp-code");
    const termsCheckbox = screen.getByTestId("checkbox-terms");

    // Enter only 4 digits TOTP
    fireEvent.change(totpInput, { target: { value: "1234" } });
    expect(submitBtn).toBeDisabled();

    // Enter full 6 digits but without terms
    fireEvent.change(totpInput, { target: { value: "123456" } });
    expect(submitBtn).toBeDisabled();

    // Accept terms -> enabled
    fireEvent.click(termsCheckbox);
    expect(submitBtn).not.toBeDisabled();

    // Uncheck terms -> disabled again
    fireEvent.click(termsCheckbox);
    expect(submitBtn).toBeDisabled();
  });

  it("submits onboarding data to provision-affiliate-asaas-account and advances to Step 4 on success", async () => {
    render(<AffiliateOnboardingModal {...defaultProps} affiliateId="aff-test-999" />);

    // Step 1
    fireEvent.change(screen.getByTestId("input-cpf-cnpj"), { target: { value: "12345678901" } });
    fireEvent.change(screen.getByTestId("input-phone"), { target: { value: "11987654321" } });
    fireEvent.change(screen.getByTestId("input-cep"), { target: { value: "01310100" } });
    fireEvent.change(screen.getByTestId("input-address"), { target: { value: "Avenida Paulista" } });
    fireEvent.change(screen.getByTestId("input-number"), { target: { value: "1000" } });
    fireEvent.click(screen.getByTestId("btn-step1-next"));

    // Step 2
    fireEvent.change(screen.getByTestId("input-pix-key"), { target: { value: "carlos@pix.com" } });
    fireEvent.change(screen.getByTestId("input-bank-name"), { target: { value: "Nubank" } });
    fireEvent.change(screen.getByTestId("input-bank-agency"), { target: { value: "0001" } });
    fireEvent.change(screen.getByTestId("input-bank-account"), { target: { value: "12345-6" } });
    fireEvent.click(screen.getByTestId("btn-step2-next"));

    // Step 3
    fireEvent.change(screen.getByTestId("input-totp-code"), { target: { value: "654321" } });
    fireEvent.click(screen.getByTestId("checkbox-terms"));

    const submitBtn = screen.getByTestId("btn-submit-onboarding");
    expect(submitBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        "provision-affiliate-asaas-account",
        expect.objectContaining({
          body: expect.objectContaining({
            affiliateId: "aff-test-999",
            name: "Carlos Silva",
            email: "carlos@exemplo.com",
            cpfCnpj: "12345678901",
            pixKey: "carlos@pix.com",
            totpCode: "654321",
          }),
        })
      );
    });

    // Step 4 (Celebration) is displayed
    await waitFor(() => {
      expect(screen.getByTestId("step-4-container")).toBeInTheDocument();
      expect(screen.getByText("Parabéns! Subconta e Cupom Ativados")).toBeInTheDocument();
      expect(screen.getByTestId("display-coupon-code")).toHaveTextContent("CARLOS30");
      expect(screen.getByTestId("display-referral-link")).toHaveTextContent(
        "https://pluri.health/?cupom=CARLOS30"
      );
    });

    expect(defaultProps.onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        couponCode: "CARLOS30",
        referralLink: "https://pluri.health/?cupom=CARLOS30",
      })
    );

    // Test Copy Link in Step 4
    const copyBtn = screen.getByTestId("btn-copy-link");
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://pluri.health/?cupom=CARLOS30"
    );

    // Test Access Dashboard button
    const accessDashboardBtn = screen.getByTestId("btn-access-dashboard");
    fireEvent.click(accessDashboardBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onNavigateToPanel).toHaveBeenCalled();
  });
});
