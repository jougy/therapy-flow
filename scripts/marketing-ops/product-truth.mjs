#!/usr/bin/env node
/**
 * Espelho ESM do Truth Pack Oficial Pluri Fisio + Guardrails (detectWhatsappAutoReply & sanitizeOutboundSalesReply).
 * Mantido 100% sincronizado com src/utils/subscriptionPricing.ts e pluriProductTruthPack.ts.
 */

export const PLURI_URLS = {
  landing: 'https://plurifisio.com.br',
  signupBase: 'https://pluri.health/auth/cadastro',
  trialUrl: 'https://pluri.health/auth/cadastro?trial=true',
};

export const PLURI_UNIVERSAL_GUARANTEES = [
  'Pacientes e atendimentos 100% ilimitados em todos os planos',
  'Duplicação rápida de evolução em até 30 segundos',
  'Teste Gratuito de 7 dias (consultório solo, sem cartão obrigatório no cadastro, limite de 20 atendimentos)',
  'Desconto adicional de 5% à vista no PIX em qualquer ciclo',
  'Conformidade LGPD, CFM 1.821/2007 e COFFITO 414 com guarda legal de 20 anos (Modo Leitura Estrito após cancelamento)',
  'Oferta de Lançamento: cupom de 1º mês grátis para planos anuais',
];

export const PLURI_PLANS = {
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

export function buildPlanCheckoutUrl(planId, cycle = 'annual', couponCode = '') {
  const base = `${PLURI_URLS.signupBase}?plan=${encodeURIComponent(planId)}&cycle=${encodeURIComponent(cycle)}`;
  const cleanCoupon = String(couponCode || '').trim().toUpperCase();
  return cleanCoupon ? `${base}&coupon=${encodeURIComponent(cleanCoupon)}` : base;
}

export function recommendPlanForProfile(input = {}, launchCouponCode = '') {
  const icp = String(input.icpTier || 'solo_physio').toLowerCase();
  const maturity = String(input.maturityStage || '').toLowerCase();
  const teamSize = typeof input.teamSize === 'number' && Number.isFinite(input.teamSize) ? input.teamSize : 0;

  let planId = 'prof_basico';
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

export function buildCompactTruthPromptBlock(recommendation, launchCouponCode = '') {
  const priceTxt = recommendation.annualMonthlyPrice
    ? `R$ ${recommendation.annualMonthlyPrice}/mês no anual (ou R$ ${recommendation.monthlyPrice}/mês mensal; +5% OFF no PIX)`
    : 'sob consulta';
  const couponTxt = String(launchCouponCode || '').trim()
    ? `cupom ${String(launchCouponCode).trim().toUpperCase()} (1º mês grátis nos planos anuais)`
    : 'cupom de 1º mês grátis nos planos anuais (informe que você libera na hora se quiser fechar)';

  return [
    'REGRAS COMERCIAIS OFICIAIS PLURI FISIO (plurifisio.com.br -> pluri.health):',
    '1. NUNCA mencione termos técnicos internos nem invente preços/funções.',
    '2. USE SEMPRE o termo canônico "Teste Gratuito de 7 dias" (sem cartão, até 20 atendimentos) — jamais use variações informais.',
    '3. SEQUÊNCIA (quando pedir planos/preços/detalhes):',
    '   a) Avise que está enviando as 2 imagens oficiais (recursos + preços);',
    `   b) Recomende ${recommendation.planName} (${priceTxt}) — ${recommendation.reason}`,
    '   c) Ofereça agendar consultoria gratuita para personalizar tudo e já sair usando;',
    `   d) Ofereça Teste Gratuito 7 dias (${PLURI_URLS.trialUrl}) + ${couponTxt}.`,
  ].join('\n').slice(0, 1400);
}

const AUTO_REPLY_PATTERNS = [
  { rule: 'explicit_auto_marker', regex: /\b(mensagem automatica|resposta automatica|atendimento automatico)\b/i },
  { rule: 'unavailable_now', regex: /\b(no momento nao estamos disponiveis|no momento nao podemos atender|nao estamos disponiveis no momento)\b/i },
  { rule: 'out_of_hours', regex: /\b(fora do horario de atendimento|nosso horario de atendimento|estamos ausentes|em atendimento no momento)\b/i },
  { rule: 'return_soon_greeting', regex: /\b(obrigad[oa] por entrar em contato|agradeco (?:o )?seu contato).{0,90}\b(horario|retorn|disponiv|assim que possivel|em breve)\b/is },
  { rule: 'will_reply_soon', regex: /\b(retornaremos assim que possivel|em breve retornaremos|assim que possivel responderemos)\b/i },
  { rule: 'ura_menu_prompt', regex: /\b(digite\s*(?:[0-9]|opcao)|escolha uma opcao|selecione uma das opcoes|responda com o numero)\b/i },
];

const HUMAN_INTENT_OVERRIDE_REGEX =
  /\b(pluri\s*fisio|quanto custa|quais sao os planos|me manda os valores|gostaria de ver|tenho interesse|como funciona o sistema)\b/i;

const TECHNICAL_LEAK_PATTERNS = [
  { tag: 'forbidden_degustacao', regex: /\bdegusta[cç][aã]o\b/gi, replacement: 'Teste Gratuito de 7 dias' },
  { tag: 'tech_supabase', regex: /\bsupabase\b/gi, replacement: 'plataforma Pluri Fisio' },
  { tag: 'tech_postgres', regex: /\bpostgre(?:sql)?\b/gi, replacement: 'sistema seguro' },
  { tag: 'tech_redis_upstash', regex: /\b(?:upstash|redis|qstash|bullmq)\b/gi, replacement: 'sistema' },
  { tag: 'tech_evolution_baileys', regex: /\b(?:evolution\s*api|evolution|baileys)\b/gi, replacement: 'WhatsApp oficial' },
  { tag: 'tech_runtime_llm', regex: /\b(?:edge\s*functions?|deno|ollama|opencode|sqlite|zstd|pulumi|axiom|cloudflare|docker|github)\b/gi, replacement: 'sistema' },
  { tag: 'tech_internals', regex: /\b(?:service_role|anon_key|rls\b|migration\b|schema\b|webhook\b|api\s*key|token\s*secreto)\b/gi, replacement: 'configuração' },
];

export function detectWhatsappAutoReply(rawText) {
  const clean = String(rawText || '').trim();
  if (!clean) return { isAutoReply: false, matchedRule: null, confidence: 'none' };

  const normalized = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const hasExplicitAuto = AUTO_REPLY_PATTERNS[0].regex.test(normalized) || AUTO_REPLY_PATTERNS[2].regex.test(normalized);

  if (!hasExplicitAuto && HUMAN_INTENT_OVERRIDE_REGEX.test(normalized)) {
    return { isAutoReply: false, matchedRule: null, confidence: 'none' };
  }

  for (const { rule, regex } of AUTO_REPLY_PATTERNS) {
    if (regex.test(normalized)) {
      return { isAutoReply: true, matchedRule: rule, confidence: 'high' };
    }
  }
  return { isAutoReply: false, matchedRule: null, confidence: 'none' };
}

export function sanitizeOutboundSalesReply(reply) {
  let cleanText = String(reply || '').trim();
  const violationsFound = [];

  for (const { tag, regex, replacement } of TECHNICAL_LEAK_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(cleanText)) {
      violationsFound.push(tag);
      regex.lastIndex = 0;
      cleanText = cleanText.replace(regex, replacement);
    }
  }

  cleanText = cleanText
    .replace(/\b(sistema|configuração|plataforma Pluri Fisio)\s+\1\b/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleanText || (violationsFound.filter((v) => v.startsWith('tech_')).length >= 3 && cleanText.length < 40)) {
    cleanText =
      'Perfeito! Posso te enviar agora as duas imagens oficiais com todos os planos e valores da Pluri Fisio, te indicar o plano ideal para o seu momento e já agendar uma consultoria gratuita para personalizar tudo com você. Prefere receber por aqui mesmo?';
  }

  return { cleanText, violationsFound };
}

const INVALID_ROLE_SALUTATION_RE =
  /\bDr\(a\)\.\s*(Cl[ií]nica|Consult[oó]rio|Est[uú]dio|Studio|Espa[çc]o|Pilates|Fisioterapia|Fisioterapeuta|Instituto|Centro|Sa[uú]de|Reabilita[çc][aã]o)\b/i;

export function auditMessageAgainstConstitution(text, { isColdOpening = false } = {}) {
  const raw = String(text || '').trim();
  const issues = [];
  const { cleanText, violationsFound } = sanitizeOutboundSalesReply(raw);

  for (const tag of violationsFound) {
    issues.push(`sanitization:${tag}`);
  }
  if (!raw) {
    issues.push('empty_message');
  }
  if (INVALID_ROLE_SALUTATION_RE.test(raw)) {
    issues.push('invalid_role_salutation');
  }

  const emojiMatches = raw.match(/\p{Extended_Pictographic}/gu) || [];
  if (emojiMatches.length > 3) {
    issues.push(`excessive_emojis:${emojiMatches.length}`);
  }

  if (isColdOpening) {
    if (raw.length > 380) {
      issues.push(`cold_opening_too_long:${raw.length}`);
    }
    if (/https?:\/\//i.test(raw)) {
      issues.push('cold_opening_contains_url');
    }
    if (/R\$\s*\d+/i.test(raw)) {
      issues.push('cold_opening_contains_pricing');
    }
    if (emojiMatches.length > 1) {
      issues.push(`cold_opening_too_many_emojis:${emojiMatches.length}`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    sanitizedText: cleanText,
  };
}
