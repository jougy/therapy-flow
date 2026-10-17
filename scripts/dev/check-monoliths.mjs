#!/usr/bin/env node
/**
 * Monolith Prevention Checker
 *
 * Audita a base de código em src/ para impedir a criação de novos monolitos
 * (> 500 linhas) ou o crescimento descontrolado dos arquivos legados já mapeados.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const BASELINE_PATH = path.join(ROOT, 'scripts/dev/monolith-baseline.json');
const MAX_LINES_NEW = 500;

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        walk(fullPath, fileList);
      }
    } else if (/\.(tsx?|jsx?)$/.test(file) && !file.endsWith('.d.ts')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function main() {
  const allFiles = walk(SRC_DIR);
  const baseline = fs.existsSync(BASELINE_PATH)
    ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
    : {};

  const violations = [];

  for (const file of allFiles) {
    const relPath = path.relative(SRC_DIR, file);
    if (relPath.startsWith('integrations/supabase/types/database.ts')) continue;

    const content = fs.readFileSync(file, 'utf8');
    const lineCount = content.split('\n').length;

    const maxAllowed = baseline[relPath] || MAX_LINES_NEW;
    if (lineCount > maxAllowed) {
      violations.push({ relPath, lineCount, maxAllowed, isNew: !baseline[relPath] });
    }
  }

  if (violations.length > 0) {
    console.error(`❌ [check:monoliths] Encontradas ${violations.length} violações de tamanho de arquivo:`);
    for (const v of violations) {
      if (v.isNew) {
        console.error(`  - [NOVO ARQUIVO MONOLÍTICO] src/${v.relPath}: ${v.lineCount}L (limite para novos arquivos: ${MAX_LINES_NEW}L)`);
      } else {
        console.error(`  - [EXPANSÃO NÃO PERMITIDA] src/${v.relPath}: ${v.lineCount}L (limite baseline: ${v.maxAllowed}L)`);
      }
    }
    console.error(`💡 Solução: Separe o componente em subpastas indexadas (Barrel pattern) antes de commitar.`);
    process.exit(1);
  }

  console.log(`✅ [check:monoliths] Nenhum novo monolito detectado (máx: 500L para novos arquivos; baseline respeitada).`);
}

main();
