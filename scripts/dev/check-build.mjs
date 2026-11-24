#!/usr/bin/env node
import { execFileSync } from 'child_process';

const t0 = Date.now();
try {
  const out = execFileSync('npx', ['vite', 'build'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const built = out.split('\n').find((l) => l.includes('built in')) || `built in ${((Date.now() - t0) / 1000).toFixed(1)}s`;
  console.log(`✅ vite build: ${built.trim()}`);
} catch (err) {
  const out = `${err.stdout || ''}\n${err.stderr || ''}`.trim();
  console.log('❌ vite build falhou:');
  console.log(out.split('\n').slice(-20).join('\n'));
  process.exit(1);
}
