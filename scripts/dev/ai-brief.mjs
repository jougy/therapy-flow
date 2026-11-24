#!/usr/bin/env node
import { execFile } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const query = process.argv.slice(2).join(' ').trim();

if (!query) {
  console.log('Uso: npm run ai:brief "<descrição da tarefa>"');
  process.exit(1);
}

async function runCmd(cmd, args) {
  try {
    const { stdout } = await execFileAsync(cmd, args, { cwd: ROOT, timeout: 8000, maxBuffer: 512 * 1024 });
    return stdout.trim();
  } catch {
    return '';
  }
}

function searchAppMap(q) {
  const p = path.join(ROOT, '.cache/app-map.json');
  if (!fs.existsSync(p)) return '';
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const terms = q.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const hits = (data.routes || [])
    .filter((r) => terms.some((t) => `${r.route} ${r.component} ${r.file || ''}`.toLowerCase().includes(t)))
    .slice(0, 4);
  return hits.map((r) => `${r.route} -> ${r.file || r.component} (caps:${r.capabilities.length} rpcs:${r.rpcs.length})`).join('\n');
}

async function synthesizeWithOllama(rawContext) {
  const payload = JSON.stringify({
    model: 'mimo-v2.6:latest',
    stream: false,
    think: false,
    keep_alive: '5m',
    options: { temperature: 0.1, num_predict: 320 },
    prompt: `Você é um Tech Lead do Pluri-Health. Resuma o contexto abaixo em um dossiê ultra-compacto (máximo 12 linhas, Markdown) para iniciar a tarefa "${query}":\n- Arquivos/rotas principais\n- Tabelas/RPCs/Capabilities envolvidas\n- Notas da Vault relevantes\n\nContexto:\n${rawContext.slice(0, 4500)}`,
  });

  return new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port: 11434, path: '/api/generate', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }, timeout: 15000 },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.response?.trim() || '');
          } catch {
            resolve('');
          }
        });
      }
    );
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  const firstWord = query.split(/\s+/).find((w) => w.length > 3) || query;
  const [vaultOut, schemaOut, appOut] = await Promise.all([
    runCmd('sh', ['scripts/dev/vault-query.sh', query]),
    runCmd('sh', ['scripts/dev/schema-inspect.sh', firstWord]),
    Promise.resolve(searchAppMap(query)),
  ]);

  const raw = [
    appOut ? `## Rotas:\n${appOut}` : '',
    vaultOut ? `## Vault:\n${vaultOut.slice(0, 1500)}` : '',
    schemaOut ? `## Schema:\n${schemaOut.slice(0, 1500)}` : '',
  ].filter(Boolean).join('\n\n');

  const brief = await synthesizeWithOllama(raw);
  console.log(brief || raw.slice(0, 1200) || 'Nenhum contexto encontrado.');
}

main();
