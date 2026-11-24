#!/usr/bin/env node
/**
 * Deterministic Obsidian Vault Graph & Code/Schema Bridge (Zero Tokens, < 100ms)
 *
 * Constrói o grafo estrutural da Vault (`core/Pluri-Health`) sem gastar 1 token de LLM:
 *   1. Extrai frontmatter (`tags`, `aliases`, `kind`, `area`), headings H1/H2 e `[[wikilinks]]`.
 *   2. Calcula `backlinks` bidirecionais e centralidade das notas (hubs de conhecimento).
 *   3. Extrai referências explícitas a código (`src/...`, `supabase/...`, componentes `.tsx/.ts`,
 *      tabelas, RPCs e capabilities `modulo.acao`) criando a ponte `.cache/vault-code-bridge.json`.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const VAULT_DIR = path.join(ROOT, 'core/Pluri-Health');
const CACHE_DIR = path.join(ROOT, '.cache');
const VAULT_GRAPH_PATH = path.join(CACHE_DIR, 'vault-graph.json');
const VAULT_BRIDGE_PATH = path.join(CACHE_DIR, 'vault-code-bridge.json');

function walkVaultMd(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'Arquivo Kanban') continue; // Ignora histórico morto para manter grafo limpo
      walkVaultMd(full, list);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      list.push(full);
    }
  }
  return list;
}

function parseFrontmatter(content) {
  const tags = [];
  const aliases = [];
  let kind = '';
  let area = '';

  if (!content.startsWith('---')) return { tags, aliases, kind, area };
  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) return { tags, aliases, kind, area };

  const fmLines = content.slice(3, endIdx).split('\n');
  let mode = null;
  for (const raw of fmLines) {
    const line = raw.trim();
    if (/^tags\s*:/.test(line)) {
      mode = 'tags';
      const inline = line.replace(/^tags\s*:\s*/, '').trim();
      if (inline.startsWith('[')) {
        inline
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean)
          .forEach((t) => tags.push(t));
      }
      continue;
    }
    if (/^aliases\s*:/.test(line)) {
      mode = 'aliases';
      continue;
    }
    if (/^kind\s*:/.test(line)) {
      mode = null;
      kind = line.replace(/^kind\s*:\s*/, '').trim();
      continue;
    }
    if (/^area\s*:/.test(line)) {
      mode = null;
      area = line.replace(/^area\s*:\s*/, '').trim();
      continue;
    }
    if (/^[a-zA-Z0-9_-]+\s*:/.test(line)) {
      mode = null;
      continue;
    }
    if (line.startsWith('- ')) {
      const val = line.slice(2).trim().replace(/^['"]|['"]$/g, '');
      if (mode === 'tags' && val) tags.push(val);
      if (mode === 'aliases' && val) aliases.push(val);
    }
  }
  return { tags, aliases, kind, area };
}

function main() {
  const t0 = Date.now();
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const mdFiles = walkVaultMd(VAULT_DIR);
  const notes = {};
  const aliasToNote = {};

  for (const absPath of mdFiles) {
    const relPath = path.relative(VAULT_DIR, absPath).replace(/\\/g, '/');
    const basename = path.basename(absPath, '.md');
    const content = fs.readFileSync(absPath, 'utf8');
    const lines = content.split('\n');
    const fm = parseFrontmatter(content);

    const headings = lines
      .filter((l) => /^#{1,2}\s+/.test(l))
      .map((l) => l.replace(/^#{1,2}\s+/, '').trim())
      .slice(0, 12);

    // Extract [[wikilinks]]
    const wikilinks = [];
    for (const m of content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) {
      const target = m[1].trim();
      if (target) wikilinks.push(target);
    }

    // Extract code paths (`src/...`, `supabase/...`, or `ComponentName.tsx`)
    const codeRefs = new Set();
    for (const m of content.matchAll(/\b((?:src|supabase|scripts|infra)\/[a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)\b/g)) {
      codeRefs.add(m[1]);
    }
    for (const m of content.matchAll(/`([A-Z][a-zA-Z0-9_]+\.tsx|[a-zA-Z0-9_-]+\.ts)`/g)) {
      codeRefs.add(m[1]);
    }

    // Extract capability mentions (`domain.action`)
    const capRefs = new Set();
    for (const m of content.matchAll(/`((?:patients|session|sessions|clinic|team|finance|forms|agenda|marketing|platform)\.[a-z0-9_]+)`/g)) {
      capRefs.add(m[1]);
    }

    notes[basename] = {
      title: basename,
      relPath,
      lines: lines.length,
      tags: fm.tags,
      aliases: fm.aliases,
      kind: fm.kind,
      area: fm.area,
      headings,
      outLinks: [...new Set(wikilinks)],
      backlinks: [],
      codeRefs: [...codeRefs],
      capRefs: [...capRefs],
    };

    aliasToNote[basename.toLowerCase()] = basename;
    for (const al of fm.aliases) {
      aliasToNote[al.toLowerCase()] = basename;
    }
  }

  // Resolve backlinks
  let totalEdges = 0;
  for (const note of Object.values(notes)) {
    const resolvedOut = [];
    for (const rawTarget of note.outLinks) {
      const clean = path.basename(rawTarget).toLowerCase();
      const targetKey = aliasToNote[clean];
      if (targetKey && notes[targetKey] && targetKey !== note.title) {
        resolvedOut.push(targetKey);
        if (!notes[targetKey].backlinks.includes(note.title)) {
          notes[targetKey].backlinks.push(note.title);
        }
        totalEdges++;
      }
    }
    note.outLinks = [...new Set(resolvedOut)];
  }

  // Build reverse bridge: code file / capability -> Vault notes
  const codeToNotes = {};
  const capToNotes = {};
  for (const note of Object.values(notes)) {
    if (note.title === 'Kanban de Tarefas') continue; // Evita poluir ponte com histórico de tarefas
    for (const ref of note.codeRefs) {
      if (!codeToNotes[ref]) codeToNotes[ref] = [];
      codeToNotes[ref].push({ note: note.title, relPath: note.relPath });
    }
    for (const cap of note.capRefs) {
      if (!capToNotes[cap]) capToNotes[cap] = [];
      capToNotes[cap].push({ note: note.title, relPath: note.relPath });
    }
  }

  const hubNotes = Object.values(notes)
    .map((n) => ({
      title: n.title,
      relPath: n.relPath,
      outDegree: n.outLinks.length,
      inDegree: n.backlinks.length,
      codeRefsCount: n.codeRefs.length,
      centrality: n.backlinks.length * 2 + n.outLinks.length + n.codeRefs.length,
    }))
    .sort((a, b) => b.centrality - a.centrality)
    .slice(0, 25);

  fs.writeFileSync(
    VAULT_GRAPH_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        stats: {
          totalNotes: Object.keys(notes).length,
          totalWikiEdges: totalEdges,
          bridgedCodeFiles: Object.keys(codeToNotes).length,
          bridgedCapabilities: Object.keys(capToNotes).length,
        },
        hubNotes,
        notes,
      },
      null,
      2
    ),
    'utf8'
  );

  fs.writeFileSync(
    VAULT_BRIDGE_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), codeToNotes, capToNotes }, null, 2),
    'utf8'
  );

  console.log(
    `✅ Grafo da Vault gerado em ${Date.now() - t0}ms: ${Object.keys(notes).length} notas, ${totalEdges} wikilinks bidirecionais, ${Object.keys(codeToNotes).length} arquivos de código ancorados.`
  );
}

main();
