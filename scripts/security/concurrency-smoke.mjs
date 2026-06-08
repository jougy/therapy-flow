import { assertLocalTarget, normalizeBaseUrl, summarizeFindings, writeReport } from "./common.mjs";

const baseUrl = normalizeBaseUrl(process.env.ATTACK_BASE_URL);
assertLocalTarget(baseUrl, "frontend");

const totalRequests = Number(process.env.ATTACK_REQUESTS || 60);
const concurrency = Number(process.env.ATTACK_CONCURRENCY || 10);
const path = process.env.ATTACK_PATH || "/";

const runOne = async (index) => {
  const startedAt = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        "x-attack-smoke-index": String(index),
      },
    });
    const text = await response.text();
    return {
      index,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      bodyLength: text.length,
      severity: response.status >= 500 ? "medium" : "ok",
      notes: response.status >= 500 ? ["Resposta 5xx durante smoke de concorrencia."] : [],
    };
  } catch (error) {
    return {
      index,
      status: null,
      durationMs: Math.round(performance.now() - startedAt),
      severity: "medium",
      notes: [`Falha na requisicao: ${error.message}`],
    };
  }
};

const runPool = async () => {
  const checks = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, totalRequests) }, async () => {
    while (next < totalRequests) {
      const index = next;
      next += 1;
      checks.push(await runOne(index));
    }
  });
  await Promise.all(workers);
  checks.sort((a, b) => a.index - b.index);
  return checks;
};

const checks = await runPool();
const durations = checks.map((check) => check.durationMs).sort((a, b) => a - b);
const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
const report = {
  target: `${baseUrl}${path}`,
  totalRequests,
  concurrency,
  createdAt: new Date().toISOString(),
  p95DurationMs: p95,
  summary: summarizeFindings(checks),
  checks,
};

const filePath = await writeReport("concurrency-smoke", report);
console.log(JSON.stringify({ report: filePath, p95DurationMs: p95, summary: report.summary }, null, 2));
