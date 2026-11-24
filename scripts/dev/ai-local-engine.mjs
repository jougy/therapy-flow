#!/usr/bin/env node
/**
 * AI Local Engine v2 (Ollama mimo-v2.6/gemma4 + embeddinggemma-2 + OpenCode Free Cascade + AST/Vault Graph)
 *
 * Motor unificado para buscas, grafos e resumos locais com custo ZERO de tokens na nuvem principal.
 * Modos suportados via CLI:
 *   node scripts/dev/ai-local-engine.mjs vault "<query>"
 *   node scripts/dev/ai-local-engine.mjs schema "<table_or_rpc>" [--exact]
 *   node scripts/dev/ai-local-engine.mjs scout "<file_or_term>"
 *   node scripts/dev/ai-local-engine.mjs graph <gods|communities|impact|neighbors|path|rpc|table|capability|vault> [alvo] [alvo2]
 *   node scripts/dev/ai-local-engine.mjs health
 *   node scripts/dev/ai-local-engine.mjs test "<vitest_target>"
 *   node scripts/dev/ai-local-engine.mjs diff [diff_or_stdin]
 */

import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFileSync, spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const OLLAMA_HOST = process.env.OLLAMA_HOST || '127.0.0.1';
const OLLAMA_PORT = Number(process.env.OLLAMA_PORT || 11434);
const PREFERRED_OLLAMA_MODELS = [
  process.env.OLLAMA_MODEL,
  'mimo-v2.6:latest',
  'gemma4:12b',
  'gemma4:latest',
].filter(Boolean);
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma-2:latest';

const defaultOpencodePath = path.join(os.homedir(), '.opencode/bin/opencode');
const OPENCODE_BIN =
  process.env.OPENCODE_BIN || (fs.existsSync(defaultOpencodePath) ? defaultOpencodePath : 'opencode');

const OPENCODE_FREE_CASCADE = [
  process.env.OPENCODE_MODEL,
  'opencode/mimo-v2.6-flash-free',
  'opencode/deepseek-v4.1-flash-free',
  'opencode/nemotron-3.5-lightning-free',
  'opencode/big-pickle',
].filter((v, idx, arr) => Boolean(v) && arr.indexOf(v) === idx);

let cachedOllamaModels = null;

function httpRequestJson(host, port, reqPath, method = 'GET', payload = null, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const req = http.request(
      {
        hostname: host,
        port,
        path: reqPath,
        method,
        headers: data
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(data),
            }
          : {},
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve({ raw: body });
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
    if (data) req.write(data);
    req.end();
  });
}

async function resolveOllamaModel() {
  if (cachedOllamaModels === null) {
    try {
      const tags = await httpRequestJson(OLLAMA_HOST, OLLAMA_PORT, '/api/tags', 'GET', null, 1800);
      cachedOllamaModels = (tags?.models || []).map((m) => m.name);
    } catch {
      cachedOllamaModels = [];
    }
  }
  if (!cachedOllamaModels.length) return null;
  for (const candidate of PREFERRED_OLLAMA_MODELS) {
    if (cachedOllamaModels.includes(candidate)) return candidate;
  }
  const nonEmbed = cachedOllamaModels.find((m) => !m.includes('embed'));
  return nonEmbed || null;
}

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

export async function askOpenCodeFree(systemPrompt, userContent, modelsToTry = OPENCODE_FREE_CASCADE) {
  const prompt = `${systemPrompt}\n\n${userContent.slice(0, 6000)}`;
  for (const modelName of modelsToTry) {
    try {
      const stdout = await new Promise((resolve, reject) => {
        const child = spawn(OPENCODE_BIN, ['run', '-m', modelName, prompt], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let out = '';
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error('timeout'));
        }, 25000);
        child.stdout.on('data', (d) => {
          out += d.toString();
        });
        child.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
        child.on('close', (code) => {
          clearTimeout(timer);
          if (code === 0) resolve(out);
          else reject(new Error(`exit ${code}`));
        });
      });

      const text = stripAnsi(stdout)
        .replace(/^>\s*build\s*·.*$/gm, '')
        .trim();
      if (text && !text.startsWith('Error:')) {
        return { provider: modelName, text };
      }
    } catch {
      // Try next free model in cascade
    }
  }
  return null;
}

export async function askLocalLLM(systemPrompt, userContent, maxTokens = 170) {
  const forceProvider = process.env.AI_PROVIDER || '';

  // 1. Try Ollama Local (with `think: false` so thinking models don't exhaust num_predict!)
  if (forceProvider !== 'opencode') {
    try {
      const ollamaModel = await resolveOllamaModel();
      if (ollamaModel) {
        const res = await httpRequestJson(
          OLLAMA_HOST,
          OLLAMA_PORT,
          '/api/generate',
          'POST',
          {
            model: ollamaModel,
            system: systemPrompt,
            prompt: userContent.slice(0, 6000),
            think: false,
            stream: false,
            keep_alive: '5m',
            options: { temperature: 0.1, num_predict: maxTokens },
          },
          25000
        );
        const answer = (res?.response || '').trim();
        if (answer) {
          return { provider: `ollama:${ollamaModel}`, text: answer };
        }
      }
    } catch {
      // Fallback to OpenCode Free cascade
    }
  }

  // 2. Try OpenCode Free Agent Cascade
  if (forceProvider !== 'ollama') {
    const oc = await askOpenCodeFree(systemPrompt, userContent);
    if (oc) return oc;
  }

  return null;
}

async function embedQueryLocal(queryText) {
  try {
    const res = await httpRequestJson(
      OLLAMA_HOST,
      OLLAMA_PORT,
      '/api/embed',
      'POST',
      {
        model: OLLAMA_EMBED_MODEL,
        input: [queryText],
        keep_alive: '5m',
      },
      25000
    );
    return res?.embeddings?.[0] || null;
  } catch {
    return null;
  }
}

function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function searchVaultSemantic(queryText, topK = 4) {
  const embFile = path.join(ROOT, '.cache/vault-embeddings.json');
  if (!fs.existsSync(embFile)) return [];
  let indexData = null;
  try {
    indexData = JSON.parse(fs.readFileSync(embFile, 'utf8'));
  } catch {
    return [];
  }
  if (!indexData?.items?.length) return [];

  const qVec = await embedQueryLocal(queryText);
  if (!qVec) return [];

  return indexData.items
    .map((item) => ({
      title: item.title,
      relPath: item.relPath,
      headings: item.headings || [],
      preview: item.preview || '',
      score: cosineSim(qVec, item.vec),
    }))
    .filter((r) => r.score >= 0.42)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// Exclui Kanban de Tarefas, Arquivo Kanban, .obsidian e binários para que atualizações de Kanban não destruam o cache!
function getVaultKnowledgeMaxMtime(vaultDir) {
  let max = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name.startsWith('.') || e.name === 'Arquivo Kanban') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          walk(full);
        } else if (e.isFile() && e.name.endsWith('.md') && e.name !== 'Kanban de Tarefas.md') {
          const stat = fs.statSync(full);
          if (stat.mtimeMs > max) max = stat.mtimeMs;
        }
      }
    } catch {}
  }
  walk(vaultDir);
  return max;
}

function runSearch(query, targetDir, maxCount = 6, contextLines = 2) {
  try {
    const args = [
      '-i',
      '-n',
      '--glob',
      '!.obsidian/**',
      '--glob',
      '!**/Arquivo Kanban/**',
      '--glob',
      '!**/Kanban de Tarefas.md',
      '--glob',
      '!*.png',
    ];
    if (contextLines > 0) args.push('-C', String(contextLines));
    args.push('--max-count', String(maxCount), query, targetDir);
    return execFileSync('rg', args, { encoding: 'utf8', maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    if (e.stdout) return e.stdout;
    try {
      const args = [
        '-r',
        '-i',
        '-n',
        '--binary-files=without-match',
        '--exclude-dir=.obsidian',
        '--exclude-dir=Arquivo Kanban',
        '--exclude=Kanban de Tarefas.md',
        '--exclude=*.png',
        '--exclude=*.docx',
      ];
      if (contextLines > 0) args.push('-C', String(contextLines));
      args.push('-m', String(maxCount), query, targetDir);
      return execFileSync('grep', args, { encoding: 'utf8', maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (ge) {
      return ge.stdout || '';
    }
  }
}

// ============================================================================
// 1. VAULT QUERY (Text + Graph + Semantic Embeddings + Selective Cache)
// ============================================================================
async function handleVault(query) {
  const vaultDir = path.join(ROOT, 'core/Pluri-Health');
  if (!query || query === '--kanban' || query.toLowerCase() === 'kanban') {
    const kanbanPath = path.join(vaultDir, '00 - Navegacao/Kanban de Tarefas.md');
    const lines = fs.readFileSync(kanbanPath, 'utf8').split('\n');
    const execIdx = lines.findIndex((l) => l.trim() === '## Executando agora');
    const finIdx = lines.findIndex((l) => l.trim() === '## Finalizados');
    const activeCards = lines
      .slice(execIdx, finIdx)
      .filter((l) => l.startsWith('## ') || l.startsWith('- [ ]') || l.includes('📝'))
      .join('\n');
    console.log(`📋 [KANBAN RESUMO ATIVO]\n${activeCards}`);
    return;
  }

  const cacheDir = path.join(ROOT, '.cache/vault-queries');
  fs.mkdirSync(cacheDir, { recursive: true });

  const queryHash = crypto.createHash('sha256').update(query.trim().toLowerCase()).digest('hex');
  const cacheFile = path.join(cacheDir, `${queryHash}.json`);
  const vaultMtime = getVaultKnowledgeMaxMtime(vaultDir);

  if (fs.existsSync(cacheFile) && !process.env.NO_CACHE) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cached && typeof cached.cachedAt === 'number' && cached.cachedAt >= vaultMtime) {
        console.log(`⚡ [VAULT SÍNTESE (CACHE HIT · ${cached.provider || 'local'})]\n${cached.content}`);
        return;
      }
    } catch {}
  }

  const rgOut = runSearch(query, vaultDir, 6, 2);
  const compactMatches = rgOut
    .split('\n')
    .map((l) => l.replace(vaultDir + '/', ''))
    .filter(Boolean)
    .slice(0, 36)
    .join('\n');

  // Consult Semantic Embeddings when textual matches are scarce or for hybrid recall
  const semanticHits = await searchVaultSemantic(query, 4);
  const semanticBlock = semanticHits.length
    ? semanticHits
        .map((s) => `• [[${s.title}]] (${s.relPath}, sim=${s.score.toFixed(2)}): ${s.headings.slice(0, 3).join(' / ') || s.preview.slice(0, 100)}`)
        .join('\n')
    : '';

  if (!compactMatches && !semanticBlock) {
    console.log(`ℹ️ Nenhuma ocorrência exata ou semântica para "${query}" na Vault.`);
    return;
  }

  const combinedContext = [
    compactMatches ? `Trechos Exatos:\n${compactMatches}` : '',
    semanticBlock ? `Notas Semânticas (embeddinggemma-2):\n${semanticBlock}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const llm = await askLocalLLM(
    'Você é um indexador da Vault Pluri-Health. Resuma em até 4 bullets ultra-concisos: (1) Notas exatas [[Nome]] e linhas; (2) Regras de negócio ou capabilities citadas. Sem saudações.',
    `Busca: "${query}"\n${combinedContext}`,
    160
  );

  let outputText = '';
  if (llm) {
    const directSources = compactMatches
      ? compactMatches.split('\n').slice(0, 10).join('\n')
      : semanticBlock;
    outputText = `${llm.text}\n\n📍 Fontes diretas:\n${directSources}`;
    console.log(`🧠 [VAULT SÍNTESE via ${llm.provider}]\n${outputText}`);
  } else {
    outputText = combinedContext.split('\n').slice(0, 22).join('\n');
    console.log(`📍 [VAULT BUSCA DETERMINÍSTICA (${query})]\n${outputText}`);
  }

  try {
    fs.writeFileSync(
      cacheFile,
      JSON.stringify(
        {
          query,
          cachedAt: Date.now(),
          vaultMtime,
          provider: llm ? llm.provider : 'deterministico',
          content: outputText,
        },
        null,
        2
      ),
      'utf8'
    );
  } catch {}
}

// ============================================================================
// 2. SCHEMA INSPECT (Granular O(1) Lookup + Exact SQL Slice + Code Callsites)
// ============================================================================
async function handleSchema(rawArg) {
  const parts = (rawArg || '').split(/\s+/).filter(Boolean);
  const isExact = parts.includes('--exact');
  const target = parts.filter((p) => p !== '--exact').join(' ');

  const indexPath = path.join(ROOT, 'supabase/schema-index/00-INDEX.md');
  const symbolsPath = path.join(ROOT, '.cache/schema-symbols.json');
  if (!fs.existsSync(indexPath) || !fs.existsSync(symbolsPath)) {
    execFileSync('node', [path.join(ROOT, 'scripts/dev/index-schema.mjs')], { stdio: 'inherit' });
  }

  if (!target || target === '--list') {
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    console.log(indexContent.split('\n').slice(0, 42).join('\n'));
    return;
  }

  const symbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));
  const q = target.toLowerCase();

  const matchedTables = symbols.tables.filter((t) => t.name.toLowerCase().includes(q));
  const matchedFns = symbols.functions.filter((f) => f.name.toLowerCase().includes(q));
  const matchedPolicies = symbols.policies.filter(
    (p) => p.table.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
  );

  // Load code callsites if available
  let callsitesInfo = [];
  const rpcCallsitesPath = path.join(ROOT, '.cache/rpc-callsites.json');
  if (fs.existsSync(rpcCallsitesPath)) {
    try {
      const cs = JSON.parse(fs.readFileSync(rpcCallsitesPath, 'utf8'));
      for (const f of matchedFns.slice(0, 3)) {
        const sites = cs.rpcCallsites?.[f.name] || [];
        if (sites.length) {
          callsitesInfo.push(
            `🔗 Callsites TS (.rpc('${f.name}')): ${sites.slice(0, 5).map((s) => `${s.file}:${s.line}`).join(', ')}${sites.length > 5 ? ` (+${sites.length - 5})` : ''}`
          );
        }
      }
      for (const t of matchedTables.slice(0, 3)) {
        const sites = cs.tableCallsites?.[t.name] || [];
        if (sites.length) {
          callsitesInfo.push(
            `🔗 Callsites TS (.from('${t.name}')): ${sites.slice(0, 5).map((s) => `${s.file}:${s.line}`).join(', ')}${sites.length > 5 ? ` (+${sites.length - 5})` : ''}`
          );
        }
      }
    } catch {}
  }

  // Exact slice from supabase/schema.sql
  const exactTarget =
    symbols.tables.find((t) => t.name.toLowerCase() === q) ||
    symbols.functions.find((f) => f.name.toLowerCase() === q) ||
    matchedTables[0] ||
    matchedFns[0];

  let sqlSlice = '';
  if (exactTarget) {
    const schemaLines = fs.readFileSync(path.join(ROOT, 'supabase/schema.sql'), 'utf8').split('\n');
    sqlSlice = schemaLines.slice(exactTarget.startLine - 1, Math.min(exactTarget.endLine, exactTarget.startLine + 65)).join('\n');
  }

  console.log(`🗄️ [SCHEMA INSPECT: ${target}]`);
  for (const t of matchedTables.slice(0, 5)) {
    console.log(
      `• [TABLE] ${t.name} (${t.domain}, schema.sql L${t.startLine}-L${t.endLine}) | _cents: ${t.centsCols.join(', ') || 'nenhuma'} | deleted_at: ${t.hasDeletedAt ? 'SIM' : 'não'} | Colunas (${t.colCount}): ${t.cols.slice(0, 12).join(', ')}${t.cols.length > 12 ? '...' : ''}`
    );
  }
  for (const f of matchedFns.slice(0, 6)) {
    console.log(`• [RPC] ${f.name}(${f.args}) (${f.domain}, schema.sql L${f.startLine}-L${f.endLine})`);
  }
  for (const p of matchedPolicies.slice(0, 6)) {
    console.log(
      `• [RLS] "${p.name}" ON ${p.table} (L${p.startLine}-L${p.endLine}) | capabilities: ${p.capabilities.join(', ') || '—'}`
    );
  }
  if (callsitesInfo.length) {
    console.log(callsitesInfo.join('\n'));
  }

  if (isExact && sqlSlice) {
    console.log(`\n📄 [DEFINIÇÃO SQL EXATA L${exactTarget.startLine}-L${exactTarget.endLine}]\n${sqlSlice}`);
    return;
  }

  if (sqlSlice) {
    const llm = await askLocalLLM(
      'Resuma em até 3 bullets técnicos: (1) Linha exata no schema.sql; (2) Colunas principais (_cents e deleted_at) ou parâmetros da RPC; (3) Políticas RLS / capabilities.',
      `Alvo: ${target}\nSQL:\n${sqlSlice}`,
      140
    );
    if (llm) {
      console.log(`\n🧠 [SÍNTESE via ${llm.provider}]\n${llm.text}`);
    }
  }
}

// ============================================================================
// 3. CODE SCOUT
// ============================================================================
async function handleScout(target) {
  const fullPath = path.resolve(ROOT, target);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
    const outline = [];
    lines.forEach((line, idx) => {
      const ln = idx + 1;
      if (
        /^(export\s+|interface\s+|type\s+|function\s+|const\s+[A-Z0-9_]+\s*=|const\s+\[.*\]\s*=\s*useState|const\s+.*=\s*use[A-Z])/.test(
          line.trim()
        ) ||
        line.includes('can(') ||
        /<TabsTrigger|<DialogTitle|<DrawerTitle/.test(line)
      ) {
        outline.push(`L${ln}: ${line.trim().slice(0, 100)}`);
      }
    });

    console.log(`🧭 [CODE SCOUT MAP: ${target} (${lines.length} linhas)]`);
    console.log(outline.slice(0, 55).join('\n'));
    return;
  }

  const rgOut = runSearch(target, path.join(ROOT, 'src'), 5, 0);
  const compact = rgOut
    .split('\n')
    .map((l) => l.replace(ROOT + '/', ''))
    .filter(Boolean)
    .slice(0, 35)
    .join('\n');

  const llm = await askLocalLLM(
    'Indique em até 3 linhas diretas quais arquivos e números de linha (StartLine-EndLine) o desenvolvedor deve abrir com view_file para trabalhar no termo buscado.',
    `Termo: "${target}"\nOcorrências:\n${compact}`,
    120
  );

  console.log(`🧭 [CODE SCOUT BUSCA: "${target}"]`);
  if (llm) {
    console.log(`🧠 [SÍNTESE via ${llm.provider}] ${llm.text}\n`);
  }
  console.log(compact || 'Nenhuma ocorrência encontrada em src/.');
}

// ============================================================================
// 4. STRUCTURAL CODE & VAULT GRAPH (`npm run ai:graph`)
// ============================================================================
function ensureGraphsBuilt() {
  const codeGraphPath = path.join(ROOT, '.cache/graphify-out/graph.json');
  const vaultGraphPath = path.join(ROOT, '.cache/vault-graph.json');
  if (!fs.existsSync(codeGraphPath)) {
    execFileSync('node', [path.join(ROOT, 'scripts/dev/index-code-graph.mjs')], { stdio: 'inherit' });
  }
  if (!fs.existsSync(vaultGraphPath)) {
    execFileSync('node', [path.join(ROOT, 'scripts/dev/index-vault-graph.mjs')], { stdio: 'inherit' });
  }
}

function resolveGraphNode(graph, query) {
  if (!query) return null;
  const clean = query.replace(/^\.\//, '');
  if (graph.nodes[clean]) return graph.nodes[clean];

  // Look up by exported symbol
  if (graph.symbolIndex[clean]?.length) {
    const file = graph.symbolIndex[clean][0].file;
    if (graph.nodes[file]) return graph.nodes[file];
  }

  // Substring match on file path (prefer production files)
  const qLower = clean.toLowerCase();
  const candidates = Object.values(graph.nodes).filter((n) => n.id.toLowerCase().includes(qLower));
  candidates.sort((a, b) => Number(a.isTest) - Number(b.isTest) || b.inDegree - a.inDegree);
  return candidates[0] || null;
}

function findVaultNotesForNode(vaultBridge, node) {
  if (!vaultBridge || !node) return [];
  const hits = new Map();
  const base = path.basename(node.id);
  for (const key of [node.id, base]) {
    for (const item of vaultBridge.codeToNotes?.[key] || []) {
      hits.set(item.note, item);
    }
  }
  for (const cap of node.capabilities || []) {
    for (const item of vaultBridge.capToNotes?.[cap] || []) {
      hits.set(item.note, item);
    }
  }
  return [...hits.values()];
}

async function handleGraph(rawArgs) {
  ensureGraphsBuilt();
  const parts = (rawArgs || '').split(/\s+/).filter(Boolean);
  const subcmd = (parts[0] || 'gods').toLowerCase();
  const arg1 = parts[1] || '';
  const arg2 = parts[2] || '';

  const graph = JSON.parse(fs.readFileSync(path.join(ROOT, '.cache/graphify-out/graph.json'), 'utf8'));
  const vaultGraph = JSON.parse(fs.readFileSync(path.join(ROOT, '.cache/vault-graph.json'), 'utf8'));
  const vaultBridge = JSON.parse(fs.readFileSync(path.join(ROOT, '.cache/vault-code-bridge.json'), 'utf8'));

  if (subcmd === 'gods' || subcmd === 'report') {
    console.log(
      `🏛️ [CODE GRAPH GOD NODES] (${graph.stats.totalFiles} arquivos | ${graph.stats.totalEdges} arestas | ${graph.stats.uniqueRpcsCalled} RPCs | ${graph.stats.communitiesCount} comunidades)`
    );
    for (const g of graph.godNodes.slice(0, 12)) {
      console.log(
        `• ${g.id} [${g.community}] (${g.lines}L) — Dependentes Prod: ${g.prodImporters} (total ${g.totalImporters}) | Imports: ${g.outDegree} | RPCs: ${g.rpcsCount} | Tabelas: ${g.tablesCount}`
      );
    }
    return;
  }

  if (subcmd === 'communities') {
    console.log(`🧩 [COMUNIDADES ARQUITETURAIS (${Object.keys(graph.communities).length})]`);
    for (const [name, info] of Object.entries(graph.communities).slice(0, 18)) {
      console.log(`• ${name} (${info.count} arquivos): ${info.sampleFiles.slice(0, 3).join(', ')}`);
    }
    return;
  }

  if (subcmd === 'neighbors' || subcmd === 'node') {
    const node = resolveGraphNode(graph, arg1);
    if (!node) {
      console.log(`ℹ️ Nó não encontrado para "${arg1}".`);
      return;
    }
    const notes = findVaultNotesForNode(vaultBridge, node);
    console.log(`🕸️ [NEIGHBORS: ${node.id}] (${node.lines}L · comunidade: ${node.community})`);
    console.log(`• Exports (${node.exports.length}): ${node.exports.slice(0, 12).join(', ') || '—'}`);
    console.log(`• Imports (${node.imports.length}): ${node.imports.slice(0, 10).join(', ') || '—'}`);
    console.log(
      `• Importado por (${node.importers.length}): ${node.importers.slice(0, 10).join(', ') || '—'}${node.importers.length > 10 ? ` (+${node.importers.length - 10})` : ''}`
    );
    if (node.hooksUsed.length) console.log(`• Hooks usados: ${node.hooksUsed.join(', ')}`);
    if (node.rpcs.length) console.log(`• RPCs Supabase: ${node.rpcs.join(', ')}`);
    if (node.tables.length) console.log(`• Tabelas (.from): ${node.tables.join(', ')}`);
    if (node.capabilities.length) console.log(`• Capabilities RBAC: ${node.capabilities.join(', ')}`);
    if (notes.length) {
      console.log(`• Notas da Vault vinculadas: ${notes.slice(0, 6).map((n) => `[[${n.note}]]`).join(', ')}`);
    }
    return;
  }

  if (subcmd === 'impact') {
    const node = resolveGraphNode(graph, arg1);
    if (!node) {
      console.log(`ℹ️ Nó não encontrado para "${arg1}".`);
      return;
    }
    const directProd = node.importers.filter((f) => !graph.nodes[f]?.isTest);
    const directTests = node.importers.filter((f) => graph.nodes[f]?.isTest);
    const secondHop = new Set();
    for (const imp of directProd) {
      for (const imp2 of graph.nodes[imp]?.importers || []) {
        if (imp2 !== node.id && !directProd.includes(imp2)) {
          secondHop.add(imp2);
        }
      }
    }
    const notes = findVaultNotesForNode(vaultBridge, node);

    console.log(`💥 [IMPACTO / BLAST RADIUS: ${node.id}] (comunidade: ${node.community})`);
    console.log(
      `• Dependentes Diretos Produção (${directProd.length}): ${directProd.slice(0, 10).join(', ') || 'nenhum'}${directProd.length > 10 ? ` (+${directProd.length - 10})` : ''}`
    );
    console.log(
      `• Impacto Transitivo 2º Grau (${secondHop.size}): ${[...secondHop].slice(0, 8).join(', ') || 'nenhum'}${secondHop.size > 8 ? ` (+${secondHop.size - 8})` : ''}`
    );
    console.log(
      `• Testes Automatizados Diretos (${directTests.length}): ${directTests.slice(0, 6).join(', ') || 'nenhum'}`
    );
    if (node.rpcs.length || node.tables.length) {
      console.log(`• Superfície Supabase: RPCs=[${node.rpcs.join(', ')}] | Tabelas=[${node.tables.join(', ')}]`);
    }
    if (notes.length) {
      console.log(`• Regras na Vault: ${notes.slice(0, 6).map((n) => `[[${n.note}]]`).join(', ')}`);
    }
    return;
  }

  if (subcmd === 'path') {
    const start = resolveGraphNode(graph, arg1);
    const end = resolveGraphNode(graph, arg2);
    if (!start || !end) {
      console.log(`ℹ️ Informe dois nós válidos. Ex: npm run ai:graph -- path PacienteDetalhe useAuth`);
      return;
    }
    // BFS over undirected dependency edges keeping direction labels
    const queue = [[start.id]];
    const visited = new Set([start.id]);
    let foundPath = null;

    while (queue.length > 0) {
      const currPath = queue.shift();
      const curr = currPath[currPath.length - 1];
      if (curr === end.id) {
        foundPath = currPath;
        break;
      }
      if (currPath.length >= 7) continue;
      const n = graph.nodes[curr];
      if (!n) continue;
      const neighbors = [...n.imports, ...n.importers];
      for (const nb of neighbors) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push([...currPath, nb]);
        }
      }
    }

    if (!foundPath) {
      console.log(`ℹ️ Nenhum caminho encontrado entre ${start.id} e ${end.id} (até 6 saltos).`);
      return;
    }
    const formatted = foundPath
      .map((nodeId, idx) => {
        if (idx === 0) return nodeId;
        const prev = graph.nodes[foundPath[idx - 1]];
        const arrow = prev.imports.includes(nodeId) ? '──imports──>' : '<──imported-by──';
        return `${arrow} ${nodeId}`;
      })
      .join(' ');
    console.log(`🧭 [SHORTEST PATH (${foundPath.length - 1} saltos)]\n${formatted}`);
    return;
  }

  if (subcmd === 'rpc') {
    const q = arg1.toLowerCase();
    const matches = Object.entries(graph.rpcCallsites).filter(([k]) => k.toLowerCase().includes(q));
    console.log(`⚡ [RPC GRAPH BRIDGE: "${arg1}"]`);
    for (const [rpcName, sites] of matches.slice(0, 8)) {
      console.log(
        `• .rpc('${rpcName}') (${sites.length} callsites): ${sites.slice(0, 8).map((s) => `${s.file}:${s.line}`).join(', ')}`
      );
    }
    await handleSchema(arg1);
    return;
  }

  if (subcmd === 'table') {
    const q = arg1.toLowerCase();
    const matches = Object.entries(graph.tableCallsites).filter(([k]) => k.toLowerCase().includes(q));
    console.log(`🗄️ [TABLE GRAPH BRIDGE: "${arg1}"]`);
    for (const [tblName, sites] of matches.slice(0, 8)) {
      console.log(
        `• .from('${tblName}') (${sites.length} callsites): ${sites.slice(0, 8).map((s) => `${s.file}:${s.line}`).join(', ')}`
      );
    }
    await handleSchema(arg1);
    return;
  }

  if (subcmd === 'capability' || subcmd === 'cap') {
    const q = arg1.toLowerCase();
    const matches = Object.entries(graph.capabilityCallsites).filter(([k]) => k.toLowerCase().includes(q));
    console.log(`🛡️ [RBAC CAPABILITY GRAPH: "${arg1}"]`);
    for (const [cap, sites] of matches.slice(0, 10)) {
      const notes = vaultBridge.capToNotes?.[cap] || [];
      console.log(
        `• can('${cap}') (${sites.length} usos): ${sites.slice(0, 6).map((s) => `${s.file}:${s.line}`).join(', ')}${notes.length ? ` | Vault: ${notes.map((n) => `[[${n.note}]]`).join(', ')}` : ''}`
      );
    }
    return;
  }

  if (subcmd === 'vault') {
    const q = parts.slice(1).join(' ').toLowerCase();
    if (!q) {
      console.log(`📚 [VAULT GRAPH HUBS (${vaultGraph.stats.totalNotes} notas, ${vaultGraph.stats.totalWikiEdges} wikilinks)]`);
      for (const h of vaultGraph.hubNotes.slice(0, 12)) {
        console.log(`• [[${h.title}]] (${h.relPath}) — Backlinks: ${h.inDegree} | OutLinks: ${h.outDegree} | CodeRefs: ${h.codeRefsCount}`);
      }
      return;
    }
    const matchedNotes = Object.values(vaultGraph.notes)
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.aliases.some((a) => a.toLowerCase().includes(q)) ||
          n.codeRefs.some((c) => c.toLowerCase().includes(q))
      )
      .slice(0, 6);

    console.log(`📚 [VAULT SUBGRAPH: "${parts.slice(1).join(' ')}"]`);
    for (const n of matchedNotes) {
      console.log(`• [[${n.title}]] (${n.relPath}, ${n.lines}L)`);
      if (n.outLinks.length) console.log(`  ↳ Links para: ${n.outLinks.slice(0, 8).map((l) => `[[${l}]]`).join(', ')}`);
      if (n.backlinks.length) console.log(`  ↰ Citada por: ${n.backlinks.slice(0, 8).map((l) => `[[${l}]]`).join(', ')}`);
      if (n.codeRefs.length) console.log(`  💻 Código ancorado: ${n.codeRefs.slice(0, 8).join(', ')}`);
    }
    return;
  }

  console.log('Subcomandos ai:graph: gods | communities | neighbors <alvo> | impact <alvo> | path <A> <B> | rpc <nome> | table <nome> | capability <cap> | vault [termo]');
}

// ============================================================================
// 5. HEALTH CHECK (`npm run ai:health`) — Verifica Ollama + OpenCode Free + Índices
// ============================================================================
async function handleHealth() {
  console.log('🩺 [AI LOCAL ENGINE HEALTH CHECK]');

  // 1. Check Ollama models & generation with think:false
  const ollamaModel = await resolveOllamaModel();
  if (ollamaModel) {
    const t0 = Date.now();
    try {
      const res = await httpRequestJson(
        OLLAMA_HOST,
        OLLAMA_PORT,
        '/api/generate',
        'POST',
        {
          model: ollamaModel,
          prompt: 'Responda apenas: OK_OLLAMA',
          think: false,
          stream: false,
          keep_alive: '5m',
          options: { temperature: 0, num_predict: 15 },
        },
        15000
      );
      console.log(
        `✅ Ollama LLM (${ollamaModel}): ${(res?.response || '').trim()} (${Date.now() - t0}ms, modelos locais: ${cachedOllamaModels.join(', ')})`
      );
    } catch (e) {
      console.log(`❌ Ollama LLM falhou: ${e.message}`);
    }
  } else {
    console.log('⚠️ Ollama offline ou sem modelos em 127.0.0.1:11434');
  }

  // 2. Check Ollama Embeddings (`embeddinggemma-2:latest`)
  const tEmb = Date.now();
  const vec = await embedQueryLocal('verificacao de saude rbac');
  if (vec && vec.length) {
    console.log(`✅ Ollama Embeddings (${OLLAMA_EMBED_MODEL}): vetor ${vec.length}d gerado em ${Date.now() - tEmb}ms`);
  } else {
    console.log(`⚠️ Ollama Embeddings (${OLLAMA_EMBED_MODEL}) indisponível`);
  }

  // 3. Check OpenCode Free Cascade
  const tOc = Date.now();
  const ocRes = await askOpenCodeFree('Responda apenas com a palavra OK_OPENCODE.', 'Teste de conectividade');
  if (ocRes) {
    console.log(`✅ OpenCode Free Agent (${ocRes.provider}): ${ocRes.text.slice(0, 40)} (${Date.now() - tOc}ms)`);
  } else {
    console.log(`⚠️ OpenCode Free Cascade indisponível (binário: ${OPENCODE_BIN})`);
  }

  // 4. Check Indexes
  const indexes = [
    ['Code Graph AST', '.cache/graphify-out/graph.json'],
    ['Vault Graph Bridge', '.cache/vault-graph.json'],
    ['Vault Embeddings', '.cache/vault-embeddings.json'],
    ['Schema Symbols', '.cache/schema-symbols.json'],
  ];
  for (const [label, rel] of indexes) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) {
      const kb = (fs.statSync(p).size / 1024).toFixed(1);
      console.log(`✅ Índice ${label}: ${rel} (${kb} KB)`);
    } else {
      console.log(`⚠️ Índice ${label} ausente (${rel}) — rode npm run ai:reindex`);
    }
  }
}

// ============================================================================
// 6. TEST FOCUSED
// ============================================================================
async function handleTest(testTarget) {
  const args = ['vitest', 'run', '--reporter=default'];
  if (testTarget) args.push(testTarget);

  const res = spawnSync('npx', args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true', NO_COLOR: '1' },
  });

  const combined = `${res.stdout || ''}\n${res.stderr || ''}`;
  if (res.status === 0) {
    const summary = combined
      .split('\n')
      .filter((l) => /Test Files|Tests|Duration/.test(l))
      .join(' | ');
    console.log(`✅ [TEST PASS] ${summary || 'Todos os testes passaram.'}`);
    return;
  }

  const filteredLines = [];
  let inDomDump = false;
  for (const line of combined.split('\n')) {
    if (line.includes('Ignored nodes: comments, script, style')) {
      inDomDump = true;
      filteredLines.push('  [...DOM HTML omitido para economia de tokens...]');
      continue;
    }
    if (inDomDump) {
      if (line.trim().startsWith('❯ ') || line.trim().startsWith('⎯')) {
        inDomDump = false;
      } else {
        continue;
      }
    }
    filteredLines.push(line);
  }

  const cleanErr = filteredLines.slice(-45).join('\n');
  const llm = await askLocalLLM(
    'Analise a falha do teste Vitest e resuma em 2 frases: (1) Qual teste e linha falhou; (2) Qual valor esperado vs recebido e como corrigir.',
    cleanErr,
    140
  );

  console.log(`❌ [TEST FAIL: ${testTarget || 'suite'}]`);
  if (llm) {
    console.log(`🧠 [DIAGNÓSTICO via ${llm.provider}]\n${llm.text}\n`);
  }
  console.log(cleanErr);
  process.exit(1);
}

// ============================================================================
// 7. GIT DIFF EXPLAIN
// ============================================================================
async function handleDiff(diffText) {
  const text = (diffText || '').trim();
  if (!text) {
    console.log('ℹ️ Nenhuma alteração detectada no diff.');
    return;
  }

  const compactDiff = text.slice(0, 8000);
  const llm = await askLocalLLM(
    'Você é um engenheiro de software sênior. Resuma o git diff/status fornecido em exatamente 3 bullets curtos e técnicos em português, destacando arquivos e propósito da mudança. Sem saudações ou preâmbulos.',
    compactDiff,
    160
  );

  console.log('\n📝 [RESUMO DO DIFF (3 BULLETS)]');
  if (llm) {
    console.log(`🧠 [via ${llm.provider}]\n${llm.text}`);
  } else {
    const files = [...new Set([...compactDiff.matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1]))];
    if (files.length > 0) {
      console.log(
        `• Arquivos modificados: ${files.slice(0, 4).join(', ')}${files.length > 4 ? ` (+${files.length - 4} outros)` : ''}`
      );
      const stats = compactDiff
        .split('\n')
        .filter((l) => l.startsWith('@@'))
        .slice(0, 2)
        .map((l) => l.trim());
      console.log(`• Trechos alterados: ${stats.join(' | ') || 'Ajustes no código'}`);
      console.log('• Nota: Resumo estrutural determinístico gerado.');
    } else {
      compactDiff
        .split('\n')
        .slice(0, 3)
        .forEach((l) => console.log(`• ${l}`));
    }
  }
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
      if (data.length > 30000) {
        process.stdin.pause();
        resolve(data);
      }
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
    setTimeout(() => resolve(data), 800);
  });
}

async function runCli() {
  const [, , mode, ...rest] = process.argv;
  let arg = rest.join(' ').trim();

  if (mode === 'vault') await handleVault(arg);
  else if (mode === 'schema') await handleSchema(arg);
  else if (mode === 'scout') await handleScout(arg);
  else if (mode === 'graph') await handleGraph(arg);
  else if (mode === 'health') await handleHealth();
  else if (mode === 'test') await handleTest(arg);
  else if (mode === 'diff' || mode === 'explain') {
    if (!arg) arg = await readStdin();
    await handleDiff(arg);
  } else {
    console.log(
      'Uso: node scripts/dev/ai-local-engine.mjs <vault|schema|scout|graph|health|test|diff> [argumento]'
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
