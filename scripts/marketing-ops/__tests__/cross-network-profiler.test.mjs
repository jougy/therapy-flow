#!/usr/bin/env node
/**
 * Suíte de testes do Motor Cross-Network de Entity Resolution, Comparação Visual (sharp),
 * Constituição Obrigatória WhatsApp e Geração de Dossiê de Personalidade.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

import {
  compareAvatarsMultimodal,
  computeAvatarFingerprint,
  dHashSimilarityPct,
  expandNicknameTokens,
  generateIdentityVariants,
  parseSeedInput,
  scoreCandidateEntity,
} from '../identity-matcher.mjs';
import { auditMessageAgainstConstitution } from '../product-truth.mjs';
import { buildPersonCrossNetworkDossier } from '../cross-network-profiler.mjs';

test('1. parseSeedInput aceita URLs completas, prefixos, domínios sem protocolo e @handles', () => {
  assert.deepEqual(parseSeedInput('instagram.com/dra.carol_fisio/').handle, 'dra.carol_fisio');
  assert.equal(parseSeedInput('linkedin:joao-silva-fisio').platform, 'linkedin');
  assert.equal(parseSeedInput('https://www.tiktok.com/@fisio.marina').handle, 'fisio.marina');
  assert.equal(parseSeedInput('@dr.lucas').platform, 'instagram');
  assert.equal(parseSeedInput('https://x.com/rafafisio?s=21').platform, 'x');
});

test('2. Apelidos brasileiros, nomes abreviados e variantes funcionam nas 2 direções', () => {
  assert.ok(expandNicknameTokens('carol').has('carolina'));
  assert.ok(expandNicknameTokens('guilherme').has('gui'));
  assert.ok(expandNicknameTokens('beatriz').has('bia'));

  const variants = generateIdentityVariants({
    platform: 'instagram',
    handle: 'dra.carolsilva_fisio',
    displayName: 'Dra. Carolina Almeida Silva',
    city: 'Campinas',
  });

  assert.ok(variants.nicknameVariants.some((n) => n.includes('carol silva')));
  assert.ok(variants.abbreviatedVariants.some((a) => a.includes('c. silva') || a.includes('carolina s.')));
  assert.ok(variants.handleStems.includes('carolsilva'));
  assert.match(variants.platformQueries.linkedin[0], /linkedin\.com\/in/);
  assert.match(variants.platformQueries.facebook[0], /facebook\.com/);
});

test('3. scoreCandidateEntity aprova match cross-network (apelido + local + foto) e rejeita homônimo', () => {
  const seed = {
    platform: 'instagram',
    handle: 'carolsilva.fisio',
    canonicalUrl: 'https://www.instagram.com/carolsilva.fisio/',
    displayName: 'Carolina Silva',
    city: 'Campinas',
    state: 'SP',
    bio: 'Fisioterapeuta Ortopédica CREFITO-3/123456-F · Atendimento domiciliar e @vitalfisio.campinas',
    mentions: ['vitalfisio.campinas'],
    externalLinks: ['https://linktr.ee/carolsilvafisio'],
  };

  const validLinkedIn = {
    platform: 'linkedin',
    url: 'https://www.linkedin.com/in/carol-silva-fisio/',
    handle: 'carol-silva-fisio',
    displayName: 'Carol Silva',
    city: 'Campinas',
    bio: 'Fisioterapeuta Ortopédica na Clínica VitalFisio Campinas · CREFITO 123456-F',
    mentions: ['vitalfisio.campinas'],
    links: ['https://linktr.ee/carolsilvafisio'],
  };
  const validMatch = scoreCandidateEntity(seed, validLinkedIn, {
    status: 'same_exact_photo',
    score: 25,
    visualCues: 'Mesma foto de perfil',
  });
  assert.equal(validMatch.classification, 'verified');
  assert.ok(validMatch.totalScore >= 85, `Esperado >= 85, obteve ${validMatch.totalScore}`);

  const homonymDifferentCity = {
    platform: 'facebook',
    url: 'https://www.facebook.com/carolina.silva.recife',
    handle: 'carolina.silva.recife',
    displayName: 'Carolina Silva',
    city: 'Recife',
    bio: 'Advogada em Recife/PE',
    mentions: [],
    links: [],
  };
  const homonymMatch = scoreCandidateEntity(seed, homonymDifferentCity, {
    status: 'different_person',
    score: -10,
    visualCues: 'Pessoa diferente',
  });
  assert.equal(homonymMatch.classification, 'rejected');
  assert.ok(homonymMatch.totalScore < 45);
});

test('4. Comparação real de foto de perfil com sharp identifica idênticas/redimensionadas e separa distintas', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pluri-avatar-'));
  try {
    const imgA = path.join(tmpDir, 'a.png');
    const imgAResized = path.join(tmpDir, 'a_small.jpg');
    const imgB = path.join(tmpDir, 'b.png');

    // Imagem A: gradiente assimétrico vertical+diagonal forte para produzir dHash consistente
    const width = 128;
    const height = 128;
    const rawA = Buffer.alloc(width * height * 3);
    const rawB = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 3;
        rawA[idx] = Math.min(255, Math.round((x / width) * 240));
        rawA[idx + 1] = Math.min(255, Math.round((y / height) * 180));
        rawA[idx + 2] = 200;

        rawB[idx] = Math.max(0, 240 - Math.round((x / width) * 240));
        rawB[idx + 1] = x % 32 < 16 ? 250 : 10;
        rawB[idx + 2] = y % 32 < 16 ? 20 : 230;
      }
    }

    await sharp(rawA, { raw: { width, height, channels: 3 } }).png().toFile(imgA);
    await sharp(rawA, { raw: { width, height, channels: 3 } }).resize(64, 64).jpeg({ quality: 88 }).toFile(imgAResized);
    await sharp(rawB, { raw: { width, height, channels: 3 } }).png().toFile(imgB);

    const [fpA, fpA2, fpB] = await Promise.all([
      computeAvatarFingerprint(fs.readFileSync(imgA)),
      computeAvatarFingerprint(fs.readFileSync(imgAResized)),
      computeAvatarFingerprint(fs.readFileSync(imgB)),
    ]);

    assert.ok(dHashSimilarityPct(fpA.dHash64, fpA2.dHash64) >= 85);
    assert.ok(dHashSimilarityPct(fpA.dHash64, fpB.dHash64) < 75);

    const sameRes = await compareAvatarsMultimodal({ seedImagePath: imgA, candidateImagePath: imgAResized, useVision: false });
    assert.equal(sameRes.status, 'same_exact_photo');
    assert.equal(sameRes.score, 25);

    const diffRes = await compareAvatarsMultimodal({ seedImagePath: imgA, candidateImagePath: imgB, useVision: false });
    assert.notEqual(diffRes.status, 'same_exact_photo');
    assert.ok(diffRes.score <= 6);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('5. auditMessageAgainstConstitution bloqueia violações constitucionais e aprova abertura limpa', () => {
  const badCold = auditMessageAgainstConstitution(
    'Olá, Dr(a). Clínica, acesse https://pluri.health por R$ 37/mês usando Supabase e Redis para degustação!',
    { isColdOpening: true },
  );
  assert.equal(badCold.passed, false);
  assert.ok(badCold.issues.includes('invalid_role_salutation'));
  assert.ok(badCold.issues.includes('cold_opening_contains_url'));
  assert.ok(badCold.issues.includes('cold_opening_contains_pricing'));
  assert.ok(badCold.issues.some((i) => i.startsWith('sanitization:')));
  assert.equal(/\bsupabase\b|degusta[cç][aã]o/i.test(badCold.sanitizedText), false);

  const cleanCold = auditMessageAgainstConstitution(
    'Olá, Dra. Mariana, tudo bem? Acompanhei seu trabalho em fisioterapia domiciliar em Campinas. Hoje você organiza agenda e prontuários por planilhas/papel ou já usa algum sistema simples?',
    { isColdOpening: true },
  );
  assert.equal(cleanCold.passed, true);
  assert.equal(cleanCold.issues.length, 0);
});

test('6. buildPersonCrossNetworkDossier gera dossiê completo em modo pesquisa offline sem vazar homônimos', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pluri-profiler-'));
  try {
    const imgPath = path.join(tmpRoot, 'avatar.png');
    await sharp({
      create: { width: 96, height: 96, channels: 3, background: { r: 2, g: 132, b: 199 } },
    })
      .png()
      .toFile(imgPath);

    const out = await buildPersonCrossNetworkDossier('https://www.instagram.com/dra.bruna_pilates/', {
      dbPath: path.join(tmpRoot, 'brain.sqlite'),
      dossiersDir: path.join(tmpRoot, 'dossiers'),
      avatarsDir: path.join(tmpRoot, 'avatars'),
      useVision: false,
      skipLlm: true,
      mockSeedData: {
        displayName: 'Dra. Bruna Ferreira',
        bio: 'Fisioterapeuta e instrutora de Pilates Clínico em Sorocaba/SP. Evolução e agenda.',
        city: 'Sorocaba',
        state: 'SP',
        externalLinks: ['https://www.linkedin.com/in/bruna-ferreira-fisio/'],
        imagePath: imgPath,
      },
      mockCandidates: [
        {
          platform: 'linkedin',
          url: 'https://www.linkedin.com/in/bruna-ferreira-fisio/',
          handle: 'bruna-ferreira-fisio',
          displayName: 'Bruna Ferreira',
          title: 'Bruna Ferreira - Fisioterapeuta Pilates - Sorocaba/SP',
          bio: 'Atuação com Pilates Clínico e fisioterapia em Sorocaba.',
          city: 'Sorocaba',
          links: ['https://www.instagram.com/dra.bruna_pilates/'],
          imagePath: imgPath,
        },
        {
          platform: 'x',
          url: 'https://x.com/brunaferreira_rj',
          handle: 'brunaferreira_rj',
          displayName: 'Bruna Ferreira',
          title: 'Bruna Ferreira (@brunaferreira_rj)',
          bio: 'Engenharia Civil no Rio de Janeiro/RJ.',
          city: 'Rio de Janeiro',
          links: [],
        },
      ],
    });

    assert.equal(out.verifiedCount, 1);
    assert.equal(out.rejectedCount, 1);
    assert.equal(out.icpTier, 'studio_pilates');
    assert.equal(out.constitutionAudit.passed, true);
    assert.ok(fs.existsSync(out.mdPath));

    const md = fs.readFileSync(out.mdPath, 'utf8');
    assert.match(md, /100% Pesquisa & Estratégia \(\*\*ZERO envios WhatsApp\*\*\)/);
    assert.match(md, /Bruna Ferreira/);
    assert.match(md, /`verified`/);
    assert.match(md, /`rejected`/);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
