import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AgendaEventStatus } from "@/lib/agenda-events";
import type { PatientGroupStatus, AgendaEvent } from "./pacienteDetalheTypes";

export const dashboardColors = {
  amber: "#f59e0b",
  blue: "#0ea5e9",
  emerald: "#10b981",
  rose: "#f43f5e",
  slate: "#64748b",
  zinc: "#a1a1aa",
};

export const GROUP_STATUSES: { value: PatientGroupStatus; label: string }[] = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "pausado", label: "Pausado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
  { value: "inativo", label: "Inativo" },
];

export const DELETE_PATIENT_STATUS_OPTION = { value: "delete" as const, label: "Excluir" };

export const AGENDA_STATUS_OPTIONS: { value: AgendaEventStatus; label: string }[] = [
  { value: "lembrete", label: "Lembrete" },
  { value: "aguardando_confirmacao", label: "Aguardando confirmação" },
  { value: "confirmado", label: "Confirmado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

export const AGENDA_DELETE_OPTION = { value: "delete" as const, label: "Excluir agendamento" };

export const agendaStatusBadgeStyles: Record<AgendaEventStatus, string> = {
  aguardando_confirmacao: "bg-warning/15 text-warning border-warning/20",
  cancelado: "bg-destructive/15 text-destructive border-destructive/20",
  confirmado: "bg-primary/10 text-primary border-primary/20",
  concluido: "bg-success/15 text-success border-success/20",
  lembrete: "bg-primary/10 text-primary border-primary/20",
};

export const WhatsAppLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className={className} fill="currentColor">
    <path d="M16.02 3.2c-7.04 0-12.76 5.72-12.76 12.76 0 2.25.59 4.45 1.71 6.38L3.16 28.8l6.61-1.73a12.68 12.68 0 0 0 6.25 1.64h.01c7.04 0 12.76-5.72 12.76-12.76S23.06 3.2 16.02 3.2Zm0 23.35h-.01c-1.95 0-3.86-.52-5.53-1.51l-.4-.24-3.92 1.03 1.05-3.82-.26-.39a10.55 10.55 0 0 1-1.62-5.66c0-5.89 4.8-10.69 10.7-10.69 2.86 0 5.54 1.11 7.56 3.13a10.64 10.64 0 0 1 3.14 7.56c0 5.9-4.8 10.69-10.71 10.69Zm5.86-8.01c-.32-.16-1.9-.94-2.19-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.18.21-.37.24-.69.08-.32-.16-1.36-.5-2.59-1.6-.96-.85-1.6-1.91-1.79-2.23-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.26-.62-.52-.54-.71-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.15 3.09 1.31 3.3c.16.21 2.26 3.45 5.48 4.84.77.33 1.36.53 1.83.68.77.24 1.47.21 2.02.13.62-.09 1.9-.78 2.17-1.52.27-.75.27-1.39.19-1.52-.08-.14-.29-.22-.61-.38Z" />
  </svg>
);

export const splitClinicalAlertItems = (value: string | null | undefined) =>
  (value ?? "")
    .split(/\n|;|,/)
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) {
        return false;
      }

      const normalized = item
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR");

      return !/^(nao|não|nenhuma?|sem|nega|desconhece|n\/a|na)$/i.test(normalized) &&
        !normalized.startsWith("sem alerg") &&
        !normalized.startsWith("sem queda") &&
        !normalized.startsWith("nao possui") &&
        !normalized.startsWith("não possui");
    });

export interface PatientHeaderAlertProps {
  icon: ReactNode;
  items: string[];
  tone: "amber" | "rose";
  title: string;
}

export const PatientHeaderAlert = ({ icon, items, tone, title }: PatientHeaderAlertProps) => {
  if (items.length === 0) {
    return null;
  }

  const toneClassName =
    tone === "rose"
      ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300"
      : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-full border px-2 py-0.5 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-medium shadow-xs transition hover:-translate-y-0.5 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none max-w-full shrink-0 ${toneClassName}`}
          aria-label={title}
        >
          <span className="shrink-0 scale-90 sm:scale-100">{icon}</span>
          <span className="truncate max-w-[80px] xs:max-w-[110px] sm:max-w-none">{title}</span>
          <Badge variant="secondary" className="ml-0.5 h-4 sm:h-5 min-w-4 sm:min-w-5 justify-center rounded-full px-1 text-[9px] sm:text-[11px] shrink-0">
            {items.length}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={6}
        className="w-72 p-3 shadow-lg z-50 pointer-events-auto"
      >
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            {icon}
            <span>{title} ({items.length})</span>
          </p>
          <ul className="space-y-1.5 text-xs text-muted-foreground max-h-60 overflow-y-auto">
            {items.map((item, index) => (
              <li key={`${item}-${index}`} className="rounded-md bg-muted/40 px-3 py-2 font-medium text-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const groupStatusBadgeStyles: Record<PatientGroupStatus, string> = {
  em_andamento: "bg-primary/10 text-primary border-primary/20",
  pausado: "bg-warning/15 text-warning border-warning/20",
  concluido: "bg-success/15 text-success border-success/20",
  cancelado: "bg-destructive/15 text-destructive border-destructive/20",
  inativo: "bg-muted text-muted-foreground border-border",
};

export const statusColors: Record<string, string> = {
  concluído: "bg-success/15 text-success border-success/20",
  rascunho: "bg-warning/15 text-warning border-warning/20",
  cancelado: "bg-destructive/15 text-destructive border-destructive/20",
};

export const SESSION_STATUSES = [
  { value: "rascunho", label: "Rascunho" },
  { value: "concluído", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export const formatSessionMetaDate = (value: string | null) => {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("pt-BR");
};

export const buildPatientWhatsAppHref = (phone: string | null | undefined) => {
  const digits = (phone ?? "").replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${normalized}`;
};

export const getDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const formatAgendaEventDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });

export const getTimeInputValue = (value: string) => {
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
};

export const getDefaultAgendaInputs = () => {
  const nextSlot = new Date();
  nextSlot.setMinutes(nextSlot.getMinutes() + 30, 0, 0);

  return {
    date: getDateInputValue(nextSlot),
    time: getTimeInputValue(nextSlot.toISOString()),
  };
};

export const getAgendaEventStatus = (event: AgendaEvent | null | undefined): AgendaEventStatus => {
  const status = event?.status;

  if (status === "lembrete" || status === "aguardando_confirmacao" || status === "confirmado" || status === "cancelado") {
    return status;
  }

  return "aguardando_confirmacao";
};

export const getAgendaStatusLabel = (status: AgendaEventStatus) =>
  AGENDA_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "Aguardando confirmação";

export const formatOperationalTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const SummaryField = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="min-w-0 rounded-lg bg-muted/25 px-3 py-2">
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 whitespace-pre-line break-words text-sm font-medium text-foreground">{value?.trim() || "—"}</p>
  </div>
);

export const SummaryInlineChart = ({
  segments,
  valueFormatter,
}: {
  segments: { color: string; label: string; value: number }[];
  valueFormatter?: (value: number) => string;
}) => {
  const normalizedSegments = segments.filter((segment) => Number.isFinite(segment.value) && segment.value > 0);
  const total = normalizedSegments.reduce((sum, segment) => sum + segment.value, 0);

  if (total <= 0) {
    return (
      <div className="mt-4 text-xs text-muted-foreground">
        Sem dados suficientes
      </div>
    );
  }

  return (
    <div className="mx-auto mt-3 w-full max-w-[40rem] space-y-2.5 md:mt-3.5 md:max-w-[28rem]">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted md:h-2">
        {normalizedSegments.map((segment) => {
          const formattedValue = valueFormatter ? valueFormatter(segment.value) : String(segment.value);

          return (
            <div
              key={segment.label}
              className="h-full"
              style={{ backgroundColor: segment.color, width: `${Math.max(6, (segment.value / total) * 100)}%` }}
              title={`${segment.label}: ${formattedValue}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground md:gap-x-2.5">
        {normalizedSegments.map((segment) => {
          const formattedValue = valueFormatter ? valueFormatter(segment.value) : String(segment.value);

          return (
            <span key={segment.label} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color }} />
              {segment.label}: {formattedValue} ({Math.round((segment.value / total) * 100)}%)
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const ScaleIndicator = ({ max = 10, min = 0, score }: { max?: number; min?: number; score: number }) => {
  const color = score <= 3 ? "bg-success" : score <= 6 ? "bg-warning" : "bg-destructive";
  const totalBars = Math.max(max - min, 1);
  const normalizedScore = Math.max(Math.min(score - min, totalBars), 0);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: totalBars }).map((_, i) => (
          <div key={i} className={`w-2 h-4 rounded-sm ${i < normalizedScore ? color : "bg-muted"}`} />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{score}/{max}</span>
    </div>
  );
};

export const isShareLinkResponse = (value: unknown): value is { completed: boolean; password_prefix: string; token: string } => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const data = value as Record<string, unknown>;
  return (
    typeof data.completed === "boolean" &&
    typeof data.password_prefix === "string" &&
    typeof data.token === "string"
  );
};

export const normalizeGroupName = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

export const getPatientGroupKind = (group: { group_kind?: string | null; is_default?: boolean | null }): "custom" | "default" | "cancelados" =>
  group.group_kind === "default" || group.group_kind === "cancelados" || group.group_kind === "custom"
    ? (group.group_kind as "custom" | "default" | "cancelados")
    : group.is_default
      ? "default"
      : "custom";

export const isLockedSystemGroup = (group: { group_kind?: string | null; is_default?: boolean | null }) =>
  getPatientGroupKind(group) !== "custom";

export const EMPTY_ARRAY: never[] = [];

