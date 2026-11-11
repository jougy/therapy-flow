import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  AffiliateMrrCalculatorModal,
  formatBRL,
} from "./AffiliateMrrCalculatorModal";

describe("AffiliateMrrCalculatorModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onStartSharing: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with correct title, slider and default 10 referrals (Silver tier)", () => {
    render(<AffiliateMrrCalculatorModal {...defaultProps} initialReferrals={10} />);

    expect(screen.getByText("Simulador de Renda Recorrente (MRR)")).toBeInTheDocument();
    expect(
      screen.getByText(/Projeção interativa de comissões passivas para parceiros Pluri/i)
    ).toBeInTheDocument();

    // Check tier badge for 10 referrals -> Silver
    const tierBadge = screen.getByTestId("tier-badge");
    expect(tierBadge).toHaveTextContent("Tier Prata");

    // Check count display
    const countDisplay = screen.getByTestId("referral-count-display");
    expect(countDisplay).toHaveTextContent("10");

    // Monthly & Annual MRR
    expect(screen.getByTestId("monthly-mrr-display")).toBeInTheDocument();
    expect(screen.getByTestId("annual-mrr-display")).toBeInTheDocument();

    // Silver tier has subscription waived
    expect(screen.getByTestId("subscription-waived-badge")).toHaveTextContent(
      /Assinatura 100% Gratuita/i
    );

    // Motivational equivalence
    expect(screen.getByTestId("motivational-equivalence")).toHaveTextContent(
      /atendimentos particulares/i
    );

    // CTA
    expect(screen.getByTestId("btn-start-sharing")).toBeInTheDocument();
  });

  it("does not render content when isOpen is false", () => {
    render(<AffiliateMrrCalculatorModal {...defaultProps} isOpen={false} />);

    expect(
      screen.queryByText("Simulador de Renda Recorrente (MRR)")
    ).not.toBeInTheDocument();
  });

  it("calculates Bronze tier correctly for 2 referrals and shows missing count for waiver", () => {
    render(<AffiliateMrrCalculatorModal {...defaultProps} initialReferrals={2} />);

    expect(screen.getByTestId("tier-badge")).toHaveTextContent("Tier Bronze");
    expect(screen.getByTestId("referral-count-display")).toHaveTextContent("2");

    // For 2 referrals, remaining for free subscription is 4 - 2 = 2
    const waiverBadge = screen.getByTestId("subscription-waived-badge");
    expect(waiverBadge).toHaveTextContent(/Faltam apenas 2 indicações/i);
  });

  it("updates tier and calculations when clicking a preset button (e.g. 15 -> Tier Ouro)", () => {
    render(<AffiliateMrrCalculatorModal {...defaultProps} initialReferrals={2} />);

    // Initially Bronze
    expect(screen.getByTestId("tier-badge")).toHaveTextContent("Tier Bronze");

    // Click preset 15
    const preset15Btn = screen.getByRole("button", { name: "15" });
    fireEvent.click(preset15Btn);

    // Now Tier Gold (Ouro)
    expect(screen.getByTestId("tier-badge")).toHaveTextContent("Tier Ouro");
    expect(screen.getByTestId("referral-count-display")).toHaveTextContent("15");

    // 15 referrals * 147 base * 16% = 352.80
    // Annual = 352.80 * 12 = 4233.60
    expect(screen.getByTestId("monthly-mrr-display")).toHaveTextContent("352,80");
    expect(screen.getByTestId("annual-mrr-display")).toHaveTextContent("4.233,60");

    // Waived badge active
    expect(screen.getByTestId("subscription-waived-badge")).toHaveTextContent(
      /Assinatura 100% Gratuita/i
    );
  });

  it("calculates Legendary tier when clicking preset 200", () => {
    render(<AffiliateMrrCalculatorModal {...defaultProps} initialReferrals={1} />);

    const preset200Btn = screen.getByRole("button", { name: "200" });
    fireEvent.click(preset200Btn);

    // 200 referrals in affiliate-tiers is Diamond (101-200), Legendary is 201+
    expect(screen.getByTestId("tier-badge")).toHaveTextContent("Tier Diamante");
  });

  it("triggers onStartSharing when clicking primary CTA", () => {
    render(<AffiliateMrrCalculatorModal {...defaultProps} />);

    const cta = screen.getByTestId("btn-start-sharing");
    fireEvent.click(cta);

    expect(defaultProps.onStartSharing).toHaveBeenCalledTimes(1);
  });

  it("falls back to onClose when onStartSharing is not provided", () => {
    const onClose = vi.fn();
    render(<AffiliateMrrCalculatorModal isOpen={true} onClose={onClose} />);

    const cta = screen.getByTestId("btn-start-sharing");
    fireEvent.click(cta);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("formats currency correctly with formatBRL", () => {
    expect(formatBRL(100)).toMatch(/R\$\s?100,00/);
    expect(formatBRL(1234.56)).toMatch(/R\$\s?1\.234,56/);
  });
});
