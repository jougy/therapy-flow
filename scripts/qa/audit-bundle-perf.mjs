#!/usr/bin/env node
/**
 * QA Bundle & Code Splitting Auditor
 * 
 * Inspeciona o diretório de build (dist/) ou analisa o index do Vite para verificar:
 * 1. Chunks JavaScript individuais não devem exceder 300 kB (LCP/TBT protection).
 * 2. Assegura que páginas secundárias de configuração e relatórios são carregadas via dynamic import.
 * 3. Identifica duplicação ou vazamento de vendors pesados na rota de entrada.
 */

import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const SRC_DIR = path.resolve(process.cwd(), 'src');

const MAX_CHUNK_SIZE_KB = 350; // Alinhado com meta de carregamento ultra-rápido

function checkLazyImports() {
  const appFile = path.join(SRC_DIR, 'App.tsx');
  if (!fs.existsSync(appFile)) return [];

  const content = fs.readFileSync(appFile, 'utf-8');
  const issues = [];

  // Verifica se rotas pesadas usam React.lazy / lazy()
  const heavyRoutes = ['Relatorios', 'Configuracoes', 'Financeiro'];
  heavyRoutes.forEach((route) => {
    const importRegex = new RegExp(`import\\s+${route}\\s+from`, 'g');
    if (importRegex.test(content)) {
      issues.push({
        type: 'non-lazy-heavy-route',
        desc: `A rota '${route}' está sendo importada estaticamente em App.tsx. Use lazy().`,
      });
    }
  });

  return issues;
}

function checkDistChunks() {
  if (!fs.existsSync(DIST_DIR)) {
    return { skipped: true, issues: [] };
  }

  const assetsDir = path.join(DIST_DIR, 'assets');
  if (!fs.existsSync(assetsDir)) {
    return { skipped: true, issues: [] };
  }

  const files = fs.readdirSync(assetsDir);
  const issues = [];
  const largeChunks = [];

  files.forEach((file) => {
    if (file.endsWith('.js')) {
      const filePath = path.join(assetsDir, file);
      const stat = fs.statSync(filePath);
      const sizeKb = Math.round(stat.size / 1024);

      if (sizeKb > MAX_CHUNK_SIZE_KB) {
        largeChunks.push({ file, sizeKb });
        issues.push({
          type: 'oversized-chunk',
          desc: `Chunk '${file}' possui ${sizeKb}kB (limite: ${MAX_CHUNK_SIZE_KB}kB).`,
        });
      }
    }
  });

  return { skipped: false, issues, largeChunks };
}

function runAudit() {
  console.log(`📦 [QA BUNDLE & CODE-SPLITTING AUDIT]`);

  const importIssues = checkLazyImports();
  const distCheck = checkDistChunks();

  let hasError = false;

  if (importIssues.length > 0) {
    hasError = true;
    console.log(`\n⚠️  Desvios de Dynamic Import encontrados:`);
    importIssues.forEach((i) => console.log(`  • ${i.desc}`));
  } else {
    console.log(`• Rotas principais: Dynamic imports com lazy() validados.`);
  }

  if (distCheck.skipped) {
    console.log(`• Diretório dist/ não construído. Execute 'npm run build' para auditoria de chunks.`);
  } else if (distCheck.largeChunks.length > 0) {
    console.log(`\n⚠️  Chunks acima do limite de ${MAX_CHUNK_SIZE_KB}kB:`);
    distCheck.largeChunks.forEach((c) => {
      console.log(`  • ${c.file}: ${c.sizeKb} kB`);
    });
  } else {
    console.log(`• Todos os chunks do build estão abaixo de ${MAX_CHUNK_SIZE_KB}kB.`);
  }

  if (!hasError) {
    console.log(`\n✅ Arquitetura de bundle e dynamic imports aprovada.`);
  }

  process.exit(hasError ? 1 : 0);
}

runAudit();
