#!/usr/bin/env node
/**
 * Motor Cross-Network de Perfilamento Profundo & Dossiê de Personalidade (Pluri Fisio).
 * Modo 100% Pesquisa (zero envios WhatsApp, zero gravação em platform_auto_leads).
 *
 * Aceita apenas 1 rede social/handle e vasculha automaticamente:
 *   LinkedIn -> Facebook -> X -> Instagram -> TikTok -> Google Maps / Web
 * correlacionando apelidos, abreviações, localização, contatos em comum, bios e foto de perfil.
 *
 * Uso:
 *   npm run marketing:profile-person -- --seed="https://www.instagram.com/fulano" [--name="..."] [--city="..."]
 *   npm run marketing:profile-person -- --seeds="url1,url2,url3" [--no-vision]
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  compareAvatarsMultimodal,
  generateIdentityVariants,
  parseSeedInput,
  scoreCandidateEntity,
  SOCIAL_PLATFORM_ORDER,
} from './identity-matcher.mjs';
import {
  detectPlatformFromUrl,
  downloadAvatar,
  extractHandleFromUrl,
  extractMentionsAndLinks,
  fetchPublicHtmlMetadata,
  inferCityStateFromText,
  resolveApifyTokenSilent,
  runApifyGoogleSearchBatch,
  runApifyInstagramProfile,
  slugifyPerson,
} from './cross-network-fetchers.mjs';
import { callLocalLlmJson } from '../leads/lib/local-llm-cascade.mjs';
import {
  inferMaturityStage,
  inferPersonalityProfile,
  PERSONALITY_ARCHETYPES,
  resolveSafeGreeting,
} from '../leads/brain/personalityProfiler.mjs';
import { openBrainDb, TONE_DIRECTIVE } from '../leads/brain/schema.mjs';
import { selectStrategyForLead } from '../leads/brain/ranker.mjs';
import {
  auditMessageAgainstConstitution,
  buildCompactTruthPromptBlock,
  PLURI_URLS,
  recommendPlanForProfile,
  sanitizeOutboundSalesReply,
} from './product-truth.mjs';

export { resolveApifyTokenSilent };

const DEFAULT_PEOPLE_DOSSIERS_DIR = path.resolve(process.cwd(), '.local-data/conversion-brain/dossiers/people');
const DEFAULT_AVATARS_DIR = path.resolve(process.cwd(), '.local-data/conversion-brain/avatars');

export async function buildPersonCrossNetworkDossier(seedInput, options = {}) {
  const seedParsed = parseSeedInput(seedInput);
  const apifyToken = options.apifyToken ?? resolveApifyTokenSilent();
  const dossiersDir = options.dossiersDir || DEFAULT_PEOPLE_DOSSIERS_DIR;
  const avatarsDir = options.avatarsDir || path.join(DEFAULT_AVATARS_DIR, slugifyPerson(seedParsed.handle || seedParsed.displayHint));
  const useVision = options.useVision !== false;
  const searchFn = options.searchFn || ((qs) => runApifyGoogleSearchBatch(qs, apifyToken));
  const igScraperFn = options.igScraperFn || ((h) => runApifyInstagramProfile(h, apifyToken));
  const fetchMetaFn = options.fetchMetaFn || fetchPublicHtmlMetadata;
  const downloadImgFn = options.downloadImgFn || downloadAvatar;

  const limitations = [];
  const seedProfile = {
    platform: seedParsed.platform,
    handle: seedParsed.handle,
    canonicalUrl: seedParsed.canonicalUrl,
    displayName: String(options.nameHint || '').trim() || seedParsed.displayHint,
    bio: '',
    city: String(options.cityHint || '').trim(),
    state: '',
    clinicName: '',
    crefito: '',
    externalLinks: [],
    mentions: [],
    imageUrl: '',
    imagePath: null,
  };

  if (options.mockSeedData) {
    Object.assign(seedProfile, options.mockSeedData);
  } else {
    if (seedParsed.platform === 'instagram' && seedParsed.handle && apifyToken) {
      const ig = await igScraperFn(seedParsed.handle);
      if (ig) {
        seedProfile.displayName = ig.fullName || ig.username || seedProfile.displayName;
        seedProfile.bio = String(ig.biography || '').trim();
        seedProfile.imageUrl = ig.profilePicUrlHD || ig.profilePicUrl || '';
        const igLinks = [...(Array.isArray(ig.externalUrls) ? ig.externalUrls.map((u) => u.url || u) : []), ig.externalUrl].filter(Boolean);
        seedProfile.externalLinks.push(...igLinks);
      }
    }
    const meta = await fetchMetaFn(seedParsed.canonicalUrl);
    if (meta.ok && !meta.blocked) {
      if (!seedProfile.displayName || seedProfile.displayName === seedParsed.displayHint) {
        seedProfile.displayName = String(meta.title || '').split(/\s*[|\-•(]\s*/)[0].trim() || seedProfile.displayName;
      }
      if (!seedProfile.bio && meta.description) seedProfile.bio = meta.description;
      if (!seedProfile.imageUrl && meta.image) seedProfile.imageUrl = meta.image;
      seedProfile.externalLinks.push(...(meta.links || []));
      seedProfile.mentions.push(...(meta.mentions || []));
    } else if (meta.blocked) {
      limitations.push(`${seedParsed.platform}: acesso HTML direto bloqueado por tela de login (dados obtidos via índice público/Apify).`);
    }

    const seedHits = await searchFn([`"${seedParsed.canonicalUrl}" OR "${seedParsed.handle}"`]);
    if (seedHits.length > 0 && !seedProfile.bio) {
      seedProfile.displayName = seedHits[0].title.split(/\s*[|\-•(]\s*/)[0].trim() || seedProfile.displayName;
      seedProfile.bio = seedHits[0].snippet || seedProfile.bio;
    }

    const linkInBio = seedProfile.externalLinks.find((l) => /linktr\.ee|beacons\.ai|bio\.site/i.test(l));
    if (linkInBio) {
      const bioHub = await fetchMetaFn(linkInBio);
      if (bioHub.ok) seedProfile.externalLinks.push(...(bioHub.links || []));
    }
  }

  const locInferred = inferCityStateFromText(`${seedProfile.displayName} ${seedProfile.bio}`);
  if (!seedProfile.city && locInferred.city) seedProfile.city = locInferred.city;
  if (!seedProfile.state && locInferred.state) seedProfile.state = locInferred.state;
  const crefitoHit = seedProfile.bio.match(/crefito[\s:-]*(\d{4,7}[-\w]*)/i);
  if (crefitoHit) seedProfile.crefito = crefitoHit[1];

  const { mentions: bioMentions, links: bioLinks } = extractMentionsAndLinks(seedProfile.bio, '');
  seedProfile.mentions = [...new Set([...seedProfile.mentions, ...bioMentions])];
  seedProfile.externalLinks = [...new Set([...seedProfile.externalLinks, ...bioLinks])];

  if (!seedProfile.imagePath && seedProfile.imageUrl) {
    seedProfile.imagePath = await downloadImgFn(seedProfile.imageUrl, avatarsDir, `seed-${seedProfile.platform}`);
  }

  const identityVariants = generateIdentityVariants(seedProfile);
  const allQueries = SOCIAL_PLATFORM_ORDER.flatMap((plat) =>
    plat === seedProfile.platform ? [] : identityVariants.platformQueries[plat] || [],
  ).filter(Boolean);

  const rawSearchResults = options.mockCandidates || (await searchFn(allQueries));
  const seenUrls = new Set([seedProfile.canonicalUrl.toLowerCase().replace(/\/+$/, '')]);
  const evaluated = [];

  for (const item of rawSearchResults) {
    const urlNorm = String(item.url || '').toLowerCase().replace(/\/+$/, '');
    if (!urlNorm || seenUrls.has(urlNorm)) continue;
    seenUrls.add(urlNorm);

    const platform = item.platform || detectPlatformFromUrl(item.url);
    const handle = item.handle || extractHandleFromUrl(item.url, platform);
    const title = String(item.title || '').trim();
    const snippet = String(item.snippet || '').trim();
    const displayName = item.displayName || title.split(/\s*[|\-•(]\s*/)[0].trim();

    let enrichedMeta = { ok: false, image: item.imageUrl || '', description: item.bio || '', links: item.links || [], mentions: item.mentions || [] };
    if (!options.mockCandidates && (platform === 'x' || platform === 'tiktok' || platform === 'web_public')) {
      const m = await fetchMetaFn(item.url);
      if (m.ok && !m.blocked) {
        enrichedMeta = {
          ok: true,
          image: m.image || item.imageUrl || '',
          description: m.description || snippet,
          links: [...new Set([...(item.links || []), ...(m.links || [])])],
          mentions: [...new Set([...(item.mentions || []), ...(m.mentions || [])])],
        };
      }
    }

    const candText = `${title} ${snippet} ${enrichedMeta.description || ''}`;
    const candLoc = inferCityStateFromText(candText);
    const candExtracted = extractMentionsAndLinks(candText, '');
    const candObj = {
      platform,
      url: item.url,
      handle,
      displayName,
      title,
      snippet,
      bio: enrichedMeta.description || snippet,
      city: item.city || candLoc.city,
      links: [...new Set([...(enrichedMeta.links || []), ...candExtracted.links])],
      mentions: [...new Set([...(enrichedMeta.mentions || []), ...candExtracted.mentions])],
      imageUrl: enrichedMeta.image || item.imageUrl || '',
      imagePath: item.imagePath || null,
    };

    if (!candObj.imagePath && candObj.imageUrl) {
      const imgHash = crypto.createHash('sha1').update(urlNorm).digest('hex').slice(0, 8);
      candObj.imagePath = await downloadImgFn(candObj.imageUrl, avatarsDir, `${platform}-${imgHash}`);
    }

    const photoResult = await compareAvatarsMultimodal({
      seedImagePath: seedProfile.imagePath,
      candidateImagePath: candObj.imagePath,
      useVision,
    });
    const match = scoreCandidateEntity(seedProfile, candObj, photoResult);
    evaluated.push({ ...candObj, photoResult, match });
  }

  evaluated.sort((a, b) => b.match.totalScore - a.match.totalScore);
  const verified = evaluated.filter((e) => e.match.classification === 'verified');
  const probable = evaluated.filter((e) => e.match.classification === 'probable');
  const rejected = evaluated.filter((e) => e.match.classification === 'rejected');

  // Síntese estrita usando APENAS seed + verified (zero contaminação por homônimos)
  const verifiedCorpus = [
    seedProfile.displayName,
    seedProfile.bio,
    ...verified.map((v) => `[${v.platform}] ${v.title} — ${v.bio}`),
  ]
    .filter(Boolean)
    .join('\n');

  const isPhysioOrStudio = /(fisioterap|fisio\b|crefito|pilates|reabilita[cç][aã]o|osteopat|quiroprax|rpg\b)/i.test(verifiedCorpus);
  const icpTier = !isPhysioOrStudio
    ? 'non_icp'
    : /pilates/i.test(verifiedCorpus)
      ? 'studio_pilates'
      : /(cl[ií]nica|s[oó]cios|equipe|salas)/i.test(verifiedCorpus)
        ? 'clinic_owner'
        : 'solo_physio';

  const detPersonality = inferPersonalityProfile({
    text: verifiedCorpus,
    icpTier: icpTier === 'non_icp' ? 'solo_physio' : icpTier,
    originType: 'profile_bio',
  });
  const maturity = inferMaturityStage({
    full_name: seedProfile.displayName,
    clinic_name: seedProfile.clinicName,
    pain_excerpt: verifiedCorpus,
  });

  const db = openBrainDb(options.dbPath);
  let strategySel;
  try {
    strategySel = selectStrategyForLead(db, {
      icpTier: icpTier === 'non_icp' ? 'solo_physio' : icpTier,
      painCategory: 'organizacao_geral',
      originType: 'profile_bio',
      personalityArchetype: detPersonality.id,
      hasExplicitPainSignal: false,
    });
  } finally {
    db.close();
  }

  const recommendedPlan = recommendPlanForProfile({
    icpTier: icpTier === 'non_icp' ? 'solo_physio' : icpTier,
    maturityStage: maturity.id,
  });

  const llmAnalysis = options.skipLlm
    ? { ok: false, parsed: null }
    : await callLocalLlmJson({
        systemPrompt: [
          'Você é Analista Sênior de Personalidade e Estratégia SDR da Pluri Fisio.',
          'Analise APENAS as evidências verificadas abaixo. NUNCA invente fatos fora dos dados.',
          'Responda JSON estrito:',
          `{"archetype":"${Object.keys(PERSONALITY_ARCHETYPES).join('|')}","personality_summary":string,"values_and_interests":string[],"what_works":string[],"what_to_avoid":string[],"hypotheses_to_validate":string[],"personalized_opening":string,"followup_question":string}`,
          `Tom obrigatório: ${TONE_DIRECTIVE}`,
          buildCompactTruthPromptBlock(recommendedPlan),
        ].join('\n'),
        userPrompt: JSON.stringify({
          person: seedProfile.displayName,
          icpTier,
          city: seedProfile.city,
          verifiedEvidence: verifiedCorpus.slice(0, 3200),
          safeGreeting: resolveSafeGreeting(seedProfile.displayName, seedProfile.clinicName),
        }),
        timeoutMs: 25_000,
      });

  const safeGreeting = resolveSafeGreeting(seedProfile.displayName, seedProfile.clinicName);
  const salutation = safeGreeting && safeGreeting !== 'tudo bem' ? `Olá, ${safeGreeting}, tudo bem?` : 'Olá, tudo bem?';
  const defaultOpening = `${salutation} Acompanhei o seu trabalho${seedProfile.city ? ` em ${seedProfile.city}` : ''} e gostei bastante da forma como você apresenta sua atuação. Hoje você organiza agenda, prontuários e acompanhamentos por planilhas/papel ou já utiliza algum sistema prático no celular?`;
  const rawOpening = llmAnalysis.ok && llmAnalysis.parsed?.personalized_opening
    ? String(llmAnalysis.parsed.personalized_opening).trim()
    : defaultOpening;
  const openingAudit = auditMessageAgainstConstitution(rawOpening, { isColdOpening: true });
  const finalOpening = openingAudit.passed ? openingAudit.sanitizedText : sanitizeOutboundSalesReply(defaultOpening).cleanText;
  const finalAudit = auditMessageAgainstConstitution(finalOpening, { isColdOpening: true });

  const slug = slugifyPerson(`${seedProfile.displayName}-${seedParsed.handle}`);
  fs.mkdirSync(dossiersDir, { recursive: true });
  const mdPath = path.join(dossiersDir, `${slug}.md`);
  const jsonPath = path.join(dossiersDir, `${slug}.json`);

  const matrixRows = evaluated.length > 0
    ? evaluated.map(
        (e) =>
          `| ${e.platform} | [${e.handle || e.displayName}](${e.url}) | \`${e.match.classification}\` | **${e.match.totalScore}/100** | ${e.match.breakdown.nameNicknameScore} | ${e.match.breakdown.locationScore} | ${e.match.breakdown.mutualContactsScore} | ${e.photoResult.status} (${e.photoResult.dHashPct ?? '—'}%) | ${e.match.reasons.slice(0, 2).join('; ') || '—'} |`,
      )
    : ['| — | Nenhum perfil adicional localizado nas buscas públicas | — | — | — | — | — | — | — |'];

  const mdContent = [
    `# Dossiê Cross-Network & Personalidade — ${seedProfile.displayName}`,
    '',
    `- **Modo de Execução:** 100% Pesquisa & Estratégia (**ZERO envios WhatsApp**)`,
    `- **Semente Informada:** ${seedParsed.canonicalUrl} (\`${seedParsed.platform}\` · \`@${seedProfile.handle}\`)`,
    `- **Cidade / UF:** ${seedProfile.city || 'Não identificada'}${seedProfile.state ? `/${seedProfile.state}` : ''}`,
    `- **Fit ICP Pluri Fisio:** \`${icpTier}\`${icpTier === 'non_icp' ? ' *(Perfil fora do nicho fisioterapia/Pilates — recomendação mantida apenas como simulação)*' : ''}`,
    `- **Apelidos / Abreviações Buscadas:** ${[...identityVariants.nicknameVariants, ...identityVariants.abbreviatedVariants].slice(0, 6).join(', ') || 'Nenhum'}`,
    '',
    '## 1. Matriz de Cruzamento Multi-Rede (Entity Resolution + Foto)',
    '| Rede | Perfil | Status | Score | Nome/Apelido | Local | Contatos | Foto | Evidências |',
    '| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |',
    ...matrixRows,
    '',
    ...(limitations.length > 0 ? ['> **Limitações de Coleta Pública:** ' + limitations.join(' | '), ''] : []),
    '## 2. Perfil de Personalidade & Estilo Comunicativo',
    `- **Arquétipo:** ${PERSONALITY_ARCHETYPES[llmAnalysis.parsed?.archetype]?.label || detPersonality.label}`,
    `- **Leitura Psicológica:** ${llmAnalysis.parsed?.personality_summary || detPersonality.communicationStyle}`,
    `- **Ritmo Recomendado:** ${detPersonality.pacing}`,
    `- **O que Funciona:** ${(llmAnalysis.parsed?.what_works || [detPersonality.communicationStyle]).join('; ')}`,
    `- **O que Evitar:** ${(llmAnalysis.parsed?.what_to_avoid || [detPersonality.avoidForThisPerson]).join('; ')}`,
    '',
    '## 3. Fatos Verificados vs Hipóteses a Validar na Conversa',
    `- **Verificados (\`score >= 70\` + Seed):** ${verified.length} rede(s) adicional(is) confirmada(s) além da semente; ${probable.length} provável(is) para revisão humana; ${rejected.length} homônimo(s) descartado(s).`,
    `- **Hipóteses para Validar (não assumir como certeza):** ${(llmAnalysis.parsed?.hypotheses_to_validate || ['Modelo atual de prontuário/agenda', 'Grau de autonomia na gestão ou equipe']).join('; ')}`,
    '',
    '## 4. Plano Pluri Fisio Recomendado (Truth Pack)',
    `- **Plano Indicado:** **${recommendedPlan.planName}** (\`${recommendedPlan.planId}\`)`,
    `- **Valores Oficiais:** R$ ${recommendedPlan.annualMonthlyPrice}/mês (anual) · R$ ${recommendedPlan.quarterlyMonthlyPrice}/mês (trimestral) · R$ ${recommendedPlan.monthlyPrice}/mês (mensal) + 5% OFF PIX`,
    `- **Justificativa:** ${recommendedPlan.reason}`,
    `- **Oferta Oficial:** Consultoria gratuita de personalização + **Teste Gratuito de 7 dias** (${PLURI_URLS.trialUrl}) + **Oferta de Lançamento** (cupom 1º mês grátis nos planos anuais).`,
    '',
    '## 5. Linha Estratégica & Mensagens Prontas',
    `- **Estratégia Super-Conversor (80/20):** ${strategySel.strategy?.shortLabel} (${strategySel.estimatedSuccessPct}% est.)`,
    `- **Saudação Segura:** \`${safeGreeting}\``,
    `- **Auditoria Constitucional:** ${finalAudit.passed ? 'APROVADA (0 violações)' : `REVISAR (${finalAudit.issues.join(', ')})`}`,
    '',
    '**Mensagem 1 — Abertura Fria Natural:**',
    `> ${finalOpening}`,
    '',
    '**Mensagem 2 — Aprofundamento Pós-Resposta:**',
    `> ${llmAnalysis.parsed?.followup_question || 'Fico feliz em entender sua rotina! Quando os profissionais migram para a Pluri Fisio, geralmente o maior alívio vem de evoluir em 30 segundos pelo celular e automatizar lembretes no WhatsApp. Hoje qual parte toma mais seu tempo?'}`,
    '',
    '**Mensagem 3 — Sequência Comercial em 5 Passos (quando pedir planos/valores):**',
    '> 1) Enviar Imagem 1 (todos os planos e recursos); 2) Enviar Imagem 2 (preços oficiais Mensal/Trimestral/Anual); 3) Indicar explicitamente o plano acima; 4) Convidar para consultoria gratuita de personalização; 5) Oferecer Teste Gratuito de 7 dias + cupom de 1º mês grátis nos planos anuais.',
    '',
  ].join('\n');

  fs.writeFileSync(mdPath, mdContent, 'utf8');
  const structuredOut = {
    generatedAt: new Date().toISOString(),
    seed: seedProfile,
    identityVariants,
    verifiedCount: verified.length,
    probableCount: probable.length,
    rejectedCount: rejected.length,
    matches: evaluated,
    icpTier,
    personality: detPersonality,
    recommendedPlan,
    strategy: strategySel.strategy?.id,
    openingMessage: finalOpening,
    constitutionAudit: finalAudit,
    mdPath,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(structuredOut, null, 2), 'utf8');
  return structuredOut;
}

function parseCliArgs(argv) {
  const args = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) args[a.slice(2)] = true;
    else args[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseCliArgs(process.argv.slice(2));
  const rawList = args.seeds
    ? String(args.seeds).split(',').map((s) => s.trim()).filter(Boolean)
    : args.seed
      ? [String(args.seed).trim()]
      : [];

  if (rawList.length === 0) {
    console.error('Uso: npm run marketing:profile-person -- --seed="<url_ou_handle>" [--name="..."] [--city="..."] [--no-vision]');
    process.exit(1);
  }

  const results = [];
  for (const rawSeed of rawList) {
    const out = await buildPersonCrossNetworkDossier(rawSeed, {
      nameHint: args.name,
      cityHint: args.city,
      dossiersDir: args['out-dir'],
      useVision: !args['no-vision'],
      skipLlm: Boolean(args['skip-llm']),
    });
    results.push({
      person: out.seed.displayName,
      seed: out.seed.canonicalUrl,
      icpTier: out.icpTier,
      verifiedMatches: out.verifiedCount,
      probableMatches: out.probableCount,
      rejectedMatches: out.rejectedCount,
      plan: out.recommendedPlan.planId,
      strategy: out.strategy,
      auditPassed: out.constitutionAudit.passed,
      dossierPath: out.mdPath,
      openingMessage: out.openingMessage,
    });
  }
  console.log(JSON.stringify(results, null, 2));
}
