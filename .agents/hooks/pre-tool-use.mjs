#!/usr/bin/env node
import fs from 'fs';

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
  console.log(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
}

const toolName = input.toolCall?.name || '';
const args = input.toolCall?.args || {};

if (toolName === 'read_file') {
  const filePath = String(args.Path || '');
  const isGiantFile =
    filePath.endsWith('supabase/schema.sql') ||
    filePath.endsWith('src/integrations/supabase/types/database.ts');

  if (isGiantFile) {
    const start = Number(args.StartLine || 0);
    const end = Number(args.EndLine || 0);
    if (!start || !end || end - start > 300) {
      console.log(
        JSON.stringify({
          decision: 'deny',
          reason:
            'Leitura bloqueada: arquivo gigante (>4k linhas). Use `npm run ai:schema <alvo> --exact` ou `src/integrations/supabase/types/` com bloco <= 200 linhas.',
        })
      );
      process.exit(0);
    }
  }
}

if (toolName === 'run_command') {
  const cmd = String(args.CommandLine || '').trim();
  if (/supabase\s+db\s+reset/i.test(cmd)) {
    console.log(
      JSON.stringify({
        decision: 'force_ask',
        reason: 'REGRA: `supabase db reset` é proibido sem autorização explícita. Prefira migrations incrementais.',
      })
    );
    process.exit(0);
  }
  if (/^git\s+status\s*$/.test(cmd)) {
    console.log(
      JSON.stringify({
        decision: 'allow',
        overwrite: { CommandLine: 'git status -s' },
      })
    );
    process.exit(0);
  }
  if (/^git\s+diff\s*$/.test(cmd)) {
    console.log(
      JSON.stringify({
        decision: 'allow',
        overwrite: { CommandLine: 'npm run git:summary' },
      })
    );
    process.exit(0);
  }
}

console.log(JSON.stringify({ decision: 'allow' }));
