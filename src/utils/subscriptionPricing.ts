/**
 * Módulo de Precificação e Cálculos Financeiros de Assinaturas (Pluri-Health).
 *
 * Fundamentos de Arquitetura & Racional de Negócio:
 * 1. Efeito Ancoragem (Anchoring Effect):
 *    - O plano Enterprise (R$ 299/mês ou R$ 224/mês no anual) atua como âncora de valor superior,
 *      destacando a excelente relação custo-benefício do plano Clínica Pro (R$ 139/mês ou R$ 104/mês no anual).
 *    - Oferece tarifa marginal agressiva para assentos extras no Enterprise (R$ 15/mês vs R$ 25/mês na Clínica),
 *      incentivando clínicas em expansão rápida a optarem pelo tier superior.
 *
 * 2. Ciclos de Faturamento & Redução de Churn:
 *    - Anual: Desconto de 25% estruturado para maximizar o LTV (Lifetime Value) e reduzir churn involuntário.
 *    - Trimestral: Desconto intermediário de 10% para clientes que preferem menor desembolso à vista.
 *    - Mensal: Tarifa cheia sem compromisso de longo prazo.
 *    - PIX: Desconto financeiro à vista de 5% sobre o total do período (redução de taxas de intermediação de cartão).
 *
 * 3. Conformidade Ética e Legal (CFM, CFP e LGPD):
 *    - O encerramento de período ou cancelamento de assinatura NUNCA bloqueia visualização nem destrói
 *      prontuários de pacientes. A clínica transiciona para o "Modo Leitura Estrito", garantindo
 *      acesso perpétuo aos dados clínicos históricos conforme Resolução CFM nº 1.821/2007 (guarda por 20 anos)
 *      e Art. 16 da LGPD (cumprimento de obrigação legal ou regulatória).
 *
 * Complexidade Algorítmica:
 * - Tempo: O(1) - Cálculos aritméticos em ponto fixo sem laços ou recursão.
 * - Espaço: O(1) - Retorno de objeto imutável de resultado sem alocações adicionais.
 */

export type BillingCycle = "annual" | "quarterly" | "monthly";
export type LegacyPlanType = "solo" | "clinic" | "enterprise";
export type NewPlanType =
  | "prof_basico"
  | "prof_medio"
  | "prof_top"
  | "clinica_basico"
  | "clinica_medio"
  | "clinica_top";
export type PlanType = LegacyPlanType | NewPlanType;

/**
 * Estrutura de dados contendo o resultado detalhado de cálculo de precificação.
 */
export interface PlanPricingResult {
  /** Preço base mensal equivalente (sem assentos extras e sem cupons). */
  baseMonthlyEq: number;
  /** Valor mensal efetivo correspondente após inclusão de assentos extras e aplicação de cupom. */
  monthlyEquivalent: number;
  /** Multiplicador do período (1 para mensal, 3 para trimestral, 12 para anual). */
  periodMultiplier: number;
  /** Valor bruto ou com cupom total cobrado pelo período inteiro. */
  periodTotal: number;
  /** Valor final com desconto de 5% à vista para pagamento via PIX. */
  pixDiscountTotal: number;
  /** Tarifa mensal unitária por assento concorrente extra adicionado. */
  extraSeatRate: number;
  /** Quantidade de assentos simultâneos extras contabilizados. */
  extraSeatsCount: number;
  /** Número de parcelas permitidas (equivalente ao multiplicador do período). */
  installmentsCount: number;
  /** Valor de cada parcela no cartão. */
  installmentValue: number;
  /** Rótulo textual do período ("mês", "trimestre", "ano"). */
  periodLabel: string;
  /** Título descritivo do ciclo com destaque promocional. */
  cycleTitle: string;
}

/** Tipo alternativo equivalente a PlanPricingResult para ergonomia da API. */
export type PlanPriceCalculation = PlanPricingResult;

/**
 * Parâmetros de desconto de cupom promocional para cálculo de preços.
 */
export interface CouponDiscount {
  /** Código alfanumérico do cupom (ex: "BETA50", "PRIMEIROMES100"). */
  code?: string;
  /** Tipo de desconto: "PERCENTAGE" (percentual 0-100), "FIXED_AMOUNT" (reais) ou "TRIAL_DAYS" (dias de teste gratuito). */
  discount_type?: "PERCENTAGE" | "FIXED_AMOUNT" | "TRIAL_DAYS";
  /** Valor nominal do desconto aplicado. */
  discount_value?: number;
}

/**
 * Tabela oficial e imutável de parâmetros de preços do ecossistema Pluri-Health.
 * Contempla os 6 planos da nova matriz e retrocompatibilidade com solo, clinic e enterprise.
 */
export const PLAN_PRICING_CONFIG = {
  // --- Novos Planos para Profissional Autônomo ---
  prof_basico: {
    annual: { monthlyEq: 37.00, periodMultiplier: 12, periodLabel: "ano", cycleTitle: "Plano Anual (Economia de 35%)" }, // R$ 37/mês = R$ 444/ano
    quarterly: { monthlyEq: 47.00, periodMultiplier: 3, periodLabel: "trimestre", cycleTitle: "Plano Trimestral (-17% OFF)" }, // R$ 47/mês = R$ 141/tri
    monthly: { monthlyEq: 57.00, periodMultiplier: 1, periodLabel: "mês", cycleTitle: "Plano Mensal" },
  },
  prof_medio: {
    annual: { monthlyEq: 57.00, periodMultiplier: 12, periodLabel: "ano", cycleTitle: "Plano Anual (Economia de 34%)" }, // R$ 57/mês = R$ 684/ano
    quarterly: { monthlyEq: 67.00, periodMultiplier: 3, periodLabel: "trimestre", cycleTitle: "Plano Trimestral (-23% OFF)" }, // R$ 67/mês = R$ 201/tri
    monthly: { monthlyEq: 87.00, periodMultiplier: 1, periodLabel: "mês", cycleTitle: "Plano Mensal" },
  },
  prof_top: {
    annual: { monthlyEq: 87.00, periodMultiplier: 12, periodLabel: "ano", cycleTitle: "Plano Anual (Economia de 31%)" }, // R$ 87/mês = R$ 1044/ano
    quarterly: { monthlyEq: 107.00, periodMultiplier: 3, periodLabel: "trimestre", cycleTitle: "Plano Trimestral (-15% OFF)" }, // R$ 107/mês = R$ 321/tri
    monthly: { monthlyEq: 127.00, periodMultiplier: 1, periodLabel: "mês", cycleTitle: "Plano Mensal" },
  },

  // --- Novos Planos para Clínicas (Colaboradores Ilimitados, Extras R$ 25/mês) ---
  clinica_basico: {
    annual: { baseMonthlyEq: 97.00, extraSeatRate: 25.0, periodMultiplier: 12, periodLabel: "ano", cycleTitle: "Plano Anual (Economia de 34%)" }, // R$ 97/mês = R$ 1164/ano
    quarterly: { baseMonthlyEq: 127.00, extraSeatRate: 25.0, periodMultiplier: 3, periodLabel: "trimestre", cycleTitle: "Plano Trimestral (-13% OFF)" }, // R$ 127/mês = R$ 381/tri
    monthly: { baseMonthlyEq: 147.00, extraSeatRate: 25.0, periodMultiplier: 1, periodLabel: "mês", cycleTitle: "Plano Mensal" },
  },
  clinica_medio: {
    annual: { baseMonthlyEq: 177.00, extraSeatRate: 25.0, periodMultiplier: 12, periodLabel: "ano", cycleTitle: "Plano Anual (Economia de 33%)" }, // R$ 177/mês = R$ 2124/ano
    quarterly: { baseMonthlyEq: 227.00, extraSeatRate: 25.0, periodMultiplier: 3, periodLabel: "trimestre", cycleTitle: "Plano Trimestral (-15% OFF)" }, // R$ 227/mês = R$ 681/tri
    monthly: { baseMonthlyEq: 267.00, extraSeatRate: 25.0, periodMultiplier: 1, periodLabel: "mês", cycleTitle: "Plano Mensal" },
  },
  clinica_top: {
    annual: { baseMonthlyEq: 297.00, extraSeatRate: 25.0, periodMultiplier: 12, periodLabel: "ano", cycleTitle: "Plano Anual (Economia de 33%)" }, // R$ 297/mês = R$ 3564/ano
    quarterly: { baseMonthlyEq: 387.00, extraSeatRate: 25.0, periodMultiplier: 3, periodLabel: "trimestre", cycleTitle: "Plano Trimestral (-13% OFF)" }, // R$ 387/mês = R$ 1161/tri
    monthly: { baseMonthlyEq: 447.00, extraSeatRate: 25.0, periodMultiplier: 1, periodLabel: "mês", cycleTitle: "Plano Mensal" },
  },

  // --- Planos Legados (Retrocompatibilidade 100%) ---
  solo: {
    annual: { monthlyEq: 57.00, periodMultiplier: 12, periodLabel: "ano", cycleTitle: "Plano Anual (Economia de 34%)" },
    quarterly: { monthlyEq: 67.00, periodMultiplier: 3, periodLabel: "trimestre", cycleTitle: "Plano Trimestral (-23% OFF)" },
    monthly: { monthlyEq: 87.00, periodMultiplier: 1, periodLabel: "mês", cycleTitle: "Plano Mensal" },
  },
  clinic: {
    annual: { baseMonthlyEq: 177.00, extraSeatRate: 25.0, periodMultiplier: 12, periodLabel: "ano", cycleTitle: "Plano Anual (Economia de 33%)" },
    quarterly: { baseMonthlyEq: 227.00, extraSeatRate: 25.0, periodMultiplier: 3, periodLabel: "trimestre", cycleTitle: "Plano Trimestral (-15% OFF)" },
    monthly: { baseMonthlyEq: 267.00, extraSeatRate: 25.0, periodMultiplier: 1, periodLabel: "mês", cycleTitle: "Plano Mensal" },
  },
  enterprise: {
    annual: { baseMonthlyEq: 297.00, extraSeatRate: 15.0, periodMultiplier: 12, periodLabel: "ano", cycleTitle: "Plano Anual (Economia de 33%)" },
    quarterly: { baseMonthlyEq: 387.00, extraSeatRate: 15.0, periodMultiplier: 3, periodLabel: "trimestre", cycleTitle: "Plano Trimestral (-13% OFF)" },
    monthly: { baseMonthlyEq: 447.00, extraSeatRate: 15.0, periodMultiplier: 1, periodLabel: "mês", cycleTitle: "Plano Mensal" },
  },
} as const;

/**
 * Calcula a precificação determinística de um plano com base no ciclo, assentos extras e cupons.
 *
 * @param params Parâmetros de entrada contendo o tipo de plano, ciclo, assentos e cupom.
 * @returns Objeto `PlanPricingResult` contendo todos os desdobramentos de mensalidade, totais e parcelas.
 *
 * Casos de borda tratados:
 * - Assentos extras no plano Solo são sanitizados para 0 (plano monoposto).
 * - Números negativos ou decimais em `additionalSeats` são sanitizados com `Math.max(0, Math.floor(...))`.
 * - Descontos percentuais são limitados ao intervalo [0, 100].
 * - Descontos fixos superiores ao valor total não geram valores negativos (clamp para 0).
 */
export function calculatePlanPrice(params: {
  planType: PlanType;
  billingCycle: BillingCycle;
  additionalSeats?: number;
  coupon?: CouponDiscount | null;
}): PlanPricingResult {
  const planKey = (params.planType || "solo") as PlanType;
  const plan: PlanType = planKey in PLAN_PRICING_CONFIG ? planKey : "solo";
  const cycleKey = (params.billingCycle || "annual").toLowerCase() as BillingCycle;
  const cycle: BillingCycle = cycleKey in PLAN_PRICING_CONFIG[plan] ? cycleKey : "annual";
  const rawConfig = PLAN_PRICING_CONFIG[plan][cycle];
  const config = rawConfig as {
    periodMultiplier: number;
    periodLabel: string;
    cycleTitle: string;
    monthlyEq?: number;
    baseMonthlyEq?: number;
    extraSeatRate?: number;
  };

  const isClinicTier = plan === "clinic" || plan === "enterprise" || plan === "clinica_basico" || plan === "clinica_medio" || plan === "clinica_top";
  const extraSeats = isClinicTier ? Math.max(0, Math.floor(params.additionalSeats || 0)) : 0;
  const extraSeatRate = isClinicTier && typeof config.extraSeatRate === "number" ? config.extraSeatRate : 0;
  const baseMonthly = typeof config.baseMonthlyEq === "number" ? config.baseMonthlyEq : (config.monthlyEq ?? 0);

  const rawMonthlyTotal = baseMonthly + extraSeats * extraSeatRate;
  let finalMonthlyTotal = rawMonthlyTotal;
  let finalPeriodTotal = rawMonthlyTotal * config.periodMultiplier;

  // Aplicação segura de cupom promocional se houver
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

  // Cálculo de desconto promocional nativo de 5% no PIX à vista
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

/**
 * Converte e normaliza strings de ciclos em tipos estritos `BillingCycle`.
 * 
 * @param val Valor vindo de banco de dados, query param ou payload externo.
 * @returns `"annual" | "quarterly" | "monthly"` com fallback seguro para `"annual"`.
 */
export function parseBillingCycle(val?: string | null): BillingCycle {
  if (!val) return "annual";
  const normalized = val.trim().toLowerCase();
  if (normalized === "monthly" || normalized === "mensal") return "monthly";
  if (normalized === "quarterly" || normalized === "trimestral") return "quarterly";
  return "annual";
}

/**
 * Converte e normaliza strings de planos em tipos estritos `PlanType`.
 * 
 * @param val Valor vindo de banco de dados, query param ou payload externo.
 * @returns `"prof_basico" | "prof_medio" | "prof_top" | "clinica_basico" | "clinica_medio" | "clinica_top" | "solo" | "clinic" | "enterprise"` com fallback seguro para `"solo"`.
 */
export function parsePlanType(val?: string | null): PlanType {
  if (!val) return "solo";
  const normalized = val.trim().toLowerCase().replace("-", "_");
  if (normalized in PLAN_PRICING_CONFIG) {
    return normalized as PlanType;
  }
  if (normalized === "enterprise") return "enterprise";
  if (normalized === "clinic") return "clinic";
  return "solo";
}

