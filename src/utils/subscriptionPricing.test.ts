import { describe, it, expect } from "vitest";
import { calculatePlanPrice, PLAN_PRICING_CONFIG, parsePlanType } from "./subscriptionPricing";

describe("subscriptionPricing - Centralized Pricing & Calculations", () => {
  describe("PLAN_PRICING_CONFIG matrix", () => {
    it("should match official pricing matrix for solo plan", () => {
      expect(PLAN_PRICING_CONFIG.solo.monthly).toEqual({
        monthlyEq: 87.0,
        periodMultiplier: 1,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });
      expect(PLAN_PRICING_CONFIG.solo.quarterly).toEqual({
        monthlyEq: 67.0,
        periodMultiplier: 3,
        periodLabel: "trimestre",
        cycleTitle: "Plano Trimestral (-23% OFF)",
      });
      expect(PLAN_PRICING_CONFIG.solo.annual).toEqual({
        monthlyEq: 57.0,
        periodMultiplier: 12,
        periodLabel: "ano",
        cycleTitle: "Plano Anual (Economia de 34%)",
      });
    });

    it("should match official pricing matrix for clinic plan", () => {
      expect(PLAN_PRICING_CONFIG.clinic.monthly).toEqual({
        baseMonthlyEq: 267.0,
        extraSeatRate: 25.0,
        periodMultiplier: 1,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });
      expect(PLAN_PRICING_CONFIG.clinic.quarterly).toEqual({
        baseMonthlyEq: 227.0,
        extraSeatRate: 25.0,
        periodMultiplier: 3,
        periodLabel: "trimestre",
        cycleTitle: "Plano Trimestral (-15% OFF)",
      });
      expect(PLAN_PRICING_CONFIG.clinic.annual).toEqual({
        baseMonthlyEq: 177.0,
        extraSeatRate: 25.0,
        periodMultiplier: 12,
        periodLabel: "ano",
        cycleTitle: "Plano Anual (Economia de 33%)",
      });
    });

    it("should match official pricing matrix for enterprise plan", () => {
      expect(PLAN_PRICING_CONFIG.enterprise.monthly).toEqual({
        baseMonthlyEq: 447.0,
        extraSeatRate: 15.0,
        periodMultiplier: 1,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });
      expect(PLAN_PRICING_CONFIG.enterprise.quarterly).toEqual({
        baseMonthlyEq: 387.0,
        extraSeatRate: 15.0,
        periodMultiplier: 3,
        periodLabel: "trimestre",
        cycleTitle: "Plano Trimestral (-13% OFF)",
      });
      expect(PLAN_PRICING_CONFIG.enterprise.annual).toEqual({
        baseMonthlyEq: 297.0,
        extraSeatRate: 15.0,
        periodMultiplier: 12,
        periodLabel: "ano",
        cycleTitle: "Plano Anual (Economia de 33%)",
      });
    });
  });

  describe("calculatePlanPrice - Solo Plan", () => {
    it("calculates Solo Monthly correctly", () => {
      const result = calculatePlanPrice({ planType: "solo", billingCycle: "monthly" });
      expect(result).toEqual({
        baseMonthlyEq: 87.0,
        monthlyEquivalent: 87.0,
        periodMultiplier: 1,
        periodTotal: 87.0,
        pixDiscountTotal: 82.65,
        extraSeatRate: 0,
        extraSeatsCount: 0,
        installmentsCount: 1,
        installmentValue: 87.0,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });
    });

    it("calculates Solo Quarterly correctly", () => {
      const result = calculatePlanPrice({ planType: "solo", billingCycle: "quarterly" });
      expect(result).toEqual({
        baseMonthlyEq: 67.0,
        monthlyEquivalent: 67.0,
        periodMultiplier: 3,
        periodTotal: 201.0,
        pixDiscountTotal: 190.95,
        extraSeatRate: 0,
        extraSeatsCount: 0,
        installmentsCount: 3,
        installmentValue: 67.0,
        periodLabel: "trimestre",
        cycleTitle: "Plano Trimestral (-23% OFF)",
      });
    });

    it("calculates Solo Annual correctly", () => {
      const result = calculatePlanPrice({ planType: "solo", billingCycle: "annual" });
      expect(result).toEqual({
        baseMonthlyEq: 57.0,
        monthlyEquivalent: 57.0,
        periodMultiplier: 12,
        periodTotal: 684.0,
        pixDiscountTotal: 649.8,
        extraSeatRate: 0,
        extraSeatsCount: 0,
        installmentsCount: 12,
        installmentValue: 57.0,
        periodLabel: "ano",
        cycleTitle: "Plano Anual (Economia de 34%)",
      });
    });

    it("ignores additionalSeats in Solo plan", () => {
      const result = calculatePlanPrice({ planType: "solo", billingCycle: "monthly", additionalSeats: 5 });
      expect(result.extraSeatsCount).toBe(0);
      expect(result.extraSeatRate).toBe(0);
      expect(result.periodTotal).toBe(87.0);
    });
  });

  describe("calculatePlanPrice - Clinic Plan", () => {
    it("calculates Clinic Monthly with 0 extra seats", () => {
      const result = calculatePlanPrice({ planType: "clinic", billingCycle: "monthly", additionalSeats: 0 });
      expect(result).toEqual({
        baseMonthlyEq: 267.0,
        monthlyEquivalent: 267.0,
        periodMultiplier: 1,
        periodTotal: 267.0,
        pixDiscountTotal: 253.65,
        extraSeatRate: 25.0,
        extraSeatsCount: 0,
        installmentsCount: 1,
        installmentValue: 267.0,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });
    });

    it("calculates Clinic Monthly with 1 extra seat", () => {
      const result = calculatePlanPrice({ planType: "clinic", billingCycle: "monthly", additionalSeats: 1 });
      expect(result.monthlyEquivalent).toBe(292.0); // 267 + 25
      expect(result.periodTotal).toBe(292.0);
      expect(result.pixDiscountTotal).toBe(277.4);
      expect(result.extraSeatsCount).toBe(1);
    });

    it("calculates Clinic Monthly with 5 extra seats", () => {
      const result = calculatePlanPrice({ planType: "clinic", billingCycle: "monthly", additionalSeats: 5 });
      expect(result.monthlyEquivalent).toBe(392.0); // 267 + 5 * 25 = 392
      expect(result.periodTotal).toBe(392.0);
      expect(result.pixDiscountTotal).toBe(372.4);
      expect(result.extraSeatsCount).toBe(5);
    });

    it("calculates Clinic Quarterly with 0, 1, and 5 extra seats", () => {
      const res0 = calculatePlanPrice({ planType: "clinic", billingCycle: "quarterly", additionalSeats: 0 });
      expect(res0.monthlyEquivalent).toBe(227.0);
      expect(res0.periodTotal).toBe(681.0); // 227 * 3
      expect(res0.pixDiscountTotal).toBe(646.95);
      expect(res0.installmentValue).toBe(227.0);

      const res1 = calculatePlanPrice({ planType: "clinic", billingCycle: "quarterly", additionalSeats: 1 });
      expect(res1.monthlyEquivalent).toBe(252.0); // 227 + 25
      expect(res1.periodTotal).toBe(756.0); // 252 * 3
      expect(res1.pixDiscountTotal).toBe(718.2);
      expect(res1.installmentValue).toBe(252.0);

      const res5 = calculatePlanPrice({ planType: "clinic", billingCycle: "quarterly", additionalSeats: 5 });
      expect(res5.monthlyEquivalent).toBe(352.0); // 227 + 5 * 25 = 352
      expect(res5.periodTotal).toBe(1056.0); // 352 * 3
      expect(res5.pixDiscountTotal).toBe(1003.2);
      expect(res5.installmentValue).toBe(352.0);
    });

    it("calculates Clinic Annual with 0, 1, and 5 extra seats", () => {
      const res0 = calculatePlanPrice({ planType: "clinic", billingCycle: "annual", additionalSeats: 0 });
      expect(res0.monthlyEquivalent).toBe(177.0);
      expect(res0.periodTotal).toBe(2124.0); // 177 * 12
      expect(res0.pixDiscountTotal).toBe(2017.8);
      expect(res0.installmentValue).toBe(177.0);

      const res1 = calculatePlanPrice({ planType: "clinic", billingCycle: "annual", additionalSeats: 1 });
      expect(res1.monthlyEquivalent).toBe(202.0); // 177 + 25
      expect(res1.periodTotal).toBe(2424.0); // 202 * 12
      expect(res1.pixDiscountTotal).toBe(2302.8);
      expect(res1.installmentValue).toBe(202.0);

      const res5 = calculatePlanPrice({ planType: "clinic", billingCycle: "annual", additionalSeats: 5 });
      expect(res5.monthlyEquivalent).toBe(302.0); // 177 + 5 * 25 = 302
      expect(res5.periodTotal).toBe(3624.0); // 302 * 12
      expect(res5.pixDiscountTotal).toBe(3442.8);
      expect(res5.installmentValue).toBe(302.0);
    });
  });

  describe("calculatePlanPrice - Enterprise Plan", () => {
    it("calculates Enterprise Monthly with 0 and extra seats", () => {
      const res0 = calculatePlanPrice({ planType: "enterprise", billingCycle: "monthly", additionalSeats: 0 });
      expect(res0).toEqual({
        baseMonthlyEq: 447.0,
        monthlyEquivalent: 447.0,
        periodMultiplier: 1,
        periodTotal: 447.0,
        pixDiscountTotal: 424.65,
        extraSeatRate: 15.0,
        extraSeatsCount: 0,
        installmentsCount: 1,
        installmentValue: 447.0,
        periodLabel: "mês",
        cycleTitle: "Plano Mensal",
      });

      const res2 = calculatePlanPrice({ planType: "enterprise", billingCycle: "monthly", additionalSeats: 2 });
      expect(res2.monthlyEquivalent).toBe(477.0); // 447 + 2 * 15 = 477
      expect(res2.periodTotal).toBe(477.0);
      expect(res2.pixDiscountTotal).toBe(453.15);
      expect(res2.extraSeatsCount).toBe(2);
    });

    it("calculates Enterprise Annual with 0 and extra seats", () => {
      const res0 = calculatePlanPrice({ planType: "enterprise", billingCycle: "annual", additionalSeats: 0 });
      expect(res0.monthlyEquivalent).toBe(297.0);
      expect(res0.periodTotal).toBe(3564.0); // 297 * 12
      expect(res0.pixDiscountTotal).toBe(3385.8);
      expect(res0.extraSeatRate).toBe(15.0);

      const res5 = calculatePlanPrice({ planType: "enterprise", billingCycle: "annual", additionalSeats: 5 });
      expect(res5.monthlyEquivalent).toBe(372.0); // 297 + 5 * 15 = 372
      expect(res5.periodTotal).toBe(4464.0); // 372 * 12
      expect(res5.pixDiscountTotal).toBe(4240.8);
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
      // 684 * 0.8 = 547.2
      expect(result.periodTotal).toBe(547.2);
      expect(result.monthlyEquivalent).toBe(45.6); // 57 * 0.8
      expect(result.pixDiscountTotal).toBe(519.84); // 547.2 * 0.95
      expect(result.installmentValue).toBe(45.6); // 547.2 / 12
    });

    it("applies FIXED_AMOUNT coupon correctly on Clinic Quarterly", () => {
      const result = calculatePlanPrice({
        planType: "clinic",
        billingCycle: "quarterly",
        additionalSeats: 1,
        coupon: { code: "OFF50", discount_type: "FIXED_AMOUNT", discount_value: 50 },
      });
      // Base: (227 + 25) * 3 = 756. Desconto: 50 -> 706.
      expect(result.periodTotal).toBe(706.0);
      expect(result.monthlyEquivalent).toBe(235.33); // 706 / 3 = 235.3333... -> 235.33
      expect(result.pixDiscountTotal).toBe(670.7); // 706 * 0.95 = 670.70
      expect(result.installmentValue).toBe(235.33); // 706 / 3 -> 235.33
    });

    it("handles edge cases safely (negative seats, invalid discount values)", () => {
      const resNegativeSeats = calculatePlanPrice({
        planType: "clinic",
        billingCycle: "monthly",
        additionalSeats: -10,
      });
      expect(resNegativeSeats.extraSeatsCount).toBe(0);
      expect(resNegativeSeats.periodTotal).toBe(267.0);

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

  describe("calculatePlanPrice - New 6 Subscription Plans", () => {
    it("calculates prof_basico pricing correctly", () => {
      const resMonthly = calculatePlanPrice({ planType: "prof_basico", billingCycle: "monthly" });
      expect(resMonthly.monthlyEquivalent).toBe(57.0);
      expect(resMonthly.periodTotal).toBe(57.0);

      const resQuarterly = calculatePlanPrice({ planType: "prof_basico", billingCycle: "quarterly" });
      expect(resQuarterly.monthlyEquivalent).toBe(47.0);
      expect(resQuarterly.periodTotal).toBe(141.0);

      const resAnnual = calculatePlanPrice({ planType: "prof_basico", billingCycle: "annual" });
      expect(resAnnual.monthlyEquivalent).toBe(37.0);
      expect(resAnnual.periodTotal).toBe(444.0);
    });

    it("calculates prof_medio pricing correctly", () => {
      const resMonthly = calculatePlanPrice({ planType: "prof_medio", billingCycle: "monthly" });
      expect(resMonthly.monthlyEquivalent).toBe(87.0);
      expect(resMonthly.periodTotal).toBe(87.0);

      const resAnnual = calculatePlanPrice({ planType: "prof_medio", billingCycle: "annual" });
      expect(resAnnual.monthlyEquivalent).toBe(57.0);
      expect(resAnnual.periodTotal).toBe(684.0);
    });

    it("calculates prof_top pricing correctly", () => {
      const resMonthly = calculatePlanPrice({ planType: "prof_top", billingCycle: "monthly" });
      expect(resMonthly.monthlyEquivalent).toBe(127.0);
      expect(resMonthly.periodTotal).toBe(127.0);

      const resAnnual = calculatePlanPrice({ planType: "prof_top", billingCycle: "annual" });
      expect(resAnnual.monthlyEquivalent).toBe(87.0);
      expect(resAnnual.periodTotal).toBe(1044.0);
    });

    it("calculates clinica_basico with extra seats", () => {
      const resMonthly = calculatePlanPrice({ planType: "clinica_basico", billingCycle: "monthly", additionalSeats: 2 });
      expect(resMonthly.baseMonthlyEq).toBe(147.0);
      expect(resMonthly.extraSeatRate).toBe(25.0);
      expect(resMonthly.extraSeatsCount).toBe(2);
      expect(resMonthly.monthlyEquivalent).toBe(197.0); // 147 + 2 * 25
      expect(resMonthly.periodTotal).toBe(197.0);
    });

    it("calculates clinica_medio with extra seats", () => {
      const resMonthly = calculatePlanPrice({ planType: "clinica_medio", billingCycle: "monthly", additionalSeats: 1 });
      expect(resMonthly.baseMonthlyEq).toBe(267.0);
      expect(resMonthly.monthlyEquivalent).toBe(292.0); // 267 + 25
    });

    it("calculates clinica_top with extra seats and annual discount", () => {
      const resAnnual = calculatePlanPrice({ planType: "clinica_top", billingCycle: "annual", additionalSeats: 3 });
      expect(resAnnual.baseMonthlyEq).toBe(297.0);
      expect(resAnnual.monthlyEquivalent).toBe(372.0); // 297 + 3 * 25
      expect(resAnnual.periodTotal).toBe(4464.0); // 372 * 12
    });
  });

  describe("parsePlanType", () => {
    it("correctly parses legacy and new plan types", () => {
      expect(parsePlanType("solo")).toBe("solo");
      expect(parsePlanType("clinic")).toBe("clinic");
      expect(parsePlanType("enterprise")).toBe("enterprise");
      expect(parsePlanType("prof_basico")).toBe("prof_basico");
      expect(parsePlanType("prof-basico")).toBe("prof_basico");
      expect(parsePlanType("prof_medio")).toBe("prof_medio");
      expect(parsePlanType("prof_top")).toBe("prof_top");
      expect(parsePlanType("clinica_basico")).toBe("clinica_basico");
      expect(parsePlanType("clinica-basico")).toBe("clinica_basico");
      expect(parsePlanType("clinica_medio")).toBe("clinica_medio");
      expect(parsePlanType("clinica_top")).toBe("clinica_top");
      expect(parsePlanType(null)).toBe("solo");
      expect(parsePlanType("other")).toBe("solo");
    });
  });
});
