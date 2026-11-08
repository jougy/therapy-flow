#!/usr/bin/env node
/**
 * QA Doctor - Painel Executivo Unificado de Engenharia de Qualidade
 * 
 * Executa em cadeia e consolida os 4 eixos de qualidade:
 * 1. Acessibilidade (A11y WCAG 2.1 AA)
 * 2. Segurança & Capabilities (RBAC / RLS)
 * 3. Integridade e Saúde da Suíte (Zero testes ocos / Mocks cegos)
 * 4. Performance de Execução & Latência
 * 
 * Saída concisa ideal para agentes e desenvolvedores (< 30 linhas / < 100 tokens).
 */

import { execSync } from 'child_process';
import path from 'path';

const ROOT = process.cwd();

function runCheck(label, cmd) {
  process.stdout.write(`⏳ Analisando ${label}... `);
  try {
    const output = execSync(cmd, { cwd: ROOT, stdio: 'pipe' }).toString();
    console.log(`✅ OK`);
    return { ok: true, output };
  } catch (err) {
    console.log(`⚠️ ALERTA`);
    return { ok: false, output: err.stdout ? err.stdout.toString() : err.message };
  }
}

function main() {
  console.log(`\n🏥 ==================== PLURI QA DOCTOR ==================== 🏥\n`);

  const results = {
    testsHealth: runCheck('Saúde e Densidade dos Testes', 'python3 scripts/dev/audit_tests_health.py'),
    security: runCheck('Contratos de Segurança e can(capability)', 'node scripts/qa/audit-security-contracts.mjs'),
    a11y: runCheck('Heurísticas de Acessibilidade (WCAG 2.1 AA)', 'node scripts/qa/audit-a11y.mjs'),
    mutation: runCheck('Micro-Mutação e Fuzzing (Resiliência)', 'node scripts/qa/micro-mutation.mjs'),
  };

  console.log(`\n📊 ---------------- RESUMO DO SCORECARD ---------------- 📊`);
  console.log(`• Testes & Mocks:    ${results.testsHealth.ok ? '🟢 100% íntegro' : '🟡 Atenção requerida'}`);
  console.log(`• Segurança & RBAC:   ${results.security.ok ? '🟢 Aprovado' : '🔴 Desvios encontrados'}`);
  console.log(`• Acessibilidade:     ${results.a11y.ok ? '🟢 Aprovado' : '🟡 Revisar potenciais nós'}`);
  console.log(`• Micro-Mutação:      ${results.mutation.ok ? '🟢 100% Eficácia' : '🔴 Mutações sobreviveram'}`);
  console.log(`\n💡 Para rodar profiling de latência: npm run qa:bench`);
  console.log(`===========================================================\n`);
}

main();
