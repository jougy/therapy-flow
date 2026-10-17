#!/usr/bin/env node
/**
 * Vault Modularizer & Kanban Archiver
 *
 * 1. Higieniza `Kanban de Tarefas.md` mantendo apenas os últimos 10 concluídos
 *    e arquivando os demais em `00 - Navegacao/Arquivo Kanban/Historico Concluidos.md`.
 * 2. Adiciona o card da iniciativa de Desmonolitização & Agentes Locais em `Executando agora`.
 * 3. Divide `Catalogo Mestre de Funcionalidades e Diferenciais.md` (1.743 linhas)
 *    em 5 notas modulares indexadas em `10 - Produto/00 - Hubs/Catalogo Modulos/`.
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

function processKanban() {
  const raw = fs.readFileSync(KANBAN_PATH, 'utf8');
  const lines = raw.split('\n');

  const execIdx = lines.findIndex((l) => l.trim() === '## Executando agora');
  const finIdx = lines.findIndex((l) => l.trim() === '## Finalizados');

  if (execIdx === -1 || finIdx === -1) {
    console.error('Seções do Kanban não encontradas.');
    return;
  }

  // Extract header up to ## Executando agora
  const beforeExec = lines.slice(0, execIdx + 1);
  const execSection = lines.slice(execIdx + 1, finIdx);

  // New card to insert if not already there
  const newCardTitle =
    '**Desmonolitização Indexada (Vault, Schema & Componentes) + Scripts CLI com LLM Local (Gemma4/Mimo)**';
  const hasNewCard = execSection.some((l) => l.includes('Desmonolitização Indexada'));

  const newCardLines = hasNewCard
    ? []
    : [
        '',
        `- [ ] ${newCardTitle} #origem/pedido-usuario #modulo/arquitetura #prioridade/alta`,
        `  - 📅 **Criado:** 2026-10-15 22:14 | 🔄 **Atualizado:** 2026-10-15 22:15`,
        `  - 👤 **Solicitante:** Jougy | \`jougy@gmx.com\` | ID Global: \`usr_c6cc9a79\``,
        `  - 📝 **Descrição:** Etapa 1: Arquivamento do Kanban, indexação modular do Catálogo Mestre (5 blocos), indexação por domínio do \`supabase/schema.sql\` e fatiamento dos monolitos React/TS (\`PacienteDetalhe\`, \`FeatureConfigModal\`, \`SessaoDetalhe\`, \`SelecionarClinica\`, \`tutorial-registry\`, \`anamnesis\`). Etapa 2: Criação de scripts \`.sh\`/\`.mjs\` integrados ao \`gemma4:cloud\` e \`mimo\` para buscas e resumos com custo mínimo de tokens.`,
        `  - 🔗 **Referência:** [[Codex Brain]] | [[Regras de Uso do Kanban]]`,
      ];

  // Parse all completed cards after first `## Finalizados`
  const afterFin = lines.slice(finIdx + 1);
  const completedCards = [];
  let currentCard = null;

  for (const line of afterFin) {
    if (line.trim() === '## Finalizados') continue; // skip duplicate headers
    if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
      if (currentCard) completedCards.push(currentCard);
      currentCard = [line];
    } else if (currentCard) {
      currentCard.push(line);
    }
  }
  if (currentCard) completedCards.push(currentCard);

  const keepCards = completedCards.slice(0, 10);
  const archiveCards = completedCards.slice(10);

  // Write archive
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

  if (archiveCards.length > 0) {
    const archiveBody = archiveCards.map((c) => c.join('\n').trimEnd()).join('\n\n');
    fs.writeFileSync(KANBAN_ARCHIVE_FILE, existingArchive.trimEnd() + '\n\n' + archiveBody + '\n', 'utf8');
  }

  const newKanban = [
    ...beforeExec,
    ...newCardLines,
    ...execSection,
    '## Finalizados',
    '',
    '> 💡 *Apenas as 10 entregas mais recentes são exibidas aqui para economia de tokens. Para entregas anteriores, consulte [[Historico Concluidos]].*',
    '',
    ...keepCards.map((c) => c.join('\n').trimEnd() + '\n'),
  ].join('\n');

  fs.writeFileSync(KANBAN_PATH, newKanban, 'utf8');
  console.log(
    `✅ Kanban atualizado: ${keepCards.length} mantidos em Finalizados, ${archiveCards.length} arquivados em Historico Concluidos.md (${newKanban.split('\n').length} linhas totais).`
  );
}

function processCatalogo() {
  const raw = fs.readFileSync(CATALOGO_PATH, 'utf8');
  const lines = raw.split('\n');

  // Check if already modularized
  if (lines.length < 250) {
    console.log('ℹ️ Catálogo Mestre já está modularizado.');
    return;
  }

  fs.mkdirSync(CATALOGO_MOD_DIR, { recursive: true });

  const blockStarts = [];
  lines.forEach((line, idx) => {
    if (/^# Bloco \d+:/.test(line)) {
      blockStarts.push(idx);
    }
  });

  const blockMeta = [
    {
      file: 'Catalogo Bloco 1 - Autenticacao Publicas e Onboarding.md',
      title: 'Bloco 1: Rotas de Autenticação, Públicas e Onboarding',
      summary: 'Login (`/auth`), Cadastro Alfa, Confirmação, Redefinição de Senha, Convites, Pré-cadastro Público, Termo LGPD Menor, Onboarding e Downloads.',
    },
    {
      file: 'Catalogo Bloco 2 - Entrada e Gestao da Clinica.md',
      title: 'Bloco 2: Área de Entrada e Gestão da Clínica',
      summary: 'Espaço Pessoal (`/espacopessoal`), Home da Clínica (`/clinica/:clinicKey`), Triagem, Agenda Diária e Dashboard Analítico.',
    },
    {
      file: 'Catalogo Bloco 3 - Nucleo Clinico Pacientes e Atendimentos.md',
      title: 'Bloco 3: Núcleo Clínico — Pacientes, Prontuário e Atendimentos',
      summary: 'Cadastro Rápido, Prontuário Unificado (`PacienteDetalhe`), Resumo Versionado, Ficha Cadastral 8 abas, Dashboard de Anamnese e Sessão SOAP (`SessaoDetalhe`).',
    },
    {
      file: 'Catalogo Bloco 4 - Parametrizacao Formularios e Monetizacao.md',
      title: 'Bloco 4: Parametrização Clínica, Formulários e Monetização',
      summary: 'Construtor de Formulários, Biblioteca Comunitária, Configurações da Clínica/RBAC, Planos e Checkout Transparente Asaas.',
    },
    {
      file: 'Catalogo Bloco 5 - Backoffice Master Platform Admin.md',
      title: 'Bloco 5: Backoffice Master / Platform Admin (`/platform/*`)',
      summary: 'MFA isolado, Diretório Global, Gestão Master de Clínicas/Usuários/Pacientes, Moderação de Formulários, Feedbacks, Flags, Governança e Faturamento.',
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

  // Keep header + route table (lines 0 to blockStarts[0] - 1)
  const headerAndTable = lines.slice(0, blockStarts[0]).join('\n').trimEnd();

  const indexContent = [
    headerAndTable,
    '',
    '## 🧩 Módulos Detalhados (Arquitetura Indexada para Economia de Tokens)',
    '',
    '> **Diretriz para Agentes de IA:** Para evitar leitura de textos longos desnecessários, abra **apenas** o bloco correspondente ao escopo da sua tarefa:',
    '',
    ...blockMeta.map(
      (m, idx) =>
        `${idx + 1}. **[[${m.file.replace('.md', '')}|${m.title}]]**\n   - *Escopo:* ${m.summary}`
    ),
    '',
  ].join('\n');

  fs.writeFileSync(CATALOGO_PATH, indexContent, 'utf8');
  console.log(
    `✅ Catálogo Mestre indexado: reduzido de ${lines.length} linhas para ${indexContent.split('\n').length} linhas + 5 blocos em 'Catalogo Modulos/'.`
  );
}

processKanban();
processCatalogo();
