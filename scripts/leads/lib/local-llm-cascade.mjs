#!/usr/bin/env node
/**
 * Cascata Local Custo Zero para Prospecção, Pós-Morte e Curadoria SDR
 *
 * Ordem de execução:
 *   1. Ollama local (127.0.0.1:11434 -> mimo-v2.6:latest -> gemma4:12b -> gemma4:latest)
 *   2. OpenCode Free HTTP / CLI (mimo-v2.6-flash-free -> deepseek-v4.1-flash-free -> nemotron-3.5-lightning-free)
 *   3. Fallback seguro (retorna ok=false para que o chamador use heurística determinística)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const OLLAMA_HOST = process.env.OLLAMA_HOST || '127.0.0.1';
const OLLAMA_PORT = Number(process.env.OLLAMA_PORT || 11434);
const PREFERRED_OLLAMA_MODELS = [
  process.env.OLLAMA_MODEL,
  'mimo-v2.6:latest',
  'gemma4:12b',
  'gemma4:latest',
].filter(Boolean);

const OPENCODE_FREE_MODELS = [
  process.env.OPENCODE_MODEL,
  'mimo-v2.6-flash-free',
  'deepseek-v4.1-flash-free',
  'nemotron-3.5-lightning-free',
].filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);

const DEFAULT_MAX_CHARS = 6000;
let cachedOllamaModelList = null;

export function truncatePromptText(text, maxChars = DEFAULT_MAX_CHARS) {
  const safeMax = Math.max(200, Math.min(DEFAULT_MAX_CHARS, Number(maxChars) || DEFAULT_MAX_CHARS));
  const raw = String(text || '').trim();
  if (raw.length <= safeMax) return raw;
  const suffix = `\n...[truncado <= ${safeMax}c]`;
  return `${raw.slice(0, Math.max(0, safeMax - suffix.length))}${suffix}`;
}

export function extractJsonFromText(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return null;

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fencedMatch?.[1]) candidates.push(fencedMatch[1].trim());
  candidates.push(text);

  const firstObj = text.indexOf('{');
  const lastObj = text.lastIndexOf('}');
  if (firstObj !== -1 && lastObj > firstObj) {
    candidates.push(text.slice(firstObj, lastObj + 1));
  }
  const firstArr = text.indexOf('[');
  const lastArr = text.lastIndexOf(']');
  if (firstArr !== -1 && lastArr > firstArr) {
    candidates.push(text.slice(firstArr, lastArr + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Tenta próximo recorte
    }
  }
  return null;
}

async function resolveInstalledOllamaModels() {
  if (cachedOllamaModelList !== null) return cachedOllamaModelList;
  try {
    const res = await fetch(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) {
      cachedOllamaModelList = [];
      return cachedOllamaModelList;
    }
    const data = await res.json();
    const names = Array.isArray(data?.models) ? data.models.map((m) => String(m.name || '')) : [];
    const ordered = [];
    for (const pref of PREFERRED_OLLAMA_MODELS) {
      if (names.includes(pref) && !ordered.includes(pref)) ordered.push(pref);
    }
    for (const n of names) {
      if (n && !n.includes('embed') && !ordered.includes(n)) ordered.push(n);
    }
    cachedOllamaModelList = ordered;
  } catch {
    cachedOllamaModelList = [];
  }
  return cachedOllamaModelList;
}

async function tryOllamaGenerate({ systemPrompt, userPrompt, temperature, timeoutMs, expectJson }) {
  const models = await resolveInstalledOllamaModels();
  if (models.length === 0) return null;

  for (const model of models.slice(0, 2)) {
    try {
      const res = await fetch(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          system: systemPrompt,
          prompt: userPrompt,
          think: false,
          stream: false,
          keep_alive: '5m',
          ...(expectJson ? { format: 'json' } : {}),
          options: { temperature, num_predict: 600 },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const text = String(json?.response || '').trim();
      if (text) return { ok: true, text, provider: 'ollama', model };
    } catch {
      // Tenta próximo modelo Ollama
    }
  }
  return null;
}

async function tryOpenCodeFree({ systemPrompt, userPrompt, temperature, timeoutMs }) {
  const apiKey = (process.env.OPENCODE_API_KEY || 'public').trim() || 'public';
  for (const model of OPENCODE_FREE_MODELS) {
    try {
      const res = await fetch('https://opencode.ai/zen/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = String(data?.choices?.[0]?.message?.content || '').trim();
      if (text) return { ok: true, text, provider: 'opencode_free', model };
    } catch {
      // Tenta próximo modelo gratuito OpenCode
    }
  }

  const defaultBin = path.join(os.homedir(), '.opencode/bin/opencode');
  const bin = process.env.OPENCODE_BIN || (fs.existsSync(defaultBin) ? defaultBin : null);
  if (bin) {
    try {
      const combined = `${systemPrompt}\n\n${userPrompt}`.slice(0, DEFAULT_MAX_CHARS);
      const out = execFileSync(bin, ['run', '-m', 'opencode/mimo-v2.6-flash-free', combined], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: timeoutMs,
      });
      const cleaned = String(out || '')
        .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
        .replace(/^>\s*build\s*·.*$/gm, '')
        .trim();
      if (cleaned && !cleaned.startsWith('Error:')) {
        return { ok: true, text: cleaned, provider: 'opencode_cli', model: 'opencode/mimo-v2.6-flash-free' };
      }
    } catch {
      // Fallback
    }
  }
  return null;
}

export async function callLocalLlmText({
  systemPrompt = '',
  userPrompt = '',
  temperature = 0.25,
  maxChars = DEFAULT_MAX_CHARS,
  timeoutMs = 25000,
} = {}) {
  if (process.env.LOCAL_LLM_OFFLINE === '1') {
    return { ok: false, text: '', provider: 'fallback', model: 'heuristic' };
  }

  const safeSystem = truncatePromptText(systemPrompt, 2400);
  const safeUser = truncatePromptText(userPrompt, maxChars);

  const ollamaRes = await tryOllamaGenerate({
    systemPrompt: safeSystem,
    userPrompt: safeUser,
    temperature,
    timeoutMs,
    expectJson: false,
  });
  if (ollamaRes) return ollamaRes;

  const openCodeRes = await tryOpenCodeFree({
    systemPrompt: safeSystem,
    userPrompt: safeUser,
    temperature,
    timeoutMs,
  });
  if (openCodeRes) return openCodeRes;

  return { ok: false, text: '', provider: 'fallback', model: 'heuristic' };
}

export async function callLocalLlmJson({
  systemPrompt = '',
  userPrompt = '',
  temperature = 0.2,
  maxChars = DEFAULT_MAX_CHARS,
  timeoutMs = 25000,
} = {}) {
  if (process.env.LOCAL_LLM_OFFLINE === '1') {
    return { ok: false, parsed: null, text: '', provider: 'fallback', model: 'heuristic' };
  }

  const safeSystem = truncatePromptText(
    `${systemPrompt}\nResponda EXCLUSIVAMENTE em JSON válido, sem texto extra.`,
    2400,
  );
  const safeUser = truncatePromptText(userPrompt, maxChars);

  const ollamaRes = await tryOllamaGenerate({
    systemPrompt: safeSystem,
    userPrompt: safeUser,
    temperature,
    timeoutMs,
    expectJson: true,
  });
  if (ollamaRes) {
    const parsed = extractJsonFromText(ollamaRes.text);
    if (parsed) return { ...ollamaRes, parsed };
  }

  const openCodeRes = await tryOpenCodeFree({
    systemPrompt: safeSystem,
    userPrompt: safeUser,
    temperature,
    timeoutMs,
  });
  if (openCodeRes) {
    const parsed = extractJsonFromText(openCodeRes.text);
    if (parsed) return { ...openCodeRes, parsed };
  }

  return { ok: false, parsed: null, text: '', provider: 'fallback', model: 'heuristic' };
}
