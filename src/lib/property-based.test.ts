import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  calculateSessionUnitAmountCents,
  getPaymentPlanStatusLabel,
} from "./payment-plans";
import { formatPatientDate, formatDateTime } from "./patient-formatting";

describe("Property-Based & Fuzzing Suite (fast-check)", () => {
  describe("calculateSessionUnitAmountCents", () => {
    it("deve retornar 0 para qualquer sessão <= 0 ou valor <= 0", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000000, max: 0 }),
          fc.integer({ min: -1000000, max: 1000000 }),
          (totalSessions, totalAmountCents) => {
            const result = calculateSessionUnitAmountCents(totalAmountCents, totalSessions);
            expect(result).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("nunca deve retornar NaN, Infinity ou valor negativo para entradas inteiras válidas", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 50000000 }), // até R$ 500.000,00
          (totalSessions, totalAmountCents) => {
            const unit = calculateSessionUnitAmountCents(totalAmountCents, totalSessions);
            expect(Number.isFinite(unit)).toBe(true);
            expect(unit).toBeGreaterThanOrEqual(0);
            // Propriedade invariante: unit * totalSessions deve estar dentro da margem de arredondamento de totalAmountCents
            expect(Math.abs(unit * totalSessions - totalAmountCents)).toBeLessThanOrEqual(totalSessions);
          }
        ),
        { numRuns: 150 }
      );
    });
  });

  describe("getPaymentPlanStatusLabel", () => {
    it("nunca deve lançar erro ou retornar vazio para qualquer string arbitrária ou fuzz input", () => {
      fc.assert(
        fc.property(fc.string(), (status) => {
          const label = getPaymentPlanStatusLabel(status);
          expect(typeof label).toBe("string");
          expect(label.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("formatPatientDate & formatDateTime", () => {
    it("deve lidar de forma resiliente com entradas de data malformadas sem estourar exceções não tratadas", () => {
      fc.assert(
        fc.property(fc.string(), (fuzzDate) => {
          const formatted = formatPatientDate(fuzzDate);
          expect(typeof formatted === "string" || formatted === null).toBe(true);

          const formattedTime = formatDateTime(fuzzDate);
          expect(typeof formattedTime).toBe("string");
          expect(formattedTime.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });
});
