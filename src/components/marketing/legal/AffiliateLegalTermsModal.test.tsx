import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  AffiliateLegalTermsModal,
  generateAffiliateTermsHash,
  OFFICIAL_DOCX_URL,
  DEFAULT_TERMS_VERSION,
} from "./AffiliateLegalTermsModal";

describe("AffiliateLegalTermsModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onAccept: vi.fn().mockResolvedValue(undefined),
    userIdentifier: "dra.ana@clinica.com",
    termsVersion: "v1.0-2026",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with title, badges, preamble and essential clauses", () => {
    render(<AffiliateLegalTermsModal {...defaultProps} />);

    expect(
      screen.getByText("Termo de Adesão e Regulamento do Programa de Afiliados")
    ).toBeInTheDocument();
    expect(screen.getAllByText("v1.0-2026").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Regulamento & Compliance Jurídico/i)).toBeInTheDocument();

    // Cláusulas essenciais
    expect(screen.getByText(/CLÁUSULA 1ª – DO OBJETO DA PARCERIA/i)).toBeInTheDocument();
    expect(screen.getByText(/CLÁUSULA 2ª – DA TOTAL INEXISTÊNCIA DE VÍNCULO EMPREGATÍCIO/i)).toBeInTheDocument();
    expect(screen.getByText(/arts. 722 a 729 do Código Civil/i)).toBeInTheDocument();
    expect(screen.getByText(/CLÁUSULA 3ª – DA REMUNERAÇÃO, TIERS E SPLIT AUTOMÁTICO/i)).toBeInTheDocument();
    expect(screen.getByText(/CLÁUSULA 3ª-A – UNICIDADE E PAUSA POR VINCULAÇÃO INSTITUCIONAL/i)).toBeInTheDocument();
    expect(screen.getByText(/CLÁUSULA 4ª – DE ESTORNOS, CHARGEBACKS E RESGATE/i)).toBeInTheDocument();
    expect(screen.getByText(/CLÁUSULA 5ª – DA CONDUTA ÉTICA E REGRAS DE MARKETING/i)).toBeInTheDocument();
    expect(screen.getByText(/CLÁUSULA 5ª-A – NÍVEL ÚNICO \(SINGLE-LEVEL\) E VEDAÇÃO ANTI-PIRÂMIDE/i)).toBeInTheDocument();
    expect(screen.getByText(/Lei Federal nº 1.521\/1951/i)).toBeInTheDocument();
  });

  it("renders all 8 tiers in the remuneration table", () => {
    render(<AffiliateLegalTermsModal {...defaultProps} />);

    expect(screen.getByText(/Bronze \(0-3 ativos\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Prata \(4-10 ativos\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Ouro \(11-20 ativos\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Safira \(21-30 ativos\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Rubi \(31-50 ativos\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Esmeralda \(51-100 ativos\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Diamante \(101-200 ativos\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Legendary \(201\+ ativos\)/i)).toBeInTheDocument();
  });

  it("displays digital audit stamp with version, timestamp and LGPD hash", () => {
    render(
      <AffiliateLegalTermsModal
        {...defaultProps}
        acceptedAt="2026-11-10T02:00:00.000Z"
      />
    );

    expect(
      screen.getByText(/Carimbo Digital de Auditoria & Registro de Opt-In \(LGPD\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/2026-11-10T02:00:00.000Z/i)).toBeInTheDocument();
    expect(screen.getByText(/Hash Criptográfico LGPD:/i)).toBeInTheDocument();
  });

  it("generates deterministic hash with generateAffiliateTermsHash", () => {
    const hash1 = generateAffiliateTermsHash("user@test.com", "2026-11-10T00:00:00Z", "v1.0-2026");
    const hash2 = generateAffiliateTermsHash("user@test.com", "2026-11-10T00:00:00Z", "v1.0-2026");
    const hashDifferent = generateAffiliateTermsHash("other@test.com", "2026-11-10T00:00:00Z", "v1.0-2026");

    expect(hash1).toBe(hash2);
    expect(hash1.startsWith("LGPD-PLURI-V1.0-2026-")).toBe(true);
    expect(hash1).not.toBe(hashDifferent);
  });

  it("disables Aceitar button until user checks the agreement checkbox", () => {
    render(<AffiliateLegalTermsModal {...defaultProps} />);

    const acceptBtn = screen.getByTestId("btn-accept-terms");
    const checkbox = screen.getByTestId("terms-accept-checkbox");

    expect(acceptBtn).toBeDisabled();

    fireEvent.click(checkbox);
    expect(acceptBtn).not.toBeDisabled();

    fireEvent.click(checkbox);
    expect(acceptBtn).toBeDisabled();
  });

  it("calls onAccept with audit log when checked and user submits", async () => {
    render(<AffiliateLegalTermsModal {...defaultProps} />);

    const checkbox = screen.getByTestId("terms-accept-checkbox");
    fireEvent.click(checkbox);

    const acceptBtn = screen.getByTestId("btn-accept-terms");
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(defaultProps.onAccept).toHaveBeenCalledTimes(1);
      const payload = defaultProps.onAccept.mock.calls[0][0];
      expect(payload.termsVersion).toBe("v1.0-2026");
      expect(payload.userIdentifier).toBe("dra.ana@clinica.com");
      expect(payload.lgpdHash).toContain("LGPD-PLURI-V1.0-2026-");
      expect(payload.acceptedAt).toBeDefined();
    });

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("handles alreadyAccepted mode correctly without checkbox and shows signed badge", () => {
    render(<AffiliateLegalTermsModal {...defaultProps} alreadyAccepted={true} />);

    expect(screen.getByText("Termo Assinado")).toBeInTheDocument();
    expect(screen.queryByTestId("terms-accept-checkbox")).not.toBeInTheDocument();

    const acceptBtn = screen.getByTestId("btn-accept-terms");
    expect(acceptBtn).not.toBeDisabled();
    expect(acceptBtn).toHaveTextContent("Entendido");

    fireEvent.click(acceptBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("handles download button click for official .docx file", () => {
    render(<AffiliateLegalTermsModal {...defaultProps} />);

    const downloadBtn = screen.getByTestId("btn-download-terms-docx");
    expect(downloadBtn).toBeInTheDocument();

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    fireEvent.click(downloadBtn);

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("calls onClose when clicking close or decide later button", () => {
    render(<AffiliateLegalTermsModal {...defaultProps} />);

    const closeBtn = screen.getByTestId("btn-close-terms");
    fireEvent.click(closeBtn);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render dialog content when isOpen is false", () => {
    render(<AffiliateLegalTermsModal {...defaultProps} isOpen={false} />);

    expect(
      screen.queryByTestId("affiliate-legal-terms-modal")
    ).not.toBeInTheDocument();
  });
});
