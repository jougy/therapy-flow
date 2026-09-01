import { useState, useEffect, useCallback, useMemo, useRef, memo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, Plus, Phone, Calendar, Loader2, ChevronDown, ChevronUp, Clock, BarChart3,
  Pencil, Trash2, FolderPlus, ClipboardEdit, ClipboardList, Share2, Copy, CheckCircle2, ChevronsUpDown, Search, X, Users, FileText, MoreHorizontal, ChevronLeft, ChevronRight, CalendarClock, Package, SlidersHorizontal, PlayCircle, Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingFeedback } from "@/components/ui/loading-feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { GroupColorPaletteField, type ClinicGroupColorSlot } from "@/components/GroupColorPaletteField";
import { SessionShareDialog } from "@/components/SessionShareDialog";
import AgendaWidget from "@/components/AgendaWidget";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { PatientFilesPanel } from "@/components/PatientFilesPanel";
import { PatientFilesProvider, usePatientFilesContext } from "@/contexts/PatientFilesContext";
import { FileThumbnailCard } from "@/components/FileThumbnailCard";
import { PatientAnamnesisDashboardContent, PatientStatsPrintView } from "@/pages/PacienteAnamnesisDashboard";
import { SharePatientRegistrationModal } from "@/components/patients/SharePatientRegistrationModal";
import { PrintResponsibilityModal } from "@/components/PrintResponsibilityModal";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { toast } from "@/hooks/use-toast";
import { logRuntimeError } from "@/lib/runtime-debug";
import { fetchPatientByRef, getPatientRouteKey, getClinicPatientPath, getPatientPath } from "@/lib/patient-routing";
import {
  usePatientDetailQuery,
  usePatientSessionsQuery,
  usePatientGroupsQuery,
  usePatientAgendaEventsQuery,
  usePatientGroupSuggestionsQuery,
  usePatientAnamnesisTemplatesQuery,
  usePatientClinicBaseSchemaQuery,
  useOptimisticPatientDetailUpdates,
  useInvalidatePatientData,
} from "@/hooks/queries/usePatientDataQueries";
import {
  useClinicGroupColorSlotsQuery,
  useClinicCollaboratorsQuery,
} from "@/hooks/queries/useClinicDataQueries";
import { buildPatientRegistrationUrl, getPatientRegistrationPassword } from "@/lib/patient-registration";
import {
  AGENDA_EVENTS_UPDATED_EVENT,
  AGENDA_PAST_EVENT_ERROR_MESSAGE,
  assertAgendaEventDateTimeIsFuture,
  buildAgendaEventPayload,
  getAgendaEventDateTime,
  isAgendaEventDateTimeInPast,
  notifyAgendaEventsUpdated,
  type AgendaEventStatus,
} from "@/lib/agenda-events";
import { isAnamnesisTemplateSchema, type AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import {
  buildPatientAnamnesisDashboard,
  type PatientAnamnesisChartType,
  type PatientAnamnesisDashboardTemplate,
} from "@/lib/patient-anamnesis-dashboard";
import { getSessionPersonLabel } from "@/lib/session-people";
import { EvolveSessionModal } from "@/components/sessions";
import { getSessionPreviewContent, getSessionPreviewIndicators } from "@/lib/session-preview";
import { EDITABLE_PATIENT_STATUS_OPTIONS, type EditablePatientStatus } from "@/lib/patient-statuses";
import {
  buildPatientOperationalSummary,
  formatMoneyCents,
  getArrivalDelayMinutes,
  getPaymentAdjustmentCents,
  getPaymentAdjustmentPercent,
  getPaymentStatusLabel,
  getSessionBalanceCents,
  getSessionOriginalAmountCents,
  hasPaymentAdjustment,
} from "@/lib/session-operations";
import {
  fetchClinicShareCollaborators,
  fetchSessionShareSummaries,
  getShareRecipientLabel,
  type SessionShareCollaborator,
  type SessionShareSummary,
} from "@/lib/session-sharing";
import {
  buildPatientSessionsView,
  canDeleteSelectedSessionsForRole,
  filterSessionsForOperationalRole,
  getSessionCareLineIds,
  shouldAutoCompleteInternDraft,
  shouldShowSessionCreatorInternBadge,
  type EvolutionGroupMetadata,
} from "@/lib/patient-sessions-view";
import { buildSessionPayload, getCurrentDateTimeInputValue } from "@/lib/session-payload";
import type { PatientPaymentPlanRow } from "@/lib/payment-plans";
import {
  DEFAULT_GROUP_COLOR_SLOT_SEEDS,
  getLegacyGroupHex,
  getReadableTextColor,
  normalizeGroupName,
  sanitizeColorSlotId,
} from "@/lib/group-colors";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { getDesignLabButtonClass, designLabLabelClass, designLabIconClass } from "@/lib/design-animations";
import {
  getFunctionalIndependenceLabel,
  getPatientRiskFlagLabel,
  parseClinicalProfile,
  parseEmergencyContact,
} from "@/lib/patient-clinical-profile";
import { formatPatientOriginDetails, getPatientOriginLabel } from "@/lib/patient-origin";
import {
  DEFAULT_PATIENT_RECURRENCE_TIME,
  PATIENT_RECURRENCE_WEEKDAY_OPTIONS,
  formatPatientRecurringWeekdays,
  getNextPatientRecurrenceDateTime,
  normalizePatientRecurringTime,
  normalizePatientRecurringWeekdays,
} from "@/lib/patient-recurrence";

type Patient = Database["public"]["Tables"]["patients"]["Row"];
type PatientGroup = Database["public"]["Tables"]["patient_groups"]["Row"];
type PatientGroupTemplate = Database["public"]["Tables"]["patient_group_templates"]["Row"];
type AnamnesisTemplateRow = Pick<Database["public"]["Tables"]["anamnesis_form_templates"]["Row"], "id" | "name" | "schema">;
type ClinicColorSlotRow = Database["public"]["Tables"]["clinic_group_color_slots"]["Row"];
type Session = Database["public"]["Tables"]["sessions"]["Row"];
type AgendaEvent = Database["public"]["Tables"]["agenda_events"]["Row"];
type ProfileSummary = Pick<Database["public"]["Tables"]["profiles"]["Row"], "email" | "full_name" | "id" | "job_title">;
type GroupSuggestion = Pick<PatientGroupTemplate, "clinic_color_slot_id" | "color" | "name" | "normalized_name" | "status">;
type ShareLinkResponse = {
  completed: boolean;
  password_prefix: string;
  token: string;
};
type PatientStatus = EditablePatientStatus;
type PatientStatusSelectValue = PatientStatus | "delete";
type AgendaStatusAction = AgendaEventStatus | "delete";
type PatientGroupKind = "custom" | "default" | "cancelados";
type PatientRecordsView = "dashboard" | "files" | "list";

const dashboardColors = {
  amber: "#f59e0b",
  blue: "#0ea5e9",
  emerald: "#10b981",
  rose: "#f43f5e",
  slate: "#64748b",
  zinc: "#a1a1aa",
};

const GROUP_STATUSES: { value: PatientGroupStatus; label: string }[] = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "pausado", label: "Pausado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
  { value: "inativo", label: "Inativo" },
];

const DELETE_PATIENT_STATUS_OPTION = { value: "delete" as const, label: "Excluir" };

const AGENDA_STATUS_OPTIONS: { value: AgendaEventStatus; label: string }[] = [
  { value: "lembrete", label: "Lembrete" },
  { value: "aguardando_confirmacao", label: "Aguardando confirmação" },
  { value: "confirmado", label: "Confirmado" },
  { value: "cancelado", label: "Cancelado" },
];

const AGENDA_DELETE_OPTION = { value: "delete" as const, label: "Excluir agendamento" };

const agendaStatusBadgeStyles: Record<AgendaEventStatus, string> = {
  aguardando_confirmacao: "bg-warning/15 text-warning border-warning/20",
  cancelado: "bg-destructive/15 text-destructive border-destructive/20",
  confirmado: "bg-success/15 text-success border-success/20",
  lembrete: "bg-primary/10 text-primary border-primary/20",
};

const WhatsAppLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className={className} fill="currentColor">
    <path d="M16.02 3.2c-7.04 0-12.76 5.72-12.76 12.76 0 2.25.59 4.45 1.71 6.38L3.16 28.8l6.61-1.73a12.68 12.68 0 0 0 6.25 1.64h.01c7.04 0 12.76-5.72 12.76-12.76S23.06 3.2 16.02 3.2Zm0 23.35h-.01c-1.95 0-3.86-.52-5.53-1.51l-.4-.24-3.92 1.03 1.05-3.82-.26-.39a10.55 10.55 0 0 1-1.62-5.66c0-5.89 4.8-10.69 10.7-10.69 2.86 0 5.54 1.11 7.56 3.13a10.64 10.64 0 0 1 3.14 7.56c0 5.9-4.8 10.69-10.71 10.69Zm5.86-8.01c-.32-.16-1.9-.94-2.19-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.18.21-.37.24-.69.08-.32-.16-1.36-.5-2.59-1.6-.96-.85-1.6-1.91-1.79-2.23-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.26-.62-.52-.54-.71-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.15 3.09 1.31 3.3c.16.21 2.26 3.45 5.48 4.84.77.33 1.36.53 1.83.68.77.24 1.47.21 2.02.13.62-.09 1.9-.78 2.17-1.52.27-.75.27-1.39.19-1.52-.08-.14-.29-.22-.61-.38Z" />
  </svg>
);

const splitClinicalAlertItems = (value: string | null | undefined) =>
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

interface PatientHeaderAlertProps {
  icon: ReactNode;
  items: string[];
  tone: "amber" | "rose";
  title: string;
}

const PatientHeaderAlert = ({ icon, items, tone, title }: PatientHeaderAlertProps) => {
  if (items.length === 0) {
    return null;
  }

  const toneClassName =
    tone === "rose"
      ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300"
      : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300";

  return (
    <HoverCard openDelay={80} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none ${toneClassName}`}
          aria-label={title}
        >
          {icon}
          <span>{title}</span>
          <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 justify-center rounded-full px-1 text-[11px]">
            {items.length}
          </Badge>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
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
      </HoverCardContent>
    </HoverCard>
  );
};

const groupStatusBadgeStyles: Record<PatientGroupStatus, string> = {
  em_andamento: "bg-primary/10 text-primary border-primary/20",
  pausado: "bg-warning/15 text-warning border-warning/20",
  concluido: "bg-success/15 text-success border-success/20",
  cancelado: "bg-destructive/15 text-destructive border-destructive/20",
  inativo: "bg-muted text-muted-foreground border-border",
};

const statusColors: Record<string, string> = {
  concluído: "bg-success/15 text-success border-success/20",
  rascunho: "bg-warning/15 text-warning border-warning/20",
  cancelado: "bg-destructive/15 text-destructive border-destructive/20",
};

const SESSION_STATUSES = [
  { value: "rascunho", label: "Rascunho" },
  { value: "concluído", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
] as const;

const formatSessionMetaDate = (value: string | null) => {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("pt-BR");
};

const buildPatientWhatsAppHref = (phone: string | null | undefined) => {
  const digits = (phone ?? "").replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${normalized}`;
};

const getDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatAgendaEventDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });

const getTimeInputValue = (value: string) => {
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
};

const getDefaultAgendaInputs = () => {
  const nextSlot = new Date();
  nextSlot.setMinutes(nextSlot.getMinutes() + 30, 0, 0);

  return {
    date: getDateInputValue(nextSlot),
    time: getTimeInputValue(nextSlot.toISOString()),
  };
};

const getAgendaEventStatus = (event: AgendaEvent | null | undefined): AgendaEventStatus => {
  const status = event?.status;

  if (status === "lembrete" || status === "aguardando_confirmacao" || status === "confirmado" || status === "cancelado") {
    return status;
  }

  return "aguardando_confirmacao";
};

const getAgendaStatusLabel = (status: AgendaEventStatus) =>
  AGENDA_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "Aguardando confirmação";

const SummaryField = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="min-w-0 rounded-lg bg-muted/25 px-3 py-2">
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 whitespace-pre-line break-words text-sm font-medium text-foreground">{value?.trim() || "—"}</p>
  </div>
);

const SummaryInlineChart = ({
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

const ScaleIndicator = ({ max = 10, min = 0, score }: { max?: number; min?: number; score: number }) => {
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
const SessionTabsPreview = ({ baseSchema, session }: { baseSchema: AnamnesisTemplateSchema; session: Session }) => {
  const preview = getSessionPreviewContent(session, baseSchema);
  const { files } = usePatientFilesContext();
  const sessionFiles = useMemo(() => files.filter(f => f.session_id === session.id), [files, session.id]);
  const { isFeatureEnabled } = useFeatureFlags();
  const showFiles = isFeatureEnabled("storage_s3_integration");

  return (
    <Tabs
      defaultValue="queixa"
      className="mt-3"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <TabsList className="grid h-auto w-full grid-cols-3">
        <TabsTrigger value="queixa" className="whitespace-normal px-2 py-2 text-xs leading-tight sm:text-sm">Queixa principal</TabsTrigger>
        <TabsTrigger value="tratamento" className="whitespace-normal px-2 py-2 text-xs leading-tight sm:text-sm">Tratamento</TabsTrigger>
        {showFiles && (
          <TabsTrigger value="arquivos" className="whitespace-normal px-2 py-2 text-xs leading-tight sm:text-sm">
            Arquivos
            {sessionFiles.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1">{sessionFiles.length}</Badge>
            )}
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="queixa" className="rounded-md border bg-muted/20 p-3">
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {preview.complaint || "Nenhuma queixa principal registrada."}
        </p>
      </TabsContent>
      <TabsContent value="tratamento" className="rounded-md border bg-muted/20 p-3">
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {preview.treatment || "Nenhum tratamento registrado."}
        </p>
      </TabsContent>
      {showFiles && (
        <TabsContent value="arquivos" className="rounded-md border bg-muted/20 p-3">
          {sessionFiles.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {sessionFiles.map(file => (
                <FileThumbnailCard key={file.id} file={file} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum arquivo anexado a esta sessão.</p>
          )}
        </TabsContent>
      )}
    </Tabs>
  );
};

const formatOperationalTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const SessionCard = memo(({
  baseSchema,
  borderColor,
  canViewFinancialData,
  creatorName,
  creatorIsIntern,
  isCompact,
  isExpanded,
  isSelected,
  navigateTo,
  onEvolve,
  onLinkGroup,
  isEvolving,
  onPressCancel,
  onPressStart,
  onToggleExpand,
  onToggleSelect,
  onViewShareRecipients,
  shareSummary,
  selectionMode,
  session,
  sessionGroups,
}: {
  baseSchema: AnamnesisTemplateSchema;
  borderColor?: string;
  canViewFinancialData: boolean;
  creatorName: string;
  creatorIsIntern: boolean;
  isCompact?: boolean;
  isExpanded?: boolean;
  isSelected: boolean;
  navigateTo: () => void;
  onEvolve?: () => void;
  onLinkGroup?: () => void;
  isEvolving?: boolean;
  onPressCancel: () => void;
  onPressStart: () => void;
  onToggleExpand?: () => void;
  onToggleSelect: () => void;
  onViewShareRecipients: () => void;
  selectionMode: boolean;
  shareSummary?: SessionShareSummary;
  session: Session;
  sessionGroups?: PatientGroup[];
}) => {
  const touchStartPosRef = useRef<{x: number, y: number} | null>(null);
  const longPressOccurredRef = useRef(false);
  const indicators = getSessionPreviewIndicators(session, baseSchema);
  const shareCount = shareSummary?.share_count ?? 0;
  const delayMinutes = getArrivalDelayMinutes(session);
  const balanceCents = getSessionBalanceCents(session);
  const originalAmountCents = getSessionOriginalAmountCents(session);
  const adjustmentCents = getPaymentAdjustmentCents(session);
  const adjustmentPercent = getPaymentAdjustmentPercent(session);
  const sessionHasPaymentAdjustment = hasPaymentAdjustment(session);
  const hasPaymentInfo =
    session.payment_status !== "nao_cobrado" || Boolean(session.amount_charged_cents || session.amount_paid_cents);
  const hasOperationalInfo =
    Boolean(session.scheduled_start_at || session.patient_arrived_at) || (canViewFinancialData && hasPaymentInfo);

  if (isCompact) {
    return (
      <Card
        className={`border-l-4 cursor-pointer select-none hover:shadow-xs transition-all ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
        style={borderColor ? { borderLeftColor: borderColor } : undefined}
        onClick={(e) => {
          if (longPressOccurredRef.current) {
            longPressOccurredRef.current = false;
            return;
          }
          if (selectionMode) {
            onToggleSelect();
          } else {
            navigateTo();
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          if (selectionMode) {
            onToggleSelect();
          } else {
            navigateTo();
          }
        }}
        onPointerDown={(e) => {
          if (selectionMode || (e.button !== undefined && e.button !== 0)) return;
          touchStartPosRef.current = { x: e.clientX, y: e.clientY };
          setTimeout(() => {
            if (touchStartPosRef.current) longPressOccurredRef.current = true;
          }, 400);
          onPressStart();
        }}
        onPointerMove={(e) => {
          if (selectionMode || !touchStartPosRef.current) return;
          const dx = Math.abs(e.clientX - touchStartPosRef.current.x);
          const dy = Math.abs(e.clientY - touchStartPosRef.current.y);
          if (dx > 10 || dy > 10) {
            touchStartPosRef.current = null;
            onPressCancel();
          }
        }}
        onPointerUp={() => {
          touchStartPosRef.current = null;
          if (!selectionMode) onPressCancel();
        }}
        onPointerCancel={() => {
          touchStartPosRef.current = null;
          if (!selectionMode) onPressCancel();
        }}
      >
        <CardContent className="p-2.5 sm:p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-semibold text-xs tracking-tight">{new Date(session.session_date).toLocaleDateString("pt-BR")}</span>
              <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${statusColors[session.status] || ""}`}>{session.status}</Badge>
              <span className="text-xs text-muted-foreground truncate max-w-[120px]">{creatorName}</span>
              {creatorIsIntern && (
                <Badge variant="outline" className="text-[10px] h-5 px-1">Estagiário</Badge>
              )}
              {sessionGroups && sessionGroups.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {sessionGroups.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="text-[10px] h-5 px-1.5 font-medium gap-1"
                      style={{
                        borderColor: getLegacyGroupHex(tag.color),
                        backgroundColor: `${getLegacyGroupHex(tag.color)}18`,
                        color: getReadableTextColor(getLegacyGroupHex(tag.color)) === "#111827" ? "#111827" : undefined,
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: getLegacyGroupHex(tag.color) }} />
                      {tag.name}
                    </Badge>
                  ))}
                  {sessionGroups.length > 3 && (
                    <span className="text-[10px] text-muted-foreground font-medium">+{sessionGroups.length - 3}</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
              {indicators.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] font-medium bg-muted/60 px-2 py-0.5 rounded-md">
                  <span className="text-muted-foreground">{indicators[0].label.replace("Escala de ", "")}:</span>
                  <span>{indicators[0].score}/{indicators[0].max}</span>
                </div>
              )}

              {shareCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    onViewShareRecipients();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="text-[10px]">{shareCount}</span>
                </Button>
              )}

              {selectionMode && (
                <Badge variant={isSelected ? "default" : "outline"} className="text-xs">
                  {isSelected ? "Selecionado" : "Selecionar"}
                </Badge>
              )}

              {onEvolve && !selectionMode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 border-primary/20 hover:bg-primary/10 hover:text-primary transition-colors"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEvolve();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  disabled={isEvolving}
                  title="Evoluir atendimento (iniciar novo a partir deste)"
                >
                  {isEvolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="text-[11px] font-medium">Evoluir</span>
                </Button>
              )}

              {onLinkGroup && !selectionMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    onLinkGroup();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  title="Vincular a grupo de evolução"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-[11px]">Grupo</span>
                </Button>
              )}

              {onToggleExpand && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleExpand();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  title={isExpanded ? "Recolher detalhes" : "Expandir detalhes rápidos"}
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>

          {/* Inline Preview when expanded in compact mode */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
              {hasOperationalInfo ? (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {session.scheduled_start_at || session.patient_arrived_at ? (
                    <span className="rounded-full bg-muted px-2 py-1" title={session.payment_adjustment_reason ?? undefined}>
                      Agendado {formatOperationalTime(session.scheduled_start_at)} · Chegou {formatOperationalTime(session.patient_arrived_at)}
                      {delayMinutes && delayMinutes > 0 ? ` · atraso ${delayMinutes}min` : ""}
                    </span>
                  ) : null}
                  {canViewFinancialData && hasPaymentInfo ? (
                    <span className="rounded-full bg-muted px-2 py-1">
                      {getPaymentStatusLabel(session.payment_status)} · {formatMoneyCents(session.amount_paid_cents)} de{" "}
                      {sessionHasPaymentAdjustment ? (
                        <>
                          <span className="line-through">{formatMoneyCents(originalAmountCents)}</span>{" "}
                          {formatMoneyCents(session.amount_charged_cents)}
                          <span className={adjustmentCents > 0 ? "ml-1 font-semibold text-success" : "ml-1 font-semibold text-destructive"}>
                            {adjustmentCents > 0 ? "+" : ""}
                            {adjustmentPercent}%
                          </span>
                        </>
                      ) : (
                        formatMoneyCents(session.amount_charged_cents)
                      )}
                      {balanceCents > 0 ? ` · aberto ${formatMoneyCents(balanceCents)}` : ""}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="min-w-0 flex-1">
                  <SessionTabsPreview baseSchema={baseSchema} session={session} />
                </div>
                {indicators.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:w-[220px] lg:shrink-0 lg:grid-cols-1">
                    {indicators.map((indicator) => (
                      <div key={indicator.id}>
                        <span className="text-xs text-muted-foreground block">{indicator.label}</span>
                        <ScaleIndicator score={indicator.score} min={indicator.min} max={indicator.max} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`border-l-4 cursor-pointer select-none hover:shadow-md transition-shadow ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
      style={borderColor ? { borderLeftColor: borderColor } : undefined}
      onClick={(e) => {
        if (longPressOccurredRef.current) {
          longPressOccurredRef.current = false;
          return;
        }
        if (selectionMode) {
          onToggleSelect();
        } else {
          navigateTo();
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();

        if (selectionMode) {
          onToggleSelect();
          return;
        }

        navigateTo();
      }}
      onPointerDown={(e) => {
        if (selectionMode || (e.button !== undefined && e.button !== 0)) return;
        touchStartPosRef.current = { x: e.clientX, y: e.clientY };

        setTimeout(() => {
          if (touchStartPosRef.current) {
            longPressOccurredRef.current = true;
          }
        }, 400);

        onPressStart();
      }}
      onPointerMove={(e) => {
        if (selectionMode || !touchStartPosRef.current) return;
        const dx = Math.abs(e.clientX - touchStartPosRef.current.x);
        const dy = Math.abs(e.clientY - touchStartPosRef.current.y);
        if (dx > 10 || dy > 10) {
          touchStartPosRef.current = null;
          onPressCancel();
        }
      }}
      onPointerUp={() => {
        touchStartPosRef.current = null;
        if (!selectionMode) onPressCancel();
      }}
      onPointerCancel={() => {
        touchStartPosRef.current = null;
        if (!selectionMode) onPressCancel();
      }}
      onContextMenu={(e) => {
        if (!selectionMode && onPressStart) {
          e.preventDefault();
          longPressOccurredRef.current = true;
          touchStartPosRef.current = null;
          onPressStart();
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{new Date(session.session_date).toLocaleDateString("pt-BR")}</span>
              <Badge variant="outline" className={`text-xs ${statusColors[session.status] || ""}`}>{session.status}</Badge>
              <Badge variant="secondary" className="text-xs">
                {creatorName}
              </Badge>
              {creatorIsIntern && (
                <Badge variant="outline" className="text-xs">
                  Estagiario
                </Badge>
              )}
              {shareCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    onViewShareRecipients();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {shareCount}
                </Button>
              )}
              {selectionMode && (
                <Badge variant={isSelected ? "default" : "outline"} className="text-xs">
                  {isSelected ? "Selecionado" : "Toque para selecionar"}
                </Badge>
              )}
              {onEvolve && !selectionMode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1 border-primary/20 hover:bg-primary/10 hover:text-primary transition-colors"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEvolve();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  disabled={isEvolving}
                  title="Evoluir atendimento (iniciar novo a partir deste)"
                >
                  {isEvolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="text-[11px] font-medium">Evoluir caso</span>
                </Button>
              )}
              {onLinkGroup && !selectionMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    onLinkGroup();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  title="Vincular a grupo de evolução"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Grupo</span>
                </Button>
              )}
            </div>

            {/* Badges de Sintomas & Linhas de Cuidado da Sessão */}
            {sessionGroups && sessionGroups.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {sessionGroups.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="text-[11px] font-semibold px-2 py-0.5 gap-1 shadow-xs"
                    style={{
                      borderColor: getLegacyGroupHex(tag.color),
                      backgroundColor: `${getLegacyGroupHex(tag.color)}20`,
                      color: getReadableTextColor(getLegacyGroupHex(tag.color)) === "#111827" ? "#111827" : undefined,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: getLegacyGroupHex(tag.color) }}
                    />
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
            {hasOperationalInfo ? (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {session.scheduled_start_at || session.patient_arrived_at ? (
                  <span className="rounded-full bg-muted px-2 py-1" title={session.payment_adjustment_reason ?? undefined}>
                    Agendado {formatOperationalTime(session.scheduled_start_at)} · Chegou {formatOperationalTime(session.patient_arrived_at)}
                    {delayMinutes && delayMinutes > 0 ? ` · atraso ${delayMinutes}min` : ""}
                  </span>
                ) : null}
                {canViewFinancialData && hasPaymentInfo ? (
                  <span className="rounded-full bg-muted px-2 py-1">
                    {getPaymentStatusLabel(session.payment_status)} · {formatMoneyCents(session.amount_paid_cents)} de{" "}
                    {sessionHasPaymentAdjustment ? (
                      <>
                        <span className="line-through">{formatMoneyCents(originalAmountCents)}</span>{" "}
                        {formatMoneyCents(session.amount_charged_cents)}
                        <span className={adjustmentCents > 0 ? "ml-1 font-semibold text-success" : "ml-1 font-semibold text-destructive"}>
                          {adjustmentCents > 0 ? "+" : ""}
                          {adjustmentPercent}%
                        </span>
                      </>
                    ) : (
                      formatMoneyCents(session.amount_charged_cents)
                    )}
                    {balanceCents > 0 ? ` · aberto ${formatMoneyCents(balanceCents)}` : ""}
                  </span>
                ) : null}
              </div>
            ) : null}
            <SessionTabsPreview baseSchema={baseSchema} session={session} />
          </div>
          {indicators.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:w-[240px] lg:shrink-0 lg:grid-cols-1">
              {indicators.map((indicator) => (
                <div key={indicator.id}>
                  <span className="text-xs text-muted-foreground block">{indicator.label}</span>
                  <ScaleIndicator score={indicator.score} min={indicator.min} max={indicator.max} />
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

const isShareLinkResponse = (value: Json): value is ShareLinkResponse => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const data = value as Record<string, Json | undefined>;
  return (
    typeof data.completed === "boolean" &&
    typeof data.password_prefix === "string" &&
    typeof data.token === "string"
  );
};

const normalizeGroupName = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
const getPatientGroupKind = (group: Pick<PatientGroup, "group_kind" | "is_default">): PatientGroupKind =>
  group.group_kind === "default" || group.group_kind === "cancelados" || group.group_kind === "custom"
    ? group.group_kind
    : group.is_default
      ? "default"
      : "custom";

const isLockedSystemGroup = (group: Pick<PatientGroup, "group_kind" | "is_default">) =>
  getPatientGroupKind(group) !== "custom";

const EMPTY_ARRAY: never[] = [];

const PacienteDetalhe = () => {
  const { id, clinicKey } = useParams<{ id?: string; clinicKey?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { can, clinic, clinicId, operationalRole, profile, user } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const clinicHomePath = clinic?.route_key ? `/clinica/${clinic.route_key}` : "/espacopessoal";
  const canViewPatientContact = can("patients.manage");
  const canViewFinancialData = can("treasury.manage");

  // Query Hooks persistidos em IndexedDB
  const {
    data: patientQueryData,
    isLoading: isPatientLoading,
    error: patientQueryError,
  } = usePatientDetailQuery(id, clinicId);
  const patient = patientQueryData ?? null;
  const realPatientId = patient?.id;

  const { data: groups = EMPTY_ARRAY } = usePatientGroupsQuery(realPatientId, Boolean(realPatientId));
  const { data: allSessions = EMPTY_ARRAY } = usePatientSessionsQuery(realPatientId, Boolean(realPatientId));
  const { data: agendaEvents = EMPTY_ARRAY } = usePatientAgendaEventsQuery(realPatientId, Boolean(realPatientId));
  const { data: groupSuggestions = EMPTY_ARRAY } = usePatientGroupSuggestionsQuery(clinicId, Boolean(clinicId));
  const { data: anamnesisTemplates = EMPTY_ARRAY } = usePatientAnamnesisTemplatesQuery(clinicId, Boolean(clinicId));
  const { data: baseSchema = EMPTY_ARRAY } = usePatientClinicBaseSchemaQuery(clinicId, Boolean(clinicId));
  const { data: clinicColorSlots = EMPTY_ARRAY } = useClinicGroupColorSlotsQuery(clinicId, Boolean(clinicId));
  const { data: collaboratorProfiles = EMPTY_ARRAY } = useClinicCollaboratorsQuery(clinicId, Boolean(clinicId));
  const profiles: ProfileSummary[] = collaboratorProfiles;

  const {
    optimisticUpdatePatientStatus,
    optimisticUpdatePatient,
    optimisticUpdateSessionStatus,
    optimisticMoveSessions,
    optimisticMoveSessionsToEvolutionGroup,
    optimisticDeleteSessions,
    optimisticAddOrUpdateGroup,
    optimisticDeleteGroup,
    optimisticAddAgendaEvent,
    optimisticUpdateAgendaEvent,
    optimisticDeleteAgendaEvent,
  } = useOptimisticPatientDetailUpdates(realPatientId, clinicId, id);

  const invalidatePatientData = useInvalidatePatientData();

  const [shareCollaborators, setShareCollaborators] = useState<SessionShareCollaborator[]>([]);
  const [sessionShareSummaries, setSessionShareSummaries] = useState<Record<string, SessionShareSummary>>({});
  const loading = isPatientLoading && !patient;

  // Redirecionamento canônico de rota (PAC-xxx)
  useEffect(() => {
    if (!patient || !id) return;
    const canonicalRouteKey = getPatientRouteKey(patient);
    const targetClinicKey = clinic?.route_key || clinicKey;

    if (id !== canonicalRouteKey && targetClinicKey) {
      navigate(`/clinica/${targetClinicKey}/pacientes/${canonicalRouteKey}${location.search}`, { replace: true });
    }
  }, [clinic?.route_key, clinicKey, id, location.search, navigate, patient]);

  const allSessionIdsKey = useMemo(() => allSessions.map((session) => session.id).join(","), [allSessions]);

  // Carregar resumos de compartilhamento das sessões
  useEffect(() => {
    if (!allSessionIdsKey) {
      setSessionShareSummaries((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }

    let isMounted = true;
    const sessionIds = allSessions.map((session) => session.id);
    fetchSessionShareSummaries(sessionIds)
      .then((summaries) => {
        if (isMounted) {
          setSessionShareSummaries(Object.fromEntries(summaries.map((summary) => [summary.session_id, summary])));
        }
      })
      .catch((error) => {
        logRuntimeError("patient_detail.fetch_session_share_summaries", error, { patientId: id });
      });

    return () => {
      isMounted = false;
    };
  }, [allSessionIdsKey, allSessions, id]);

  // Carregar colaboradores para compartilhamento da clínica
  useEffect(() => {
    if (!clinicId) return;

    let isMounted = true;
    fetchClinicShareCollaborators(clinicId)
      .then((collaborators) => {
        if (isMounted) {
          setShareCollaborators(collaborators);
        }
      })
      .catch((error) => {
        logRuntimeError("patient_detail.fetch_share_collaborators", error, { clinicId, patientId: id });
      });

    return () => {
      isMounted = false;
    };
  }, [clinicId, id]);

  // Auto-completar rascunhos antigos de estagiários
  useEffect(() => {
    if (allSessions.length === 0 || !user?.id) return;

    const staleInternDraftIds = allSessions
      .filter((session) =>
        shouldAutoCompleteInternDraft({
          createdAt: session.created_at,
          currentUserId: user?.id,
          operationalRole,
          sessionStatus: session.status,
          userId: session.user_id,
        })
      )
      .map((session) => session.id);

    if (staleInternDraftIds.length > 0) {
      void supabase
        .from("sessions")
        .update({ status: "concluído" })
        .in("id", staleInternDraftIds)
        .then(({ error }) => {
          if (!error) {
            optimisticUpdateSessionStatus(staleInternDraftIds, "concluído");
          }
        });
    }
  }, [allSessions, operationalRole, optimisticUpdateSessionStatus, user?.id]);

  // Sessões filtradas conforme o perfil operacional
  const sharedSessionIds = useMemo(
    () => new Set(Object.keys(sessionShareSummaries)),
    [sessionShareSummaries]
  );

  const sessions = useMemo(
    () =>
      filterSessionsForOperationalRole({
        canReadAll: can("sessions.read_all"),
        currentUserId: user?.id,
        operationalRole,
        sharedSessionIds,
        sessions: allSessions,
      }),
    [allSessions, can, operationalRole, sharedSessionIds, user?.id]
  );

  // Group dialog state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PatientGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupComboboxOpen, setGroupComboboxOpen] = useState(false);
  const [groupColor, setGroupColor] = useState(getLegacyGroupHex("lavender"));
  const [groupColorSlotId, setGroupColorSlotId] = useState<string | null>(null);
  const [groupStatus, setGroupStatus] = useState<PatientGroupStatus>("em_andamento");
  const [savingGroup, setSavingGroup] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sessionShareDialogOpen, setSessionShareDialogOpen] = useState(false);
  const [shareRecipientsSessionId, setShareRecipientsSessionId] = useState<string | null>(null);
  const [patientInfoDialogOpen, setPatientInfoDialogOpen] = useState(false);
  const [agendaDialogOpen, setAgendaDialogOpen] = useState(false);
  const [agendaDate, setAgendaDate] = useState(() => getDefaultAgendaInputs().date);
  const [agendaTime, setAgendaTime] = useState(() => getDefaultAgendaInputs().time);
  const [savingAgendaEvent, setSavingAgendaEvent] = useState(false);
  const [selectedAgendaEvent, setSelectedAgendaEvent] = useState<AgendaEvent | null>(null);
  const [selectedAgendaStatusAction, setSelectedAgendaStatusAction] = useState<AgendaStatusAction>("aguardando_confirmacao");
  const [selectedAgendaDate, setSelectedAgendaDate] = useState(() => getDefaultAgendaInputs().date);
  const [selectedAgendaTime, setSelectedAgendaTime] = useState("09:00");
  const [savingAgendaDetails, setSavingAgendaDetails] = useState(false);
  const [recurrenceDialogOpen, setRecurrenceDialogOpen] = useState(false);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([]);
  const [recurrenceTime, setRecurrenceTime] = useState(DEFAULT_PATIENT_RECURRENCE_TIME);
  const [savingRecurrence, setSavingRecurrence] = useState(false);
  const [generatingShareLink, setGeneratingShareLink] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [shareCompleted, setShareCompleted] = useState(false);
  const [updatingPatientStatus, setUpdatingPatientStatus] = useState(false);
  const [deletePatientDialogOpen, setDeletePatientDialogOpen] = useState(false);
  const [deletingPatient, setDeletingPatient] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sessionStatusFilter, setSessionStatusFilter] = useState("all");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");
  const [sessionViewMode, setSessionViewMode] = useState<"detailed" | "compact">(() => {
    try {
      if (typeof window !== "undefined" && typeof window.localStorage?.getItem === "function") {
        const stored = window.localStorage.getItem("therapy-flow:session-view-mode");
        if (stored === "compact" || stored === "detailed") return stored;
      }
    } catch {
      // ignore
    }
    return "detailed";
  });
  const [expandedSessionIds, setExpandedSessionIds] = useState<string[]>([]);
  const [collapsedEvolutionGroupIds, setCollapsedEvolutionGroupIds] = useState<string[]>([]);
  const [evolutionGroupsMetadata, setEvolutionGroupsMetadata] = useState<EvolutionGroupMetadata[]>([]);
  const [paymentPlans, setPaymentPlans] = useState<PatientPaymentPlanRow[]>([]);
  const [editingEvolutionGroup, setEditingEvolutionGroup] = useState<{ id: string; name: string } | null>(null);
  const [savingEvolutionGroupName, setSavingEvolutionGroupName] = useState(false);
  const [evolvingSessionId, setEvolvingSessionId] = useState<string | null>(null);
  const [sessionToEvolve, setSessionToEvolve] = useState<Session | null>(null);
  const [sessionToLinkGroup, setSessionToLinkGroup] = useState<Session | null>(null);
  const [groupByEvolution, setGroupByEvolution] = useState<boolean>(() => {
    try {
      if (typeof window !== "undefined" && typeof window.localStorage?.getItem === "function") {
        const stored = window.localStorage.getItem("therapy-flow:group-by-evolution");
        if (stored !== null) return stored === "true";
      }
    } catch {
      // ignore
    }
    return true;
  });

  const handleToggleGroupByEvolution = (checked: boolean) => {
    setGroupByEvolution(checked);
    try {
      if (typeof window !== "undefined" && typeof window.localStorage?.setItem === "function") {
        window.localStorage.setItem("therapy-flow:group-by-evolution", String(checked));
      }
    } catch {
      // ignore
    }
  };

  const [recordsView, setRecordsView] = useState<PatientRecordsView>("list");
  const [dashboardTemplateFilter, setDashboardTemplateFilter] = useState("all");
  const [dashboardChartPreferences, setDashboardChartPreferences] = useState<Record<string, PatientAnamnesisChartType>>({});
  const [showDashboardPrintModal, setShowDashboardPrintModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const isIntern = operationalRole === "estagiario";
  const canDeletePatient = can("patients.delete") || can("clinic_profile.manage") || operationalRole === "owner" || operationalRole === "admin";
  const parsedClinicalProfile = useMemo(() => parseClinicalProfile(patient?.clinical_profile), [patient?.clinical_profile]);
  const parsedEmergencyContact = useMemo(() => parseEmergencyContact(patient?.emergency_contact), [patient?.emergency_contact]);
  const patientOriginDetails = useMemo(() => patient ? formatPatientOriginDetails(patient) : null, [patient]);

  useEffect(() => {
    if (!patient) {
      return;
    }

    setRecurrenceEnabled(Boolean(patient.is_recurring));
    setRecurrenceTime(normalizePatientRecurringTime(patient.recurring_time));
  }, [patient]);

  useEffect(() => {
    const handleAgendaEventsUpdated = () => {
      if (realPatientId) {
        void invalidatePatientData(realPatientId, clinicId, ["agenda"]);
      }
    };

    window.addEventListener(AGENDA_EVENTS_UPDATED_EVENT, handleAgendaEventsUpdated);

    return () => {
      window.removeEventListener(AGENDA_EVENTS_UPDATED_EVENT, handleAgendaEventsUpdated);
    };
  }, [clinicId, invalidatePatientData, realPatientId]);

  const resolvedClinicColorSlots = useMemo<ClinicGroupColorSlot[]>(
    () =>
      clinicColorSlots.length > 0
        ? clinicColorSlots
        : DEFAULT_GROUP_COLOR_SLOT_SEEDS.map((slot) => ({
            alpha: slot.alpha,
            color_hex: slot.colorHex,
            id: `seed-${slot.slotIndex}`,
            slot_index: slot.slotIndex,
          })),
    [clinicColorSlots]
  );

  const getSlotById = useCallback(
    (slotId: string | null) => resolvedClinicColorSlots.find((slot) => slot.id === slotId) ?? null,
    [resolvedClinicColorSlots]
  );

  useEffect(() => {
    if (!groupColorSlotId) {
      return;
    }

    const slot = getSlotById(groupColorSlotId);

    if (slot && slot.color_hex !== groupColor) {
      setGroupColor(slot.color_hex);
    }
  }, [getSlotById, groupColor, groupColorSlotId]);

  const handleOpenShareDialog = useCallback(() => {
    if (!patient) return;
    setShareDialogOpen(true);
  }, [patient]);

  useEffect(() => {
    const shouldOpenShareDialog = (location.state as { openShareDialog?: boolean } | null)?.openShareDialog;

    if (!shouldOpenShareDialog || !patient) return;

    handleOpenShareDialog();
    navigate(location.pathname, { replace: true, state: null });
  }, [handleOpenShareDialog, location.pathname, location.state, navigate, patient]);

  const openNewGroup = () => {
    const defaultSlot = resolvedClinicColorSlots[1] ?? resolvedClinicColorSlots[0] ?? null;
    setEditingGroup(null);
    setGroupName("");
    setGroupComboboxOpen(false);
    setGroupColor(defaultSlot?.color_hex ?? getLegacyGroupHex("lavender"));
    setGroupColorSlotId(sanitizeColorSlotId(defaultSlot?.id));
    setGroupStatus("em_andamento");
    setGroupDialogOpen(true);
  };

  const openEditGroup = (g: PatientGroup) => {
    if (isLockedSystemGroup(g)) {
      toast({ title: "Este grupo reservado do sistema não pode ser editado dessa forma", variant: "destructive" });
      return;
    }

    setEditingGroup(g);
    setGroupName(g.name);
    setGroupComboboxOpen(false);
    setGroupColor(getLegacyGroupHex(g.color));
    setGroupColorSlotId(sanitizeColorSlotId(g.clinic_color_slot_id));
    setGroupStatus((g.status as PatientGroupStatus) || "em_andamento");
    setGroupDialogOpen(true);
  };

  const handleSelectGroupSuggestion = (suggestion: GroupSuggestion) => {
    setGroupName(suggestion.name);
    const slot = getSlotById(suggestion.clinic_color_slot_id);
    setGroupColor(slot?.color_hex ?? getLegacyGroupHex(suggestion.color || "lavender"));
    setGroupColorSlotId(sanitizeColorSlotId(slot?.id ?? suggestion.clinic_color_slot_id));
    setGroupStatus((suggestion.status as PatientGroupStatus) || "em_andamento");
    setGroupComboboxOpen(false);
  };

  const handleCreateTypedGroupName = () => {
    setGroupName(groupName.trim().replace(/\s+/g, " "));
    setGroupComboboxOpen(false);
  };

  const upsertGroupTemplate = async ({
    clinicColorSlotId,
    color,
    name,
    status,
  }: {
    clinicColorSlotId: string | null;
    color: string;
    name: string;
    status: PatientGroupStatus;
  }) => {
    if (!clinicId || !user) return;

    await supabase.from("patient_group_templates").upsert(
      {
        clinic_id: clinicId,
        clinic_color_slot_id: sanitizeColorSlotId(clinicColorSlotId),
        color,
        created_by: user.id,
        name,
        normalized_name: normalizeGroupName(name),
        status,
      },
      { onConflict: "clinic_id,normalized_name" }
    );
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim() || !id || !user) return;
    const normalizedName = normalizeGroupName(groupName);
    const duplicateGroup = groups.find((group) => {
      if (editingGroup?.id === group.id) return false;
      return normalizeGroupName(group.name) === normalizedName;
    });

    if (duplicateGroup) {
      toast({
        title: "Grupo já existe neste paciente",
        description: "Escolha o grupo existente na lista ou use outro nome.",
        variant: "destructive",
      });
      return;
    }

    setSavingGroup(true);

    const clinicRes = await supabase.rpc("get_user_clinic_id", { _user_id: user.id });
    const reusableSuggestion = !editingGroup
      ? groupSuggestions.find((suggestion) => normalizeGroupName(suggestion.name) === normalizedName)
      : undefined;
    const suggestionSlot = getSlotById(reusableSuggestion?.clinic_color_slot_id ?? null);
    const resolvedGroupColor = suggestionSlot?.color_hex || (reusableSuggestion?.color ? getLegacyGroupHex(reusableSuggestion.color) : groupColor);
    const rawSlotId = suggestionSlot?.id ?? reusableSuggestion?.clinic_color_slot_id ?? groupColorSlotId;
    const resolvedGroupColorSlotId = sanitizeColorSlotId(rawSlotId);
    const resolvedGroupStatus = (reusableSuggestion?.status as PatientGroupStatus | null) || groupStatus;

    if (editingGroup) {
      const sanitizedEditSlotId = sanitizeColorSlotId(groupColorSlotId);
      const updatedGroup: PatientGroup = {
        ...editingGroup,
        clinic_color_slot_id: sanitizedEditSlotId,
        name: groupName.trim(),
        color: groupColor,
        status: groupStatus,
      };
      optimisticAddOrUpdateGroup(updatedGroup);

      const { error } = await supabase
        .from("patient_groups")
        .update({ clinic_color_slot_id: sanitizedEditSlotId, name: groupName.trim(), color: groupColor, status: groupStatus })
        .eq("id", editingGroup.id);
      if (error) {
        toast({ title: "Erro ao atualizar grupo", variant: "destructive" });
        if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["groups"]);
      } else {
        await upsertGroupTemplate({ clinicColorSlotId: sanitizedEditSlotId, color: groupColor, name: groupName.trim(), status: groupStatus });
        toast({ title: "Grupo atualizado" });
      }
    } else {
      const { data: insertedGroup, error } = await supabase.from("patient_groups").insert({
        clinic_color_slot_id: resolvedGroupColorSlotId,
        name: groupName.trim(),
        color: resolvedGroupColor,
        group_kind: "custom",
        status: resolvedGroupStatus,
        is_default: false,
        patient_id: realPatientId || id,
        user_id: user.id,
        clinic_id: clinicRes.data,
      }).select("*").single();

      if (error || !insertedGroup) {
        toast({ title: "Erro ao criar grupo", variant: "destructive" });
        if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["groups"]);
      } else {
        optimisticAddOrUpdateGroup(insertedGroup);
        await upsertGroupTemplate({
          clinicColorSlotId: resolvedGroupColorSlotId,
          color: resolvedGroupColor,
          name: groupName.trim(),
          status: resolvedGroupStatus,
        });
        toast({ title: "Grupo criado" });
      }
    }

    setSavingGroup(false);
    setGroupDialogOpen(false);
  };

  const handleSaveClinicColorSlot = async (slotIndex: number, colorHex: string, alpha: number) => {
    if (!clinicId) {
      return;
    }

    const existingSlot = clinicColorSlots.find((slot) => slot.slot_index === slotIndex) ?? null;
    const payload = {
      alpha,
      clinic_id: clinicId,
      color_hex: colorHex,
      slot_index: slotIndex,
    };

    const { data, error } = await supabase
      .from("clinic_group_color_slots")
      .upsert(existingSlot ? { ...payload, id: existingSlot.id } : payload, { onConflict: "clinic_id,slot_index" })
      .select("*")
      .single();

    if (error || !data) {
      toast({ title: "Erro ao salvar cor da clínica", description: error?.message, variant: "destructive" });
      return;
    }

    const slotId = data.id;
    await Promise.all([
      supabase
        .from("patient_groups")
        .update({ color: colorHex })
        .eq("clinic_id", clinicId)
        .eq("clinic_color_slot_id", slotId),
      supabase
        .from("patient_group_templates")
        .update({ color: colorHex })
        .eq("clinic_id", clinicId)
        .eq("clinic_color_slot_id", slotId),
    ]);

    setGroupColorSlotId(slotId);
    setGroupColor(colorHex);
    toast({ title: "Paleta da clínica atualizada" });
    if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["groups"]);
  };

  const handleDeleteGroup = async (groupId: string) => {
    const group = groups.find((item) => item.id === groupId);
    if (group && isLockedSystemGroup(group)) {
      toast({ title: "Este grupo reservado do sistema não pode ser excluído", variant: "destructive" });
      setDeleteConfirmId(null);
      return;
    }

    optimisticDeleteGroup(groupId);
    setDeleteConfirmId(null);

    // Unlink sessions first
    await supabase.from("sessions").update({ group_id: null }).eq("group_id", groupId);
    const { error } = await supabase.from("patient_groups").delete().eq("id", groupId);
    if (error) {
      toast({ title: "Erro ao excluir grupo", variant: "destructive" });
      if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["groups", "sessions"]);
    } else {
      toast({ title: "Grupo excluído" });
    }
  };

  const handlePatientStatusChange = async (nextStatus: PatientStatusSelectValue) => {
    if (nextStatus === "delete") {
      if (!canDeletePatient) {
        return;
      }

      setDeletePatientDialogOpen(true);
      return;
    }

    if (!patient || patient.status === nextStatus) {
      return;
    }

    optimisticUpdatePatientStatus(nextStatus as PatientStatus);
    setUpdatingPatientStatus(true);
    const { error } = await supabase
      .from("patients")
      .update({ status: nextStatus })
      .eq("id", patient.id);

    if (error) {
      toast({ title: "Erro ao atualizar status do paciente", description: error.message, variant: "destructive" });
      if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["patient"]);
    } else {
      toast({ title: "Status do paciente atualizado" });
    }
    setUpdatingPatientStatus(false);
  };

  const handleDeletePatient = async () => {
    if (!patient || !canDeletePatient) {
      return;
    }

    setDeletingPatient(true);
    const { error } = await supabase
      .from("patients")
      .delete()
      .eq("id", patient.id);

    if (error) {
      toast({ title: "Erro ao excluir paciente", description: error.message, variant: "destructive" });
      setDeletingPatient(false);
      return;
    }

    toast({ title: "Paciente excluído" });
    setDeletePatientDialogOpen(false);
    setDeletingPatient(false);
    navigate(clinicHomePath, {
      replace: true,
      state: {
        deletedPatientId: patient.id,
        refreshPatientsAt: Date.now(),
      },
    });
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleSessionPressStart = (sessionId: string) => {
    if (selectionMode) {
      return;
    }

    clearLongPress();
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      if (!isIntern) {
        setSelectionMode(true);
        setSelectedSessionIds([sessionId]);
      }
    }, 420);
  };

  const handleSessionPressCancel = () => {
    clearLongPress();
  };

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessionIds((current) =>
      current.includes(sessionId) ? current.filter((id) => id !== sessionId) : [...current, sessionId]
    );
  };

  const handleSessionNavigate = (sessionId: string) => {
    if (selectionMode) {
      toggleSessionSelection(sessionId);
      return;
    }

    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    navigate(`/pacientes/${id}/sessao/${sessionId}`);
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedSessionIds([]);
    longPressTriggeredRef.current = false;
    clearLongPress();
  };

  const profileMap = useMemo(
    () => new Map(profiles.map((item) => [item.id, item])),
    [profiles]
  );

  const paymentPlanMap = useMemo(
    () => new Map(paymentPlans.map((p) => [p.id, p])),
    [paymentPlans]
  );

  useEffect(() => {
    if (!realPatientId || !clinicId) return;

    let isMounted = true;

    Promise.all([
      supabase.from("patient_evolution_groups").select("id, custom_name").eq("patient_id", realPatientId),
      supabase.from("patient_payment_plans").select("*").eq("patient_id", realPatientId).order("created_at", { ascending: false }),
    ]).then(([evoRes, plansRes]) => {
      if (!isMounted) return;
      if (evoRes.data) {
        setEvolutionGroupsMetadata(evoRes.data as EvolutionGroupMetadata[]);
      }
      if (plansRes.data) {
        setPaymentPlans(plansRes.data as PatientPaymentPlanRow[]);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [clinicId, realPatientId]);

  const handleSetSessionViewMode = (mode: "detailed" | "compact") => {
    setSessionViewMode(mode);
    try {
      if (typeof window !== "undefined" && typeof window.localStorage?.setItem === "function") {
        window.localStorage.setItem("therapy-flow:session-view-mode", mode);
      }
    } catch {
      // ignore
    }
  };

  const toggleSessionExpansion = (sessionId: string) => {
    setExpandedSessionIds((current) =>
      current.includes(sessionId) ? current.filter((item) => item !== sessionId) : [...current, sessionId]
    );
  };

  const toggleEvolutionGroupCollapse = (groupId: string) => {
    setCollapsedEvolutionGroupIds((current) =>
      current.includes(groupId) ? current.filter((item) => item !== groupId) : [...current, groupId]
    );
  };

  const handleSaveEvolutionGroupName = async () => {
    if (!editingEvolutionGroup) return;
    setSavingEvolutionGroupName(true);
    const { error } = await supabase
      .from("patient_evolution_groups")
      .update({ custom_name: editingEvolutionGroup.name.trim() || null })
      .eq("id", editingEvolutionGroup.id);

    if (error) {
      toast({ title: "Erro ao salvar nome do ciclo", variant: "destructive" });
    } else {
      toast({ title: "Nome do ciclo atualizado com sucesso" });
      setEvolutionGroupsMetadata((prev) =>
        prev.map((g) =>
          g.id === editingEvolutionGroup.id
            ? { ...g, custom_name: editingEvolutionGroup.name.trim() || null }
            : g
        )
      );
      setEditingEvolutionGroup(null);
    }
    setSavingEvolutionGroupName(false);
  };

  const handleEvolveSession = async (session: Session, options?: { mode?: "copy" | "blank"; templateId?: string | null }) => {
    if (!id || !user) return;
    setEvolvingSessionId(session.id);
    setSessionToEvolve(null);

    try {
      const targetPatientId = realPatientId || id;
      const clinicRes = await supabase.rpc("get_user_clinic_id", { _user_id: user.id });
      const activeClinicId = clinicRes.data ?? session.clinic_id ?? clinicId;

      let targetEvolutionGroupId = session.evolution_group_id;
      if (!targetEvolutionGroupId && activeClinicId && targetPatientId) {
        const { data: newGroup, error: groupErr } = await supabase
          .from("patient_evolution_groups")
          .insert({
            clinic_id: activeClinicId,
            patient_id: targetPatientId,
          })
          .select("id")
          .maybeSingle();

        if (!groupErr && newGroup) {
          targetEvolutionGroupId = newGroup.id;
          setEvolutionGroupsMetadata((prev) => [...prev, { id: newGroup.id, custom_name: null }]);
          await supabase
            .from("sessions")
            .update({ evolution_group_id: targetEvolutionGroupId })
            .eq("id", session.id);
        }
      }

      const isBlank = options?.mode === "blank";
      const treatment = (session.treatment && typeof session.treatment === "object" ? session.treatment : {}) as any;
      const anamnesis = (session.anamnesis && typeof session.anamnesis === "object" ? session.anamnesis : {}) as any;
      const rawCareLineIds = anamnesis.care_line_ids;
      const careLineIds = Array.isArray(rawCareLineIds) ? rawCareLineIds : session.group_id ? [session.group_id] : [];
      const chosenTemplateId = options?.templateId !== undefined ? options.templateId : (isBlank ? (anamnesisTemplates[0]?.id ?? null) : session.anamnesis_template_id);

      const targetValues = isBlank
        ? {
            amountCharged: "",
            amountOriginal: "",
            amountPaid: "",
            anamnesisFormResponse: {},
            anamnesisTemplateId: chosenTemplateId,
            careLineIds,
            complexityScore: 0,
            groupId: session.group_id,
            notes: "",
            observacoes: "",
            painScore: 0,
            patientArrivedAt: "",
            paymentAdjustmentReason: "",
            paymentInstallments: 1,
            paymentMethod: "nao_informado" as const,
            paymentStatus: "nao_cobrado" as const,
            paymentStatusDate: "",
            queixa: "",
            scheduledStartAt: "",
            sintomas: "",
            status: "rascunho" as const,
            treatmentBlocks: [],
            treatmentGeneralGuidance: "",
          }
        : {
            amountCharged: session.amount_charged_cents ? (session.amount_charged_cents / 100).toFixed(2).replace(".", ",") : "",
            amountOriginal: session.amount_original_cents ? (session.amount_original_cents / 100).toFixed(2).replace(".", ",") : "",
            amountPaid: session.amount_paid_cents ? (session.amount_paid_cents / 100).toFixed(2).replace(".", ",") : "",
            anamnesisFormResponse: (session.anamnesis_form_response as any) || {},
            anamnesisTemplateId: chosenTemplateId,
            careLineIds,
            complexityScore: session.complexity_score ?? 0,
            groupId: session.group_id,
            notes: session.notes ?? "",
            observacoes: anamnesis.observacoes ?? "",
            painScore: session.pain_score ?? 0,
            patientArrivedAt: "",
            paymentAdjustmentReason: session.payment_adjustment_reason ?? "",
            paymentInstallments: session.payment_installments ?? 1,
            paymentMethod: (session.payment_method as any) ?? "nao_informado",
            paymentStatus: (session.payment_status as any) ?? "nao_cobrado",
            paymentStatusDate: session.payment_status_date ?? "",
            queixa: anamnesis.queixa ?? "",
            scheduledStartAt: "",
            sintomas: anamnesis.sintomas ?? "",
            status: "rascunho" as const,
            treatmentBlocks: Array.isArray(treatment.blocks) ? treatment.blocks : [],
            treatmentGeneralGuidance: treatment.generalGuidance ?? "",
          };

      const newSessionData = buildSessionPayload({
        clinicId: activeClinicId,
        creatorUserId: user.id,
        patientId: targetPatientId,
        sessionDate: getCurrentDateTimeInputValue(),
        statusOverride: "rascunho",
        parentSessionId: session.id,
        evolutionGroupId: targetEvolutionGroupId,
        values: targetValues,
      });

      const { data, error } = await supabase
        .from("sessions")
        .insert(newSessionData)
        .select("id")
        .single();

      if (error) {
        toast({
          title: "Erro ao evoluir atendimento",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: isBlank ? "Novo atendimento em branco iniciado" : "Novo atendimento de evolução iniciado",
          description: isBlank ? "Uma nova ficha vinculada a este ciclo está pronta para preenchimento." : "Os dados foram copiados e o atendimento está pronto para preenchimento.",
        });
        navigate(`/pacientes/${id}/sessao/${data.id}?edit=true`, {
          state: { startInEditMode: true },
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro ao evoluir atendimento",
        description: err.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    } finally {
      setEvolvingSessionId(null);
    }
  };

  const getSessionSearchText = useCallback(
    (session: Session) => {
      const preview = getSessionPreviewContent(session, baseSchema);
      return [
        preview.complaint,
        preview.treatment,
        getSessionPersonLabel(profileMap.get(session.user_id)),
      ]
        .filter(Boolean)
        .join(" ");
    },
    [baseSchema, profileMap]
  );

  const sessionView = useMemo(
    () =>
      buildPatientSessionsView({
        groups,
        sessions,
        filters: {
          searchTerm,
          sessionStatus: sessionStatusFilter,
          selectedTagId: selectedTagFilter,
        },
        evolutionGroupsMetadata,
        getSessionText: getSessionSearchText,
      }),
    [evolutionGroupsMetadata, getSessionSearchText, groups, searchTerm, sessionStatusFilter, selectedTagFilter, sessions]
  );

  const dashboardStorageKey = clinicId && id ? `therapy-flow:patient-anamnesis-dashboard:v1:${clinicId}:${id}` : null;

  useEffect(() => {
    if (!dashboardStorageKey) {
      setDashboardChartPreferences({});
      return;
    }

    try {
      const parsed = JSON.parse(window.localStorage.getItem(dashboardStorageKey) ?? "{}");
      setDashboardChartPreferences(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, PatientAnamnesisChartType> : {});
    } catch {
      setDashboardChartPreferences({});
    }
  }, [dashboardStorageKey]);

  const anamnesisDashboard = useMemo(
    () => buildPatientAnamnesisDashboard({ baseSchema, sessions, templates: anamnesisTemplates }),
    [anamnesisTemplates, baseSchema, sessions]
  );

  const handleDashboardChartChange = (metricKey: string, chart: PatientAnamnesisChartType) => {
    const next = { ...dashboardChartPreferences, [metricKey]: chart };
    setDashboardChartPreferences(next);

    if (dashboardStorageKey) {
      window.localStorage.setItem(dashboardStorageKey, JSON.stringify(next));
    }
  };

  const handleExecuteDashboardPrint = () => {
    setShowDashboardPrintModal(false);
    const previousTitle = document.title;
    const patientCleanName = (patient?.name ?? "Paciente").replace(/[^a-zA-Z0-9-_\s]/g, " ").replaceAll(/\s+/g, " ").trim();
    const clinicCleanName = (clinic?.name ?? "Clínica").replace(/[^a-zA-Z0-9-_\s]/g, " ").replaceAll(/\s+/g, " ").trim();
    document.title = `Estatísticas de Anamnese - ${patientCleanName} - ${clinicCleanName}`;

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = previousTitle;
      }, 1000);
    }, 150);
  };

  const normalizedGroupName = normalizeGroupName(groupName);
  const existingPatientGroup = normalizedGroupName
    ? groups.find((group) => {
        if (editingGroup?.id === group.id) return false;
        return normalizeGroupName(group.name) === normalizedGroupName;
      })
    : undefined;
  const existingSuggestion = normalizedGroupName
    ? groupSuggestions.find((suggestion) => normalizeGroupName(suggestion.name) === normalizedGroupName)
    : undefined;
  const patientGroupNameSet = new Set(groups.map((group) => normalizeGroupName(group.name)));

  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedSessionIds.includes(session.id)),
    [selectedSessionIds, sessions]
  );

  const canDeleteSelection = canDeleteSelectedSessionsForRole({
    currentUserId: user?.id,
    operationalRole,
    selectedSessions,
  });
  const canManageSessions = operationalRole === "owner" || operationalRole === "admin";
  const canShareSelection =
    selectedSessions.length > 0 &&
    selectedSessions.every((session) => canManageSessions || session.user_id === user?.id || session.provider_id === user?.id);
  const selectedShareRecipients = useMemo(() => {
    const recipients = new Map<string, NonNullable<SessionShareSummary["recipients"]>[number]>();

    selectedSessionIds.forEach((sessionId) => {
      sessionShareSummaries[sessionId]?.recipients.forEach((recipient) => {
        recipients.set(recipient.id, recipient);
      });
    });

    return Array.from(recipients.values());
  }, [selectedSessionIds, sessionShareSummaries]);
  const shareRecipientsSession = shareRecipientsSessionId
    ? sessions.find((session) => session.id === shareRecipientsSessionId) ?? null
    : null;
  const shareRecipientsSummary = shareRecipientsSessionId ? sessionShareSummaries[shareRecipientsSessionId] : undefined;

  const handleBulkMove = async (nextGroupId: string) => {
    if (selectedSessionIds.length === 0) {
      return;
    }

    const resolvedGroupId = nextGroupId === "none" ? null : nextGroupId;
    optimisticMoveSessions(selectedSessionIds, resolvedGroupId);
    handleExitSelectionMode();

    setBulkUpdating(true);
    const { error } = await supabase
      .from("sessions")
      .update({ group_id: resolvedGroupId })
      .in("id", selectedSessionIds);

    if (error) {
      toast({ title: "Erro ao mover atendimentos", description: error.message, variant: "destructive" });
      if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]);
    } else {
      toast({ title: "Atendimentos movidos" });
    }
    setBulkUpdating(false);
  };

  const handleBulkLinkEvolutionGroup = async (targetGroupId: string) => {
    if (selectedSessionIds.length === 0 || !realPatientId || !clinicId) return;

    let finalGroupId: string | null = targetGroupId === "none" ? null : targetGroupId;

    if (targetGroupId === "__new__") {
      const { data: newGroup, error: groupErr } = await supabase
        .from("patient_evolution_groups")
        .insert({
          clinic_id: clinicId,
          patient_id: realPatientId,
        })
        .select("id")
        .maybeSingle();

      if (groupErr || !newGroup) {
        toast({ title: "Erro ao criar grupo de evolução", description: groupErr?.message, variant: "destructive" });
        return;
      }
      finalGroupId = newGroup.id;
      setEvolutionGroupsMetadata((prev) => [...prev, { id: newGroup.id, custom_name: null }]);
    }

    optimisticMoveSessionsToEvolutionGroup(selectedSessionIds, finalGroupId);
    handleExitSelectionMode();

    setBulkUpdating(true);
    const { error } = await supabase
      .from("sessions")
      .update({ evolution_group_id: finalGroupId })
      .in("id", selectedSessionIds);

    if (error) {
      toast({ title: "Erro ao vincular ao grupo de evolução", description: error.message, variant: "destructive" });
      if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]);
    } else {
      toast({
        title: finalGroupId ? "Atendimentos vinculados ao grupo de evolução" : "Atendimentos desvinculados do grupo",
      });
      if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]);
    }
    setBulkUpdating(false);
  };

  const handleLinkSessionEvolutionGroup = async (session: Session, targetGroupId: string) => {
    if (!realPatientId || !clinicId) return;

    let finalGroupId: string | null = targetGroupId === "none" ? null : targetGroupId;

    if (targetGroupId === "__new__") {
      const { data: newGroup, error: groupErr } = await supabase
        .from("patient_evolution_groups")
        .insert({
          clinic_id: clinicId,
          patient_id: realPatientId,
        })
        .select("id")
        .maybeSingle();

      if (groupErr || !newGroup) {
        toast({ title: "Erro ao criar grupo de evolução", description: groupErr?.message, variant: "destructive" });
        return;
      }
      finalGroupId = newGroup.id;
      setEvolutionGroupsMetadata((prev) => [...prev, { id: newGroup.id, custom_name: null }]);
    }

    optimisticMoveSessionsToEvolutionGroup([session.id], finalGroupId);
    setSessionToLinkGroup(null);

    const { error } = await supabase
      .from("sessions")
      .update({ evolution_group_id: finalGroupId })
      .eq("id", session.id);

    if (error) {
      toast({ title: "Erro ao vincular atendimento ao grupo", description: error.message, variant: "destructive" });
      if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]);
    } else {
      toast({
        title: finalGroupId ? "Atendimento vinculado ao grupo de evolução" : "Atendimento desvinculado do grupo",
      });
      if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]);
    }
  };

  const handleBulkStatusUpdate = async (nextStatus: string) => {
    if (selectedSessionIds.length === 0) {
      return;
    }

    optimisticUpdateSessionStatus(selectedSessionIds, nextStatus);
    handleExitSelectionMode();

    setBulkUpdating(true);
    const { error } = await supabase
      .from("sessions")
      .update({ status: nextStatus })
      .in("id", selectedSessionIds);

    if (error) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
      if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]);
    } else {
      toast({ title: "Status dos atendimentos atualizado" });
    }
    setBulkUpdating(false);
  };

  const handleBulkDelete = async () => {
    if (!canDeleteSelection) {
      const canDeleteAnyStatus = operationalRole === "owner" || operationalRole === "admin";
      toast({
        title: canDeleteAnyStatus ? "Não foi possível excluir os atendimentos" : "Seleção sem permissão para exclusão",
        description: canDeleteAnyStatus
          ? "Tente novamente em alguns instantes."
          : "Profissionais só podem excluir atendimentos que eles mesmos criaram.",
        variant: "destructive",
      });
      return;
    }

    optimisticDeleteSessions(selectedSessionIds);
    handleExitSelectionMode();

    setBulkUpdating(true);
    const { error } = await supabase.from("sessions").delete().in("id", selectedSessionIds);

    if (error) {
      toast({ title: "Erro ao excluir atendimentos", description: error.message, variant: "destructive" });
      if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]);
    } else {
      toast({ title: "Atendimentos excluídos" });
    }
    setBulkUpdating(false);
  };

  const handleOpenSessionShareDialog = () => {
    if (!canShareSelection) {
      toast({
        title: "Não foi possível compartilhar",
        description: "Selecione apenas atendimentos criados por você ou que você administra.",
        variant: "destructive",
      });
      return;
    }

    setSessionShareDialogOpen(true);
  };

  const toggleGroupCollapsed = (groupId: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-300">
        {/* Cabeçalho superior simulado */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
        </div>

        {/* Card de feedback humanizado de carregamento */}
        <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 sm:p-6">
            <LoadingFeedback
              message="Carregando prontuário do paciente..."
              onRetry={() => void invalidatePatientData(realPatientId || id)}
            />
          </CardContent>
        </Card>

        {/* Silhueta de abas e estatísticas operacionais */}
        <div className="space-y-4">
          <div className="flex gap-2 border-b pb-2">
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>

          <div className="space-y-3 pt-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return <div className="text-center py-24 text-muted-foreground">Paciente não encontrado.</div>;
  }

  const sharePasswordAvailable = !!getPatientRegistrationPassword(patient.cpf);
  const patientWhatsAppHref = buildPatientWhatsAppHref(patient.phone);
  const sortedSessionsByDate = [...sessions].sort(
    (left, right) => new Date(right.session_date).getTime() - new Date(left.session_date).getTime()
  );
  const latestSession = sortedSessionsByDate[0] ?? null;
  const completedSessionsCount = sessions.filter((session) => session.status === "concluído").length;
  const operationalSummary = buildPatientOperationalSummary(sessions);
  const paymentSummaryAdjustmentCents = operationalSummary.chargedCents - operationalSummary.originalChargedCents;
  const paymentSummaryAdjustmentPercent =
    operationalSummary.originalChargedCents > 0
      ? Math.round((paymentSummaryAdjustmentCents / operationalSummary.originalChargedCents) * 100)
      : 0;
  const hasPaymentSummaryAdjustment = operationalSummary.originalChargedCents > 0 && paymentSummaryAdjustmentCents !== 0;
  const patientRegistrationStatus = patient.registration_complete ? "Cadastro concluído" : "Cadastro pendente";
  const allergyAlertItems = splitClinicalAlertItems(patient.allergies);
  const fallRiskAlertItems = [
    ...(parsedClinicalProfile.risk_flags.includes("fall_risk") ? ["Risco marcado no cadastro"] : []),
    ...splitClinicalAlertItems(parsedClinicalProfile.falls_history),
    ...(parsedClinicalProfile.functional_independence === "parcialmente_dependente" || parsedClinicalProfile.functional_independence === "dependente"
      ? [`Contexto funcional: ${getFunctionalIndependenceLabel(parsedClinicalProfile.functional_independence)}`]
      : []),
  ];
  const structuredRiskAlertItems = parsedClinicalProfile.risk_flags
    .filter((risk) => risk !== "fall_risk" && risk !== "allergy")
    .map(getPatientRiskFlagLabel);
  const allAllergyAlertItems = [
    ...(parsedClinicalProfile.risk_flags.includes("allergy") ? ["Alergia marcada no cadastro"] : []),
    ...allergyAlertItems,
  ];
  const activeAgendaEvents = agendaEvents.filter((event) => getAgendaEventStatus(event) !== "cancelado");
  const nowTimestamp = Date.now();
  const overdueAgendaEvents = activeAgendaEvents
    .filter((event) => new Date(event.scheduled_for).getTime() < nowTimestamp)
    .sort((left, right) => right.scheduled_for.localeCompare(left.scheduled_for));
  const futureAgendaEvents = activeAgendaEvents
    .filter((event) => new Date(event.scheduled_for).getTime() >= nowTimestamp)
    .sort((left, right) => left.scheduled_for.localeCompare(right.scheduled_for));
  const visiblePatientAgendaEvents = [...overdueAgendaEvents, ...futureAgendaEvents];
  const upcomingAgendaEvent = visiblePatientAgendaEvents[0] ?? null;
  const futureAgendaCount = futureAgendaEvents.length;
  const agendaDialogDateTime = agendaDate && agendaTime ? getAgendaEventDateTime(new Date(`${agendaDate}T12:00:00`), agendaTime) : null;
  const isAgendaDialogDateTimePast = agendaDialogDateTime ? isAgendaEventDateTimeInPast(agendaDialogDateTime) : false;
  const selectedAgendaDateTime =
    selectedAgendaDate && selectedAgendaTime ? new Date(`${selectedAgendaDate}T${selectedAgendaTime || "00:00"}:00`) : null;
  const isSelectedAgendaDateTimePast = selectedAgendaDateTime ? isAgendaEventDateTimeInPast(selectedAgendaDateTime) : false;
  const canceledSessionsCount = sessions.filter((session) => session.status === "cancelado").length;
  const draftSessionsCount = sessions.filter((session) => session.status === "rascunho").length;
  const totalSessionsCount = sessions.length;
  const scheduledSessionsCount = sessions.filter((session) => session.scheduled_start_at).length;
  const absentSessionsCount = operationalSummary.absences;
  const delayedSessionsCount = sessions.filter((session) => {
    const delay = getArrivalDelayMinutes(session);
    return delay !== null && delay > 0;
  }).length;
  const onTimeSessionsCount = Math.max(scheduledSessionsCount - absentSessionsCount - delayedSessionsCount, 0);
  const settledPaymentCents = Math.min(operationalSummary.paidCents, operationalSummary.chargedCents);
  const patientRecurringWeekdays = normalizePatientRecurringWeekdays(patient.recurring_weekdays);
  const patientRecurringTime = normalizePatientRecurringTime(patient.recurring_time);
  const patientRecurrenceLabel = patient.is_recurring && patientRecurringWeekdays.length > 0
    ? `${formatPatientRecurringWeekdays(patientRecurringWeekdays)} · ${patientRecurringTime}`
    : "Recorrência";
  const handleOpenPatientAgendaDialog = () => {
    const nextDefaults = getDefaultAgendaInputs();
    setAgendaDate(nextDefaults.date);
    setAgendaTime(nextDefaults.time);
    setAgendaDialogOpen(true);
  };
  const handleOpenAgendaDetails = (event: AgendaEvent) => {
    setSelectedAgendaEvent(event);
    setSelectedAgendaStatusAction(getAgendaEventStatus(event));
    setSelectedAgendaDate(getDateInputValue(new Date(event.scheduled_for)));
    setSelectedAgendaTime(getTimeInputValue(event.scheduled_for));
  };
  const handleSchedulePatientAgendaEvent = async () => {
    if (!user || !patient) {
      return;
    }

    try {
      const selectedDateTime = getAgendaEventDateTime(new Date(`${agendaDate}T12:00:00`), agendaTime);
      assertAgendaEventDateTimeIsFuture(selectedDateTime);
      setSavingAgendaEvent(true);
      const payload = buildAgendaEventPayload({
        clinicId,
        eventType: "atendimento",
        selectedDate: new Date(`${agendaDate}T12:00:00`),
        selectedPatient: { id: patient.id, name: patient.name },
        time: agendaTime,
        title: patient.name,
        userId: user.id,
      });

      const { data, error } = await supabase
        .from("agenda_events")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      optimisticAddAgendaEvent(data as AgendaEvent);
      setAgendaDialogOpen(false);
      notifyAgendaEventsUpdated();
      toast({ title: "Agendamento confirmado" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel salvar o agendamento.";
      toast({ title: "Erro ao salvar agendamento", description: message, variant: "destructive" });
    } finally {
      setSavingAgendaEvent(false);
    }
  };
  const toggleRecurrenceWeekday = (weekday: number, checked: boolean | "indeterminate") => {
    setRecurrenceWeekdays((current) => {
      if (checked === true) {
        return current.includes(weekday) ? current : [...current, weekday].sort((left, right) => left - right);
      }

      return current.filter((value) => value !== weekday);
    });
  };
  const handleSaveRecurrence = async () => {
    if (!user || !patient) {
      return;
    }

    const normalizedWeekdays = recurrenceEnabled ? normalizePatientRecurringWeekdays(recurrenceWeekdays) : [];
    const normalizedTime = normalizePatientRecurringTime(recurrenceTime);

    if (recurrenceEnabled && normalizedWeekdays.length === 0) {
      toast({
        title: "Escolha pelo menos um dia",
        description: "Para paciente recorrente, marque os dias da semana programados.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingRecurrence(true);

      const { data: updatedPatient, error: patientError } = await supabase
        .from("patients")
        .update({
          is_recurring: recurrenceEnabled,
          recurring_time: normalizedTime,
          recurring_weekdays: normalizedWeekdays,
        })
        .eq("id", patient.id)
        .select("*")
        .single();

      if (patientError) {
        throw patientError;
      }

      const now = new Date();
      const { error: deleteError } = await supabase
        .from("agenda_events")
        .delete()
        .eq("patient_id", patient.id)
        .eq("generated_by_recurring_patient", true)
        .gte("scheduled_for", now.toISOString());

      if (deleteError) {
        throw deleteError;
      }

      if (recurrenceEnabled) {
        const nextDateTime = getNextPatientRecurrenceDateTime({
          now,
          time: normalizedTime,
          weekdays: normalizedWeekdays,
        });

        if (nextDateTime) {
          const alreadyHasManualEvent = agendaEvents.some((event) => {
            const eventTime = new Date(event.scheduled_for).getTime();
            return (
              event.patient_id === patient.id &&
              !event.generated_by_recurring_patient &&
              getAgendaEventStatus(event) !== "cancelado" &&
              eventTime === nextDateTime.getTime()
            );
          });

          if (!alreadyHasManualEvent) {
            const { error: insertError } = await supabase.from("agenda_events").insert({
              clinic_id: clinicId,
              event_type: "atendimento",
              generated_by_recurring_patient: true,
              patient_id: patient.id,
              scheduled_for: nextDateTime.toISOString(),
              status: "lembrete",
              title: patient.name,
              user_id: user.id,
            });

            if (insertError) {
              throw insertError;
            }
          }
        }
      }

      optimisticUpdatePatient(updatedPatient as Patient);
      if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["patient", "agenda"]);
      notifyAgendaEventsUpdated();
      setRecurrenceDialogOpen(false);
      toast({ title: "Recorrência atualizada" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar a recorrência.";
      toast({ title: "Erro ao salvar recorrência", description: message, variant: "destructive" });
    } finally {
      setSavingRecurrence(false);
    }
  };
  const handleApplyAgendaStatus = async () => {
    if (!selectedAgendaEvent || !user || !patient) {
      return;
    }

    try {
      setSavingAgendaDetails(true);

      if (selectedAgendaStatusAction === "delete") {
        optimisticDeleteAgendaEvent(selectedAgendaEvent.id);
        const { error } = await supabase.from("agenda_events").delete().eq("id", selectedAgendaEvent.id);

        if (error) {
          if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["agenda"]);
          throw error;
        }

        setSelectedAgendaEvent(null);
        notifyAgendaEventsUpdated();
        toast({ title: "Agendamento excluído" });
        return;
      }

      const previousStatus = getAgendaEventStatus(selectedAgendaEvent);
      const updatedAgendaRecord = { ...selectedAgendaEvent, status: selectedAgendaStatusAction };
      optimisticUpdateAgendaEvent(updatedAgendaRecord);

      const { data, error } = await supabase
        .from("agenda_events")
        .update({ status: selectedAgendaStatusAction })
        .eq("id", selectedAgendaEvent.id)
        .select("*")
        .single();

      if (error) {
        if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["agenda"]);
        throw error;
      }

      const updatedEvent = data as AgendaEvent;
      setSelectedAgendaEvent(updatedEvent);

      if (selectedAgendaStatusAction === "cancelado" && previousStatus !== "cancelado") {
        const canceledGroup = groups.find((group) => getPatientGroupKind(group) === "cancelados") ?? null;
        const { data: canceledSession, error: sessionError } = await supabase
          .from("sessions")
          .insert({
            clinic_id: clinicId,
            group_id: canceledGroup?.id ?? null,
            notes: "Atendimento cancelado a partir do agendamento.",
            patient_id: patient.id,
            provider_id: user.id,
            session_date: selectedAgendaEvent.scheduled_for,
            status: "cancelado",
            user_id: user.id,
          })
          .select("*")
          .single();

        if (sessionError) {
          throw sessionError;
        }

        if (canceledSession && realPatientId) {
          void invalidatePatientData(realPatientId, clinicId, ["sessions"]);
        }
      }

      notifyAgendaEventsUpdated();
      toast({ title: "Status do agendamento atualizado" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel atualizar o agendamento.";
      toast({ title: "Erro ao atualizar agendamento", description: message, variant: "destructive" });
    } finally {
      setSavingAgendaDetails(false);
    }
  };
  const handleUpdateAgendaDateTime = async () => {
    if (!selectedAgendaEvent) {
      return;
    }

    try {
      setSavingAgendaDetails(true);
      const nextDate = new Date(`${selectedAgendaDate}T${selectedAgendaTime || "00:00"}:00`);
      assertAgendaEventDateTimeIsFuture(nextDate);
      const { data, error } = await supabase
        .from("agenda_events")
        .update({ scheduled_for: nextDate.toISOString() })
        .eq("id", selectedAgendaEvent.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const updatedEvent = data as AgendaEvent;
      optimisticUpdateAgendaEvent(updatedEvent);
      setSelectedAgendaEvent(updatedEvent);
      notifyAgendaEventsUpdated();
      toast({ title: "Data e horário atualizados" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel trocar data/horario.";
      toast({ title: "Erro ao trocar data/horário", description: message, variant: "destructive" });
    } finally {
      setSavingAgendaDetails(false);
    }
  };
  const handleStartAgendaAttendance = () => {
    if (!selectedAgendaEvent) {
      return;
    }

    navigate(`/pacientes/${id}/sessao/novo`, {
      state: {
        agendaEventId: selectedAgendaEvent.id,
        scheduledFor: selectedAgendaEvent.scheduled_for,
      },
    });
  };

  const handleStartAttendanceNow = async () => {
    if (!patient || !user) return;

    if (upcomingAgendaEvent) {
      navigate(`/pacientes/${id}/sessao/novo`, {
        state: {
          agendaEventId: upcomingAgendaEvent.id,
          scheduledFor: upcomingAgendaEvent.scheduled_for,
        },
      });
      return;
    }

    try {
      const now = new Date();
      const { data, error } = await supabase
        .from("agenda_events")
        .insert({
          clinic_id: clinicId,
          event_type: "atendimento",
          patient_id: patient.id,
          scheduled_for: now.toISOString(),
          status: "confirmado",
          title: patient.name,
          user_id: user.id,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      notifyAgendaEventsUpdated();

      navigate(`/pacientes/${id}/sessao/novo`, {
        state: {
          agendaEventId: data.id,
          scheduledFor: data.scheduled_for,
        },
      });
    } catch (err) {
      logRuntimeError("patient_detail.start_attendance_now", err);
      toast({
        title: "Erro ao iniciar atendimento",
        description: "Não foi possível registrar o agendamento no momento.",
        variant: "destructive",
      });
    }
  };

  return (
    <PatientFilesProvider patientId={patient?.id || id!} clinicId={clinicId}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-6">
      {/* Header */}
      <div data-tutorial="patient-profile-header" className="overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(clinicHomePath)}
              aria-label="Voltar"
              className="mt-1 shrink-0 rounded-full bg-background/80"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 space-y-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Paciente</p>
                <h1 className="truncate text-3xl font-bold tracking-tight">{patient.name}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {patient.age ? (
                  <span className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-3 py-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {patient.age} anos
                  </span>
                ) : null}
                {canViewPatientContact && patient.phone ? (
                  <span className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-3 py-1">
                    <Phone className="h-3.5 w-3.5" />
                    {patient.phone}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => navigate(getPatientPath(patient, "cadastro"))}
                  title="Editar cadastro completo"
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    patient.registration_complete
                      ? "bg-success/10 text-success hover:bg-success/15"
                      : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                  }`}
                >
                  {patient.registration_complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  {patientRegistrationStatus}
                </button>
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {canViewPatientContact
                  ? "Acesse rapidamente contato, cadastro, status e novo atendimento sem sair da ficha do paciente."
                  : "Acesse rapidamente cadastro, status e novo atendimento sem sair da ficha do paciente."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:flex-1 xl:justify-center">
            <PatientHeaderAlert
              icon={<AlertTriangle className="h-4 w-4" />}
              items={allAllergyAlertItems}
              title="Alergias"
              tone="rose"
            />
            <PatientHeaderAlert
              icon={<AlertTriangle className="h-4 w-4" />}
              items={fallRiskAlertItems}
              title="Risco de queda"
              tone="amber"
            />
            <PatientHeaderAlert
              icon={<AlertTriangle className="h-4 w-4" />}
              items={structuredRiskAlertItems}
              title="Riscos"
              tone="amber"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border bg-background/70 p-2.5 shadow-sm backdrop-blur xl:shrink-0">
            {canViewPatientContact ? (
              <Button
                variant="outline"
                size="icon"
                onClick={() => patientWhatsAppHref && window.open(patientWhatsAppHref, "_blank", "noopener,noreferrer")}
                disabled={!patientWhatsAppHref}
                aria-label="Abrir WhatsApp do paciente"
                title="Abrir WhatsApp"
                className="h-9 w-9 rounded-xl border-success/30 bg-success/10 text-success hover:bg-success/15 hover:text-success shrink-0"
              >
                <WhatsAppLogo className="h-4.5 w-4.5" />
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPatientInfoDialogOpen(true)}
              className={getDesignLabButtonClass(
                "hover:w-[165px]",
                "h-9 rounded-xl border-primary/20 bg-background hover:border-primary/50 hover:bg-primary/5 text-xs font-medium shrink-0"
              )}
              title="Abrir resumo clínico do paciente"
            >
              <FileText className={`${designLabIconClass} h-4 w-4 text-primary`} />
              <span className={designLabLabelClass}>Resumo clínico</span>
            </Button>
            <Select
              value={patient.status}
              onValueChange={(value) => void handlePatientStatusChange(value as PatientStatusSelectValue)}
              disabled={updatingPatientStatus || deletingPatient}
            >
              <SelectTrigger className="h-9 w-[130px] rounded-xl text-xs bg-background shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITABLE_PATIENT_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value} className="text-xs">{status.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Mais opções" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  data-tutorial="patient-btn-share-form"
                  onClick={() => handleOpenShareDialog()}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Compartilhar cadastro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRecurrenceDialogOpen(true)}>
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Configurar recorrência
                </DropdownMenuItem>
                {canDeletePatient && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeletePatientDialogOpen(true)}
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir paciente
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr),minmax(360px,0.65fr)]">
        {/* Compact Metrics Grid */}
        <div data-tutorial="patient-metrics-panel" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-2xl border bg-card p-4 shadow-sm relative">
          <div className="rounded-xl border bg-muted/20 p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Último Atendimento</span>
              <ComponentHelpButton helpId="patient-metrics-panel" size="xs" />
            </div>
            <div className="mt-2">
              <p className="text-lg font-bold text-foreground">{formatSessionMetaDate(latestSession?.session_date ?? null)}</p>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{latestSession ? `Status: ${latestSession.status}` : "Sem atendimentos anteriores"}</p>
            </div>
          </div>
          <div className="rounded-xl border bg-muted/20 p-3 flex flex-col justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Presença & Histórico</span>
            <div className="mt-2">
              <p className="text-lg font-bold text-foreground">{totalSessionsCount} atendimento{totalSessionsCount !== 1 ? "s" : ""}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {completedSessionsCount} concluído{completedSessionsCount !== 1 ? "s" : ""} · {canceledSessionsCount} cancelado{canceledSessionsCount !== 1 ? "s" : ""}
                {operationalSummary.averageDelayMinutes > 0 ? ` · média ${operationalSummary.averageDelayMinutes}min` : ""}
              </p>
            </div>
          </div>
          {canViewFinancialData ? (
            <div className="rounded-xl border bg-muted/20 p-3 flex flex-col justify-between sm:col-span-2 lg:col-span-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Financeiro do Paciente</span>
              <div className="mt-2">
                <p className="text-lg font-bold text-foreground">{formatMoneyCents(settledPaymentCents)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cobrado: {formatMoneyCents(operationalSummary.chargedCents)}
                  {operationalSummary.openBalanceCents > 0 ? ` · Aberto: ${formatMoneyCents(operationalSummary.openBalanceCents)}` : " · Em dia"}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/20 p-3 flex flex-col justify-between sm:col-span-2 lg:col-span-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agendamentos</span>
              <div className="mt-2">
                <p className="text-lg font-bold text-foreground">{futureAgendaCount} agendado{futureAgendaCount !== 1 ? "s" : ""}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {upcomingAgendaEvent ? `Próximo: ${formatAgendaEventDateTime(upcomingAgendaEvent.scheduled_for)}` : "Nenhum agendamento futuro"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div data-tutorial="patient-internal-agenda">
          <AgendaWidget
            fixedPatient={{ id: patient.id, name: patient.name }}
            onStartAttendance={() => void handleStartAttendanceNow()}
            startAttendanceLabel="Iniciar atendimento agora"
            headerAccessory={
              <Button
                data-tutorial="patient-btn-recurrence"
                type="button"
                variant={patient.is_recurring ? "default" : "outline"}
                size="sm"
                className={getDesignLabButtonClass("hover:w-[200px]", "h-9 rounded-xl text-xs")}
                onClick={() => setRecurrenceDialogOpen(true)}
                title={patient.is_recurring ? `Recorrente: ${patientRecurrenceLabel}` : "Configurar recorrência"}
              >
                <CalendarClock className={`${designLabIconClass} h-3.5 w-3.5`} />
                <span className={designLabLabelClass}>{patientRecurrenceLabel}</span>
              </Button>
            }
          />
        </div>
      </div>

      {/* Group management toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <LiquidTabs
            tabs={[
              { id: "list", label: "Atendimentos", icon: ClipboardList, dataTutorial: "patient-tab-sessions", buttonClass: getDesignLabButtonClass("hover:w-[140px]"), labelClass: designLabLabelClass, iconClass: designLabIconClass },
              ...(isFeatureEnabled("storage_s3_integration") ? [{ id: "files", label: "Arquivos", icon: FileText, dataTutorial: "patient-tab-files", buttonClass: getDesignLabButtonClass("hover:w-[125px]"), labelClass: designLabLabelClass, iconClass: designLabIconClass }] : []),
              ...(isFeatureEnabled("dashboards_patient") ? [{ id: "dashboard", label: "Estatísticas", icon: BarChart3, buttonClass: getDesignLabButtonClass("hover:w-[140px]"), labelClass: designLabLabelClass, iconClass: designLabIconClass }] : [])
            ]}
            activeTab={recordsView}
            onChange={(val) => setRecordsView(val as "list" | "files" | "dashboard")}
            className="w-full sm:w-auto"
            tabClassName="flex-1 sm:flex-none"
          />
          {recordsView === "dashboard" && !isIntern && (
            <div className="flex items-center justify-end gap-2">
              {can("system.print") && isFeatureEnabled("print_general") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDashboardPrintModal(true)}
                  className="gap-2 text-xs border-primary/40 text-primary hover:bg-primary/5"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir Estatísticas
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`${clinicHomePath}/configuracoes?secao=forms`)}
                className="gap-2 text-xs"
              >
                <ClipboardList className="h-4 w-4 text-primary" />
                Gerenciar Formulários
              </Button>
            </div>
          )}
        </div>

        {recordsView === "dashboard" ? (
          <PatientAnamnesisDashboardContent
            chartPreferences={dashboardChartPreferences}
            dashboard={anamnesisDashboard}
            onChartChange={handleDashboardChartChange}
            onPrintRequest={can("system.print") && isFeatureEnabled("print_general") ? () => setShowDashboardPrintModal(true) : undefined}
            onSelectedTemplateIdChange={setDashboardTemplateFilter}
            selectedTemplateId={dashboardTemplateFilter}
          />
        ) : recordsView === "files" ? (
          <PatientFilesPanel
            clinicId={clinicId}
            patientId={patient.id}
            sessionId={null}
            title="Arquivos do paciente"
            variant="patient"
          />
        ) : (
          <>
        {/* Banner de Rascunhos Pendentes */}
        {sessions.filter((s) => s.status === "rascunho").length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm">
                  {sessions.filter((s) => s.status === "rascunho").length} atendimento(s) em rascunho pendente(s)
                </p>
                <p className="text-xs text-muted-foreground dark:text-amber-300/80">
                  Revisar e concluir atendimentos em andamento mantém o prontuário clínico protegido e atualizado.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/40 bg-background/80 hover:bg-background text-xs gap-1 self-start sm:self-auto shrink-0"
              onClick={() => setSessionStatusFilter("rascunho")}
            >
              Ver Rascunhos
            </Button>
          </div>
        )}

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr),180px,200px,auto] items-end">
            <div className="space-y-2">
              <Label htmlFor="sessions-search">Buscar no prontuário</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="sessions-search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Ex: lombar, conduta, 18/03/2026"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status do atendimento</Label>
              <Select value={sessionStatusFilter} onValueChange={setSessionStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {SESSION_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Filtrar por Sintoma / Tag</Label>
              <Select value={selectedTagFilter} onValueChange={setSelectedTagFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os sintomas / tags</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                  <SelectItem value="none">Sintomas não definidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground block">Agrupamento</Label>
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-background/50">
                <Switch
                  id="group-by-evolution-toggle"
                  checked={groupByEvolution}
                  onCheckedChange={handleToggleGroupByEvolution}
                />
                <Label htmlFor="group-by-evolution-toggle" className="text-xs font-medium cursor-pointer select-none whitespace-nowrap">
                  Visualizar grupos
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {!isIntern && selectionMode && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Badge variant="secondary">{selectedSessionIds.length} atendimento(s) selecionado(s)</Badge>
              <Button
                variant="default"
                size="sm"
                onClick={() => void handleBulkStatusUpdate("concluído")}
                disabled={bulkUpdating || selectedSessionIds.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                Concluir Selecionados
              </Button>
              <Select onValueChange={(value) => void handleBulkLinkEvolutionGroup(value)} disabled={bulkUpdating || selectedSessionIds.length === 0}>
                <SelectTrigger className="w-[230px] bg-background">
                  <SelectValue placeholder="Vincular a Grupo de Evolução" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Remover de Grupo (Tornar Avulso)</SelectItem>
                  <SelectItem value="__new__">+ Criar Novo Grupo de Evolução</SelectItem>
                  {evolutionGroupsMetadata.map((group) => {
                    const matchedGroupView = sessionView.evolutionGroups.find((g) => g.id === group.id);
                    const label = group.custom_name || (matchedGroupView?.tagGroups.map(g => g.name).join(" · ")) || `Ciclo (${group.id.slice(0, 6)})`;
                    return (
                      <SelectItem key={group.id} value={group.id}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select onValueChange={(value) => void handleBulkMove(value)} disabled={bulkUpdating || selectedSessionIds.length === 0}>
                <SelectTrigger className="w-[230px] bg-background">
                  <SelectValue placeholder="Vincular a Sintoma / Tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sintomas não definidos</SelectItem>
                  {Array.from(new Map(groups.map(g => [g.name, g])).values()).map((group) => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={(value) => void handleBulkStatusUpdate(value)} disabled={bulkUpdating || selectedSessionIds.length === 0}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="Alterar status" />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenSessionShareDialog}
                disabled={bulkUpdating || !canShareSelection}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Compartilhar com colaboradores
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleBulkDelete()}
                disabled={bulkUpdating || !canDeleteSelection}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir atendimentos
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExitSelectionMode} disabled={bulkUpdating}>
                <X className="h-4 w-4 mr-2" />
                Cancelar seleção
              </Button>
            </CardContent>
          </Card>
        )}
        {/* Barra de Filtros por Sintomas / Tags e Histórico */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  Histórico de Atendimentos
                  <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5 rounded-full">
                    {sessionView.totalCount}
                  </Badge>
                </h2>
                <ComponentHelpButton
                  helpId="patient-tab-sessions"
                  size="xs"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Linha do tempo cronológica com ciclos de evolução e filtros rápidos
              </p>
            </div>

            {/* Toggle Visão Detalhada / Compacta */}
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border self-start sm:self-auto">
              <Button
                type="button"
                variant={sessionViewMode === "detailed" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5 gap-1.5 font-medium shadow-none"
                onClick={() => handleSetSessionViewMode("detailed")}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>Detalhado</span>
              </Button>
              <Button
                type="button"
                variant={sessionViewMode === "compact" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5 gap-1.5 font-medium shadow-none"
                onClick={() => handleSetSessionViewMode("compact")}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Compacto</span>
              </Button>
            </div>
          </div>

          {/* Filtros em Pílulas Táteis por Tags / Sintomas */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <Button
              type="button"
              size="sm"
              variant={selectedTagFilter === "all" ? "default" : "outline"}
              onClick={() => setSelectedTagFilter("all")}
              className="text-xs h-7 px-3 rounded-full shrink-0 font-medium"
            >
              ✨ Todos ({sessionView.totalCount})
            </Button>

            {sessionView.tagStats.map(({ group, count }) => {
              const isSelected = selectedTagFilter === group.id;
              const groupHex = getLegacyGroupHex(group.color);
              return (
                <Button
                  key={group.id}
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => setSelectedTagFilter(isSelected ? "all" : group.id)}
                  className={`text-xs h-7 px-3 rounded-full shrink-0 gap-1.5 transition-all ${
                    isSelected ? "shadow-sm font-semibold ring-1 ring-primary/40" : "text-foreground hover:bg-accent/40"
                  }`}
                  style={
                    isSelected
                      ? {
                          borderColor: groupHex,
                          backgroundColor: groupHex,
                          color: getReadableTextColor(groupHex),
                        }
                      : undefined
                  }
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: getLegacyGroupHex(group.color) }}
                  />
                  {group.name}
                  <span className={`text-[10px] ml-0.5 opacity-80 ${isSelected ? "" : "text-muted-foreground"}`}>
                    ({count})
                  </span>
                </Button>
              );
            })}

            {sessionView.ungroupedCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant={selectedTagFilter === "none" ? "default" : "outline"}
                onClick={() => setSelectedTagFilter(selectedTagFilter === "none" ? "all" : "none")}
                className="text-xs h-7 px-3 rounded-full shrink-0 text-muted-foreground"
              >
                Sintomas não definidos ({sessionView.ungroupedCount})
              </Button>
            )}
          </div>
        </div>

        {/* Linha do Tempo Cronológica com Ciclos de Evolução ou Lista Contínua */}
        {sessionView.chronologicalSessions.length > 0 ? (
          <div className="space-y-4">
            {/* Grupos de Evolução Retráteis (quando ativado na visualização) */}
            {groupByEvolution && sessionView.evolutionGroups.length > 0 ? (
              <div className="space-y-3">
                {sessionView.evolutionGroups.map((evoGroup) => {
                  const isCollapsed = collapsedEvolutionGroupIds.includes(evoGroup.id);
                  const matchedPlan = evoGroup.paymentPlanIds.length > 0 ? paymentPlanMap.get(evoGroup.paymentPlanIds[0]) : null;
                  const primaryColor = evoGroup.tagGroups[0]?.color ? getLegacyGroupHex(evoGroup.tagGroups[0].color) : undefined;
                  const groupTitle = evoGroup.customName || (evoGroup.tagGroups.length > 0 ? evoGroup.tagGroups.map((g) => g.name).join(" · ") : "Ciclo de Evolução");
                  const latestSessionInGroup = evoGroup.sessions[0];

                  return (
                    <div key={evoGroup.id} className="rounded-2xl border bg-card shadow-xs overflow-hidden transition-all">
                      {/* Header do Ciclo de Evolução */}
                      <div
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-muted/25 hover:bg-muted/40 cursor-pointer transition-colors border-b select-none"
                        onClick={() => toggleEvolutionGroupCollapse(evoGroup.id)}
                      >
                        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleEvolutionGroupCollapse(evoGroup.id);
                            }}
                          >
                            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                          </Button>

                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: primaryColor || "var(--primary)" }}
                            />
                            <h3 className="font-bold text-sm tracking-tight text-foreground truncate max-w-[280px] sm:max-w-md">
                              {groupTitle}
                            </h3>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEvolutionGroup({ id: evoGroup.id, name: evoGroup.customName || "" });
                              }}
                              title="Personalizar nome do ciclo de evolução"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="secondary" className="text-[11px] font-semibold px-2 py-0.5">
                              {evoGroup.sessionCount} {evoGroup.sessionCount === 1 ? "atendimento" : "atendimentos"}
                            </Badge>

                            {evoGroup.firstSessionDate && (
                              <Badge variant="outline" className="text-[10px] font-normal px-2 py-0.5 text-muted-foreground">
                                {new Date(evoGroup.firstSessionDate).toLocaleDateString("pt-BR")}
                                {evoGroup.latestSessionDate && evoGroup.firstSessionDate !== evoGroup.latestSessionDate
                                  ? ` até ${new Date(evoGroup.latestSessionDate).toLocaleDateString("pt-BR")}`
                                  : ""}
                              </Badge>
                            )}

                            {matchedPlan && (
                              <Badge variant="outline" className="text-[10px] font-medium border-primary/30 bg-primary/10 text-primary gap-1">
                                <Package className="h-3 w-3" />
                                <span>{matchedPlan.name} ({matchedPlan.used_sessions}/{matchedPlan.total_sessions})</span>
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {latestSessionInGroup && !selectionMode && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2.5 gap-1.5 font-medium border-primary/30 hover:bg-primary/10 hover:text-primary transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSessionToEvolve(latestSessionInGroup);
                              }}
                              disabled={evolvingSessionId === latestSessionInGroup.id}
                            >
                              {evolvingSessionId === latestSessionInGroup.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Plus className="h-3.5 w-3.5" />
                              )}
                              <span>Evoluir da última</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Sessões do Grupo */}
                      {!isCollapsed && (
                        <div className="p-3 space-y-2.5 bg-background/50">
                          {evoGroup.sessions.map((session) => {
                            const careLineIds = getSessionCareLineIds(session);
                            const sessionGroups = careLineIds
                              .map((groupId) => groups.find((g) => g.id === groupId))
                              .filter(Boolean) as PatientGroup[];
                            const cardColor = sessionGroups[0]?.color ? getLegacyGroupHex(sessionGroups[0].color) : primaryColor;

                            return (
                              <SessionCard
                                key={session.id}
                                baseSchema={baseSchema}
                                canViewFinancialData={canViewFinancialData}
                                creatorName={getSessionPersonLabel(profileMap.get(session.user_id))}
                                creatorIsIntern={shouldShowSessionCreatorInternBadge(profileMap.get(session.user_id)?.job_title)}
                                session={session}
                                sessionGroups={sessionGroups}
                                shareSummary={sessionShareSummaries[session.id]}
                                isSelected={selectedSessionIds.includes(session.id)}
                                selectionMode={!isIntern && selectionMode}
                                borderColor={cardColor}
                                isCompact={sessionViewMode === "compact"}
                                isExpanded={expandedSessionIds.includes(session.id)}
                                onToggleExpand={() => toggleSessionExpansion(session.id)}
                                onEvolve={() => setSessionToEvolve(session)}
                                onLinkGroup={() => setSessionToLinkGroup(session)}
                                isEvolving={evolvingSessionId === session.id}
                                onPressStart={() => handleSessionPressStart(session.id)}
                                onPressCancel={handleSessionPressCancel}
                                onToggleSelect={() => toggleSessionSelection(session.id)}
                                onViewShareRecipients={() => setShareRecipientsSessionId(session.id)}
                                navigateTo={() => handleSessionNavigate(session.id)}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Atendimentos Avulsos (se houver grupos e também atendimentos avulsos) */}
                {sessionView.standaloneSessions.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 pt-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Atendimentos Avulsos ({sessionView.standaloneSessions.length})
                      </h4>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                    <div className="space-y-2.5">
                      {sessionView.standaloneSessions.map((session) => {
                        const careLineIds = getSessionCareLineIds(session);
                        const sessionGroups = careLineIds
                          .map((groupId) => groups.find((g) => g.id === groupId))
                          .filter(Boolean) as PatientGroup[];
                        const cardColor = sessionGroups[0]?.color ? getLegacyGroupHex(sessionGroups[0].color) : undefined;

                        return (
                          <SessionCard
                            key={session.id}
                            baseSchema={baseSchema}
                            canViewFinancialData={canViewFinancialData}
                            creatorName={getSessionPersonLabel(profileMap.get(session.user_id))}
                            creatorIsIntern={shouldShowSessionCreatorInternBadge(profileMap.get(session.user_id)?.job_title)}
                            session={session}
                            sessionGroups={sessionGroups}
                            shareSummary={sessionShareSummaries[session.id]}
                            isSelected={selectedSessionIds.includes(session.id)}
                            selectionMode={!isIntern && selectionMode}
                            borderColor={cardColor}
                            isCompact={sessionViewMode === "compact"}
                            isExpanded={expandedSessionIds.includes(session.id)}
                            onToggleExpand={() => toggleSessionExpansion(session.id)}
                            onEvolve={() => setSessionToEvolve(session)}
                            onLinkGroup={() => setSessionToLinkGroup(session)}
                            isEvolving={evolvingSessionId === session.id}
                            onPressStart={() => handleSessionPressStart(session.id)}
                            onPressCancel={handleSessionPressCancel}
                            onToggleSelect={() => toggleSessionSelection(session.id)}
                            onViewShareRecipients={() => setShareRecipientsSessionId(session.id)}
                            navigateTo={() => handleSessionNavigate(session.id)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Visão Contínua / Flat (quando visualização por grupos está desativada ou não há grupos) */
              <div className="space-y-2.5">
                {sessionView.chronologicalSessions.map((session) => {
                  const careLineIds = getSessionCareLineIds(session);
                  const sessionGroups = careLineIds
                    .map((groupId) => groups.find((g) => g.id === groupId))
                    .filter(Boolean) as PatientGroup[];
                  const primaryColor = sessionGroups[0]?.color ? getLegacyGroupHex(sessionGroups[0].color) : undefined;

                  return (
                    <SessionCard
                      key={session.id}
                      baseSchema={baseSchema}
                      canViewFinancialData={canViewFinancialData}
                      creatorName={getSessionPersonLabel(profileMap.get(session.user_id))}
                      creatorIsIntern={shouldShowSessionCreatorInternBadge(profileMap.get(session.user_id)?.job_title)}
                      session={session}
                      sessionGroups={sessionGroups}
                      shareSummary={sessionShareSummaries[session.id]}
                      isSelected={selectedSessionIds.includes(session.id)}
                      selectionMode={!isIntern && selectionMode}
                      borderColor={primaryColor}
                      isCompact={sessionViewMode === "compact"}
                      isExpanded={expandedSessionIds.includes(session.id)}
                      onToggleExpand={() => toggleSessionExpansion(session.id)}
                      onEvolve={() => setSessionToEvolve(session)}
                      onLinkGroup={() => setSessionToLinkGroup(session)}
                      isEvolving={evolvingSessionId === session.id}
                      onPressStart={() => handleSessionPressStart(session.id)}
                      onPressCancel={handleSessionPressCancel}
                      onToggleSelect={() => toggleSessionSelection(session.id)}
                      onViewShareRecipients={() => setShareRecipientsSessionId(session.id)}
                      navigateTo={() => handleSessionNavigate(session.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <Card className="p-8 text-center border-dashed">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-3 text-base font-semibold">Nenhum atendimento encontrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchTerm || sessionStatusFilter !== "all" || selectedTagFilter !== "all"
                ? "Nenhum atendimento corresponde aos filtros selecionados."
                : "Este paciente ainda não possui atendimentos registrados."}
            </p>
            {selectedTagFilter !== "all" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 text-xs"
                onClick={() => setSelectedTagFilter("all")}
              >
                Ver todos os atendimentos
              </Button>
            )}
          </Card>
        )}
          </>
        )}
      </div>

      {/* Dialog para renomear Ciclo de Evolução */}
      <Dialog open={Boolean(editingEvolutionGroup)} onOpenChange={(open) => !open && setEditingEvolutionGroup(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nome do Ciclo de Evolução</DialogTitle>
            <DialogDescription>
              Dê um nome personalizado para este ciclo de atendimentos (ex: "Tratamento de Lombalgia 2026").
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="evolution-group-name">Nome do Ciclo</Label>
            <Input
              id="evolution-group-name"
              placeholder="Ex: Tratamento Lombar Fase 1"
              value={editingEvolutionGroup?.name ?? ""}
              onChange={(e) =>
                setEditingEvolutionGroup((curr) => (curr ? { ...curr, name: e.target.value } : null))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSaveEvolutionGroupName();
                }
              }}
            />
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingEvolutionGroup(null)}
              disabled={savingEvolutionGroupName}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveEvolutionGroupName()}
              disabled={savingEvolutionGroupName}
            >
              {savingEvolutionGroupName ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group create/edit dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Editar Linha de Cuidado" : "Nova Linha de Cuidado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da Linha de Cuidado / Motivo</Label>
              <Popover open={groupComboboxOpen} onOpenChange={setGroupComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={groupComboboxOpen}
                    className="h-auto min-h-10 w-full justify-between px-3 py-2 text-left font-normal"
                  >
                    <span className={groupName ? "truncate" : "truncate text-muted-foreground"}>
                      {groupName || "Selecione uma linha de cuidado ou digite para criar"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput
                      value={groupName}
                      onValueChange={setGroupName}
                      placeholder="Buscar ou criar linha de cuidado..."
                    />
                    <CommandList>
                      {groupName.trim() && !existingSuggestion && !existingPatientGroup ? (
                        <CommandGroup heading="Criar novo">
                          <CommandItem value={groupName} onSelect={handleCreateTypedGroupName}>
                            <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span>Criar</span>
                            <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs font-medium">
                              {groupName.trim().replace(/\s+/g, " ")}
                            </span>
                          </CommandItem>
                        </CommandGroup>
                      ) : null}
                      <CommandEmpty>Nenhuma linha de cuidado encontrada.</CommandEmpty>
                      <CommandGroup heading="Linhas de cuidado frequentes">
                        {groupSuggestions.map((suggestion) => {
                          const alreadyInPatient = patientGroupNameSet.has(normalizeGroupName(suggestion.name));

                          return (
                            <CommandItem
                              key={normalizeGroupName(suggestion.name)}
                              disabled={alreadyInPatient}
                              value={suggestion.name}
                              onSelect={() => handleSelectGroupSuggestion(suggestion)}
                            >
                              <span
                                className="mr-2 h-3 w-3 rounded-full"
                                style={{ backgroundColor: getLegacyGroupHex(suggestion.color) }}
                              />
                              <span className="truncate">{suggestion.name}</span>
                              <Badge variant={alreadyInPatient ? "outline" : "secondary"} className="ml-auto">
                                {alreadyInPatient ? "Já neste paciente" : "Reutilizar"}
                              </Badge>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {existingPatientGroup ? (
                <p className="text-xs text-destructive">Este paciente já possui uma linha de cuidado com esse nome.</p>
              ) : existingSuggestion && !editingGroup ? (
                <p className="text-xs text-muted-foreground">
                  Este nome já existe na clínica. Ao criar, ele será reutilizado neste paciente com a cor e status selecionados.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Digite para buscar linhas de cuidado existentes ou criar uma nova opção reutilizável.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Status da linha de cuidado</Label>
              <Select value={groupStatus} onValueChange={(value) => setGroupStatus(value as PatientGroupStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <GroupColorPaletteField
                defaultOpen={false}
                onPaletteSave={handleSaveClinicColorSlot}
                onSelectSlot={(slot) => {
                  setGroupColorSlotId(slot.id);
                  setGroupColor(slot.color_hex);
                }}
                previewColorHex={groupColor}
                selectedSlotId={groupColorSlotId}
                slots={resolvedClinicColorSlots}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveGroup} disabled={!groupName.trim() || Boolean(existingPatientGroup) || savingGroup}>
              {savingGroup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingGroup ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Linha de Cuidado?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Os atendimentos desta linha de cuidado serão mantidos como atendimentos gerais.</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDeleteGroup(deleteConfirmId)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deletePatientDialogOpen} onOpenChange={setDeletePatientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir paciente?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Essa ação apaga o paciente definitivamente, junto com grupos e atendimentos vinculados. Não dá para desfazer.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deletingPatient}>Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => void handleDeletePatient()} disabled={deletingPatient}>
              {deletingPatient ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={recurrenceDialogOpen}
        onOpenChange={(open) => {
          setRecurrenceDialogOpen(open);
          if (open) {
            setRecurrenceEnabled(Boolean(patient.is_recurring));
            setRecurrenceWeekdays(normalizePatientRecurringWeekdays(patient.recurring_weekdays));
            setRecurrenceTime(normalizePatientRecurringTime(patient.recurring_time));
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Recorrência do paciente</DialogTitle>
            <DialogDescription>
              Defina os dias programados para gerar um lembrete da próxima sessão na agenda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <label className="flex items-center gap-3 rounded-xl border bg-muted/20 px-4 py-3 text-sm">
              <Checkbox
                checked={recurrenceEnabled}
                onCheckedChange={(checked) => setRecurrenceEnabled(checked === true)}
                aria-label="Paciente recorrente"
              />
              <span>
                <span className="block font-medium">Paciente recorrente</span>
                <span className="text-xs text-muted-foreground">Mantém um lembrete automático para a próxima sessão.</span>
              </span>
            </label>

            <div className="space-y-2">
              <Label>Dias programados</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {PATIENT_RECURRENCE_WEEKDAY_OPTIONS.map((weekday) => (
                  <label
                    key={weekday.value}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${recurrenceEnabled ? "bg-background" : "bg-muted/20 text-muted-foreground"}`}
                  >
                    <Checkbox
                      checked={recurrenceWeekdays.includes(weekday.value)}
                      disabled={!recurrenceEnabled}
                      onCheckedChange={(checked) => toggleRecurrenceWeekday(weekday.value, checked)}
                      aria-label={weekday.label}
                    />
                    <span>{weekday.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-recurrence-time">Horário padrão</Label>
              <Input
                id="patient-recurrence-time"
                type="time"
                value={recurrenceTime}
                disabled={!recurrenceEnabled}
                onChange={(event) => setRecurrenceTime(event.target.value)}
              />
            </div>

            {recurrenceEnabled ? (
              <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Ao salvar, o lembrete automático anterior será substituído pelo próximo horário recorrente futuro.
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={savingRecurrence}>Cancelar</Button>
            </DialogClose>
            <Button
              onClick={() => void handleSaveRecurrence()}
              disabled={savingRecurrence || (recurrenceEnabled && recurrenceWeekdays.length === 0)}
            >
              {savingRecurrence ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar recorrência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={agendaDialogOpen} onOpenChange={setAgendaDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-sm sm:p-6">
          <DialogHeader>
            <DialogTitle>Agendar atendimento</DialogTitle>
            <DialogDescription>
              Crie um horário para este paciente usando a mesma agenda da homepage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl border bg-muted/20 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paciente</p>
              <p className="mt-1 font-semibold">{patient.name}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="patient-agenda-date">Data</Label>
                <Input
                  id="patient-agenda-date"
                  type="date"
                  value={agendaDate}
                  onChange={(event) => setAgendaDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patient-agenda-time">Horário</Label>
                <Input
                  id="patient-agenda-time"
                  type="time"
                  value={agendaTime}
                  onChange={(event) => setAgendaTime(event.target.value)}
                />
              </div>
            </div>
            {isAgendaDialogDateTimePast ? (
              <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                {AGENDA_PAST_EVENT_ERROR_MESSAGE}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Este agendamento usa a mesma agenda da homepage e aparecerá nos dois lugares.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={savingAgendaEvent}>Cancelar</Button>
            </DialogClose>
            <Button onClick={() => void handleSchedulePatientAgendaEvent()} disabled={savingAgendaEvent || !agendaDate || !agendaTime || isAgendaDialogDateTimePast}>
              {savingAgendaEvent ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedAgendaEvent} onOpenChange={(open) => !open && setSelectedAgendaEvent(null)}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] grid-rows-none flex-col overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b px-5 pb-3 pt-5 text-left">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Agendamento</p>
            <DialogTitle className="break-words pr-7 text-xl leading-tight sm:text-3xl">{patient.name}</DialogTitle>
            <DialogDescription>
              Revise o horário, atualize o status ou inicie o atendimento a partir deste agendamento.
            </DialogDescription>
          </DialogHeader>

          {selectedAgendaEvent ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-muted/25 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Horário</p>
                  <p className="mt-1 font-semibold">{formatAgendaEventDateTime(selectedAgendaEvent.scheduled_for)}</p>
                </div>
                <div className="rounded-xl bg-muted/25 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Status atual</p>
                  <Badge variant="outline" className={`mt-1 ${agendaStatusBadgeStyles[getAgendaEventStatus(selectedAgendaEvent)]}`}>
                    {getAgendaStatusLabel(getAgendaEventStatus(selectedAgendaEvent))}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Trocar status</Label>
                <Select value={selectedAgendaStatusAction} onValueChange={(value) => setSelectedAgendaStatusAction(value as AgendaStatusAction)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENDA_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                    ))}
                    <SelectItem value={AGENDA_DELETE_OPTION.value} className="text-destructive focus:text-destructive">
                      {AGENDA_DELETE_OPTION.label}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {selectedAgendaStatusAction === "cancelado" ? (
                  <p className="text-xs text-muted-foreground">
                    Ao aplicar Cancelado, um atendimento vazio com status cancelado será registrado no histórico do paciente.
                  </p>
                ) : selectedAgendaStatusAction === "delete" ? (
                  <p className="text-xs text-destructive">
                    Excluir remove apenas o agendamento da agenda. Nenhum atendimento será criado.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr,1fr,auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="selected-agenda-date">Nova data</Label>
                  <Input
                    id="selected-agenda-date"
                    type="date"
                    value={selectedAgendaDate}
                    onChange={(event) => setSelectedAgendaDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="selected-agenda-time">Novo horário</Label>
                  <Input
                    id="selected-agenda-time"
                    type="time"
                    value={selectedAgendaTime}
                    onChange={(event) => setSelectedAgendaTime(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleUpdateAgendaDateTime()}
                  disabled={savingAgendaDetails || !selectedAgendaDate || !selectedAgendaTime || isSelectedAgendaDateTimePast}
                >
                  Trocar data/horário
                </Button>
              </div>
              {isSelectedAgendaDateTimePast ? (
                <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  {AGENDA_PAST_EVENT_ERROR_MESSAGE}
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="grid shrink-0 grid-cols-2 gap-2 border-t bg-background px-5 py-4 sm:grid-cols-3">
            <Button
              type="button"
              className="col-span-2 sm:col-span-1"
              onClick={() => void handleApplyAgendaStatus()}
              disabled={savingAgendaDetails}
              variant={selectedAgendaStatusAction === "delete" ? "destructive" : "default"}
            >
              {savingAgendaDetails ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Aplicar status
            </Button>
            <Button type="button" variant="outline" onClick={handleStartAgendaAttendance} disabled={savingAgendaDetails}>
              Iniciar atendimento
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={savingAgendaDetails}>Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={patientInfoDialogOpen} onOpenChange={setPatientInfoDialogOpen}>
        <DialogContent className="flex max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-0 supports-[height:100dvh]:max-h-[calc(100dvh-1rem)] sm:max-w-3xl">
          <DialogHeader className="px-4 pt-5 sm:px-6">
            <DialogTitle>Resumo do paciente</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 overflow-y-auto px-4 py-2 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryField label="Nome" value={patient.name} />
              <SummaryField label="Status" value={patient.status} />
              <SummaryField label="Cadastro" value={patientRegistrationStatus} />
              <SummaryField
                label="Data de cadastro"
                value={patient.created_at ? new Date(patient.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : undefined}
              />
              {canViewPatientContact ? <SummaryField label="Telefone" value={patient.phone} /> : null}
              <SummaryField label="E-mail" value={patient.email} />
              <SummaryField label="CPF" value={patient.cpf} />
              <SummaryField label="Origem" value={[getPatientOriginLabel(patient.origin_type), patientOriginDetails].filter(Boolean).join("\n")} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="space-y-3 rounded-lg border bg-muted/10 p-4">
                <div>
                  <p className="text-sm font-semibold">Saúde base</p>
                  <p className="text-xs text-muted-foreground">Pontos de atenção para consulta rápida.</p>
                </div>
                <div className="grid gap-2">
                  <SummaryField label="Tipo sanguíneo" value={patient.blood_type} />
                  <SummaryField label="Alergias" value={patient.allergies} />
                  <SummaryField label="Problemas crônicos" value={patient.chronic_conditions} />
                  <SummaryField label="Alertas clínicos" value={parsedClinicalProfile.clinical_alerts} />
                </div>
              </section>

              <section className="space-y-3 rounded-lg border bg-muted/10 p-4">
                <div>
                  <p className="text-sm font-semibold">Histórico rápido</p>
                  <p className="text-xs text-muted-foreground">Fotografia clínica e funcional atual.</p>
                </div>
                <div className="grid gap-2">
                  <SummaryField label="Diagnósticos prévios" value={parsedClinicalProfile.diagnoses} />
                  <SummaryField label="Medicamentos contínuos" value={patient.continuous_medications} />
                  <SummaryField
                    label="Contexto funcional"
                    value={getFunctionalIndependenceLabel(parsedClinicalProfile.functional_independence)}
                  />
                  <SummaryField label="Contato de emergência" value={parsedEmergencyContact.name} />
                </div>
              </section>
            </div>
          </div>
          <DialogFooter className="gap-2 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:justify-between sm:px-6">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPatientInfoDialogOpen(false);
                  navigate(getPatientPath(patient || id, "resumo"));
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Ver cadastro completo
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPatientInfoDialogOpen(false);
                  navigate(getPatientPath(patient || id, "cadastro"));
                }}
              >
                <ClipboardEdit className="h-4 w-4 mr-2" />
                Editar cadastro
              </Button>
            </div>
            <Button
              onClick={() => {
                setPatientInfoDialogOpen(false);
                handleOpenShareDialog();
              }}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Compartilhar com o paciente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SharePatientRegistrationModal
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        patient={
          patient
            ? {
                id: patient.id,
                name: patient.name,
                cpf: patient.cpf,
                responsible_cpf: patient.responsible_cpf,
                date_of_birth: patient.date_of_birth,
                phone: patient.phone,
                email: patient.email,
                gender: patient.gender,
                pronoun: patient.pronoun,
                patient_code: patient.patient_code,
              }
            : null
        }
        clinicName={clinic?.name}
      />

      <SessionShareDialog
        collaborators={shareCollaborators}
        currentUserId={user?.id}
        existingRecipients={selectedShareRecipients}
        onOpenChange={setSessionShareDialogOpen}
        onShared={() => {
          handleExitSelectionMode();
          if (realPatientId) {
            void invalidatePatientData(realPatientId, clinicId, ["sessions"]);
          }
        }}
        open={sessionShareDialogOpen}
        sessionCount={selectedSessionIds.length}
        sessionIds={selectedSessionIds}
      />

      <Dialog open={!!shareRecipientsSessionId} onOpenChange={(open) => !open && setShareRecipientsSessionId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Acesso compartilhado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {shareRecipientsSession
                ? `Atendimento de ${new Date(shareRecipientsSession.session_date).toLocaleDateString("pt-BR")}`
                : "Atendimento selecionado"}
            </p>
            {(shareRecipientsSummary?.recipients ?? []).length > 0 ? (
              <div className="divide-y rounded-lg border">
                {shareRecipientsSummary?.recipients.map((recipient) => (
                  <div key={recipient.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{getShareRecipientLabel(recipient)}</p>
                      <p className="truncate text-xs text-muted-foreground">{recipient.email || "Sem email"}</p>
                    </div>
                    {recipient.created_at ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(recipient.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
                Nenhum colaborador com acesso compartilhado.
              </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para vincular atendimento individual a grupo de evolução */}
      <Dialog open={Boolean(sessionToLinkGroup)} onOpenChange={(open) => !open && setSessionToLinkGroup(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular a Grupo de Evolução</DialogTitle>
            <DialogDescription>
              Selecione o ciclo de evolução para o atendimento de {sessionToLinkGroup ? new Date(sessionToLinkGroup.session_date).toLocaleDateString("pt-BR") : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 py-2">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-left h-auto py-2.5 px-3 rounded-xl border-dashed hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-colors"
              onClick={() => {
                if (sessionToLinkGroup) void handleLinkSessionEvolutionGroup(sessionToLinkGroup, "none");
              }}
            >
              <div>
                <p className="font-semibold text-xs">Tornar Atendimento Avulso</p>
                <p className="text-[11px] text-muted-foreground">Desvincula este atendimento de qualquer grupo de evolução.</p>
              </div>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-left h-auto py-2.5 px-3 rounded-xl border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
              onClick={() => {
                if (sessionToLinkGroup) void handleLinkSessionEvolutionGroup(sessionToLinkGroup, "__new__");
              }}
            >
              <div>
                <p className="font-semibold text-xs text-primary">+ Criar Novo Grupo de Evolução</p>
                <p className="text-[11px] text-muted-foreground">Inicia um novo ciclo de evolução a partir deste atendimento.</p>
              </div>
            </Button>

            {evolutionGroupsMetadata.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grupos Existentes</p>
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {evolutionGroupsMetadata.map((group) => {
                    const matchedGroupView = sessionView.evolutionGroups.find((g) => g.id === group.id);
                    const label = group.custom_name || (matchedGroupView?.tagGroups.map((g) => g.name).join(" · ")) || `Ciclo (${group.id.slice(0, 6)})`;
                    const count = matchedGroupView?.sessionCount ?? 0;
                    const isCurrent = sessionToLinkGroup?.evolution_group_id === group.id;

                    return (
                      <Button
                        key={group.id}
                        type="button"
                        variant={isCurrent ? "secondary" : "outline"}
                        className={`w-full justify-between text-left h-auto py-2.5 px-3 rounded-xl ${isCurrent ? "ring-1 ring-primary/40" : ""}`}
                        onClick={() => {
                          if (sessionToLinkGroup) void handleLinkSessionEvolutionGroup(sessionToLinkGroup, group.id);
                        }}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-medium text-xs truncate">{label}</p>
                          <p className="text-[10px] text-muted-foreground">{count} {count === 1 ? "atendimento" : "atendimentos"}</p>
                        </div>
                        {isCurrent ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> : null}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSessionToLinkGroup(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EvolveSessionModal
        isOpen={Boolean(sessionToEvolve)}
        onClose={() => setSessionToEvolve(null)}
        onEvolveCopy={() => {
          if (sessionToEvolve) void handleEvolveSession(sessionToEvolve, { mode: "copy" });
        }}
        onEvolveBlank={(templateId) => {
          if (sessionToEvolve) void handleEvolveSession(sessionToEvolve, { mode: "blank", templateId });
        }}
        templates={anamnesisTemplates as any}
        defaultTemplateId={sessionToEvolve?.anamnesis_template_id ?? null}
        isEvolving={Boolean(evolvingSessionId)}
      />

      {patient && (
        <PatientStatsPrintView
          chartPreferences={dashboardChartPreferences}
          clinic={clinic}
          dashboard={anamnesisDashboard}
          patient={patient}
          profile={profile}
          selectedTemplateId={dashboardTemplateFilter}
          user={user}
        />
      )}

      {patient && (
        <PrintResponsibilityModal
          isOpen={showDashboardPrintModal}
          onConfirm={handleExecuteDashboardPrint}
          onCancel={() => setShowDashboardPrintModal(false)}
          documentTitle={`estatísticas do paciente ${patient.name}`}
        />
      )}
      </motion.div>
    </PatientFilesProvider>
  );
};

export default PacienteDetalhe;
