#!/usr/bin/env node
import fs from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * MICRO-MUTATION TESTING ENGINE (Custo Zero de Tokens)
 * 
 * Avalia se a suíte de testes de funções críticas do SaaS é capaz de pegar
 * mutações lógicas/aritméticas em tempo real.
 */

const MUTATION_TARGETS = [
  {
    file: 'src/lib/payment-plans.ts',
    testFile: 'src/lib/payment-plans.test.ts',
    mutations: [
      {
        find: 'return Math.round(totalAmountCents / totalSessions);',
        replace: 'return Math.round(totalAmountCents * totalSessions);',
        desc: 'Inversão do cálculo unitário de centavos por sessão'
      },
      {
        find: 'if (totalSessions <= 0 || totalAmountCents <= 0) {',
        replace: 'if (totalSessions < 0 || totalAmountCents < 0) {',
        desc: 'Enfraquecimento da guarda de boundary zero (<= para <)'
      }
    ]
  },
  {
    file: 'src/lib/utils.ts',
    testFile: 'src/lib/utils.test.ts',
    mutations: [
      {
        find: 'return twMerge(clsx(inputs));',
        replace: 'return "";',
        desc: 'Esvaziamento do retorno da função essencial cn()'
      }
    ]
  }
];

function runTest(testFile) {
  try {
    execSync(`npx vitest run ${testFile} --reporter=dot`, {
      stdio: 'pipe',
      timeout: 15000,
      env: { ...process.env, CI: 'true' }
    });
    return true; // Passou
  } catch {
    return false; // Falhou
  }
}

async function runMutations() {
  console.log('🧬 [MICRO-MUTATION TESTING ENGINE]');
  let totalMutations = 0;
  let caughtMutations = 0;
  let survivedMutations = 0;

  for (const target of MUTATION_TARGETS) {
    if (!fs.existsSync(target.file) || !fs.existsSync(target.testFile)) {
      continue;
    }

    const originalContent = fs.readFileSync(target.file, 'utf-8');
    
    // Testa baseline inicial
    const baselinePasses = runTest(target.testFile);
    if (!baselinePasses) {
      console.log(`⚠️ Baseline falhando para ${target.testFile}, pulando mutações deste arquivo.`);
      continue;
    }

    console.log(`\n🎯 Alvo: ${target.file}`);

    for (const mutation of target.mutations) {
      if (!originalContent.includes(mutation.find)) {
        console.log(`  ⏭️ Padrão não encontrado: "${mutation.desc}"`);
        continue;
      }

      totalMutations++;
      const mutatedContent = originalContent.replace(mutation.find, mutation.replace);
      fs.writeFileSync(target.file, mutatedContent, 'utf-8');

      try {
        const testPassedWithMutation = runTest(target.testFile);
        if (testPassedWithMutation) {
          console.log(`  ❌ SOBREVIVEU (Teste fraco / falso positivo): [${mutation.desc}]`);
          survivedMutations++;
        } else {
          console.log(`  ✅ CAPTURADA (Teste forte / rejeição imediata): [${mutation.desc}]`);
          caughtMutations++;
        }
      } finally {
        // Restaura arquivo original obrigatoriamente
        fs.writeFileSync(target.file, originalContent, 'utf-8');
      }
    }
  }

  const score = totalMutations > 0 ? Math.round((caughtMutations / totalMutations) * 100) : 100;
  console.log(`\n📊 Score de Eficácia de Mutação: ${score}% (${caughtMutations}/${totalMutations} capturadas)`);
  
  if (survivedMutations > 0) {
    process.exit(1);
  }
}

runMutations().catch((err) => {
  console.error('Erro no runner de micro-mutação:', err);
  process.exit(1);
});
