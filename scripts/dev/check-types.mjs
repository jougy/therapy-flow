#!/usr/bin/env node
import { execFileSync } from 'child_process';

try {
  execFileSync('npx', ['tsc', '--noEmit'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  console.log('✅ tsc --noEmit: 0 erros');
} catch (err) {
  const out = `${err.stdout || ''}\n${err.stderr || ''}`.trim();
  const lines = out.split('\n').filter((l) => /error TS\d+:/.test(l));
  console.log(`❌ tsc --noEmit: ${lines.length} erro(s)`);
  for (const l of lines.slice(0, 15)) console.log('  ' + l);
  if (lines.length > 15) console.log(`  ... +${lines.length - 15} erros omitidos`);
  process.exit(1);
}
