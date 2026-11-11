import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AffiliateInvitationConsentModal } from "./AffiliateInvitationConsentModal";

describe("AffiliateInvitationConsentModal", () => {
  const defaultProps = {
    invitationId: "inv-123",
    clinicName: "Clínica FisioVida",
    isOpen: true,
    onClose: vi.fn(),
    onRespond: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with correct title, clinic name, summary and action buttons", () => {
    render(<AffiliateInvitationConsentModal {...defaultProps} />);

    expect(
      screen.getByText("Convite para Programa de Afiliados de Clínica FisioVida")
    ).toBeInTheDocument();
    expect(screen.getByText(/Resumo das Condições de Transição/i)).toBeInTheDocument();
    expect(screen.getByText(/Pausa Institucional:/i)).toBeInTheDocument();
    expect(screen.getByText(/Janela de Resgate \(40 Dias\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Comissões e Repasses:/i)).toBeInTheDocument();

    expect(screen.getByTestId("btn-decide-later")).toBeInTheDocument();
    expect(screen.getByTestId("btn-reject-invitation")).toBeInTheDocument();
    expect(screen.getByTestId("btn-accept-invitation")).toBeInTheDocument();
  });

  it("does not display content when isOpen is false", () => {
    render(<AffiliateInvitationConsentModal {...defaultProps} isOpen={false} />);

    expect(
      screen.queryByText("Convite para Programa de Afiliados de Clínica FisioVida")
    ).not.toBeInTheDocument();
  });

  it("disables Aceitar button until checkbox is checked, and enables it when checked", () => {
    render(<AffiliateInvitationConsentModal {...defaultProps} />);

    const acceptBtn = screen.getByTestId("btn-accept-invitation");
    const checkbox = screen.getByTestId("affiliate-consent-checkbox");

    // Initially disabled
    expect(acceptBtn).toBeDisabled();

    // Check the box -> enables
    fireEvent.click(checkbox);
    expect(acceptBtn).not.toBeDisabled();

    // Uncheck the box -> disables again
    fireEvent.click(checkbox);
    expect(acceptBtn).toBeDisabled();
  });

  it("calls onRespond with 'accepted' when checkbox is checked and user clicks Aceitar", async () => {
    render(<AffiliateInvitationConsentModal {...defaultProps} />);

    const checkbox = screen.getByTestId("affiliate-consent-checkbox");
    const acceptBtn = screen.getByTestId("btn-accept-invitation");

    fireEvent.click(checkbox);
    expect(acceptBtn).not.toBeDisabled();

    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(defaultProps.onRespond).toHaveBeenCalledTimes(1);
      expect(defaultProps.onRespond).toHaveBeenCalledWith("accepted");
    });
  });

  it("calls onRespond with 'rejected' when user clicks Recusar convite", async () => {
    render(<AffiliateInvitationConsentModal {...defaultProps} />);

    const rejectBtn = screen.getByTestId("btn-reject-invitation");
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(defaultProps.onRespond).toHaveBeenCalledTimes(1);
      expect(defaultProps.onRespond).toHaveBeenCalledWith("rejected");
    });
  });

  it("calls onClose when user clicks Decidir mais tarde without triggering onRespond", () => {
    render(<AffiliateInvitationConsentModal {...defaultProps} />);

    const decideLaterBtn = screen.getByTestId("btn-decide-later");
    fireEvent.click(decideLaterBtn);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    expect(defaultProps.onRespond).not.toHaveBeenCalled();
  });

  it("shows full terms accordion when trigger is clicked", async () => {
    render(<AffiliateInvitationConsentModal {...defaultProps} />);

    const trigger = screen.getByText("Ler Termos Completos e Governança");
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Cláusula 1ª - Representação Institucional/i)).toBeInTheDocument();
      expect(screen.getByText(/Cláusula 3ª-A - Janela de Resgate \(D\+40\)/i)).toBeInTheDocument();
    });
  });

  it("disables buttons and shows loading indicator while onRespond promise is pending", async () => {
    let resolvePromise: () => void = () => {};
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    const onRespondMock = vi.fn().mockReturnValue(pendingPromise);
    render(<AffiliateInvitationConsentModal {...defaultProps} onRespond={onRespondMock} />);

    const checkbox = screen.getByTestId("affiliate-consent-checkbox");
    fireEvent.click(checkbox);

    const acceptBtn = screen.getByTestId("btn-accept-invitation");
    fireEvent.click(acceptBtn);

    // During pending submission:
    expect(screen.getByText("Aceitando...")).toBeInTheDocument();
    expect(acceptBtn).toBeDisabled();
    expect(screen.getByTestId("btn-reject-invitation")).toBeDisabled();
    expect(screen.getByTestId("btn-decide-later")).toBeDisabled();

    resolvePromise();
    await waitFor(() => {
      expect(screen.getByText("Aceitar convite")).toBeInTheDocument();
    });
  });
});
