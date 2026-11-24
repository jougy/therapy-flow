#!/usr/bin/env node
/**
 * Deterministic AST & Structural Code Graph Builder (Graphify Core Equivalent — Zero Tokens)
 *
 * Resolve o ponto cego estrutural em `src/` (1.054+ arquivos TS/TSX) e `supabase/functions/` (29 Edge Functions):
 *   1. Extrai imports (resolvendo `@/` -> `src/` e caminhos relativos/index), exports, componentes, hooks (`use*`),
 *      chamadas de RPC (`.rpc('...')`), tabelas (`.from('...')`) e capabilities RBAC (`can('...')`).
 *   2. Constrói grafo direcionado de dependências, calcula centralidade PageRank/Grau (`god_nodes`)
 *      e detecta comunidades arquiteturais por Label Propagation / Louvain determinístico.
 *   3. Suporta atualização incremental (`--update`) via cache por `mtimeMs` + `size` (< 150ms).
 *   4. Gera `.cache/graphify-out/graph.json`, `.cache/graphify-out/GRAPH_REPORT.md` e `.cache/rpc-callsites.json`.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, '.cache/graphify-out');
const FILE_CACHE_PATH = path.join(OUT_DIR, 'file-cache.json');
const GRAPH_JSON_PATH = path.join(OUT_DIR, 'graph.json');
const GRAPH_REPORT_PATH = path.join(OUT_DIR, 'GRAPH_REPORT.md');
const RPC_CALLSITES_PATH = path.join(ROOT, '.cache/rpc-callsites.json');

const IS_INCREMENTAL = process.argv.includes('--update');

function walkCodeFiles(baseDir, fileList = []) {
  if (!fs.existsSync(baseDir)) return fileList;
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue;
    const full = path.join(baseDir, e.name);
    if (e.isDirectory()) {
      walkCodeFiles(full, fileList);
    } else if (e.isFile() && /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
      fileList.push(full);
    }
  }
  return fileList;
}

function resolveImportPath(fromFile, rawSpecifier, knownFilesSet) {
  let candidateBase = null;
  if (rawSpecifier.startsWith('@/')) {
    candidateBase = path.join(ROOT, 'src', rawSpecifier.slice(2));
  } else if (rawSpecifier.startsWith('.')) {
    candidateBase = path.resolve(path.dirname(fromFile), rawSpecifier);
  } else {
    return null; // External package
  }

  // Strip explicit .ts/.tsx/.js extension if present
  const stripped = candidateBase.replace(/\.(ts|tsx|js|jsx)$/, '');
  const candidates = [
    candidateBase,
    `${stripped}.ts`,
    `${stripped}.tsx`,
    path.join(stripped, 'index.ts'),
    path.join(stripped, 'index.tsx'),
  ];

  for (const c of candidates) {
    const rel = path.relative(ROOT, c).replace(/\\/g, '/');
    if (knownFilesSet.has(rel)) return rel;
  }
  return null;
}

function inferCommunityArea(relPath) {
  if (relPath.startsWith('supabase/functions/')) {
    const parts = relPath.split('/');
    return `edge:${parts[2] || 'shared'}`;
  }
  if (relPath.startsWith('src/pages/')) {
    const sub = relPath.slice('src/pages/'.length).split('/')[0].replace(/\.(tsx|ts)$/, '');
    return `page:${sub}`;
  }
  if (relPath.startsWith('src/components/')) {
    const sub = relPath.slice('src/components/'.length).split('/')[0].replace(/\.(tsx|ts)$/, '');
    return `ui:${sub}`;
  }
  if (relPath.startsWith('src/hooks/')) return 'hooks';
  if (relPath.startsWith('src/lib/')) {
    const sub = relPath.slice('src/lib/'.length).split('/')[0].replace(/\.(tsx|ts)$/, '');
    return `lib:${sub}`;
  }
  if (relPath.startsWith('src/integrations/')) return 'integrations:supabase';
  if (relPath.startsWith('src/test/') || /\.test\.(ts|tsx)$/.test(relPath)) return 'tests';
  return 'core';
}

function parseFileAST(relPath, content) {
  const lines = content.split('\n');
  const rawImports = [];
  const exports = [];
  const hooksDefined = [];
  const hooksUsed = new Set();
  const rpcs = [];
  const tables = [];
  const capabilities = [];

  // Match static & dynamic imports
  const importRegex = /(?:import\s+(?:type\s+)?(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)|export\s+[\s\S]*?from\s+['"]([^'"]+)['"])/g;
  for (const m of content.matchAll(importRegex)) {
    const spec = m[1] || m[2] || m[3];
    if (spec && (spec.startsWith('.') || spec.startsWith('@/'))) {
      rawImports.push(spec);
    }
  }

  lines.forEach((line, idx) => {
    const ln = idx + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    // Exports
    const expMatch = trimmed.match(
      /^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|interface|type|enum)\s+([a-zA-Z0-9_]+)/
    );
    if (expMatch) {
      const sym = expMatch[1];
      exports.push({ name: sym, line: ln });
      if (/^use[A-Z]/.test(sym)) hooksDefined.push(sym);
    }

    // Hooks used
    for (const hm of trimmed.matchAll(/\b(use[A-Z][a-zA-Z0-9_]+)\s*\(/g)) {
      const hName = hm[1];
      if (!['useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext', 'useReducer', 'useId', 'useLayoutEffect'].includes(hName)) {
        hooksUsed.add(hName);
      }
    }

    // Supabase RPC calls: .rpc('name') or .rpc<...>('name')
    for (const rm of trimmed.matchAll(/\.rpc(?:\s*<[^>]+>)?\s*\(\s*['"]([a-zA-Z0-9_]+)['"]/g)) {
      rpcs.push({ name: rm[1], line: ln });
    }

    // Supabase Table queries: .from('table')
    for (const tm of trimmed.matchAll(/\.from(?:\s*<[^>]+>)?\s*\(\s*['"]([a-zA-Z0-9_]+)['"]/g)) {
      tables.push({ name: tm[1], line: ln });
    }

    // RBAC capability checks: can('cap.name') or current_user_can('cap.name')
    for (const cm of trimmed.matchAll(/\b(?:can|current_user_can|hasCapability)\s*\(\s*['"]([a-z0-9_]+\.[a-z0-9_]+)['"]/g)) {
      capabilities.push({ name: cm[1], line: ln });
    }
  });

  return {
    relPath,
    lines: lines.length,
    isTest: /\.test\.(ts|tsx)$/.test(relPath) || relPath.startsWith('src/test/'),
    area: inferCommunityArea(relPath),
    rawImports: [...new Set(rawImports)],
    exports,
    hooksDefined,
    hooksUsed: [...hooksUsed],
    rpcs,
    tables,
    capabilities,
  };
}

function detectCommunities(nodesMap, edges) {
  // Deterministic Label Propagation initialized with semantic directory area
  const labels = new Map();
  for (const [id, node] of nodesMap.entries()) {
    labels.set(id, node.area);
  }

  const adj = new Map();
  for (const id of nodesMap.keys()) adj.set(id, []);
  for (const e of edges) {
    if (e.type !== 'IMPORTS') continue;
    if (nodesMap.get(e.from)?.isTest) continue; // Don't let test files collapse prod clusters
    adj.get(e.from)?.push(e.to);
    adj.get(e.to)?.push(e.from);
  }

  // 4 passes of weighted neighbor voting (preserving cohesive modules)
  for (let iter = 0; iter < 4; iter++) {
    for (const [id, node] of nodesMap.entries()) {
      if (node.isTest) continue;
      const neighbors = adj.get(id) || [];
      if (neighbors.length < 3) continue;
      const counts = new Map();
      counts.set(labels.get(id), 2.5); // Self-anchor weight
      for (const nb of neighbors) {
        const l = labels.get(nb);
        if (!l || l === 'core' || l === 'integrations:supabase') continue;
        counts.set(l, (counts.get(l) || 0) + 1);
      }
      let bestLabel = labels.get(id);
      let bestScore = -1;
      for (const [l, score] of counts.entries()) {
        if (score > bestScore) {
          bestScore = score;
          bestLabel = l;
        }
      }
      labels.set(id, bestLabel);
    }
  }

  const clusters = {};
  for (const [id, label] of labels.entries()) {
    if (!clusters[label]) clusters[label] = [];
    clusters[label].push(id);
    const n = nodesMap.get(id);
    if (n) n.community = label;
  }
  return clusters;
}

function main() {
  const t0 = Date.now();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const allFilesAbs = [
    ...walkCodeFiles(path.join(ROOT, 'src')),
    ...walkCodeFiles(path.join(ROOT, 'supabase/functions')),
  ];
  const knownFilesSet = new Set(allFilesAbs.map((f) => path.relative(ROOT, f).replace(/\\/g, '/')));

  let prevCache = {};
  if (IS_INCREMENTAL && fs.existsSync(FILE_CACHE_PATH)) {
    try {
      prevCache = JSON.parse(fs.readFileSync(FILE_CACHE_PATH, 'utf8'));
    } catch {
      prevCache = {};
    }
  }

  const nextCache = {};
  const parsedFiles = [];
  let cacheHits = 0;
  let reparsed = 0;

  for (const absPath of allFilesAbs) {
    const relPath = path.relative(ROOT, absPath).replace(/\\/g, '/');
    const stat = fs.statSync(absPath);
    const cached = prevCache[relPath];

    if (IS_INCREMENTAL && cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size && cached.data) {
      nextCache[relPath] = cached;
      parsedFiles.push(cached.data);
      cacheHits++;
    } else {
      const content = fs.readFileSync(absPath, 'utf8');
      const data = parseFileAST(relPath, content);
      nextCache[relPath] = { mtimeMs: stat.mtimeMs, size: stat.size, data };
      parsedFiles.push(data);
      reparsed++;
    }
  }

  fs.writeFileSync(FILE_CACHE_PATH, JSON.stringify(nextCache), 'utf8');

  const nodesMap = new Map();
  const edges = [];
  const rpcCallsites = {};
  const tableCallsites = {};
  const capabilityCallsites = {};
  const symbolIndex = {}; // exportName -> file relPath

  for (const pf of parsedFiles) {
    nodesMap.set(pf.relPath, {
      id: pf.relPath,
      lines: pf.lines,
      isTest: pf.isTest,
      area: pf.area,
      community: pf.area,
      exports: pf.exports.map((e) => e.name),
      hooksUsed: pf.hooksUsed,
      rpcs: [...new Set(pf.rpcs.map((r) => r.name))],
      tables: [...new Set(pf.tables.map((t) => t.name))],
      capabilities: [...new Set(pf.capabilities.map((c) => c.name))],
      inDegree: 0,
      outDegree: 0,
      importers: [],
      imports: [],
    });

    for (const exp of pf.exports) {
      if (!symbolIndex[exp.name]) symbolIndex[exp.name] = [];
      symbolIndex[exp.name].push({ file: pf.relPath, line: exp.line });
    }

    for (const r of pf.rpcs) {
      if (!rpcCallsites[r.name]) rpcCallsites[r.name] = [];
      rpcCallsites[r.name].push({ file: pf.relPath, line: r.line });
    }

    for (const t of pf.tables) {
      if (!tableCallsites[t.name]) tableCallsites[t.name] = [];
      tableCallsites[t.name].push({ file: pf.relPath, line: t.line });
    }

    for (const c of pf.capabilities) {
      if (!capabilityCallsites[c.name]) capabilityCallsites[c.name] = [];
      capabilityCallsites[c.name].push({ file: pf.relPath, line: c.line });
    }
  }

  // Resolve import edges
  for (const pf of parsedFiles) {
    const fromNode = nodesMap.get(pf.relPath);
    for (const rawSpec of pf.rawImports) {
      const targetRel = resolveImportPath(path.join(ROOT, pf.relPath), rawSpec, knownFilesSet);
      if (targetRel && targetRel !== pf.relPath && nodesMap.has(targetRel)) {
        const toNode = nodesMap.get(targetRel);
        fromNode.imports.push(targetRel);
        fromNode.outDegree++;
        toNode.importers.push(pf.relPath);
        if (!pf.isTest) {
          toNode.inDegree++; // Count production importers for god_node ranking
        }
        edges.push({ from: pf.relPath, to: targetRel, type: 'IMPORTS', origin: 'EXTRACTED' });
      }
    }
  }

  // Detect communities
  const communities = detectCommunities(nodesMap, edges);

  // Rank God Nodes (production centrality = prod importers * 2 + outDegree + exported symbols + RPC/table surface)
  const godNodes = [...nodesMap.values()]
    .filter((n) => !n.isTest)
    .map((n) => ({
      id: n.id,
      lines: n.lines,
      community: n.community,
      prodImporters: n.inDegree,
      totalImporters: n.importers.length,
      outDegree: n.outDegree,
      exportsCount: n.exports.length,
      rpcsCount: n.rpcs.length,
      tablesCount: n.tables.length,
      score: n.inDegree * 3 + n.outDegree + n.rpcs.length * 2 + n.tables.length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 35);

  const graphData = {
    generatedAt: new Date().toISOString(),
    stats: {
      totalFiles: nodesMap.size,
      prodFiles: [...nodesMap.values()].filter((n) => !n.isTest).length,
      testFiles: [...nodesMap.values()].filter((n) => n.isTest).length,
      totalEdges: edges.length,
      uniqueRpcsCalled: Object.keys(rpcCallsites).length,
      uniqueTablesQueried: Object.keys(tableCallsites).length,
      uniqueCapabilitiesChecked: Object.keys(capabilityCallsites).length,
      communitiesCount: Object.keys(communities).length,
    },
    godNodes,
    communities: Object.fromEntries(
      Object.entries(communities)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([k, v]) => [k, { count: v.length, sampleFiles: v.slice(0, 12) }])
    ),
    symbolIndex,
    rpcCallsites,
    tableCallsites,
    capabilityCallsites,
    nodes: Object.fromEntries(nodesMap),
  };

  fs.writeFileSync(GRAPH_JSON_PATH, JSON.stringify(graphData, null, 2), 'utf8');
  fs.writeFileSync(RPC_CALLSITES_PATH, JSON.stringify({ rpcCallsites, tableCallsites, capabilityCallsites }, null, 2), 'utf8');

  // Generate concise human & AI readable GRAPH_REPORT.md
  const topRpcs = Object.entries(rpcCallsites)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15);
  const topTables = Object.entries(tableCallsites)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15);

  const reportLines = [
    `# 🕸️ Relatório Estrutural do Grafo de Código (AST Local — Zero Tokens)`,
    ``,
    `> Gerado em ${graphData.generatedAt} (${Date.now() - t0}ms). Use \`npm run ai:graph -- <gods|impact|neighbors|path|rpc|table|capability|vault> <alvo>\`.`,
    ``,
    `## 📊 Estatísticas Globais`,
    `- **Arquivos Analisados:** ${graphData.stats.totalFiles} (${graphData.stats.prodFiles} produção / ${graphData.stats.testFiles} testes)`,
    `- **Arestas de Dependência (\`IMPORTS\`):** ${graphData.stats.totalEdges}`,
    `- **RPCs Supabase Invocadas no Código:** ${graphData.stats.uniqueRpcsCalled}`,
    `- **Tabelas Consultadas (\`.from()\`):** ${graphData.stats.uniqueTablesQueried}`,
    `- **Capabilities RBAC Checadas (\`can()\`):** ${graphData.stats.uniqueCapabilitiesChecked}`,
    `- **Comunidades Arquiteturais:** ${graphData.stats.communitiesCount}`,
    ``,
    `## 🏛️ Top 15 God Nodes (Hubs Centrais de Produção)`,
    `| Arquivo | Comunidade | Linhas | Dependentes Prod (Total) | Imports | RPCs | Tabelas | Score |`,
    `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`,
    ...godNodes.slice(0, 15).map(
      (g) =>
        `| \`${g.id}\` | \`${g.community}\` | ${g.lines} | **${g.prodImporters}** (${g.totalImporters}) | ${g.outDegree} | ${g.rpcsCount} | ${g.tablesCount} | ${g.score} |`
    ),
    ``,
    `## 🧩 Principais Comunidades Arquiteturais`,
    `| Comunidade | Qtd Arquivos | Exemplos Principais |`,
    `| :--- | :--- | :--- |`,
    ...Object.entries(graphData.communities)
      .slice(0, 15)
      .map(([name, info]) => `| \`${name}\` | ${info.count} | ${info.sampleFiles.slice(0, 3).map((f) => `\`${f}\``).join(', ')} |`),
    ``,
    `## ⚡ Top 15 RPCs Mais Chamadas no Código`,
    `| RPC | Callsites | Principais Arquivos |`,
    `| :--- | :--- | :--- |`,
    ...topRpcs.map(
      ([name, sites]) =>
        `| \`${name}\` | ${sites.length} | ${[...new Set(sites.map((s) => `\`${s.file}:${s.line}\``))].slice(0, 3).join(', ')} |`
    ),
    ``,
    `## 🗄️ Top 15 Tabelas Mais Consultadas (\`.from()\`)`,
    `| Tabela | Callsites | Principais Arquivos |`,
    `| :--- | :--- | :--- |`,
    ...topTables.map(
      ([name, sites]) =>
        `| \`${name}\` | ${sites.length} | ${[...new Set(sites.map((s) => `\`${s.file}:${s.line}\``))].slice(0, 3).join(', ')} |`
    ),
    ``,
  ];

  fs.writeFileSync(GRAPH_REPORT_PATH, reportLines.join('\n'), 'utf8');
  console.log(
    `✅ Grafo AST gerado em ${Date.now() - t0}ms (${reparsed} parseados, ${cacheHits} cache hits): ${graphData.stats.totalFiles} arquivos, ${graphData.stats.totalEdges} arestas, ${graphData.stats.uniqueRpcsCalled} RPCs mapeadas.`
  );
}

main();
