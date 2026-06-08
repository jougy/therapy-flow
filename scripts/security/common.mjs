import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "../..");
export const reportsDir = join(repoRoot, "core/security-reports");

export const timestamp = () => new Date().toISOString().replace(/[:.]/g, "-");

export const normalizeBaseUrl = (value) => {
  const raw = value || "http://localhost:8080";
  const url = new URL(raw);
  url.hash = "";
  return url.toString().replace(/\/$/, "");
};

export const isLocalUrl = (value) => {
  const hostname = new URL(value).hostname;
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
};

export const assertLocalTarget = (value, label = "target") => {
  if (isLocalUrl(value) || process.env.ALLOW_NON_LOCAL_ATTACK_TARGET === "1") {
    return;
  }

  throw new Error(
    `Recusei executar contra ${label} nao local (${value}). ` +
      "Defina ALLOW_NON_LOCAL_ATTACK_TARGET=1 apenas em ambiente controlado e autorizado."
  );
};

const parseEnvFile = async (path) => {
  if (!existsSync(path)) return {};
  const content = await readFile(path, "utf8");
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key, rest.join("=").trim().replace(/^["']|["']$/g, "")];
      })
  );
};

export const loadAppEnv = async () => {
  const localEnv = await parseEnvFile(join(repoRoot, ".env.local"));
  const rootEnv = await parseEnvFile(join(repoRoot, ".env"));
  return {
    ...rootEnv,
    ...localEnv,
    ...process.env,
  };
};

export const writeReport = async (name, data) => {
  await mkdir(reportsDir, { recursive: true });
  const filePath = join(reportsDir, `${name}-${timestamp()}.json`);
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return filePath;
};

export const summarizeFindings = (checks) => {
  const findings = checks.filter((check) => check.severity && check.severity !== "ok");
  const bySeverity = findings.reduce((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalChecks: checks.length,
    totalFindings: findings.length,
    bySeverity,
  };
};

export const safeJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 500);
  }
};
