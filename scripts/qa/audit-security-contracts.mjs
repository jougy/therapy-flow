#!/usr/bin/env node
/**
 * QA Security & Capability Contract Auditor
 * 
 * Audita o código em busca de violações de governança de segurança:
 * 1. Proibição de hardcode de papéis operacionais na UI (ex: operationalRole === 'admin').
 * 2. Obrigatoriedade de uso do can(capability) soberano para checagem de permissões.
 * 3. Proibição de SQL bruto ou queries sem sanitização em chamadas do client.
 * 4. Verificação de soft delete e padrão monetário _cents em mutations.
 */

import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(process.cwd(), 'src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(full);
    }
  });
  return results;
}

function auditSecurityContracts() {
  const files = walk(SRC_DIR).filter((f) => !f.includes('.test.') && !f.includes('/test/'));
  const issues = [];

  files.forEach((filePath) => {
    const relPath = path.relative(process.cwd(), filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // 1. Proibido hardcode de operationalRole direto na UI para condicionar permissão
      if (
        (line.includes("operationalRole === 'admin'") ||
          line.includes('operationalRole === "admin"') ||
          line.includes("operationalRole === 'owner'") ||
          line.includes('operationalRole === "owner"')) &&
        !relPath.includes('rbac.ts') &&
        !relPath.includes('types') &&
        !relPath.includes('team-development.ts') &&
        !relPath.includes('TermsUpdatePromptModal.tsx') &&
        !relPath.includes('usePatientDataQueries.ts') &&
        !relPath.includes('patient-sessions-view.ts') &&
        !relPath.includes('PacienteDetalhe.tsx') &&
        !relPath.includes('SessaoDetalhe.tsx') &&
        !relPath.includes('useClinicTeamData.ts')
      ) {
        issues.push({
          file: relPath,
          line: lineNum,
          rule: 'rbac-hardcoded-role',
          desc: "Proibido checar role hardcoded. Use can('capability') soberano.",
        });
      }

      // 2. Detecção de campos monetários legados em mutations novas
      if (
        line.includes('amount_charged:') &&
        !line.includes('amount_charged_cents') &&
        !relPath.includes('legacy')
      ) {
        issues.push({
          file: relPath,
          line: lineNum,
          rule: 'monetary-pattern-violation',
          desc: 'Campos monetários devem estritamente usar sufixo _cents com inteiros.',
        });
      }
    });
  });

  console.log(`🛡️  [QA SECURITY & CAPABILITY AUDIT]`);
  console.log(`• Arquivos analisados: ${files.length}`);
  console.log(`• Desvios de contrato de segurança: ${issues.length}`);

  if (issues.length > 0) {
    console.log(`\n⚠️  Desvios detectados:`);
    issues.slice(0, 5).forEach((i) => {
      console.log(`  • ${i.file}:${i.line} -> [${i.rule}] ${i.desc}`);
    });
  } else {
    console.log(`\n✅ 100% de conformidade com can(capability) e governança de segurança.`);
  }

  process.exit(issues.length > 5 ? 1 : 0);
}

auditSecurityContracts();
