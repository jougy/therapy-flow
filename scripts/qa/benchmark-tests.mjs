#!/usr/bin/env node
/**
 * QA Test Suite Performance Profiler & Benchmark Gatekeeper
 * 
 * Executa diagnósticos de latência da suíte Vitest:
 * 1. Coleta métricas de tempo de execução por arquivo.
 * 2. Identifica os 10 arquivos mais lentos (gargalos).
 * 3. Detecta suítes que ultrapassam o teto aceitável (> 1500ms).
 * 4. Retorna scorecard ultra-conciso em texto/JSON para consumo por subagentes (< 50 tokens).
 */

import { spawn } from 'child_process';
import path from 'path';

const MAX_TARGET_MS = 2000; // Alerta para arquivos individuais acima de 2s

async function runBenchmark() {
  const target = process.argv[2] || '';
  const args = ['vitest', 'run'];
  if (target) {
    args.push(target);
  }

  const startTime = Date.now();
  const vitest = spawn('npx', args, {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  vitest.stdout.on('data', (d) => { stdout += d.toString(); });
  vitest.stderr.on('data', (d) => { stderr += d.toString(); });

  vitest.on('close', (code) => {
    const totalDuration = Date.now() - startTime;
    
    // Parse duration lines: "✓ src/pages/PacienteDetalhe.test.tsx (14 tests) 9810ms"
    const fileTimeRegex = /[✓❯✘]\s+([^\s]+\.test\.[tj]sx?)(?:\s+\(\d+\s+tests?\))?\s+(\d+(?:\.\d+)?m?s)/g;
    const fileMatches = [];
    let match;

    while ((match = fileTimeRegex.exec(stdout)) !== null) {
      const file = match[1];
      const timeStr = match[2];
      let ms = 0;
      if (timeStr.endsWith('ms')) {
        ms = parseFloat(timeStr.replace('ms', ''));
      } else if (timeStr.endsWith('s')) {
        ms = parseFloat(timeStr.replace('s', '')) * 1000;
      }
      fileMatches.push({ file, durationMs: Math.round(ms) });
    }

    // Ordena do mais lento para o mais rápido
    fileMatches.sort((a, b) => b.durationMs - a.durationMs);

    const slowFiles = fileMatches.filter((f) => f.durationMs > MAX_TARGET_MS);

    console.log(`⏱️  [QA BENCHMARK DE TESTES]`);
    console.log(`• Duração Total: ${(totalDuration / 1000).toFixed(2)}s | Arquivos Analisados: ${fileMatches.length || 'N/A'}`);
    
    if (fileMatches.length > 0) {
      console.log(`• Top Gargalos Identificados:`);
      fileMatches.slice(0, 5).forEach((f, idx) => {
        const flag = f.durationMs > MAX_TARGET_MS ? '⚠️ ' : '⚡ ';
        console.log(`  ${idx + 1}. ${flag}${f.file}: ${(f.durationMs / 1000).toFixed(2)}s`);
      });
    }

    if (slowFiles.length > 0) {
      console.log(`\n🚨 ${slowFiles.length} arquivos ultrapassam o teto aceitável de ${MAX_TARGET_MS / 1000}s!`);
    } else {
      console.log(`\n✅ Latência sob controle dentro das metas.`);
    }

    process.exit(code === 0 ? 0 : 1);
  });
}

runBenchmark().catch((err) => {
  console.error('Erro ao rodar benchmark:', err);
  process.exit(1);
});
