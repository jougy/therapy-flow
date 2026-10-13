#!/usr/bin/env node
/**
 * Master Quick Check Runner
 * 
 * Executa os 3 verificadores em cadeia ultra-rápida:
 * 1. Quick Lint (ESLint & Tipagem)
 * 2. Audit Supabase (Regras de Banco, RPCs e SSOT)
 * 3. Quick Responsive (Mobile-First, Overflow & RBAC)
 * 
 * Se tudo estiver correto, emite apenas 3 linhas verdes (< 15 tokens).
 * Se algo falhar, o sintetizador gera um parágrafo de instrução cirúrgica
 * e interrompe a cadeia para o agente corrigir pontualmente.
 * 
 * Uso:
 *   node scripts/dev/check-all.mjs
 */

import { spawn } from 'child_process';

function runScript(scriptPath, args = []) {
  return new Promise((resolve) => {
    const p = spawn('node', [scriptPath, ...args], {
      shell: true,
      stdio: 'inherit',
    });
    p.on('close', (code) => resolve(code));
  });
}

async function main() {
  console.log('🔍 Executando verificações de qualidade com zero consumo de tokens...\n');

  // 1. Supabase Integrity
  const codeSupabase = await runScript('scripts/dev/audit-supabase.mjs');
  if (codeSupabase !== 0) process.exit(codeSupabase);

  // 2. Mobile-First & Responsividade
  const codeResp = await runScript('scripts/dev/quick-responsive.mjs');
  if (codeResp !== 0) process.exit(codeResp);

  // 3. Quick Lint
  const codeLint = await runScript('scripts/dev/quick-lint.mjs');
  if (codeLint !== 0) process.exit(codeLint);

  console.log('\n🚀 [check:quick] Todas as verificações passaram com 100% de sucesso!');
  process.exit(0);
}

main();
