#!/usr/bin/env node
/**
 * Comparação Multimodal de Avatares (dHash perceptual + histograma RGB via `sharp` + Ollama `gemma4:12b` Vision).
 */

import fs from 'node:fs';
import sharp from 'sharp';

export async function computeAvatarFingerprint(imageBuffer) {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length < 32) {
    throw new Error('Buffer de imagem inválido.');
  }
  const gray = await sharp(imageBuffer).rotate().grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const idx = row * 9 + col;
      bits += gray[idx] > gray[idx + 1] ? '1' : '0';
    }
  }
  const dHash64 = BigInt(`0b${bits}`).toString(16).padStart(16, '0');

  const rgb = await sharp(imageBuffer).rotate().removeAlpha().resize(16, 16, { fit: 'fill' }).raw().toBuffer();
  const bins = new Array(24).fill(0);
  const totalPixels = 256;
  for (let i = 0; i < rgb.length; i += 3) {
    bins[Math.min(7, rgb[i] >> 5)]++;
    bins[8 + Math.min(7, rgb[i + 1] >> 5)]++;
    bins[16 + Math.min(7, rgb[i + 2] >> 5)]++;
  }
  const colorHist = bins.map((v) => v / (totalPixels * 3));
  return { dHash64, colorHist };
}

export function dHashSimilarityPct(hashA, hashB) {
  if (!hashA || !hashB) return 0;
  const x = BigInt(`0x${hashA}`) ^ BigInt(`0x${hashB}`);
  let diff = 0;
  let tmp = x;
  while (tmp > 0n) {
    diff += Number(tmp & 1n);
    tmp >>= 1n;
  }
  return Math.round(((64 - diff) / 64) * 100);
}

export function histogramSimilarityPct(histA = [], histB = []) {
  if (!histA.length || histA.length !== histB.length) return 0;
  let overlap = 0;
  for (let i = 0; i < histA.length; i++) overlap += Math.min(histA[i], histB[i]);
  return Math.max(0, Math.min(100, Math.round(overlap * 100)));
}

export async function compareAvatarsMultimodal({
  seedImagePath,
  candidateImagePath,
  useVision = true,
  ollamaHost = process.env.OLLAMA_HOST || '127.0.0.1',
  ollamaPort = Number(process.env.OLLAMA_PORT || 11434),
} = {}) {
  if (!seedImagePath || !candidateImagePath || !fs.existsSync(seedImagePath) || !fs.existsSync(candidateImagePath)) {
    return {
      status: 'unavailable',
      score: 0,
      dHashPct: null,
      colorPct: null,
      visionVerdict: null,
      visualCues: 'Foto indisponível (perfil privado ou sem imagem pública)',
    };
  }

  let fpA;
  let fpB;
  try {
    const [bufA, bufB] = [fs.readFileSync(seedImagePath), fs.readFileSync(candidateImagePath)];
    [fpA, fpB] = await Promise.all([computeAvatarFingerprint(bufA), computeAvatarFingerprint(bufB)]);
  } catch {
    return { status: 'unavailable', score: 0, dHashPct: null, colorPct: null, visionVerdict: null, visualCues: 'Imagem ilegível' };
  }

  const dHashPct = dHashSimilarityPct(fpA.dHash64, fpB.dHash64);
  const colorPct = histogramSimilarityPct(fpA.colorHist, fpB.colorHist);
  if (dHashPct >= 82) {
    return {
      status: 'same_exact_photo',
      score: 25,
      dHashPct,
      colorPct,
      visionVerdict: 'same_exact_photo',
      visualCues: `Mesma foto de perfil ou recorte equivalente (dHash=${dHashPct}%, cor=${colorPct}%)`,
    };
  }

  if (useVision) {
    try {
      const [b64A, b64B] = await Promise.all([
        sharp(seedImagePath).rotate().resize(384, 384, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer().then((b) => b.toString('base64')),
        sharp(candidateImagePath).rotate().resize(384, 384, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer().then((b) => b.toString('base64')),
      ]);
      const res = await fetch(`http://${ollamaHost}:${ollamaPort}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemma4:12b',
          think: false,
          stream: false,
          keep_alive: '5m',
          format: 'json',
          messages: [{
            role: 'user',
            content: 'Compare as 2 fotos de perfil e responda apenas JSON: {"verdict":"same_exact_photo|likely_same_person|likely_same_brand_logo|inconclusive|different_person","confidence_0_100":0,"visual_cues":"resumo curto em PT-BR"}',
            images: [b64A, b64B],
          }],
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(String(data?.message?.content || '{}'));
        const verdict = String(parsed.verdict || 'inconclusive');
        const conf = Number(parsed.confidence_0_100 || 0);
        const cues = String(parsed.visual_cues || `Visão local (dHash=${dHashPct}%)`);
        if (verdict === 'same_exact_photo') {
          return { status: 'same_exact_photo', score: 25, dHashPct, colorPct, visionVerdict: verdict, visualCues: cues };
        }
        if ((verdict === 'likely_same_person' || verdict === 'likely_same_brand_logo') && conf >= 70) {
          return {
            status: verdict,
            score: Math.min(22, Math.round(16 + (conf - 70) * 0.2)),
            dHashPct,
            colorPct,
            visionVerdict: verdict,
            visualCues: cues,
          };
        }
        if (verdict === 'different_person' && conf >= 75) {
          return { status: 'different_person', score: -10, dHashPct, colorPct, visionVerdict: verdict, visualCues: cues };
        }
      }
    } catch {
      // Segue para heurística perceptual determinística
    }
  }

  const approxScore = dHashPct >= 68 && colorPct >= 75 ? 6 : 0;
  return {
    status: approxScore > 0 ? 'visual_hint' : 'inconclusive',
    score: approxScore,
    dHashPct,
    colorPct,
    visionVerdict: 'inconclusive',
    visualCues: `Comparação perceptual (dHash=${dHashPct}%, cor=${colorPct}%)`,
  };
}
