/**
 * Fonte única de verdade comercial e técnica do ecossistema Pluri Fisio (plurifisio.com.br -> pluri.health).
 * Valores sincronizados 1:1 com src/utils/subscriptionPricing.ts e PlanComparisonModal.tsx.
 */

export type PluriPlanId =
  | 'prof_basico'
  | 'prof_medio'
  | 'prof_top'
  | 'clinica_basico'
  | 'clinica_medio'
  | 'clinica_top'
  | 'enterprise';

export type PluriBillingCycle = 'monthly' | 'quarterly' | 'annual';

export interface PluriPlanSpec {
  id: PluriPlanId;
  name: string;
  category: 'solo' | 'clinic' | 'enterprise';
  badge?: string;
  monthlyPrice: number | null;
  quarterlyMonthlyPrice: number | null;
  annualMonthlyPrice: number | null;
  annualDiscountLabel?: string;
  accessesSummary: string;
  highlights: string[];
}

export interface PlanRecommendationInput {
  icpTier?: string | null;
  teamSize?: number | null;
  needsAutoWhatsappReminders?: boolean;
  needsCustomForms?: boolean;
  needsRepasses?: boolean;
  hasSecretary?: boolean;
  maturityStage?: string | null;
}

export interface PlanRecommendationResult {
  planId: PluriPlanId;
  planName: string;
  monthlyPrice: number | null;
  quarterlyMonthlyPrice: number | null;
  annualMonthlyPrice: number | null;
  reason: string;
  checkoutUrl: string;
  trialUrl: string;
}

export const PLURI_URLS = {
  landing: 'https://plurifisio.com.br',
  signupBase: 'https://pluri.health/auth/cadastro',
  trialUrl: 'https://pluri.health/auth/cadastro?trial=true',
} as const;

export const PLURI_UNIVERSAL_GUARANTEES = [
  'Pacientes e atendimentos 100% ilimitados em todos os planos',
  'Duplicação rápida de evolução em até 30 segundos',
  'Teste Gratuito de 7 dias (consultório solo, sem cartão obrigatório no cadastro, limite de 20 atendimentos)',
  'Desconto adicional de 5% à vista no PIX em qualquer ciclo',
  'Conformidade LGPD, CFM 1.821/2007 e COFFITO 414 com guarda legal de 20 anos (Modo Leitura Estrito após cancelamento)',
  'Oferta de Lançamento: cupom de 1º mês grátis para planos anuais',
] as const;

export const PLURI_PLANS: Record<PluriPlanId, PluriPlanSpec> = {
  prof_basico: {
    id: 'prof_basico',
    name: 'Profissional Básico',
    category: 'solo',
    monthlyPrice: 57,
    quarterlyMonthlyPrice: 47,
    annualMonthlyPrice: 37,
    annualDiscountLabel: '-35%',
    accessesSummary: '1 acesso (1 profissional titular)',
    highlights: ['1 formulário universal + 1 complementar', 'Financeiro básico', 'WhatsApp atalho 1 toque', 'Posse perpétua do profissional'],
  },
  prof_medio: {
    id: 'prof_medio',
    name: 'Profissional Médio',
    category: 'solo',
    badge: 'Mais Popular',
    monthlyPrice: 87,
    quarterlyMonthlyPrice: 67,
    annualMonthlyPrice: 57,
    annualDiscountLabel: '-34%',
    accessesSummary: '1 acesso (1 profissional titular)',
    highlights: ['Formulários e fichas ilimitados/customizáveis', 'Financeiro completo de sessões e pacotes', 'WhatsApp atalho 1 toque'],
  },
  prof_top: {
    id: 'prof_top',
    name: 'Profissional Top',
    category: 'solo',
    badge: 'Você + Apoio',
    monthlyPrice: 127,
    quarterlyMonthlyPrice: 107,
    annualMonthlyPrice: 87,
    annualDiscountLabel: '-31%',
    accessesSummary: '2 acessos (Titular + Secretária/Apoio)',
    highlights: ['Formulários ilimitados', 'Financeiro completo + recibos', 'Lembretes automáticos por WhatsApp', 'Suporte prioritário'],
  },
  clinica_basico: {
    id: 'clinica_basico',
    name: 'Clínica Básico',
    category: 'clinic',
    monthlyPrice: 147,
    quarterlyMonthlyPrice: 127,
    annualMonthlyPrice: 97,
    annualDiscountLabel: '-34%',
    accessesSummary: '2 acessos simultâneos (colaboradores ilimitados, extra R$ 25/mês)',
    highlights: ['Agendas por salas/macas', 'Migração assistida de fichas de papel', 'Permissões padrão fixo', 'Prontuários centralizados'],
  },
  clinica_medio: {
    id: 'clinica_medio',
    name: 'Clínica Médio',
    category: 'clinic',
    badge: 'Recomendado',
    monthlyPrice: 267,
    quarterlyMonthlyPrice: 227,
    annualMonthlyPrice: 177,
    annualDiscountLabel: '-33%',
    accessesSummary: '4 acessos simultâneos (colaboradores ilimitados, extra R$ 25/mês)',
    highlights: ['Permissões editáveis por cargo', 'Controle automático de repasses', 'Financeiro completo', 'WhatsApp 1 toque'],
  },
  clinica_top: {
    id: 'clinica_top',
    name: 'Clínica Top',
    category: 'clinic',
    monthlyPrice: 447,
    quarterlyMonthlyPrice: 387,
    annualMonthlyPrice: 297,
    annualDiscountLabel: '-33%',
    accessesSummary: '8 acessos simultâneos (colaboradores ilimitados, extra R$ 25/mês)',
    highlights: ['Controle total & auditoria completa', 'Repasses automáticos', 'Lembretes automáticos por WhatsApp'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise (Redes & Hospitais)',
    category: 'enterprise',
    monthlyPrice: null,
    quarterlyMonthlyPrice: null,
    annualMonthlyPrice: null,
    accessesSummary: '10+ acessos simultâneos sob medida',
    highlights: ['Multi-unidades', 'Implantação dedicada para redes e hospitais'],
  },
};

export function buildPlanCheckoutUrl(
  planId: PluriPlanId,
  cycle: PluriBillingCycle = 'annual',
  couponCode?: string,
): string {
  const base = `${PLURI_URLS.signupBase}?plan=${encodeURIComponent(planId)}&cycle=${encodeURIComponent(cycle)}`;
  const cleanCoupon = String(couponCode || '').trim().toUpperCase();
  return cleanCoupon ? `${base}&coupon=${encodeURIComponent(cleanCoupon)}` : base;
}

export function recommendPlanForProfile(
  input: PlanRecommendationInput = {},
  launchCouponCode?: string,
): PlanRecommendationResult {
  const icp = String(input.icpTier || 'solo_physio').toLowerCase();
  const maturity = String(input.maturityStage || '').toLowerCase();
  const teamSize = typeof input.teamSize === 'number' && Number.isFinite(input.teamSize) ? input.teamSize : 0;

  let planId: PluriPlanId = 'prof_basico';
  let reason = 'Atende perfeitamente quem atende solo com foco em agilidade de prontuário e custo enxuto.';

  if (teamSize >= 10 || maturity.includes('avancada')) {
    planId = 'clinica_top';
    reason = 'Suporta equipes maiores com até 8 acessos simultâneos, auditoria total, repasses e lembretes automáticos no WhatsApp.';
  } else if (icp === 'clinic_owner' || icp === 'studio_pilates' || teamSize >= 2) {
    if (teamSize >= 6 || (input.needsAutoWhatsappReminders && icp === 'clinic_owner')) {
      planId = 'clinica_top';
      reason = 'Traz 8 acessos simultâneos, controle de repasses, auditoria e lembretes automáticos pelo WhatsApp para a equipe.';
    } else if (teamSize >= 3 || input.needsRepasses || maturity === 'pequena_crescendo') {
      planId = 'clinica_medio';
      reason = 'Equilibra 4 acessos simultâneos, permissões editáveis e controle automático de repasses entre profissionais.';
    } else {
      planId = 'clinica_basico';
      reason = 'Ideal para clínicas ou estúdios recém-estruturados: 2 acessos simultâneos, salas/macas e migração assistida de fichas.';
    }
  } else if (input.hasSecretary || input.needsAutoWhatsappReminders) {
    planId = 'prof_top';
    reason = 'Inclui 2 acessos (titular + secretária/apoio), lembretes automáticos pelo WhatsApp e financeiro com recibos.';
  } else if (input.needsCustomForms || maturity === 'consolidado') {
    planId = 'prof_medio';
    reason = 'Libera formulários/fichas ilimitados e controle financeiro completo de sessões e pacotes para atendimento individual.';
  } else {
    planId = 'prof_basico';
    reason = 'Perfeito para começar no digital sem complicação: evolução em 30s, agenda, financeiro básico e posse perpétua dos prontuários.';
  }

  const spec = PLURI_PLANS[planId];
  return {
    planId,
    planName: spec.name,
    monthlyPrice: spec.monthlyPrice,
    quarterlyMonthlyPrice: spec.quarterlyMonthlyPrice,
    annualMonthlyPrice: spec.annualMonthlyPrice,
    reason,
    checkoutUrl: buildPlanCheckoutUrl(planId, 'annual', launchCouponCode),
    trialUrl: PLURI_URLS.trialUrl,
  };
}

export const WHATSAPP_AGENT_CONSTITUTION_PROMPT = [
  'CONSTITUIÇÃO INVIOLÁVEL DOS AGENTES WHATSAPP PLURI FISIO:',
  '1. TOM: Natural, humano e simpático, mantendo profissionalismo e formalidade; frases curtas, zero gírias, zero textão e no máx. 1–2 emojis discretos.',
  '2. SIGILO & VOCABULÁRIO: Use SEMPRE "Teste Gratuito de 7 dias" (sem cartão, 20 atendimentos). NUNCA invente preços/recursos nem cite infraestrutura, bancos, servidores, APIs, chaves ou nomes de modelos IA.',
  '3. VERDADE COMERCIAL: Se não souber o cenário, pergunte antes; quando apresentar planos, siga os 5 passos (2 cards oficiais -> plano ideal -> consultoria gratuita -> Teste Gratuito 7d + 1º mês grátis no anual).',
  '4. ÉTICA & SAUDAÇÃO: Use somente fatos verificados do lead; nunca chame clínicas/marcas de "Dr(a). Clínica"; transfira para humano em dúvidas Enterprise (10+ acessos), suporte jurídico/LGPD ou se o lead pedir.',
].join('\n');

export function buildCompactTruthPromptBlock(
  recommendation: PlanRecommendationResult,
  launchCouponCode?: string,
): string {
  const priceTxt = recommendation.annualMonthlyPrice
    ? `R$ ${recommendation.annualMonthlyPrice}/mês no anual (ou R$ ${recommendation.monthlyPrice}/mês mensal; +5% OFF no PIX)`
    : 'sob consulta';
  const couponTxt = String(launchCouponCode || '').trim()
    ? `cupom ${String(launchCouponCode).trim().toUpperCase()} (1º mês grátis nos planos anuais)`
    : 'cupom de 1º mês grátis nos planos anuais (informe que você libera na hora se quiser fechar)';

  return [
    'REGRAS COMERCIAIS OFICIAIS PLURI FISIO (plurifisio.com.br -> pluri.health):',
    '1. NUNCA mencione termos técnicos internos (banco, APIs, servidores, IA local, webhooks, infraestrutura) nem invente preços/funções.',
    '2. USE SEMPRE o termo canônico "Teste Gratuito de 7 dias" (consultório solo, sem cartão no cadastro, até 20 atendimentos) — jamais use variações informais.',
    '3. SEQUÊNCIA DE APRESENTAÇÃO (quando o lead pedir planos/preços/detalhes):',
    '   a) Avise com cordialidade que está enviando as 2 imagens oficiais (1: todos os 6 planos e recursos; 2: tabela completa de preços Mensal/Trimestral/Anual);',
    `   b) Recomende explicitamente o plano ${recommendation.planName} (${priceTxt}) explicando o motivo: ${recommendation.reason}`,
    '   c) Ofereça agendar uma consultoria gratuita para personalizar formulários e agenda junto com ele(a) para já sair usando;',
    `   d) Ofereça o Teste Gratuito de 7 dias (${PLURI_URLS.trialUrl}) e destaque a oferta de lançamento: ${couponTxt}.`,
  ].join('\n').slice(0, 1400);
}
