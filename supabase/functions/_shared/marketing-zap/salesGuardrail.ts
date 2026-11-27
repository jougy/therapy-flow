/**
 * Guardrails determinísticos de vendas no WhatsApp (custo zero de LLM):
 * 1) Detecção de mensagens automáticas de ausência/URA do WhatsApp Business.
 * 2) Sanitização de saída proibindo "degustação" e qualquer vazamento técnico/interno.
 */

export interface AutoReplyDetectionResult {
  isAutoReply: boolean;
  matchedRule: string | null;
  confidence: 'high' | 'none';
}

export interface OutboundSanitizationResult {
  cleanText: string;
  violationsFound: string[];
}

const AUTO_REPLY_PATTERNS: Array<{ rule: string; regex: RegExp }> = [
  { rule: 'explicit_auto_marker', regex: /\b(mensagem autom[aá]tica|resposta autom[aá]tica|atendimento autom[aá]tico)\b/i },
  { rule: 'unavailable_now', regex: /\b(no momento n[aã]o estamos dispon[ií]veis|no momento n[aã]o podemos atender|n[aã]o estamos dispon[ií]veis no momento)\b/i },
  { rule: 'out_of_hours', regex: /\b(fora do hor[aá]rio de atendimento|nosso hor[aá]rio de atendimento|estamos ausentes|em atendimento no momento)\b/i },
  { rule: 'return_soon_greeting', regex: /\b(obrigad[oa] por entrar em contato|agrade[cç]o (?:o )?seu contato).{0,90}\b(hor[aá]rio|retorn|dispon[ií]v|assim que poss[ií]vel|em breve)\b/is },
  { rule: 'will_reply_soon', regex: /\b(retornaremos assim que poss[ií]vel|em breve retornaremos|assim que poss[ií]vel responderemos)\b/i },
  { rule: 'ura_menu_prompt', regex: /\b(digite\s*(?:[0-9]|op[cç][aã]o)|escolha uma op[cç][aã]o|selecione uma das op[cç][oõ]es|responda com o n[uú]mero)\b/i },
];

const HUMAN_INTENT_OVERRIDE_REGEX =
  /\b(pluri\s*fisio|quanto custa|quais s[aã]o os planos|me manda os valores|gostaria de ver|tenho interesse|como funciona o sistema)\b/i;

const TECHNICAL_LEAK_PATTERNS: Array<{ tag: string; regex: RegExp; replacement: string }> = [
  { tag: 'forbidden_degustacao', regex: /\bdegusta[cç][aã]o\b/gi, replacement: 'Teste Gratuito de 7 dias' },
  { tag: 'tech_supabase', regex: /\bsupabase\b/gi, replacement: 'plataforma Pluri Fisio' },
  { tag: 'tech_postgres', regex: /\bpostgre(?:sql)?\b/gi, replacement: 'sistema seguro' },
  { tag: 'tech_redis_upstash', regex: /\b(?:upstash|redis|qstash|bullmq)\b/gi, replacement: 'sistema' },
  { tag: 'tech_evolution_baileys', regex: /\b(?:evolution\s*api|evolution|baileys)\b/gi, replacement: 'WhatsApp oficial' },
  { tag: 'tech_runtime_llm', regex: /\b(?:edge\s*functions?|deno|ollama|opencode|sqlite|zstd|pulumi|axiom|cloudflare|docker|github)\b/gi, replacement: 'sistema' },
  { tag: 'tech_internals', regex: /\b(?:service_role|anon_key|rls\b|migration\b|schema\b|webhook\b|api\s*key|token\s*secreto)\b/gi, replacement: 'configuração' },
];

function stripAccents(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function detectWhatsappAutoReply(rawText: string): AutoReplyDetectionResult {
  const clean = String(rawText || '').trim();
  if (!clean) {
    return { isAutoReply: false, matchedRule: null, confidence: 'none' };
  }

  const normalized = stripAccents(clean).toLowerCase();
  const hasExplicitAutoMarker = AUTO_REPLY_PATTERNS[0].regex.test(normalized) || AUTO_REPLY_PATTERNS[2].regex.test(normalized);

  if (!hasExplicitAutoMarker && HUMAN_INTENT_OVERRIDE_REGEX.test(normalized)) {
    return { isAutoReply: false, matchedRule: null, confidence: 'none' };
  }

  for (const { rule, regex } of AUTO_REPLY_PATTERNS) {
    if (regex.test(normalized)) {
      return { isAutoReply: true, matchedRule: rule, confidence: 'high' };
    }
  }

  return { isAutoReply: false, matchedRule: null, confidence: 'none' };
}

export function sanitizeOutboundSalesReply(reply: string): OutboundSanitizationResult {
  let cleanText = String(reply || '').trim();
  const violationsFound: string[] = [];

  for (const { tag, regex, replacement } of TECHNICAL_LEAK_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(cleanText)) {
      violationsFound.push(tag);
      regex.lastIndex = 0;
      cleanText = cleanText.replace(regex, replacement);
    }
  }

  // Colapsa eventuais duplicações leves criadas após substituição (ex.: "no sistema sistema")
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
