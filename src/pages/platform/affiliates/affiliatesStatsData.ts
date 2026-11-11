import type { AffiliateTier } from "@/lib/affiliate-tiers";

export interface MonthlyEvolutionData {
  month: string;
  mrr: number;
  newClinics: number;
}

export interface PlanDistributionData {
  plan: string;
  count: number;
  percentage: number;
  color: string;
}

export interface BillingCycleDistributionData {
  cycle: "monthly" | "quarterly" | "annual";
  label: "Mensal" | "Trimestral" | "Anual";
  count: number;
  percentage: number;
  color: string;
}

export interface TierDistributionData {
  tier: string;
  label: string;
  conversions: number;
  color: string;
  badgeClass: string;
}

export interface TopAffiliateItem {
  id: string;
  name: string;
  coupon: string;
  tier: AffiliateTier;
  activeClinics: number;
  conversionRate: number;
  mrrGenerated: number;
  commissionEarnedCents: number;
}

export interface AffiliatesStatsData {
  avgConversionRate: number;
  conversionRateChange: number;
  totalMrr: number;
  mrrGrowthPercent: number;
  commissionsQuarantineCents: number;
  commissionsReleasedCents: number;
  totalActiveClinics: number;
  retentionRatePercent: number;
  evolutionHistory: MonthlyEvolutionData[];
  planDistribution: PlanDistributionData[];
  billingCycleDistribution: BillingCycleDistributionData[];
  tierDistribution: TierDistributionData[];
  leaderboard: TopAffiliateItem[];
}

export interface AffiliatesStatsTabProps {
  initialData?: AffiliatesStatsData;
}

export const formatBrl = (val: number, isCents = false): string => {
  const value = isCents ? val / 100 : val;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export const getLast6MonthsLabels = (referenceDate = new Date()): string[] => {
  const result: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const monthRaw = d.toLocaleDateString("pt-BR", { month: "short" });
    const monthClean = monthRaw.replace(".", "").trim();
    const capitalized = monthClean.charAt(0).toUpperCase() + monthClean.slice(1);
    const yearShort = String(d.getFullYear()).slice(-2);
    result.push(`${capitalized}/${yearShort}`);
  }
  return result;
};

export const INITIAL_TIER_DISTRIBUTION: TierDistributionData[] = [
  { tier: "bronze", label: "Bronze", conversions: 0, color: "#CD7F32", badgeClass: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300" },
  { tier: "silver", label: "Prata", conversions: 0, color: "#94A3B8", badgeClass: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200" },
  { tier: "gold", label: "Ouro", conversions: 0, color: "#EAB308", badgeClass: "bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300" },
  { tier: "sapphire", label: "Safira", conversions: 0, color: "#2563EB", badgeClass: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300" },
  { tier: "ruby", label: "Rubi", conversions: 0, color: "#E11D48", badgeClass: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300" },
];

export const INITIAL_PLAN_DISTRIBUTION: PlanDistributionData[] = [
  { plan: "Profissional Básico", count: 0, percentage: 0, color: "#3b82f6" },
  { plan: "Profissional Médio", count: 0, percentage: 0, color: "#0ea5e9" },
  { plan: "Profissional Top", count: 0, percentage: 0, color: "#06b6d4" },
  { plan: "Clínica Básico", count: 0, percentage: 0, color: "#10b981" },
  { plan: "Clínica Médio", count: 0, percentage: 0, color: "#14b8a6" },
  { plan: "Clínica Top", count: 0, percentage: 0, color: "#8b5cf6" },
  { plan: "Solo (Legado)", count: 0, percentage: 0, color: "#64748b" },
  { plan: "Enterprise (Legado)", count: 0, percentage: 0, color: "#f59e0b" },
];

export const INITIAL_BILLING_CYCLE_DISTRIBUTION: BillingCycleDistributionData[] = [
  { cycle: "monthly", label: "Mensal", count: 0, percentage: 0, color: "#3b82f6" },
  { cycle: "quarterly", label: "Trimestral", count: 0, percentage: 0, color: "#8b5cf6" },
  { cycle: "annual", label: "Anual", count: 0, percentage: 0, color: "#10b981" },
];

export const EMPTY_AFFILIATES_STATS: AffiliatesStatsData = {
  avgConversionRate: 0,
  conversionRateChange: 0,
  totalMrr: 0,
  mrrGrowthPercent: 0,
  commissionsQuarantineCents: 0,
  commissionsReleasedCents: 0,
  totalActiveClinics: 0,
  retentionRatePercent: 0,
  evolutionHistory: getLast6MonthsLabels().map((month) => ({
    month,
    mrr: 0,
    newClinics: 0,
  })),
  planDistribution: INITIAL_PLAN_DISTRIBUTION,
  billingCycleDistribution: INITIAL_BILLING_CYCLE_DISTRIBUTION,
  tierDistribution: INITIAL_TIER_DISTRIBUTION,
  leaderboard: [],
};

export const DEMO_AFFILIATES_STATS: AffiliatesStatsData = {
  avgConversionRate: 28.4,
  conversionRateChange: 3.2,
  totalMrr: 48750,
  mrrGrowthPercent: 14.8,
  commissionsQuarantineCents: 543000,
  commissionsReleasedCents: 1482000,
  totalActiveClinics: 142,
  retentionRatePercent: 94.2,
  evolutionHistory: [
    { month: "Jun/26", mrr: 21500, newClinics: 14 },
    { month: "Jul/26", mrr: 26800, newClinics: 19 },
    { month: "Ago/26", mrr: 31200, newClinics: 22 },
    { month: "Set/26", mrr: 37400, newClinics: 27 },
    { month: "Out/26", mrr: 43100, newClinics: 31 },
    { month: "Nov/26", mrr: 48750, newClinics: 35 },
  ],
  planDistribution: [
    { plan: "Profissional Básico", count: 24, percentage: 16.9, color: "#3b82f6" },
    { plan: "Profissional Médio", count: 42, percentage: 29.6, color: "#0ea5e9" },
    { plan: "Profissional Top", count: 16, percentage: 11.3, color: "#06b6d4" },
    { plan: "Clínica Básico", count: 22, percentage: 15.5, color: "#10b981" },
    { plan: "Clínica Médio", count: 18, percentage: 12.7, color: "#14b8a6" },
    { plan: "Clínica Top", count: 8, percentage: 5.6, color: "#8b5cf6" },
    { plan: "Solo (Legado)", count: 8, percentage: 5.6, color: "#64748b" },
    { plan: "Enterprise (Legado)", count: 4, percentage: 2.8, color: "#f59e0b" },
  ],
  billingCycleDistribution: [
    { cycle: "monthly", label: "Mensal", count: 78, percentage: 54.9, color: "#3b82f6" },
    { cycle: "quarterly", label: "Trimestral", count: 35, percentage: 24.6, color: "#8b5cf6" },
    { cycle: "annual", label: "Anual", count: 29, percentage: 20.5, color: "#10b981" },
  ],
  tierDistribution: [
    { tier: "bronze", label: "Bronze", conversions: 24, color: "#CD7F32", badgeClass: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300" },
    { tier: "silver", label: "Prata", conversions: 38, color: "#94A3B8", badgeClass: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200" },
    { tier: "gold", label: "Ouro", conversions: 46, color: "#EAB308", badgeClass: "bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300" },
    { tier: "sapphire", label: "Safira", conversions: 21, color: "#2563EB", badgeClass: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300" },
    { tier: "ruby", label: "Rubi", conversions: 13, color: "#E11D48", badgeClass: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300" },
  ],
  leaderboard: [
    {
      id: "aff-1",
      name: "Dra. Mariana Silva",
      coupon: "MARIANA30",
      tier: "gold",
      activeClinics: 42,
      conversionRate: 34.2,
      mrrGenerated: 14280,
      commissionEarnedCents: 350000,
    },
    {
      id: "aff-2",
      name: "Dr. Ricardo Mendes",
      coupon: "MENDES30",
      tier: "sapphire",
      activeClinics: 31,
      conversionRate: 31.8,
      mrrGenerated: 10540,
      commissionEarnedCents: 265000,
    },
    {
      id: "aff-3",
      name: "Clínica FisioVip",
      coupon: "FISIOVIP",
      tier: "silver",
      activeClinics: 24,
      conversionRate: 29.5,
      mrrGenerated: 8160,
      commissionEarnedCents: 182000,
    },
    {
      id: "aff-4",
      name: "Dr. Carlos Santos",
      coupon: "CARLOS30",
      tier: "gold",
      activeClinics: 18,
      conversionRate: 27.0,
      mrrGenerated: 6120,
      commissionEarnedCents: 145000,
    },
    {
      id: "aff-5",
      name: "Instituto Reab",
      coupon: "REAB30",
      tier: "bronze",
      activeClinics: 12,
      conversionRate: 25.4,
      mrrGenerated: 4080,
      commissionEarnedCents: 98000,
    },
  ],
};

export const DEFAULT_AFFILIATES_STATS: AffiliatesStatsData = EMPTY_AFFILIATES_STATS;

export function calculateAffiliatesStats(
  affiliates: any[] = [],
  commissions: any[] = [],
  conversions: any[] = [],
  referenceDate = new Date()
): AffiliatesStatsData {
  let commissionsReleasedCents = 0;
  let commissionsQuarantineCents = 0;

  for (const c of commissions) {
    const amount = Number(c.amount_cents ?? c.commission_amount_cents ?? 0) || 0;
    const status = String(c.status ?? c.payment_status ?? "").toLowerCase().trim();
    if (status === "paid" || status === "received") {
      commissionsReleasedCents += amount;
    } else if (["pending", "locked", "quarantine", "hold"].includes(status)) {
      commissionsQuarantineCents += amount;
    }
  }

  const activeConversions = conversions.filter((c) => {
    const s = String(c.status ?? "").toLowerCase().trim();
    return s === "active" || s === "converted";
  });

  const canceledConversions = conversions.filter((c) => {
    const s = String(c.status ?? "").toLowerCase().trim();
    return s === "past_due" || s === "canceled" || s === "churn";
  });

  const totalReferralsFromAffiliates = affiliates.reduce(
    (sum, a) => sum + (Number(a.active_referrals_count) || 0),
    0
  );

  const totalActiveClinics =
    conversions.length > 0 ? activeConversions.length : totalReferralsFromAffiliates;

  let totalMrr = 0;
  if (conversions.length > 0) {
    totalMrr = activeConversions.reduce((sum, c) => {
      const plan = String(c.plan_type ?? "").toLowerCase().trim();
      if (plan.includes("enterprise") || plan === "clinica_top") return sum + 850;
      if (plan.includes("team") || plan.includes("clinic") || plan.includes("equipe") || plan === "clinica_medio") return sum + 450;
      if (plan === "clinica_basico") return sum + 350;
      if (plan === "prof_top") return sum + 290;
      return sum + 250;
    }, 0);
  } else if (totalActiveClinics > 0) {
    totalMrr = totalActiveClinics * 340;
  }

  const avgConversionRate =
    conversions.length > 0
      ? Number(((activeConversions.length / conversions.length) * 100).toFixed(1))
      : 0;

  const retentionDenominator = activeConversions.length + canceledConversions.length;
  const retentionRatePercent =
    conversions.length > 0
      ? retentionDenominator > 0
        ? Number(((activeConversions.length / retentionDenominator) * 100).toFixed(1))
        : 100
      : totalActiveClinics > 0
      ? 100
      : 0;

  const planCounts: Record<string, number> = {
    prof_basico: 0,
    prof_medio: 0,
    prof_top: 0,
    clinica_basico: 0,
    clinica_medio: 0,
    clinica_top: 0,
    solo: 0,
    enterprise: 0,
  };

  let monthlyCount = 0;
  let quarterlyCount = 0;
  let annualCount = 0;

  const targetListForPlans = conversions.length > 0 ? activeConversions : [];
  for (const c of targetListForPlans) {
    const rawPlan = String(c.plan_type ?? "").toLowerCase().trim();
    if (rawPlan === "prof_basico" || rawPlan === "prof-basico") {
      planCounts.prof_basico++;
    } else if (rawPlan === "prof_medio" || rawPlan === "prof-medio") {
      planCounts.prof_medio++;
    } else if (rawPlan === "prof_top" || rawPlan === "prof-top") {
      planCounts.prof_top++;
    } else if (rawPlan === "clinica_basico" || rawPlan === "clinica-basico") {
      planCounts.clinica_basico++;
    } else if (rawPlan === "clinica_top" || rawPlan === "clinica-top") {
      planCounts.clinica_top++;
    } else if (rawPlan === "enterprise") {
      planCounts.enterprise++;
    } else if (rawPlan === "solo") {
      planCounts.solo++;
    } else if (
      rawPlan === "clinica_medio" ||
      rawPlan === "clinica-medio" ||
      rawPlan.includes("clinic") ||
      rawPlan.includes("team") ||
      rawPlan.includes("equipe")
    ) {
      planCounts.clinica_medio++;
    } else {
      planCounts.prof_basico++;
    }

    const rawCycle = String(c.billing_cycle ?? c.cycle ?? c.period ?? "").toLowerCase().trim();
    if (rawCycle.includes("annual") || rawCycle.includes("anual") || rawCycle.includes("ano") || rawCycle.includes("year")) {
      annualCount++;
    } else if (rawCycle.includes("quarter") || rawCycle.includes("trimestr")) {
      quarterlyCount++;
    } else {
      monthlyCount++;
    }
  }

  const plansTotal = Object.values(planCounts).reduce((a, b) => a + b, 0);
  const planDistribution: PlanDistributionData[] = [
    { plan: "Profissional Básico", count: planCounts.prof_basico, percentage: plansTotal > 0 ? Number(((planCounts.prof_basico / plansTotal) * 100).toFixed(1)) : 0, color: "#3b82f6" },
    { plan: "Profissional Médio", count: planCounts.prof_medio, percentage: plansTotal > 0 ? Number(((planCounts.prof_medio / plansTotal) * 100).toFixed(1)) : 0, color: "#0ea5e9" },
    { plan: "Profissional Top", count: planCounts.prof_top, percentage: plansTotal > 0 ? Number(((planCounts.prof_top / plansTotal) * 100).toFixed(1)) : 0, color: "#06b6d4" },
    { plan: "Clínica Básico", count: planCounts.clinica_basico, percentage: plansTotal > 0 ? Number(((planCounts.clinica_basico / plansTotal) * 100).toFixed(1)) : 0, color: "#10b981" },
    { plan: "Clínica Médio", count: planCounts.clinica_medio, percentage: plansTotal > 0 ? Number(((planCounts.clinica_medio / plansTotal) * 100).toFixed(1)) : 0, color: "#14b8a6" },
    { plan: "Clínica Top", count: planCounts.clinica_top, percentage: plansTotal > 0 ? Number(((planCounts.clinica_top / plansTotal) * 100).toFixed(1)) : 0, color: "#8b5cf6" },
    { plan: "Solo (Legado)", count: planCounts.solo, percentage: plansTotal > 0 ? Number(((planCounts.solo / plansTotal) * 100).toFixed(1)) : 0, color: "#64748b" },
    { plan: "Enterprise (Legado)", count: planCounts.enterprise, percentage: plansTotal > 0 ? Number(((planCounts.enterprise / plansTotal) * 100).toFixed(1)) : 0, color: "#f59e0b" },
  ];

  const cyclesTotal = monthlyCount + quarterlyCount + annualCount;
  const billingCycleDistribution: BillingCycleDistributionData[] = [
    { cycle: "monthly", label: "Mensal", count: monthlyCount, percentage: cyclesTotal > 0 ? Number(((monthlyCount / cyclesTotal) * 100).toFixed(1)) : 0, color: "#3b82f6" },
    { cycle: "quarterly", label: "Trimestral", count: quarterlyCount, percentage: cyclesTotal > 0 ? Number(((quarterlyCount / cyclesTotal) * 100).toFixed(1)) : 0, color: "#8b5cf6" },
    { cycle: "annual", label: "Anual", count: annualCount, percentage: cyclesTotal > 0 ? Number(((annualCount / cyclesTotal) * 100).toFixed(1)) : 0, color: "#10b981" },
  ];

  const evolutionHistory: MonthlyEvolutionData[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const targetMonth = d.getMonth();
    const targetYear = d.getFullYear();
    const monthRaw = d.toLocaleDateString("pt-BR", { month: "short" });
    const monthClean = monthRaw.replace(".", "").trim();
    const monthLabel = `${monthClean.charAt(0).toUpperCase() + monthClean.slice(1)}/${String(targetYear).slice(-2)}`;

    const monthConvs = conversions.filter((c) => {
      if (!c.created_at) return false;
      const cd = new Date(c.created_at);
      return cd.getMonth() === targetMonth && cd.getFullYear() === targetYear;
    });

    const monthMrr = monthConvs.reduce((sum, c) => {
      const plan = String(c.plan_type ?? "").toLowerCase().trim();
      if (plan.includes("enterprise") || plan === "clinica_top") return sum + 850;
      if (plan.includes("team") || plan.includes("clinic") || plan.includes("equipe") || plan === "clinica_medio") return sum + 450;
      if (plan === "clinica_basico") return sum + 350;
      if (plan === "prof_top") return sum + 290;
      return sum + 250;
    }, 0);

    evolutionHistory.push({
      month: monthLabel,
      mrr: monthMrr,
      newClinics: monthConvs.length,
    });
  }

  const tierCounts: Record<string, number> = {
    bronze: 0,
    silver: 0,
    gold: 0,
    sapphire: 0,
    ruby: 0,
  };

  for (const a of affiliates) {
    const t = String(a.tier ?? "bronze").toLowerCase().trim();
    const count = Number(a.active_referrals_count) || 0;
    if (t in tierCounts) {
      tierCounts[t] += count;
    } else {
      tierCounts.bronze += count;
    }
  }

  const tierDistribution: TierDistributionData[] = INITIAL_TIER_DISTRIBUTION.map((t) => ({
    ...t,
    conversions: tierCounts[t.tier] ?? 0,
  }));

  const sortedAffiliates = [...affiliates]
    .filter((a) => (Number(a.active_referrals_count) || 0) > 0)
    .sort((a, b) => (Number(b.active_referrals_count) || 0) - (Number(a.active_referrals_count) || 0));

  const leaderboard: TopAffiliateItem[] = sortedAffiliates.slice(0, 5).map((a, idx) => {
    const prof = Array.isArray(a.profiles) ? a.profiles[0] : (a.profiles || a.profile);
    const name = prof?.full_name || `Parceiro ${a.coupon_code || idx + 1}`;
    const activeCount = Number(a.active_referrals_count) || 0;
    return {
      id: a.id || `aff-${idx}`,
      name,
      coupon: a.coupon_code || "CUPOM",
      tier: (a.tier as AffiliateTier) || "bronze",
      activeClinics: activeCount,
      conversionRate: Math.min(45, Math.max(15, Number((20 + activeCount * 0.8).toFixed(1)))),
      mrrGenerated: activeCount * 340,
      commissionEarnedCents: Number(a.lifetime_commission_cents) || 0,
    };
  });

  return {
    avgConversionRate,
    conversionRateChange: 0,
    totalMrr,
    mrrGrowthPercent: 0,
    commissionsQuarantineCents,
    commissionsReleasedCents,
    totalActiveClinics,
    retentionRatePercent,
    evolutionHistory,
    planDistribution,
    billingCycleDistribution,
    tierDistribution,
    leaderboard,
  };
}
