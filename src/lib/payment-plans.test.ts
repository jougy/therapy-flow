import { describe, expect, it } from "vitest";
import {
  calculatePlanFinancialSummary,
  calculateSessionUnitAmountCents,
  findConflictingAgendaEvent,
  generatePlanScheduleDates,
  getPaymentPlanStatusLabel,
} from "./payment-plans";

describe("payment-plans utils", () => {
  it("calculates session unit amount correctly", () => {
    expect(calculateSessionUnitAmountCents(150000, 10)).toBe(15000); // R$ 1.500 / 10 = R$ 150
    expect(calculateSessionUnitAmountCents(100000, 3)).toBe(33333); // R$ 1.000 / 3 = R$ 333.33
    expect(calculateSessionUnitAmountCents(0, 10)).toBe(0);
    expect(calculateSessionUnitAmountCents(100, 0)).toBe(0);
  });

  it("returns correct status labels", () => {
    expect(getPaymentPlanStatusLabel("pago")).toBe("Pago integralmente");
    expect(getPaymentPlanStatusLabel("pendente")).toBe("Pendente");
    expect(getPaymentPlanStatusLabel("parcial")).toBe("Pago parcialmente");
  });

  it("generates weekly schedule when no weekdays specified", () => {
    const dates = generatePlanScheduleDates({
      count: 4,
      startDateStr: "2026-09-01",
      recurringTime: "10:00",
      recurringWeekdays: [],
    });

    expect(dates).toHaveLength(4);
    expect(dates[0].toISOString()).toContain("2026-09-01");
    expect(dates[1].toISOString()).toContain("2026-09-08");
    expect(dates[2].toISOString()).toContain("2026-09-15");
    expect(dates[3].toISOString()).toContain("2026-09-22");
  });

  it("generates schedule matching specified recurring weekdays", () => {
    // 2026-09-01 is Tuesday (day 2)
    // Weekdays [1, 3] = Monday (1), Wednesday (3)
    const dates = generatePlanScheduleDates({
      count: 4,
      startDateStr: "2026-09-01",
      recurringTime: "14:30",
      recurringWeekdays: [1, 3],
    });

    expect(dates).toHaveLength(4);
    // 1st matching date from 2026-09-01 is Wednesday 2026-09-02 (day 3)
    expect(dates[0].getDate()).toBe(2); // Sep 2 (Wed)
    expect(dates[1].getDate()).toBe(7); // Sep 7 (Mon)
    expect(dates[2].getDate()).toBe(9); // Sep 9 (Wed)
    expect(dates[3].getDate()).toBe(14); // Sep 14 (Mon)
  });

  it("calculates plan financial summary accurately", () => {
    // 10 sessões, 3 realizadas, R$ 1.000,00 quitado
    const summaryPaid = calculatePlanFinancialSummary({
      total_sessions: 10,
      used_sessions: 3,
      total_amount_cents: 100000,
      session_unit_amount_cents: 10000,
      payment_status: "pago",
    });

    expect(summaryPaid.totalSessions).toBe(10);
    expect(summaryPaid.usedSessions).toBe(3);
    expect(summaryPaid.remainingSessions).toBe(7);
    expect(summaryPaid.compensatedAmountCents).toBe(30000); // 3 * R$ 100 = R$ 300
    expect(summaryPaid.remainingCreditCents).toBe(70000); // R$ 700 restante
    expect(summaryPaid.paidAmountCents).toBe(100000);
    expect(summaryPaid.pendingDebitCents).toBe(0);
    expect(summaryPaid.isFullyPaid).toBe(true);
    expect(summaryPaid.isExhausted).toBe(false);

    // 10 sessões, 2 realizadas, R$ 1.000,00 pendente
    const summaryPending = calculatePlanFinancialSummary({
      total_sessions: 10,
      used_sessions: 2,
      total_amount_cents: 100000,
      session_unit_amount_cents: 10000,
      payment_status: "pendente",
    });

    expect(summaryPending.compensatedAmountCents).toBe(20000);
    expect(summaryPending.pendingDebitCents).toBe(100000);
    expect(summaryPending.isFullyPaid).toBe(false);

    // Pacote esgotado (10 de 10)
    const summaryExhausted = calculatePlanFinancialSummary({
      total_sessions: 10,
      used_sessions: 10,
      total_amount_cents: 100000,
      session_unit_amount_cents: 10000,
      payment_status: "pago",
    });

    expect(summaryExhausted.remainingSessions).toBe(0);
    expect(summaryExhausted.isExhausted).toBe(true);
  });

  it("finds conflicting agenda event within tolerance and ignores cancelled ones", () => {
    const events = [
      { id: "evt-1", scheduled_for: "2026-10-20T14:00:00.000Z", status: "lembrete" },
      { id: "evt-2", scheduled_for: "2026-10-22T15:00:00.000Z", status: "cancelado" },
      { id: "evt-3", scheduled_for: "2026-10-25T09:00:00.000Z", status: "agendado" },
    ];

    // Conflito exato
    const matchExact = findConflictingAgendaEvent(new Date("2026-10-20T14:00:00.000Z"), events);
    expect(matchExact?.id).toBe("evt-1");

    // Conflito com diferença de 15 minutos (tolerância de 30m)
    const matchNear = findConflictingAgendaEvent(new Date("2026-10-20T14:15:00.000Z"), events);
    expect(matchNear?.id).toBe("evt-1");

    // Fora da tolerância (diferença de 45 minutos)
    const matchFar = findConflictingAgendaEvent(new Date("2026-10-20T14:45:00.000Z"), events);
    expect(matchFar).toBeNull();

    // Evento cancelado não deve ser considerado conflito
    const matchCancelled = findConflictingAgendaEvent(new Date("2026-10-22T15:00:00.000Z"), events);
    expect(matchCancelled).toBeNull();
  });
});

