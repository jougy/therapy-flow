import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { Worker } from "node:worker_threads";
import { chromium } from "playwright";
import { runWafw00f } from "./security-probes.mjs";
import { askLocalLLM } from "../dev/ai-local-engine.mjs";

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "core/Pluri-Health/10 - Produto/00 - Hubs/Catalogo Mestre de Funcionalidades e Diferenciais.md");
const VAULT_OUT_DIR = path.join(ROOT, "core/Pluri-Health/30 - QA/Benchmarks de Paginas");
const WORKER_PATH = path.join(ROOT, "scripts/qa/benchmark-page-worker.mjs");
const BASE_URL = process.env.PERF_BASE_URL || "http://127.0.0.1:4173";
const THREADS = Math.max(1, Number(process.env.PERF_THREADS || Math.min(4, os.availableParallelism?.() || 4)));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseCatalogRoutes() {
  const content = fs.readFileSync(CATALOG_PATH, "utf8");
  const routes = [];
  const lines = content.split("\n");
  for (const line of lines) {
    if (!line.startsWith("| **")) continue;
    const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cols.length < 4) continue;
    const moduleName = cols[0].replace(/\*\*/g, "").trim();
    const rawRoute = cols[1].replace(/`/g, "").split("(")[0].trim();
    const source = cols[2].replace(/`/g, "").trim();
    const purpose = cols[3].replace(/\[\[.*?\|?(.*?)\]\]/g, "$1").trim();
    const cleanName = rawRoute === "/" ? "Home" : rawRoute.replace(/^\//, "").replace(/[:/*]+/g, " ").trim();
    routes.push({
      index: routes.length + 1,
      module: moduleName,
      route: rawRoute,
      source,
      purpose,
      name: `${moduleName} - ${rawRoute}`,
      slug: cleanName.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "pagina",
    });
  }
  return routes;
}

function inspectSecurityHeaders() {
  const headersPath = path.join(ROOT, "public/_headers");
  const raw = fs.existsSync(headersPath) ? fs.readFileSync(headersPath, "utf8") : "";
  const checks = {
    csp: /Content-Security-Policy/i.test(raw),
    hsts: /Strict-Transport-Security/i.test(raw),
    xFrame: /X-Frame-Options/i.test(raw),
    xContentType: /X-Content-Type-Options/i.test(raw),
    referrer: /Referrer-Policy/i.test(raw),
    permissions: /Permissions-Policy/i.test(raw),
    coop: /Cross-Origin-Opener-Policy/i.test(raw),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const baseScore = Math.round((passed / Object.keys(checks).length) * 100);
  return { checks, baseScore };
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch {
      // wait
    }
    await sleep(300);
  }
  throw new Error(`Servidor não respondeu em ${url}`);
}

async function authenticateOnce() {
  const email = process.env.PERF_TEST_EMAIL || "teste@email.com";
  const password = process.env.PERF_TEST_PASSWORD || "teste123";
  if (!email || !password) return { storageState: null, ids: {} };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "networkidle", timeout: 25000 }).catch(() => {});
  const emailInput = page.locator('input[type="email"]').first();
  const passInput = page.locator('input[type="password"]').first();
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill(email);
    await passInput.fill(password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(3000);
  }
  const storageState = await context.storageState();
  await browser.close();
  return { storageState, ids: {} };
}

function runWorker(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_PATH, { workerData });
    worker.on("message", (msg) => {
      if (msg?.error) reject(new Error(msg.error));
      else resolve(msg);
    });
    worker.on("error", reject);
  });
}

function gradeFromScore(score) {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 50) return "D";
  return "F";
}

function buildPageMarkdown(item, headersInfo, wafInfo, timestamp) {
  const { scores, desktop, mobile, ast, insights } = item;
  const noteName = `Benchmark - ${String(item.index).padStart(2, "0")} - ${item.slug}`;

  return {
    fileName: `${noteName}.md`,
    noteName,
    content: `---
tags:
  - qa
  - benchmark
  - performance
kind: benchmark-pagina
rota: "${item.route}"
modulo: "${item.module}"
atualizado: "${timestamp}"
---

# 📊 ${item.name}

> **Rota:** \`${item.route}\` (testada em \`${item.resolvedRoute}\`)  
> **Componente Fonte:** \`${item.source}\`  
> **Finalidade:** ${item.purpose}  
> **Última Medição:** ${timestamp} | **Voltar:** [[00 - Indice de Benchmarks por Pagina]] · [[01 - Resumo Geral do SaaS]]

## 🎯 Resumo de Notas

| 🚀 Performance | 🛡️ Segurança | ♿ Acessibilidade | 📱 Responsividade | 🏆 Nota Média |
| :---: | :---: | :---: | :---: | :---: |
| **${scores.performance}/100** | **${scores.security}/100** | **${scores.a11y}/100** | **${scores.responsiveness}/100** | **${scores.overall}/100 (${gradeFromScore(scores.overall)})** |

---

## 🤖 Insights do Subagente (${insights.provider})

${insights.text}

---

## 📈 1. Performance & Web Vitals (Desktop \`1440x900\` vs Mobile \`390x844\`)

| Parâmetro | Desktop (\`1440x900\`) | Mobile (\`390x844\`) | Meta Ideal (Lighthouse/WPT) |
| :--- | :---: | :---: | :---: |
| **TTFB** | ${desktop.ttfb} ms | ${mobile.ttfb} ms | < 200 ms |
| **FCP (First Contentful Paint)** | ${desktop.fcp} ms | ${mobile.fcp} ms | ≤ 1800 ms |
| **LCP (Largest Contentful Paint)** | ${desktop.lcp} ms | ${mobile.lcp} ms | ≤ 2500 ms |
| **TBT (Total Blocking Time)** | ${desktop.tbt} ms | ${mobile.tbt} ms | < 200 ms |
| **CLS (Cumulative Layout Shift)** | ${desktop.cls} | ${mobile.cls} | ≤ 0.1 |
| **Tempo Total de Navegação** | ${desktop.wallMs} ms | ${mobile.wallMs} ms | < 3000 ms |
| **Nós no DOM** | ${desktop.domNodes} | ${mobile.domNodes} | < 800 nós |
| **Requisições Totais / Falhas** | ${desktop.requests} / ${desktop.failedRequests} | ${mobile.requests} / ${mobile.failedRequests} | 0 falhas |
| **JS Transferido** | ${desktop.jsKb} kB | ${mobile.jsKb} kB | < 350 kB |

---

## 🛡️ 2. Segurança & Governança

| Parâmetro | Status / Valor | Critério |
| :--- | :---: | :--- |
| **CSP / HSTS / X-Frame / nosniff** | ${headersInfo.checks.csp ? "✅" : "❌"} / ${headersInfo.checks.hsts ? "✅" : "❌"} / ${headersInfo.checks.xFrame ? "✅" : "❌"} / ${headersInfo.checks.xContentType ? "✅" : "❌"} | Headers \`public/_headers\` |
| **Referrer / Permissions / COOP** | ${headersInfo.checks.referrer ? "✅" : "❌"} / ${headersInfo.checks.permissions ? "✅" : "❌"} / ${headersInfo.checks.coop ? "✅" : "❌"} | Hardening HTTP |
| **Uso de \`can(capability)\`** | ${ast.usesCanCapability ? "✅ Sim" : "ℹ️ N/A ou indireto"} | Sem hardcode de papéis |
| **Hardcode de Papéis (\`operationalRole ===\`)** | ${ast.hardcodedRoles} | 0 permitido |
| **Violações Monetárias (\`_cents\`)** | ${ast.monetaryViolations} | 0 permitido |
| **Erros de Console (Runtime)** | ${desktop.consoleErrors} | 0 ideal |
| **Headers Runtime / CORS** | ${item.secProbes ? `${item.secProbes.headersPresent}/${item.secProbes.headersTotal} headers | CORS: ${item.secProbes.corsPermissive ? "❌ Permissivo" : "✅ Seguro"}` : "N/A"} | Probe HTTP ativo |
| **WAF Probes / Rate Limit** | ${item.secProbes ? `${item.secProbes.wafBlockedCount}/${item.secProbes.wafProbesTotal} bloqueios | 429: ${item.secProbes.rateLimited ? "✅ Sim" : "ℹ️ Não"}` : "N/A"} | ${wafInfo?.available ? `WAF: ${wafInfo.detectedWaf}` : "wafw00f indisponível"} |
| **Nuclei (CLI)** | ${item.nuclei?.available ? `C:${item.nuclei.critical} H:${item.nuclei.high} M:${item.nuclei.medium} L:${item.nuclei.low}` : "ℹ️ Pulado (binário ausente)"} | 0 critical/high |
| **OWASP ZAP (Baseline)** | ${item.zap?.available ? `High:${item.zap.high} Med:${item.zap.medium}` : "ℹ️ Pulado (CLI/flag ausente)"} | 0 high/medium |

---

## ♿ 3. Acessibilidade (WCAG 2.1 AA)

| Parâmetro | Resultado | Meta |
| :--- | :---: | :---: |
| **Landmark \`<main>\` presente** | ${desktop.hasMainLandmark ? "✅ Sim" : "⚠️ Ausente"} | Obrigatório |
| **Imagens sem \`alt\` (Runtime + AST)** | ${desktop.imagesWithoutAlt + ast.missingAlt} | 0 |
| **Botões sem nome acessível (Runtime + AST)** | ${desktop.buttonsWithoutName + ast.missingAriaButtons} | 0 |
| **\`div\`/\`span\` clicável sem \`role\` (AST)** | ${ast.divOnClickNoRole} | 0 |
| **Elementos Focáveis (Tab)** | ${desktop.focusableCount} | Navegável por teclado |

---

## 📱 4. Responsividade & Mobile-First (Multi-Viewport + Axe + Lighthouse Mobile)

| Parâmetro | Resultado | Meta |
| :--- | :---: | :---: |
| **Overflow Horizontal Mobile (\`390x844\`)** | ${mobile.hasHorizontalOverflow ? `❌ +${mobile.overflowExcessPx}px` : "✅ 0px"} | 0px |
| **Overflow Horizontal Mobile Pequeno (\`320x568\`)** | ${item.mobileSmall?.hasHorizontalOverflow ? `❌ +${item.mobileSmall.overflowExcessPx}px` : "✅ 0px"} | 0px |
| **Overflow Horizontal Tablet (\`768x1024\`)** | ${item.tablet?.hasHorizontalOverflow ? `❌ +${item.tablet.overflowExcessPx}px` : "✅ 0px"} | 0px |
| **Overflow Horizontal Desktop (\`1440x900\`)** | ${desktop.hasHorizontalOverflow ? `❌ +${desktop.overflowExcessPx}px` : "✅ 0px"} | 0px |
| **Touch Targets < 40px (Mobile)** | ${mobile.smallTouchTargets} | 0 (mínimo 44x44px) |
| **Elementos Interativos Sobrepostos (Mobile)** | ${mobile.overlappingInteractive ?? 0} | 0 |
| **Containers Cortados sem Scroll (Mobile)** | ${mobile.clippedContainers ?? 0} | 0 |
| **Meta Viewport (Permite Zoom)** | ${mobile.metaViewportOk ? "✅ Válido" : "❌ Restrito/Ausente"} | Válido |
| **Axe-core WCAG 2.1/2.2 (Violações)** | ${item.axe ? `${item.axe.totalViolations} (${item.axe.criticalOrSerious} críticas/sérias)` : "N/A"} | 0 |
| **Lighthouse Mobile (Perf / A11y / BP)** | ${item.lh ? `${item.lh.performance ?? "-"} / ${item.lh.accessibility ?? "-"} / ${item.lh.bestPractices ?? "-"} (LCP ${item.lh.lcpMs}ms, TBT ${item.lh.tbtMs}ms)` : "N/A"} | ≥ 90 |
| **Larguras Fixas \`w-[...px]\` (AST)** | ${ast.staticWidths} | 0 |
| **Uso de \`h-screen\` rígido (AST)** | ${ast.rigidHScreen} | 0 (usar \`100dvh\`) |
`,
  };
}

async function main() {
  const startAll = Date.now();
  const routes = parseCatalogRoutes();
  const headersInfo = inspectSecurityHeaders();
  const shouldStartServer = !process.env.PERF_BASE_URL;
  const serverProc = shouldStartServer
    ? spawn("npx", ["vite", "preview", "--port", "4173", "--strictPort", "--host", "127.0.0.1"], { stdio: "ignore" })
    : null;

  try {
    await waitForServer(BASE_URL);
    const wafInfo = await runWafw00f(BASE_URL);
    const { storageState, ids } = await authenticateOnce();

    const chunkSize = Math.ceil(routes.length / THREADS);
    const chunks = [];
    for (let i = 0; i < routes.length; i += chunkSize) {
      chunks.push(routes.slice(i, i + chunkSize));
    }

    console.log(`🚀 Auditando ${routes.length} páginas em ${chunks.length} threads paralelas...`);
    const workerResults = await Promise.all(
      chunks.map((chunk, workerIndex) =>
        runWorker({ routes: chunk, baseUrl: BASE_URL, storageState, ids, headersInfo, workerIndex })
      )
    );
    const allItems = workerResults.flat().sort((a, b) => a.index - b.index);

    // Reescrever pasta na Vault (sem histórico)
    if (fs.existsSync(VAULT_OUT_DIR)) {
      fs.rmSync(VAULT_OUT_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(VAULT_OUT_DIR, { recursive: true });

    const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const pageDocs = allItems.map((item) => {
      const doc = buildPageMarkdown(item, headersInfo, wafInfo, timestamp);
      fs.writeFileSync(path.join(VAULT_OUT_DIR, doc.fileName), doc.content, "utf8");
      return { item, doc };
    });

    // Índice
    const indexRows = pageDocs
      .map(
        ({ item, doc }) =>
          `| ${item.module} | [[${doc.noteName}\\|${item.route}]] | \`${item.source}\` | ${item.scores.performance} | ${item.scores.security} | ${item.scores.a11y} | ${item.scores.responsiveness} | **${item.scores.overall}** (${gradeFromScore(item.scores.overall)}) |`
      )
      .join("\n");

    const indexMd = `---
tags: [qa, benchmark, indice]
atualizado: "${timestamp}"
---

# 🗂️ Índice de Benchmarks por Página

> **Total de Páginas Auditadas:** ${allItems.length} | **Threads:** ${chunks.length} | **Atualizado em:** ${timestamp}  
> **Visão Executiva:** [[01 - Resumo Geral do SaaS]]

| Módulo | Página / Rota | Componente Fonte | 🚀 Perf | 🛡️ Seg | ♿ A11y | 📱 Resp | 🏆 Média |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
${indexRows}
`;
    fs.writeFileSync(path.join(VAULT_OUT_DIR, "00 - Indice de Benchmarks por Pagina.md"), indexMd, "utf8");

    // Resumo Geral do SaaS
    const avg = (fn) => Math.round(allItems.reduce((acc, it) => acc + fn(it), 0) / Math.max(1, allItems.length));
    const globalPerf = avg((it) => it.scores.performance);
    const globalSec = avg((it) => it.scores.security);
    const globalA11y = avg((it) => it.scores.a11y);
    const globalResp = avg((it) => it.scores.responsiveness);
    const globalOverall = avg((it) => it.scores.overall);

    const summaryPrompt = `SaaS Pluri-Health (${allItems.length} páginas): Médias globais -> Performance ${globalPerf}/100, Segurança ${globalSec}/100, Acessibilidade ${globalA11y}/100, Responsividade ${globalResp}/100, Geral ${globalOverall}/100. FCP médio ${avg((it) => it.desktop.fcp)}ms, LCP médio ${avg((it) => it.desktop.lcp)}ms. Gere um resumo executivo de 3 bullets em português.`;
    const globalAi = await askLocalLLM("Você é um arquiteto de performance web.", summaryPrompt, 180);

    const summaryMd = `---
tags: [qa, benchmark, resumo-saas]
atualizado: "${timestamp}"
---

# 🏆 Resumo Geral do SaaS — Benchmarks Offline

> **Base de Cálculo:** ${allItems.length} páginas auditadas em paralelo (${chunks.length} threads) | **Atualizado em:** ${timestamp}  
> **Índice Completo:** [[00 - Indice de Benchmarks por Pagina]]

## 📊 Scorecard Global do SaaS

| 🚀 Performance Média | 🛡️ Segurança Média | ♿ Acessibilidade Média | 📱 Responsividade Média | 🏆 Nota Global do SaaS |
| :---: | :---: | :---: | :---: | :---: |
| **${globalPerf}/100** | **${globalSec}/100** | **${globalA11y}/100** | **${globalResp}/100** | **${globalOverall}/100 (${gradeFromScore(globalOverall)})** |

## 🤖 Síntese Executiva (${globalAi?.provider || "deterministic-fallback"})

${globalAi?.text || "- Sistema auditado com métricas consolidadas de runtime e análise estática."}

## 📈 Estatísticas Consolidadas

- **FCP Médio (Desktop):** ${avg((it) => it.desktop.fcp)} ms
- **LCP Médio (Desktop):** ${avg((it) => it.desktop.lcp)} ms
- **TBT Médio (Desktop):** ${avg((it) => it.desktop.tbt)} ms
- **Páginas com Overflow Mobile (\`390x844\`):** ${allItems.filter((it) => it.mobile.hasHorizontalOverflow).length} de ${allItems.length}
- **Tempo Total da Auditoria Multithread:** ${((Date.now() - startAll) / 1000).toFixed(1)}s
`;
    fs.writeFileSync(path.join(VAULT_OUT_DIR, "01 - Resumo Geral do SaaS.md"), summaryMd, "utf8");

    console.log(`✅ Concluído em ${((Date.now() - startAll) / 1000).toFixed(1)}s! Arquivos gerados em: ${VAULT_OUT_DIR}`);
  } finally {
    if (serverProc) serverProc.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});
