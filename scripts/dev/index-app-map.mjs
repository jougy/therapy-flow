#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const APP_TSX = path.join(ROOT, 'src/App.tsx');
const CACHE_DIR = path.join(ROOT, '.cache');
const OUT_FILE = path.join(CACHE_DIR, 'app-map.json');

function extractImports(content) {
  const map = new Map();
  // static imports: import Foo from './pages/Foo'
  for (const m of content.matchAll(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g)) {
    map.set(m[1], m[2]);
  }
  // lazy imports: const Foo = lazy(() => import('./pages/Foo'))
  for (const m of content.matchAll(/const\s+(\w+)\s*=\s*(?:React\.)?lazy\([^)]*import\(['"]([^'"]+)['"]\)/g)) {
    map.set(m[1], m[2]);
  }
  return map;
}

function resolveSrcFile(specifier) {
  if (!specifier) return null;
  let rel = specifier.startsWith('@/') ? specifier.replace(/^@\//, 'src/') : specifier.replace(/^\.\//, 'src/');
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const candidate = path.join(ROOT, rel + ext);
    if (fs.existsSync(candidate)) return path.relative(ROOT, candidate);
  }
  return null;
}

function scanPageSignals(fileRel) {
  if (!fileRel) return { capabilities: [], rpcs: [], tables: [], edgeFunctions: [] };
  const abs = path.join(ROOT, fileRel);
  if (!fs.existsSync(abs)) return { capabilities: [], rpcs: [], tables: [], edgeFunctions: [] };
  const text = fs.readFileSync(abs, 'utf8');
  const caps = [...new Set([...text.matchAll(/\bcan\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))];
  const rpcs = [...new Set([...text.matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))];
  const tables = [...new Set([...text.matchAll(/\.from\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))];
  const edgeFunctions = [...new Set([...text.matchAll(/functions\.invoke\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))];
  return { capabilities: caps, rpcs, tables, edgeFunctions };
}

function main() {
  if (!fs.existsSync(APP_TSX)) {
    console.error('src/App.tsx not found');
    process.exit(1);
  }
  const t0 = Date.now();
  const appContent = fs.readFileSync(APP_TSX, 'utf8');
  const imports = extractImports(appContent);
  const routes = [];

  for (const m of appContent.matchAll(/<Route\s+[^>]*path=['"]([^'"]+)['"][^>]*element=\{[^}]*<(\w+)/g)) {
    const routePath = m[1];
    const component = m[2];
    const spec = imports.get(component);
    const file = resolveSrcFile(spec);
    const signals = scanPageSignals(file);
    routes.push({
      route: routePath,
      component,
      file,
      ...signals,
    });
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), count: routes.length, routes }, null, 2));
  console.log(`✅ app-map.json: ${routes.length} rotas indexadas em ${Date.now() - t0}ms`);
}

main();
