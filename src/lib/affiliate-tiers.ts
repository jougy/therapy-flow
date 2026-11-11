/**
 * Affiliate Tiers & Gamification Engine - Pluri-Health
 *
 * Defines the 8 official affiliate progression tiers, commission rates,
 * platform subscription discounts, and helper calculation functions.
 *
 * SSOT: core/Pluri-Health/10 - Produto/Marketing de Afiliados/01 - Regras de Negocio e Comissionamento.md
 */

export type AffiliateTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'sapphire'
  | 'ruby'
  | 'emerald'
  | 'diamond'
  | 'legendary';

export interface AffiliateTierDefinition {
  tier: AffiliateTier;
  label: string;
  color: string;
  badgeColorClass: string;
  minActiveReferrals: number;
  maxActiveReferrals: number | null;
  firstMonthCommissionPercent: number;
  recurringCommissionPercent: number;
  planDiscountPercent: number;
  eligiblePlanTier: 'none' | 'solo' | 'team' | 'enterprise';
  isSubscriptionWaived: boolean;
  tagline: string;
  benefitsList: string[];
  extraAuthorityBenefit?: string;
}

export const AFFILIATE_TIERS: readonly AffiliateTierDefinition[] = [
  {
    tier: 'bronze',
    label: 'Bronze',
    color: '#CD7F32',
    badgeColorClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
    minActiveReferrals: 0,
    maxActiveReferrals: 3,
    firstMonthCommissionPercent: 30,
    recurringCommissionPercent: 10,
    planDiscountPercent: 0,
    eligiblePlanTier: 'none',
    isSubscriptionWaived: false,
    tagline: 'Início da jornada de parceiro',
    benefitsList: [
      '30% de comissão na 1ª mensalidade paga',
      '10% de comissão recorrente vitalícia',
      'Mini-CRM e dashboard de conversões em tempo real',
      'Link oficial com cookie vitalício',
      'Cupom nominal de 30% OFF na 1ª mensalidade para indicados',
      'Kit inicial com materiais de divulgação',
    ],
  },
  {
    tier: 'silver',
    label: 'Prata',
    color: '#94A3B8',
    badgeColorClass: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800/50 dark:text-slate-200 dark:border-slate-700',
    minActiveReferrals: 4,
    maxActiveReferrals: 10,
    firstMonthCommissionPercent: 35,
    recurringCommissionPercent: 13,
    planDiscountPercent: 100,
    eligiblePlanTier: 'solo',
    isSubscriptionWaived: true,
    tagline: 'Assinatura Solo 100% Gratuita ou 50% na Equipe',
    benefitsList: [
      '35% de comissão na 1ª mensalidade paga',
      '13% de comissão recorrente vitalícia',
      '100% OFF (isenção total) no Plano Profissional Solo',
      '50% OFF no Plano Clínica com Equipe',
      'Tag oficial de Embaixador Prata no painel',
    ],
    extraAuthorityBenefit: 'Tag oficial de Embaixador Prata no painel',
  },
  {
    tier: 'gold',
    label: 'Ouro',
    color: '#EAB308',
    badgeColorClass: 'bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800/60',
    minActiveReferrals: 11,
    maxActiveReferrals: 20,
    firstMonthCommissionPercent: 40,
    recurringCommissionPercent: 16,
    planDiscountPercent: 100,
    eligiblePlanTier: 'team',
    isSubscriptionWaived: true,
    tagline: 'Assinatura Equipe 100% Gratuita e Suporte VIP',
    benefitsList: [
      '40% de comissão na 1ª mensalidade paga',
      '16% de comissão recorrente vitalícia',
      '100% OFF no Plano Clínica com Equipe',
      'Suporte prioritário via WhatsApp dedicado',
    ],
    extraAuthorityBenefit: 'Suporte prioritário via WhatsApp dedicado',
  },
  {
    tier: 'sapphire',
    label: 'Safira',
    color: '#2563EB',
    badgeColorClass: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
    minActiveReferrals: 21,
    maxActiveReferrals: 30,
    firstMonthCommissionPercent: 45,
    recurringCommissionPercent: 19,
    planDiscountPercent: 100,
    eligiblePlanTier: 'enterprise',
    isSubscriptionWaived: true,
    tagline: 'Plano Enterprise Gratuito e Círculo VIP',
    benefitsList: [
      '45% de comissão na 1ª mensalidade paga',
      '19% de comissão recorrente vitalícia',
      '100% OFF no Plano Enterprise (Colaboradores Ilimitados)',
      'Acesso ao Grupo VIP de Afiliados e Fundadores',
    ],
    extraAuthorityBenefit: 'Acesso ao Grupo VIP de Afiliados e Fundadores',
  },
  {
    tier: 'ruby',
    label: 'Rubi',
    color: '#E11D48',
    badgeColorClass: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
    minActiveReferrals: 31,
    maxActiveReferrals: 50,
    firstMonthCommissionPercent: 50,
    recurringCommissionPercent: 22,
    planDiscountPercent: 100,
    eligiblePlanTier: 'enterprise',
    isSubscriptionWaived: true,
    tagline: 'Consultoria Estratégica Trimestral',
    benefitsList: [
      '50% de comissão na 1ª mensalidade paga',
      '22% de comissão recorrente vitalícia',
      '100% OFF no Plano Enterprise Ilimitado',
      'Consultoria trimestral de estratégia e crescimento',
    ],
    extraAuthorityBenefit: 'Consultoria trimestral de estratégia',
  },
  {
    tier: 'emerald',
    label: 'Esmeralda',
    color: '#059669',
    badgeColorClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    minActiveReferrals: 51,
    maxActiveReferrals: 100,
    firstMonthCommissionPercent: 55,
    recurringCommissionPercent: 25,
    planDiscountPercent: 100,
    eligiblePlanTier: 'enterprise',
    isSubscriptionWaived: true,
    tagline: 'Destaque e Referência Oficial em Eventos',
    benefitsList: [
      '55% de comissão na 1ª mensalidade paga',
      '25% de comissão recorrente vitalícia',
      '100% OFF no Plano Enterprise Ilimitado',
      'Destaque e Referência Oficial em Eventos, palestras e webinars da Pluri',
    ],
    extraAuthorityBenefit: 'Destaque e Referência Oficial em Eventos, palestras e webinars da Pluri',
  },
  {
    tier: 'diamond',
    label: 'Diamante',
    color: '#06B6D4',
    badgeColorClass: 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60',
    minActiveReferrals: 101,
    maxActiveReferrals: 200,
    firstMonthCommissionPercent: 60,
    recurringCommissionPercent: 28,
    planDiscountPercent: 100,
    eligiblePlanTier: 'enterprise',
    isSubscriptionWaived: true,
    tagline: 'Copatrocínio de 50% em Estande de Congressos',
    benefitsList: [
      '60% de comissão na 1ª mensalidade paga',
      '28% de comissão recorrente vitalícia',
      '100% OFF no Plano Enterprise Ilimitado',
      'Copatrocínio: Pagamos 50% do valor do seu estande em congressos e simpósios de saúde',
    ],
    extraAuthorityBenefit: 'Copatrocínio: Pagamos 50% do valor do seu estande em congressos e simpósios de saúde',
  },
  {
    tier: 'legendary',
    label: 'Legendary',
    color: '#7C3AED',
    badgeColorClass: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60',
    minActiveReferrals: 201,
    maxActiveReferrals: null,
    firstMonthCommissionPercent: 65,
    recurringCommissionPercent: 30,
    planDiscountPercent: 100,
    eligiblePlanTier: 'enterprise',
    isSubscriptionWaived: true,
    tagline: 'Nível Máximo: Patrocínios Customizados e Canal Executivo',
    benefitsList: [
      '65% de comissão na 1ª mensalidade paga',
      '30% de comissão recorrente vitalícia',
      '100% OFF no Plano Enterprise Ilimitado',
      'Negociação de Patrocínios Customizados, canal executivo e benefícios sob medida',
    ],
    extraAuthorityBenefit: 'Negociação de Patrocínios Customizados, canal executivo e benefícios sob medida',
  },
];

/**
 * Returns the definition for a given tier identifier.
 */
export function getAffiliateTierDefinition(tier: AffiliateTier): AffiliateTierDefinition {
  return AFFILIATE_TIERS.find((t) => t.tier === tier) ?? AFFILIATE_TIERS[0];
}

/**
 * Calculates the earned tier based on active referral count, respecting an optional minimum floor tier.
 *
 * @param activeCount Current number of active paying referrals
 * @param floorTier Optional contract floor tier (e.g. VIP partner guarantee)
 */
export function getAffiliateTierByVolume(
  activeCount: number,
  floorTier?: AffiliateTier
): AffiliateTierDefinition {
  const safeCount = Math.max(0, Math.floor(activeCount || 0));

  const volumeTier =
    AFFILIATE_TIERS.find((def) => {
      if (def.maxActiveReferrals === null) {
        return safeCount >= def.minActiveReferrals;
      }
      return safeCount >= def.minActiveReferrals && safeCount <= def.maxActiveReferrals;
    }) ?? AFFILIATE_TIERS[0];

  if (!floorTier) {
    return volumeTier;
  }

  const floorIndex = AFFILIATE_TIERS.findIndex((t) => t.tier === floorTier);
  const volumeIndex = AFFILIATE_TIERS.findIndex((t) => t.tier === volumeTier.tier);

  if (floorIndex > volumeIndex) {
    return AFFILIATE_TIERS[floorIndex] ?? volumeTier;
  }

  return volumeTier;
}

/**
 * Returns the next higher tier in progression, or null if already at Legendary.
 */
export function getNextAffiliateTier(
  currentTier: AffiliateTier
): AffiliateTierDefinition | null {
  const currentIndex = AFFILIATE_TIERS.findIndex((t) => t.tier === currentTier);
  if (currentIndex === -1 || currentIndex >= AFFILIATE_TIERS.length - 1) {
    return null;
  }
  return AFFILIATE_TIERS[currentIndex + 1] ?? null;
}

/**
 * Calculates progress percentage (0 - 100) towards unlocking the next tier.
 * For Legendary (highest tier), returns 100.
 */
export function getTierProgressPercentage(
  activeCount: number,
  currentTier: AffiliateTier
): number {
  const currentDef = getAffiliateTierDefinition(currentTier);
  const nextDef = getNextAffiliateTier(currentTier);

  if (!nextDef) {
    return 100;
  }

  const safeCount = Math.max(0, activeCount || 0);
  const rangeSpan = nextDef.minActiveReferrals - currentDef.minActiveReferrals;
  if (rangeSpan <= 0) {
    return 100;
  }

  const progressInsideTier = safeCount - currentDef.minActiveReferrals;
  const percentage = (progressInsideTier / rangeSpan) * 100;

  return Math.min(100, Math.max(0, Math.round(percentage)));
}

/**
 * Formats a commission number as a clean percentage string (e.g. 30 -> "30%", 0.35 -> "35%").
 */
export function formatCommissionPercent(val: number): string {
  if (!Number.isFinite(val)) return '0%';
  const normalized = val > 0 && val < 1 ? val * 100 : val;
  const rounded = Math.round(normalized * 10) / 10;
  return `${rounded}%`;
}
