#!/usr/bin/env node
/**
 * AI Local Engine (Ollama gemma4:cloud + OpenCode mimo + Deterministic Fallback)
 *
 * Motor unificado para buscas e resumos locais com custo ZERO de tokens na nuvem principal.
 * Modos suportados via CLI:
 *   node scripts/dev/ai-local-engine.mjs vault "<query>"
 *   node scripts/dev/ai-local-engine.mjs schema "<table_or_rpc>"
 *   node scripts/dev/ai-local-engine.mjs scout "<file_or_term>"
 *   node scripts/dev/ai-local-engine.mjs test "<vitest_target>"
 *   node scripts/dev/ai-local-engine.mjs diff [diff_or_stdin]
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync, spawnSync } from 'child_process';

const ROOT = process.cwd();
const OLLAMA_HOST = process.env.OLLAMA_HOST || '127.0.0.1';
const OLLAMA_PORT = Number(process.env.OLLAMA_PORT || 11434);
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:cloud';

const OPENCODE_HOST = process.env.OPENCODE_HOST || '127.0.0.1';
const OPENCODE_PORT = Number(process.env.OPENCODE_PORT || 3000);
const OPENCODE_MODEL = process.env.OPENCODE_MODEL || 'mimo';

function postJson(host, port, reqPath, payload, timeoutMs = 4500) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: host,
        port,
        path: reqPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
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
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.write(data);
    req.end();
  });
}

export async function askLocalLLM(systemPrompt, userContent, maxTokens = 160) {
  // 1. Try Ollama (gemma4:cloud)
  try {
    const res = await postJson(OLLAMA_HOST, OLLAMA_PORT, '/api/generate', {
      model: OLLAMA_MODEL,
      system: systemPrompt,
      prompt: userContent.slice(0, 6000),
      stream: false,
      options: { temperature: 0.1, num_predict: maxTokens },
    });
    if (res?.response?.trim()) {
      return { provider: `ollama:${OLLAMA_MODEL}`, text: res.response.trim() };
    }
  } catch {
    // Fallback to OpenCode
  }

  // 2. Try OpenCode (mimo)
  try {
    const res = await postJson(OPENCODE_HOST, OPENCODE_PORT, '/v1/chat/completions', {
      model: OPENCODE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent.slice(0, 6000) },
      ],
      max_tokens: maxTokens,
      temperature: 0.1,
    });
    const text = res?.choices?.[0]?.message?.content?.trim();
    if (text) {
      return { provider: `opencode:${OPENCODE_MODEL}`, text };
    }
  } catch {
    // Fallback deterministic
  }

  return null;
}

function getVaultMaxMtime(vaultDir) {
  let max = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name.startsWith('.')) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.isFile()) {
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
    const args = ['-i', '-n'];
    if (contextLines > 0) args.push('-C', String(contextLines));
    args.push('--max-count', String(maxCount), query, targetDir);
    return execFileSync('rg', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  } catch (e) {
    if (e.stdout) return e.stdout;
    try {
      const args = ['-r', '-i', '-n'];
      if (contextLines > 0) args.push('-C', String(contextLines));
      args.push('-m', String(maxCount), query, targetDir);
      return execFileSync('grep', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    } catch (ge) {
      return ge.stdout || '';
    }
  }
}

// ============================================================================
// 1. VAULT QUERY
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

  // Cache Local Semântico com Invalidação por mtime
  const cacheDir = path.join(ROOT, '.cache/vault-queries');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const queryHash = crypto.createHash('sha256').update(query.trim().toLowerCase()).digest('hex');
  const cacheFile = path.join(cacheDir, `${queryHash}.json`);
  const vaultMtime = getVaultMaxMtime(vaultDir);

  if (fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cached && typeof cached.cachedAt === 'number' && cached.cachedAt >= vaultMtime) {
        console.log(`⚡ [VAULT SÍNTESE (CACHE HIT)]\n${cached.content}`);
        return;
      }
    } catch {}
  }

  const rgOut = runSearch(query, vaultDir, 6, 2);

  if (!rgOut.trim()) {
    console.log(`ℹ️ Nenhuma ocorrência exata para "${query}" na Vault.`);
    return;
  }

  const compactMatches = rgOut
    .split('\n')
    .map((l) => l.replace(vaultDir + '/', ''))
    .slice(0, 45)
    .join('\n');

  const llm = await askLocalLLM(
    'Você é um indexador da Vault Pluri-Health. Resuma em até 4 bullets ultra-concisos: (1) Notas exatas [[Nome]] e linhas; (2) Regras de negócio ou capabilities citadas. Sem saudações.',
    `Busca: "${query}"\nTrechos:\n${compactMatches}`,
    150
  );

  let outputText = '';
  if (llm) {
    outputText = `${llm.text}\n\n📍 Fontes diretas:\n${compactMatches.split('\n').slice(0, 12).join('\n')}`;
    console.log(`🧠 [VAULT SÍNTESE via ${llm.provider}]\n${outputText}`);
  } else {
    outputText = compactMatches.split('\n').slice(0, 25).join('\n');
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
// 2. SCHEMA INSPECT
// ============================================================================
async function handleSchema(target) {
  const indexPath = path.join(ROOT, 'supabase/schema-index/00-INDEX.md');
  if (!fs.existsSync(indexPath)) {
    execFileSync('node', [path.join(ROOT, 'scripts/dev/index-schema.mjs')], { stdio: 'inherit' });
  }

  const indexContent = fs.readFileSync(indexPath, 'utf8');
  if (!target || target === '--list') {
    console.log(indexContent.split('\n').slice(0, 40).join('\n'));
    return;
  }

  const matchingIndexLines = indexContent
    .split('\n')
    .filter((l) => l.toLowerCase().includes(target.toLowerCase()))
    .slice(0, 20);

  // Also search inside domain files for exact columns/policies
  const domainsDir = path.join(ROOT, 'supabase/schema-index/domains');
  let sqlSnippet = '';
  try {
    sqlSnippet = runSearch(`(TABLE|FUNCTION|POLICY|VIEW).*${target}`, domainsDir, 18, 0);
  } catch (e) {
    sqlSnippet = e.stdout || '';
  }

  const cleanSnippet = sqlSnippet
    .split('\n')
    .map((l) => l.replace(domainsDir + '/', ''))
    .slice(0, 40)
    .join('\n');

  const llm = await askLocalLLM(
    'Resuma em até 4 linhas técnicas: (1) Linha exata no schema.sql; (2) Colunas principais, destacando _cents e deleted_at; (3) Políticas RLS / capabilities ou parâmetros da RPC.',
    `Alvo: ${target}\nÍndice:\n${matchingIndexLines.join('\n')}\nSQL:\n${cleanSnippet}`,
    140
  );

  console.log(`🗄️ [SCHEMA INSPECT: ${target}]`);
  if (matchingIndexLines.length) {
    console.log(matchingIndexLines.join('\n'));
  }
  if (llm) {
    console.log(`\n🧠 [SÍNTESE via ${llm.provider}]\n${llm.text}`);
  } else if (cleanSnippet) {
    console.log(`\n📄 [DEFINIÇÃO COMPACTA]\n${cleanSnippet}`);
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

    const compactOutline = outline.slice(0, 55).join('\n');
    console.log(`🧭 [CODE SCOUT MAP: ${target} (${lines.length} linhas)]`);
    console.log(compactOutline);
    return;
  }

  // Otherwise search term across src/
  let rgOut = '';
  try {
    rgOut = runSearch(target, path.join(ROOT, 'src'), 5, 0);
  } catch (e) {
    rgOut = e.stdout || '';
  }

  const compact = rgOut
    .split('\n')
    .map((l) => l.replace(ROOT + '/', ''))
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
// 4. TEST FOCUSED
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

  // Strip massive HTML DOM dumps from Testing Library
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
// 5. GIT DIFF EXPLAIN
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
      console.log(`• Arquivos modificados: ${files.slice(0, 4).join(', ')}${files.length > 4 ? ` (+${files.length - 4} outros)` : ''}`);
      const stats = compactDiff.split('\n').filter((l) => l.startsWith('@@')).slice(0, 2).map((l) => l.trim());
      console.log(`• Trechos alterados: ${stats.join(' | ') || 'Ajustes no código'}`);
      console.log('• Nota: Resumo estrutural determinístico gerado.');
    } else {
      const lines = compactDiff.split('\n').slice(0, 3);
      lines.forEach((l) => console.log(`• ${l}`));
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

// CLI Router
async function runCli() {
  const [, , mode, ...rest] = process.argv;
  let arg = rest.join(' ').trim();

  if (mode === 'vault') await handleVault(arg);
  else if (mode === 'schema') await handleSchema(arg);
  else if (mode === 'scout') await handleScout(arg);
  else if (mode === 'test') await handleTest(arg);
  else if (mode === 'diff' || mode === 'explain') {
    if (!arg) {
      arg = await readStdin();
    }
    await handleDiff(arg);
  } else {
    console.log('Uso: node scripts/dev/ai-local-engine.mjs <vault|schema|scout|test|diff> [argumento]');
  }
}

runCli();
