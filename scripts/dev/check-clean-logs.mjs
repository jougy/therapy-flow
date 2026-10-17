#!/usr/bin/env node
/**
 * Anti-Pollution Terminal Log Checker
 *
 * Inspeciona arquivos modificados ou arquivos em src/lib, src/hooks, src/pages
 * buscando `console.log(` com múltiplos argumentos ou dumps brutos de objetos
 * sem o prefixo obrigatório `[DEBUG]`.
 *
 * Uso:
 *   node scripts/dev/check-clean-logs.mjs
 *   node scripts/dev/check-clean-logs.mjs --all
 *   node scripts/dev/check-clean-logs.mjs src/pages/Index.tsx
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const ALLOWED_TAG_REGEX = /^[`'"]\s*\[(DEBUG|[A-Z0-9_\-]+)\]/i;

function splitTopLevelArgs(argsStr) {
  const args = [];
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let escape = false;
  let current = '';

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];
    if (escape) {
      current += char;
      escape = false;
      continue;
    }
    if (char === '\\') {
      current += char;
      escape = true;
      continue;
    }
    if (inSingleQuote) {
      current += char;
      if (char === "'") inSingleQuote = false;
      continue;
    }
    if (inDoubleQuote) {
      current += char;
      if (char === '"') inDoubleQuote = false;
      continue;
    }
    if (inTemplate) {
      current += char;
      if (char === '`') inTemplate = false;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      current += char;
    } else if (char === '"') {
      inDoubleQuote = true;
      current += char;
    } else if (char === '`') {
      inTemplate = true;
      current += char;
    } else if (char === '(' || char === '{' || char === '[') {
      depth++;
      current += char;
    } else if (char === ')' || char === '}' || char === ']') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function extractCallArgs(code, openParenIdx) {
  let depth = 1;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let escape = false;

  for (let i = openParenIdx + 1; i < code.length; i++) {
    const char = code[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (inSingleQuote) {
      if (char === "'") inSingleQuote = false;
      continue;
    }
    if (inDoubleQuote) {
      if (char === '"') inDoubleQuote = false;
      continue;
    }
    if (inTemplate) {
      if (char === '`') inTemplate = false;
      continue;
    }

    if (char === "'") inSingleQuote = true;
    else if (char === '"') inDoubleQuote = true;
    else if (char === '`') inTemplate = true;
    else if (char === '(' || char === '{' || char === '[') depth++;
    else if (char === ')' || char === '}' || char === ']') {
      depth--;
      if (depth === 0) {
        return {
          argsStr: code.slice(openParenIdx + 1, i),
          endIdx: i,
        };
      }
    }
  }
  return null;
}

function inspectFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const violations = [];

  // Remove block comments /* ... */ safely
  let cleanContent = '';
  let inBlockComment = false;
  for (let i = 0; i < content.length; i++) {
    if (!inBlockComment && content[i] === '/' && content[i + 1] === '*') {
      inBlockComment = true;
      cleanContent += '  ';
      i++;
    } else if (inBlockComment && content[i] === '*' && content[i + 1] === '/') {
      inBlockComment = false;
      cleanContent += '  ';
      i++;
    } else if (inBlockComment) {
      cleanContent += content[i] === '\n' ? '\n' : ' ';
    } else {
      cleanContent += content[i];
    }
  }

  // Pre-calculate line start offsets
  const lineOffsets = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') lineOffsets.push(i + 1);
  }
  function getLineNum(charIdx) {
    let low = 0;
    let high = lineOffsets.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lineOffsets[mid] <= charIdx) {
        if (mid === lineOffsets.length - 1 || lineOffsets[mid + 1] > charIdx) {
          return mid + 1;
        }
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return 1;
  }

  const logPattern = /\bconsole\.log\s*\(/g;
  let match;

  while ((match = logPattern.exec(cleanContent)) !== null) {
    const logStart = match.index;
    const parenIdx = logStart + match[0].lastIndexOf('(');

    // Check if line starts with single-line comment //
    const lineStart = cleanContent.lastIndexOf('\n', logStart) + 1;
    const linePrefix = cleanContent.slice(lineStart, logStart).trim();
    if (linePrefix.startsWith('//')) continue;

    const call = extractCallArgs(cleanContent, parenIdx);
    if (!call) continue;

    const args = splitTopLevelArgs(call.argsStr);
    if (args.length === 0) continue;

    const first = args[0].trim();
    const hasAllowedTag = ALLOWED_TAG_REGEX.test(first);

    if (hasAllowedTag) continue;

    const lineNum = getLineNum(logStart);
    const snippet = content.slice(logStart, Math.min(call.endIdx + 1, logStart + 120)).replace(/\s+/g, ' ');

    if (args.length > 1) {
      violations.push({
        file: path.relative(ROOT, filePath),
        line: lineNum,
        reason: 'múltiplos argumentos sem prefixo [DEBUG]',
        snippet,
      });
    } else {
      // 1 argument: check if raw object or variable dump
      const isString = /^[`'"]/.test(first);
      if (!isString || first.startsWith('{') || first.startsWith('[')) {
        violations.push({
          file: path.relative(ROOT, filePath),
          line: lineNum,
          reason: 'dump bruto de variável/objeto sem prefixo [DEBUG]',
          snippet,
        });
      }
    }
  }

  return violations;
}

function getGitModifiedFiles() {
  try {
    const out = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
    const files = [];
    for (const line of out.split('\n')) {
      if (!line.trim()) continue;
      const filePath = line.slice(3).trim();
      // Handle renamed files "old -> new"
      const target = filePath.includes('->') ? filePath.split('->')[1].trim() : filePath;
      if (/\.(ts|tsx|js|jsx|mjs)$/.test(target) && target.startsWith('src/')) {
        const full = path.join(ROOT, target);
        if (fs.existsSync(full)) files.push(full);
      }
    }
    return files;
  } catch {
    return [];
  }
}

function collectSourceFiles(dirs) {
  const result = [];
  function walk(d) {
    if (!fs.existsSync(d)) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(e.name)) {
        result.push(full);
      }
    }
  }
  for (const dir of dirs) {
    walk(path.join(ROOT, dir));
  }
  return result;
}

function main() {
  const args = process.argv.slice(2);
  let filesToScan = [];
  const isAll = args.includes('--all');

  const customPaths = args.filter((a) => !a.startsWith('--'));
  if (customPaths.length > 0) {
    for (const p of customPaths) {
      const full = path.resolve(ROOT, p);
      if (fs.existsSync(full)) {
        if (fs.statSync(full).isDirectory()) {
          filesToScan.push(...collectSourceFiles([p]));
        } else {
          filesToScan.push(full);
        }
      }
    }
  } else if (isAll) {
    filesToScan = collectSourceFiles(['src/lib', 'src/hooks', 'src/pages']);
  } else {
    // Inspeciona arquivos modificados no git; se não houver nenhum modificado, escaneia src/lib, src/hooks, src/pages
    const modified = getGitModifiedFiles();
    if (modified.length > 0) {
      filesToScan = modified;
    } else {
      filesToScan = collectSourceFiles(['src/lib', 'src/hooks', 'src/pages']);
    }
  }

  // Deduplicate
  filesToScan = [...new Set(filesToScan)];

  let totalViolations = [];
  for (const f of filesToScan) {
    const v = inspectFile(f);
    if (v.length > 0) totalViolations.push(...v);
  }

  if (totalViolations.length === 0) {
    console.log(`✅ [check-clean-logs] 100% limpo! Zero logs poluidores detectados em ${filesToScan.length} arquivo(s).`);
    process.exit(0);
  }

  console.error(`\n❌ [check-clean-logs] ${totalViolations.length} log(s) poluidor(es) detectado(s):\n`);
  for (const v of totalViolations) {
    console.error(`  📍 ${v.file}:${v.line} [${v.reason}]`);
    console.error(`     ${v.snippet}\n`);
  }
  console.error('💡 Solução: Adicione o prefixo obrigatório `[DEBUG]` (ex: console.log("[DEBUG] Mensagem:", obj)) ou remova o log antes de enviar.');
  process.exit(1);
}

main();
