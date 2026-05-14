import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, Plus, Phone, Calendar, Loader2, ChevronDown, ChevronUp, Clock,
  Pencil, Trash2, FolderPlus, ClipboardEdit, Share2, Copy, CheckCircle2, ChevronsUpDown, Search, X, Users, FileText, MoreHorizontal, ChevronLeft, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { GroupColorPaletteField, type ClinicGroupColorSlot } from "@/components/GroupColorPaletteField";
import { SessionShareDialog } from "@/components/SessionShareDialog";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { logRuntimeError } from "@/lib/runtime-debug";
import { buildPatientRegistrationUrl, getPatientRegistrationPassword } from "@/lib/patient-registration";
import { buildAgendaEventPayload, type AgendaEventStatus } from "@/lib/agenda-events";
import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import type { PatientGroupStatus } from "@/lib/patient-groups";
import { getSessionPersonLabel } from "@/lib/session-people";
import { getSessionPreviewContent, getSessionPreviewIndicators } from "@/lib/session-preview";
import { EDITABLE_PATIENT_STATUS_OPTIONS, type EditablePatientStatus } from "@/lib/patient-statuses";
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
  shouldAutoCompleteInternDraft,
  shouldShowSessionCreatorInternBadge,
} from "@/lib/patient-sessions-view";
import {
  DEFAULT_GROUP_COLOR_SLOT_SEEDS,
  getLegacyGroupHex,
} from "@/lib/group-colors";
import {
  getFunctionalIndependenceLabel,
  parseClinicalProfile,
  parseEmergencyContact,
} from "@/lib/patient-clinical-profile";

type Patient = Database["public"]["Tables"]["patients"]["Row"];
type PatientGroup = Database["public"]["Tables"]["patient_groups"]["Row"];
type PatientGroupTemplate = Database["public"]["Tables"]["patient_group_templates"]["Row"];
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
    <p className="mt-1 truncate text-sm font-medium text-foreground">{value?.trim() || "—"}</p>
  </div>
);

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

  return (
    <Tabs
      defaultValue="queixa"
      className="mt-3"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <TabsList className="grid h-auto w-full grid-cols-2">
        <TabsTrigger value="queixa" className="whitespace-normal px-2 py-2 text-xs leading-tight sm:text-sm">Queixa principal</TabsTrigger>
        <TabsTrigger value="tratamento" className="whitespace-normal px-2 py-2 text-xs leading-tight sm:text-sm">Tratamento</TabsTrigger>
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
    </Tabs>
  );
};

const SessionCard = ({
  baseSchema,
  borderColor,
  creatorName,
  creatorIsIntern,
  isSelected,
  navigateTo,
  onPressCancel,
  onPressStart,
  onToggleSelect,
  onViewShareRecipients,
  shareSummary,
  selectionMode,
  session,
}: {
  baseSchema: AnamnesisTemplateSchema;
  borderColor?: string;
  creatorName: string;
  creatorIsIntern: boolean;
  isSelected: boolean;
  navigateTo: () => void;
  onPressCancel: () => void;
  onPressStart: () => void;
  onToggleSelect: () => void;
  onViewShareRecipients: () => void;
  selectionMode: boolean;
  shareSummary?: SessionShareSummary;
  session: Session;
}) => {
  const indicators = getSessionPreviewIndicators(session, baseSchema);
  const shareCount = shareSummary?.share_count ?? 0;

  return (
    <Card
      className={`border-l-4 cursor-pointer hover:shadow-md transition-shadow ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
      style={borderColor ? { borderLeftColor: borderColor } : undefined}
      onClick={selectionMode ? onToggleSelect : navigateTo}
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
      onPointerDown={selectionMode ? undefined : onPressStart}
      onPointerUp={selectionMode ? undefined : onPressCancel}
      onPointerLeave={selectionMode ? undefined : onPressCancel}
      onPointerCancel={selectionMode ? undefined : onPressCancel}
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
            </div>
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
};

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

const PacienteDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { can, clinicId, operationalRole, user } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [groups, setGroups] = useState<PatientGroup[]>([]);
  const [groupSuggestions, setGroupSuggestions] = useState<GroupSuggestion[]>([]);
  const [clinicColorSlots, setClinicColorSlots] = useState<ClinicColorSlotRow[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [agendaEvents, setAgendaEvents] = useState<AgendaEvent[]>([]);
  const [shareCollaborators, setShareCollaborators] = useState<SessionShareCollaborator[]>([]);
  const [sessionShareSummaries, setSessionShareSummaries] = useState<Record<string, SessionShareSummary>>({});
  const [baseSchema, setBaseSchema] = useState<AnamnesisTemplateSchema>([]);
  const [loading, setLoading] = useState(true);
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
  const [summaryCardIndex, setSummaryCardIndex] = useState(0);
  const [agendaDialogOpen, setAgendaDialogOpen] = useState(false);
  const [agendaDate, setAgendaDate] = useState(getDateInputValue());
  const [agendaTime, setAgendaTime] = useState("09:00");
  const [savingAgendaEvent, setSavingAgendaEvent] = useState(false);
  const [selectedAgendaEvent, setSelectedAgendaEvent] = useState<AgendaEvent | null>(null);
  const [selectedAgendaStatusAction, setSelectedAgendaStatusAction] = useState<AgendaStatusAction>("aguardando_confirmacao");
  const [selectedAgendaDate, setSelectedAgendaDate] = useState(getDateInputValue());
  const [selectedAgendaTime, setSelectedAgendaTime] = useState("09:00");
  const [savingAgendaDetails, setSavingAgendaDetails] = useState(false);
  const [generatingShareLink, setGeneratingShareLink] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [shareCompleted, setShareCompleted] = useState(false);
  const [updatingPatientStatus, setUpdatingPatientStatus] = useState(false);
  const [deletePatientDialogOpen, setDeletePatientDialogOpen] = useState(false);
  const [deletingPatient, setDeletingPatient] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sessionStatusFilter, setSessionStatusFilter] = useState("all");
  const [groupStatusFilter, setGroupStatusFilter] = useState("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const isIntern = operationalRole === "estagiario";
  const canDeletePatient = can("clinic_profile.manage");
  const parsedClinicalProfile = useMemo(() => parseClinicalProfile(patient?.clinical_profile), [patient?.clinical_profile]);
  const parsedEmergencyContact = useMemo(() => parseEmergencyContact(patient?.emergency_contact), [patient?.emergency_contact]);

  const fetchData = useCallback(async () => {
    if (!id) return;

    const [pRes, gRes, sRes, clinicRes, profilesRes, colorSlotsRes, agendaRes] = await Promise.all([
      supabase.from("patients").select("*").eq("id", id).single(),
      supabase.from("patient_groups").select("*").eq("patient_id", id),
      supabase.from("sessions").select("*").eq("patient_id", id).order("session_date", { ascending: false }),
      clinicId ? supabase.from("clinics").select("anamnesis_base_schema").eq("id", clinicId).single() : Promise.resolve({ data: null }),
      clinicId ? supabase.from("profiles").select("id, full_name, email, job_title").eq("clinic_id", clinicId) : Promise.resolve({ data: [] }),
      clinicId
        ? supabase.from("clinic_group_color_slots").select("*").eq("clinic_id", clinicId).order("slot_index", { ascending: true })
        : Promise.resolve({ data: [] }),
      supabase
        .from("agenda_events")
        .select("*")
        .eq("patient_id", id)
        .order("scheduled_for", { ascending: true }),
    ]);
    const templatesRes = clinicId
      ? await supabase
          .from("patient_group_templates")
          .select("clinic_color_slot_id, color, name, normalized_name, status")
          .eq("clinic_id", clinicId)
          .order("name", { ascending: true })
      : { data: [] };

    const allSessions = (sRes.data ?? []) as Session[];
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
      const { error: autoCompleteError } = await supabase
        .from("sessions")
        .update({ status: "concluído" })
        .in("id", staleInternDraftIds);

      if (!autoCompleteError) {
        allSessions.forEach((session) => {
          if (staleInternDraftIds.includes(session.id)) {
            session.status = "concluído";
          }
        });
      }
    }

    let shareSummaries: SessionShareSummary[] = [];
    try {
      shareSummaries = await fetchSessionShareSummaries(allSessions.map((session) => session.id));
    } catch (error) {
      logRuntimeError("patient_detail.fetch_session_share_summaries", error, { patientId: id });
    }

    const shareSummaryMap = Object.fromEntries(shareSummaries.map((summary) => [summary.session_id, summary]));
    const sharedSessionIds = new Set(shareSummaries.map((summary) => summary.session_id));
    const visibleSessions = filterSessionsForOperationalRole({
      currentUserId: user?.id,
      operationalRole,
      sharedSessionIds,
      sessions: allSessions,
    });
    let collaborators: SessionShareCollaborator[] = [];
    if (clinicId) {
      try {
        collaborators = await fetchClinicShareCollaborators(clinicId);
      } catch (error) {
        logRuntimeError("patient_detail.fetch_share_collaborators", error, { clinicId, patientId: id });
      }
    }

    setPatient(pRes.data);
    setGroups(gRes.data ?? []);
    setGroupSuggestions((templatesRes.data ?? []) as GroupSuggestion[]);
    setClinicColorSlots((colorSlotsRes.data ?? []) as ClinicColorSlotRow[]);
    setSessions(visibleSessions);
    setAgendaEvents((agendaRes.data ?? []) as AgendaEvent[]);
    setSessionShareSummaries(shareSummaryMap);
    setShareCollaborators(collaborators);
    setProfiles((profilesRes.data ?? []) as ProfileSummary[]);
    setBaseSchema(Array.isArray(clinicRes.data?.anamnesis_base_schema) ? (clinicRes.data.anamnesis_base_schema as AnamnesisTemplateSchema) : []);
    setLoading(false);
  }, [clinicId, id, operationalRole, user?.id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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
    setCollapsedGroups((current) => {
      const next = { ...current };

      groups.forEach((group) => {
        if (!(group.id in next)) {
          next[group.id] = false;
        }
      });

      return next;
    });
  }, [groups]);

  useEffect(() => {
    if (!groupColorSlotId) {
      return;
    }

    const slot = getSlotById(groupColorSlotId);

    if (slot && slot.color_hex !== groupColor) {
      setGroupColor(slot.color_hex);
    }
  }, [getSlotById, groupColor, groupColorSlotId]);

  const handleOpenShareDialog = useCallback(async () => {
    if (!id || !patient) return;
    setGeneratingShareLink(true);

    const { data, error } = await supabase.rpc("create_patient_registration_link", {
      _patient_id: id,
    });

    if (error || !data || !isShareLinkResponse(data)) {
      toast({
        title: "Não foi possível gerar o link",
        description: error?.message ?? "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
      setGeneratingShareLink(false);
      return;
    }

    setShareLink(buildPatientRegistrationUrl(window.location.origin, data.token));
    setSharePassword(data.password_prefix);
    setShareCompleted(data.completed);
    setShareDialogOpen(true);
    setGeneratingShareLink(false);
  }, [id, patient]);

  useEffect(() => {
    const shouldOpenShareDialog = (location.state as { openShareDialog?: boolean } | null)?.openShareDialog;

    if (!shouldOpenShareDialog || !patient) return;

    void handleOpenShareDialog();
    navigate(location.pathname, { replace: true, state: null });
  }, [handleOpenShareDialog, location.pathname, location.state, navigate, patient]);

  const openNewGroup = () => {
    const defaultSlot = resolvedClinicColorSlots[1] ?? resolvedClinicColorSlots[0] ?? null;
    setEditingGroup(null);
    setGroupName("");
    setGroupComboboxOpen(false);
    setGroupColor(defaultSlot?.color_hex ?? getLegacyGroupHex("lavender"));
    setGroupColorSlotId(defaultSlot?.id ?? null);
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
    setGroupColorSlotId(g.clinic_color_slot_id);
    setGroupStatus((g.status as PatientGroupStatus) || "em_andamento");
    setGroupDialogOpen(true);
  };

  const handleSelectGroupSuggestion = (suggestion: GroupSuggestion) => {
    setGroupName(suggestion.name);
    const slot = getSlotById(suggestion.clinic_color_slot_id);
    setGroupColor(slot?.color_hex ?? getLegacyGroupHex(suggestion.color || "lavender"));
    setGroupColorSlotId(slot?.id ?? null);
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
        clinic_color_slot_id: clinicColorSlotId,
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
    const resolvedGroupColorSlotId = suggestionSlot?.id ?? reusableSuggestion?.clinic_color_slot_id ?? groupColorSlotId;
    const resolvedGroupStatus = (reusableSuggestion?.status as PatientGroupStatus | null) || groupStatus;

    if (editingGroup) {
      const { error } = await supabase
        .from("patient_groups")
        .update({ clinic_color_slot_id: groupColorSlotId, name: groupName.trim(), color: groupColor, status: groupStatus })
        .eq("id", editingGroup.id);
      if (error) { toast({ title: "Erro ao atualizar grupo", variant: "destructive" }); }
      else {
        await upsertGroupTemplate({ clinicColorSlotId: groupColorSlotId, color: groupColor, name: groupName.trim(), status: groupStatus });
        toast({ title: "Grupo atualizado" });
      }
    } else {
      const { error } = await supabase.from("patient_groups").insert({
        clinic_color_slot_id: resolvedGroupColorSlotId,
        name: groupName.trim(),
        color: resolvedGroupColor,
        group_kind: "custom",
        status: resolvedGroupStatus,
        is_default: false,
        patient_id: id,
        user_id: user.id,
        clinic_id: clinicRes.data,
      });
      if (error) { toast({ title: "Erro ao criar grupo", variant: "destructive" }); }
      else {
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
    void fetchData();
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
    await fetchData();
  };

  const handleDeleteGroup = async (groupId: string) => {
    const group = groups.find((item) => item.id === groupId);
    if (group && isLockedSystemGroup(group)) {
      toast({ title: "Este grupo reservado do sistema não pode ser excluído", variant: "destructive" });
      setDeleteConfirmId(null);
      return;
    }

    // Unlink sessions first
    await supabase.from("sessions").update({ group_id: null }).eq("group_id", groupId);
    const { error } = await supabase.from("patient_groups").delete().eq("id", groupId);
    if (error) { toast({ title: "Erro ao excluir grupo", variant: "destructive" }); }
    else { toast({ title: "Grupo excluído" }); }
    setDeleteConfirmId(null);
    void fetchData();
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

    setUpdatingPatientStatus(true);
    const { error } = await supabase
      .from("patients")
      .update({ status: nextStatus })
      .eq("id", patient.id);

    if (error) {
      toast({ title: "Erro ao atualizar status do paciente", description: error.message, variant: "destructive" });
      setUpdatingPatientStatus(false);
      return;
    }

    setPatient((current) => (current ? { ...current, status: nextStatus } : current));
    toast({ title: "Status do paciente atualizado" });
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
    navigate("/", {
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
          groupStatus: groupStatusFilter,
        },
        getSessionText: getSessionSearchText,
      }),
    [getSessionSearchText, groupStatusFilter, groups, searchTerm, sessionStatusFilter, sessions]
  );

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

    setBulkUpdating(true);
    const { error } = await supabase
      .from("sessions")
      .update({ group_id: nextGroupId === "none" ? null : nextGroupId })
      .in("id", selectedSessionIds);

    if (error) {
      toast({ title: "Erro ao mover atendimentos", description: error.message, variant: "destructive" });
      setBulkUpdating(false);
      return;
    }

    toast({ title: "Atendimentos movidos" });
    handleExitSelectionMode();
    setBulkUpdating(false);
    void fetchData();
  };

  const handleBulkStatusUpdate = async (nextStatus: string) => {
    if (selectedSessionIds.length === 0) {
      return;
    }

    setBulkUpdating(true);
    const { error } = await supabase
      .from("sessions")
      .update({ status: nextStatus })
      .in("id", selectedSessionIds);

    if (error) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
      setBulkUpdating(false);
      return;
    }

    toast({ title: "Status dos atendimentos atualizado" });
    handleExitSelectionMode();
    setBulkUpdating(false);
    void fetchData();
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

    setBulkUpdating(true);
    const { error } = await supabase.from("sessions").delete().in("id", selectedSessionIds);

    if (error) {
      toast({ title: "Erro ao excluir atendimentos", description: error.message, variant: "destructive" });
      setBulkUpdating(false);
      return;
    }

    toast({ title: "Atendimentos excluídos" });
    handleExitSelectionMode();
    setBulkUpdating(false);
    void fetchData();
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
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
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
  const patientRegistrationStatus = patient.registration_complete ? "Cadastro concluído" : "Cadastro pendente";
  const visibleUpcomingAgendaEvents = agendaEvents
    .filter((event) => new Date(event.scheduled_for).getTime() >= Date.now())
    .filter((event) => getAgendaEventStatus(event) !== "cancelado")
    .sort((left, right) => left.scheduled_for.localeCompare(right.scheduled_for));
  const upcomingAgendaEvent = visibleUpcomingAgendaEvents[0] ?? null;
  const summaryCards = [
    {
      detail: `atendimento${sessions.length !== 1 ? "s" : ""} no histórico`,
      label: "Resumo",
      value: String(sessions.length),
    },
    {
      detail: `atendimento${completedSessionsCount !== 1 ? "s" : ""}`,
      label: "Concluídos",
      value: String(completedSessionsCount),
    },
    {
      detail: latestSession?.status ?? "Sem atendimento",
      label: "Mais recente",
      value: formatSessionMetaDate(latestSession?.session_date ?? null),
    },
  ];
  const activeSummaryCard = summaryCards[summaryCardIndex] ?? summaryCards[0];
  const goToPreviousSummary = () => setSummaryCardIndex((current) => (current === 0 ? summaryCards.length - 1 : current - 1));
  const goToNextSummary = () => setSummaryCardIndex((current) => (current + 1) % summaryCards.length);
  const handleOpenPatientAgendaDialog = () => {
    setAgendaDate(getDateInputValue());
    setAgendaTime("09:00");
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

      setAgendaEvents((current) => [...current, data as AgendaEvent].sort((left, right) => left.scheduled_for.localeCompare(right.scheduled_for)));
      setAgendaDialogOpen(false);
      toast({ title: "Agendamento confirmado" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel salvar o agendamento.";
      toast({ title: "Erro ao salvar agendamento", description: message, variant: "destructive" });
    } finally {
      setSavingAgendaEvent(false);
    }
  };
  const handleApplyAgendaStatus = async () => {
    if (!selectedAgendaEvent || !user || !patient) {
      return;
    }

    try {
      setSavingAgendaDetails(true);

      if (selectedAgendaStatusAction === "delete") {
        const { error } = await supabase.from("agenda_events").delete().eq("id", selectedAgendaEvent.id);

        if (error) {
          throw error;
        }

        setAgendaEvents((current) => current.filter((event) => event.id !== selectedAgendaEvent.id));
        setSelectedAgendaEvent(null);
        toast({ title: "Agendamento excluído" });
        return;
      }

      const previousStatus = getAgendaEventStatus(selectedAgendaEvent);
      const { data, error } = await supabase
        .from("agenda_events")
        .update({ status: selectedAgendaStatusAction })
        .eq("id", selectedAgendaEvent.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const updatedEvent = data as AgendaEvent;
      setAgendaEvents((current) =>
        current
          .map((event) => (event.id === updatedEvent.id ? updatedEvent : event))
          .sort((left, right) => left.scheduled_for.localeCompare(right.scheduled_for))
      );
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

        if (canceledSession) {
          setSessions((current) => [canceledSession as Session, ...current]);
        }
      }

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
      setAgendaEvents((current) =>
        current
          .map((event) => (event.id === updatedEvent.id ? updatedEvent : event))
          .sort((left, right) => left.scheduled_for.localeCompare(right.scheduled_for))
      );
      setSelectedAgendaEvent(updatedEvent);
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-6">
      {/* Header */}
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/")}
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
                {patient.phone ? (
                  <span className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-3 py-1">
                    <Phone className="h-3.5 w-3.5" />
                    {patient.phone}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-3 py-1">
                  {patient.registration_complete ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <FileText className="h-3.5 w-3.5" />}
                  {patientRegistrationStatus}
                </span>
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Acesse rapidamente contato, cadastro, status e novo atendimento sem sair da ficha do paciente.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border bg-background/70 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:grid-cols-[auto,auto,minmax(0,160px)] xl:shrink-0">
            <Button
              variant="outline"
              size="icon"
              onClick={() => patientWhatsAppHref && window.open(patientWhatsAppHref, "_blank", "noopener,noreferrer")}
              disabled={!patientWhatsAppHref}
              aria-label="Abrir WhatsApp do paciente"
              title="Abrir WhatsApp"
              className="border-success/30 bg-success/10 text-success hover:bg-success/15 hover:text-success"
            >
              <WhatsAppLogo className="h-5 w-5" />
            </Button>
            <Button variant="outline" onClick={() => setPatientInfoDialogOpen(true)} className="w-full sm:w-auto">
              <MoreHorizontal className="h-4 w-4 mr-2" />
              Ver mais
            </Button>
            <Select
              value={patient.status}
              onValueChange={(value) => void handlePatientStatusChange(value as PatientStatusSelectValue)}
              disabled={updatingPatientStatus || deletingPatient}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITABLE_PATIENT_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                ))}
                {canDeletePatient ? (
                  <SelectItem value={DELETE_PATIENT_STATUS_OPTION.value} className="text-destructive focus:text-destructive">
                    {DELETE_PATIENT_STATUS_OPTION.label}
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),minmax(360px,0.65fr)]">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button type="button" variant="outline" size="icon" onClick={goToPreviousSummary} aria-label="Resumo anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{activeSummaryCard.label}</p>
              <p className={activeSummaryCard.label === "Mais recente" ? "mt-2 truncate text-lg font-semibold" : "mt-2 text-2xl font-semibold"}>
                {activeSummaryCard.value}
              </p>
              <p className="truncate text-sm text-muted-foreground">{activeSummaryCard.detail}</p>
            </div>
            <Button type="button" variant="outline" size="icon" onClick={goToNextSummary} aria-label="Próximo resumo">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 flex justify-center gap-1.5" aria-label="Opções de resumo">
            {summaryCards.map((card, index) => (
              <button
                key={card.label}
                type="button"
                className={`h-1.5 rounded-full transition-all ${index === summaryCardIndex ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
                onClick={() => setSummaryCardIndex(index)}
                aria-label={`Mostrar ${card.label}`}
                aria-current={index === summaryCardIndex ? "true" : undefined}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agendamento</p>
              <h3 className="mt-1 text-base font-semibold sm:text-lg">
                {upcomingAgendaEvent ? formatAgendaEventDateTime(upcomingAgendaEvent.scheduled_for) : "Sem agendamentos no momento"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {upcomingAgendaEvent ? upcomingAgendaEvent.title : "Crie um horário para este paciente ou inicie um atendimento agora."}
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 p-2">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
          </div>

          {visibleUpcomingAgendaEvents.length > 0 ? (
            <div className="mt-4 max-h-36 space-y-2 overflow-y-auto pr-1">
              {visibleUpcomingAgendaEvents.map((event) => {
                const eventStatus = getAgendaEventStatus(event);

                return (
                  <button
                    key={event.id}
                    type="button"
                    className="flex w-full flex-col items-start gap-2 rounded-xl border bg-muted/20 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center"
                    onClick={() => handleOpenAgendaDetails(event)}
                  >
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 font-medium sm:truncate">{formatAgendaEventDateTime(event.scheduled_for)}</span>
                    <Badge variant="outline" className={agendaStatusBadgeStyles[eventStatus]}>
                      {getAgendaStatusLabel(eventStatus)}
                    </Badge>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button type="button" onClick={handleOpenPatientAgendaDialog}>
              Agendar
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(`/pacientes/${id}/sessao/novo`)}>
              Atender agora
            </Button>
          </div>
        </div>
      </div>

      {/* Group management toolbar */}
      <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">Grupos & Atendimentos</h2>
          {!isIntern && (
            <Button variant="outline" size="sm" onClick={openNewGroup}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Novo Grupo
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr),180px,180px]">
            <div className="space-y-2">
              <Label htmlFor="sessions-search">Buscar por grupo ou atendimento</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="sessions-search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Ex: lombar, rascunho, 18/03/2026"
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
                  <SelectItem value="all">Todos</SelectItem>
                  {SESSION_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status do grupo</Label>
              <Select value={groupStatusFilter} onValueChange={setGroupStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {GROUP_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!isIntern && selectionMode && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Badge variant="secondary">{selectedSessionIds.length} atendimento(s) selecionado(s)</Badge>
              <Select onValueChange={(value) => void handleBulkMove(value)} disabled={bulkUpdating || selectedSessionIds.length === 0}>
                <SelectTrigger className="w-[220px] bg-background">
                  <SelectValue placeholder="Mover para grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem grupo</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={(value) => void handleBulkStatusUpdate(value)} disabled={bulkUpdating || selectedSessionIds.length === 0}>
                <SelectTrigger className="w-[220px] bg-background">
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
      </div>

      {/* Groups with sessions */}
      {sessionView.groups.map((groupView) => (
        <Card key={groupView.group.id}>
          <CardHeader
            className="border-l-4 rounded-tl-lg"
            style={{ borderLeftColor: getLegacyGroupHex(groupView.group.color) }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <button
                type="button"
                className="flex w-full flex-1 items-start justify-between gap-3 text-left"
                onClick={() => toggleGroupCollapsed(groupView.group.id)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-lg">{groupView.group.name}</CardTitle>
                    {getPatientGroupKind(groupView.group) !== "default" && groupView.group.status && (
                      <Badge variant="outline" className={groupStatusBadgeStyles[groupView.group.status as PatientGroupStatus]}>
                        {GROUP_STATUSES.find((status) => status.value === groupView.group.status)?.label || "Em andamento"}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 grid gap-x-4 gap-y-1 text-sm text-muted-foreground sm:flex sm:flex-wrap">
                    <span>{groupView.sessionCount} atendimento{groupView.sessionCount !== 1 ? "s" : ""}</span>
                    <span>Primeiro: {formatSessionMetaDate(groupView.firstSessionDate)}</span>
                    <span>Mais recente: {formatSessionMetaDate(groupView.latestSessionDate)}</span>
                  </div>
                </div>
                {collapsedGroups[groupView.group.id] ? <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
              <div className="flex items-center justify-end gap-1 sm:pt-0">
                {!isIntern && getPatientGroupKind(groupView.group) === "custom" && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditGroup(groupView.group)} aria-label="Editar grupo">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {!isIntern && getPatientGroupKind(groupView.group) === "custom" && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(groupView.group.id)} aria-label="Excluir grupo">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <AnimatePresence initial={false}>
            {!collapsedGroups[groupView.group.id] && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <CardContent className="pt-4 space-y-3">
                  {groupView.sessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      baseSchema={baseSchema}
                      creatorName={getSessionPersonLabel(profileMap.get(session.user_id))}
                      creatorIsIntern={shouldShowSessionCreatorInternBadge(profileMap.get(session.user_id)?.job_title)}
                      session={session}
                      shareSummary={sessionShareSummaries[session.id]}
                      isSelected={selectedSessionIds.includes(session.id)}
                      selectionMode={!isIntern && selectionMode}
                      borderColor={getLegacyGroupHex(groupView.group.color)}
                      onPressStart={() => handleSessionPressStart(session.id)}
                      onPressCancel={handleSessionPressCancel}
                      onToggleSelect={() => toggleSessionSelection(session.id)}
                      onViewShareRecipients={() => setShareRecipientsSessionId(session.id)}
                      navigateTo={() => handleSessionNavigate(session.id)}
                    />
                  ))}
                  {groupView.sessions.length === 0 && <p className="text-sm text-muted-foreground py-2">Nenhum atendimento neste grupo.</p>}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      ))}

      {/* Ungrouped sessions */}
      {sessionView.ungrouped.length > 0 && (
        <Card>
          <CardHeader>
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => toggleGroupCollapsed("ungrouped")}
            >
              <div>
                <CardTitle className="text-lg">Atendimentos sem grupo</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">{sessionView.ungrouped.length} atendimento{sessionView.ungrouped.length !== 1 ? "s" : ""}</p>
              </div>
              {collapsedGroups.ungrouped ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CardHeader>
          <AnimatePresence initial={false}>
            {!collapsedGroups.ungrouped && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <CardContent className="pt-4 space-y-3">
                  {sessionView.ungrouped.map((session) => (
                    <SessionCard
                      key={session.id}
                      baseSchema={baseSchema}
                      creatorName={getSessionPersonLabel(profileMap.get(session.user_id))}
                      creatorIsIntern={shouldShowSessionCreatorInternBadge(profileMap.get(session.user_id)?.job_title)}
                      session={session}
                      shareSummary={sessionShareSummaries[session.id]}
                      isSelected={selectedSessionIds.includes(session.id)}
                      selectionMode={!isIntern && selectionMode}
                      onPressStart={() => handleSessionPressStart(session.id)}
                      onPressCancel={handleSessionPressCancel}
                      onToggleSelect={() => toggleSessionSelection(session.id)}
                      onViewShareRecipients={() => setShareRecipientsSessionId(session.id)}
                      navigateTo={() => handleSessionNavigate(session.id)}
                    />
                  ))}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}

      {sessionView.groups.length === 0 && sessionView.ungrouped.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhum resultado encontrado para a busca ou filtros atuais.</p>
        </Card>
      )}

      {sessions.length === 0 && groups.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhum atendimento registrado.</p>
        </Card>
      )}

      {/* Group create/edit dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Editar Grupo" : "Novo Grupo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do grupo</Label>
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
                      {groupName || "Selecione um grupo ou digite para criar"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput
                      value={groupName}
                      onValueChange={setGroupName}
                      placeholder="Buscar ou criar grupo..."
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
                      <CommandEmpty>Nenhum grupo reutilizável encontrado.</CommandEmpty>
                      <CommandGroup heading="Grupos reutilizáveis">
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
                <p className="text-xs text-destructive">Este paciente já possui um grupo com esse nome.</p>
              ) : existingSuggestion && !editingGroup ? (
                <p className="text-xs text-muted-foreground">
                  Este nome já existe na clínica. Ao criar, ele será reutilizado neste paciente com a cor e status selecionados.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Digite para buscar grupos existentes ou criar uma nova opção reutilizável.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Status do grupo</Label>
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
            <DialogTitle>Excluir grupo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Os atendimentos deste grupo serão mantidos, mas ficarão sem grupo.</p>
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

      <Dialog open={agendaDialogOpen} onOpenChange={setAgendaDialogOpen}>
        <DialogContent className="sm:max-w-sm">
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
            <p className="text-xs text-muted-foreground">
              Este agendamento usa a mesma agenda da homepage e aparecerá nos dois lugares.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={savingAgendaEvent}>Cancelar</Button>
            </DialogClose>
            <Button onClick={() => void handleSchedulePatientAgendaEvent()} disabled={savingAgendaEvent || !agendaDate || !agendaTime}>
              {savingAgendaEvent ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedAgendaEvent} onOpenChange={(open) => !open && setSelectedAgendaEvent(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Agendamento</p>
            <DialogTitle className="text-3xl">{patient.name}</DialogTitle>
            <DialogDescription>
              Revise o horário, atualize o status ou inicie o atendimento a partir deste agendamento.
            </DialogDescription>
          </DialogHeader>

          {selectedAgendaEvent ? (
            <div className="space-y-5 py-2">
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
                  disabled={savingAgendaDetails || !selectedAgendaDate || !selectedAgendaTime}
                >
                  Trocar data/horário
                </Button>
              </div>
            </div>
          ) : null}

          <DialogFooter className="grid gap-2 sm:grid-cols-3">
            <Button
              type="button"
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
              <SummaryField label="Telefone" value={patient.phone} />
              <SummaryField label="E-mail" value={patient.email} />
              <SummaryField label="CPF" value={patient.cpf} />
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
                  navigate(`/pacientes/${id}/resumo`);
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Resumo clínico
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPatientInfoDialogOpen(false);
                  navigate(`/pacientes/${id}/cadastro`);
                }}
              >
                <ClipboardEdit className="h-4 w-4 mr-2" />
                Editar cadastro
              </Button>
            </div>
            <Button
              onClick={() => {
                setPatientInfoDialogOpen(false);
                void handleOpenShareDialog();
              }}
              disabled={generatingShareLink || !sharePasswordAvailable || patient.registration_complete}
            >
              {generatingShareLink ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
              Compartilhar com o paciente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartilhar com o paciente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {shareCompleted ? (
              <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                Cadastro concluído! Caso precise atualizar alguma informação, informe o profissional que está te atendendo.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Link do cadastro</Label>
                  <div className="flex gap-2">
                    <Input value={shareLink} readOnly />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(shareLink);
                        toast({ title: "Link copiado" });
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                  <p className="font-medium">Senha de acesso</p>
                  <p className="text-muted-foreground mt-1">
                    Oriente o paciente a usar os 6 primeiros dígitos do CPF para abrir o formulário.
                  </p>
                  <p className="mt-2 font-mono text-base">{sharePassword}</p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SessionShareDialog
        collaborators={shareCollaborators}
        currentUserId={user?.id}
        existingRecipients={selectedShareRecipients}
        onOpenChange={setSessionShareDialogOpen}
        onShared={() => {
          handleExitSelectionMode();
          void fetchData();
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
    </motion.div>
  );
};

export default PacienteDetalhe;
