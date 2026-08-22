import { describe, expect, it } from "vitest";
import {
  calculateSessionUnitAmountCents,
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
});
