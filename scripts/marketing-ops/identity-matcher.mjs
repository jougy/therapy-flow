#!/usr/bin/env node
/**
 * Motor Cross-Network de Entity Resolution & Comparação Multimodal de Avatares (Pluri Fisio).
 * Correlaciona perfis em LinkedIn, Facebook, X, Instagram, TikTok e Google Maps via:
 * - Apelidos brasileiros & nomes abreviados/iniciais
 * - Localização (cidade/UF)
 * - Bio, especialidade, CREFITO e contatos/@menções/links em comum
 * - Comparação de foto de perfil via `sharp` (dHash 64-bit + histograma RGB) + Ollama `gemma4:12b` vision
 */

export {
  compareAvatarsMultimodal,
  computeAvatarFingerprint,
  dHashSimilarityPct,
  histogramSimilarityPct,
} from './avatar-vision.mjs';

export const SOCIAL_PLATFORM_ORDER = [
  'linkedin',
  'facebook',
  'x',
  'instagram',
  'tiktok',
  'google_maps',
  'web_public',
];

export const BR_NICKNAME_GROUPS = [
  ['carolina', 'caroline', 'carol', 'carolzinha'],
  ['gabriel', 'gabriela', 'gabriele', 'gabriella', 'gabi', 'biel'],
  ['guilherme', 'gui'],
  ['rafael', 'rafaela', 'raphael', 'raphaela', 'rafa'],
  ['fernando', 'fernanda', 'fe', 'nando', 'nanda'],
  ['beatriz', 'bia'],
  ['camila', 'camilla', 'cami', 'mila'],
  ['mariana', 'marina', 'maria', 'mari'],
  ['eduardo', 'eduarda', 'edu', 'dudu', 'duda'],
  ['leonardo', 'leo'],
  ['matheus', 'mateus', 'mat', 'teteu'],
  ['gustavo', 'gu', 'guga'],
  ['rodrigo', 'digo'],
  ['felipe', 'filipe', 'lipe'],
  ['lucas', 'luciana', 'luciano', 'lu', 'luci'],
  ['leticia', 'leti', 'le'],
  ['juliana', 'juliano', 'julio', 'ju', 'juju'],
  ['larissa', 'lari'],
  ['natalia', 'nathalia', 'nati', 'naty', 'nat'],
  ['jessica', 'jess'],
  ['vanessa', 'van'],
  ['bruno', 'bruna', 'bru'],
  ['vinicius', 'vini'],
  ['alexandre', 'alessandra', 'alexandro', 'alex', 'ale'],
  ['daniel', 'daniela', 'danielle', 'danilo', 'dani'],
  ['vitoria', 'victor', 'vitor', 'vi', 'vivi', 'vitinho'],
  ['isabela', 'isabella', 'isabelle', 'isa', 'bela'],
  ['giovanna', 'giovana', 'giovanni', 'gi', 'gio'],
  ['roberto', 'roberta', 'beto', 'beta'],
  ['francisco', 'francisca', 'chico', 'chica', 'fran'],
  ['jose', 'ze'],
  ['antonio', 'toni', 'tonho'],
  ['renata', 'renato', 're'],
  ['priscila', 'priscilla', 'pri'],
  ['cristiane', 'cristina', 'cristiano', 'cris'],
  ['adriana', 'adriano', 'dri'],
  ['barbara', 'babi'],
  ['fabio', 'fabiana', 'fabi'],
  ['tatiana', 'tatiane', 'tati'],
  ['paula', 'paulo', 'paola', 'paulinha', 'paulinho'],
  ['thiago', 'tiago', 'ti'],
  ['amanda', 'manda'],
  ['bianca', 'bi', 'bibi'],
  ['thais', 'tais', 'tata'],
  ['patricia', 'paty', 'pati'],
  ['marcelo', 'marcela', 'celo', 'cela'],
  ['ricardo', 'rica'],
  ['henrique', 'rique'],
  ['andre', 'andreia', 'andressa'],
  ['pedro', 'peu', 'pedrinho'],
  ['caio', 'caique'],
];

const COMPOUND_NICKNAMES = [
  ['maria eduarda', 'duda'],
  ['carlos eduardo', 'cadu'],
  ['joao pedro', 'jp'],
  ['joao paulo', 'jp'],
  ['luiz felipe', 'lufe'],
  ['ana paula', 'aninha'],
  ['ana carolina', 'carol'],
];

const NICKNAME_INDEX = (() => {
  const map = new Map();
  for (const group of BR_NICKNAME_GROUPS) {
    const set = new Set(group);
    for (const item of group) {
      const existing = map.get(item) || new Set();
      for (const g of set) existing.add(g);
      map.set(item, existing);
    }
  }
  return map;
})();

const NAME_STOPWORDS = new Set([
  'dr', 'dra', 'ft', 'prof', 'fisio', 'fisioterapia', 'fisioterapeuta', 'pilates',
  'clinica', 'consultorio', 'estudio', 'studio', 'espaco', 'reab', 'reabilitacao',
  'saude', 'integrada', 'integrativa', 'ortopedia', 'domiciliar', 'oficial', 'br',
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'sp', 'rj', 'mg', 'rs', 'pr', 'sc', 'df',
]);

const GENERIC_LINK_DOMAINS = new Set([
  'instagram.com', 'www.instagram.com', 'linkedin.com', 'www.linkedin.com',
  'facebook.com', 'www.facebook.com', 'x.com', 'twitter.com', 'tiktok.com',
  'www.tiktok.com', 'google.com', 'www.google.com', 'maps.google.com',
  'wa.me', 'api.whatsapp.com', 'linktr.ee', 'bit.ly', 'youtube.com', 'youtu.be',
]);

export function normalizeAscii(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s._@/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanHandle(raw = '') {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

export function extractHandleStem(raw = '') {
  return cleanHandle(raw)
    .replace(/^(?:dra?|ft|prof)[._-]+/i, '')
    .replace(/[._-]+(?:fisio|fisioterapeuta|fisioterapia|pilates|oficial|br)$/i, '')
    .replace(/[._-]+/g, '');
}

export function parseSeedInput(rawInput = '') {
  let raw = String(rawInput || '').trim();
  if (!raw) throw new Error('Seed social vazio.');
  if (/^(?:www\.|m\.)?(instagram\.com|linkedin\.com|facebook\.com|fb\.com|x\.com|twitter\.com|tiktok\.com|maps\.google\.com)/i.test(raw)) {
    raw = `https://${raw}`;
  }

  const prefixMatch = raw.match(/^(instagram|ig|linkedin|li|facebook|fb|x|twitter|tiktok|tt|google_maps|maps):(.+)$/i);
  if (prefixMatch && !raw.startsWith('http')) {
    const pKey = prefixMatch[1].toLowerCase();
    const val = cleanHandle(prefixMatch[2]);
    const platMap = {
      instagram: 'instagram',
      ig: 'instagram',
      linkedin: 'linkedin',
      li: 'linkedin',
      facebook: 'facebook',
      fb: 'facebook',
      x: 'x',
      twitter: 'x',
      tiktok: 'tiktok',
      tt: 'tiktok',
      google_maps: 'google_maps',
      maps: 'google_maps',
    };
    const platform = platMap[pKey] || 'instagram';
    const canonicalMap = {
      instagram: `https://www.instagram.com/${val}/`,
      linkedin: `https://www.linkedin.com/in/${val}/`,
      facebook: `https://www.facebook.com/${val}`,
      x: `https://x.com/${val}`,
      tiktok: `https://www.tiktok.com/@${val}`,
      google_maps: `https://www.google.com/maps/search/${encodeURIComponent(val)}`,
    };
    return { platform, handle: val, canonicalUrl: canonicalMap[platform], displayHint: val };
  }

  if (/^https?:\/\//i.test(raw)) {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const segs = u.pathname.split('/').filter(Boolean);
    if (host.includes('instagram.com')) {
      const handle = cleanHandle(segs[0] || '');
      return { platform: 'instagram', handle, canonicalUrl: `https://www.instagram.com/${handle}/`, displayHint: handle };
    }
    if (host.includes('linkedin.com')) {
      const handle = cleanHandle(segs[0] === 'in' || segs[0] === 'company' ? segs[1] || segs[0] : segs[0] || '');
      const kind = segs[0] === 'company' ? 'company' : 'in';
      return { platform: 'linkedin', handle, canonicalUrl: `https://www.linkedin.com/${kind}/${handle}/`, displayHint: handle.replace(/-/g, ' ') };
    }
    if (host.includes('facebook.com') || host.includes('fb.com')) {
      const handle = cleanHandle(segs[0] === 'people' ? segs[1] || '' : segs[0] || '');
      return { platform: 'facebook', handle, canonicalUrl: `https://www.facebook.com/${handle}`, displayHint: handle.replace(/\./g, ' ') };
    }
    if (host === 'x.com' || host.includes('twitter.com')) {
      const handle = cleanHandle(segs[0] || '');
      return { platform: 'x', handle, canonicalUrl: `https://x.com/${handle}`, displayHint: handle };
    }
    if (host.includes('tiktok.com')) {
      const handle = cleanHandle(segs[0] || '');
      return { platform: 'tiktok', handle, canonicalUrl: `https://www.tiktok.com/@${handle}`, displayHint: handle };
    }
    if (host.includes('google.') && (u.pathname.includes('/maps') || host.startsWith('maps.'))) {
      return { platform: 'google_maps', handle: cleanHandle(segs.join('-')), canonicalUrl: u.toString(), displayHint: decodeURIComponent(segs[segs.length - 1] || '').replace(/\+/g, ' ') };
    }
    return { platform: 'web_public', handle: cleanHandle(host), canonicalUrl: u.toString(), displayHint: host };
  }

  const handle = cleanHandle(raw);
  return {
    platform: 'instagram',
    handle,
    canonicalUrl: `https://www.instagram.com/${handle}/`,
    displayHint: handle.replace(/[._-]+/g, ' '),
  };
}

export function extractCleanNameTokens(rawName = '', rawHandle = '') {
  const nameTokens = normalizeAscii(rawName)
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 2 && !NAME_STOPWORDS.has(t));

  const handleParts = normalizeAscii(rawHandle)
    .replace(/\d+/g, ' ')
    .split(/[._-]+/)
    .flatMap((part) => (part.length >= 3 && !NAME_STOPWORDS.has(part) ? [part] : []))
    .filter((t) => !NAME_STOPWORDS.has(t));

  return { nameTokens, handleParts };
}

export function expandNicknameTokens(token = '') {
  const clean = normalizeAscii(token).replace(/[^a-z]/g, '');
  if (!clean) return new Set();
  const res = new Set([clean]);
  const grp = NICKNAME_INDEX.get(clean);
  if (grp) {
    for (const alt of grp) res.add(alt);
  }
  return res;
}

export function generateIdentityVariants(seedProfile = {}) {
  const { nameTokens, handleParts } = extractCleanNameTokens(
    seedProfile.displayName || seedProfile.fullName || '',
    seedProfile.handle || '',
  );
  const tokens = nameTokens.length >= 2 ? nameTokens : [...new Set([...nameTokens, ...handleParts])];
  const first = tokens[0] || '';
  const last = tokens.length >= 2 ? tokens[tokens.length - 1] : '';
  const joinedFull = tokens.join(' ').trim();

  const fullNameVariants = new Set();
  if (seedProfile.displayName) fullNameVariants.add(seedProfile.displayName.trim());
  if (joinedFull) fullNameVariants.add(joinedFull);
  if (first && last) fullNameVariants.add(`${first} ${last}`);

  const abbreviatedVariants = new Set();
  if (first && last) {
    abbreviatedVariants.add(`${first} ${last[0]}.`);
    abbreviatedVariants.add(`${first[0]}. ${last}`);
    if (tokens.length >= 3) {
      abbreviatedVariants.add(`${first} ${tokens[1][0]}. ${last}`);
      abbreviatedVariants.add(`${first[0]}. ${tokens[1][0]}. ${last}`);
    }
  }

  const nicknameVariants = new Set();
  if (first && last) {
    for (const alt of expandNicknameTokens(first)) {
      if (alt !== first) nicknameVariants.add(`${alt} ${last}`);
    }
  }
  for (const [compound, nick] of COMPOUND_NICKNAMES) {
    if (joinedFull.includes(compound) && last) {
      nicknameVariants.add(`${nick} ${last === 'eduarda' || last === 'eduardo' || last === 'pedro' || last === 'paulo' ? '' : last}`.trim());
    }
    if (first === nick && tokens.length >= 2) {
      nicknameVariants.add(`${compound} ${last}`.trim());
    }
  }

  const handleStems = new Set();
  if (seedProfile.handle) {
    const clean = cleanHandle(seedProfile.handle);
    handleStems.add(clean);
    const stem = extractHandleStem(clean);
    if (stem.length >= 4) handleStems.add(stem);
  }

  const primaryName = first && last ? `"${first} ${last}"` : first ? `"${first}"` : `"${[...handleStems][0] || ''}"`;
  const nickList = [...nicknameVariants].slice(0, 2).map((n) => `"${n}"`);
  const nickOrClause = nickList.length > 0 ? `(${[primaryName, ...nickList].join(' OR ')})` : primaryName;
  const cityClause = seedProfile.city ? `"${seedProfile.city}"` : '';
  const handleOr = [...handleStems].slice(0, 2).map((h) => `"${h}"`).join(' OR ');

  const platformQueries = {
    linkedin: [`site:linkedin.com/in ${nickOrClause} ${cityClause}`.trim()],
    facebook: [`(site:facebook.com/people OR site:facebook.com) ${nickOrClause} ${cityClause}`.trim()],
    x: [`(site:x.com OR site:twitter.com) (${nickOrClause}${handleOr ? ` OR ${handleOr}` : ''})`.trim()],
    instagram: [`site:instagram.com (${handleOr || primaryName})`],
    tiktok: [`site:tiktok.com (${handleOr || nickOrClause})`],
    google_maps: [
      seedProfile.clinicName
        ? `(site:google.com/maps OR "fisioterapia") "${seedProfile.clinicName}" ${cityClause}`.trim()
        : `"${first} ${last || ''}" "fisioterapia" ${cityClause}`.trim(),
    ],
    web_public: [
      `(${primaryName} OR "CREFITO") ${cityClause} ("fisioterapeuta" OR "fisioterapia" OR "pilates")`.trim(),
    ],
  };

  return {
    tokens,
    fullNameVariants: [...fullNameVariants],
    abbreviatedVariants: [...abbreviatedVariants],
    nicknameVariants: [...nicknameVariants],
    handleStems: [...handleStems],
    platformQueries,
  };
}

function extractDomainOrSlug(rawUrl = '') {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    if (host.includes('linktr.ee') || host.includes('beacons.ai') || host.includes('bio.site')) {
      return `${host}${u.pathname.replace(/\/+$/, '').toLowerCase()}`;
    }
    if (!GENERIC_LINK_DOMAINS.has(host)) return host.replace(/^www\./, '');
  } catch {
    // ignore
  }
  return null;
}

export function scoreCandidateEntity(seedProfile = {}, candidate = {}, photoResult = { score: 0, status: 'unavailable' }) {
  const reasons = [];
  const seedUrlNorm = String(seedProfile.canonicalUrl || '').toLowerCase().replace(/\/+$/, '');
  const candUrlNorm = String(candidate.url || '').toLowerCase().replace(/\/+$/, '');
  const seedHandle = cleanHandle(seedProfile.handle || '');
  const candHandle = cleanHandle(candidate.handle || '');

  const seedLinks = new Set((seedProfile.externalLinks || []).map((l) => String(l).toLowerCase().replace(/\/+$/, '')));
  const candLinks = new Set((candidate.links || []).map((l) => String(l).toLowerCase().replace(/\/+$/, '')));
  const hasDirectLink =
    (candUrlNorm && seedLinks.has(candUrlNorm)) ||
    (seedUrlNorm && candLinks.has(seedUrlNorm)) ||
    (candHandle && [...seedLinks].some((l) => l.includes(`/${candHandle}`))) ||
    (seedHandle && [...candLinks].some((l) => l.includes(`/${seedHandle}`)));

  const directCrossLink = hasDirectLink ? 55 : 0;
  if (directCrossLink > 0) reasons.push('Link cruzado explícito entre bio/site e este perfil (+55)');

  // 2. Nome, Apelido BR, Abreviação e Handle Stem
  const seedToks = extractCleanNameTokens(seedProfile.displayName || seedProfile.fullName || '', seedHandle);
  const candToks = extractCleanNameTokens(candidate.displayName || candidate.title || '', candHandle);
  const sNames = seedToks.nameTokens;
  const cNames = candToks.nameTokens;
  const sJoined = sNames.join(' ');
  const cJoined = cNames.join(' ');

  let nameNicknameScore = 0;
  const cleanSeedStem = extractHandleStem(seedHandle);
  const cleanCandStem = extractHandleStem(candHandle);

  if (sJoined && cJoined && sJoined === cJoined && sNames.length >= 2) {
    nameNicknameScore = 30;
    reasons.push(`Nome completo idêntico: "${cJoined}" (+30)`);
  } else if (cleanSeedStem && cleanCandStem && cleanSeedStem.length >= 5 && cleanSeedStem === cleanCandStem) {
    nameNicknameScore = 26;
    reasons.push(`Handle/username equivalente: @${candHandle} (+26)`);
  } else if (sNames.length >= 2 && cNames.length >= 2) {
    const sFirst = sNames[0];
    const cFirst = cNames[0];
    const sLast = sNames[sNames.length - 1];
    const cLast = cNames[cNames.length - 1];
    const sameLast = sLast === cLast || sNames.some((t) => t.length >= 4 && cNames.includes(t));
    const nickMatch = expandNicknameTokens(sFirst).has(cFirst);
    const abbrevMatch =
      (sFirst[0] === cFirst[0] && (sFirst.length === 1 || cFirst.length === 1)) ||
      (sLast[0] === cLast[0] && (sLast.length === 1 || cLast.length === 1) && sFirst === cFirst);

    if (sameLast && nickMatch) {
      nameNicknameScore = 25;
      reasons.push(`Apelido/nome equivalente + sobrenome em comum: ${sFirst} ↔ ${cFirst} (+25)`);
    } else if (sameLast && abbrevMatch) {
      nameNicknameScore = 18;
      reasons.push(`Nome abreviado/inicial compatível (+18)`);
    } else if (sameLast) {
      nameNicknameScore = 10;
      reasons.push('Sobrenome em comum (+10)');
    }
  } else if (sNames.length >= 1 && cNames.length >= 1 && (sNames[0] === cNames[0] || expandNicknameTokens(sNames[0]).has(cNames[0]))) {
    nameNicknameScore = 14;
    reasons.push('Primeiro nome/apelido compatível (+14)');
  }

  // 3. Localização (Cidade / UF)
  const sCity = normalizeAscii(seedProfile.city || '');
  const cLoc = normalizeAscii(`${candidate.city || ''} ${candidate.bio || ''} ${candidate.snippet || ''}`);
  let locationScore = 0;
  if (sCity && cLoc.includes(sCity)) {
    locationScore = 15;
    reasons.push(`Localização confirmada: ${seedProfile.city} (+15)`);
  } else if (seedProfile.state && new RegExp(`\\b${normalizeAscii(seedProfile.state)}\\b`).test(cLoc)) {
    locationScore = 8;
    reasons.push(`Estado compatível: ${seedProfile.state} (+8)`);
  } else if (sCity && candidate.city && !cLoc.includes(sCity)) {
    locationScore = -12;
    reasons.push(`Localização divergente (${candidate.city} ≠ ${seedProfile.city}) (-12)`);
  }

  // 4. Bio, Profissão, CREFITO e Clínica
  const sBioText = normalizeAscii(`${seedProfile.bio || ''} ${seedProfile.clinicName || ''} ${seedProfile.crefito || ''}`);
  const cBioText = normalizeAscii(`${candidate.bio || ''} ${candidate.snippet || ''} ${candidate.title || ''}`);
  let bioProfessionScore = 0;

  const crefitoMatch = sBioText.match(/crefito[\s:-]*(\d{4,7}[-\w]*)/i);
  if (crefitoMatch && cBioText.includes(crefitoMatch[1].toLowerCase())) {
    bioProfessionScore = 20;
    reasons.push(`CREFITO idêntico encontrado (+20)`);
  } else {
    const bioKeywords = [...new Set(sBioText.split(/[^a-z0-9]+/).filter((w) => w.length >= 5))];
    const shared = bioKeywords.filter((w) => cBioText.includes(w));
    if (shared.length >= 2) {
      bioProfessionScore = Math.min(18, shared.length * 6);
      reasons.push(`Termos/especialidade em comum na bio (${shared.slice(0, 3).join(', ')}) (+${bioProfessionScore})`);
    } else if (shared.length === 1) {
      bioProfessionScore = 8;
      reasons.push(`Termo de área/marca em comum (${shared[0]}) (+8)`);
    }
  }

  // 5. Contatos/@menções/links em comum
  const seedMentions = new Set((seedProfile.mentions || []).map(cleanHandle).filter(Boolean));
  const candMentions = new Set((candidate.mentions || []).map(cleanHandle).filter(Boolean));
  const sharedMentions = [...seedMentions].filter((m) => candMentions.has(m));
  const seedDomains = new Set([...seedLinks].map(extractDomainOrSlug).filter(Boolean));
  const candDomains = new Set([...candLinks].map(extractDomainOrSlug).filter(Boolean));
  const sharedDomains = [...seedDomains].filter((d) => candDomains.has(d));

  const mutualHits = sharedMentions.length + sharedDomains.length;
  const mutualContactsScore = Math.min(15, mutualHits * 8);
  if (mutualContactsScore > 0) {
    reasons.push(`Contatos/links em comum: ${[...sharedMentions, ...sharedDomains].slice(0, 3).join(', ')} (+${mutualContactsScore})`);
  }

  // 6. Foto de perfil
  const photoScore = Number(photoResult?.score || 0);
  if (photoScore !== 0) {
    reasons.push(`Foto de perfil [${photoResult.status}]: ${photoScore > 0 ? `+${photoScore}` : photoScore} (${photoResult.visualCues})`);
  }

  const rawSum = directCrossLink + nameNicknameScore + locationScore + bioProfessionScore + mutualContactsScore + photoScore;
  const totalScore = Math.max(0, Math.min(100, rawSum));

  let classification = 'rejected';
  if (totalScore >= 70) {
    classification =
      photoResult?.status === 'different_person' && directCrossLink === 0 && totalScore < 85
        ? 'probable'
        : 'verified';
  } else if (totalScore >= 45) {
    classification = 'probable';
  }

  return {
    totalScore,
    classification,
    breakdown: {
      directCrossLink,
      nameNicknameScore,
      locationScore,
      bioProfessionScore,
      mutualContactsScore,
      photoScore,
    },
    reasons,
  };
}
