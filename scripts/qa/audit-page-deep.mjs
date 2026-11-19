import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import lighthouse from "lighthouse";
import { runNativeSecurityProbes, runNucleiAudit, runZapBaseline } from "./security-probes.mjs";

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "core/Pluri-Health/10 - Produto/00 - Hubs/Catalogo Mestre de Funcionalidades e Diferenciais.md");
const BASE_URL = process.env.PERF_BASE_URL || "http://127.0.0.1:4174";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const skipBuild = args.includes("--no-build") || process.env.PERF_SKIP_BUILD === "1";
  const skipLh = args.includes("--no-lh") || process.env.PERF_SKIP_LIGHTHOUSE === "1";
  const target = args.find((a) => !a.startsWith("--")) || "/auth";
  return { target, skipBuild, skipLh };
}

function resolveTarget(target) {
  let route = target;
  let source = "";
  if (/^\d+$/.test(target) && fs.existsSync(CATALOG_PATH)) {
    const idx = Number(target);
    const lines = fs.readFileSync(CATALOG_PATH, "utf8").split("\n").filter((l) => l.startsWith("| **"));
    const row = lines[idx - 1];
    if (row) {
      const cols = row.split("|").map((c) => c.trim()).filter(Boolean);
      route = cols[1]?.replace(/`/g, "").split("(")[0].trim() || route;
      source = cols[2]?.replace(/`/g, "").trim() || "";
    }
  }
  const resolved = route
    .replace(":clinicKey", "clinica-demo")
    .replace(":clinicId", "00000000-0000-0000-0000-000000000001")
    .replace(":id", "00000000-0000-0000-0000-000000000002")
    .replace(":sessionId", "00000000-0000-0000-0000-000000000003")
    .replace(":templateId", "00000000-0000-0000-0000-000000000004")
    .replace(":token", "demo-token-benchmark")
    .replace(":userId", "00000000-0000-0000-0000-000000000005")
    .replace(":patientId", "00000000-0000-0000-0000-000000000002")
    .replace("/*", "");
  return { route, resolved: resolved.startsWith("/") ? resolved : `/${resolved}`, source };
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      // wait
    }
    await sleep(250);
  }
  throw new Error(`Servidor não respondeu em ${url}`);
}

async function inspectViewport(page, url, width, height) {
  await page.setViewportSize({ width, height });
  const consoleErrors = [];
  const failedRequests = [];
  const onConsole = (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  };
  const onResponse = (res) => {
    if (res.status() >= 400 && !res.url().includes("supabase")) {
      failedRequests.push(`${res.status()} ${res.url()}`);
    }
  };
  page.on("console", onConsole);
  page.on("response", onResponse);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await sleep(600);

  const data = await page.evaluate(() => {
    const describeEl = (el) => {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const label = (el.getAttribute("aria-label") || el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40);
      return `${tag}${id}${label ? `("${label}")` : ""}`;
    };

    const docWidth = document.documentElement.scrollWidth;
    const winWidth = window.innerWidth;
    const overflowPx = Math.max(0, docWidth - winWidth);
    const hasMain = Boolean(document.querySelector("main, [role='main']"));
    const hasH1 = Boolean(document.querySelector("h1"));
    const imgsNoAlt = Array.from(document.querySelectorAll("img")).filter((i) => !i.hasAttribute("alt")).map(describeEl);
    const btnsNoName = Array.from(document.querySelectorAll("button"))
      .filter((b) => !(b.innerText || "").trim() && !b.getAttribute("aria-label") && !b.getAttribute("title"))
      .map(describeEl);

    const smallTargets = [];
    const overlaps = [];
    const rects = [];

    for (const el of document.querySelectorAll("button, a, input, select")) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if ((el.tagName === "BUTTON" || el.tagName === "A") && (r.width < 40 || r.height < 40)) {
        smallTargets.push(`${describeEl(el)} [${Math.round(r.width)}x${Math.round(r.height)}]`);
      }
      rects.push({ el, r });
    }

    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i].r;
        const b = rects[j].r;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 4 && oy > 4) {
          overlaps.push(`${describeEl(rects[i].el)} <-> ${describeEl(rects[j].el)}`);
        }
      }
    }

    return { overflowPx, hasMain, hasH1, imgsNoAlt, btnsNoName, smallTargets, overlaps, domNodes: document.querySelectorAll("*").length };
  });

  page.off("console", onConsole);
  page.off("response", onResponse);
  return { width, height, ...data, consoleErrors, failedRequests };
}

async function runLighthouse(url, port, formFactor) {
  try {
    const isMobile = formFactor === "mobile";
    const res = await lighthouse(url, {
      port,
      output: "json",
      logLevel: "error",
      formFactor,
      disableStorageReset: true,
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      screenEmulation: isMobile
        ? { mobile: true, width: 390, height: 844, deviceScaleFactor: 3, disabled: false }
        : { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
    });
    const cats = res?.lhr?.categories || {};
    const audits = res?.lhr?.audits || {};
    const failed = Object.values(audits)
      .filter((a) => a.score !== null && a.score < 1 && (a.scoreDisplayMode === "binary" || a.scoreDisplayMode === "numeric"))
      .slice(0, 8)
      .map((a) => `${a.id} (${Math.round(a.score * 100)})`);
    return {
      perf: Math.round((cats.performance?.score || 0) * 100),
      a11y: Math.round((cats.accessibility?.score || 0) * 100),
      bp: Math.round((cats["best-practices"]?.score || 0) * 100),
      seo: Math.round((cats.seo?.score || 0) * 100),
      lcpMs: Math.round(audits["largest-contentful-paint"]?.numericValue || 0),
      tbtMs: Math.round(audits["total-blocking-time"]?.numericValue || 0),
      failed,
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function main() {
  const { target, skipBuild, skipLh } = parseArgs();
  const { route, resolved, source } = resolveTarget(target);

  if (!skipBuild) {
    console.log("🔨 Compilando build atualizado (npm run build)...");
    execSync("npm run build", { stdio: "inherit" });
  }

  const serverProc = !process.env.PERF_BASE_URL
    ? spawn("npx", ["vite", "preview", "--port", "4174", "--strictPort", "--host", "127.0.0.1"], { stdio: "ignore" })
    : null;

  const debugPort = 9299;
  let browser;
  try {
    await waitForServer(BASE_URL);
    const url = `${BASE_URL}${resolved}`;
    console.log(`\n🔍 Deep Audit: ${route} -> ${url}${source ? ` (${source})` : ""}`);

    browser = await chromium.launch({ headless: true, args: [`--remote-debugging-port=${debugPort}`] });
    const context = await browser.newContext({ hasTouch: true });
    const page = await context.newPage();

    const viewports = [
      await inspectViewport(page, url, 320, 568),
      await inspectViewport(page, url, 390, 844),
      await inspectViewport(page, url, 768, 1024),
      await inspectViewport(page, url, 1440, 900),
    ];

    console.log("\n📱 1. Playwright Multi-Viewport:");
    for (const v of viewports) {
      console.log(`  - ${v.width}x${v.height}: overflow=${v.overflowPx}px | main=${v.hasMain} | h1=${v.hasH1} | dom=${v.domNodes} | smallTargets=${v.smallTargets.length} | overlaps=${v.overlaps.length} | consoleErr=${v.consoleErrors.length}`);
      if (v.smallTargets.length) console.log(`    ⚠️ SmallTargets: ${v.smallTargets.join(", ")}`);
      if (v.overlaps.length) console.log(`    ⚠️ Overlaps: ${v.overlaps.join(" | ")}`);
      if (v.btnsNoName.length) console.log(`    ⚠️ BtnsNoName: ${v.btnsNoName.join(", ")}`);
      if (v.imgsNoAlt.length) console.log(`    ⚠️ ImgsNoAlt: ${v.imgsNoAlt.join(", ")}`);
      if (v.consoleErrors.length) console.log(`    ❌ ConsoleErr: ${v.consoleErrors[0]}`);
    }

    const axeRes = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    console.log(`\n♿ 2. Axe-core WCAG 2.1/2.2 AA: ${axeRes.violations.length} violações`);
    for (const v of axeRes.violations) {
      const targets = v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ");
      console.log(`  - [${v.impact}] ${v.id}: ${v.help} -> ${targets}`);
    }

    if (!skipLh) {
      const lhMob = await runLighthouse(url, debugPort, "mobile");
      const lhDesk = await runLighthouse(url, debugPort, "desktop");
      console.log("\n🚀 3. Lighthouse:");
      console.log(`  - Mobile:  Perf=${lhMob.perf} A11y=${lhMob.a11y} BP=${lhMob.bp} SEO=${lhMob.seo} (LCP=${lhMob.lcpMs}ms TBT=${lhMob.tbtMs}ms)`);
      if (lhMob.failed?.length) console.log(`    Oportunidades Mobile: ${lhMob.failed.join(", ")}`);
      console.log(`  - Desktop: Perf=${lhDesk.perf} A11y=${lhDesk.a11y} BP=${lhDesk.bp} SEO=${lhDesk.seo} (LCP=${lhDesk.lcpMs}ms TBT=${lhDesk.tbtMs}ms)`);
    }

    const [sec, nuclei, zap] = await Promise.all([
      runNativeSecurityProbes(url, ""),
      runNucleiAudit(url, ""),
      runZapBaseline(url),
    ]);
    console.log("\n🛡️ 4. Segurança:");
    console.log(`  - Headers=${sec.headersPresent}/${sec.headersTotal} | CORS=${sec.corsPermissive ? "PERMISSIVO" : "Seguro"} | WAF=${sec.wafBlockedCount}/${sec.wafProbesTotal}`);
    console.log(`  - Nuclei=${nuclei.available ? `C:${nuclei.critical} H:${nuclei.high}` : "pulado"} | ZAP=${zap.available ? `H:${zap.high} M:${zap.medium}` : "pulado"}`);
  } finally {
    if (browser) await browser.close();
    if (serverProc) serverProc.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error("❌ Erro no qa:page:", err);
  process.exit(1);
});
