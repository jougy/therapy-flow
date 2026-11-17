import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function hasBinary(bin) {
  try {
    await execFileAsync("which", [bin], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export async function runWafw00f(baseUrl) {
  if (process.env.BENCH_SKIP_WAFW00F === "1") {
    return { available: false, skipped: true, detectedWaf: null };
  }
  if (!(await hasBinary("wafw00f"))) {
    return { available: false, skipped: true, detectedWaf: null };
  }
  try {
    const { stdout } = await execFileAsync("wafw00f", [baseUrl, "-f", "json", "-o", "-"], { timeout: 15000 });
    const parsed = JSON.parse(stdout || "[]");
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    return {
      available: true,
      skipped: false,
      detectedWaf: first?.firewall && first.firewall !== "None" ? first.firewall : "Nenhum detectado",
    };
  } catch {
    return { available: true, skipped: false, detectedWaf: "Erro ao executar" };
  }
}

export async function runNucleiAudit(url, cookieHeader = "") {
  if (process.env.BENCH_SKIP_NUCLEI === "1") {
    return { available: false, skipped: true, critical: 0, high: 0, medium: 0, low: 0 };
  }
  if (!(await hasBinary("nuclei"))) {
    return { available: false, skipped: true, critical: 0, high: 0, medium: 0, low: 0 };
  }
  try {
    const args = ["-u", url, "-jsonl", "-silent", "-severity", "low,medium,high,critical", "-timeout", "5"];
    if (cookieHeader) args.push("-H", `Cookie: ${cookieHeader}`);
    const { stdout } = await execFileAsync("nuclei", args, { timeout: 20000 });
    const counts = { available: true, skipped: false, critical: 0, high: 0, medium: 0, low: 0 };
    for (const line of stdout.split("\n").filter(Boolean)) {
      try {
        const sev = JSON.parse(line)?.info?.severity?.toLowerCase();
        if (sev && sev in counts) counts[sev] += 1;
      } catch {
        // ignore malformed jsonl line
      }
    }
    return counts;
  } catch {
    return { available: true, skipped: false, critical: 0, high: 0, medium: 0, low: 0 };
  }
}

export async function runZapBaseline(url) {
  if (process.env.BENCH_SKIP_ZAP === "1") {
    return { available: false, skipped: true, high: 0, medium: 0, low: 0 };
  }
  const hasZapCli = await hasBinary("zap-baseline.py");
  if (!hasZapCli && process.env.BENCH_ZAP !== "1") {
    return { available: false, skipped: true, high: 0, medium: 0, low: 0 };
  }
  if (!hasZapCli) {
    return { available: false, skipped: true, high: 0, medium: 0, low: 0 };
  }
  try {
    const { stdout } = await execFileAsync("zap-baseline.py", ["-t", url, "-m", "1", "-I"], { timeout: 30000 });
    const high = (stdout.match(/FAIL-NEW/g) || []).length;
    const medium = (stdout.match(/WARN-NEW/g) || []).length;
    return { available: true, skipped: false, high, medium, low: 0 };
  } catch {
    return { available: true, skipped: false, high: 0, medium: 0, low: 0 };
  }
}

export async function runNativeSecurityProbes(url, cookieHeader = "") {
  const result = {
    headersPresent: 0,
    headersTotal: 6,
    corsPermissive: false,
    wafBlockedCount: 0,
    wafProbesTotal: 3,
    rateLimited: false,
    rateLimitHeaders: false,
  };

  const baseHeaders = cookieHeader ? { Cookie: cookieHeader } : {};

  try {
    const res = await fetch(url, {
      headers: { ...baseHeaders, Origin: "https://evil-bench-probe.example" },
      signal: AbortSignal.timeout(5000),
    });
    const h = res.headers;
    const secHeaders = [
      "content-security-policy",
      "strict-transport-security",
      "x-frame-options",
      "x-content-type-options",
      "referrer-policy",
      "permissions-policy",
    ];
    result.headersPresent = secHeaders.filter((name) => Boolean(h.get(name))).length;
    const acao = h.get("access-control-allow-origin");
    const acac = h.get("access-control-allow-credentials");
    result.corsPermissive = Boolean((acao === "*" || acao === "https://evil-bench-probe.example") && acac === "true");
    result.rateLimitHeaders = Boolean(h.get("x-ratelimit-limit") || h.get("ratelimit-limit") || h.get("retry-after"));
  } catch {
    // ignore network error
  }

  const payloads = [
    "?bench_waf=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
    "?bench_waf=1%27%20OR%20%271%27%3D%271",
    "?bench_waf=..%2F..%2Fetc%2Fpasswd",
  ];
  for (const qs of payloads) {
    try {
      const r = await fetch(`${url}${qs}`, { headers: baseHeaders, signal: AbortSignal.timeout(4000) });
      if ([403, 406, 429].includes(r.status)) result.wafBlockedCount += 1;
    } catch {
      // ignore
    }
  }

  try {
    const burst = await Promise.all(
      Array.from({ length: 6 }, () => fetch(url, { headers: baseHeaders, signal: AbortSignal.timeout(4000) }))
    );
    result.rateLimited = burst.some((r) => r.status === 429);
  } catch {
    // ignore
  }

  return result;
}
