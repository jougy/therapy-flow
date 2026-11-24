#!/usr/bin/env node
/**
 * Local Semantic Vector Indexer for Obsidian Vault (Ollama `embeddinggemma-2:latest`)
 *
 * 1. Usa o modelo local `embeddinggemma-2:latest` (271M, 512d) via `http://127.0.0.1:11434/api/embed`.
 * 2. Indexa notas da Vault de forma incremental por hash SHA-256 (apenas notas novas/alteradas são processadas).
 * 3. Armazena vetores normalizados em `.cache/vault-embeddings.json` para busca semântica instantânea
 *    no `npm run ai:vault -- "<consulta>"` com custo ZERO de tokens na nuvem.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';

const ROOT = process.cwd();
const VAULT_DIR = path.join(ROOT, 'core/Pluri-Health');
const CACHE_FILE = path.join(ROOT, '.cache/vault-embeddings.json');
const OLLAMA_HOST = process.env.OLLAMA_HOST || '127.0.0.1';
const OLLAMA_PORT = Number(process.env.OLLAMA_PORT || 11434);
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma-2:latest';

function postEmbed(inputs, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: EMBED_MODEL,
      input: inputs,
      keep_alive: '5m',
    });
    const req = http.request(
      {
        hostname: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: '/api/embed',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(body);
              resolve(parsed.embeddings || []);
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 120)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.write(payload);
    req.end();
  });
}

function walkVaultMd(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'Arquivo Kanban') continue;
      walkVaultMd(full, list);
    } else if (e.isFile() && e.name.endsWith('.md') && e.name !== 'Kanban de Tarefas.md') {
      list.push(full);
    }
  }
  return list;
}

function buildCompactPassages(relPath, content) {
  const title = path.basename(relPath, '.md');
  const clean = content.replace(/^---[\s\S]*?---\n?/, '').trim();
  const headings = [...clean.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) => m[1].trim()).slice(0, 10);
  // Create a dense semantic representation of the note (title + path + headings + body summary)
  const textForEmbed = `Nota: ${title} (${relPath})\nTópicos: ${headings.join(' | ')}\nConteúdo: ${clean.slice(0, 1400)}`;
  const hash = crypto.createHash('sha256').update(textForEmbed).digest('hex').slice(0, 20);
  return {
    id: relPath,
    title,
    relPath,
    headings: headings.slice(0, 6),
    preview: clean.replace(/\s+/g, ' ').slice(0, 220),
    textForEmbed,
    hash,
  };
}

function roundVec(vec) {
  return vec.map((v) => Math.round(v * 10000) / 10000);
}

async function main() {
  const t0 = Date.now();
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });

  let existingById = {};
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const prev = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (prev && Array.isArray(prev.items)) {
        for (const it of prev.items) {
          existingById[it.id] = it;
        }
      }
    } catch {}
  }

  const mdFiles = walkVaultMd(VAULT_DIR);
  const toEmbed = [];
  const finalItems = [];
  let cachedCount = 0;

  for (const absPath of mdFiles) {
    const relPath = path.relative(VAULT_DIR, absPath).replace(/\\/g, '/');
    const content = fs.readFileSync(absPath, 'utf8');
    const passage = buildCompactPassages(relPath, content);
    const prev = existingById[passage.id];
    if (prev && prev.hash === passage.hash && Array.isArray(prev.vec) && prev.vec.length > 0) {
      finalItems.push(prev);
      cachedCount++;
    } else {
      toEmbed.push(passage);
    }
  }

  const BATCH_SIZE = 32;
  let embeddedCount = 0;
  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    try {
      const vecs = await postEmbed(batch.map((b) => b.textForEmbed));
      for (let j = 0; j < batch.length; j++) {
        const b = batch[j];
        const vec = vecs[j];
        if (vec && vec.length) {
          finalItems.push({
            id: b.id,
            title: b.title,
            relPath: b.relPath,
            headings: b.headings,
            preview: b.preview,
            hash: b.hash,
            vec: roundVec(vec),
          });
          embeddedCount++;
        }
      }
    } catch (err) {
      console.warn(`⚠️ Lote de embeddings ${i / BATCH_SIZE + 1} falhou (${err.message}).`);
      break;
    }
  }

  fs.writeFileSync(
    CACHE_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        model: EMBED_MODEL,
        count: finalItems.length,
        items: finalItems,
      },
      null,
      0
    ),
    'utf8'
  );

  console.log(
    `✅ Embeddings da Vault (${EMBED_MODEL}) atualizados em ${Date.now() - t0}ms: ${finalItems.length} notas indexadas (${embeddedCount} novas, ${cachedCount} em cache).`
  );
}

main();
