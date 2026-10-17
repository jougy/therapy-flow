import { describe, it, expect } from "vitest";
import {
  calculateSessionUnitAmountCents,
  calculateInsuranceDirectCopay,
  formatInsuranceModeLabel,
  validateInsuranceAuthorization,
} from "./insurance-billing";

describe("insurance-billing module", () => {
  it("calculates session unit amount in cents without loss of precision", () => {
    // R$ 450,00 para 10 sessões = R$ 45,00 cada
    expect(calculateSessionUnitAmountCents(45000, 10)).toBe(4500);

    // Divisão com arredondamento seguro (R$ 100,00 para 3 sessões = R$ 33,33)
    expect(calculateSessionUnitAmountCents(10000, 3)).toBe(3333);

    // Tratamento de zero e negativos
    expect(calculateSessionUnitAmountCents(0, 10)).toBe(0);
    expect(calculateSessionUnitAmountCents(10000, 0)).toBe(0);
  });

  it("calculates insurance direct copay breakdown correctly", () => {
    // Total R$ 60,00 por sessão, paciente paga R$ 15,00 de coparticipação e operadora paga R$ 45,00
    const breakdown = calculateInsuranceDirectCopay({
      sessionUnitAmountCents: 6000,
      copayAmountCents: 1500,
      totalSessions: 10,
    });

    expect(breakdown.patientTotalCents).toBe(15000); // R$ 150,00
    expect(breakdown.insuranceTotalCents).toBe(45000); // R$ 450,00
    expect(breakdown.grandTotalCents).toBe(60000); // R$ 600,00
  });

  it("formats insurance mode labels properly", () => {
    expect(formatInsuranceModeLabel("none")).toBe("Particular");
    expect(formatInsuranceModeLabel("direct_billing")).toBe("Credenciamento Direto");
    expect(formatInsuranceModeLabel("reimbursement")).toBe("Reembolso (Livre Escolha)");
  });

  it("validates authorization guide expiration and session quotas", () => {
    const valid = validateInsuranceAuthorization({
      totalSessions: 10,
      authorizedSessions: 10,
      expirationDateStr: "2099-12-31",
    });
    expect(valid.isValid).toBe(true);

    const expired = validateInsuranceAuthorization({
      totalSessions: 10,
      authorizedSessions: 10,
      expirationDateStr: "2020-01-01",
    });
    expect(expired.isValid).toBe(false);
    expect(expired.reason).toContain("vencida");

    const exceeds = validateInsuranceAuthorization({
      totalSessions: 12,
      authorizedSessions: 10,
      expirationDateStr: "2099-12-31",
    });
    expect(exceeds.isValid).toBe(false);
    expect(exceeds.reason).toContain("superior");
  });
});
