import { describe, expect, it } from "vitest";
import {
  buildPatientOperationalSummary,
  centsToCurrencyInput,
  currencyDigitsToInput,
  formatMoneyCents,
  getArrivalDelayMinutes,
  getPaymentAdjustmentCents,
  getPaymentAdjustmentPercent,
  getSessionBalanceCents,
  getSessionCreditCents,
  hasPaymentAdjustment,
  normalizeSessionPaymentStatus,
  parseCurrencyToCents,
  sanitizePaymentAdjustmentReason,
} from "@/lib/session-operations";

describe("session operations", () => {
  it("parses and formats money in cents", () => {
    expect(parseCurrencyToCents("120,50")).toBe(12050);
    expect(parseCurrencyToCents("120.50")).toBe(12050);
    expect(parseCurrencyToCents("R$ 1.234,56")).toBe(123456);
    expect(parseCurrencyToCents("999999999999")).toBe(10_000_000);
    expect(parseCurrencyToCents("1e9")).toBe(0);
    expect(parseCurrencyToCents("10.123,45")).toBe(1012345);
    expect(parseCurrencyToCents("10.1234")).toBe(0);
    expect(parseCurrencyToCents("<script>1</script>")).toBe(0);
    expect(centsToCurrencyInput(12050)).toBe("120,50");
    expect(centsToCurrencyInput(123456)).toBe("1.234,56");
    expect(formatMoneyCents(12050)).toBe("R$ 120,50");
  });

  it("formats typed currency digits from cents to reais", () => {
    expect(currencyDigitsToInput("1")).toBe("0,01");
    expect(currencyDigitsToInput("12")).toBe("0,12");
    expect(currencyDigitsToInput("1234")).toBe("12,34");
    expect(currencyDigitsToInput("123456")).toBe("1.234,56");
    expect(currencyDigitsToInput("R$ 1.234,56")).toBe("1.234,56");
    expect(currencyDigitsToInput("999999999999")).toBe("100.000,00");
  });

  it("calculates balance and credit", () => {
    expect(getSessionBalanceCents({ amount_charged_cents: 12000, amount_paid_cents: 6000 })).toBe(6000);
    expect(getSessionCreditCents({ amount_charged_cents: 12000, amount_paid_cents: 15000 })).toBe(3000);
    expect(getSessionBalanceCents({ amount_charged_cents: 12000, amount_paid_cents: 0, payment_status: "cortesia" })).toBe(0);
  });

  it("calculates payment discounts and surcharges", () => {
    const discountedSession = { amount_charged_cents: 9000, amount_original_cents: 10000 };
    const increasedSession = { amount_charged_cents: 12000, amount_original_cents: 10000 };

    expect(hasPaymentAdjustment(discountedSession)).toBe(true);
    expect(getPaymentAdjustmentCents(discountedSession)).toBe(-1000);
    expect(getPaymentAdjustmentPercent(discountedSession)).toBe(-10);
    expect(getPaymentAdjustmentCents(increasedSession)).toBe(2000);
    expect(getPaymentAdjustmentPercent(increasedSession)).toBe(20);
  });

  it("normalizes impossible payment status combinations", () => {
    expect(normalizeSessionPaymentStatus({ amountChargedCents: 12000, amountPaidCents: 0, requestedStatus: "credito" })).toBe("pendente");
    expect(normalizeSessionPaymentStatus({ amountChargedCents: 12000, amountPaidCents: 6000, requestedStatus: "pago" })).toBe("parcial");
    expect(normalizeSessionPaymentStatus({ amountChargedCents: 12000, amountPaidCents: 13000, requestedStatus: "pendente" })).toBe("credito");
    expect(normalizeSessionPaymentStatus({ amountChargedCents: 12000, amountPaidCents: 0, requestedStatus: "cortesia" })).toBe("cortesia");
  });

  it("sanitizes payment adjustment reasons without removing line breaks", () => {
    expect(sanitizePaymentAdjustmentReason("  desconto\u0000especial\r\nmotivo\tinterno\u007F  ")).toBe("descontoespecial\nmotivointerno");
  });

  it("calculates arrival delay and patient summary", () => {
    const summary = buildPatientOperationalSummary([
      {
        amount_charged_cents: 12000,
        amount_original_cents: 15000,
        amount_paid_cents: 6000,
        patient_arrived_at: "2026-05-18T14:12:00.000Z",
        scheduled_start_at: "2026-05-18T14:00:00.000Z",
      },
      {
        amount_charged_cents: 10000,
        amount_paid_cents: 15000,
        status: "concluído",
      },
      {
        scheduled_start_at: "2026-05-17T14:00:00.000Z",
        status: "cancelado",
      },
    ]);

    expect(getArrivalDelayMinutes({ patient_arrived_at: "2026-05-18T14:12:00.000Z", scheduled_start_at: "2026-05-18T14:00:00.000Z" })).toBe(12);
    expect(getArrivalDelayMinutes({ patient_arrived_at: "2026-05-18T13:48:00.000Z", scheduled_start_at: "2026-05-18T14:00:00.000Z" })).toBe(-12);
    expect(summary.absences).toBe(1);
    expect(summary.averageDelayMinutes).toBe(12);
    expect(summary.openBalanceCents).toBe(6000);
    expect(summary.creditCents).toBe(5000);
    expect(summary.originalChargedCents).toBe(25000);
  });
});
