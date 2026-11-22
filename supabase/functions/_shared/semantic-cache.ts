/**
 * Shared Semantic Cache module using Upstash Redis and Gemini Embeddings.
 */

import { executeUpstashCommand } from './schedule-cache.ts';

async function sha256Hex(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

export async function lookupSemanticCache(
  agentId: string,
  text: string,
): Promise<{ reply: string; matchType: 'exact' | 'embedding' } | null> {
  try {
    const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalized) return null;
    const hash = await sha256Hex(normalized);
    const exactKey = `marketing:faq:exact:${agentId}:${hash}`;

    const exactRes = await executeUpstashCommand(['GET', exactKey]);
    if (exactRes && typeof exactRes === 'string') {
      return { reply: exactRes, matchType: 'exact' };
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    let embRes: Response;
    try {
      embRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            content: { parts: [{ text: normalized.slice(0, 600) }] },
          }),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!embRes.ok) return null;
    const embData = (await embRes.json()) as {
      embedding?: { values?: number[] };
    };
    const vector = embData.embedding?.values;
    if (!vector || !Array.isArray(vector)) return null;

    const vecKey = `marketing:faq:vec:${agentId}`;
    const rawVecs = await executeUpstashCommand(['GET', vecKey]);
    if (!rawVecs || typeof rawVecs !== 'string') return null;

    let entries: Array<{ vector: number[]; reply: string }> = [];
    try {
      entries = JSON.parse(rawVecs);
    } catch {
      return null;
    }

    if (!Array.isArray(entries) || entries.length === 0) return null;

    let bestSim = -1;
    let bestReply: string | null = null;
    for (const entry of entries) {
      if (entry && Array.isArray(entry.vector) && typeof entry.reply === 'string') {
        const sim = cosineSimilarity(vector, entry.vector);
        if (sim > bestSim) {
          bestSim = sim;
          bestReply = entry.reply;
        }
      }
    }

    if (bestSim >= 0.93 && bestReply) {
      return { reply: bestReply, matchType: 'embedding' };
    }
  } catch (_err) {
    // Fail-safe: cache lookup errors must never crash gateway
  }
  return null;
}

export async function storeSemanticCache(
  agentId: string,
  text: string,
  reply: string,
): Promise<void> {
  try {
    const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalized || !reply) return;
    const hash = await sha256Hex(normalized);
    const exactKey = `marketing:faq:exact:${agentId}:${hash}`;

    await executeUpstashCommand(['SET', exactKey, reply, 'EX', 604800]);

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    let embRes: Response;
    try {
      embRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            content: { parts: [{ text: normalized.slice(0, 600) }] },
          }),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!embRes.ok) return;
    const embData = (await embRes.json()) as {
      embedding?: { values?: number[] };
    };
    const vector = embData.embedding?.values;
    if (!vector || !Array.isArray(vector)) return;

    const vecKey = `marketing:faq:vec:${agentId}`;
    const rawVecs = await executeUpstashCommand(['GET', vecKey]);
    let entries: Array<{ vector: number[]; reply: string }> = [];
    if (rawVecs && typeof rawVecs === 'string') {
      try {
        entries = JSON.parse(rawVecs);
      } catch {
        entries = [];
      }
    }

    entries.push({ vector, reply });
    if (entries.length > 30) {
      entries = entries.slice(entries.length - 30);
    }

    await executeUpstashCommand(['SET', vecKey, JSON.stringify(entries)]);
  } catch (_err) {
    // Fail-safe
  }
}
