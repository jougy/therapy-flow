import { chromium } from "@playwright/test";
import { assertLocalTarget, normalizeBaseUrl, summarizeFindings, writeReport } from "./common.mjs";
import { routePayloads, textPayloads } from "./payloads.mjs";

const baseUrl = normalizeBaseUrl(process.env.ATTACK_BASE_URL);
assertLocalTarget(baseUrl, "frontend");

const forbiddenProtectedText = [
  "Pacientes recentes",
  "Novo Paciente",
  "Gerenciar formulários",
  "Grupos & Atendimentos",
  "Resumo geral",
];

const ignoredConsolePatterns = [
  /React Router Future Flag Warning/i,
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const auditRoute = async (page, path) => {
  const url = `${baseUrl}${path}`;
  const consoleMessages = [];
  page.on("console", (message) => {
    const text = message.text();
    if (["error", "warning"].includes(message.type()) && !ignoredConsolePatterns.some((pattern) => pattern.test(text))) {
      consoleMessages.push(`${message.type()}: ${text}`);
    }
  });

  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    await sleep(300);

    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    const leakedProtectedText = forbiddenProtectedText.filter((text) => bodyText.includes(text));
    const hasErrorBoundary = bodyText.includes("Algo deu errado nesta tela");
    const isProtectedProbe = !["/", "/auth", "/clinicas"].includes(path);

    let severity = "ok";
    const notes = [];
    if (isProtectedProbe && leakedProtectedText.length > 0) {
      severity = "high";
      notes.push(`Conteudo protegido aparente sem fluxo autorizado: ${leakedProtectedText.join(", ")}`);
    }
    if (hasErrorBoundary) {
      severity = severity === "high" ? "high" : "medium";
      notes.push("A rota abriu a tela de erro global.");
    }
    if (consoleMessages.length > 0) {
      severity = severity === "ok" ? "low" : severity;
      notes.push("Console registrou erros/avisos.");
    }

    return {
      type: "route",
      path,
      status: response?.status() ?? null,
      finalUrl: page.url(),
      title: await page.title(),
      severity,
      notes,
      leakedProtectedText,
      consoleMessages: consoleMessages.slice(0, 10),
    };
  } catch (error) {
    return {
      type: "route",
      path,
      severity: "medium",
      notes: [`Falha ao abrir rota: ${error.message}`],
      finalUrl: page.url(),
    };
  } finally {
    page.removeAllListeners("console");
  }
};

const auditAuthInputs = async (page) => {
  await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle", timeout: 15000 });
  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (!bodyText.includes("Entrar")) {
    return [
      {
        type: "input",
        target: "/auth",
        severity: "low",
        notes: ["Tela de auth nao parece estar disponivel para fuzz de inputs."],
      },
    ];
  }

  const checks = [];
  const emailInput = page.locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  for (const payload of textPayloads.slice(0, 5)) {
    try {
      await emailInput.fill(String(payload.value).slice(0, 512));
      await passwordInput.fill(String(payload.value).slice(0, 128));
      await page.keyboard.press("Enter");
      await sleep(250);
      const nextBody = await page.locator("body").innerText().catch(() => "");
      checks.push({
        type: "input",
        target: "/auth",
        payload: payload.name,
        severity: nextBody.includes("<script>") || nextBody.includes("onerror=") ? "high" : "ok",
        notes: nextBody.includes("<script>") || nextBody.includes("onerror=")
          ? ["Payload apareceu renderizado como texto bruto perigoso."]
          : [],
      });
    } catch (error) {
      checks.push({
        type: "input",
        target: "/auth",
        payload: payload.name,
        severity: "low",
        notes: [`Fuzz de input interrompido: ${error.message}`],
      });
    }
  }
  return checks;
};

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const checks = [];

  for (const path of routePayloads) {
    checks.push(await auditRoute(page, path));
  }

  checks.push(...(await auditAuthInputs(page)));
  await browser.close();

  const report = {
    target: baseUrl,
    createdAt: new Date().toISOString(),
    summary: summarizeFindings(checks),
    checks,
  };
  const filePath = await writeReport("browser-route-audit", report);
  console.log(JSON.stringify({ report: filePath, summary: report.summary }, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
