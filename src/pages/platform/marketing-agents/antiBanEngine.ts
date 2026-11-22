const OPT_OUT_PATTERNS = [
  /\b(sair|parar|pare|stop|cancelar|descadastrar|remover da lista)\b/i,
  /\b(n[aã]o quero|n[aã]o tenho interesse|pare de mandar)\b/i,
];

export function normalizePhoneToE164(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits;
  }
  return digits;
}

export function formatPhoneBr(e164OrDigits: string): string {
  const e164 = normalizePhoneToE164(e164OrDigits);
  const local = e164.startsWith("55") && e164.length >= 12 ? e164.slice(2) : e164;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return e164OrDigits;
}

export function getWarmupDailyLimit(warmupDay: number): number {
  const day = Math.max(1, Math.floor(warmupDay));
  if (day <= 3) return 15;
  if (day <= 7) return 35;
  if (day <= 14) return 80;
  return 150;
}

export function getWarmupPhaseLabel(warmupDay: number): string {
  const day = Math.max(1, Math.floor(warmupDay));
  if (day <= 3) return "Fase 1 — Inicial (15/dia)";
  if (day <= 7) return "Fase 2 — Tração (35/dia)";
  if (day <= 14) return "Fase 3 — Consolidação (80/dia)";
  return "Fase 4 — Madura (150/dia)";
}

export function computeGaussianDelayMs(
  meanSec: number,
  stddevSec: number,
  rng: () => number = Math.random,
): number {
  const u1 = Math.max(1e-7, rng());
  const u2 = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const rawMs = Math.round((meanSec + z0 * stddevSec) * 1000);
  return Math.max(15_000, Math.min(180_000, rawMs));
}

export function computeTypingDurationMs(text: string): number {
  const chars = (text || "").trim().length;
  return Math.max(1800, Math.min(9000, chars * 45));
}

function parseMinutesOfDay(hhmm: string): number {
  const [hStr, mStr] = (hhmm || "08:30").split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 8 * 60 + 30;
  return h * 60 + m;
}

export function isInsideBusinessWindow(
  date: Date,
  startHHMM: string,
  endHHMM: string,
  allowedDays: number[],
): boolean {
  const day = date.getDay();
  if (!allowedDays.includes(day)) return false;
  const mins = date.getHours() * 60 + date.getMinutes();
  const start = parseMinutesOfDay(startHHMM);
  const end = parseMinutesOfDay(endHHMM);
  return mins >= start && mins <= end;
}

export function isOptOutMessage(text: string): boolean {
  const normalized = (text || "").trim();
  if (!normalized) return false;
  return OPT_OUT_PATTERNS.some((re) => re.test(normalized));
}

export function resolveSpintax(template: string, rng: () => number = Math.random): string {
  let output = template || "";
  let depth = 0;
  const spintaxRe = /(?<!\{)\{([^{}]*\|[^{}]*)\}(?!\})/g;
  while (spintaxRe.test(output) && depth < 12) {
    spintaxRe.lastIndex = 0;
    output = output.replace(spintaxRe, (_full, group: string) => {
      const options = group.split("|");
      const index = Math.min(options.length - 1, Math.floor(rng() * options.length));
      return options[index] ?? "";
    });
    spintaxRe.lastIndex = 0;
    depth++;
  }
  return output;
}

export function interpolateLeadTemplate(
  template: string,
  vars: { primeiro_nome?: string; clinica?: string; cidade?: string },
): string {
  return (template || "")
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, vars.primeiro_nome || "Dr(a).")
    .replace(/\{\{\s*clinica\s*\}\}/gi, vars.clinica || "sua clínica")
    .replace(/\{\{\s*cidade\s*\}\}/gi, vars.cidade || "sua região");
}

export function shouldTripCircuitBreaker(
  sentLastHour: number,
  failedOrOptOutLastHour: number,
  thresholdPct = 5,
): boolean {
  if (sentLastHour < 10) return false;
  const ratePct = (failedOrOptOutLastHour / sentLastHour) * 100;
  return ratePct > thresholdPct;
}

export function estimateCampaignMinutes(
  targetCount: number,
  meanSec: number,
  blockSize: number,
  blockPauseMin: number,
): number {
  if (targetCount <= 0) return 0;
  const sendSec = targetCount * Math.max(15, meanSec);
  const blocks = Math.floor(Math.max(0, targetCount - 1) / Math.max(1, blockSize));
  const pauseSec = blocks * Math.max(1, blockPauseMin) * 60;
  return Math.max(1, Math.ceil((sendSec + pauseSec) / 60));
}
