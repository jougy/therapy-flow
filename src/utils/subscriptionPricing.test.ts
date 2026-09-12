import { describe, it, expect } from "vitest";
import { calculatePlanPrice, PLAN_PRICING_CONFIG, parsePlanType } from "./subscriptionPricing";

describe("subscriptionPricing - Centralized Pricing & Calculations", () => {
  describe("PLAN_PRICING_CONFIG matrix", () => {
    it("should match official pricing matrix for solo plan", () => {
      expect(PLAN_PRICING_CONFIG.solo.monthly).toEqual({
        monthlyEq: 59.99,
        periodMultiplier: 1,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });
      expect(PLAN_PRICING_CONFIG.solo.quarterly).toEqual({
        monthlyEq: 53.99,
        periodMultiplier: 3,
        periodLabel: "trimestre",
        cycleTitle: "Plano Trimestral (-10% OFF)",
      });
      expect(PLAN_PRICING_CONFIG.solo.annual).toEqual({
        monthlyEq: 40.0,
        periodMultiplier: 12,
        periodLabel: "ano",
        cycleTitle: "Plano Anual (Economia de 33%)",
      });
    });

    it("should match official pricing matrix for clinic plan", () => {
      expect(PLAN_PRICING_CONFIG.clinic.monthly).toEqual({
        baseMonthlyEq: 139.0,
        extraSeatRate: 25.0,
        periodMultiplier: 1,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });
      expect(PLAN_PRICING_CONFIG.clinic.quarterly).toEqual({
        baseMonthlyEq: 125.0,
        extraSeatRate: 25.0,
        periodMultiplier: 3,
        periodLabel: "trimestre",
        cycleTitle: "Plano Trimestral (-10% OFF)",
      });
      expect(PLAN_PRICING_CONFIG.clinic.annual).toEqual({
        baseMonthlyEq: 104.0,
        extraSeatRate: 25.0,
        periodMultiplier: 12,
        periodLabel: "ano",
        cycleTitle: "Plano Anual (Economia de 25%)",
      });
    });

    it("should match official pricing matrix for enterprise plan", () => {
      expect(PLAN_PRICING_CONFIG.enterprise.monthly).toEqual({
        baseMonthlyEq: 299.0,
        extraSeatRate: 15.0,
        periodMultiplier: 1,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });
      expect(PLAN_PRICING_CONFIG.enterprise.quarterly).toEqual({
        baseMonthlyEq: 269.0,
        extraSeatRate: 15.0,
        periodMultiplier: 3,
        periodLabel: "trimestre",
        cycleTitle: "Plano Trimestral (-10% OFF)",
      });
      expect(PLAN_PRICING_CONFIG.enterprise.annual).toEqual({
        baseMonthlyEq: 224.0,
        extraSeatRate: 15.0,
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
        baseMonthlyEq: 59.99,
        monthlyEquivalent: 59.99,
        periodMultiplier: 1,
        periodTotal: 59.99,
        pixDiscountTotal: 56.99,
        extraSeatRate: 0,
        extraSeatsCount: 0,
        installmentsCount: 1,
        installmentValue: 59.99,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });
    });

    it("calculates Solo Quarterly correctly", () => {
      const result = calculatePlanPrice({ planType: "solo", billingCycle: "quarterly" });
      expect(result).toEqual({
        baseMonthlyEq: 53.99,
        monthlyEquivalent: 53.99,
        periodMultiplier: 3,
        periodTotal: 161.97,
        pixDiscountTotal: 153.87,
        extraSeatRate: 0,
        extraSeatsCount: 0,
        installmentsCount: 3,
        installmentValue: 53.99,
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
        cycleTitle: "Plano Anual (Economia de 33%)",
      });
    });

    it("ignores additionalSeats in Solo plan", () => {
      const result = calculatePlanPrice({ planType: "solo", billingCycle: "monthly", additionalSeats: 5 });
      expect(result.extraSeatsCount).toBe(0);
      expect(result.extraSeatRate).toBe(0);
      expect(result.periodTotal).toBe(59.99);
    });
  });

  describe("calculatePlanPrice - Clinic Plan", () => {
    it("calculates Clinic Monthly with 0 extra seats", () => {
      const result = calculatePlanPrice({ planType: "clinic", billingCycle: "monthly", additionalSeats: 0 });
      expect(result).toEqual({
        baseMonthlyEq: 139.0,
        monthlyEquivalent: 139.0,
        periodMultiplier: 1,
        periodTotal: 139.0,
        pixDiscountTotal: 132.05,
        extraSeatRate: 25.0,
        extraSeatsCount: 0,
        installmentsCount: 1,
        installmentValue: 139.0,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });
    });

    it("calculates Clinic Monthly with 1 extra seat", () => {
      const result = calculatePlanPrice({ planType: "clinic", billingCycle: "monthly", additionalSeats: 1 });
      expect(result.monthlyEquivalent).toBe(164.0); // 139 + 25
      expect(result.periodTotal).toBe(164.0);
      expect(result.pixDiscountTotal).toBe(155.8);
      expect(result.extraSeatsCount).toBe(1);
    });

    it("calculates Clinic Monthly with 5 extra seats", () => {
      const result = calculatePlanPrice({ planType: "clinic", billingCycle: "monthly", additionalSeats: 5 });
      expect(result.monthlyEquivalent).toBe(264.0); // 139 + 5 * 25 = 264
      expect(result.periodTotal).toBe(264.0);
      expect(result.pixDiscountTotal).toBe(250.8);
      expect(result.extraSeatsCount).toBe(5);
    });

    it("calculates Clinic Quarterly with 0, 1, and 5 extra seats", () => {
      const res0 = calculatePlanPrice({ planType: "clinic", billingCycle: "quarterly", additionalSeats: 0 });
      expect(res0.monthlyEquivalent).toBe(125.0);
      expect(res0.periodTotal).toBe(375.0); // 125 * 3
      expect(res0.pixDiscountTotal).toBe(356.25);
      expect(res0.installmentValue).toBe(125.0);

      const res1 = calculatePlanPrice({ planType: "clinic", billingCycle: "quarterly", additionalSeats: 1 });
      expect(res1.monthlyEquivalent).toBe(150.0); // 125 + 25
      expect(res1.periodTotal).toBe(450.0); // 150 * 3
      expect(res1.pixDiscountTotal).toBe(427.5);
      expect(res1.installmentValue).toBe(150.0);

      const res5 = calculatePlanPrice({ planType: "clinic", billingCycle: "quarterly", additionalSeats: 5 });
      expect(res5.monthlyEquivalent).toBe(250.0); // 125 + 5 * 25 = 250
      expect(res5.periodTotal).toBe(750.0); // 250 * 3
      expect(res5.pixDiscountTotal).toBe(712.5);
      expect(res5.installmentValue).toBe(250.0);
    });

    it("calculates Clinic Annual with 0, 1, and 5 extra seats", () => {
      const res0 = calculatePlanPrice({ planType: "clinic", billingCycle: "annual", additionalSeats: 0 });
      expect(res0.monthlyEquivalent).toBe(104.0);
      expect(res0.periodTotal).toBe(1248.0); // 104 * 12
      expect(res0.pixDiscountTotal).toBe(1185.6);
      expect(res0.installmentValue).toBe(104.0);

      const res1 = calculatePlanPrice({ planType: "clinic", billingCycle: "annual", additionalSeats: 1 });
      expect(res1.monthlyEquivalent).toBe(129.0); // 104 + 25
      expect(res1.periodTotal).toBe(1548.0); // 129 * 12
      expect(res1.pixDiscountTotal).toBe(1470.6);
      expect(res1.installmentValue).toBe(129.0);

      const res5 = calculatePlanPrice({ planType: "clinic", billingCycle: "annual", additionalSeats: 5 });
      expect(res5.monthlyEquivalent).toBe(229.0); // 104 + 5 * 25 = 229
      expect(res5.periodTotal).toBe(2748.0); // 229 * 12
      expect(res5.pixDiscountTotal).toBe(2610.6);
      expect(res5.installmentValue).toBe(229.0);
    });
  });

  describe("calculatePlanPrice - Enterprise Plan", () => {
    it("calculates Enterprise Monthly with 0 and extra seats", () => {
      const res0 = calculatePlanPrice({ planType: "enterprise", billingCycle: "monthly", additionalSeats: 0 });
      expect(res0).toEqual({
        baseMonthlyEq: 299.0,
        monthlyEquivalent: 299.0,
        periodMultiplier: 1,
        periodTotal: 299.0,
        pixDiscountTotal: 284.05,
        extraSeatRate: 15.0,
        extraSeatsCount: 0,
        installmentsCount: 1,
        installmentValue: 299.0,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });

      const res2 = calculatePlanPrice({ planType: "enterprise", billingCycle: "monthly", additionalSeats: 2 });
      expect(res2.monthlyEquivalent).toBe(329.0); // 299 + 2 * 15 = 329
      expect(res2.periodTotal).toBe(329.0);
      expect(res2.pixDiscountTotal).toBe(312.55);
      expect(res2.extraSeatsCount).toBe(2);
    });

    it("calculates Enterprise Annual with 0 and extra seats", () => {
      const res0 = calculatePlanPrice({ planType: "enterprise", billingCycle: "annual", additionalSeats: 0 });
      expect(res0.monthlyEquivalent).toBe(224.0);
      expect(res0.periodTotal).toBe(2688.0); // 224 * 12
      expect(res0.pixDiscountTotal).toBe(2553.6);
      expect(res0.extraSeatRate).toBe(15.0);

      const res5 = calculatePlanPrice({ planType: "enterprise", billingCycle: "annual", additionalSeats: 5 });
      expect(res5.monthlyEquivalent).toBe(299.0); // 224 + 5 * 15 = 299
      expect(res5.periodTotal).toBe(3588.0); // 299 * 12
      expect(res5.pixDiscountTotal).toBe(3408.6);
      expect(res5.extraSeatsCount).toBe(5);
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
      // Base: (125 + 25) * 3 = 450. Desconto: 50 -> 400.
      expect(result.periodTotal).toBe(400.0);
      expect(result.monthlyEquivalent).toBe(133.33); // 400 / 3 = 133.3333... -> 133.33
      expect(result.pixDiscountTotal).toBe(380.0); // 400 * 0.95 = 380.0
      expect(result.installmentValue).toBe(133.33); // 400 / 3 -> 133.33
    });

    it("handles edge cases safely (negative seats, invalid discount values)", () => {
      const resNegativeSeats = calculatePlanPrice({
        planType: "clinic",
        billingCycle: "monthly",
        additionalSeats: -10,
      });
      expect(resNegativeSeats.extraSeatsCount).toBe(0);
      expect(resNegativeSeats.periodTotal).toBe(139.0);

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

  describe("parsePlanType", () => {
    it("correctly parses plan types", () => {
      expect(parsePlanType("solo")).toBe("solo");
      expect(parsePlanType("clinic")).toBe("clinic");
      expect(parsePlanType("enterprise")).toBe("enterprise");
      expect(parsePlanType(null)).toBe("solo");
      expect(parsePlanType("other")).toBe("solo");
    });
  });
});
