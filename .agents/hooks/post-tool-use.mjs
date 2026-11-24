#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
  console.log('{}');
  process.exit(0);
}

const cwd = input.cwd || process.cwd();
const filePath = String(input.toolCall?.args?.Path || '');

try {
  if (filePath.includes('/src/') || filePath.includes('/supabase/functions/')) {
    execSync('node scripts/dev/index-code-graph.mjs --update', { cwd, stdio: 'ignore', timeout: 5000 });
  } else if (filePath.endsWith('supabase/schema.sql')) {
    execSync('node scripts/dev/index-schema.mjs', { cwd, stdio: 'ignore', timeout: 8000 });
  }
} catch {
  // non-blocking
}

console.log('{}');
