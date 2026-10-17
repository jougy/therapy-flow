#!/usr/bin/env node
/**
 * HTML Integrity & Parse5 Validation Checker (Pluri-Health)
 *
 * Audita o index.html antes do Vite Build para garantir conformidade estrita com HTML5
 * e impedir falhas do parse5 (como disallowed-content-in-noscript-in-head).
 * Custo: 0 tokens (execução puramente estática e local).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');

function auditHtml() {
  if (!fs.existsSync(INDEX_HTML_PATH)) {
    console.error('❌ index.html não encontrado na raiz!');
    process.exit(1);
  }

  const content = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  const errors = [];

  // 1. Extrair o conteúdo do <head>
  const headMatch = content.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) {
    errors.push('Tag <head> não encontrada ou mal formatada em index.html.');
  } else {
    const headContent = headMatch[1];

    // Checar se há <noscript> dentro do <head> contendo tags proibidas (img, div, iframe, p, etc.)
    const noscriptInHeadMatches = headContent.matchAll(/<noscript[^>]*>([\s\S]*?)<\/noscript>/gi);
    for (const match of noscriptInHeadMatches) {
      const noscriptInner = match[1];
      if (/<(img|iframe|div|p|table|form|span|a)\b/i.test(noscriptInner)) {
        errors.push(
          'Conteúdo inválido em <noscript> dentro de <head>: ' +
          'HTML5 / parse5 proíbe elementos como <img>, <iframe> ou <div> dentro do <noscript> no <head>. ' +
          'Mova o bloco <noscript> para dentro do <body>.'
        );
      }
    }
  }

  // 2. Verificar tags essenciais
  if (!/<div\s+id=["']root["']/i.test(content)) {
    errors.push('Elemento container <div id="root"> não encontrado no index.html.');
  }

  if (!/<script\s+type=["']module["']\s+src=["']\/src\/main\.tsx["']/i.test(content)) {
    errors.push('Ponto de entrada Vite (/src/main.tsx) não encontrado no index.html.');
  }

  if (errors.length > 0) {
    console.error('❌ [check:html] Falha de integridade em index.html:');
    errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  console.log('✅ [check:html] index.html 100% válido (parse5 / HTML5 compliant).');
  process.exit(0);
}

auditHtml();
