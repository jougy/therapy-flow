#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
  // ignore
}

const cwd = input.cwd || process.cwd();
let branch = 'unknown';
let dirtyCount = 0;
try {
  branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const status = execSync('git status -s', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  dirtyCount = status ? status.split('\n').length : 0;
} catch {
  // ignore
}

let activeTasks = [];
try {
  const kanban = fs.readFileSync(path.join(cwd, 'core/Pluri-Health/00 - Navegacao/Kanban de Tarefas.md'), 'utf8');
  const match = kanban.match(/## Executando agora([\s\S]*?)## Finalizados/);
  if (match) {
    activeTasks = match[1]
      .split('\n')
      .filter((l) => l.trim().startsWith('- [ ]'))
      .map((l) => l.replace(/^- \[ \]\s*/, '').replace(/\*\*/g, '').split('#')[0].trim())
      .slice(0, 3);
  }
} catch {
  // ignore
}

const hasGraph = fs.existsSync(path.join(cwd, '.cache/graphify-out/graph.json'));
const hasAppMap = fs.existsSync(path.join(cwd, '.cache/app-map.json'));

const msg = [
  `[Bootstrap] Branch: ${branch} (${dirtyCount} alterações) | Índices: graph=${hasGraph ? 'ok' : 'missing'}, app-map=${hasAppMap ? 'ok' : 'missing'}`,
  activeTasks.length ? `Kanban ativo: ${activeTasks.join(' | ')}` : 'Kanban ativo: nenhum',
  'Dica: use `npm run ai:brief "<tarefa>"` para dossiê <400 tokens em 1 chamada.'
].join('\n');

console.log(JSON.stringify({
  injectSteps: [
    {
      systemMessage: {
        systemMessage: msg
      }
    }
  ]
}));
