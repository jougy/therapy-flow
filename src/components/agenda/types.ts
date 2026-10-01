import type {
  AgendaEventItem,
  AgendaEventStatus,
  AgendaEventType,
  AgendaPatientOption,
} from "@/lib/agenda-events";

export type { AgendaEventItem, AgendaEventStatus, AgendaEventType, AgendaPatientOption };

/**
 * Modos de visualização suportados pela agenda modular.
 */
export type AgendaViewMode = "year" | "month" | "week" | "day";

/**
 * Turnos do dia para visualização na agenda (Madrugada, Manhã, Tarde, Noite).
 */
export type AgendaShift = "dawn" | "morning" | "afternoon" | "evening";

/**
 * Rótulos descritivos dos tipos de eventos da agenda.
 */
export const eventTypeLabels: Record<AgendaEventType, string> = {
  atendimento: "Atendimento",
  reuniao: "Reunião",
  evento: "Evento",
};

/**
 * Rótulos amigáveis para os status de agendamentos.
 */
export const agendaStatusLabels: Record<AgendaEventStatus, string> = {
  aguardando_confirmacao: "Aguardando",
  cancelado: "Cancelado",
  confirmado: "Confirmado",
  lembrete: "Lembrete",
};

/**
 * Estilos Tailwind CSS para as badges de status.
 */
export const statusBadgeStyles: Record<AgendaEventStatus, string> = {
  aguardando_confirmacao:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700",
  cancelado: "bg-destructive/10 text-destructive border-destructive/20 line-through",
  confirmado:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700",
  lembrete: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
};

/**
 * Estilos visuais e cores por tipo de evento.
 */
export const eventTypeColors: Record<
  AgendaEventType,
  { bg: string; text: string; border: string; dot: string }
> = {
  atendimento: {
    bg: "bg-primary/5",
    text: "text-primary",
    border: "border-primary/30",
    dot: "bg-primary",
  },
  reuniao: {
    bg: "bg-indigo-500/5",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-300 dark:border-indigo-700",
    dot: "bg-indigo-500",
  },
  evento: {
    bg: "bg-violet-500/5",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-300 dark:border-violet-700",
    dot: "bg-violet-500",
  },
};

/**
 * Determina o turno (madrugada, manhã, tarde, noite) com base no horário ("HH:mm").
 * 4 blocos de ~6h59:
 * - Madrugada: 00:00 – 06:59
 * - Manhã:     07:00 – 12:59
 * - Tarde:     13:00 – 18:59
 * - Noite:     19:00 – 23:59
 * Trata entradas vazias ou inválidas com fallback seguro para "morning".
 */
export function getEventShift(time: string): AgendaShift {
  if (!time || typeof time !== "string") {
    return "morning";
  }
  const hours = parseInt(time.split(":")[0] ?? "0", 10);
  if (Number.isNaN(hours)) return "morning";
  if (hours < 7) return "dawn";
  if (hours < 12) return "morning";
  if (hours < 18) return "afternoon";
  return "evening";
}

/**
 * Interface de configuração de apresentação de um turno da agenda.
 */
export interface ShiftConfig {
  label: string;
  rangeLabel: string;
  badgeStyle: string;
  dotColor: string;
  hours: number[];
}

/**
 * Configurações visuais e faixas de horas padrão para cada um dos 4 turnos.
 */
export const SHIFT_CONFIG: Record<AgendaShift, ShiftConfig> = {
  dawn: {
    label: "Madrugada",
    rangeLabel: "00:00 – 06:59",
    badgeStyle: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-300/40",
    dotColor: "bg-indigo-500",
    hours: [0, 1, 2, 3, 4, 5, 6],
  },
  morning: {
    label: "Manhã",
    rangeLabel: "07:00 – 11:59",
    badgeStyle: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/40",
    dotColor: "bg-amber-500",
    hours: [7, 8, 9, 10, 11],
  },
  afternoon: {
    label: "Tarde",
    rangeLabel: "12:00 – 17:59",
    badgeStyle: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300/40",
    dotColor: "bg-blue-500",
    hours: [12, 13, 14, 15, 16, 17],
  },
  evening: {
    label: "Noite",
    rangeLabel: "18:00 – 23:59",
    badgeStyle: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300/40",
    dotColor: "bg-purple-500",
    hours: [18, 19, 20, 21, 22, 23],
  },
};
