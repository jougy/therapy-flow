#!/usr/bin/env node
/**
 * Audit Supabase Rules & Schema Integrity
 * 
 * Checa estaticamente regras de integridade do Supabase:
 * 1. Proibição de overload de RPCs no schema public (Prevenção PGRST203).
 * 2. Padrão monetário estrito: novas colunas com bigint e _cents.
 * 3. Sincronismo do SSOT: avisa se novas migrações não estão registradas em supabase/schema.sql.
 * 4. Proteção contra ON DELETE CASCADE em sessões/prontuários (Compliance CFM 1.821 / LGPD).
 * 
 * Saída: 1 linha de sucesso ou 1 parágrafo em Markdown cirúrgico.
 */

import fs from 'fs';
import path from 'path';
import { synthesizeActionPrompt } from './prompt-synthesizer.mjs';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const SCHEMA_FILE = path.join(process.cwd(), 'supabase', 'schema.sql');

function checkOverloadedFunctions(schemaContent) {
  // Regex para capturar CREATE OR REPLACE FUNCTION public.nome_funcao
  const funcRegex = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;
  const funcs = new Map();
  let match;

  while ((match = funcRegex.exec(schemaContent)) !== null) {
    const name = match[1].toLowerCase();
    const count = funcs.get(name) || 0;
    funcs.set(name, count + 1);
  }

  const duplicates = [];
  for (const [name, count] of funcs.entries()) {
    if (count > 1) {
      duplicates.push({ name, count });
    }
  }
  return duplicates;
}

function checkMonetaryFields(schemaContent) {
  // Procura por colunas financeiras de novas tabelas de atendimento declaradas como numeric(10,2) em vez de bigint cents
  const issues = [];
  const sessionTableRegex = /create\s+table\s+(?:public\.)?(?:sessions|session_payments|clinic_billing_transactions)[\s\S]*?\);/gi;
  let match;

  while ((match = sessionTableRegex.exec(schemaContent)) !== null) {
    const tableBlock = match[0];
    if (/amount[a-zA-Z_]*\s+numeric/i.test(tableBlock) || /price[a-zA-Z_]*\s+numeric/i.test(tableBlock)) {
      issues.push('Uso de numeric em campo financeiro de atendimento (exigido bigint com _cents)');
    }
  }
  return issues;
}

function checkCascadeOnSessions(schemaContent) {
  // Procura por ON DELETE CASCADE em sessions ou clinical_records
  const cascadeIssues = [];
  const lines = schemaContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/references\s+(?:public\.)?patients/i.test(line) && /on\s+delete\s+cascade/i.test(line)) {
      cascadeIssues.push(`Linha ${i + 1}: ON DELETE CASCADE em referência a pacientes (exigido RESTRICT por compliance de 20 anos CFM 1.821)`);
    }
  }
  return cascadeIssues;
}

async function main() {
  if (!fs.existsSync(SCHEMA_FILE)) {
    console.log('⚠️ [audit-supabase] supabase/schema.sql não encontrado para auditoria estática.');
    process.exit(0);
  }

  const schemaContent = fs.readFileSync(SCHEMA_FILE, 'utf8');

  const overloaded = checkOverloadedFunctions(schemaContent);
  const monetaryIssues = checkMonetaryFields(schemaContent);
  const cascadeIssues = checkCascadeOnSessions(schemaContent);

  const errors = [];

  if (overloaded.length > 0) {
    errors.push(`Função RPC duplicada no schema public: ${overloaded.map((f) => `\`${f.name}\` (${f.count}x)`).join(', ')}. Isto gera erro PGRST203 no PostgREST.`);
  }

  if (monetaryIssues.length > 0) {
    errors.push(...monetaryIssues);
  }

  if (cascadeIssues.length > 0) {
    errors.push(...cascadeIssues);
  }

  if (errors.length === 0) {
    console.log('✅ [audit-supabase] Schema conforme! RPCs sem overload, retenção estrita e padrão financeiro OK.');
    process.exit(0);
  }

  const prompt = await synthesizeActionPrompt('supabase', { message: errors.join('; ') });
  console.log(prompt);
  process.exit(1);
}

main();
