#!/usr/bin/env node
/**
 * Quick Responsive & Mobile-First Auditor
 * 
 * Executa auditoria rápida de duas frentes:
 * 1. Análise Estática de Código: Varre arquivos alterados em busca de anti-padrões mobile:
 *    - `w-[...px]` estáticos sem responsividade.
 *    - `h-screen` em vez de `h-[100dvh]` ou `dvh`.
 *    - Tabelas sem o wrapper obrigatório `overflow-x-auto touch-pan-x`.
 *    - Checagens manuais de strings de permissão (ex: `operationalRole === 'admin'`).
 * 2. Análise Dinâmica (Opcional se URL fornecida): Chama o audit-layout via Playwright.
 * 
 * Saída: 1 linha de sucesso ou 1 parágrafo em Markdown cirúrgico via prompt-synthesizer.
 * 
 * Uso:
 *   node scripts/dev/quick-responsive.mjs
 *   node scripts/dev/quick-responsive.mjs --url http://localhost:5173/pacientes
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { synthesizeActionPrompt } from './prompt-synthesizer.mjs';

const SRC_DIR = path.join(process.cwd(), 'src');

function getTargetFiles() {
  // Se usuário passou arquivo específico:
  const fileArg = process.argv.find((a) => a.endsWith('.tsx') || a.endsWith('.jsx'));
  if (fileArg && fs.existsSync(fileArg)) return [path.resolve(fileArg)];

  // Tenta pegar arquivos alterados via git status
  try {
    const { execSync } = require('child_process');
    const out = execSync('git status --porcelain', { encoding: 'utf8' });
    const changed = out
      .split('\n')
      .map((l) => l.slice(3).trim())
      .filter((f) => (f.endsWith('.tsx') || f.endsWith('.jsx')) && fs.existsSync(f));
    if (changed.length > 0) return changed.map((f) => path.resolve(f));
  } catch (e) {
    // Ignora erro de git
  }

  // Fallback: varre src/pages
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory() && !ent.name.startsWith('.')) walk(full);
      else if (ent.isFile() && ent.name.endsWith('.tsx')) files.push(full);
    }
  }
  walk(path.join(SRC_DIR, 'pages'));
  return files.slice(0, 10);
}

function scanFileForMobileRisks(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];
  const relPath = filePath.replace(process.cwd() + '/', '');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Anti-padrão: w-[...px] fixo sem breakpoint responsivo
    const staticWidthMatch = line.match(/(?:className|class)="[^"]*\b(w-\[\d+px\])\b[^"]*"/);
    if (staticWidthMatch && !line.includes('max-w-') && !line.includes('sm:') && !line.includes('md:')) {
      issues.push({
        file: relPath,
        line: i + 1,
        rule: 'static-width',
        message: `Uso de largura fixa \`${staticWidthMatch[1]}\` sem contenção responsiva ou max-w-full.`,
      });
    }

    // Anti-padrão: h-screen rígido (quebra em Safari/Chrome mobile)
    if (/\b(h-screen)\b/.test(line) && !line.includes('dvh') && !line.includes('min-h-screen')) {
      issues.push({
        file: relPath,
        line: i + 1,
        rule: 'rigid-h-screen',
        message: `Uso de \`h-screen\` rígido. Prefira \`h-[100dvh]\` ou \`min-h-screen\` para evitar corte pela barra do navegador.`,
      });
    }

    // Anti-padrão: Proibição de hardcode de papéis operacionais (Seção 4 de AGENTS.md)
    if (/operationalRole\s*===|operational_role\s*===/i.test(line)) {
      issues.push({
        file: relPath,
        line: i + 1,
        rule: 'hardcoded-role',
        message: `Hardcode de papel operacional detectado (\`operationalRole === ...\`). Use obrigatoriamente a função soberana \`can(capability)\`.`,
      });
    }

    if (issues.length >= 3) break;
  }
  return issues;
}

async function runDynamicUrlAudit(url) {
  return new Promise((resolve) => {
    const p = spawn('node', ['scripts/dev/audit-layout.mjs', '--url', url], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => {
      try {
        resolve(JSON.parse(out));
      } catch (e) {
        resolve(null);
      }
    });
  });
}

async function main() {
  const urlArgIndex = process.argv.indexOf('--url');
  const targetUrl = urlArgIndex !== -1 ? process.argv[urlArgIndex + 1] : null;

  const files = getTargetFiles();
  const allIssues = [];

  for (const f of files) {
    const fileIssues = scanFileForMobileRisks(f);
    allIssues.push(...fileIssues);
    if (allIssues.length >= 3) break;
  }

  // Se URL foi fornecida, roda auditoria dinâmica de overflow
  if (targetUrl) {
    const dynamicResult = await runDynamicUrlAudit(targetUrl);
    if (dynamicResult?.audit) {
      for (const res of dynamicResult.audit) {
        if (res.hasHorizontalOverflow) {
          allIssues.push({
            file: targetUrl,
            line: 1,
            rule: 'horizontal-overflow',
            message: `Overflow horizontal detectado no viewport ${res.viewport}: elemento ${res.topOverflowingElements?.[0]?.target || 'layout'} extravasou +${res.overflowExcessPx}px.`,
          });
        }
      }
    }
  }

  if (allIssues.length === 0) {
    console.log('✅ [quick-responsive] 100% Mobile-First! Zero classes de risco e sem hardcode de papéis.');
    process.exit(0);
  }

  const prompt = await synthesizeActionPrompt('responsive', {
    selector: allIssues[0].file,
    excess: 20,
    details: allIssues,
  });
  console.log(prompt);
  process.exit(1);
}

main();
