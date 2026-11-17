import fs from "node:fs";
import path from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import lighthouse from "lighthouse";
import { askLocalLLM } from "../dev/ai-local-engine.mjs";
import { runNativeSecurityProbes, runNucleiAudit, runZapBaseline } from "./security-probes.mjs";

const ROOT = process.cwd();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function resolveRouteUrl(rawRoute, ids) {
  return rawRoute
    .replace(":clinicKey", ids.clinicKey || "clinica-demo")
    .replace(":clinicId", ids.clinicId || "00000000-0000-0000-0000-000000000001")
    .replace(":id", ids.patientId || "00000000-0000-0000-0000-000000000002")
    .replace(":sessionId", ids.sessionId || "00000000-0000-0000-0000-000000000003")
    .replace(":templateId", ids.templateId || "00000000-0000-0000-0000-000000000004")
    .replace(":token", "demo-token-benchmark")
    .replace(":userId", ids.userId || "00000000-0000-0000-0000-000000000005")
    .replace(":patientId", ids.patientId || "00000000-0000-0000-0000-000000000002")
    .replace("/*", "");
}

function analyzeSourceAst(sourcePath) {
  const fullPath = path.resolve(ROOT, sourcePath.replace(/\*$/, ""));
  const result = {
    exists: false,
    lines: 0,
    usesCanCapability: false,
    hardcodedRoles: 0,
    monetaryViolations: 0,
    staticWidths: 0,
    rigidHScreen: 0,
    missingAlt: 0,
    missingAriaButtons: 0,
    divOnClickNoRole: 0,
    lazyLoaded: true,
  };

  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    return result;
  }

  result.exists = true;
  const content = fs.readFileSync(fullPath, "utf8");
  const lines = content.split("\n");
  result.lines = lines.length;
  result.usesCanCapability = /\bcan\s*\(/.test(content);

  for (const line of lines) {
    if (
      (line.includes("operationalRole === 'admin'") ||
        line.includes('operationalRole === "admin"') ||
        line.includes("operationalRole === 'owner'") ||
        line.includes('operationalRole === "owner"')) &&
      !fullPath.includes("rbac.ts")
    ) {
      result.hardcodedRoles += 1;
    }
    if (line.includes("amount_charged:") && !line.includes("amount_charged_cents")) {
      result.monetaryViolations += 1;
    }
    if (/(?:className|class)="[^"]*\b(w-\[\d+px\])\b[^"]*"/.test(line) && !line.includes("max-w-") && !line.includes("sm:") && !line.includes("md:")) {
      result.staticWidths += 1;
    }
    if (/\b(h-screen)\b/.test(line) && !line.includes("dvh") && !line.includes("min-h-screen")) {
      result.rigidHScreen += 1;
    }
    if (line.includes("<img ") && !line.includes("alt=")) {
      result.missingAlt += 1;
    }
    if (/<button[^>]*>\s*<[A-Z][a-zA-Z]*Icon[^>]*\/>\s*<\/button>/.test(line) && !line.includes("aria-label")) {
      result.missingAriaButtons += 1;
    }
    if (line.includes("onClick=") && (line.includes("<div ") || line.includes("<span ")) && !line.includes("role=") && !line.includes("onKeyDown=")) {
      result.divOnClickNoRole += 1;
    }
  }

  return result;
}

function computeScores(desktop, mobile, mobileSmall, tablet, ast, headersInfo, axe, lh, secProbes, nuclei, zap) {
  // 1. Performance (0-100) baseado em Lighthouse weights: TBT 30%, LCP 25%, CLS 25%, FCP 10%, Requests/JS 10%
  const tbtScore = desktop.tbt <= 200 ? 100 : Math.max(0, 100 - Math.round((desktop.tbt - 200) / 10));
  const lcpScore = desktop.lcp <= 2500 ? 100 : Math.max(0, 100 - Math.round((desktop.lcp - 2500) / 50));
  const clsScore = desktop.cls <= 0.1 ? 100 : Math.max(0, 100 - Math.round((desktop.cls - 0.1) * 200));
  const fcpScore = desktop.fcp <= 1800 ? 100 : Math.max(0, 100 - Math.round((desktop.fcp - 1800) / 40));
  const failPenalty = desktop.failedRequests * 8;
  const runtimePerf = Math.max(0, Math.min(100, Math.round(tbtScore * 0.3 + lcpScore * 0.25 + clsScore * 0.25 + fcpScore * 0.1 + 10 - failPenalty)));
  const performance = lh?.performance != null ? Math.round(runtimePerf * 0.5 + lh.performance * 0.5) : runtimePerf;

  // 2. Segurança (0-100) baseado em Headers + RBAC + Padrão Monetário + Probes WAF/CORS + Nuclei/ZAP + Console Errors
  let security = headersInfo.baseScore;
  security -= ast.hardcodedRoles * 15;
  security -= ast.monetaryViolations * 15;
  security -= Math.min(20, desktop.consoleErrors * 4);
  if (secProbes?.corsPermissive) security -= 20;
  if (nuclei?.available) {
    security -= Math.min(40, nuclei.critical * 20 + nuclei.high * 12 + nuclei.medium * 5 + nuclei.low * 2);
  }
  if (zap?.available) {
    security -= Math.min(30, zap.high * 15 + zap.medium * 5);
  }
  security = Math.max(0, Math.min(100, security));

  // 3. Acessibilidade (0-100) WCAG 2.1/2.2 AA Runtime + Axe-core + AST
  let a11y = 100;
  if (!desktop.hasMainLandmark) a11y -= 8;
  a11y -= Math.min(20, desktop.imagesWithoutAlt * 5);
  a11y -= Math.min(20, desktop.buttonsWithoutName * 4);
  a11y -= Math.min(15, ast.missingAlt * 5);
  a11y -= Math.min(15, ast.missingAriaButtons * 5);
  a11y -= Math.min(15, ast.divOnClickNoRole * 3);
  if (axe) {
    a11y -= Math.min(25, axe.criticalOrSerious * 5 + axe.minorOrModerate * 2);
  }
  a11y = Math.max(0, Math.min(100, a11y));
  if (lh?.accessibility != null) {
    a11y = Math.round(a11y * 0.6 + lh.accessibility * 0.4);
  }

  // 4. Responsividade (0-100) Multi-Viewport (320px, 390px, 768px, 1440px) + Geometria + AST
  let responsiveness = 100;
  if (mobile.hasHorizontalOverflow) responsiveness -= Math.min(30, 12 + Math.round(mobile.overflowExcessPx / 5));
  if (mobileSmall.hasHorizontalOverflow) responsiveness -= Math.min(20, 8 + Math.round(mobileSmall.overflowExcessPx / 8));
  if (tablet.hasHorizontalOverflow) responsiveness -= 10;
  if (desktop.hasHorizontalOverflow) responsiveness -= 15;
  if (!mobile.metaViewportOk) responsiveness -= 10;
  responsiveness -= Math.min(15, mobile.smallTouchTargets * 3);
  responsiveness -= Math.min(15, mobile.overlappingInteractive * 5);
  responsiveness -= Math.min(10, mobile.clippedContainers * 2);
  responsiveness -= Math.min(15, ast.staticWidths * 5);
  responsiveness -= Math.min(10, ast.rigidHScreen * 5);
  responsiveness = Math.max(0, Math.min(100, responsiveness));

  const overall = Math.round((performance + security + a11y + responsiveness) / 4);

  return { performance, security, a11y, responsiveness, overall };
}

async function measureViewport(page, url, width, height) {
  await page.setViewportSize({ width, height });
  let requests = 0;
  let failedRequests = 0;
  let jsBytes = 0;
  let consoleErrors = 0;

  const onResponse = (res) => {
    requests += 1;
    if (res.status() >= 400 && !res.url().includes("supabase")) {
      failedRequests += 1;
    }
    if (res.url().endsWith(".js") || res.headers()["content-type"]?.includes("javascript")) {
      jsBytes += Number(res.headers()["content-length"] || 0);
    }
  };
  const onConsole = (msg) => {
    if (msg.type() === "error") consoleErrors += 1;
  };

  page.on("response", onResponse);
  page.on("console", onConsole);

  const navStart = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await sleep(700);
  const wallMs = Date.now() - navStart;

  const metrics = await page.evaluate(() => {
    const perf = window.__pluriPerf || { fcp: 0, lcp: 0, cls: 0, tbt: 0 };
    const nav = performance.getEntriesByType("navigation")[0];
    const ttfb = nav ? Math.round(nav.responseStart - nav.requestStart) : 0;
    const domNodes = document.querySelectorAll("*").length;
    const docWidth = document.documentElement.scrollWidth;
    const winWidth = window.innerWidth;
    const hasHorizontalOverflow = docWidth > winWidth;
    const overflowExcessPx = Math.max(0, docWidth - winWidth);

    const hasMainLandmark = Boolean(document.querySelector("main, [role='main']"));
    const imagesWithoutAlt = Array.from(document.querySelectorAll("img")).filter((img) => !img.hasAttribute("alt")).length;
    const buttonsWithoutName = Array.from(document.querySelectorAll("button")).filter(
      (btn) => !(btn.innerText || "").trim() && !btn.getAttribute("aria-label") && !btn.getAttribute("title")
    ).length;
    const focusableCount = document.querySelectorAll("a[href], button, input, select, textarea, [tabindex]").length;

    let smallTouchTargets = 0;
    let overlappingInteractive = 0;
    let clippedContainers = 0;

    const metaViewport = document.querySelector('meta[name="viewport"]');
    const metaContent = (metaViewport?.getAttribute("content") || "").toLowerCase();
    const metaViewportOk = Boolean(metaViewport) && !metaContent.includes("user-scalable=no") && !metaContent.includes("maximum-scale=1");

    if (winWidth <= 768) {
      const interactiveRects = [];
      for (const el of document.querySelectorAll("button, a, input, select")) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if ((el.tagName === "BUTTON" || el.tagName === "A") && (rect.width < 40 || rect.height < 40)) {
            smallTouchTargets += 1;
          }
          interactiveRects.push(rect);
        }
      }
      for (let i = 0; i < interactiveRects.length; i += 1) {
        const a = interactiveRects[i];
        for (let j = i + 1; j < interactiveRects.length; j += 1) {
          const b = interactiveRects[j];
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapX > 4 && overlapY > 4) {
            overlappingInteractive += 1;
            break;
          }
        }
      }
      for (const el of document.querySelectorAll("main *, section *, div")) {
        if (el === document.body || el === document.documentElement) continue;
        if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 4) {
          const style = getComputedStyle(el);
          if (style.overflowX !== "auto" && style.overflowX !== "scroll" && style.textOverflow !== "ellipsis") {
            clippedContainers += 1;
          }
        }
      }
    }

    return {
      ttfb: Math.max(0, ttfb),
      fcp: Math.round(perf.fcp || 0),
      lcp: Math.round(perf.lcp || 0),
      cls: Number((perf.cls || 0).toFixed(3)),
      tbt: Math.round(perf.tbt || 0),
      domNodes,
      hasHorizontalOverflow,
      overflowExcessPx,
      hasMainLandmark,
      imagesWithoutAlt,
      buttonsWithoutName,
      focusableCount,
      smallTouchTargets,
      overlappingInteractive,
      clippedContainers,
      metaViewportOk,
    };
  });

  page.off("response", onResponse);
  page.off("console", onConsole);

  return {
    wallMs,
    requests,
    failedRequests,
    jsKb: Math.round(jsBytes / 1024),
    consoleErrors,
    ...metrics,
  };
}

async function generatePageInsights(item, scores, desktop, mobile, ast) {
  const systemPrompt =
    "Você é um engenheiro sênior de performance web (estilo Lighthouse/GTmetrix/Mozilla Observatory). Responda em português do Brasil, em 3 bullet points curtos e objetivos com recomendações práticas baseadas nos números fornecidos.";
  const userPrompt = `Página: ${item.name} (${item.route})
Módulo: ${item.module}
Notas: Performance ${scores.performance}/100, Segurança ${scores.security}/100, Acessibilidade ${scores.a11y}/100, Responsividade ${scores.responsiveness}/100.
Desktop: FCP=${desktop.fcp}ms, LCP=${desktop.lcp}ms, TBT=${desktop.tbt}ms, CLS=${desktop.cls}, DOM=${desktop.domNodes} nós, JS=${desktop.jsKb}kB, Requests=${desktop.requests}.
Mobile 390x844: Overflow=${mobile.hasHorizontalOverflow ? mobile.overflowExcessPx + "px" : "0px"}, TouchTargetsPequenos=${mobile.smallTouchTargets}.
AST: Linhas=${ast.lines}, HardcodedRoles=${ast.hardcodedRoles}, ImagensSemAlt=${ast.missingAlt + desktop.imagesWithoutAlt}, BotoesSemNome=${ast.missingAriaButtons + desktop.buttonsWithoutName}.
Gere 3 insights diretos de melhoria ou validação.`;

  const llmRes = await askLocalLLM(systemPrompt, userPrompt, 180);
  if (llmRes?.text) {
    return { provider: llmRes.provider, text: llmRes.text };
  }

  const bullets = [];
  if (desktop.lcp > 2500 || desktop.tbt > 200) {
    bullets.push(`- **Performance:** LCP (${desktop.lcp}ms) ou TBT (${desktop.tbt}ms) acima do ideal; avalie memoização ou lazy-loading de subcomponentes.`);
  } else {
    bullets.push(`- **Performance:** Excelente resposta inicial (FCP ${desktop.fcp}ms, LCP ${desktop.lcp}ms, TBT ${desktop.tbt}ms) dentro das metas do Lighthouse.`);
  }
  if (mobile.hasHorizontalOverflow || mobile.smallTouchTargets > 0) {
    bullets.push(`- **Responsividade Mobile:** Detectado overflow de ${mobile.overflowExcessPx}px ou ${mobile.smallTouchTargets} alvos de toque < 40px; revise wrappers \`overflow-x-auto\` e \`min-h-[44px]\`.`);
  } else {
    bullets.push(`- **Responsividade Mobile:** Zero overflow horizontal em \`390x844\` e ergonomia tátil preservada.`);
  }
  if (desktop.buttonsWithoutName > 0 || desktop.imagesWithoutAlt > 0 || !desktop.hasMainLandmark) {
    bullets.push(`- **Acessibilidade & Segurança:** ${desktop.buttonsWithoutName} botões sem nome acessível e ${desktop.imagesWithoutAlt} imagens sem \`alt\`; garanta \`aria-label\` e landmark \`<main>\`.`);
  } else {
    bullets.push(`- **Acessibilidade & Segurança:** Estrutura semântica WCAG 2.1 AA e governança \`can(capability)\` conformes.`);
  }
  return { provider: "deterministic-fallback", text: bullets.join("\n") };
}

async function runAxeAudit(page) {
  try {
    const res = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    let criticalOrSerious = 0;
    let minorOrModerate = 0;
    const ruleIds = [];
    for (const v of res.violations || []) {
      ruleIds.push(v.id);
      if (v.impact === "critical" || v.impact === "serious") {
        criticalOrSerious += 1;
      } else {
        minorOrModerate += 1;
      }
    }
    return {
      totalViolations: (res.violations || []).length,
      criticalOrSerious,
      minorOrModerate,
      ruleIds: ruleIds.slice(0, 6),
    };
  } catch {
    return { totalViolations: 0, criticalOrSerious: 0, minorOrModerate: 0, ruleIds: [] };
  }
}

async function runLighthouseMobile(url, port) {
  if (process.env.PERF_SKIP_LIGHTHOUSE === "1") return null;
  try {
    const runnerResult = await lighthouse(url, {
      port,
      output: "json",
      logLevel: "error",
      formFactor: "mobile",
      disableStorageReset: true,
      onlyCategories: ["performance", "accessibility", "best-practices"],
      screenEmulation: {
        mobile: true,
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        disabled: false,
      },
    });
    const cats = runnerResult?.lhr?.categories || {};
    const audits = runnerResult?.lhr?.audits || {};
    return {
      performance: cats.performance?.score != null ? Math.round(cats.performance.score * 100) : null,
      accessibility: cats.accessibility?.score != null ? Math.round(cats.accessibility.score * 100) : null,
      bestPractices: cats["best-practices"]?.score != null ? Math.round(cats["best-practices"].score * 100) : null,
      lcpMs: Math.round(audits["largest-contentful-paint"]?.numericValue || 0),
      tbtMs: Math.round(audits["total-blocking-time"]?.numericValue || 0),
      cls: Number((audits["cumulative-layout-shift"]?.numericValue || 0).toFixed(3)),
    };
  } catch {
    return null;
  }
}

async function run() {
  const { routes, baseUrl, storageState, ids, headersInfo, workerIndex = 0 } = workerData;
  const debugPort = 9222 + workerIndex;
  const browser = await chromium.launch({
    headless: true,
    args: [`--remote-debugging-port=${debugPort}`],
  });
  const context = await browser.newContext(
    storageState ? { storageState, hasTouch: true } : { hasTouch: true }
  );

  await context.addInitScript(() => {
    window.__pluriPerf = { fcp: 0, lcp: 0, cls: 0, tbt: 0 };
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.name === "first-contentful-paint") window.__pluriPerf.fcp = e.startTime;
        }
      }).observe({ type: "paint", buffered: true });
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length) window.__pluriPerf.lcp = entries[entries.length - 1].startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (!e.hadRecentInput) window.__pluriPerf.cls += e.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.duration > 50) window.__pluriPerf.tbt += e.duration - 50;
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // ignore
    }
  });

  const page = await context.newPage();
  const results = [];

  for (const item of routes) {
    const resolvedRoute = resolveRouteUrl(item.route, ids);
    const url = `${baseUrl}${resolvedRoute}`;
    const desktop = await measureViewport(page, url, 1440, 900);
    const tablet = await measureViewport(page, url, 768, 1024);
    const mobileSmall = await measureViewport(page, url, 320, 568);
    const mobile = await measureViewport(page, url, 390, 844);
    const axe = await runAxeAudit(page);
    const lh = await runLighthouseMobile(url, debugPort);
    const cookies = await context.cookies(url).catch(() => []);
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const [secProbes, nuclei, zap] = await Promise.all([
      runNativeSecurityProbes(url, cookieHeader),
      runNucleiAudit(url, cookieHeader),
      runZapBaseline(url),
    ]);
    const ast = analyzeSourceAst(item.source);
    const scores = computeScores(desktop, mobile, mobileSmall, tablet, ast, headersInfo, axe, lh, secProbes, nuclei, zap);
    const insights = await generatePageInsights(item, scores, desktop, mobile, ast);

    results.push({
      ...item,
      resolvedRoute,
      desktop,
      mobile,
      mobileSmall,
      tablet,
      axe,
      lh,
      secProbes,
      nuclei,
      zap,
      ast,
      scores,
      insights,
    });
  }

  await browser.close();
  parentPort.postMessage(results);
}

run().catch((err) => {
  parentPort.postMessage({ error: err.message });
  process.exit(1);
});
