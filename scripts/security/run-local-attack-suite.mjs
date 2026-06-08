import { spawn } from "node:child_process";
import { assertLocalTarget, normalizeBaseUrl, writeReport } from "./common.mjs";

const baseUrl = normalizeBaseUrl(process.env.ATTACK_BASE_URL);
assertLocalTarget(baseUrl, "frontend");

const scripts = [
  "generate-payload-corpus.mjs",
  "concurrency-smoke.mjs",
  "supabase-public-surface-audit.mjs",
  "browser-route-audit.mjs",
];

const runScript = (script) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [`scripts/security/${script}`], {
      cwd: process.cwd(),
      env: { ...process.env, ATTACK_BASE_URL: baseUrl },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("close", (code) => {
      resolve({ script, code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });

const results = [];
for (const script of scripts) {
  results.push(await runScript(script));
}

const failed = results.filter((result) => result.code !== 0);
const report = {
  target: baseUrl,
  createdAt: new Date().toISOString(),
  status: failed.length > 0 ? "attention_required" : "completed",
  results,
};
const filePath = await writeReport("local-attack-suite", report);

console.log(JSON.stringify({ report: filePath, failedScripts: failed.map((result) => result.script) }, null, 2));

if (failed.length > 0) {
  process.exit(1);
}
