#!/usr/bin/env node
/**
 * Vault Modularizer & Kanban Archiver (Section-Aware & Deduplicating)
 *
 * 1. Higieniza `Kanban de Tarefas.md` preservando todas as colunas do board
 *    (`Executando agora`, `Finalizados`, `Canceladas`, `Ideias não iniciadas`, `Pedidos de melhorias`)
 *    e o bloco `%% kanban:settings`.
 * 2. Consolida seções `## Finalizados` duplicadas, deduplica cards concluídos,
 *    mantém apenas os 10 mais recentes no Kanban ativo e arquiva os demais em
 *    `00 - Navegacao/Arquivo Kanban/Historico Concluidos.md`.
 * 3. Mantém `Catalogo Mestre de Funcionalidades e Diferenciais.md` modularizado em 5 blocos.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const KANBAN_PATH = path.join(ROOT, 'core/Pluri-Health/00 - Navegacao/Kanban de Tarefas.md');
const KANBAN_ARCHIVE_DIR = path.join(ROOT, 'core/Pluri-Health/00 - Navegacao/Arquivo Kanban');
const KANBAN_ARCHIVE_FILE = path.join(KANBAN_ARCHIVE_DIR, 'Historico Concluidos.md');

const CATALOGO_PATH = path.join(
  ROOT,
  'core/Pluri-Health/10 - Produto/00 - Hubs/Catalogo Mestre de Funcionalidades e Diferenciais.md'
);
const CATALOGO_MOD_DIR = path.join(ROOT, 'core/Pluri-Health/10 - Produto/00 - Hubs/Catalogo Modulos');

function extractCardKey(cardLines) {
  const first = (cardLines[0] || '').trim();
  const match = first.match(/\*\*(.+?)\*\*/);
  if (match) return match[1].trim().toLowerCase();
  return first.replace(/^- \[[ xX]\]\s*/, '').trim().toLowerCase();
}

function parseCardsFromLines(sectionLines) {
  const cards = [];
  let current = null;
  for (const line of sectionLines) {
    if (line.startsWith('%% kanban:settings')) break;
    if (/^- \[[ xX]\] /.test(line)) {
      if (current) cards.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) cards.push(current);
  return cards;
}

function processKanban() {
  if (!fs.existsSync(KANBAN_PATH)) {
    console.error('Kanban não encontrado:', KANBAN_PATH);
    return;
  }

  const raw = fs.readFileSync(KANBAN_PATH, 'utf8');
  const lines = raw.split('\n');

  // Extract footer settings block if present
  const settingsIdx = lines.findIndex((l) => l.startsWith('%% kanban:settings'));
  const footerLines =
    settingsIdx !== -1
      ? lines.slice(settingsIdx)
      : ['%% kanban:settings', '```', '{"kanban-plugin":"board"}', '```', '%%'];
  const contentLines = settingsIdx !== -1 ? lines.slice(0, settingsIdx) : lines;

  // Parse into sections by `## `
  const headerLines = [];
  const sections = [];
  let currentSection = null;

  for (const line of contentLines) {
    if (line.startsWith('## ')) {
      const title = line.replace(/^##\s+/, '').trim();
      if (title.startsWith('📋')) {
        headerLines.push(line);
        continue;
      }
      if (currentSection) sections.push(currentSection);
      currentSection = { title, lines: [] };
    } else {
      if (currentSection) {
        currentSection.lines.push(line);
      } else {
        headerLines.push(line);
      }
    }
  }
  if (currentSection) sections.push(currentSection);

  const executingCards = [];
  const completedCards = [];
  const canceledCards = [];
  const ideasCards = [];
  const improvementsCards = [];

  for (const sec of sections) {
    const t = sec.title.toLowerCase();
    const cards = parseCardsFromLines(sec.lines);
    if (t.includes('executando')) {
      executingCards.push(...cards);
    } else if (t.includes('finalizado')) {
      for (const card of cards) {
        if (/^- \[[xX]\] /.test(card[0])) {
          completedCards.push(card);
        } else {
          // Cards `- [ ]` que estavam acidentalmente dentro de Finalizados
          const text = card.join('\n');
          if (text.includes('100% implementadas') || text.includes('Desmonolitização Indexada')) {
            card[0] = card[0].replace(/^- \[ \] /, '- [x] ');
            completedCards.push(card);
          } else {
            ideasCards.push(card);
          }
        }
      }
    } else if (t.includes('cancelada')) {
      canceledCards.push(...cards);
    } else if (t.includes('ideia')) {
      ideasCards.push(...cards);
    } else if (t.includes('melhoria')) {
      improvementsCards.push(...cards);
    }
  }

  // Deduplicate helper
  function dedupCards(list) {
    const seen = new Set();
    const out = [];
    for (const c of list) {
      const k = extractCardKey(c);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      // Trim trailing blank lines
      while (c.length > 1 && c[c.length - 1].trim() === '') c.pop();
      out.push(c);
    }
    return out;
  }

  const uniqueExecuting = dedupCards(executingCards);
  const uniqueCompleted = dedupCards(completedCards);
  const uniqueCanceled = dedupCards(canceledCards);
  const uniqueIdeas = dedupCards(ideasCards);
  const uniqueImprovements = dedupCards(improvementsCards);

  const keepCompleted = uniqueCompleted.slice(0, 10);
  const archiveCompleted = uniqueCompleted.slice(10);

  // Update archive file deduplicating against existing archive
  fs.mkdirSync(KANBAN_ARCHIVE_DIR, { recursive: true });
  let existingArchive = '';
  if (fs.existsSync(KANBAN_ARCHIVE_FILE)) {
    existingArchive = fs.readFileSync(KANBAN_ARCHIVE_FILE, 'utf8');
  } else {
    existingArchive = [
      '---',
      'tags:',
      '  - kanban',
      '  - arquivo',
      '  - historico',
      'kind: kanban-archive',
      'area: governanca',
      '---',
      '',
      '# 📦 Histórico de Tarefas Concluídas (Arquivo do Kanban)',
      '',
      '> Arquivo histórico automático para manter o [[Kanban de Tarefas]] enxuto (regra dos últimos 10 concluídos).',
      '',
      '## Finalizados Arquivados',
      '',
    ].join('\n');
  }

  const newToArchive = archiveCompleted.filter((c) => {
    const key = extractCardKey(c);
    return key && !existingArchive.toLowerCase().includes(key);
  });

  if (newToArchive.length > 0) {
    const archiveBody = newToArchive.map((c) => c.join('\n').trimEnd()).join('\n\n');
    fs.writeFileSync(KANBAN_ARCHIVE_FILE, existingArchive.trimEnd() + '\n\n' + archiveBody + '\n', 'utf8');
  }

  const formatSection = (cards) =>
    cards.length > 0 ? cards.map((c) => c.join('\n').trimEnd()).join('\n\n') + '\n' : '';

  const newKanban = [
    headerLines.join('\n').trimEnd(),
    '',
    '## Executando agora',
    '',
    formatSection(uniqueExecuting),
    '## Finalizados',
    '',
    '> 💡 *Apenas as 10 entregas mais recentes são exibidas aqui para economia de tokens. Para entregas anteriores, consulte [[Historico Concluidos]].*',
    '',
    formatSection(keepCompleted),
    '## Canceladas',
    '',
    formatSection(uniqueCanceled),
    '## Ideias não iniciadas',
    '',
    formatSection(uniqueIdeas),
    '## Pedidos de melhorias',
    '',
    formatSection(uniqueImprovements),
    '',
    footerLines.join('\n').trimEnd(),
    '',
  ].join('\n');

  fs.writeFileSync(KANBAN_PATH, newKanban, 'utf8');
  console.log(
    `✅ Kanban higienizado: ${keepCompleted.length} em Finalizados (${newToArchive.length} novos arquivados), ${uniqueCanceled.length} Canceladas, ${uniqueIdeas.length} Ideias, ${uniqueImprovements.length} Melhorias (${newKanban.split('\n').length} linhas / ${Buffer.byteLength(newKanban, 'utf8')} bytes).`
  );
}

function processCatalogo() {
  if (!fs.existsSync(CATALOGO_PATH)) return;
  const raw = fs.readFileSync(CATALOGO_PATH, 'utf8');
  const lines = raw.split('\n');

  if (lines.length < 250) {
    console.log('ℹ️ Catálogo Mestre já está modularizado.');
    return;
  }

  fs.mkdirSync(CATALOGO_MOD_DIR, { recursive: true });
  const blockStarts = [];
  lines.forEach((line, idx) => {
    if (/^# Bloco \d+:/.test(line)) blockStarts.push(idx);
  });

  const blockMeta = [
    {
      file: 'Catalogo Bloco 1 - Autenticacao Publicas e Onboarding.md',
      title: 'Bloco 1: Rotas de Autenticação, Públicas e Onboarding',
      summary:
        'Login (`/auth`), Cadastro Alfa, Confirmação, Redefinição de Senha, Convites, Pré-cadastro Público, Termo LGPD Menor, Onboarding e Downloads.',
    },
    {
      file: 'Catalogo Bloco 2 - Entrada e Gestao da Clinica.md',
      title: 'Bloco 2: Área de Entrada e Gestão da Clínica',
      summary:
        'Espaço Pessoal (`/espacopessoal`), Home da Clínica (`/clinica/:clinicKey`), Triagem, Agenda Diária e Dashboard Analítico.',
    },
    {
      file: 'Catalogo Bloco 3 - Nucleo Clinico Pacientes e Atendimentos.md',
      title: 'Bloco 3: Núcleo Clínico — Pacientes, Prontuário e Atendimentos',
      summary:
        'Cadastro Rápido, Prontuário Unificado (`PacienteDetalhe`), Resumo Versionado, Ficha Cadastral 8 abas, Dashboard de Anamnese e Sessão SOAP (`SessaoDetalhe`).',
    },
    {
      file: 'Catalogo Bloco 4 - Parametrizacao Formularios e Monetizacao.md',
      title: 'Bloco 4: Parametrização Clínica, Formulários e Monetização',
      summary:
        'Construtor de Formulários, Biblioteca Comunitária, Configurações da Clínica/RBAC, Planos e Checkout Transparente Asaas.',
    },
    {
      file: 'Catalogo Bloco 5 - Backoffice Master Platform Admin.md',
      title: 'Bloco 5: Backoffice Master / Platform Admin (`/platform/*`)',
      summary:
        'MFA isolado, Diretório Global, Gestão Master de Clínicas/Usuários/Pacientes, Moderação de Formulários, Feedbacks, Flags, Governança e Faturamento.',
    },
  ];

  for (let b = 0; b < blockStarts.length; b++) {
    const start = blockStarts[b];
    const end = b + 1 < blockStarts.length ? blockStarts[b + 1] : lines.length;
    const chunk = lines.slice(start, end).join('\n').trim();
    const meta = blockMeta[b];
    if (!meta) continue;

    const noteContent = [
      '---',
      'tags:',
      '  - produto',
      '  - catalogo-mestre',
      `  - bloco-${b + 1}`,
      'kind: catalogo-modulo',
      'area: produto',
      '---',
      '',
      `> 🔙 Parte integrante do [[Catalogo Mestre de Funcionalidades e Diferenciais]]`,
      '',
      chunk,
      '',
    ].join('\n');

    fs.writeFileSync(path.join(CATALOGO_MOD_DIR, meta.file), noteContent, 'utf8');
  }

  const headerAndTable = lines.slice(0, blockStarts[0]).join('\n').trimEnd();
  const indexContent = [
    headerAndTable,
    '',
    '## 🧩 Módulos Detalhados (Arquitetura Indexada para Economia de Tokens)',
    '',
    '> **Diretriz para Agentes de IA:** Para evitar leitura de textos longos desnecessários, abra **apenas** o bloco correspondente ao escopo da sua tarefa:',
    '',
    ...blockMeta.map(
      (m, idx) => `${idx + 1}. **[[${m.file.replace('.md', '')}|${m.title}]]**\n   - *Escopo:* ${m.summary}`
    ),
    '',
  ].join('\n');

  fs.writeFileSync(CATALOGO_PATH, indexContent, 'utf8');
}

processKanban();
processCatalogo();
