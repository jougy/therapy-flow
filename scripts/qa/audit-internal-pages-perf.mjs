import { spawn } from "node:child_process";
import { chromium } from "playwright";

const BASE_URL = process.env.PERF_BASE_URL || "http://127.0.0.1:4173";
const EMAIL = process.env.PERF_TEST_EMAIL || "";
const PASSWORD = process.env.PERF_TEST_PASSWORD || "";
const ROUTES = (
  process.env.PERF_ROUTES || "/,/patients,/agenda,/financeiro,/configuracoes"
)
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch {
      // ignore until ready
    }
    await sleep(300);
  }
  throw new Error(`Servidor não respondeu em ${url} dentro de ${timeoutMs}ms`);
}

function startPreviewServer() {
  const proc = spawn("npx", ["vite", "preview", "--port", "4173", "--strictPort", "--host", "127.0.0.1"], {
    stdio: "ignore",
    detached: false,
  });
  return proc;
}

async function measureRoute(page, route) {
  let requests = 0;
  let failedRequests = 0;
  let jsBytes = 0;

  const onResponse = async (res) => {
    requests += 1;
    if (res.status() >= 400) {
      failedRequests += 1;
    }
    const url = res.url();
    if (url.endsWith(".js") || res.headers()["content-type"]?.includes("javascript")) {
      const len = Number(res.headers()["content-length"] || 0);
      jsBytes += len;
    }
  };

  page.on("response", onResponse);

  const navStart = Date.now();
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await sleep(800);
  const wallMs = Date.now() - navStart;

  const metrics = await page.evaluate(() => {
    const perf = window.__pluriPerf || { fcp: 0, lcp: 0, cls: 0, tbt: 0 };
    return {
      fcp: Math.round(perf.fcp || 0),
      lcp: Math.round(perf.lcp || 0),
      cls: Number((perf.cls || 0).toFixed(3)),
      tbt: Math.round(perf.tbt || 0),
    };
  });

  page.off("response", onResponse);

  return {
    route,
    wallMs,
    ...metrics,
    requests,
    failedRequests,
    jsKb: Math.round(jsBytes / 1024),
  };
}

async function main() {
  const shouldStartServer = !process.env.PERF_BASE_URL;
  const serverProc = shouldStartServer ? startPreviewServer() : null;

  try {
    await waitForServer(BASE_URL);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    await context.addInitScript(() => {
      window.__pluriPerf = { fcp: 0, lcp: 0, cls: 0, tbt: 0 };
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === "first-contentful-paint") {
              window.__pluriPerf.fcp = entry.startTime;
            }
          }
        }).observe({ type: "paint", buffered: true });

        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) window.__pluriPerf.lcp = last.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              window.__pluriPerf.cls += entry.value;
            }
          }
        }).observe({ type: "layout-shift", buffered: true });

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              window.__pluriPerf.tbt += entry.duration - 50;
            }
          }
        }).observe({ type: "longtask", buffered: true });
      } catch {
        // PerformanceObserver partial support
      }
    });

    const page = await context.newPage();

    if (EMAIL && PASSWORD) {
      console.log(`🔐 Autenticando com ${EMAIL}...`);
      await page.goto(`${BASE_URL}/auth`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
      const emailInput = page.locator('input[type="email"]').first();
      const passInput = page.locator('input[type="password"]').first();
      if (await emailInput.isVisible().catch(() => false)) {
        await emailInput.fill(EMAIL);
        await passInput.fill(PASSWORD);
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(3000);
      }
    } else {
      console.log("⚠️  PERF_TEST_EMAIL / PERF_TEST_PASSWORD não definidos; medindo rotas sem login.");
    }

    const results = [];
    for (const route of ROUTES) {
      results.push(await measureRoute(page, route));
    }

    console.log("\n📊 [INTERNAL PAGES PERFORMANCE AUDIT]");
    console.table(results);

    await browser.close();
  } finally {
    if (serverProc) {
      serverProc.kill("SIGTERM");
    }
  }
}

main().catch((err) => {
  console.error("❌ Erro na auditoria de performance:", err.message);
  process.exit(1);
});
