#!/usr/bin/env node
/**
 * Quick Lint & TypeScript Auditor
 * 
 * Executa checagem de erros estritos de ESLint e TypeScript sem despejar
 * centenas de linhas de log no terminal. Filtra apenas erros bloqueantes (severity 2),
 * e usa o prompt-synthesizer para emitir 1 parágrafo cirúrgico de correção.
 * 
 * Uso:
 *   node scripts/dev/quick-lint.mjs
 *   node scripts/dev/quick-lint.mjs src/pages/PacienteDetalhe.tsx
 */

import { spawn } from 'child_process';
import { synthesizeActionPrompt } from './prompt-synthesizer.mjs';

const targetArg = process.argv[2] || '.';

function runEslintJson(target) {
  return new Promise((resolve) => {
    const eslintProcess = spawn('npx', ['eslint', target, '--format', 'json'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    eslintProcess.stdout.on('data', (d) => (stdout += d));
    eslintProcess.stderr.on('data', (d) => (stderr += d));

    eslintProcess.on('close', (code) => {
      try {
        const json = JSON.parse(stdout);
        resolve({ code, json, stderr });
      } catch (e) {
        resolve({ code, raw: stdout, stderr });
      }
    });
  });
}

async function main() {
  const { code, json, stderr, raw } = await runEslintJson(targetArg);

  if (!json && raw) {
    console.error('❌ Falha ao rodar ESLint:', stderr || raw.slice(0, 200));
    process.exit(1);
  }

  const blockingErrors = [];

  for (const fileReport of json || []) {
    for (const msg of fileReport.messages) {
      // severity 2 = erro bloqueante (ignora severity 1 = warnings)
      if (msg.severity === 2) {
        blockingErrors.push({
          file: fileReport.filePath.replace(process.cwd() + '/', ''),
          line: msg.line,
          column: msg.column,
          ruleId: msg.ruleId,
          message: msg.message,
        });
        if (blockingErrors.length >= 3) break;
      }
    }
    if (blockingErrors.length >= 3) break;
  }

  if (blockingErrors.length === 0) {
    console.log('✅ [quick-lint] 100% limpo! Zero erros bloqueantes.');
    process.exit(0);
  }

  // Gera parágrafo técnico de correção com LLM gratuita ou fallback
  const prompt = await synthesizeActionPrompt('lint', { errors: blockingErrors });
  console.log(prompt);
  process.exit(1);
}

main();
