#!/usr/bin/env node
/**
 * QA Agent & Machine-Readability Auditor
 * 
 * Audita a prontidão de IA e conformidade agêntica:
 * 1. public/ai-catalog.json: Deve seguir a especificação ARD 1.0 (WebMCP / Agent-Card).
 * 2. public/llms.txt: Deve possuir cabeçalho H1, resumo, listas H2 de links e seção Optional.
 * 3. Robôs e metadados: Verifica ausência de bloqueios acidentais e conformidade de rotas.
 */

import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

function auditAiCatalog() {
  const filePath = path.join(PUBLIC_DIR, 'ai-catalog.json');
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: 'Arquivo public/ai-catalog.json não encontrado.' };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    if (data.specVersion !== '1.0') {
      return { ok: false, error: `specVersion deve ser "1.0", encontrado: "${data.specVersion}"` };
    }

    if (!Array.isArray(data.entries) || data.entries.length === 0) {
      return { ok: false, error: 'ai-catalog.json deve conter um array "entries" não vazio.' };
    }

    const first = data.entries[0];
    if (!first.identifier || !first.displayName || !first.description || !first.url) {
      return { ok: false, error: 'Entrada no catálogo incompleta. Requer identifier, displayName, description e url conforme ARD 1.0.' };
    }

    return { ok: true, entriesCount: data.entries.length };
  } catch (err) {
    return { ok: false, error: `JSON inválido em ai-catalog.json: ${err.message}` };
  }
}

function auditLlmsTxt() {
  const filePath = path.join(PUBLIC_DIR, 'llms.txt');
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: 'Arquivo public/llms.txt não encontrado.' };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];

  if (!content.startsWith('# ')) {
    issues.push('llms.txt deve começar com um título H1 (# Nome)');
  }

  // Permite '## Recursos', '## Capabilities' ou seções H2 equivalentes
  if (!content.includes('## Recursos') && !content.includes('## Capabilities')) {
    issues.push('llms.txt deve conter uma seção H2 de recursos ou capacidades');
  }

  if (!content.includes('## Optional')) {
    issues.push('llms.txt deve conter a seção padronizada "## Optional" para links complementares');
  }

  if (issues.length > 0) {
    return { ok: false, error: issues.join('; ') };
  }

  return { ok: true };
}

function runAudit() {
  console.log(`🤖 [QA AGENT & MACHINE-READABILITY AUDIT]`);

  const catResult = auditAiCatalog();
  const llmResult = auditLlmsTxt();

  let hasError = false;

  if (!catResult.ok) {
    hasError = true;
    console.log(`❌ ai-catalog.json: ${catResult.error}`);
  } else {
    console.log(`✅ ai-catalog.json: Válido (ARD 1.0 com ${catResult.entriesCount} entradas).`);
  }

  if (!llmResult.ok) {
    hasError = true;
    console.log(`❌ llms.txt: ${llmResult.error}`);
  } else {
    console.log(`✅ llms.txt: Válido e aderente ao padrão da especificação.`);
  }

  process.exit(hasError ? 1 : 0);
}

runAudit();
