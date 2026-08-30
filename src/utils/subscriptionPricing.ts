export type BillingCycle = "annual" | "quarterly" | "monthly";
export type PlanType = "solo" | "clinic";

export interface PlanPricingResult {
  baseMonthlyEq: number;
  monthlyEquivalent: number;
  periodMultiplier: number;
  periodTotal: number;
  pixDiscountTotal: number;
  extraSeatRate: number;
  extraSeatsCount: number;
  installmentsCount: number;
  installmentValue: number;
  periodLabel: string;
  cycleTitle: string;
}

export interface CouponDiscount {
  code?: string;
  discount_type?: "PERCENTAGE" | "FIXED_AMOUNT";
  discount_value?: number;
}

// Configuração oficial de preços
export const PLAN_PRICING_CONFIG = {
  solo: {
    annual: { monthlyEq: 40.0, periodMultiplier: 12, periodLabel: "ano", cycleTitle: "Plano Anual (Economia de 25%)" },
    quarterly: { monthlyEq: 48.0, periodMultiplier: 3, periodLabel: "trimestre", cycleTitle: "Plano Trimestral (-10% OFF)" },
    monthly: { monthlyEq: 52.0, periodMultiplier: 1, periodLabel: "mês", cycleTitle: "Plano Mensal" },
  },
  clinic: {
    annual: { baseMonthlyEq: 60.0, extraSeatRate: 10.0, periodMultiplier: 12, periodLabel: "ano", cycleTitle: "Plano Anual (Economia de 25%)" },
    quarterly: { baseMonthlyEq: 72.0, extraSeatRate: 12.0, periodMultiplier: 3, periodLabel: "trimestre", cycleTitle: "Plano Trimestral (-10% OFF)" },
    monthly: { baseMonthlyEq: 78.0, extraSeatRate: 13.0, periodMultiplier: 1, periodLabel: "mês", cycleTitle: "Plano Mensal" },
  },
} as const;

export function calculatePlanPrice(params: {
  planType: PlanType;
  billingCycle: BillingCycle;
  additionalSeats?: number;
  coupon?: CouponDiscount | null;
}): PlanPricingResult {
  const plan: PlanType = params.planType === "clinic" ? "clinic" : "solo";
  const cycleKey = (params.billingCycle || "annual").toLowerCase() as BillingCycle;
  const cycle: BillingCycle = cycleKey in PLAN_PRICING_CONFIG[plan] ? cycleKey : "annual";
  const config = PLAN_PRICING_CONFIG[plan][cycle];

  const extraSeats = plan === "clinic" ? Math.max(0, Math.floor(params.additionalSeats || 0)) : 0;
  const extraSeatRate = plan === "clinic" && "extraSeatRate" in config ? config.extraSeatRate : 0;
  const baseMonthly = "baseMonthlyEq" in config ? config.baseMonthlyEq : config.monthlyEq;

  const rawMonthlyTotal = baseMonthly + extraSeats * extraSeatRate;
  let finalMonthlyTotal = rawMonthlyTotal;
  let finalPeriodTotal = rawMonthlyTotal * config.periodMultiplier;

  // Aplicar cupom se houver
  if (params.coupon && typeof params.coupon.discount_value === "number" && params.coupon.discount_value > 0) {
    if (params.coupon.discount_type === "PERCENTAGE") {
      const discountPct = Math.min(100, Math.max(0, params.coupon.discount_value));
      finalMonthlyTotal = Math.max(0, rawMonthlyTotal * (1 - discountPct / 100));
      finalPeriodTotal = Math.max(0, finalPeriodTotal * (1 - discountPct / 100));
    } else if (params.coupon.discount_type === "FIXED_AMOUNT") {
      const discountVal = Math.max(0, params.coupon.discount_value);
      finalPeriodTotal = Math.max(0, finalPeriodTotal - discountVal);
      finalMonthlyTotal = Math.max(0, finalPeriodTotal / config.periodMultiplier);
    }
  }

  // Desconto de 5% no PIX
  const roundedPeriodTotal = Math.round(finalPeriodTotal * 100) / 100;
  const pixDiscountTotal = Math.round(roundedPeriodTotal * 0.95 * 100) / 100;
  const installmentsCount = config.periodMultiplier;
  const installmentValue = Math.round((roundedPeriodTotal / installmentsCount) * 100) / 100;

  return {
    baseMonthlyEq: Math.round(baseMonthly * 100) / 100,
    monthlyEquivalent: Math.round(finalMonthlyTotal * 100) / 100,
    periodMultiplier: config.periodMultiplier,
    periodTotal: roundedPeriodTotal,
    pixDiscountTotal,
    extraSeatRate,
    extraSeatsCount: extraSeats,
    installmentsCount,
    installmentValue,
    periodLabel: config.periodLabel,
    cycleTitle: config.cycleTitle,
  };
}

export function parseBillingCycle(val?: string | null): BillingCycle {
  if (!val) return "annual";
  const normalized = val.trim().toLowerCase();
  if (normalized === "monthly" || normalized === "mensal") return "monthly";
  if (normalized === "quarterly" || normalized === "trimestral") return "quarterly";
  return "annual";
}

export function parsePlanType(val?: string | null): PlanType {
  if (!val) return "solo";
  const normalized = val.trim().toLowerCase();
  return normalized === "clinic" ? "clinic" : "solo";
}
