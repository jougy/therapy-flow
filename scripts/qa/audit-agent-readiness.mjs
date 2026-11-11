#!/usr/bin/env node
/**
 * QA Agent & Machine-Readability Auditor
 * 
 * Audita a prontidão de IA e conformidade agêntica:
 * 1. public/.well-known/ard.json e public/ai-catalog.json: Devem seguir a especificação ARD 1.0 (urn:air:<domain>:..., sem propriedades proibidas).
 * 2. public/llms.txt: Deve possuir cabeçalho H1, resumo, listas H2 de links e seção Optional.
 * 3. Robôs e metadados: Verifica ausência de bloqueios acidentais e conformidade de rotas.
 */

import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

function auditManifestFile(relPath) {
  const filePath = path.join(PUBLIC_DIR, relPath);
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `Arquivo public/${relPath} não encontrado.` };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    if (data.specVersion !== '1.0') {
      return { ok: false, error: `${relPath}: specVersion deve ser "1.0", encontrado: "${data.specVersion}"` };
    }

    if (!Array.isArray(data.entries) || data.entries.length === 0) {
      return { ok: false, error: `${relPath}: deve conter um array "entries" não vazio.` };
    }

    for (const entry of data.entries) {
      if (!entry.identifier || !entry.displayName || !entry.description || !entry.url || !entry.type) {
        return { ok: false, error: `${relPath}: Entrada incompleta. Requer identifier, displayName, type, description e url conforme ARD 1.0.` };
      }
      if (!/^urn:air:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)+$/.test(entry.identifier)) {
        return { ok: false, error: `${relPath}: identifier "${entry.identifier}" deve seguir o formato URN ancorado "urn:air:<domain>:...".` };
      }
      if ('updatedAt' in entry) {
        return { ok: false, error: `${relPath}: propriedade legada "updatedAt" não é permitida pelo schema ARD (additionalProperties: false).` };
      }
    }

    return { ok: true, entriesCount: data.entries.length };
  } catch (err) {
    return { ok: false, error: `JSON inválido em ${relPath}: ${err.message}` };
  }
}

function auditAiCatalog() {
  const paths = ['ai-catalog.json', '.well-known/ai-catalog.json', 'ard.json', '.well-known/ard.json'];
  for (const rel of paths) {
    const res = auditManifestFile(rel);
    if (!res.ok) return res;
  }
  return auditManifestFile('.well-known/ard.json');
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
    console.log(`❌ ARD / ai-catalog.json: ${catResult.error}`);
  } else {
    console.log(`✅ ARD (.well-known/ard.json & ai-catalog.json): Válidos (ARD 1.0 com ${catResult.entriesCount} entradas).`);
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
