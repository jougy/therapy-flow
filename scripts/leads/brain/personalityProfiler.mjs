#!/usr/bin/env node
/**
 * Profiler Contextual — Personalidade do Lead × Origem de Descoberta × Gancho Limpo de Conteúdo
 *
 * Garante que cada pessoa receba uma estratégia e abertura guiada pelo seu perfil psicológico
 * e pelo canal/conteúdo onde foi encontrada (sem recortes quebrados no meio de palavras).
 */

export const ORIGIN_TYPES = {
  post_comment_pain: {
    id: 'post_comment_pain',
    discoveryLabel: 'Post / Comentário Público',
    canUseContentHook: true,
  },
  profile_bio: {
    id: 'profile_bio',
    discoveryLabel: 'Perfil Social / Bio',
    canUseContentHook: true,
  },
  directory_maps: {
    id: 'directory_maps',
    discoveryLabel: 'Google Maps / Diretório',
    canUseContentHook: false,
  },
  whatsapp_inbound: {
    id: 'whatsapp_inbound',
    discoveryLabel: 'Contato Direto WhatsApp',
    canUseContentHook: false,
  },
};

export const PERSONALITY_ARCHETYPES = {
  sobrecarregado_urgente: {
    id: 'sobrecarregado_urgente',
    label: 'Sobrecarregado / Busca Alívio Imediato',
    communicationStyle: 'Empático, sereno e direto ao alívio da carga operacional',
    pacing: 'Frases curtas focadas em poupar tempo fora do horário clínico',
    preferredStrategies: ['S1_PAIN_MIRROR', 'S3_TIME_SAVER_ROI'],
    avoidForThisPerson: 'Evitar mensagens longas ou excesso de recursos técnicos na abertura',
  },
  cauteloso_tradicional: {
    id: 'cauteloso_tradicional',
    label: 'Cauteloso / Perfil Papel & Planilha',
    communicationStyle: 'Tranquilizador, didático e respeitoso com a experiência clínica',
    pacing: 'Sem jargão de TI; destacar simplicidade e acompanhamento humano',
    preferredStrategies: ['S4_ANTI_COMPLEXITY', 'S1_PAIN_MIRROR'],
    avoidForThisPerson: 'Evitar termos técnicos ou pressão para migração abrupta',
  },
  analitico_tecnico: {
    id: 'analitico_tecnico',
    label: 'Analítico / Foco Técnico & Migração',
    communicationStyle: 'Objetivo, estruturado e transparente sobre fluxo CREFITO/migração',
    pacing: 'Mostrar critério técnico, suporte próximo e transição sem perder histórico',
    preferredStrategies: ['S6_SWITCHING_RESCUE', 'S1_PAIN_MIRROR', 'S5_SOCIAL_PROOF_DEMO'],
    avoidForThisPerson: 'Evitar promessas vagas sem explicar suporte e segurança dos dados',
  },
  pragmatico_direto: {
    id: 'pragmatico_direto',
    label: 'Pragmático / Gestor Objetivo',
    communicationStyle: 'Consultivo, conciso e orientado a resultado operacional e faltas',
    pacing: 'Ir ao ponto com 1 pergunta diagnóstica e opção rápida de vídeo/teste',
    preferredStrategies: ['S2_QUICK_DIAGNOSTIC', 'S3_TIME_SAVER_ROI', 'S5_SOCIAL_PROOF_DEMO'],
    avoidForThisPerson: 'Evitar rodeios ou conversa informal demais',
  },
  relacional_acolhedor: {
    id: 'relacional_acolhedor',
    label: 'Relacional / Atendimento Próximo',
    communicationStyle: 'Caloroso, educado e consultivo, valorizando o vínculo com pacientes',
    pacing: 'Conexão genuína com a fase profissional antes de apresentar o produto',
    preferredStrategies: ['S1_PAIN_MIRROR', 'S2_QUICK_DIAGNOSTIC', 'S5_SOCIAL_PROOF_DEMO'],
    avoidForThisPerson: 'Evitar abordagem fria de telemarketing ou preço antecipado',
  },
};

export function classifyDiscoveryOrigin(item = {}) {
  const platform = String(item.source_platform || '').toLowerCase();
  const excerpt = String(item.pain_excerpt || item.source_post_excerpt || item.postText || item.text || '').trim();
  const hasPostUrl = Boolean(item.source_post_url || item.source_url || item.postUrl);

  if (platform === 'whatsapp_inbound') return ORIGIN_TYPES.whatsapp_inbound;
  if (platform === 'google_maps' || Boolean(item.placeId)) return ORIGIN_TYPES.directory_maps;
  if (platform === 'web_signal' || platform === 'facebook_group' || (hasPostUrl && excerpt.length >= 25)) {
    return ORIGIN_TYPES.post_comment_pain;
  }
  if (platform === 'instagram') return ORIGIN_TYPES.profile_bio;
  return excerpt.length >= 25 ? ORIGIN_TYPES.post_comment_pain : ORIGIN_TYPES.directory_maps;
}

export function inferPersonalityProfile({
  text = '',
  icpTier = 'solo_physio',
  originType = 'post_comment_pain',
  llmArchetype = '',
} = {}) {
  if (llmArchetype && PERSONALITY_ARCHETYPES[llmArchetype]) {
    return PERSONALITY_ARCHETYPES[llmArchetype];
  }

  const lower = String(text || '').toLowerCase();
  if (/cansad|n[aã]o est[aá] dando conta|urgente|faltas|perco horas|correria|socorro|sobrecarreg/i.test(lower)) {
    return PERSONALITY_ARCHETYPES.sobrecarregado_urgente;
  }
  if (/trocar de sistema|suporte ruim|sistema caro|integra|migra|crefito|cfm|relat[oó]rio/i.test(lower)) {
    return PERSONALITY_ARCHETYPES.analitico_tecnico;
  }
  if (/papel|caderno|planilha|excel|word|simples|f[aá]cil|leigo|nunca usei sistema/i.test(lower)) {
    return PERSONALITY_ARCHETYPES.cauteloso_tradicional;
  }
  if (
    originType === 'directory_maps' ||
    icpTier === 'clinic_owner' ||
    /cl[ií]nica|equipe|s[oó]cios|salas|faturamento|pacotes|gest[aã]o/i.test(lower)
  ) {
    return PERSONALITY_ARCHETYPES.pragmatico_direto;
  }
  if (/domiciliar|home\s*care|rec[eé]m[\s-]*formad|abrindo|inaugurando|pilates|humanizad/i.test(lower)) {
    return PERSONALITY_ARCHETYPES.relacional_acolhedor;
  }
  return PERSONALITY_ARCHETYPES.relacional_acolhedor;
}

function isValidLlmContentHook(rawHook) {
  const s = String(rawHook || '').replace(/\s+/g, ' ').trim();
  if (s.length < 14 || s.length > 110) return false;
  if (/https?:\/\/|\?|\.\.\.|["'“”«»]/i.test(s)) return false;
  if (/\b(de|da|do|das|dos|para|com|em|no|na|nos|nas|e|ou|a|o|que)$/i.test(s)) return false;
  return true;
}

export function buildCleanContentHook({
  originType = 'post_comment_pain',
  painCategory = 'organizacao_geral',
  excerpt = '',
  llmContentHook = '',
  city = '',
  specialty = '',
  clinicName = '',
} = {}) {
  const lower = String(excerpt || '').toLowerCase();
  const citySuffix = city ? ` em ${city}` : '';

  if (originType === 'directory_maps') {
    return `o trabalho da ${clinicName || 'sua clínica'}${citySuffix}`.trim();
  }
  if (originType === 'whatsapp_inbound') {
    return 'o contato realizado no WhatsApp';
  }
  if (originType === 'profile_bio') {
    return `seu trabalho em ${specialty || 'fisioterapia'}${citySuffix}`.trim();
  }

  if (isValidLlmContentHook(llmContentHook)) {
    return String(llmContentHook).replace(/\s+/g, ' ').trim().replace(/[.!,;:]+$/, '');
  }

  if (painCategory === 'prontuario') {
    if (/domiciliar|home\s*care|pacote/i.test(lower)) {
      return 'a organização de prontuários e o controle de pacotes no atendimento domiciliar';
    }
    return 'a agilidade na evolução de prontuários no padrão do CREFITO';
  }
  if (painCategory === 'faltas') {
    if (/abrindo|inaugur|come[çc]/i.test(lower)) {
      return 'a redução de faltas com confirmações automáticas no WhatsApp na abertura da clínica';
    }
    return 'a redução de faltas e remarcações pelo WhatsApp';
  }
  if (painCategory === 'papel_planilha') {
    return 'a saída das fichas em papel e planilhas para uma rotina clínica mais leve';
  }
  if (painCategory === 'sistema_atual') {
    return 'a busca por um sistema de fisioterapia mais simples e com suporte próximo';
  }
  if (painCategory === 'financeiro') {
    return 'o controle financeiro de sessões e pacotes de pacientes';
  }
  if (painCategory === 'abertura_clinica') {
    return 'a estruturação de agenda, prontuário e financeiro na abertura da clínica';
  }
  return 'a organização da agenda e dos prontuários de fisioterapia';
}

export function resolveSafeGreeting(fullName = '', clinicName = '') {
  const raw = String(fullName || '').trim();
  if (!raw) return 'tudo bem';
  const drMatch = raw.match(/(?:^|\s)(Dr\.?|Dra\.?)\s+([A-Za-zÀ-ÖØ-öø-ÿ]{2,})/i);
  if (drMatch) return `${drMatch[1]} ${drMatch[2]}`;

  const isBusinessOrRole =
    /\b(cl[ií]nica|consult[oó]rio|espa[çc]o|est[uú]dio|studio|instituto|centro|pilates|fisioterapia|fisioterapeuta|fisio|reabilita[çc][aã]o|sa[uú]de|integrativ[oa]|rpg|acupuntura|unidade|ltda|me|assessoria|comunica[çc][aã]o|patrimonial|ag[eê]ncia|marketing|solu[çc][õo]es|servi[çc]os|grupo|digital|oficial|loja|store|brand|tech|labs?)\b/i.test(raw) ||
    (clinicName && raw.toLowerCase() === String(clinicName).trim().toLowerCase());

  if (isBusinessOrRole) {
    const baseSegment = raw.split(/\s*[|•,-]\s*/)[0].trim();
    const sliced =
      baseSegment.length <= 34 ? baseSegment : baseSegment.slice(0, 34).replace(/\s+\S*$/, '').trim() || baseSegment.slice(0, 34);
    const shortBiz = sliced.replace(/\s+(?:de|da|do|das|dos|e|em|com|no|na|para)$/i, '').trim() || sliced;
    return `pessoal da ${shortBiz}`;
  }

  const first = raw.split(/\s+/)[0];
  if (!first || /^(nova|we|cl[ií]nica|assessoria|grupo|instituto|centro)$/i.test(first)) return 'tudo bem';
  return `Dr(a). ${first}`;
}

export function composeContextualOpening({
  greeting = 'tudo bem',
  originType = 'post_comment_pain',
  contentHook = 'a organização da rotina clínica',
  strategyId = 'S1_PAIN_MIRROR',
  city = '',
} = {}) {
  const cleanGreeting = String(greeting || '').trim();
  const salutation = cleanGreeting && cleanGreeting !== 'tudo bem' ? `Olá, ${cleanGreeting}, tudo bem?` : 'Olá, tudo bem?';
  const hook = String(contentHook || '').trim();
  let msg = '';

  if (originType === 'post_comment_pain') {
    if (strategyId === 'S6_SWITCHING_RESCUE') {
      msg = `${salutation} Vi sua publicação recente sobre ${hook} e compreendo o quanto um sistema travado pesa na rotina clínica. Hoje, o que mais tem gerado atrito no seu dia a dia?`;
    } else if (strategyId === 'S4_ANTI_COMPLEXITY') {
      msg = `${salutation} Acompanhei seu comentário sobre ${hook}. Muita gente adia usar sistema por achar os tradicionais complicados — hoje você prefere algo bem direto pelo celular?`;
    } else if (strategyId === 'S3_TIME_SAVER_ROI') {
      msg = `${salutation} Vi seu comentário sobre ${hook}. Para evitar perder horas fora do expediente, você já conseguiu testar alguma forma prática de automatizar essa parte?`;
    } else {
      msg = `${salutation} Vi seu comentário recente sobre ${hook} e achei oportuno perguntar com tranquilidade: hoje você já encontrou alguma solução simples para facilitar essa rotina?`;
    }
  } else if (originType === 'directory_maps') {
    if (strategyId === 'S4_ANTI_COMPLEXITY') {
      msg = `${salutation} Conheci ${hook} pelo Google Maps e gostaria de fazer uma pergunta breve: hoje a equipe organiza prontuários e agenda em papel/planilha ou já utiliza um sistema simples?`;
    } else if (strategyId === 'S3_TIME_SAVER_ROI') {
      msg = `${salutation} Encontrei ${hook} no Google Maps. Gostaria de perguntar de forma breve: hoje vocês conseguem confirmar consultas e evoluir prontuários sem tomar tempo fora do horário?`;
    } else {
      msg = `${salutation} Encontrei ${hook} no Google Maps e gostaria de fazer uma pergunta breve: atualmente vocês organizam agenda, prontuários e financeiro por planilha, papel ou algum sistema?`;
    }
  } else if (originType === 'profile_bio') {
    msg = `${salutation} Acompanhei ${hook} no Instagram${city ? ` (${city})` : ''} e parabenizo pela atuação. Gostaria de perguntar de forma breve: hoje você organiza prontuários, agenda e pacotes por planilha/papel ou já utiliza algum sistema?`;
  } else {
    msg = `${salutation} Obrigado pelo contato! Como você organiza hoje seus prontuários, agenda e recebimentos dos pacientes para eu direcionar a melhor sugestão?`;
  }

  return msg.length <= 360 ? msg : msg.slice(0, 357).replace(/\s+\S*$/, '') + '?';
}

export function inferMaturityStage(item = {}) {
  const text = [
    item.full_name,
    item.clinic_name,
    item.pain_excerpt,
    item.source_post_excerpt,
    item.ai_qualification_summary,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/abrindo|inaugur|rec[eé]m[\s-]*inaugur|montando consult|primeira cl[ií]nica|nova cl[ií]nica/i.test(text)) {
    return { id: 'clinica_recem_inaugurada', label: 'Clínica Recém-Inaugurada', scoreBoost: 18 };
  }
  if (/unidade\s|unidades|rede\s|franquia|instituto|centro\s|premium|hospital|cl[ií]nica\s+integrada/i.test(text)) {
    return { id: 'avancada_estabelecida', label: 'Clínica Avançada / Grande', scoreBoost: -20 };
  }
  if (
    item.icp_tier === 'solo_physio' ||
    /domiciliar|home\s*care|aut[oô]nom|rec[eé]m[\s-]*formad|crefito|primeiros pacientes|dra\.|dr\.|fisioterapeuta\s+[a-z]/i.test(text)
  ) {
    return { id: 'iniciante_solo', label: 'Solo / Iniciando na Área', scoreBoost: 16 };
  }
  return { id: 'pequena_crescendo', label: 'Consultório / Estúdio Enxuto', scoreBoost: 6 };
}

export function profileLeadContext(item = {}, llmHints = {}) {
  const origin = classifyDiscoveryOrigin(item);
  const rawText = [
    item.pain_excerpt,
    item.source_post_excerpt,
    item.postText,
    item.text,
    item.categoryName,
    item.specialty,
  ]
    .filter(Boolean)
    .join(' ');

  const personality = inferPersonalityProfile({
    text: rawText,
    icpTier: llmHints.icpTier || item.icp_tier || 'solo_physio',
    originType: origin.id,
    llmArchetype: llmHints.llmArchetype || '',
  });

  const contentHook = buildCleanContentHook({
    originType: origin.id,
    painCategory: llmHints.painCategory || 'organizacao_geral',
    excerpt: rawText,
    llmContentHook: llmHints.llmContentHook || '',
    city: item.city || '',
    specialty: item.specialty || '',
    clinicName: item.clinic_name || item.full_name || '',
  });

  return {
    originType: origin.id,
    discoveryLabel: origin.discoveryLabel,
    canUseContentHook: origin.canUseContentHook,
    contentHook,
    personality,
  };
}
