#!/usr/bin/env node
import { execFile } from 'child_process';
import http from 'http';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.OPENCODE_PROXY_PORT || 4096);
const HOST = process.env.OPENCODE_PROXY_HOST || '127.0.0.1';
const OPENCODE_CLI = process.env.OPENCODE_CLI || `${process.env.HOME || ''}/.opencode/bin/opencode`;

const FREE_MODELS = [
  'opencode/mimo-v2.6-flash-free',
  'opencode/deepseek-v4.1-flash-free',
  'opencode/nemotron-3.5-lightning-free',
  'opencode/big-pickle',
];

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function formatMessages(messages = []) {
  return messages
    .map((m) => `${String(m.role || 'user').toUpperCase()}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
    .join('\n\n');
}

async function runOpenCodeCascade(preferredModel, prompt) {
  const candidates = preferredModel && preferredModel.startsWith('opencode/')
    ? [preferredModel, ...FREE_MODELS.filter((m) => m !== preferredModel)]
    : FREE_MODELS;

  let lastErr = null;
  for (const model of candidates) {
    try {
      const { stdout } = await execFileAsync(OPENCODE_CLI, ['run', '-m', model, prompt], {
        timeout: 45000,
        maxBuffer: 2 * 1024 * 1024,
      });
      const text = stdout?.trim();
      if (text) return { model, text };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Nenhum modelo OpenCode Free respondeu.');
}

const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ object: 'list', data: FREE_MODELS.map((id) => ({ id, object: 'model' })) }));
  }

  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', async () => {
      try {
        const body = JSON.parse(raw || '{}');
        const prompt = formatMessages(body.messages || []);
        const { model, text } = await runOpenCodeCascade(body.model, prompt);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: `oc-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
          })
        );
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err?.message || 'OpenCode CLI error' } }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 OpenCode Free Proxy ativo em http://${HOST}:${PORT}/v1 (modelos: ${FREE_MODELS.join(', ')})`);
});
