#!/usr/bin/env node
/**
 * Supabase Schema Indexer & Domain Splitter
 *
 * Lê o monolito `supabase/schema.sql` (~15.900 linhas) e gera um diretório indexado
 * `supabase/schema-index/` dividido por domínios lógicos + um catálogo `00-INDEX.md`
 * ultra-compacto com números de linha exatos, colunas `_cents`, `deleted_at` e RLS.
 *
 * Nunca altera o `supabase/schema.sql` original (SSOT do Supabase CLI).
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SCHEMA_PATH = path.join(ROOT, 'supabase/schema.sql');
const OUT_DIR = path.join(ROOT, 'supabase/schema-index');
const DOMAINS_DIR = path.join(OUT_DIR, 'domains');

const DOMAIN_RULES = [
  { key: 'patients', label: 'Pacientes, Prontuário Base & LGPD Menor', regex: /patient|minor_consent|guardian|prontuario/i },
  { key: 'sessions', label: 'Sessões, Atendimentos, Agenda & Evolução', regex: /session|appointment|schedule|attendance|evolution|absence/i },
  { key: 'anamnesis_forms', label: 'Formulários, Anamnese, Templates & Biblioteca', regex: /anamnesis|form_|template|library|annotation/i },
  { key: 'clinics_rbac', label: 'Clínicas, Colaboradores, Convites & RBAC', regex: /clinic|member|invite|role|capability|permission|profile|user|auth/i },
  { key: 'finance_billing', label: 'Financeiro (_cents), Planos, Assinaturas & Asaas', regex: /billing|payment|subscription|plan|invoice|asaas|charge|cents|package|coupon|discount/i },
  { key: 'whatsapp_notifications', label: 'WhatsApp Bot, 2FA, Lembretes & Notificações', regex: /whatsapp|notification|reminder|totp|mfa|bot_|message|webhook/i },
  { key: 'storage_files', label: 'Uploads, Backblaze B2 & Quotas de Arquivos', regex: /upload|storage|b2_|file|attachment|bucket|quota/i },
  { key: 'platform_admin', label: 'Platform Master, Feature Flags, Auditoria & Feedbacks', regex: /platform|flag|feedback|release_note|audit|governance|telemetry|tag/i },
];

function classifyDomain(name) {
  for (const rule of DOMAIN_RULES) {
    if (rule.regex.test(name)) return rule.key;
  }
  return 'core_misc';
}

function main() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(`Arquivo não encontrado: ${SCHEMA_PATH}`);
    process.exit(1);
  }

  const content = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const lines = content.split('\n');

  fs.mkdirSync(DOMAINS_DIR, { recursive: true });

  const tables = [];
  const functions = [];
  const policies = [];
  const views = [];

  const domainChunks = {
    patients: [],
    sessions: [],
    anamnesis_forms: [],
    clinics_rbac: [],
    finance_billing: [],
    whatsapp_notifications: [],
    storage_files: [],
    platform_admin: [],
    core_misc: [],
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const lineNum = i + 1;

    // CREATE TABLE
    const tableMatch = line.match(/^CREATE TABLE (?:IF NOT EXISTS )?(?:"?public"?\.)?"?([a-zA-Z0-9_]+)"?\s*\(/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      const startLine = lineNum;
      const blockLines = [line];
      const cols = [];
      const centsCols = [];
      let hasDeletedAt = false;
      i++;
      while (i < lines.length && !lines[i].startsWith(');')) {
        const l = lines[i];
        blockLines.push(l);
        const colMatch = l.trim().match(/^"?([a-zA-Z0-9_]+)"?\s+([a-zA-Z0-9_ ()]+)/);
        if (colMatch && !['CONSTRAINT', 'PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK'].includes(colMatch[1].toUpperCase())) {
          const colName = colMatch[1];
          cols.push(colName);
          if (colName.endsWith('_cents')) centsCols.push(colName);
          if (colName === 'deleted_at') hasDeletedAt = true;
        }
        i++;
      }
      if (i < lines.length) {
        blockLines.push(lines[i]);
      }
      const endLine = i + 1;
      const domain = classifyDomain(tableName);
      tables.push({
        name: tableName,
        domain,
        startLine,
        endLine,
        colCount: cols.length,
        centsCols,
        hasDeletedAt,
        cols,
      });
      domainChunks[domain].push(
        `-- [TABLE] ${tableName} (schema.sql L${startLine}-L${endLine})\n` + blockLines.join('\n') + '\n'
      );
      i++;
      continue;
    }

    // CREATE VIEW
    const viewMatch = line.match(/^CREATE (?:OR REPLACE )?VIEW (?:"?public"?\.)?"?([a-zA-Z0-9_]+)"?/i);
    if (viewMatch) {
      const viewName = viewMatch[1];
      const startLine = lineNum;
      const blockLines = [line];
      i++;
      while (i < lines.length && !lines[i].trim().endsWith(';')) {
        blockLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) blockLines.push(lines[i]);
      const endLine = i + 1;
      const domain = classifyDomain(viewName);
      views.push({ name: viewName, domain, startLine, endLine });
      domainChunks[domain].push(
        `-- [VIEW] ${viewName} (schema.sql L${startLine}-L${endLine})\n` + blockLines.join('\n') + '\n'
      );
      i++;
      continue;
    }

    // CREATE FUNCTION
    const fnMatch = line.match(/^CREATE (?:OR REPLACE )?FUNCTION (?:"?public"?\.)?"?([a-zA-Z0-9_]+)"?\((.*)/i);
    if (fnMatch) {
      const fnName = fnMatch[1];
      const argsPreview = fnMatch[2].replace(/\)\s*RETURNS.*$/i, '').slice(0, 90);
      const startLine = lineNum;
      const blockLines = [line];
      i++;
      while (i < lines.length) {
        if (
          /^(CREATE|ALTER|GRANT|REVOKE|COMMENT|SET|SELECT)\s+/i.test(lines[i]) &&
          blockLines.length > 2
        ) {
          i--;
          break;
        }
        blockLines.push(lines[i]);
        if (/^\s*(\$\$|\$function\$|\$_?\$)\s*;\s*$/i.test(lines[i]) || /LANGUAGE\s+\w+[^;]*;\s*$/i.test(lines[i])) {
          break;
        }
        i++;
      }
      const endLine = i + 1;
      const domain = classifyDomain(fnName);
      functions.push({ name: fnName, args: argsPreview, domain, startLine, endLine });
      domainChunks[domain].push(
        `-- [RPC/FUNCTION] ${fnName} (schema.sql L${startLine}-L${endLine})\n` + blockLines.join('\n') + '\n'
      );
      i++;
      continue;
    }

    // CREATE POLICY
    const polMatch = line.match(/^CREATE POLICY "?([^"]+)"? ON (?:"?public"?\.)?"?([a-zA-Z0-9_]+)"?/i);
    if (polMatch) {
      const policyName = polMatch[1];
      const tableName = polMatch[2];
      const startLine = lineNum;
      const blockLines = [line];
      while (i + 1 < lines.length && !lines[i].trim().endsWith(';')) {
        i++;
        blockLines.push(lines[i]);
      }
      const endLine = i + 1;
      const domain = classifyDomain(tableName);
      const blockText = blockLines.join(' ');
      const capMatches = [...blockText.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]);
      policies.push({
        name: policyName,
        table: tableName,
        domain,
        startLine,
        endLine,
        capabilities: [...new Set(capMatches)],
      });
      domainChunks[domain].push(
        `-- [POLICY] ${policyName} ON ${tableName} (schema.sql L${startLine}-L${endLine})\n` + blockLines.join('\n') + '\n'
      );
      i++;
      continue;
    }

    i++;
  }

  // Write domain files
  for (const [domainKey, chunks] of Object.entries(domainChunks)) {
    const outFile = path.join(DOMAINS_DIR, `${domainKey}.sql`);
    const header = `-- ==========================================================================\n` +
      `-- DOMÍNIO: ${domainKey.toUpperCase()} (Gerado automaticamente por npm run schema:index)\n` +
      `-- Fonte SSOT: supabase/schema.sql\n` +
      `-- ==========================================================================\n\n`;
    fs.writeFileSync(outFile, header + chunks.join('\n'), 'utf8');
  }

  // Check duplicate RPC names (PGRST203 warning)
  const fnCounts = {};
  for (const f of functions) {
    fnCounts[f.name] = (fnCounts[f.name] || 0) + 1;
  }
  const overloadedFns = Object.entries(fnCounts).filter(([, c]) => c > 1);

  // Generate 00-INDEX.md
  const indexLines = [
    `# 🗄️ Índice Modular do Schema Supabase (SSOT Index)`,
    ``,
    `> **Gerado automaticamente** a partir de \`supabase/schema.sql\` (${lines.length} linhas).`,
    `> **Regra de Economia de Tokens:** Nunca leia \`supabase/schema.sql\` inteiro. Consulte este índice ou abra diretamente \`supabase/schema-index/domains/<dominio>.sql\` ou use \`view_file\` com \`StartLine\`/\`EndLine\` exatos abaixo.`,
    ``,
    `## 📊 Resumo Estrutural`,
    `- **Tabelas:** ${tables.length} | **Views:** ${views.length} | **RPCs/Funções:** ${functions.length} | **Políticas RLS:** ${policies.length}`,
    `- **Overloads detectados (Risco PGRST203):** ${overloadedFns.length === 0 ? 'Nenhum ✅' : overloadedFns.map(([n, c]) => `${n} (${c}x)`).join(', ')}`,
    ``,
    `## 📁 Arquivos de Domínio (\`supabase/schema-index/domains/\`)`,
    ...DOMAIN_RULES.map((r) => `- \`domains/${r.key}.sql\` — ${r.label}`),
    `- \`domains/core_misc.sql\` — Outras estruturas e utilitários`,
    ``,
    `## 📋 Catálogo de Tabelas (com linhas exatas em \`supabase/schema.sql\`)`,
    `| Tabela | Domínio | Linhas (\`schema.sql\`) | Colunas \`_cents\` | Soft Delete (\`deleted_at\`) | Qtd Colunas |`,
    `| :--- | :--- | :--- | :--- | :--- | :--- |`,
    ...tables
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(
        (t) =>
          `| \`${t.name}\` | \`${t.domain}\` | \`L${t.startLine}-L${t.endLine}\` | ${t.centsCols.length ? t.centsCols.map((c) => `\`${c}\``).join(', ') : '—'} | ${t.hasDeletedAt ? '✅ Sim' : '—'} | ${t.colCount} |`
      ),
    ``,
    `## ⚡ Catálogo de Views`,
    `| View | Domínio | Linhas (\`schema.sql\`) |`,
    `| :--- | :--- | :--- |`,
    ...views
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((v) => `| \`${v.name}\` | \`${v.domain}\` | \`L${v.startLine}-L${v.endLine}\` |`),
    ``,
    `## 🔧 Catálogo de RPCs e Funções (\`public\`)`,
    `| Função / RPC | Domínio | Linhas (\`schema.sql\`) | Parâmetros (Resumo) |`,
    `| :--- | :--- | :--- | :--- |`,
    ...functions
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => `| \`${f.name}\` | \`${f.domain}\` | \`L${f.startLine}-L${f.endLine}\` | \`${f.args.replace(/\|/g, '/')}\` |`),
    ``,
    `## 🛡️ Resumo de Políticas RLS com Capabilities`,
    `| Tabela | Policy | Linhas | Capabilities Detectadas |`,
    `| :--- | :--- | :--- | :--- |`,
    ...policies
      .filter((p) => p.capabilities.length > 0)
      .sort((a, b) => a.table.localeCompare(b.table))
      .map((p) => `| \`${p.table}\` | \`${p.name}\` | \`L${p.startLine}-L${p.endLine}\` | ${p.capabilities.map((c) => `\`${c}\``).join(', ')} |`),
    ``,
  ];

  fs.writeFileSync(path.join(OUT_DIR, '00-INDEX.md'), indexLines.join('\n'), 'utf8');
  console.log(
    `✅ Schema indexado em supabase/schema-index/00-INDEX.md (${tables.length} tabelas, ${views.length} views, ${functions.length} funções, ${policies.length} policies).`
  );
}

main();
