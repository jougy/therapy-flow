import { describe, it, expect } from "vitest";
import { calculateTrialRemainingTime, evaluateClinicTrialStatus } from "./trial";

describe("trial utilities (lib/trial)", () => {
  describe("calculateTrialRemainingTime", () => {
    it("returns null values when no end date is provided", () => {
      const res = calculateTrialRemainingTime(null);
      expect(res.daysRemaining).toBeNull();
      expect(res.hoursRemaining).toBeNull();
      expect(res.isExpired).toBe(false);
    });

    it("calculates remaining days and hours correctly for future date", () => {
      const now = new Date("2026-05-10T12:00:00Z").getTime();
      const future = new Date("2026-05-15T12:00:00Z").toISOString(); // exactly 5 days

      const res = calculateTrialRemainingTime(future, now);
      expect(res.daysRemaining).toBe(5);
      expect(res.hoursRemaining).toBe(120);
      expect(res.isExpired).toBe(false);
    });

    it("detects expired status when end date is in the past", () => {
      const now = new Date("2026-05-10T12:00:00Z").getTime();
      const past = new Date("2026-05-09T12:00:00Z").toISOString(); // 1 day past

      const res = calculateTrialRemainingTime(past, now);
      expect(res.daysRemaining).toBeLessThanOrEqual(0);
      expect(res.isExpired).toBe(true);
    });
  });

  describe("evaluateClinicTrialStatus", () => {
    it("returns hasTrial=false when subscription is active and has no trial dates", () => {
      const evalResult = evaluateClinicTrialStatus({
        status: "active",
        isFreeTrial: false,
      });

      expect(evalResult.hasTrial).toBe(false);
      expect(evalResult.isTrialExpired).toBe(false);
    });

    it("evaluates active trial with remaining days correctly", () => {
      const now = new Date("2026-05-10T12:00:00Z").getTime();
      const endsAt = new Date("2026-05-15T12:00:00Z").toISOString();

      const evalResult = evaluateClinicTrialStatus(
        {
          status: "trialing",
          trialEndsAt: endsAt,
        },
        now
      );

      expect(evalResult.hasTrial).toBe(true);
      expect(evalResult.isTrialExpired).toBe(false);
      expect(evalResult.daysRemaining).toBe(5);
      expect(evalResult.badgeLabel).toBe("Teste Gratuito: 5 dias restantes");
      expect(evalResult.noticeText).toBe("5 dias de teste gratuito restantes");
      expect(evalResult.badgeVariantClass).toContain("text-blue-400");
    });

    it("evaluates urgent trial with 2 or fewer days remaining", () => {
      const now = new Date("2026-05-10T12:00:00Z").getTime();
      const endsAt = new Date("2026-05-11T12:00:00Z").toISOString(); // 1 day

      const evalResult = evaluateClinicTrialStatus(
        {
          status: "trialing",
          trialEndsAt: endsAt,
        },
        now
      );

      expect(evalResult.hasTrial).toBe(true);
      expect(evalResult.isTrialExpired).toBe(false);
      expect(evalResult.daysRemaining).toBe(1);
      expect(evalResult.badgeLabel).toBe("Teste Gratuito: 1 dia restante");
      expect(evalResult.noticeText).toBe("1 dia de teste gratuito restante");
      expect(evalResult.badgeVariantClass).toContain("text-amber-400");
    });

    it("evaluates expired trial correctly", () => {
      const now = new Date("2026-05-10T12:00:00Z").getTime();
      const endsAt = new Date("2026-05-09T12:00:00Z").toISOString();

      const evalResult = evaluateClinicTrialStatus(
        {
          status: "trialing",
          trialEndsAt: endsAt,
        },
        now
      );

      expect(evalResult.hasTrial).toBe(true);
      expect(evalResult.isTrialExpired).toBe(true);
      expect(evalResult.badgeLabel).toBe("Período de teste encerrado");
      expect(evalResult.noticeText).toBe("Período de teste encerrado (somente leitura)");
      expect(evalResult.badgeVariantClass).toContain("text-red-400");
    });
  });
});
