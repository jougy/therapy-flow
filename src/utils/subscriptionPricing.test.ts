import { describe, it, expect } from "vitest";
import { calculatePlanPrice, PLAN_PRICING_CONFIG } from "./subscriptionPricing";

describe("subscriptionPricing - Centralized Pricing & Calculations", () => {
  describe("PLAN_PRICING_CONFIG matrix", () => {
    it("should match official pricing matrix for solo plan", () => {
      expect(PLAN_PRICING_CONFIG.solo.monthly).toEqual({
        monthlyEq: 52.0,
        periodMultiplier: 1,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });
      expect(PLAN_PRICING_CONFIG.solo.quarterly).toEqual({
        monthlyEq: 48.0,
        periodMultiplier: 3,
        periodLabel: "trimestre",
        cycleTitle: "Plano Trimestral (-10% OFF)",
      });
      expect(PLAN_PRICING_CONFIG.solo.annual).toEqual({
        monthlyEq: 40.0,
        periodMultiplier: 12,
        periodLabel: "ano",
        cycleTitle: "Plano Anual (Economia de 25%)",
      });
    });

    it("should match official pricing matrix for clinic plan", () => {
      expect(PLAN_PRICING_CONFIG.clinic.monthly).toEqual({
        baseMonthlyEq: 78.0,
        extraSeatRate: 13.0,
        periodMultiplier: 1,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });
      expect(PLAN_PRICING_CONFIG.clinic.quarterly).toEqual({
        baseMonthlyEq: 72.0,
        extraSeatRate: 12.0,
        periodMultiplier: 3,
        periodLabel: "trimestre",
        cycleTitle: "Plano Trimestral (-10% OFF)",
      });
      expect(PLAN_PRICING_CONFIG.clinic.annual).toEqual({
        baseMonthlyEq: 60.0,
        extraSeatRate: 10.0,
        periodMultiplier: 12,
        periodLabel: "ano",
        cycleTitle: "Plano Anual (Economia de 25%)",
      });
    });
  });

  describe("calculatePlanPrice - Solo Plan", () => {
    it("calculates Solo Monthly correctly", () => {
      const result = calculatePlanPrice({ planType: "solo", billingCycle: "monthly" });
      expect(result).toEqual({
        baseMonthlyEq: 52.0,
        monthlyEquivalent: 52.0,
        periodMultiplier: 1,
        periodTotal: 52.0,
        pixDiscountTotal: 49.4,
        extraSeatRate: 0,
        extraSeatsCount: 0,
        installmentsCount: 1,
        installmentValue: 52.0,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });
    });

    it("calculates Solo Quarterly correctly", () => {
      const result = calculatePlanPrice({ planType: "solo", billingCycle: "quarterly" });
      expect(result).toEqual({
        baseMonthlyEq: 48.0,
        monthlyEquivalent: 48.0,
        periodMultiplier: 3,
        periodTotal: 144.0,
        pixDiscountTotal: 136.8,
        extraSeatRate: 0,
        extraSeatsCount: 0,
        installmentsCount: 3,
        installmentValue: 48.0,
        periodLabel: "trimestre",
        cycleTitle: "Plano Trimestral (-10% OFF)",
      });
    });

    it("calculates Solo Annual correctly", () => {
      const result = calculatePlanPrice({ planType: "solo", billingCycle: "annual" });
      expect(result).toEqual({
        baseMonthlyEq: 40.0,
        monthlyEquivalent: 40.0,
        periodMultiplier: 12,
        periodTotal: 480.0,
        pixDiscountTotal: 456.0,
        extraSeatRate: 0,
        extraSeatsCount: 0,
        installmentsCount: 12,
        installmentValue: 40.0,
        periodLabel: "ano",
        cycleTitle: "Plano Anual (Economia de 25%)",
      });
    });

    it("ignores additionalSeats in Solo plan", () => {
      const result = calculatePlanPrice({ planType: "solo", billingCycle: "monthly", additionalSeats: 5 });
      expect(result.extraSeatsCount).toBe(0);
      expect(result.extraSeatRate).toBe(0);
      expect(result.periodTotal).toBe(52.0);
    });
  });

  describe("calculatePlanPrice - Clinic Plan", () => {
    it("calculates Clinic Monthly with 0 extra seats", () => {
      const result = calculatePlanPrice({ planType: "clinic", billingCycle: "monthly", additionalSeats: 0 });
      expect(result).toEqual({
        baseMonthlyEq: 78.0,
        monthlyEquivalent: 78.0,
        periodMultiplier: 1,
        periodTotal: 78.0,
        pixDiscountTotal: 74.1,
        extraSeatRate: 13.0,
        extraSeatsCount: 0,
        installmentsCount: 1,
        installmentValue: 78.0,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });
    });

    it("calculates Clinic Monthly with 1 extra seat", () => {
      const result = calculatePlanPrice({ planType: "clinic", billingCycle: "monthly", additionalSeats: 1 });
      expect(result.monthlyEquivalent).toBe(91.0); // 78 + 13
      expect(result.periodTotal).toBe(91.0);
      expect(result.pixDiscountTotal).toBe(86.45);
      expect(result.extraSeatsCount).toBe(1);
    });

    it("calculates Clinic Monthly with 5 extra seats", () => {
      const result = calculatePlanPrice({ planType: "clinic", billingCycle: "monthly", additionalSeats: 5 });
      expect(result.monthlyEquivalent).toBe(143.0); // 78 + 5 * 13 = 143
      expect(result.periodTotal).toBe(143.0);
      expect(result.pixDiscountTotal).toBe(135.85);
      expect(result.extraSeatsCount).toBe(5);
    });

    it("calculates Clinic Quarterly with 0, 1, and 5 extra seats", () => {
      const res0 = calculatePlanPrice({ planType: "clinic", billingCycle: "quarterly", additionalSeats: 0 });
      expect(res0.monthlyEquivalent).toBe(72.0);
      expect(res0.periodTotal).toBe(216.0); // 72 * 3
      expect(res0.pixDiscountTotal).toBe(205.2);
      expect(res0.installmentValue).toBe(72.0);

      const res1 = calculatePlanPrice({ planType: "clinic", billingCycle: "quarterly", additionalSeats: 1 });
      expect(res1.monthlyEquivalent).toBe(84.0); // 72 + 12
      expect(res1.periodTotal).toBe(252.0); // 84 * 3
      expect(res1.pixDiscountTotal).toBe(239.4);
      expect(res1.installmentValue).toBe(84.0);

      const res5 = calculatePlanPrice({ planType: "clinic", billingCycle: "quarterly", additionalSeats: 5 });
      expect(res5.monthlyEquivalent).toBe(132.0); // 72 + 5 * 12 = 132
      expect(res5.periodTotal).toBe(396.0); // 132 * 3
      expect(res5.pixDiscountTotal).toBe(376.2);
      expect(res5.installmentValue).toBe(132.0);
    });

    it("calculates Clinic Annual with 0, 1, and 5 extra seats", () => {
      const res0 = calculatePlanPrice({ planType: "clinic", billingCycle: "annual", additionalSeats: 0 });
      expect(res0.monthlyEquivalent).toBe(60.0);
      expect(res0.periodTotal).toBe(720.0); // 60 * 12
      expect(res0.pixDiscountTotal).toBe(684.0);
      expect(res0.installmentValue).toBe(60.0);

      const res1 = calculatePlanPrice({ planType: "clinic", billingCycle: "annual", additionalSeats: 1 });
      expect(res1.monthlyEquivalent).toBe(70.0); // 60 + 10
      expect(res1.periodTotal).toBe(840.0); // 70 * 12
      expect(res1.pixDiscountTotal).toBe(798.0);
      expect(res1.installmentValue).toBe(70.0);

      const res5 = calculatePlanPrice({ planType: "clinic", billingCycle: "annual", additionalSeats: 5 });
      expect(res5.monthlyEquivalent).toBe(110.0); // 60 + 5 * 10 = 110
      expect(res5.periodTotal).toBe(1320.0); // 110 * 12
      expect(res5.pixDiscountTotal).toBe(1254.0);
      expect(res5.installmentValue).toBe(110.0);
    });
  });

  describe("calculatePlanPrice - Coupons & Discounts", () => {
    it("applies PERCENTAGE coupon correctly on Annual Solo", () => {
      const result = calculatePlanPrice({
        planType: "solo",
        billingCycle: "annual",
        coupon: { code: "PROMO20", discount_type: "PERCENTAGE", discount_value: 20 },
      });
      // 480 * 0.8 = 384
      expect(result.periodTotal).toBe(384.0);
      expect(result.monthlyEquivalent).toBe(32.0); // 40 * 0.8
      expect(result.pixDiscountTotal).toBe(364.8); // 384 * 0.95
      expect(result.installmentValue).toBe(32.0); // 384 / 12
    });

    it("applies FIXED_AMOUNT coupon correctly on Clinic Quarterly", () => {
      const result = calculatePlanPrice({
        planType: "clinic",
        billingCycle: "quarterly",
        additionalSeats: 1,
        coupon: { code: "OFF50", discount_type: "FIXED_AMOUNT", discount_value: 50 },
      });
      // Base: (72 + 12) * 3 = 252. Desconto: 50 -> 202.
      expect(result.periodTotal).toBe(202.0);
      expect(result.monthlyEquivalent).toBe(67.33); // 202 / 3 = 67.3333... -> 67.33
      expect(result.pixDiscountTotal).toBe(191.9); // 202 * 0.95 = 191.9
      expect(result.installmentValue).toBe(67.33); // 202 / 3 -> 67.33
    });

    it("handles edge cases safely (negative seats, invalid discount values)", () => {
      const resNegativeSeats = calculatePlanPrice({
        planType: "clinic",
        billingCycle: "monthly",
        additionalSeats: -10,
      });
      expect(resNegativeSeats.extraSeatsCount).toBe(0);
      expect(resNegativeSeats.periodTotal).toBe(78.0);

      const resOver100PctCoupon = calculatePlanPrice({
        planType: "solo",
        billingCycle: "monthly",
        coupon: { discount_type: "PERCENTAGE", discount_value: 150 },
      });
      expect(resOver100PctCoupon.periodTotal).toBe(0);
      expect(resOver100PctCoupon.monthlyEquivalent).toBe(0);

      const resExcessFixedCoupon = calculatePlanPrice({
        planType: "solo",
        billingCycle: "monthly",
        coupon: { discount_type: "FIXED_AMOUNT", discount_value: 100 },
      });
      expect(resExcessFixedCoupon.periodTotal).toBe(0);
      expect(resExcessFixedCoupon.monthlyEquivalent).toBe(0);
    });
  });
});
