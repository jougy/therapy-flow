import { motion } from "framer-motion";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Save, Copy, Info, Loader2, Plus, Trash2, Pencil, Share2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SessionShareDialog } from "@/components/SessionShareDialog";
import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { readBusinessHours } from "@/lib/clinic-settings";
import { readProfileAddress } from "@/lib/profile-settings";
import {
  buildSessionPayload,
  formatDateTimeForInput,
  getCurrentDateTimeInputValue,
  isSessionDateTimeInputValid,
  parseDateTimeInputValue,
  parseOptionalDateInputValue,
  parseOptionalDateTimeInputValue,
  type SessionFormValues,
} from "@/lib/session-payload";
import {
  centsToCurrencyInput,
  currencyDigitsToInput,
  formatMoneyCents,
  getArrivalDelayMinutes,
  getPaymentAdjustmentCents,
  getPaymentAdjustmentPercent,
  getPaymentInstallmentLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  getSessionOriginalAmountCents,
  hasPaymentAdjustment,
  normalizeSessionPaymentStatus,
  normalizePaymentInstallments,
  PAYMENT_INSTALLMENT_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_ADJUSTMENT_REASON_MAX_LENGTH,
  parseCurrencyToCents,
  sanitizePaymentAdjustmentReason,
  type SessionPaymentMethod,
  type SessionPaymentStatus,
} from "@/lib/session-operations";
import {
  buildSessionDocument,
  isSessionImmutable,
  printSessionDocument,
  type SessionDocumentKind,
} from "@/lib/session-documents";
import { getPreferredPatientGroupId } from "@/lib/patient-group-defaults";
import { buildSessionEditHistoryView, formatSessionAuditDateTime, getSessionPersonLabel } from "@/lib/session-people";
import { createTreatmentBlock, formatTreatmentSummary, readTreatmentState, type TreatmentBlock } from "@/lib/session-treatment";
import { getSessionPreviewIndicators, getSessionSummaryContent } from "@/lib/session-preview";
import { shouldAutoCompleteInternDraft } from "@/lib/patient-sessions-view";
import { notifyAgendaEventsUpdated } from "@/lib/agenda-events";
import {
  fetchClinicShareCollaborators,
  fetchSessionShareRecipients,
  getShareRecipientLabel,
  type SessionShareCollaborator,
  type SessionShareRecipient,
} from "@/lib/session-sharing";
import { FieldLabelWithHelp } from "@/components/anamnesis/FieldLabelWithHelp";
import { DateFieldInput } from "@/components/anamnesis/DateFieldInput";
import {
  addTableRow,
  buildTemplateLayout,
  getOptionMatrixRows,
  getTableRows,
  getVisibleTemplateFields,
  removeTableRow,
  type AnamnesisField,
  type AnamnesisFormValue,
  type AnamnesisFormResponse,
  type AnamnesisTemplateSchema,
  updateTableCellValue,
} from "@/lib/anamnesis-forms";

type PatientGroup = Database["public"]["Tables"]["patient_groups"]["Row"];
type AnamnesisTemplate = Database["public"]["Tables"]["anamnesis_form_templates"]["Row"];
type ClinicDocumentSummary = Pick<
  Database["public"]["Tables"]["clinics"]["Row"],
  "address" | "anamnesis_base_schema" | "business_hours" | "cnpj" | "email" | "legal_name" | "logo_url" | "name" | "phone"
>;
type CollaboratorProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "email" | "full_name" | "id" | "job_title" | "phone" | "professional_license" | "specialty"
>;
type PatientPaymentSession = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  "amount_charged_cents" | "amount_paid_cents" | "id" | "payment_status"
>;
type SessionEditHistoryRow = Database["public"]["Tables"]["session_edit_history"]["Row"];
type ErrorDetails = {
  title: string;
  context: string;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

const isJsonObject = (value: Json | null): value is Record<string, Json | undefined> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJsonString = (value: Json | undefined) => (typeof value === "string" ? value : "");

const getErrorDetails = (error: unknown, title: string, context: string): ErrorDetails => {
  if (error && typeof error === "object") {
    const data = error as Partial<{
      code: string;
      details: string;
      hint: string;
      message: string;
      name: string;
      status: number;
      statusText: string;
    }>;

    return {
      title,
      context,
      message: data.message ?? data.statusText ?? "Erro sem mensagem técnica retornada.",
      code: data.code ?? (data.status ? String(data.status) : data.name),
      details: data.details,
      hint: data.hint,
    };
  }

  return {
    title,
    context,
    message: typeof error === "string" ? error : "Erro desconhecido.",
  };
};

const readJsonRecord = (value: Json | null): AnamnesisFormResponse =>
  isJsonObject(value) ? (value as Record<string, AnamnesisFormValue>) : {};

const readTemplateSchema = (value: Json): AnamnesisTemplateSchema =>
  Array.isArray(value) ? (value as AnamnesisTemplateSchema) : [];

const formatDateTimeLabel = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

const formatDateLabel = (value: string | null | undefined) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

const PAYMENT_AMOUNT_INPUT_MAX_LENGTH = 16;

const getPatientAvailableCreditCents = (sessions: PatientPaymentSession[], currentSessionId: string | undefined) => {
  const totals = sessions
    .filter((session) => session.id !== currentSessionId && session.payment_status !== "cortesia")
    .reduce(
      (sum, session) => ({
        charged: sum.charged + (session.amount_charged_cents ?? 0),
        paid: sum.paid + (session.amount_paid_cents ?? 0),
      }),
      { charged: 0, paid: 0 },
    );

  return Math.max(0, totals.paid - totals.charged);
};

const paymentStatusBadgeClassNames: Record<SessionPaymentStatus, string> = {
  nao_cobrado: "border-muted bg-muted/60 text-muted-foreground",
  pendente: "border-warning/20 bg-warning/15 text-warning",
  parcial: "border-destructive/20 bg-destructive/10 text-destructive",
  pago: "border-success/20 bg-success/10 text-success",
  credito: "border-primary/20 bg-primary/10 text-primary",
  cortesia: "border-success/20 bg-success/10 text-success",
};

const normalizePaymentMethod = (method: string | null | undefined): SessionPaymentMethod =>
  PAYMENT_METHOD_OPTIONS.some((option) => option.value === method)
    ? (method as SessionPaymentMethod)
    : "nao_informado";

const PaymentStatusAutoControl = ({
  disabled,
  onChange,
  saving,
  status,
}: {
  disabled?: boolean;
  onChange: (status: SessionPaymentStatus) => void;
  saving?: boolean;
  status: SessionPaymentStatus;
}) => {
  const isCourtesy = status === "cortesia";

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
      <Badge
        variant="outline"
        className={`w-fit gap-1.5 px-3 py-1 text-sm ${paymentStatusBadgeClassNames[status]}`}
      >
        {getPaymentStatusLabel(status)}
      </Badge>
      <label className="flex w-fit items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium">
        <Checkbox
          checked={isCourtesy}
          onCheckedChange={(checked) => onChange(checked ? "cortesia" : "nao_cobrado")}
          disabled={disabled || saving}
          aria-label="Marcar pagamento como cortesia"
        />
        <span>
          Cortesia
        </span>
      </label>
    </div>
  );
};

const PaymentCompositionChips = ({
  creditCents,
  paidCents,
}: {
  creditCents: number;
  paidCents: number;
}) => {
  if (creditCents <= 0) {
    return null;
  }

  const complementaryCents = Math.max(0, paidCents - creditCents);

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
        Pago {formatMoneyCents(paidCents)}
      </span>
      <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        Crédito {formatMoneyCents(creditCents)}
      </span>
      <span className="rounded-full border border-muted-foreground/20 bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
        Complemento {formatMoneyCents(complementaryCents)}
      </span>
    </div>
  );
};

const CurrencyInput = ({
  disabled,
  id,
  onChange,
  value,
}: {
  disabled?: boolean;
  id: string;
  onChange: (value: string) => void;
  value: string;
}) => (
  <div className="relative">
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">R$</span>
    <Input
      id={id}
      className="pl-10"
      inputMode="decimal"
      maxLength={PAYMENT_AMOUNT_INPUT_MAX_LENGTH}
      type="text"
      value={value}
      onChange={(event) => onChange(currencyDigitsToInput(event.target.value))}
      placeholder="0,00"
      disabled={disabled}
    />
  </div>
);

const formatArrivalDeltaLabel = (minutes: number | null) => {
  if (minutes === null || minutes === 0) {
    return null;
  }

  return `${minutes > 0 ? "+" : "-"} ${Math.abs(minutes)}min`;
};

const hasMeaningfulFormValue = (value: AnamnesisFormValue | undefined) => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return true;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) => hasMeaningfulFormValue(item as AnamnesisFormValue));
  }

  return false;
};

const formatCnpj = (value: string | null | undefined) => {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 14);

  if (digits.length !== 14) {
    return value?.trim() || "";
  }

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const formatAddressLine = (value: Json | null | undefined) => {
  const address = readProfileAddress(value);

  return [
    [address.street, address.number].filter(Boolean).join(", "),
    address.complement,
    address.neighborhood,
    [address.city, address.state].filter(Boolean).join(" - "),
    address.cep,
  ]
    .filter(Boolean)
    .join(", ");
};

const estimateLayoutWeight = (field: Pick<AnamnesisField, "helpText" | "label" | "options" | "type">) => {
  const labelLength = (field.label ?? "").trim().length;
  const helpLength = (field.helpText ?? "").trim().length;
  const optionLabels = (field.options ?? []).map((option) => (option.label ?? "").trim().length);
  const longestOption = optionLabels.length > 0 ? Math.max(...optionLabels) : 0;
  const optionCount = field.options?.length ?? 0;

  let weight = 1;

  weight += Math.min(labelLength / 24, 1.25);
  weight += Math.min(helpLength / 80, 0.75);
  weight += Math.min(longestOption / 20, 1.5);
  weight += Math.min(optionCount / 6, 1);

  if (field.type === "checklist" || field.type === "multiple_choice") {
    weight += 0.5;
  }

  return Math.max(weight, 1);
};

const buildHorizontalSectionGrid = (items: TemplateLayoutItem[]) => {
  if (items.length === 0) {
    return "minmax(0, 1fr)";
  }

  return items
    .map((item) => {
      const weight = estimateLayoutWeight(item.field);
      return `${weight}fr`;
    })
    .join(" ");
};

const estimateHorizontalSectionRowHeight = (items: TemplateLayoutItem[]) => {
  const tallestField = items.reduce((maxHeight, item) => {
    const optionLengths = (item.field.options ?? []).map((option) => (option.label ?? "").trim().length);
    const longestOption = optionLengths.length > 0 ? Math.max(...optionLengths) : 0;
    const baseHeight =
      92 +
      Math.min(((item.field.label ?? "").trim().length / 14) * 8, 32) +
      Math.min(((item.field.helpText ?? "").trim().length / 40) * 6, 24) +
      Math.min((item.field.options?.length ?? 0) * 10, 42) +
      Math.min(longestOption / 2, 28);

    return Math.max(maxHeight, baseHeight);
  }, 120);

  return `${Math.ceil(tallestField)}px`;
};

const ScaleIndicator = ({ max = 10, min = 0, score }: { max?: number; min?: number; score: number }) => {
  const color = score <= 3 ? "bg-success" : score <= 6 ? "bg-warning" : "bg-destructive";
  const totalBars = Math.max(max - min, 1);
  const normalizedScore = Math.max(Math.min(score - min, totalBars), 0);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: totalBars }).map((_, index) => (
          <div key={index} className={`h-4 w-2 rounded-sm ${index < normalizedScore ? color : "bg-muted"}`} />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{score}/{max}</span>
    </div>
  );
};

const estimateChildWidth = (field: Pick<AnamnesisField, "helpText" | "label" | "options" | "type">) => {
  const labelLength = (field.label ?? "").trim().length;
  const helpLength = (field.helpText ?? "").trim().length;
  const optionLabels = (field.options ?? []).map((option) => (option.label ?? "").trim().length);
  const longestOption = optionLabels.length > 0 ? Math.max(...optionLabels) : 0;
  const optionCount = field.options?.length ?? 0;

  const width =
    260 +
    Math.min(labelLength * 8, 220) +
    Math.min(helpLength * 2, 120) +
    Math.min(longestOption * 7, 220) +
    Math.min(optionCount * 18, 140);

  return Math.max(220, Math.min(width, 720));
};

const estimateFieldPreferredWidth = (field: Pick<AnamnesisField, "helpText" | "label" | "options" | "type">) => {
  const labelLength = (field.label ?? "").trim().length;
  const helpLength = (field.helpText ?? "").trim().length;
  const optionLabels = (field.options ?? []).map((option) => (option.label ?? "").trim().length);
  const longestOption = optionLabels.length > 0 ? Math.max(...optionLabels) : 0;
  const readableTextWidth = Math.max(labelLength, longestOption) * 8;

  if (field.type === "select") {
    return Math.max(260, Math.min(520, 180 + readableTextWidth + Math.min(helpLength * 2, 100)));
  }

  if (field.type === "date" || field.type === "number") {
    return Math.max(220, Math.min(360, 170 + labelLength * 7));
  }

  if (field.type === "short_text") {
    return Math.max(280, Math.min(560, 190 + labelLength * 7 + Math.min(helpLength * 2, 100)));
  }

  if (field.type === "slider") {
    return Math.max(320, Math.min(520, 220 + labelLength * 7));
  }

  return estimateChildWidth(field);
};

const getFieldMaxWidth = (field: Pick<AnamnesisField, "helpText" | "label" | "options" | "type">) => {
  if (field.type === "select") {
    return Math.max(320, Math.min(560, estimateFieldPreferredWidth(field) + 80));
  }

  if (field.type === "date" || field.type === "number") {
    return 380;
  }

  if (field.type === "short_text" || field.type === "slider") {
    return Math.max(420, Math.min(640, estimateFieldPreferredWidth(field) + 80));
  }

  return null;
};

const getStandaloneFieldSizingStyle = (
  field: Pick<AnamnesisField, "helpText" | "label" | "options" | "type">
): CSSProperties | undefined => {
  const maxWidth = getFieldMaxWidth(field);

  if (!maxWidth) {
    return undefined;
  }

  return {
    maxWidth,
    width: "100%",
  };
};

const HorizontalScrollNavigator = ({
  markerStyles,
  onScrollLeft,
  onScrollRight,
  onTrackPointerDown,
  onTrackPointerMove,
  onTrackPointerUp,
  scrollLeft,
  scrollWidth,
  clientWidth,
}: {
  clientWidth: number;
  markerStyles: CSSProperties[];
  onScrollLeft: () => void;
  onScrollRight: () => void;
  onTrackPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onTrackPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onTrackPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  scrollLeft: number;
  scrollWidth: number;
}) => {
  const canScrollLeft = scrollLeft > 0;
  const canScrollRight = scrollLeft + clientWidth < scrollWidth - 1;
  const scrollableWidth = Math.max(scrollWidth - clientWidth, 0);
  const scrollRatio = scrollableWidth > 0 ? Math.max(0, Math.min(1, scrollLeft / scrollableWidth)) : 0;
  const thumbWidthValue = scrollWidth > clientWidth
    ? Math.min(100, Math.max(8, (clientWidth / Math.max(scrollWidth, 1)) * 100))
    : 100;
  const maxThumbLeft = Math.max(0, 100 - thumbWidthValue);
  const thumbLeft = `${scrollRatio * maxThumbLeft}%`;
  const thumbWidth = `${thumbWidthValue}%`;

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border bg-background px-2 py-2 shadow-sm">
      <Button type="button" variant="outline" size="icon" onClick={onScrollLeft} disabled={!canScrollLeft} aria-label="Rolar para a esquerda">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div
        className="relative h-5 flex-1 cursor-pointer overflow-hidden rounded-full border bg-muted/40"
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        onPointerCancel={onTrackPointerUp}
      >
        {markerStyles.map((style, index) => (
          <span
            key={index}
            className="absolute top-0 h-full rounded-full opacity-70"
            style={style}
          />
        ))}
        <span
          className="absolute top-0 h-full rounded-full border border-primary/50 bg-primary/10"
          style={{
            left: thumbLeft,
            width: thumbWidth,
          }}
        />
        <span
          className="pointer-events-none absolute top-0 h-full rounded-full border border-primary bg-primary/40 shadow-[0_0_0_1px_rgba(255,255,255,0.4)_inset] transition-transform"
          style={{
            left: thumbLeft,
            width: thumbWidth,
          }}
        />
      </div>
      <Button type="button" variant="outline" size="icon" onClick={onScrollRight} disabled={!canScrollRight} aria-label="Rolar para a direita">
        <ArrowLeft className="h-4 w-4 rotate-180" />
      </Button>
    </div>
  );
};

const SessaoDetalhe = () => {
  const { id: patientId, sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clinicId, operationalRole, profile } = useAuth();
  const isNew = sessionId === "novo";
  const newSessionState = location.state as { agendaEventId?: string; scheduledFor?: string } | null;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [startingFromThis, setStartingFromThis] = useState(false);
  const [isEditing, setIsEditing] = useState(isNew);
  const [patientName, setPatientName] = useState("");
  const [groups, setGroups] = useState<PatientGroup[]>([]);
  const [patientPaymentSessions, setPatientPaymentSessions] = useState<PatientPaymentSession[]>([]);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<CollaboratorProfile[]>([]);
  const [shareCollaborators, setShareCollaborators] = useState<SessionShareCollaborator[]>([]);
  const [shareRecipients, setShareRecipients] = useState<SessionShareRecipient[]>([]);
  const [sessionShareDialogOpen, setSessionShareDialogOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [anamnesisTemplates, setAnamnesisTemplates] = useState<AnamnesisTemplate[]>([]);
  const [baseTemplateSchema, setBaseTemplateSchema] = useState<AnamnesisTemplateSchema>([]);
  const [clinicDocumentInfo, setClinicDocumentInfo] = useState<ClinicDocumentSummary | null>(null);
  const [locked, setLocked] = useState(false);
  const [createdByUserId, setCreatedByUserId] = useState<string | null>(user?.id ?? null);
  const [sessionCreatedAt, setSessionCreatedAt] = useState<string | null>(null);
  const [editHistory, setEditHistory] = useState<SessionEditHistoryRow[]>([]);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [presenceDialogOpen, setPresenceDialogOpen] = useState(false);
  const [savingPresence, setSavingPresence] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  // Form state
  const [queixa, setQueixa] = useState("");
  const [sintomas, setSintomas] = useState("");
  const [painScore, setPainScore] = useState([0]);
  const [complexityScore, setComplexityScore] = useState([0]);
  const [observacoes, setObservacoes] = useState("");
  const [treatmentBlocks, setTreatmentBlocks] = useState<TreatmentBlock[]>([]);
  const [treatmentGeneralGuidance, setTreatmentGeneralGuidance] = useState("");
  const [status, setStatus] = useState("rascunho");
  const [notes, setNotes] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState<string>("");
  const [scheduledStartAt, setScheduledStartAt] = useState<string>("");
  const [patientArrivedAt, setPatientArrivedAt] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<SessionPaymentStatus>("nao_cobrado");
  const [amountCharged, setAmountCharged] = useState("");
  const [amountOriginal, setAmountOriginal] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentAdjustmentReason, setPaymentAdjustmentReason] = useState("");
  const [paymentInstallments, setPaymentInstallments] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<SessionPaymentMethod>("nao_informado");
  const [paymentStatusDate, setPaymentStatusDate] = useState("");
  const [creditAppliedCents, setCreditAppliedCents] = useState(0);
  const [draftScheduledStartAt, setDraftScheduledStartAt] = useState("");
  const [draftPatientArrivedAt, setDraftPatientArrivedAt] = useState("");
  const [draftSessionDate, setDraftSessionDate] = useState("");
  const [draftPaymentStatus, setDraftPaymentStatus] = useState<SessionPaymentStatus>("nao_cobrado");
  const [draftAmountCharged, setDraftAmountCharged] = useState("");
  const [draftAmountOriginal, setDraftAmountOriginal] = useState("");
  const [draftAmountPaid, setDraftAmountPaid] = useState("");
  const [draftPaymentAdjustmentReason, setDraftPaymentAdjustmentReason] = useState("");
  const [draftPaymentInstallments, setDraftPaymentInstallments] = useState(1);
  const [draftPaymentMethod, setDraftPaymentMethod] = useState<SessionPaymentMethod>("nao_informado");
  const [draftPaymentStatusDate, setDraftPaymentStatusDate] = useState("");
  const [draftCreditAppliedCents, setDraftCreditAppliedCents] = useState(0);
  const [anamnesisTemplateId, setAnamnesisTemplateId] = useState<string | null>(null);
  const [anamnesisFormResponse, setAnamnesisFormResponse] = useState<AnamnesisFormResponse>({});
  const [horizontalScrollState, setHorizontalScrollState] = useState<Record<string, { clientWidth: number; scrollLeft: number; scrollWidth: number }>>({});
  const horizontalScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const horizontalScrollRaf = useRef<number | null>(null);
  const horizontalDragRef = useRef<{ key: string | null; pointerId: number | null; trackLeft: number; trackWidth: number } | null>(null);

  const loadSessionPage = useCallback(async () => {
    if (!patientId || !clinicId) {
      return;
    }

    setLoading(true);

    const [patientRes, groupsRes, lastUsedGroupRes, paymentSessionsRes, templatesRes, clinicRes, profilesRes] = await Promise.all([
      supabase.from("patients").select("name").eq("id", patientId).maybeSingle(),
      supabase.from("patient_groups").select("*").eq("patient_id", patientId),
      supabase
        .from("sessions")
        .select("group_id")
        .eq("patient_id", patientId)
        .not("group_id", "is", null)
        .order("session_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sessions")
        .select("id, amount_charged_cents, amount_paid_cents, payment_status")
        .eq("patient_id", patientId),
      supabase
        .from("anamnesis_form_templates")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .eq("is_system_default", false)
        .order("updated_at", { ascending: false }),
      supabase
        .from("clinics")
        .select("address, anamnesis_base_schema, business_hours, cnpj, email, legal_name, logo_url, name, phone")
        .eq("id", clinicId)
        .single(),
      supabase
        .from("profiles")
        .select("id, full_name, email, phone, specialty, job_title, professional_license")
        .eq("clinic_id", clinicId),
    ]);

    if (patientRes.data) {
      setPatientName(patientRes.data.name);
    }

    if (templatesRes.data) {
      setAnamnesisTemplates(templatesRes.data);

      if (isNew && templatesRes.data.length > 0) {
        setAnamnesisTemplateId((current) => current ?? templatesRes.data[0].id);
      }
    }

    if (clinicRes.data) {
      setClinicDocumentInfo(clinicRes.data);
      setBaseTemplateSchema(readTemplateSchema(clinicRes.data.anamnesis_base_schema));
    }

    if (profilesRes.data) {
      setCollaboratorProfiles(profilesRes.data as CollaboratorProfile[]);
    }

    setPatientPaymentSessions((paymentSessionsRes.data ?? []) as PatientPaymentSession[]);

    try {
      const collaborators = await fetchClinicShareCollaborators(clinicId);
      setShareCollaborators(collaborators);
    } catch {
      setShareCollaborators([]);
    }

    if (groupsRes.data) {
      setGroups(groupsRes.data);

      if (isNew) {
        setGroupId(getPreferredPatientGroupId(groupsRes.data, lastUsedGroupRes.data?.group_id ?? null));
      }
    }

    if (!isNew && sessionId) {
      const [{ data: fetchedSessionData }, { data: historyData }] = await Promise.all([
        supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle(),
        supabase.from("session_edit_history").select("*").eq("session_id", sessionId).order("edited_at", { ascending: false }),
      ]);

      let sessionData = fetchedSessionData;

      if (sessionData) {
        if (operationalRole === "estagiario" && sessionData.user_id !== user?.id) {
          toast({
            title: "Acesso restrito",
            description: "O papel Estagiário só pode acessar atendimentos criados pela própria conta.",
            variant: "destructive",
          });
          navigate(`/pacientes/${patientId}`);
          setLoading(false);
          return;
        }

        if (
          shouldAutoCompleteInternDraft({
            createdAt: sessionData.created_at,
            currentUserId: user?.id,
            operationalRole,
            sessionStatus: sessionData.status,
            userId: sessionData.user_id,
          })
        ) {
          const { data: updatedSessionData } = await supabase
            .from("sessions")
            .update({ status: "concluído" })
            .eq("id", sessionData.id)
            .select("*")
            .maybeSingle();

          if (updatedSessionData) {
            sessionData = updatedSessionData;
          }
        }

        const anamnesis = isJsonObject(sessionData.anamnesis) ? sessionData.anamnesis : {};
        const treatment = isJsonObject(sessionData.treatment) ? sessionData.treatment : {};
        const treatmentState = readTreatmentState(treatment);

        setQueixa(readJsonString(anamnesis.queixa));
        setSintomas(readJsonString(anamnesis.sintomas));
        setObservacoes(readJsonString(anamnesis.observacoes));
        setPainScore([sessionData.pain_score || 0]);
        setComplexityScore([sessionData.complexity_score || 0]);
        setTreatmentBlocks(treatmentState.blocks);
        setTreatmentGeneralGuidance(treatmentState.generalGuidance);
        setStatus(sessionData.status);
        setNotes(sessionData.notes || "");
        setGroupId(sessionData.group_id);
        setSessionDate(formatDateTimeForInput(sessionData.session_date));
        setScheduledStartAt(formatDateTimeForInput(sessionData.scheduled_start_at));
        setPatientArrivedAt(formatDateTimeForInput(sessionData.patient_arrived_at));
        setPaymentStatus((sessionData.payment_status as SessionPaymentStatus | null) ?? "nao_cobrado");
        setAmountCharged(centsToCurrencyInput(sessionData.amount_charged_cents));
        setAmountOriginal(centsToCurrencyInput(getSessionOriginalAmountCents(sessionData)));
        setAmountPaid(centsToCurrencyInput(sessionData.amount_paid_cents));
        setCreditAppliedCents(0);
        setPaymentAdjustmentReason(sessionData.payment_adjustment_reason ?? "");
        setPaymentInstallments(normalizePaymentInstallments(sessionData.payment_installments));
        setPaymentMethod(normalizePaymentMethod(sessionData.payment_method));
        setPaymentStatusDate(sessionData.payment_status_date ?? "");
        setAnamnesisTemplateId(sessionData.anamnesis_template_id);
        setAnamnesisFormResponse(readJsonRecord(sessionData.anamnesis_form_response));
        setLocked(isSessionImmutable(false, sessionData.status));
        setCreatedByUserId(sessionData.user_id);
        setSessionCreatedAt(sessionData.created_at);
        setEditHistory(historyData ?? []);
        setIsEditing(false);

        try {
          const recipients = await fetchSessionShareRecipients(sessionData.id);
          setShareRecipients(recipients);
        } catch {
          setShareRecipients([]);
        }
      }
    } else {
      setLocked(false);
      setIsEditing(true);
      setCreatedByUserId(user?.id ?? null);
      const scheduledFor = newSessionState?.scheduledFor ?? "";
      setSessionDate(scheduledFor ? formatDateTimeForInput(scheduledFor) : getCurrentDateTimeInputValue());
      setScheduledStartAt(scheduledFor ? formatDateTimeForInput(scheduledFor) : "");
      setPatientArrivedAt("");
      setPaymentStatus("nao_cobrado");
      setAmountCharged("");
      setAmountOriginal("");
      setAmountPaid("");
      setCreditAppliedCents(0);
      setPaymentAdjustmentReason("");
      setPaymentInstallments(1);
      setPaymentMethod("nao_informado");
      setPaymentStatusDate("");
      setSessionCreatedAt(null);
      setEditHistory([]);
      setShareRecipients([]);
    }

    setLoading(false);
  }, [clinicId, isNew, navigate, newSessionState?.scheduledFor, operationalRole, patientId, sessionId, user?.id]);

  useEffect(() => {
    void loadSessionPage();
  }, [loadSessionPage]);

  useEffect(() => {
    const updateHorizontalScrollState = () => {
      const nextState: Record<string, { clientWidth: number; scrollLeft: number; scrollWidth: number }> = {};

      Object.entries(horizontalScrollRefs.current).forEach(([key, node]) => {
        if (!node) return;

        nextState[key] = {
          clientWidth: node.clientWidth,
          scrollLeft: node.scrollLeft,
          scrollWidth: node.scrollWidth,
        };
      });

      setHorizontalScrollState(nextState);
    };

    const scheduleUpdate = () => {
      if (horizontalScrollRaf.current !== null) {
        window.cancelAnimationFrame(horizontalScrollRaf.current);
      }

      horizontalScrollRaf.current = window.requestAnimationFrame(updateHorizontalScrollState);
    };

    scheduleUpdate();

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => scheduleUpdate()) : null;
    Object.values(horizontalScrollRefs.current).forEach((node) => {
      if (node) {
        resizeObserver?.observe(node);
      }
    });

    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (horizontalScrollRaf.current !== null) {
        window.cancelAnimationFrame(horizontalScrollRaf.current);
        horizontalScrollRaf.current = null;
      }

      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [
    anamnesisTemplateId,
    anamnesisFormResponse,
    anamnesisTemplates,
    baseTemplateSchema,
    groups,
    locked,
    notes,
    patientName,
    patientArrivedAt,
    painScore,
    paymentStatus,
    amountCharged,
    amountOriginal,
    amountPaid,
    paymentAdjustmentReason,
    paymentStatusDate,
    scheduledStartAt,
    sessionDate,
    status,
    sintomas,
    treatmentBlocks,
    treatmentGeneralGuidance,
  ]);

  const activeTemplate = anamnesisTemplates.find((template) => template.id === anamnesisTemplateId) ?? null;
  const activeTemplateSchema = activeTemplate ? readTemplateSchema(activeTemplate.schema) : [];
  const visibleBaseFields = getVisibleTemplateFields(baseTemplateSchema, anamnesisFormResponse);
  const visibleTemplateFields = getVisibleTemplateFields(activeTemplateSchema, anamnesisFormResponse);
  const visibleBaseSliderFields = visibleBaseFields.filter((field) => field.type === "slider");
  const baseLayout = buildTemplateLayout(visibleBaseFields.filter((field) => field.type !== "slider")).filter(
    (item) => item.type === "field" || item.items.length > 0
  );
  const extraLayout = buildTemplateLayout(visibleTemplateFields);
  const previewIndicators = getSessionPreviewIndicators(
    {
      anamnesis_form_response: anamnesisFormResponse as Json,
      complexity_score: complexityScore[0],
      pain_score: painScore[0],
    },
    baseTemplateSchema
  );
  const collaboratorProfileMap = useMemo(
    () => new Map(collaboratorProfiles.map((person) => [person.id, person])),
    [collaboratorProfiles]
  );
  const creatorProfile =
    (createdByUserId ? collaboratorProfileMap.get(createdByUserId) : null) ??
    (profile && createdByUserId === user?.id
      ? {
          email: profile.email,
          full_name: profile.full_name,
          id: profile.id,
          job_title: profile.job_title,
          phone: profile.phone,
          professional_license: profile.professional_license,
          specialty: profile.specialty,
        }
      : null);
  const editHistoryView = useMemo(
    () => buildSessionEditHistoryView(editHistory, collaboratorProfileMap),
    [collaboratorProfileMap, editHistory]
  );

  const updateFormResponse = (fieldId: string, value: AnamnesisFormValue) => {
    setAnamnesisFormResponse((current) => ({
      ...current,
      [fieldId]: value,
    }));
  };

  const readBaseSliderValue = (field: AnamnesisField) => {
    if (field.systemKey === "pain_score") {
      return painScore[0];
    }

    if (field.systemKey === "complexity_score") {
      return complexityScore[0];
    }

    const responseValue = anamnesisFormResponse[field.id];

    if (typeof responseValue === "number") {
      return responseValue;
    }

    if (typeof responseValue === "string" && responseValue.trim()) {
      const parsed = Number(responseValue);
      return Number.isNaN(parsed) ? field.min ?? 0 : parsed;
    }

    return field.min ?? 0;
  };

  const updateBaseSliderValue = (field: AnamnesisField, next: number) => {
    if (field.systemKey === "pain_score") {
      setPainScore([next]);
      return;
    }

    if (field.systemKey === "complexity_score") {
      setComplexityScore([next]);
      return;
    }

    updateFormResponse(field.id, next);
  };

  const syncHorizontalScrollState = useCallback(() => {
    const nextState: Record<string, { clientWidth: number; scrollLeft: number; scrollWidth: number }> = {};

    Object.entries(horizontalScrollRefs.current).forEach(([key, node]) => {
      if (!node) return;

      nextState[key] = {
        clientWidth: node.clientWidth,
        scrollLeft: node.scrollLeft,
        scrollWidth: node.scrollWidth,
      };
    });

    setHorizontalScrollState(nextState);
  }, []);

  const scheduleHorizontalScrollSync = useCallback(() => {
    if (horizontalScrollRaf.current !== null) {
      window.cancelAnimationFrame(horizontalScrollRaf.current);
    }

    horizontalScrollRaf.current = window.requestAnimationFrame(syncHorizontalScrollState);
  }, [syncHorizontalScrollState]);

  const scrollHorizontalSectionToRatio = useCallback((key: string, ratio: number, behavior: ScrollBehavior = "auto") => {
    const node = horizontalScrollRefs.current[key];
    if (!node) return;

    const maxScrollLeft = Math.max(node.scrollWidth - node.clientWidth, 1);
    node.scrollTo({ left: Math.max(0, Math.min(1, ratio)) * maxScrollLeft, behavior });
  }, []);

  const scrollHorizontalSectionToSibling = useCallback((key: string, direction: "left" | "right") => {
    const node = horizontalScrollRefs.current[key];
    const content = node?.firstElementChild;
    if (!node || !content) return;

    const maxScrollLeft = Math.max(node.scrollWidth - node.clientWidth, 0);
    const currentLeft = node.scrollLeft;
    const itemStarts = Array.from(content.children)
      .map((child) => Math.max(0, Math.min(maxScrollLeft, (child as HTMLElement).offsetLeft)))
      .filter((start, index, starts) => starts.indexOf(start) === index)
      .sort((a, b) => a - b);

    if (itemStarts.length === 0) {
      node.scrollBy({ left: direction === "right" ? node.clientWidth * 0.75 : -node.clientWidth * 0.75, behavior: "smooth" });
      return;
    }

    const edgeTolerance = 2;
    const target =
      direction === "right"
        ? itemStarts.find((start) => start > currentLeft + edgeTolerance) ?? maxScrollLeft
        : [...itemStarts].reverse().find((start) => start < currentLeft - edgeTolerance) ?? 0;

    node.scrollTo({ left: target, behavior: "smooth" });
  }, []);

  const beginHorizontalDrag = useCallback(
    (key: string, event: ReactPointerEvent<HTMLDivElement>) => {
      const node = horizontalScrollRefs.current[key];
      if (!node) return;

      const rect = event.currentTarget.getBoundingClientRect();
      horizontalDragRef.current = {
        key,
        pointerId: event.pointerId,
        trackLeft: rect.left,
        trackWidth: rect.width,
      };

      event.currentTarget.setPointerCapture(event.pointerId);
      scrollHorizontalSectionToRatio(key, (event.clientX - rect.left) / Math.max(rect.width, 1), "auto");
    },
    [scrollHorizontalSectionToRatio]
  );

  const updateHorizontalDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = horizontalDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId || !drag.key) return;

      scrollHorizontalSectionToRatio(drag.key, (event.clientX - drag.trackLeft) / Math.max(drag.trackWidth, 1), "auto");
    },
    [scrollHorizontalSectionToRatio]
  );

  const endHorizontalDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = horizontalDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    horizontalDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const formValues: SessionFormValues = {
    amountCharged,
    amountOriginal,
    amountPaid,
    anamnesisFormResponse,
    anamnesisTemplateId,
    complexityScore: complexityScore[0],
    groupId,
    notes,
    observacoes,
    painScore: painScore[0],
    patientArrivedAt,
    paymentAdjustmentReason,
    paymentInstallments,
    paymentMethod,
    paymentStatusDate,
    paymentStatus,
    queixa,
    scheduledStartAt,
    sintomas,
    status,
    treatmentBlocks,
    treatmentGeneralGuidance,
  };
  const arrivalDelayMinutes = getArrivalDelayMinutes({
    patient_arrived_at: patientArrivedAt || null,
    scheduled_start_at: scheduledStartAt || null,
  });
  const arrivalDeltaLabel = formatArrivalDeltaLabel(arrivalDelayMinutes);
  const draftArrivalDeltaMinutes = getArrivalDelayMinutes({
    patient_arrived_at: draftPatientArrivedAt || null,
    scheduled_start_at: draftScheduledStartAt || null,
  });
  const draftArrivalDeltaLabel = formatArrivalDeltaLabel(draftArrivalDeltaMinutes);
  const amountChargedCents = parseCurrencyToCents(amountCharged);
  const amountOriginalCents = parseCurrencyToCents(amountOriginal) || amountChargedCents;
  const amountPaidCents = parseCurrencyToCents(amountPaid);
  const patientAvailableCreditCents = getPatientAvailableCreditCents(patientPaymentSessions, sessionId);
  const effectiveCreditAppliedCents = Math.min(creditAppliedCents, patientAvailableCreditCents, amountPaidCents);
  const remainingPatientCreditCents = Math.max(0, patientAvailableCreditCents - effectiveCreditAppliedCents);
  const creditUsableCents = Math.min(patientAvailableCreditCents, Math.max(0, amountChargedCents - amountPaidCents));
  const canApplyPatientCredit = !locked && creditUsableCents > 0 && paymentStatus !== "cortesia";
  const currentPaymentSession = {
    amount_charged_cents: amountChargedCents,
    amount_original_cents: amountOriginalCents,
    payment_adjustment_reason: paymentAdjustmentReason,
  };
  const currentPaymentAdjustmentCents = getPaymentAdjustmentCents(currentPaymentSession);
  const currentPaymentAdjustmentPercent = getPaymentAdjustmentPercent(currentPaymentSession);
  const currentHasPaymentAdjustment = hasPaymentAdjustment(currentPaymentSession);
  const paymentBalanceCents = paymentStatus === "cortesia" ? 0 : Math.max(0, amountChargedCents - amountPaidCents);
  const currentNormalizedPaymentStatus = normalizeSessionPaymentStatus({
    amountChargedCents,
    amountPaidCents,
    requestedStatus: paymentStatus,
  });
  const draftAmountChargedCents = parseCurrencyToCents(draftAmountCharged);
  const draftAmountOriginalCents = parseCurrencyToCents(draftAmountOriginal) || draftAmountChargedCents;
  const draftAmountPaidCents = parseCurrencyToCents(draftAmountPaid);
  const effectiveDraftCreditAppliedCents = Math.min(draftCreditAppliedCents, patientAvailableCreditCents, draftAmountPaidCents);
  const remainingDraftPatientCreditCents = Math.max(0, patientAvailableCreditCents - effectiveDraftCreditAppliedCents);
  const draftCreditUsableCents = Math.min(patientAvailableCreditCents, Math.max(0, draftAmountChargedCents - draftAmountPaidCents));
  const canApplyDraftPatientCredit = draftCreditUsableCents > 0 && draftPaymentStatus !== "cortesia";
  const draftPaymentSession = {
    amount_charged_cents: draftAmountChargedCents,
    amount_original_cents: draftAmountOriginalCents,
  };
  const draftPaymentAdjustmentCents = getPaymentAdjustmentCents(draftPaymentSession);
  const draftPaymentAdjustmentPercent = getPaymentAdjustmentPercent(draftPaymentSession);
  const draftHasPaymentAdjustment = hasPaymentAdjustment(draftPaymentSession);
  const draftNormalizedPaymentStatus = normalizeSessionPaymentStatus({
    amountChargedCents: draftAmountChargedCents,
    amountPaidCents: draftAmountPaidCents,
    requestedStatus: draftPaymentStatus,
  });

  const applyPatientCredit = () => {
    if (!canApplyPatientCredit) return;

    setAmountPaid(centsToCurrencyInput(amountPaidCents + creditUsableCents));
    setCreditAppliedCents((current) => Math.min(patientAvailableCreditCents, current + creditUsableCents));
  };

  const applyDraftPatientCredit = () => {
    if (!canApplyDraftPatientCredit || savingPayment) return;

    setDraftAmountPaid(centsToCurrencyInput(draftAmountPaidCents + draftCreditUsableCents));
    setDraftCreditAppliedCents((current) => Math.min(patientAvailableCreditCents, current + draftCreditUsableCents));
  };

  const buildCurrentSessionPayload = (clinicId: string | null, statusOverride?: string) =>
    buildSessionPayload({
      clinicId,
      creatorUserId: createdByUserId ?? user!.id,
      patientId: patientId!,
      sessionDate,
      values: formValues,
      statusOverride,
    });

  const showErrorToast = (title: string, error: unknown, context: string) => {
    const details = getErrorDetails(error, title, context);

    toast({
      title,
      description: "Clique em i para ver o erro completo.",
      variant: "destructive",
      action: (
        <ToastAction
          altText="Ver detalhes do erro"
          className="h-7 w-7 rounded-full px-0"
          onClick={() => setErrorDetails(details)}
        >
          <Info className="h-3.5 w-3.5" />
        </ToastAction>
      ),
    });
  };

  const handleSave = async () => {
    if (!patientId || !user || locked || (!isNew && !isEditing)) return;
    setSaving(true);

    const clinicRes = await supabase.rpc("get_user_clinic_id", { _user_id: user.id });
    const sessionData = buildCurrentSessionPayload(clinicRes.data);

    if (isNew) {
      const { data, error } = await supabase
        .from("sessions")
        .insert(sessionData)
        .select("id")
        .single();

      if (error) {
        showErrorToast("Erro ao criar atendimento", error, "Criação de atendimento em rascunho");
      } else {
        if (newSessionState?.agendaEventId) {
          const { error: agendaDeleteError } = await supabase.from("agenda_events").delete().eq("id", newSessionState.agendaEventId);

          if (agendaDeleteError) {
            showErrorToast("Atendimento criado, mas o agendamento não foi removido", agendaDeleteError, "Remoção do agendamento de origem");
          } else {
            notifyAgendaEventsUpdated();
          }
        }

        toast({ title: "Atendimento criado" });
        setIsEditing(false);
        navigate(`/pacientes/${patientId}/sessao/${data.id}`, { replace: true });
      }
    } else {
      const { error } = await supabase
        .from("sessions")
        .update(sessionData)
        .eq("id", sessionId!);

      if (error) {
        showErrorToast("Erro ao salvar atendimento", error, "Atualização dos dados do atendimento");
      } else {
        await loadSessionPage();
        toast({
          title: status === "concluído" ? "Atendimento concluído" : "Atendimento salvo",
          description:
            status === "concluído"
              ? "Este atendimento foi bloqueado para edição. Use a duplicação para iniciar o próximo."
              : undefined,
        });
      }
    }
    setSaving(false);
  };

  const handleStartFromThis = async () => {
    if (!patientId || !user || isNew) return;
    setStartingFromThis(true);

    const clinicRes = await supabase.rpc("get_user_clinic_id", { _user_id: user.id });
    const sessionData = buildSessionPayload({
      clinicId: clinicRes.data,
      creatorUserId: user.id,
      patientId: patientId,
      sessionDate: getCurrentDateTimeInputValue(),
      statusOverride: "rascunho",
      values: formValues,
    });

    const { data, error } = await supabase
      .from("sessions")
      .insert(sessionData)
      .select("id")
      .single();

    if (error) {
      showErrorToast("Erro ao iniciar novo atendimento", error, "Duplicação de atendimento para novo rascunho");
    } else {
      toast({ title: "Novo atendimento iniciado", description: "Os dados foram copiados para um novo rascunho editável." });
      navigate(`/pacientes/${patientId}/sessao/${data.id}`);
    }

    setStartingFromThis(false);
  };

  const handleOpenPresenceDialog = () => {
    setDraftScheduledStartAt(scheduledStartAt);
    setDraftPatientArrivedAt(patientArrivedAt);
    setDraftSessionDate(sessionDate);
    setPresenceDialogOpen(true);
  };

  const handleSavePresenceSummary = async () => {
    if (!sessionId || sessionId === "novo") {
      return;
    }

    if (!isSessionDateTimeInputValid(draftSessionDate)) {
      toast({
        title: "Data de início inválida",
        description: "Use uma data entre 2000 e 2100 para o início do atendimento.",
        variant: "destructive",
      });
      return;
    }

    if (draftScheduledStartAt && !isSessionDateTimeInputValid(draftScheduledStartAt)) {
      toast({
        title: "Horário agendado inválido",
        description: "Use uma data entre 2000 e 2100 ou deixe o campo vazio.",
        variant: "destructive",
      });
      return;
    }

    if (draftPatientArrivedAt && !isSessionDateTimeInputValid(draftPatientArrivedAt)) {
      toast({
        title: "Horário de chegada inválido",
        description: "Use uma data entre 2000 e 2100 ou deixe o campo vazio.",
        variant: "destructive",
      });
      return;
    }

    setSavingPresence(true);
    const nextPresence = {
      patient_arrived_at: parseOptionalDateTimeInputValue(draftPatientArrivedAt),
      scheduled_start_at: parseOptionalDateTimeInputValue(draftScheduledStartAt),
      session_date: parseDateTimeInputValue(draftSessionDate),
    };
    const { error } = await supabase
      .from("sessions")
      .update(nextPresence)
      .eq("id", sessionId);

    if (error) {
      showErrorToast("Erro ao salvar presença", error, "Atualização rápida dos horários do atendimento");
      setSavingPresence(false);
      return;
    }

    setScheduledStartAt(formatDateTimeForInput(nextPresence.scheduled_start_at));
    setPatientArrivedAt(formatDateTimeForInput(nextPresence.patient_arrived_at));
    setSessionDate(formatDateTimeForInput(nextPresence.session_date));
    setPresenceDialogOpen(false);
    setSavingPresence(false);
    toast({ title: "Presença atualizada" });
  };

  const handleOpenPaymentDialog = () => {
    setDraftPaymentStatus(paymentStatus);
    setDraftAmountCharged(amountCharged);
    setDraftAmountOriginal(amountOriginal || amountCharged);
    setDraftAmountPaid(amountPaid);
    setDraftPaymentAdjustmentReason(paymentAdjustmentReason);
    setDraftPaymentInstallments(paymentInstallments);
    setDraftPaymentMethod(paymentMethod);
    setDraftPaymentStatusDate(paymentStatusDate);
    setDraftCreditAppliedCents(0);
    setPaymentDialogOpen(true);
  };

  const handleSavePaymentSummary = async () => {
    if (!sessionId || sessionId === "novo") {
      return;
    }

    setSavingPayment(true);
    const amountChargedCents = parseCurrencyToCents(draftAmountCharged);
    const amountOriginalCents = parseCurrencyToCents(draftAmountOriginal) || amountChargedCents;
    const amountPaidCents = parseCurrencyToCents(draftAmountPaid);
    const normalizedPaymentStatus = normalizeSessionPaymentStatus({
      amountChargedCents,
      amountPaidCents,
      requestedStatus: draftPaymentStatus,
    });
    const nextPayment = {
      amount_charged_cents: amountChargedCents,
      amount_original_cents: amountOriginalCents,
      amount_paid_cents: amountPaidCents,
      payment_adjustment_reason: sanitizePaymentAdjustmentReason(draftPaymentAdjustmentReason) || null,
      payment_installments: normalizedPaymentStatus === "cortesia" ? 1 : normalizePaymentInstallments(draftPaymentInstallments),
      payment_method: draftPaymentStatus === "cortesia" ? "cortesia" : draftPaymentMethod,
      payment_status_date: parseOptionalDateInputValue(draftPaymentStatusDate),
      payment_status: normalizedPaymentStatus,
    };
    const { error } = await supabase
      .from("sessions")
      .update(nextPayment)
      .eq("id", sessionId);

    if (error) {
      showErrorToast("Erro ao salvar pagamento", error, "Atualização rápida do pagamento do atendimento");
      setSavingPayment(false);
      return;
    }

    setPaymentStatus(normalizedPaymentStatus);
    setAmountCharged(centsToCurrencyInput(nextPayment.amount_charged_cents));
    setAmountOriginal(centsToCurrencyInput(nextPayment.amount_original_cents));
    setAmountPaid(centsToCurrencyInput(nextPayment.amount_paid_cents));
    setCreditAppliedCents(effectiveDraftCreditAppliedCents);
    setPaymentAdjustmentReason(nextPayment.payment_adjustment_reason ?? "");
    setPaymentInstallments(normalizePaymentInstallments(nextPayment.payment_installments));
    setPaymentMethod(normalizePaymentMethod(nextPayment.payment_method));
    setPaymentStatusDate(nextPayment.payment_status_date ?? "");
    setPatientPaymentSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              amount_charged_cents: nextPayment.amount_charged_cents,
              amount_paid_cents: nextPayment.amount_paid_cents,
              payment_status: nextPayment.payment_status,
            }
          : session,
      ),
    );
    setPaymentDialogOpen(false);
    setSavingPayment(false);
    toast({ title: "Pagamento atualizado" });
  };

  const addTreatmentBlock = () => {
    setTreatmentBlocks((current) => [...current, createTreatmentBlock(current.length)]);
  };

  const updateTreatmentBlock = (blockId: string, changes: Partial<TreatmentBlock>) => {
    setTreatmentBlocks((current) =>
      current.map((block) => (block.id === blockId ? { ...block, ...changes } : block))
    );
  };

  const removeTreatmentBlock = (blockId: string) => {
    setTreatmentBlocks((current) => current.filter((block) => block.id !== blockId));
  };

  const painColor =
    painScore[0] <= 3 ? "text-success" : painScore[0] <= 6 ? "text-warning" : "text-destructive";

  const readOnly = locked || (!isNew && !isEditing);
  const canManageSessionDeletion = operationalRole === "owner" || operationalRole === "admin";
  const canDeleteOwnProfessionalSession = operationalRole === "professional" && createdByUserId === user?.id;
  const canManageSessionSharing =
    !isNew && (canManageSessionDeletion || createdByUserId === user?.id);
  const canEditSavedDraft = !isNew && status === "rascunho";
  const canEditPresenceSummary = !isNew && !isEditing && (canManageSessionDeletion || createdByUserId === user?.id);
  const canEditPaymentSummary = !isNew && !isEditing && (canManageSessionDeletion || createdByUserId === user?.id);
  const canDeleteSession = !isNew && (canManageSessionDeletion || canDeleteOwnProfessionalSession);
  const treatmentSummary = formatTreatmentSummary({
    blocks: treatmentBlocks,
    generalGuidance: treatmentGeneralGuidance,
  });
  const sessionSummary = getSessionSummaryContent(
    {
      anamnesis: {
        observacoes,
        queixa,
        sintomas,
      },
      anamnesis_form_response: anamnesisFormResponse as Json,
      complexity_score: complexityScore[0],
      pain_score: painScore[0],
    },
    baseTemplateSchema,
    activeTemplateSchema
  );

  const handleDelete = async () => {
    if (!sessionId || !canDeleteSession) {
      return;
    }

    if (!window.confirm("Excluir este atendimento definitivamente?")) {
      return;
    }

    const { error } = await supabase.from("sessions").delete().eq("id", sessionId);

    if (error) {
      showErrorToast("Erro ao excluir atendimento", error, "Exclusão definitiva do atendimento");
      return;
    }

    toast({ title: "Atendimento excluído" });
    navigate(`/pacientes/${patientId}`);
  };

  const handleOpenShareAccess = () => {
    if (!sessionId || !canManageSessionSharing) {
      toast({
        title: "Não foi possível compartilhar",
        description: "Apenas o criador, owner ou admin podem compartilhar este atendimento.",
        variant: "destructive",
      });
      return;
    }

    setSessionShareDialogOpen(true);
  };

  const buildCurrentDocumentData = () => ({
    anamnesisIndicators: previewIndicators,
    anamnesisSummary: sessionSummary,
    appName: "Pronto Health - Fisio",
    clinic: {
      address: formatAddressLine(clinicDocumentInfo?.address),
      businessHours: readBusinessHours(clinicDocumentInfo?.business_hours).summary,
      cnpj: formatCnpj(clinicDocumentInfo?.cnpj),
      email: clinicDocumentInfo?.email ?? null,
      legalName: clinicDocumentInfo?.legal_name ?? null,
      logoUrl: clinicDocumentInfo?.logo_url ?? null,
      name: clinicDocumentInfo?.name ?? "Pronto Health - Fisio",
      phone: clinicDocumentInfo?.phone ?? null,
    },
    generatedAt: new Date().toLocaleString("pt-BR"),
    patientName,
    provider: {
      email: creatorProfile?.email ?? null,
      fullName: getSessionPersonLabel(creatorProfile, "Profissional responsável"),
      jobTitle: creatorProfile?.job_title ?? null,
      phone: creatorProfile?.phone ?? null,
      professionalLicense: creatorProfile?.professional_license ?? null,
      specialty: creatorProfile?.specialty ?? null,
    },
    quickNotes: notes,
    sessionDate,
    treatmentDetails: {
      blocks: treatmentBlocks,
      generalGuidance: treatmentGeneralGuidance,
    },
    treatmentSummary,
  });

  const handleShareDocument = async (kind: SessionDocumentKind) => {
    const documentData = buildSessionDocument(kind, buildCurrentDocumentData());

    try {
      if (navigator.share) {
        await navigator.share({
          text: documentData.text,
          title: documentData.title,
        });
      } else {
        await navigator.clipboard.writeText(documentData.text);
        toast({ title: "Documento copiado para a área de transferência" });
      }
    } catch (error) {
      toast({
        title: "Não foi possível compartilhar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handlePrintDocument = async (kind: SessionDocumentKind) => {
    try {
      await printSessionDocument(kind, buildCurrentDocumentData());
    } catch (error) {
      toast({
        title: "Não foi possível imprimir o documento",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const renderDynamicField = (field: AnamnesisField) => {
    if (field.systemKey === "queixa") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Textarea
            value={queixa}
            onChange={(event) => setQueixa(event.target.value)}
            placeholder={field.placeholder || "Descreva a queixa principal do paciente..."}
            className="mt-1.5"
            rows={3}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.systemKey === "sintomas") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Textarea
            value={sintomas}
            onChange={(event) => setSintomas(event.target.value)}
            placeholder={field.placeholder || "Liste os sintomas relatados..."}
            className="mt-1.5"
            rows={2}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.systemKey === "pain_score") {
      return (
        <div key={field.id} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
            <span className={`text-sm font-bold ${painColor}`}>{painScore[0]}/10</span>
          </div>
          <Slider value={painScore} onValueChange={setPainScore} max={10} step={1} className="mt-3" disabled={locked} />
        </div>
      );
    }

    if (field.systemKey === "complexity_score") {
      return (
        <div key={field.id} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
            <span className="text-sm font-bold">{complexityScore[0]}/10</span>
          </div>
          <Slider value={complexityScore} onValueChange={setComplexityScore} max={10} step={1} className="mt-3" disabled={locked} />
        </div>
      );
    }

    if (field.systemKey === "observacoes") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Textarea
            value={observacoes}
            onChange={(event) => setObservacoes(event.target.value)}
            placeholder={field.placeholder || "Observações adicionais sobre a anamnese..."}
            className="mt-1.5"
            rows={4}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.type === "section") {
      return (
        <div key={field.id} className="rounded-lg border bg-muted/30 p-4">
          <p className="font-medium">{field.label}</p>
          {field.helpText && <p className="text-sm text-muted-foreground mt-1">{field.helpText}</p>}
        </div>
      );
    }

    const value = anamnesisFormResponse[field.id];

    if (field.type === "short_text") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Input
            value={typeof value === "string" ? value : ""}
            onChange={(event) => updateFormResponse(field.id, event.target.value)}
            placeholder={field.placeholder}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.type === "long_text") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Textarea
            value={typeof value === "string" ? value : ""}
            onChange={(event) => updateFormResponse(field.id, event.target.value)}
            placeholder={field.placeholder}
            disabled={locked}
            rows={4}
          />
        </div>
      );
    }

    if (field.type === "number") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Input
            type="number"
            value={typeof value === "number" || typeof value === "string" ? value : ""}
            onChange={(event) => updateFormResponse(field.id, event.target.value === "" ? null : Number(event.target.value))}
            placeholder={field.placeholder}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.type === "date") {
      return (
        <div key={field.id} className="space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <DateFieldInput
            id={field.id}
            value={typeof value === "string" ? value : ""}
            onChange={(next) => updateFormResponse(field.id, next)}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.type === "slider") {
      const sliderValue = typeof value === "number" ? value : field.min ?? 0;
      return (
        <div key={field.id} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
            <span className="text-sm font-semibold">{sliderValue}</span>
          </div>
          <Slider
            value={[sliderValue]}
            onValueChange={([next]) => updateFormResponse(field.id, next)}
            min={field.min ?? 0}
            max={field.max ?? 10}
            step={1}
            disabled={locked}
          />
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <div key={field.id} className="min-w-0 space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <Select value={typeof value === "string" ? value : ""} onValueChange={(next) => updateFormResponse(field.id, next)} disabled={locked}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((option) => (
                <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.type === "table") {
      const rows = getTableRows(field, value);
      const columns = field.options ?? [];

      return (
        <div key={field.id} className="min-w-0 space-y-3">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <ScrollArea className="w-full min-w-0 whitespace-nowrap rounded-md border">
            <div className="min-w-max space-y-3 p-3">
              <div
                className="grid gap-3 border-b pb-2"
                style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(180px, 1fr)) 48px` }}
              >
                {columns.map((option) => (
                  <div key={option.id} className="text-sm font-medium text-muted-foreground">
                    {option.label}
                  </div>
                ))}
                <div />
              </div>

              {rows.map((row, rowIndex) => (
                <div
                  key={`${field.id}_row_${rowIndex}`}
                  className="grid gap-3"
                  style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(180px, 1fr)) 48px` }}
                >
                  {columns.map((option) => (
                    <Input
                      key={option.id}
                      value={row[option.id] ?? ""}
                      onChange={(event) => updateFormResponse(field.id, updateTableCellValue(rows, rowIndex, option.id, event.target.value))}
                      placeholder={option.label}
                      disabled={locked}
                    />
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={locked || rows.length === 1}
                    aria-label={`Remover linha ${rowIndex + 1}`}
                    onClick={() => updateFormResponse(field.id, removeTableRow(rows, rowIndex, field))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => updateFormResponse(field.id, addTableRow(rows, field))}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar linha
          </Button>
        </div>
      );
    }

    if (field.type === "multiple_choice") {
      const optionRows = getOptionMatrixRows(field.options ?? []);
      return (
        <div key={field.id} className="min-w-0 space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <RadioGroup value={typeof value === "string" ? value : ""} onValueChange={(next) => updateFormResponse(field.id, next)}>
            <div className="space-y-4">
              {optionRows.map(({ rowIndex, items }) => (
                <div key={rowIndex} className="space-y-3">
                  <div className="flex flex-wrap items-start gap-3">
                    {items.map((option) => (
                      <div key={option.id} className="inline-flex w-fit max-w-full items-start gap-2 rounded-md border px-3 py-2">
                        <RadioGroupItem value={option.id} id={`${field.id}_${option.id}`} disabled={locked} className="mt-0.5 shrink-0" />
                        <Label htmlFor={`${field.id}_${option.id}`} className="max-w-[48ch] min-w-0 break-words leading-snug">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {rowIndex < optionRows.length - 1 && (
                    <div className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">
                      <span className="h-px flex-1 bg-border/80" />
                      <span>---</span>
                      <span className="h-px flex-1 bg-border/80" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>
      );
    }

    if (field.type === "checklist") {
      const selectedValues = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
      const optionRows = getOptionMatrixRows(field.options ?? []);
      return (
        <div key={field.id} className="min-w-0 space-y-2">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <div className="space-y-3">
            {optionRows.map(({ rowIndex, items }) => (
              <div key={rowIndex} className="space-y-3">
                <div className="flex flex-wrap items-start gap-3">
                  {items.map((option) => (
                    <div key={option.id} className="inline-flex w-fit max-w-full items-start gap-2 rounded-md border px-3 py-2">
                      <Checkbox
                        id={`${field.id}_${option.id}`}
                        checked={selectedValues.includes(option.id)}
                        disabled={locked}
                        className="mt-0.5 shrink-0"
                        onCheckedChange={(checked) => {
                          const next = checked === true
                            ? [...selectedValues, option.id]
                            : selectedValues.filter((item) => item !== option.id);
                          updateFormResponse(field.id, next);
                        }}
                      />
                      <Label htmlFor={`${field.id}_${option.id}`} className="max-w-[48ch] min-w-0 break-words leading-snug">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
                {rowIndex < optionRows.length - 1 && (
                  <div className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">
                    <span className="h-px flex-1 bg-border/80" />
                    <span>---</span>
                    <span className="h-px flex-1 bg-border/80" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (field.type === "section_selector") {
      const selectedValues = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
      return (
        <div key={field.id} className="space-y-3 rounded-lg border p-4">
          <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
          <div className="flex flex-wrap items-start gap-3">
            {(field.options ?? []).map((option) => (
              <div key={option.id} className="inline-flex w-fit max-w-full items-center gap-3 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{option.label}</p>
                  {option.description && <p className="text-xs text-muted-foreground mt-1">{option.description}</p>}
                </div>
                <Switch
                  checked={selectedValues.includes(option.id)}
                  disabled={locked}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selectedValues, option.id]
                      : selectedValues.filter((item) => item !== option.id);
                    updateFormResponse(field.id, next);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderTemplateLayout = (layout: ReturnType<typeof buildTemplateLayout>) => (
    <div className="space-y-4">
      {layout.map((item) => {
        if (item.type === "field") {
          return (
            <div key={item.field.id} className="min-w-0" style={getStandaloneFieldSizingStyle(item.field)}>
              {renderDynamicField(item.field)}
            </div>
          );
        }

        if (item.type === "horizontal_section") {
          const scrollContainerId = item.field.id;
          const horizontalRowMinHeight = estimateHorizontalSectionRowHeight(item.items);
          const horizontalScrollSnapshot = horizontalScrollState[scrollContainerId];
          const totalWidth = item.items.reduce((sum, sibling) => sum + estimateFieldPreferredWidth(sibling.field), 0);
          const horizontalMarkerStyles = item.items.map((child, index, array) => {
            const left = array.slice(0, index).reduce((sum, sibling) => sum + estimateFieldPreferredWidth(sibling.field), 0);
            const width = estimateFieldPreferredWidth(child.field);
            const hasContent = hasMeaningfulFormValue(anamnesisFormResponse[child.field.id]);
            const isVisible =
              horizontalScrollSnapshot &&
              left + width > horizontalScrollSnapshot.scrollLeft &&
              left < horizontalScrollSnapshot.scrollLeft + horizontalScrollSnapshot.clientWidth;

            return {
              backgroundColor: hasContent ? "rgb(96 165 250)" : "rgb(209 213 219)",
              left: `${(left / totalWidth) * 100}%`,
              opacity: isVisible ? 1 : 0.6,
              width: `${(width / totalWidth) * 100}%`,
            } satisfies CSSProperties;
          });

          return (
            <Card key={item.field.id} className="min-w-0">
              <CardContent className="space-y-4 p-4">
                <div>
                  <p className="font-medium">{item.field.label}</p>
                  {item.field.helpText && <p className="mt-1 text-sm text-muted-foreground">{item.field.helpText}</p>}
                </div>
                <div
                  ref={(node) => {
                    horizontalScrollRefs.current[scrollContainerId] = node;
                  }}
                  className="w-full min-w-0 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  onScroll={scheduleHorizontalScrollSync}
                >
                  <div
                    className="flex items-stretch gap-4 pb-4"
                  >
                    {item.items.map((child) => {
                      const preferredWidth = estimateFieldPreferredWidth(child.field);
                      const maxWidth = getFieldMaxWidth(child.field);

                      return (
                        <div
                          key={child.field.id}
                          className="min-w-0 whitespace-normal rounded-lg border bg-muted/10 p-4"
                          style={{
                            flex: `${estimateLayoutWeight(child.field)} 1 ${preferredWidth}px`,
                            maxWidth: maxWidth ?? undefined,
                            minHeight: horizontalRowMinHeight,
                            minWidth: Math.min(preferredWidth, maxWidth ?? preferredWidth),
                          }}
                        >
                          <div className="flex h-full min-h-0 flex-col">
                            {child.type === "field" ? renderDynamicField(child.field) : renderTemplateLayout([child])}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <HorizontalScrollNavigator
                  clientWidth={horizontalScrollSnapshot?.clientWidth ?? 0}
                  markerStyles={horizontalMarkerStyles}
                  onScrollLeft={() => {
                    scrollHorizontalSectionToSibling(scrollContainerId, "left");
                  }}
                  onScrollRight={() => {
                    scrollHorizontalSectionToSibling(scrollContainerId, "right");
                  }}
                  onTrackPointerDown={(event) => beginHorizontalDrag(scrollContainerId, event)}
                  onTrackPointerMove={updateHorizontalDrag}
                  onTrackPointerUp={endHorizontalDrag}
                  scrollLeft={horizontalScrollSnapshot?.scrollLeft ?? 0}
                  scrollWidth={horizontalScrollSnapshot?.scrollWidth ?? 0}
                />
              </CardContent>
            </Card>
          );
        }

        return (
          <Accordion key={item.field.id} type="multiple" defaultValue={[item.field.id]} className="min-w-0 rounded-lg border px-4">
            <AccordionItem value={item.field.id} className="border-none">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="text-left">
                  <p className="font-medium">{item.field.label}</p>
                  {item.field.helpText && <p className="text-sm text-muted-foreground mt-1">{item.field.helpText}</p>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                {renderTemplateLayout(item.items)}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      })}
    </div>
  );

  const renderBaseSliderSection = (mode: "edit" | "view") => {
    if (visibleBaseSliderFields.length === 0) {
      return null;
    }

    return (
      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleBaseSliderFields.map((field) => {
            const value = readBaseSliderValue(field);

            return (
              <div key={field.id} className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div>
                  <FieldLabelWithHelp label={field.label} helpText={field.helpText} />
                </div>
                {mode === "view" ? (
                  <ScaleIndicator score={value} min={field.min ?? 0} max={field.max ?? 10} />
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">{value}/{field.max ?? 10}</div>
                    <Slider
                      value={[value]}
                      onValueChange={([next]) => updateBaseSliderValue(field, next)}
                      min={field.min ?? 0}
                      max={field.max ?? 10}
                      step={1}
                      disabled={locked}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    concluído: "bg-success/15 text-success border-success/20",
    rascunho: "bg-warning/15 text-warning border-warning/20",
    cancelado: "bg-destructive/15 text-destructive border-destructive/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="mx-auto w-full max-w-[min(100vw-1.5rem,1680px)] space-y-6 px-3 sm:max-w-[min(100vw-2rem,1680px)] sm:px-6 lg:max-w-[min(100vw-3rem,1760px)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/pacientes/${patientId}`)}
            aria-label="Voltar para paciente"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {isNew ? "Novo Atendimento" : `Atendimento — ${sessionDate}`}
            </h1>
            <p className="text-sm text-muted-foreground">{patientName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <Badge variant="outline" className={statusColors[status] || ""}>
            {status}
          </Badge>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex gap-2 flex-wrap items-center">
        {(isNew || isEditing) && !locked && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            <span>Salvar</span>
          </Button>
        )}
        {!isNew && canEditSavedDraft && !isEditing && (
          <Button size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            <span>Editar</span>
          </Button>
        )}
        {!isNew && canDeleteSession && !isEditing && (
          <Button size="sm" variant="outline" onClick={() => void handleDelete()}>
            <Trash2 className="h-4 w-4 mr-2" />
            <span>Excluir</span>
          </Button>
        )}
        {!isNew && !isEditing && (
          <Button size="sm" variant="outline" onClick={handleOpenShareAccess} disabled={!canManageSessionSharing}>
            <Share2 className="h-4 w-4 mr-2" />
            <span>Compartilhar com colaboradores</span>
          </Button>
        )}
        {!isNew && (
          <Button size="sm" variant="outline" onClick={handleStartFromThis} disabled={startingFromThis}>
            {startingFromThis ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            <span>Iniciar Novo Atendimento a Partir Deste</span>
          </Button>
        )}
        {(isNew || isEditing) && (
          <>
            <Select value={status} onValueChange={setStatus} disabled={locked}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="concluído">Concluído</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            {groups.length > 0 && (
              <Select value={groupId || "none"} onValueChange={(v) => setGroupId(v === "none" ? null : v)} disabled={locked}>
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue placeholder="Sem grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem grupo</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {anamnesisTemplates.length > 0 && (
              <Select
                value={anamnesisTemplateId || "none"}
                onValueChange={(value) => {
                  setAnamnesisTemplateId(value === "none" ? null : value);
                  setAnamnesisFormResponse({});
                }}
                disabled={locked}
              >
                <SelectTrigger className="w-[220px] h-9 text-sm">
                  <SelectValue placeholder="Ficha de anamnese" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem ficha extra</SelectItem>
                  {anamnesisTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}
        {!isNew && !isEditing && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartilhar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => void handleShareDocument("anamnesis")}>Anamnese</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleShareDocument("treatment")}>Tratamento</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleShareDocument("combined")}>Anamnese + Tratamento</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handlePrintDocument("anamnesis")}>Anamnese</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePrintDocument("treatment")}>Tratamento</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePrintDocument("combined")}>Anamnese + Tratamento</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {locked && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Este atendimento está com status final e não pode mais ser editado. Use "Iniciar novo atendimento a partir deste"
          para abrir um novo rascunho com todos os campos já preenchidos.
        </div>
      )}

      {!isNew && !isEditing ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                <p className="mt-1 font-medium">{status}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Grupo</p>
                <p className="mt-1 font-medium">{groups.find((group) => group.id === groupId)?.name || "Sem grupo"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Ficha complementar</p>
                <p className="mt-1 font-medium">{activeTemplate?.name || "Sem ficha extra"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Criado por</p>
                <p className="mt-1 font-medium">{getSessionPersonLabel(creatorProfile)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sessionCreatedAt ? formatSessionAuditDateTime(sessionCreatedAt) : "Ainda não salvo"}
                </p>
                {editHistoryView.length > 0 && (
                  <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="link" className="mt-1 h-auto px-0 text-xs text-muted-foreground">
                        Ver edições ({editHistoryView.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Histórico de edições</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        {editHistoryView.map((entry) => (
                          <div key={entry.id} className="rounded-lg border p-3">
                            <p className="text-sm font-medium">{entry.editorName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{entry.editedAtLabel}</p>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Compartilhamento</p>
                {shareRecipients.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    <Badge variant="secondary" className="gap-1">
                      <Share2 className="h-3.5 w-3.5" />
                      {shareRecipients.length} colaborador(es)
                    </Badge>
                    <div className="space-y-1">
                      {shareRecipients.slice(0, 3).map((recipient) => (
                        <p key={recipient.id} className="truncate text-xs text-muted-foreground">
                          {getShareRecipientLabel(recipient)}
                        </p>
                      ))}
                      {shareRecipients.length > 3 ? (
                        <p className="text-xs text-muted-foreground">+{shareRecipients.length - 3} outros</p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Não compartilhado</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Presença</h2>
                    <p className="text-sm text-muted-foreground">Horário combinado e chegada do paciente.</p>
                  </div>
                  {canEditPresenceSummary ? (
                    <Button type="button" variant="outline" size="sm" onClick={handleOpenPresenceDialog}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar presença
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 xl:grid-cols-3">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Agendado</p>
                    <p className="mt-1 text-sm font-medium">{formatDateTimeLabel(scheduledStartAt)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Chegada</p>
                      {arrivalDeltaLabel ? (
                        <span className={`text-xs font-semibold ${arrivalDelayMinutes && arrivalDelayMinutes > 0 ? "text-destructive" : "text-success"}`}>
                          {arrivalDeltaLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-medium">{formatDateTimeLabel(patientArrivedAt)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Início do atendimento</p>
                    <p className="mt-1 text-sm font-medium">{formatDateTimeLabel(sessionDate)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Pagamento</h2>
                    <p className="text-sm text-muted-foreground">Valor da consulta e baixa simples do pagamento.</p>
                  </div>
                  {canEditPaymentSummary ? (
                    <Button type="button" variant="outline" size="sm" onClick={handleOpenPaymentDialog}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar pagamento
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <p className="mt-1 text-sm font-medium">{getPaymentStatusLabel(paymentStatus)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Data</p>
                    <p className="mt-1 text-sm font-medium">{formatDateLabel(paymentStatusDate)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Método</p>
                    <p className="mt-1 text-sm font-medium">
                      {getPaymentMethodLabel(currentNormalizedPaymentStatus === "cortesia" ? "cortesia" : paymentMethod)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Parcelas</p>
                    <p className="mt-1 text-sm font-medium">{getPaymentInstallmentLabel(paymentInstallments)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Consulta</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium">
                      {currentHasPaymentAdjustment ? (
                        <span className="text-muted-foreground line-through">{formatMoneyCents(amountOriginalCents)}</span>
                      ) : null}
                      <span>{formatMoneyCents(amountChargedCents)}</span>
                      {currentHasPaymentAdjustment ? (
                        <span className={`text-xs font-semibold ${currentPaymentAdjustmentCents > 0 ? "text-success" : "text-destructive"}`}>
                          {currentPaymentAdjustmentCents > 0 ? "+" : ""}
                          {currentPaymentAdjustmentPercent}%
                        </span>
                      ) : null}
                    </div>
                    {currentHasPaymentAdjustment && paymentAdjustmentReason ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{paymentAdjustmentReason}</p>
                    ) : null}
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Pago</p>
                    <p className="mt-1 text-sm font-medium">{formatMoneyCents(amountPaidCents)}</p>
                  </div>
                </div>
                {paymentBalanceCents > 0 ? (
                  <Badge variant="outline" className="border-warning/20 bg-warning/15 text-warning">
                    Em aberto: {formatMoneyCents(paymentBalanceCents)}
                  </Badge>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {renderBaseSliderSection("view")}

          <Card>
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold">Anamnese</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                  {sessionSummary || "Nenhuma anamnese registrada."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Tratamento</h2>
                <Badge variant="outline">{treatmentBlocks.length} bloco(s)</Badge>
              </div>
              {treatmentBlocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum bloco de tratamento registrado.</p>
              ) : (
                <div className="space-y-4">
                  {treatmentBlocks.map((block, index) => (
                    <div key={block.id} className="rounded-xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">Bloco {index + 1}</p>
                        <span className="text-sm text-muted-foreground">{block.name || "Sem nome"}</span>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Frequência</p>
                          <p className="mt-1 text-sm">{block.frequency || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Duração</p>
                          <p className="mt-1 text-sm">{block.duration || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Séries</p>
                          <p className="mt-1 text-sm">{block.series || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Repetições</p>
                          <p className="mt-1 text-sm">{block.repetitions || "—"}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Instruções adicionais</p>
                        <p className="mt-1 whitespace-pre-line text-sm">{block.instructions || "—"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Orientações gerais e observações</p>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                  {treatmentGeneralGuidance || "Nenhuma orientação geral registrada."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold">Anotações rápidas</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {notes || "Nenhuma anotação rápida registrada."}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
      <>
      <div>
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold">Presença</h2>
              <p className="text-sm text-muted-foreground">Registre o horário combinado e a chegada do paciente.</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1.2fr)_minmax(280px,1.2fr)]">
              <div className="space-y-1.5">
                <Label htmlFor="scheduled-start">Horário agendado</Label>
                <Input
                  id="scheduled-start"
                  max="2100-12-31T23:59"
                  min="2000-01-01T00:00"
                  type="datetime-local"
                  value={scheduledStartAt}
                  onChange={(event) => setScheduledStartAt(event.target.value)}
                  disabled={locked}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="patient-arrived">Horário de chegada</Label>
                  {arrivalDeltaLabel ? (
                    <span className={`text-xs font-semibold ${arrivalDelayMinutes && arrivalDelayMinutes > 0 ? "text-destructive" : "text-success"}`}>
                      {arrivalDeltaLabel}
                    </span>
                  ) : null}
                </div>
                <div className="relative">
                  <Input
                    id="patient-arrived"
                    className="pr-20"
                    max="2100-12-31T23:59"
                    min="2000-01-01T00:00"
                    type="datetime-local"
                    value={patientArrivedAt}
                    onChange={(event) => setPatientArrivedAt(event.target.value)}
                    disabled={locked}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="absolute right-1 top-1/2 h-8 -translate-y-1/2 px-3 text-xs"
                    onClick={() => setPatientArrivedAt(getCurrentDateTimeInputValue())}
                    disabled={locked}
                  >
                    Agora
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="session-date">Data e hora do início do atendimento</Label>
                <div className="relative">
                  <Input
                    id="session-date"
                    className="pr-20"
                    max="2100-12-31T23:59"
                    min="2000-01-01T00:00"
                    type="datetime-local"
                    value={sessionDate}
                    onChange={(event) => setSessionDate(event.target.value)}
                    disabled={locked}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="absolute right-1 top-1/2 h-8 -translate-y-1/2 px-3 text-xs"
                    onClick={() => setSessionDate(getCurrentDateTimeInputValue())}
                    disabled={locked}
                  >
                    Agora
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes" className="text-sm font-medium">Anotações rápidas</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observações gerais sobre o atendimento..."
          className="mt-1.5"
          rows={2}
          disabled={locked}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="anamnese" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="anamnese" className="px-2 py-2 text-xs sm:text-sm">Anamnese</TabsTrigger>
          <TabsTrigger value="tratamento" className="px-2 py-2 text-xs sm:text-sm">Tratamento</TabsTrigger>
          <TabsTrigger value="pagamento" className="px-2 py-2 text-xs sm:text-sm">Pagamento</TabsTrigger>
        </TabsList>

        <TabsContent value="anamnese" className="mt-4 space-y-4">
          {renderBaseSliderSection("edit")}

          <Card>
            <CardContent className="p-6 space-y-5">
              {renderTemplateLayout(baseLayout)}

              {baseTemplateSchema.length > 0 && (
                <div className="space-y-4 rounded-lg border border-dashed p-4">
                  <div>
                    <p className="font-medium text-sm">Ficha complementar</p>
                    {activeTemplate ? (
                      <p className="text-sm text-muted-foreground mt-1">{activeTemplate.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">
                        Selecione uma ficha extra para complementar a anamnese padrão.
                      </p>
                    )}
                  </div>
                  {activeTemplate ? renderTemplateLayout(extraLayout) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tratamento" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-medium">Receituário de tratamento</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Adicione blocos com o nome do tratamento, frequência, duração e instruções específicas.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={addTreatmentBlock} disabled={locked}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar bloco
                </Button>
              </div>

              {treatmentBlocks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum bloco de tratamento adicionado. Use o botão "+" para montar o receituário.
                </div>
              ) : (
                <div className="space-y-4">
                  {treatmentBlocks.map((block, index) => (
                    <div key={block.id} className="rounded-xl border p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">Bloco {index + 1}</p>
                          <p className="text-sm text-muted-foreground">Tratamento com frequência, duração e instruções.</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTreatmentBlock(block.id)}
                          disabled={locked}
                          aria-label="Remover bloco"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Nome do tratamento</Label>
                          <Input
                            value={block.name}
                            onChange={(event) => updateTreatmentBlock(block.id, { name: event.target.value })}
                            placeholder="Ex: Alongamento lombar"
                            disabled={locked}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>De quanto em quanto tempo</Label>
                          <Input
                            value={block.frequency}
                            onChange={(event) => updateTreatmentBlock(block.id, { frequency: event.target.value })}
                            placeholder="Ex: a cada 8h"
                            disabled={locked}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Por quanto tempo</Label>
                          <Input
                            value={block.duration}
                            onChange={(event) => updateTreatmentBlock(block.id, { duration: event.target.value })}
                            placeholder="Ex: por 15 dias"
                            disabled={locked}
                          />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Quantidade de séries</Label>
                            <Input
                              value={block.series}
                              onChange={(event) => updateTreatmentBlock(block.id, { series: event.target.value })}
                              placeholder="Opcional"
                              disabled={locked}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Quantidade de repetições</Label>
                            <Input
                              value={block.repetitions}
                              onChange={(event) => updateTreatmentBlock(block.id, { repetitions: event.target.value })}
                              placeholder="Opcional"
                              disabled={locked}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Instruções adicionais</Label>
                        <Textarea
                          value={block.instructions}
                          onChange={(event) => updateTreatmentBlock(block.id, { instructions: event.target.value })}
                          placeholder="Descreva detalhes do bloco de tratamento..."
                          rows={3}
                          disabled={locked}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <Label htmlFor="treatment-general-guidance" className="text-sm font-medium">
                  Orientações gerais e observações
                </Label>
                <Textarea
                  id="treatment-general-guidance"
                  value={treatmentGeneralGuidance}
                  onChange={(event) => setTreatmentGeneralGuidance(event.target.value)}
                  placeholder="Registre orientações gerais do receituário, alertas e observações importantes..."
                  className="mt-1.5"
                  rows={5}
                  disabled={locked}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagamento" className="mt-4 space-y-4">
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold">Pagamento</h2>
                <p className="text-sm text-muted-foreground">Informe o status, valor da consulta e quanto já foi pago.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,0.95fr)_minmax(260px,1.05fr)_minmax(130px,0.45fr)_minmax(220px,0.8fr)]">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <PaymentStatusAutoControl
                    status={currentNormalizedPaymentStatus}
                    onChange={setPaymentStatus}
                    disabled={locked}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="payment-method">Método de pagamento</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(normalizePaymentMethod(value))}
                    disabled={locked || currentNormalizedPaymentStatus === "cortesia"}
                  >
                    <SelectTrigger id="payment-method">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_OPTIONS.filter((option) => option.value !== "cortesia").map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="payment-installments">Parcelas</Label>
                  <Select
                    value={String(paymentInstallments)}
                    onValueChange={(value) => setPaymentInstallments(normalizePaymentInstallments(value))}
                    disabled={locked || currentNormalizedPaymentStatus === "cortesia"}
                  >
                    <SelectTrigger id="payment-installments">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_INSTALLMENT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="payment-status-date">Data do pagamento</Label>
                  <Input
                    id="payment-status-date"
                    max="2100-12-31"
                    min="2000-01-01"
                    type="date"
                    value={paymentStatusDate}
                    onChange={(event) => setPaymentStatusDate(event.target.value)}
                    disabled={locked}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="amount-original">Valor original</Label>
                  <CurrencyInput
                    id="amount-original"
                    value={amountOriginal}
                    onChange={setAmountOriginal}
                    disabled={locked}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="amount-charged">Valor da consulta</Label>
                  <CurrencyInput
                    id="amount-charged"
                    value={amountCharged}
                    onChange={setAmountCharged}
                    disabled={locked}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="amount-paid">Quanto foi pago</Label>
                  <CurrencyInput
                    id="amount-paid"
                    value={amountPaid}
                    onChange={setAmountPaid}
                    disabled={locked}
                  />
                  {patientAvailableCreditCents > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <span className="text-xs font-medium text-primary">
                        Crédito disponível: {formatMoneyCents(remainingPatientCreditCents)}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={applyPatientCredit}
                        disabled={!canApplyPatientCredit}
                      >
                        Usar crédito
                      </Button>
                      {effectiveCreditAppliedCents > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Aplicado nesta sessão: {formatMoneyCents(effectiveCreditAppliedCents)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <PaymentCompositionChips creditCents={effectiveCreditAppliedCents} paidCents={amountPaidCents} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payment-adjustment-reason">Motivo do desconto/acréscimo</Label>
                <Textarea
                  id="payment-adjustment-reason"
                  className="min-h-20 resize-y"
                  maxLength={PAYMENT_ADJUSTMENT_REASON_MAX_LENGTH}
                  value={paymentAdjustmentReason}
                  onChange={(event) => setPaymentAdjustmentReason(event.target.value)}
                  placeholder="Opcional"
                  disabled={locked}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Em aberto: {formatMoneyCents(paymentBalanceCents)}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </>
      )}
      <SessionShareDialog
        collaborators={shareCollaborators}
        currentUserId={user?.id}
        existingRecipients={shareRecipients}
        onOpenChange={setSessionShareDialogOpen}
        onShared={() => {
          void loadSessionPage();
        }}
        open={sessionShareDialogOpen}
        sessionCount={1}
        sessionIds={sessionId && sessionId !== "novo" ? [sessionId] : []}
      />
      <Dialog open={presenceDialogOpen} onOpenChange={(open) => !savingPresence && setPresenceDialogOpen(open)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar presença</DialogTitle>
            <DialogDescription>Atualize o horário agendado, chegada e início do atendimento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="quick-scheduled-start">Horário agendado</Label>
              <Input
                id="quick-scheduled-start"
                max="2100-12-31T23:59"
                min="2000-01-01T00:00"
                type="datetime-local"
                value={draftScheduledStartAt}
                onChange={(event) => setDraftScheduledStartAt(event.target.value)}
                disabled={savingPresence}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="quick-patient-arrived">Horário de chegada</Label>
                {draftArrivalDeltaLabel ? (
                  <span
                    className={`text-xs font-semibold ${draftArrivalDeltaMinutes && draftArrivalDeltaMinutes > 0 ? "text-destructive" : "text-success"}`}
                  >
                    {draftArrivalDeltaLabel}
                  </span>
                ) : null}
              </div>
              <div className="relative">
                <Input
                  id="quick-patient-arrived"
                  className="pr-20"
                  max="2100-12-31T23:59"
                  min="2000-01-01T00:00"
                  type="datetime-local"
                  value={draftPatientArrivedAt}
                  onChange={(event) => setDraftPatientArrivedAt(event.target.value)}
                  disabled={savingPresence}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="absolute right-1 top-1/2 h-8 -translate-y-1/2 px-3 text-xs"
                  onClick={() => setDraftPatientArrivedAt(getCurrentDateTimeInputValue())}
                  disabled={savingPresence}
                >
                  Agora
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-session-date">Data e hora do início do atendimento</Label>
              <div className="relative">
                <Input
                  id="quick-session-date"
                  className="pr-20"
                  max="2100-12-31T23:59"
                  min="2000-01-01T00:00"
                  type="datetime-local"
                  value={draftSessionDate}
                  onChange={(event) => setDraftSessionDate(event.target.value)}
                  disabled={savingPresence}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="absolute right-1 top-1/2 h-8 -translate-y-1/2 px-3 text-xs"
                  onClick={() => setDraftSessionDate(getCurrentDateTimeInputValue())}
                  disabled={savingPresence}
                >
                  Agora
                </Button>
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setPresenceDialogOpen(false)} disabled={savingPresence}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSavePresenceSummary()} disabled={savingPresence}>
              {savingPresence ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar presença
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={paymentDialogOpen} onOpenChange={(open) => !savingPayment && setPaymentDialogOpen(open)}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar pagamento</DialogTitle>
            <DialogDescription>Atualize status, valor original, ajuste, valor final e baixa do pagamento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Status de pagamento</Label>
              <PaymentStatusAutoControl
                status={draftNormalizedPaymentStatus}
                onChange={setDraftPaymentStatus}
                saving={savingPayment}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-payment-status-date">Data do pagamento</Label>
              <Input
                id="quick-payment-status-date"
                max="2100-12-31"
                min="2000-01-01"
                type="date"
                value={draftPaymentStatusDate}
                onChange={(event) => setDraftPaymentStatusDate(event.target.value)}
                disabled={savingPayment}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
              <div className="space-y-2">
                <Label htmlFor="quick-payment-method">Método de pagamento</Label>
                <Select
                  value={draftPaymentMethod}
                  onValueChange={(value) => setDraftPaymentMethod(normalizePaymentMethod(value))}
                  disabled={savingPayment || draftNormalizedPaymentStatus === "cortesia"}
                >
                  <SelectTrigger id="quick-payment-method">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.filter((option) => option.value !== "cortesia").map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-payment-installments">Parcelas</Label>
                <Select
                  value={String(draftPaymentInstallments)}
                  onValueChange={(value) => setDraftPaymentInstallments(normalizePaymentInstallments(value))}
                  disabled={savingPayment || draftNormalizedPaymentStatus === "cortesia"}
                >
                  <SelectTrigger id="quick-payment-installments">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_INSTALLMENT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quick-amount-original">Valor original</Label>
                <CurrencyInput
                  id="quick-amount-original"
                  value={draftAmountOriginal}
                  onChange={setDraftAmountOriginal}
                  disabled={savingPayment}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-amount-charged">Valor final da consulta</Label>
                <CurrencyInput
                  id="quick-amount-charged"
                  value={draftAmountCharged}
                  onChange={setDraftAmountCharged}
                  disabled={savingPayment}
                />
              </div>
            </div>
            {draftHasPaymentAdjustment ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground line-through">{formatMoneyCents(draftAmountOriginalCents)}</span>
                  <span className="font-medium">{formatMoneyCents(draftAmountChargedCents)}</span>
                  <span className={`text-xs font-semibold ${draftPaymentAdjustmentCents > 0 ? "text-success" : "text-destructive"}`}>
                    {draftPaymentAdjustmentCents > 0 ? "+" : ""}
                    {draftPaymentAdjustmentPercent}%
                  </span>
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="quick-amount-paid">Quanto foi pago</Label>
                  {patientAvailableCreditCents > 0 ? (
                    <span className="text-xs font-medium text-primary">
                      Crédito: {formatMoneyCents(remainingDraftPatientCreditCents)}
                    </span>
                  ) : null}
                </div>
                <CurrencyInput
                  id="quick-amount-paid"
                  value={draftAmountPaid}
                  onChange={setDraftAmountPaid}
                  disabled={savingPayment}
                />
                {patientAvailableCreditCents > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={applyDraftPatientCredit}
                      disabled={!canApplyDraftPatientCredit || savingPayment}
                    >
                      Usar crédito
                    </Button>
                    {effectiveDraftCreditAppliedCents > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Aplicado nesta sessão: {formatMoneyCents(effectiveDraftCreditAppliedCents)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <PaymentCompositionChips creditCents={effectiveDraftCreditAppliedCents} paidCents={draftAmountPaidCents} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-payment-adjustment-reason">Motivo do desconto/acréscimo</Label>
                <Textarea
                  id="quick-payment-adjustment-reason"
                  className="min-h-24 resize-y"
                  maxLength={PAYMENT_ADJUSTMENT_REASON_MAX_LENGTH}
                  value={draftPaymentAdjustmentReason}
                  onChange={(event) => setDraftPaymentAdjustmentReason(event.target.value)}
                  placeholder="Opcional"
                  disabled={savingPayment}
                />
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Em aberto: {formatMoneyCents(
                draftPaymentStatus === "cortesia"
                  ? 0
                  : Math.max(0, draftAmountChargedCents - draftAmountPaidCents)
              )}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)} disabled={savingPayment}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSavePaymentSummary()} disabled={savingPayment}>
              {savingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar pagamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(errorDetails)} onOpenChange={(open) => !open && setErrorDetails(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{errorDetails?.title ?? "Detalhes do erro"}</DialogTitle>
            <DialogDescription>{errorDetails?.context}</DialogDescription>
          </DialogHeader>
          {errorDetails ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mensagem técnica</p>
                <p className="mt-2 break-words text-sm">{errorDetails.message}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Código</p>
                  <p className="mt-1 break-words text-sm">{errorDetails.code ?? "Não informado"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sugestão do banco</p>
                  <p className="mt-1 break-words text-sm">{errorDetails.hint ?? "Não informado"}</p>
                </div>
              </div>
              {errorDetails.details ? (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalhes</p>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">
                    {errorDetails.details}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default SessaoDetalhe;
