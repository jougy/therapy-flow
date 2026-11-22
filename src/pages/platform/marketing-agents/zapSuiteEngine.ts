import { normalizePhoneToE164 } from "./antiBanEngine";
import type { MarketingWhatsAppInstance } from "./types";
import type {
  AudienceContactItem,
  KeywordTriggerRecord,
  ZapDefenderMetricItem,
  ZapDefenderReport,
} from "./suiteTypes";

export interface ParsedContactsResult {
  contacts: AudienceContactItem[];
  detectedColumns: string[];
  skippedCount: number;
}

export interface ZapDefenderInput {
  instanceId: string;
  warmupDay: number;
  sent7d: number;
  replied7d: number;
  failed7d: number;
  optOut7d: number;
  disconnects7d: number;
  dailySentCount: number;
  dailyLimit: number;
  status?: MarketingWhatsAppInstance["status"];
}

export interface ExtractiveCompactionResult<T extends { role: string; text: string }> {
  rollingSummary: string;
  structuredFacts: Record<string, string>;
  keptTurns: T[];
  compactedCount: number;
}

const DEFAULT_VAR_FALLBACKS: Record<string, string> = {
  primeiro_nome: "Dr(a).",
  clinica: "sua clínica",
  cidade: "sua região",
};

const PHONE_HEADERS = new Set(["telefone", "phone", "whatsapp", "celular", "fone", "numero", "número", "tel", "mobile"]);
const NAME_HEADERS = new Set(["nome", "name", "contato", "lead", "cliente", "doutor"]);

function detectDelimiter(sampleLines: string[]): string {
  const candidates = ["\t", ";", ","];
  let best = ",";
  let bestScore = 0;
  for (const sep of candidates) {
    const score = sampleLines.reduce((acc, line) => acc + (line.split(sep).length - 1), 0);
    if (score > bestScore) {
      bestScore = score;
      best = sep;
    }
  }
  return bestScore > 0 ? best : ",";
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function normalizeColKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseCsvOrTxtContacts(rawText: string): ParsedContactsResult {
  const lines = (rawText || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { contacts: [], detectedColumns: [], skippedCount: 0 };

  const delimiter = detectDelimiter(lines.slice(0, 5));
  const firstCells = splitDelimitedLine(lines[0], delimiter);
  const normalizedFirst = firstCells.map(normalizeColKey);
  const hasHeader = normalizedFirst.some(
    (col) => PHONE_HEADERS.has(col) || NAME_HEADERS.has(col) || col === "clinica" || col === "cidade",
  );

  const headers = hasHeader
    ? normalizedFirst.map((c, idx) => c || `col_${idx + 1}`)
    : firstCells.length >= 2
      ? ["nome", "telefone", ...firstCells.slice(2).map((_, idx) => `var_${idx + 1}`)]
      : ["telefone"];

  const phoneIdx = headers.findIndex((h) => PHONE_HEADERS.has(h));
  const nameIdx = headers.findIndex((h) => NAME_HEADERS.has(h));
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const deduped = new Map<string, AudienceContactItem>();
  let skippedCount = 0;

  for (const line of dataLines) {
    const cells = splitDelimitedLine(line, delimiter);
    const rawPhone =
      (phoneIdx >= 0 ? cells[phoneIdx] : "") ||
      cells.find((c) => c.replace(/\D/g, "").length >= 10) ||
      "";
    const phoneE164 = normalizePhoneToE164(rawPhone);
    if (phoneE164.length < 10) {
      skippedCount++;
      continue;
    }

    const vars: Record<string, string> = {};
    headers.forEach((col, idx) => {
      if (idx === phoneIdx) return;
      const val = (cells[idx] || "").trim();
      if (val) vars[col] = val;
    });

    const explicitName = (nameIdx >= 0 ? cells[nameIdx] : vars.nome || vars.name || "").trim();
    const fallbackName = explicitName || `Contato ${phoneE164.slice(-4)}`;
    if (explicitName && !vars.primeiro_nome) {
      vars.primeiro_nome = explicitName.split(/\s+/)[0] || explicitName;
    }

    const existing = deduped.get(phoneE164);
    if (existing) {
      const mergedVars = { ...existing.vars };
      for (const [k, v] of Object.entries(vars)) {
        if (v && !mergedVars[k]) mergedVars[k] = v;
      }
      deduped.set(phoneE164, {
        ...existing,
        name: existing.name.startsWith("Contato ") && explicitName ? explicitName : existing.name,
        vars: mergedVars,
      });
    } else {
      deduped.set(phoneE164, { phoneE164, name: fallbackName, vars, isValidWhatsapp: null });
    }
  }

  return { contacts: Array.from(deduped.values()), detectedColumns: headers, skippedCount };
}

export function interpolateDynamicVars(template: string, vars: Record<string, string>): string {
  const lowerVars: Record<string, string> = {};
  for (const [key, val] of Object.entries(vars || {})) {
    if (typeof val === "string" && val.trim()) lowerVars[key.trim().toLowerCase()] = val.trim();
  }
  if (!lowerVars.primeiro_nome && lowerVars.nome) {
    lowerVars.primeiro_nome = lowerVars.nome.split(/\s+/)[0] || lowerVars.nome;
  }
  return (template || "").replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, (_match, rawKey: string) => {
    const key = rawKey.toLowerCase();
    return lowerVars[key] || DEFAULT_VAR_FALLBACKS[key] || "";
  });
}

function metricStatus(score: number, maxScore: number): "ok" | "warn" | "risk" {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  return ratio >= 0.75 ? "ok" : ratio >= 0.45 ? "warn" : "risk";
}

export function computeZapDefenderReport(input: ZapDefenderInput): ZapDefenderReport {
  const recommendations: string[] = [];
  const sent = Math.max(0, input.sent7d);
  const warmupDay = Math.max(1, input.warmupDay);

  const warmupScore = Math.min(20, Math.round((Math.min(14, warmupDay) / 14) * 20));
  if (warmupScore < 12) recommendations.push("Mantenha o aquecimento gradual antes de escalar disparos em massa.");

  const replyRate = sent > 0 ? input.replied7d / sent : 0.25;
  const replyScore = sent === 0 ? 12 : Math.min(15, Math.round((replyRate / 0.25) * 15));
  if (sent >= 20 && replyRate < 0.1) recommendations.push("Taxa de resposta abaixo de 10%: refine a abordagem inicial e use Spintax.");

  const errorRate = sent > 0 ? (input.failed7d / sent) * 100 : 0;
  const errorScore = errorRate <= 1 ? 20 : errorRate <= 3 ? 14 : errorRate <= 5 ? 8 : 2;
  if (errorRate > 3) recommendations.push("Valide os números no Filtro Turbo antes de enviar para reduzir falhas.");

  const optOutRate = sent > 0 ? (input.optOut7d / sent) * 100 : 0;
  const optOutScore = optOutRate <= 1 ? 20 : optOutRate <= 2.5 ? 14 : optOutRate <= 5 ? 7 : 1;
  if (optOutRate > 2.5) recommendations.push("Opt-out elevado: segmente melhor o ICP e reduza cadência diária.");

  const stabilityPenalty =
    input.status === "circuit_broken" || input.status === "banned" ? 10 : Math.min(10, input.disconnects7d * 3);
  const stabilityScore = Math.max(0, 10 - stabilityPenalty);
  if (stabilityScore < 7) recommendations.push("Instabilidade de conexão detectada: verifique pareamento e rede do chip.");

  const limit = Math.max(1, input.dailyLimit);
  const usedRatio = Math.min(1.2, Math.max(0, input.dailySentCount / limit));
  const quotaScore = usedRatio <= 0.7 ? 15 : usedRatio <= 0.9 ? 11 : usedRatio <= 1 ? 6 : 2;
  if (usedRatio > 0.85) recommendations.push("Cota diária próxima do limite: distribua o envio em pool multi-chip.");

  const metrics: ZapDefenderMetricItem[] = [
    { key: "warmup_maturity", label: "Maturação do Chip", score: warmupScore, maxScore: 20, status: metricStatus(warmupScore, 20), detail: `Dia ${warmupDay} de aquecimento` },
    { key: "reply_ratio", label: "Razão Enviadas/Respondidas", score: replyScore, maxScore: 15, status: metricStatus(replyScore, 15), detail: sent > 0 ? `${Math.round(replyRate * 100)}% de resposta em 7d` : "Sem histórico 7d" },
    { key: "error_rate_7d", label: "Taxa de Erro 7d", score: errorScore, maxScore: 20, status: metricStatus(errorScore, 20), detail: `${errorRate.toFixed(1)}% de falhas` },
    { key: "opt_out_rate", label: "Taxa de Opt-Out LGPD", score: optOutScore, maxScore: 20, status: metricStatus(optOutScore, 20), detail: `${optOutRate.toFixed(1)}% de descadastros` },
    { key: "session_stability", label: "Estabilidade de Sessão", score: stabilityScore, maxScore: 10, status: metricStatus(stabilityScore, 10), detail: `${input.disconnects7d} queda(s) em 7d` },
    { key: "daily_quota_margin", label: "Margem da Cota Diária", score: quotaScore, maxScore: 15, status: metricStatus(quotaScore, 15), detail: `${input.dailySentCount}/${input.dailyLimit} enviados hoje` },
  ];

  const overallScore = Math.max(0, Math.min(100, metrics.reduce((sum, item) => sum + item.score, 0)));
  const riskLevel = overallScore >= 80 ? "safe" : overallScore >= 55 ? "warning" : "high_risk";
  if (recommendations.length === 0) recommendations.push("Chip saudável e em conformidade anti-ban para operar normalmente.");

  return { instanceId: input.instanceId, overallScore, riskLevel, metrics, recommendations, createdAt: new Date().toISOString() };
}

export function selectWeightedChipInstance(
  pool: MarketingWhatsAppInstance[],
  leadPhone: string,
  affinityMap?: Record<string, string>,
): MarketingWhatsAppInstance | null {
  const nonBlocked = pool.filter(
    (inst) => inst.status !== "circuit_broken" && inst.status !== "banned" && inst.daily_limit - inst.daily_sent_count > 0,
  );
  if (nonBlocked.length === 0) return null;

  const healthyOnline = nonBlocked.filter((inst) => inst.status === "connected" || inst.status === "qr_ready");
  const candidates = healthyOnline.length > 0 ? healthyOnline : nonBlocked;

  const normalizedPhone = normalizePhoneToE164(leadPhone);
  const preferredId = affinityMap?.[normalizedPhone] || affinityMap?.[leadPhone];
  if (preferredId) {
    const affinityMatch = candidates.find((inst) => inst.id === preferredId);
    if (affinityMatch) return affinityMatch;
  }

  return (
    [...candidates].sort((a, b) => {
      const scoreA = (a.daily_limit - a.daily_sent_count) * Math.max(1, a.health_score);
      const scoreB = (b.daily_limit - b.daily_sent_count) * Math.max(1, b.health_score);
      return scoreB !== scoreA ? scoreB - scoreA : a.id.localeCompare(b.id);
    })[0] ?? null
  );
}

export function evaluateKeywordTriggers(
  messageText: string,
  triggers: KeywordTriggerRecord[],
): KeywordTriggerRecord | null {
  const normalized = (messageText || "").trim();
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  const activeSorted = triggers
    .filter((t) => t.isActive && t.pattern.trim().length > 0)
    .sort((a, b) => a.priority - b.priority);

  for (const trigger of activeSorted) {
    const pattern = trigger.pattern.trim();
    const patternLower = pattern.toLowerCase();
    if (trigger.matchType === "exact" && lower === patternLower) return trigger;
    if (trigger.matchType === "contains" && lower.includes(patternLower)) return trigger;
    if (trigger.matchType === "starts_with" && lower.startsWith(patternLower)) return trigger;
    if (trigger.matchType === "regex") {
      try {
        if (new RegExp(pattern, "i").test(normalized)) return trigger;
      } catch {
        // Ignora regex malformada criada pelo usuário
      }
    }
  }
  return null;
}

export function estimateMessagesTokens(messages: Array<{ text: string }>): number {
  return messages.reduce((sum, msg) => sum + Math.ceil((msg.text || "").length / 4) + 4, 0);
}

export function shouldCompactContext(messages: Array<{ text: string }>, maxMsgs = 8, maxTokensEst = 1800): boolean {
  return messages.length > maxMsgs || estimateMessagesTokens(messages) > maxTokensEst;
}

function extractFactsFromText(text: string, target: Record<string, string>): void {
  const nameMatch = text.match(/(?:me chamo|meu nome [eé]|sou (?:o|a)?)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i);
  if (nameMatch?.[1] && !target.nome) target.nome = nameMatch[1].trim();
  const clinicMatch = text.match(/(?:cl[ií]nica|est[uú]dio|consult[oó]rio)\s+([A-ZÀ-Ú0-9][\wÀ-ú\s]{2,30})/i);
  if (clinicMatch?.[1] && !target.clinica) target.clinica = clinicMatch[1].trim();
  const cityMatch = text.match(/(?:cidade de|moro em|atendo em|somos de)\s+([A-ZÀ-Ú][a-zà-ú\s]{2,25})/i);
  if (cityMatch?.[1] && !target.cidade) target.cidade = cityMatch[1].trim();
  const teamMatch = text.match(/(\d+\s*(?:fisios?|fisioterapeutas?|profissionais|pessoas)|sozinho)/i);
  if (teamMatch?.[1]) target.equipe = teamMatch[1].trim();
  const painMatch = text.match(/(prontu[aá]rio|agenda|planilha|faturamento|repasse|whatsapp|evolu[cç][aã]o)/i);
  if (painMatch?.[1]) target.dor_principal = painMatch[1].toLowerCase();
  const interestMatch = text.match(/(demo(?:nstra[cç][aã]o)?|pre[cç]o|valor|plano|testar|agendar)/i);
  if (interestMatch?.[1]) target.interesse = interestMatch[1].toLowerCase();
}

export function buildLocalExtractiveCompaction<T extends { role: string; text: string }>(
  prevSummary: string | undefined,
  prevFacts: Record<string, string> | undefined,
  turns: T[],
  keepLast = 4,
): ExtractiveCompactionResult<T> {
  const safeKeep = Math.max(1, keepLast);
  if (turns.length <= safeKeep) {
    return { rollingSummary: (prevSummary || "").slice(0, 900), structuredFacts: { ...(prevFacts || {}) }, keptTurns: turns, compactedCount: 0 };
  }
  const cutoff = turns.length - safeKeep;
  const olderTurns = turns.slice(0, cutoff);
  const keptTurns = turns.slice(cutoff);
  const structuredFacts: Record<string, string> = { ...(prevFacts || {}) };
  const lines: string[] = [];
  if (prevSummary?.trim()) lines.push(prevSummary.trim());

  for (const turn of olderTurns) {
    const clean = (turn.text || "").replace(/\s+/g, " ").trim();
    if (!clean) continue;
    const isLead = turn.role === "lead" || turn.role === "inbound";
    if (isLead) extractFactsFromText(clean, structuredFacts);
    lines.push(`${isLead ? "Lead" : "IA"}: ${clean.slice(0, 120)}`);
  }

  const combined = lines.join(" | ");
  const rollingSummary = combined.length > 900 ? combined.slice(combined.length - 897) : combined;
  return { rollingSummary, structuredFacts, keptTurns, compactedCount: olderTurns.length };
}

export function splitHumanizedBalloons(replyText: string, maxChars = 450): string[] {
  const normalized = (replyText || "").trim();
  if (!normalized) return [];
  const limit = Math.max(80, maxChars);
  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const balloons: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= limit) {
      balloons.push(para);
      continue;
    }
    const sentences = para.split(/(?<=[.!?])\s+/).filter(Boolean);
    let buffer = "";
    for (const sentence of sentences) {
      if (sentence.length > limit) {
        if (buffer) {
          balloons.push(buffer);
          buffer = "";
        }
        let chunk = "";
        for (const word of sentence.split(/\s+/)) {
          const next = chunk ? `${chunk} ${word}` : word;
          if (next.length > limit) {
            if (chunk) balloons.push(chunk);
            chunk = word;
          } else {
            chunk = next;
          }
        }
        if (chunk) balloons.push(chunk);
        continue;
      }
      const candidate = buffer ? `${buffer} ${sentence}` : sentence;
      if (candidate.length > limit) {
        if (buffer) balloons.push(buffer);
        buffer = sentence;
      } else {
        buffer = candidate;
      }
    }
    if (buffer) balloons.push(buffer);
  }
  return balloons;
}
