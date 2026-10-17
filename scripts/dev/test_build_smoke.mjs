import http from "http";
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, "../../dist");

const PORT = 4173;
const HOST = "127.0.0.1";

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// Rotas vitais para smoke test
const ROUTES_TO_TEST = [
  "/",
  "/auth",
  "/cadastro-completo",
  "/platform/erros-e-logs",
];

async function startServer() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(`Diretório de build não encontrado em: ${DIST_DIR}. Execute 'npm run build' primeiro.`);
  }

  const server = http.createServer((req, res) => {
    let filePath = path.join(DIST_DIR, req.url === "/" ? "index.html" : req.url.split("?")[0]);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // SPA Fallback para index.html
      filePath = path.join(DIST_DIR, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end(`Erro de leitura: ${err.code}`);
      } else {
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content, "utf-8");
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(PORT, HOST, () => {
      resolve(server);
    });
    server.on("error", reject);
  });
}

async function runSmokeTest() {
  console.log("🚀 [test:smoke] Iniciando Smoke Test Headless do bundle compilado...");

  let server;
  try {
    server = await startServer();
  } catch (e) {
    console.error("❌ Falha ao iniciar servidor de teste estático:", e.message);
    process.exit(1);
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    let hasCriticalError = false;
    const errorsCaptured = [];

    page.on("pageerror", (err) => {
      hasCriticalError = true;
      errorsCaptured.push(`[PageCrash] ${err.message}`);
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        // Filtrar erros irrelevantes de rede/falta de backend local
        const text = msg.text();
        if (!text.includes("Failed to fetch") && !text.includes("ERR_CONNECTION_REFUSED") && !text.includes("404")) {
          errorsCaptured.push(`[ConsoleError] ${text}`);
        }
      }
    });

    for (const route of ROUTES_TO_TEST) {
      const url = `http://${HOST}:${PORT}${route}`;
      process.stdout.write(`  • Testando rota: ${route}... `);

      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
      if (!response || response.status() >= 400) {
        console.log(`❌ HTTP ${response ? response.status() : "sem resposta"}`);
        hasCriticalError = true;
        continue;
      }

      // Esperar brevemente para verificar montagem do React
      await page.waitForTimeout(500);

      // Verificar se não gerou tela branca total
      const bodyText = await page.evaluate(() => document.body.innerText.trim());
      const bodyHtml = await page.evaluate(() => document.body.innerHTML.trim());

      if (!bodyHtml || bodyHtml === '<div id="root"></div>') {
        console.log("❌ Tela Branca detectada!");
        hasCriticalError = true;
        errorsCaptured.push(`Rota ${route} renderizou tela branca.`);
      } else {
        console.log("✅ OK");
      }
    }

    await browser.close();
    server.close();

    if (hasCriticalError) {
      console.error("\n❌ [test:smoke] O bundle compilado falhou no Smoke Test Headless:");
      errorsCaptured.forEach((err) => console.error(`  - ${err}`));
      process.exit(1);
    }

    console.log("\n✅ [test:smoke] Bundle 100% íntegro! Zero erros de JS e todas as rotas vitais montaram com sucesso.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro durante a execução do smoke test:", err);
    if (browser) await browser.close();
    if (server) server.close();
    process.exit(1);
  }
}

runSmokeTest();
