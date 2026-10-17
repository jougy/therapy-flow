import type { RuntimeDebugEvent } from "@/lib/runtime-debug";
import type { GroupedIssue, WhatsAppBugContext } from "./types";
import type { TelemetryBreadcrumb } from "@/lib/telemetry-breadcrumbs";

/**
 * Helper para verificar se um evento tem origem no WhatsApp
 */
export const isWhatsAppBugReport = (ev: RuntimeDebugEvent): boolean => {
  if (ev.context?.source === "whatsapp_bug_report") return true;
  if (ev.scope === "whatsapp_bug_report" || ev.scope.includes("whatsapp")) return true;
  return false;
};

/**
 * Formata telefone brasileiro amigavelmente: (11) 99999-9999
 */
export const formatWhatsAppPhone = (phone?: string): string => {
  if (!phone) return "Telefone não informado";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 13 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const num = digits.slice(4);
    return `+55 (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
  }
  return phone;
};

/**
 * Valida se uma URL é HTTP ou HTTPS legítima, prevenindo esquemas perigosos como javascript: ou data:
 */
export const isSafeHttpUrl = (url?: string | null): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Gera URL direta do WhatsApp (wa.me/55...)
 */
export const getWhatsAppDeepLink = (phone?: string, leadName?: string): string => {
  if (!phone) return "#";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "#";
  const fullDigits = digits.startsWith("55") ? digits : `55${digits}`;
  const greeting = leadName ? `Olá ${leadName}, tudo bem?` : "Olá, tudo bem?";
  const text = `${greeting} Vi o seu relato de suporte/erro no Pluri-Health e estou entrando em contato para te ajudar.`;
  return `https://wa.me/${fullDigits}?text=${encodeURIComponent(text)}`;
};

/**
 * Agrupa eventos individuais em Issues únicas por fingerprint
 */
export const groupEventsIntoIssues = (events: RuntimeDebugEvent[]): GroupedIssue[] => {
  const issueMap = new Map<string, GroupedIssue>();

  for (const ev of events) {
    // Erros de WhatsApp não agrupam para não mesclar mensagens de pacientes distintos
    if (isWhatsAppBugReport(ev)) continue;

    // Normaliza mensagem para criar fingerprint estável
    const cleanMsg = ev.message.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ":id");
    const fingerprint = `${ev.scope}::${cleanMsg}`;

    const ctx = (ev.context || {}) as Record<string, unknown>;
    const env = (ctx.environment || {}) as { os?: string; deviceType?: string };
    const breadcrumbs = (Array.isArray(ctx.breadcrumbs) ? ctx.breadcrumbs : []) as TelemetryBreadcrumb[];

    const userId = (ctx.user_id as string) || (ctx.userId as string) || "anônimo";
    const clinicId = (ctx.clinic_id as string) || (ctx.clinicId as string) || "consultório";
    const deviceStr = env.os ? `${env.os} (${env.deviceType || "desktop"})` : "Web";

    const existing = issueMap.get(fingerprint);
    if (existing) {
      existing.count += 1;
      existing.lastSeen = Math.max(existing.lastSeen, ev.timestamp);
      existing.firstSeen = Math.min(existing.firstSeen, ev.timestamp);
      existing.affectedUsers.add(userId);
      existing.affectedClinics.add(clinicId);
      existing.devices.add(deviceStr);
      if (breadcrumbs.length > 0) {
        existing.breadcrumbs = breadcrumbs;
      }
    } else {
      issueMap.set(fingerprint, {
        fingerprint,
        scope: ev.scope,
        message: ev.message,
        stack: ev.errorDetails?.stack,
        type: ev.type,
        count: 1,
        firstSeen: ev.timestamp,
        lastSeen: ev.timestamp,
        lastTimeString: ev.timeString,
        affectedUsers: new Set([userId]),
        affectedClinics: new Set([clinicId]),
        devices: new Set([deviceStr]),
        latestEvent: ev,
        breadcrumbs,
      });
    }
  }

  return Array.from(issueMap.values()).sort((a, b) => b.lastSeen - a.lastSeen);
};

/**
 * Gera um prompt formatado pronto para envio/diagnóstico no Antigravity
 */
export const generateAntigravityDiagnosticPrompt = (issue: GroupedIssue): string => {
  const steps = issue.breadcrumbs.length > 0
    ? issue.breadcrumbs.map((b) => `  - [${b.timeString}] (${b.category}): ${b.message}`).join("\n")
    : "  - (Nenhum breadcrumb registrado)";

  return `### Relato de Investigação de Bug para Antigravity

**Erro:** \`${issue.message}\`
**Escopo/Módulo:** \`${issue.scope}\`
**Ocorrências:** ${issue.count}x
**Dispositivos Afetados:** ${Array.from(issue.devices).join(", ")}

#### Últimos Passos do Usuário (Breadcrumbs):
${steps}

${issue.stack ? `#### Stack Trace:\n\`\`\`\n${issue.stack}\n\`\`\`` : ""}

**Instrução para o Antigravity:**
Por favor, analise a causa raiz deste erro no código, identifique o arquivo e a linha onde a quebra ocorreu e proponha uma correção cirúrgica com prevenção de regressão.`;
};
