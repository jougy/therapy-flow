import { useState, useEffect, useCallback, useMemo, useRef, memo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { isSameDay } from "date-fns";
import {
  AlertTriangle, ArrowLeft, Plus, Phone, Calendar, CalendarDays, Loader2, ChevronDown, ChevronUp, Clock, BarChart3,
  Pencil, Trash2, FolderPlus, ClipboardEdit, ClipboardList, Share2, Copy, CheckCircle2, ChevronsUpDown, Search, X, Users, FileText, MoreHorizontal, ChevronLeft, ChevronRight, CalendarClock, Package, SlidersHorizontal, PlayCircle, Printer, FileDown, Baby, Activity, FileCheck2, History
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { DismissibleInfoTip } from "@/components/ui/dismissible-info-tip";
import { PatientFilesPanel } from "@/components/PatientFilesPanel";
import { PatientFilesProvider, usePatientFilesContext } from "@/contexts/PatientFilesContext";
import { FileThumbnailCard } from "@/components/FileThumbnailCard";
import { AnnotatedImagePreview } from "@/components/anamnesis/image-annotator/ImageAnnotationRuntimeInput";
import type { ClinicalImageAnnotationValue } from "@/lib/image-annotation-vector";
import { PatientAnamnesisDashboardContent, PatientStatsPrintView } from "@/pages/PacienteAnamnesisDashboard";
import { SharePatientRegistrationModal } from "@/components/patients/SharePatientRegistrationModal";
import { PrintResponsibilityModal } from "@/components/PrintResponsibilityModal";
import { PatientRegistrationPrintView } from "@/components/patients/PatientRegistrationPrintView";
import { PrintAdultConsentModal } from "@/components/patients/PrintAdultConsentModal";
import { PrintGuardianConsentModal } from "@/components/patients/PrintGuardianConsentModal";
import { buildPatientExportData, downloadPatientDataJson } from "@/lib/patient-export";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useTelemetry } from "@/hooks/useTelemetry";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { createTrashToastAction } from "@/lib/trashUtils";
import { logRuntimeError } from "@/lib/runtime-debug";
import { cn } from "@/lib/utils";
import { ExclusivePatientBadge } from "@/components/patients/ExclusivePatientBadge";
import { fetchPatientByRef, getPatientRouteKey, getClinicPatientPath, getPatientPath, getPatientSessionPath } from "@/lib/patient-routing";
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
  formatSupabaseErrorMessage,
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
import { clearSessionDraft } from "@/lib/session-draft";
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
  extractFilterableModularItems,
  extractModularFieldsByFlag,
  filterSessionsForOperationalRole,
  getSessionCareLineIds,
  groupSessionsByModularField,
  shouldAutoCompleteInternDraft,
  shouldShowSessionCreatorInternBadge,
  type EvolutionGroupMetadata,
  type ModularFilterItem,
  type ModularGroupedSessionsResult,
} from "@/lib/patient-sessions-view";
import { buildSessionPayload, formatDateTimeForInput, getCurrentDateTimeInputValue } from "@/lib/session-payload";
import type { PatientPaymentPlanRow } from "@/lib/payment-plans";
import {
  DEFAULT_GROUP_COLOR_SLOT_SEEDS,
  getLegacyGroupHex,
  getReadableTextColor,
  normalizeGroupName,
  sanitizeColorSlotId,
} from "@/lib/group-colors";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { PatientMobileDock, type PatientMobileTab } from "@/components/patients/PatientMobileDock";
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
import { findConflictingAgendaEvent } from "@/lib/payment-plans";

import {
  type Patient,
  type PatientGroup,
  type PatientGroupTemplate,
  type AnamnesisTemplateRow,
  type ClinicColorSlotRow,
  type Session,
  type AgendaEvent,
  type ProfileSummary,
  type GroupSuggestion,
  type ShareLinkResponse,
  type PatientStatus,
  type PatientStatusSelectValue,
  type AgendaStatusAction,
  type PatientGroupKind,
  type PatientRecordsView,
  dashboardColors,
  GROUP_STATUSES,
  DELETE_PATIENT_STATUS_OPTION,
  AGENDA_STATUS_OPTIONS,
  AGENDA_DELETE_OPTION,
  agendaStatusBadgeStyles,
  WhatsAppLogo,
  splitClinicalAlertItems,
  PatientHeaderAlert,
  SESSION_STATUSES,
  formatSessionMetaDate,
  buildPatientWhatsAppHref,
  getDateInputValue,
  formatAgendaEventDateTime,
  getTimeInputValue,
  getDefaultAgendaInputs,
  getAgendaEventStatus,
  getAgendaStatusLabel,
  formatOperationalTime,
  SummaryField,
  SummaryInlineChart,
  ScaleIndicator,
  isShareLinkResponse,
  getPatientGroupKind,
  isLockedSystemGroup,
  EMPTY_ARRAY,
  SessionTabsPreview,
  SessionCard,
  EditEvolutionGroupDialog,
  CareLineGroupDialog,
  DeleteCareLineDialog,
  DeletePatientDialog,
  PatientRecurrenceDialog,
  PatientScheduleAttendanceDialog,
  SelectedAgendaEventDialog,
  AttendanceConfirmDialog,
  PatientInfoSummaryDialog,
  SessionShareRecipientsDialog,
  LinkSessionEvolutionGroupDialog,
  MobileFilterDrawer,
  MobileStatusSheet,
  MobileTermsSheet,
  PatientBentoOverview,
} from "./paciente-detalhe";

const PacienteDetalhe = () => {
  const { id, clinicKey } = useParams<{ id?: string; clinicKey?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { accountRole, can, clinic, clinicId, operationalRole, profile, user } = useAuth();
  const isAccountOwner = accountRole === "account_owner" || clinic?.account_owner_user_id === user?.id || operationalRole === "owner";
  const { isFeatureEnabled } = useFeatureFlags();
  const { trackDocumentPrint, trackExportJson } = useTelemetry();
  const clinicHomePath = clinic?.route_key ? `/clinica/${clinic.route_key}` : "/espacopessoal";
  const canViewPatientContact = can("patients.manage");
  const canViewFinancialData = can("treasury.manage");
  const canPrint = Boolean(typeof can === "function" ? can("system.print") : true) && isFeatureEnabled("print_general");
  const canExport = Boolean(typeof can === "function" ? can("patients.read") && can("system.print") : true);

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
  const patientGroupsMap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

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

  // Sincroniza o nome do paciente com a barra superior (AppLayout Header)
  useEffect(() => {
    if (patient?.name) {
      const patientKey = getPatientRouteKey(patient);
      window.dispatchEvent(
        new CustomEvent("pluri:set-patient-title", {
          detail: { title: patient.name, patientKey, id: patient.id },
        })
      );
    }
  }, [patient?.name, patient]);

  // Barreira de segurança: Bloqueia acesso à ficha do paciente se o usuário não possuir permissão
  useEffect(() => {
    if (user && operationalRole) {
      const hasReadPermission = typeof can === "function" ? can("patients.read") : false;
      if (!hasReadPermission && !isAccountOwner) {
        toast({
          title: "Acesso restrito",
          description: "Você não possui permissão para consultar o prontuário deste paciente.",
          variant: "destructive",
        });
        navigate("/espacopessoal", { replace: true });
      }
    }
  }, [can, isAccountOwner, navigate, operationalRole, user]);

  const allSessionIdsKey = useMemo(() => allSessions.map((session) => session.id).join(","), [allSessions]);

  // Carregar resumos de compartilhamento das sessões
  const refreshSessionShareSummaries = useCallback(async () => {
    const sessionIds = allSessions.map((session) => session.id);
    if (sessionIds.length === 0) {
      setSessionShareSummaries((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }

    try {
      const summaries = await fetchSessionShareSummaries(sessionIds);
      setSessionShareSummaries(Object.fromEntries(summaries.map((summary) => [summary.session_id, summary])));
    } catch (error) {
      logRuntimeError("patient_detail.fetch_session_share_summaries", error, { patientId: id });
    }
  }, [allSessions, id]);

  useEffect(() => {
    void refreshSessionShareSummaries();
  }, [allSessionIdsKey, refreshSessionShareSummaries]);

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
  const sharedSessionIds = useMemo(() => {
    if (!user?.id) {
      return new Set<string>();
    }

    return new Set(
      Object.values(sessionShareSummaries)
        .filter((summary) => summary.recipients.some((r) => r.id === user.id))
        .map((summary) => summary.session_id)
    );
  }, [sessionShareSummaries, user?.id]);

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
  const [showPrintRegistrationModal, setShowPrintRegistrationModal] = useState(false);
  const [isPrintingRegistration, setIsPrintingRegistration] = useState(false);
  const [showPrintAdultConsentModal, setShowPrintAdultConsentModal] = useState(false);
  const [showPrintGuardianConsentModal, setShowPrintGuardianConsentModal] = useState(false);
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
  const [showFullHistoryDesktop, setShowFullHistoryDesktop] = useState(false);
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

  const [groupByMode, setGroupByMode] = useState<string>("evolution");
  const [collapsedModularGroupKeys, setCollapsedModularGroupKeys] = useState<string[]>([]);
  const toggleModularGroupCollapse = (key: string) => {
    setCollapsedModularGroupKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const [recordsView, setRecordsView] = useState<PatientRecordsView>("list");
  const [mobileTab, setMobileTab] = useState<PatientMobileTab>("inicio");
  const [mobileStatusSheetOpen, setMobileStatusSheetOpen] = useState(false);
  const [mobileTermsSheetOpen, setMobileTermsSheetOpen] = useState(false);
  const [mobileFilterDrawerOpen, setMobileFilterDrawerOpen] = useState(false);
  const [attendanceConfirmDialogOpen, setAttendanceConfirmDialogOpen] = useState(false);
  const [startAttendanceOptionsDialogOpen, setStartAttendanceOptionsDialogOpen] = useState(false);
  const [pendingAttendanceAgendaEvent, setPendingAttendanceAgendaEvent] = useState<AgendaEvent | null>(null);
  const [startingAttendance, setStartingAttendance] = useState(false);

  const handleStartAttendanceNow = () => {
    if (!patient && !id) return;
    if (startingAttendance) return;

    if (upcomingAgendaEvent) {
      setPendingAttendanceAgendaEvent(upcomingAgendaEvent);
      setAttendanceConfirmDialogOpen(true);
    } else {
      setPendingAttendanceAgendaEvent(null);
      setStartAttendanceOptionsDialogOpen(true);
    }
  };

  const handleConfirmAttendanceWithPendingEvent = () => {
    if (!pendingAttendanceAgendaEvent) return;
    setAttendanceConfirmDialogOpen(false);
    setStartAttendanceOptionsDialogOpen(true);
  };

  const handleStartUnscheduledAttendance = () => {
    setPendingAttendanceAgendaEvent(null);
    setAttendanceConfirmDialogOpen(false);
    setStartAttendanceOptionsDialogOpen(true);
  };

  const handleStartUnlinkedSession = (templateId?: string | null) => {
    if (!patient && !id) return;
    const targetPatientId = realPatientId || id;
    const targetPatientKey = patient || id;
    const effectiveClinicId = clinicId || (patient as any)?.clinic_id;

    if (effectiveClinicId && targetPatientId) {
      clearSessionDraft(effectiveClinicId, targetPatientId, "novo");
    }

    const event = pendingAttendanceAgendaEvent;
    setStartAttendanceOptionsDialogOpen(false);
    setPendingAttendanceAgendaEvent(null);

    navigate(getPatientSessionPath(targetPatientKey, "novo"), {
      state: {
        agendaEventId: event?.id,
        scheduledFor: event?.scheduled_for,
        autoArrival: Boolean(event),
        startInEditMode: true,
        forceClean: true,
        templateId: templateId || null,
      },
    });
  };

  const handleCancelPendingAgendaEvent = async () => {
    if (!pendingAttendanceAgendaEvent || !patient || !user) return;
    const event = pendingAttendanceAgendaEvent;
    setAttendanceConfirmDialogOpen(false);
    setPendingAttendanceAgendaEvent(null);

    try {
      optimisticUpdateAgendaEvent({ ...event, status: "cancelado" });
      const { error: updateError } = await supabase
        .from("agenda_events")
        .update({ status: "cancelado" })
        .eq("id", event.id);

      if (updateError) throw updateError;

      const canceledGroup = groups.find((group) => getPatientGroupKind(group) === "cancelados") ?? null;
      const { data: canceledSession, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          clinic_id: clinicId,
          group_id: canceledGroup?.id ?? null,
          notes: "Atendimento cancelado / Paciente faltou.",
          patient_id: patient.id,
          provider_id: user.id,
          session_date: event.scheduled_for,
          status: "cancelado",
          user_id: user.id,
        })
        .select("*")
        .single();

      if (sessionError) throw sessionError;

      if (canceledSession && realPatientId) {
        void invalidatePatientData(realPatientId, clinicId, ["sessions"]);
      }

      notifyAgendaEventsUpdated();
      toast({
        title: "Agendamento cancelado",
        description: "Falta/cancelamento registrado com sucesso no prontuário.",
      });
    } catch (err) {
      logRuntimeError("patient_detail.cancel_pending_agenda_event", err);
      toast({
        title: "Erro ao cancelar agendamento",
        description: "Não foi possível cancelar o agendamento.",
        variant: "destructive",
      });
    }
  };

  const handleMobileTabChange = useCallback((tab: PatientMobileTab) => {
    setMobileTab(tab);

    if (tab === "inicio") {
      setRecordsView("list");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (tab === "resumo") {
      setPatientInfoDialogOpen(true);
      return;
    }

    if (tab === "agendar") {
      // Abre o diálogo de novo agendamento para o paciente
      handleOpenPatientAgendaDialog();
      return;
    }

    if (tab === "agenda_completa") {
      setMobileTab("agenda_completa");
      return;
    }

    if (tab === "atender") {
      void handleStartAttendanceNow();
      return;
    }

    if (tab === "historico") {
      setRecordsView("list");
      return;
    }

    if (tab === "arquivos") {
      setRecordsView("files");
      return;
    }

    if (tab === "estatisticas") {
      setRecordsView("dashboard");
      return;
    }

    if (tab === "termos") {
      setMobileTermsSheetOpen(true);
      return;
    }

    if (tab === "status") {
      setMobileStatusSheetOpen(true);
      return;
    }
  }, [handleStartAttendanceNow]);
  const [dashboardTemplateFilter, setDashboardTemplateFilter] = useState("all");
  const [dashboardChartPreferences, setDashboardChartPreferences] = useState<Record<string, PatientAnamnesisChartType>>({});
  const [showDashboardPrintModal, setShowDashboardPrintModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const isIntern = operationalRole === "estagiario";
  const canDeletePatient = can("patients.delete") || isAccountOwner;
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
    const { error } = await supabase.rpc("move_entity_to_trash", {
      _entity_type: "patients",
      _entity_ids: [patient.id],
    });

    if (error) {
      toast({ title: "Erro ao mover paciente para a lixeira", description: error.message, variant: "destructive" });
      setDeletingPatient(false);
      return;
    }

    const effectiveClinicKey = clinic?.route_key || clinicKey;
    toast({
      title: "Paciente movido para a lixeira",
      description: "O paciente e seus dados foram enviados para a lixeira da clínica e podem ser restaurados até domingo.",
      action: createTrashToastAction(effectiveClinicKey, navigate),
    });
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

    const sessionRef = sessionCodeMap.get(sessionId) || sessionId;
    navigate(getPatientSessionPath(patient || id, sessionRef));
  };

  const sessionCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...sessions].sort((a, b) => {
      const dateA = new Date(a.session_date).getTime();
      const dateB = new Date(b.session_date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    sorted.forEach((sess, idx) => {
      map.set(sess.id, `ATD-${idx + 1}`);
    });
    return map;
  }, [sessions]);

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

  const handleEvolveSession = async (
    session: Session,
    options?: { mode?: "copy" | "blank"; templateId?: string | null; agendaEvent?: AgendaEvent | null }
  ) => {
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
      const scheduledStartAt = options?.agendaEvent?.scheduled_for ? formatDateTimeForInput(options.agendaEvent.scheduled_for) : "";
      const patientArrivedAt = options?.agendaEvent ? getCurrentDateTimeInputValue() : "";
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
            patientArrivedAt,
            paymentAdjustmentReason: "",
            paymentInstallments: 1,
            paymentMethod: "nao_informado" as const,
            paymentStatus: "nao_cobrado" as const,
            paymentStatusDate: "",
            queixa: "",
            scheduledStartAt,
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
            patientArrivedAt,
            paymentAdjustmentReason: session.payment_adjustment_reason ?? "",
            paymentInstallments: session.payment_installments ?? 1,
            paymentMethod: (session.payment_method as any) ?? "nao_informado",
            paymentStatus: (session.payment_status as any) ?? "nao_cobrado",
            paymentStatusDate: session.payment_status_date ?? "",
            queixa: anamnesis.queixa ?? "",
            scheduledStartAt,
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
        clearSessionDraft(activeClinicId, targetPatientId, "novo");
        clearSessionDraft(activeClinicId, targetPatientId, data.id);

        toast({
          title: isBlank ? "Novo atendimento em branco iniciado" : "Novo atendimento de evolução iniciado",
          description: isBlank ? "Uma nova ficha vinculada a este ciclo está pronta para preenchimento." : "Os dados foram copiados e o atendimento está pronto para preenchimento.",
        });
        const nextIndex = sessions.length + 1;
        navigate(getPatientSessionPath(patient || id, `ATD-${nextIndex}`, "?edit=true"), {
          state: {
            startInEditMode: true,
            agendaEventId: options?.agendaEvent?.id,
            scheduledFor: options?.agendaEvent?.scheduled_for,
          },
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

  // Identifica campos configurados nos templates ou baseSchema que possuem enableGrouping === true
  const groupableModularFields = useMemo(() => {
    return extractModularFieldsByFlag(
      [baseSchema, ...anamnesisTemplates.map((t) => t.schema)],
      "enableGrouping"
    );
  }, [baseSchema, anamnesisTemplates]);

  // Agrupa atendimentos cronológicos quando groupByMode for um campo modular
  const modularGroupedSessions = useMemo<ModularGroupedSessionsResult<Session> | null>(() => {
    if (groupByMode === "evolution" || !groupByMode) return null;
    const targetField = groupableModularFields.find((f) => f.id === groupByMode);
    if (!targetField) return null;

    return groupSessionsByModularField(sessionView.chronologicalSessions, targetField);
  }, [groupByMode, groupableModularFields, sessionView.chronologicalSessions]);

  // Identifica valores únicos de campos com enableFilter === true nas sessões do paciente
  const filterableModularItems = useMemo<ModularFilterItem[]>(() => {
    const filterableFields = extractModularFieldsByFlag(
      [baseSchema, ...anamnesisTemplates.map((t) => t.schema)],
      "enableFilter"
    );
    return extractFilterableModularItems(sessions, filterableFields);
  }, [baseSchema, anamnesisTemplates, sessions]);

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

  const handleExecutePrintRegistration = () => {
    setShowPrintRegistrationModal(false);
    setIsPrintingRegistration(true);
    if (patient) {
      trackDocumentPrint("patient_registration", patient.id, { patient_code: patient.patient_code });
    }
    const previousTitle = document.title;
    const patientCleanName = (patient?.name ?? "Paciente").replace(/[^a-zA-Z0-9-_\s]/g, " ").replaceAll(/\s+/g, " ").trim();
    const clinicCleanName = (clinic?.name ?? "Clínica").replace(/[^a-zA-Z0-9-_\s]/g, " ").replaceAll(/\s+/g, " ").trim();
    document.title = `Cadastro Completo - ${patientCleanName} - ${clinicCleanName}`;

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = previousTitle;
        setIsPrintingRegistration(false);
      }, 1000);
    }, 150);
  };

  const handleExportPatientJson = () => {
    if (!canExport) {
      toast({
        title: "Acesso não autorizado",
        description: "Seu perfil não possui autorização para exportar os dados cadastrais deste paciente (LGPD).",
        variant: "destructive",
      });
      return;
    }

    if (!patient) return;

    try {
      const payload = buildPatientExportData({
        patient,
        clinicalProfile: parsedClinicalProfile,
        emergencyContact: parsedEmergencyContact,
        clinicName: clinic?.name || "Clínica Pluri-Health",
        exportedBy: profile?.full_name || profile?.social_name || user?.email || "Profissional autorizado",
      });

      downloadPatientDataJson(payload, patient.name);
      trackExportJson("patient", patient.id, {
        patient_code: patient.patient_code,
        patient_name: patient.name,
        action: "lgpd_data_export",
      });

      toast({
        title: "Exportação concluída",
        description: "Arquivo JSON gerado e baixado com sucesso em conformidade com a LGPD (Art. 18, V).",
      });
    } catch (err) {
      console.error("Erro ao exportar dados do paciente:", err);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível gerar o arquivo de exportação.",
        variant: "destructive",
      });
    }
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
    canDeleteAll: can("sessions.delete") || isAccountOwner,
    canDeleteDraft: can("session.delete_draft"),
    currentUserId: user?.id,
    operationalRole,
    selectedSessions,
  });
  const canManageSessions = can("sessions.read_all") || can("sessions.write_others") || isAccountOwner;
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
      const canDeleteAnyStatus = can("sessions.delete") || isAccountOwner;
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
    const sessionIdsToDelete = [...selectedSessionIds];
    handleExitSelectionMode();

    setBulkUpdating(true);
    const { error } = await supabase.rpc("move_entity_to_trash", {
      _entity_type: "sessions",
      _entity_ids: sessionIdsToDelete,
    });

    if (error) {
      toast({ title: "Erro ao mover atendimentos para a lixeira", description: error.message, variant: "destructive" });
      if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]);
    } else {
      const effectiveClinicKey = clinic?.route_key || clinicKey;
      toast({
        title: "Atendimentos movidos para a lixeira",
        description: "Os atendimentos foram enviados para a lixeira da clínica e podem ser restaurados até domingo.",
        action: createTrashToastAction(effectiveClinicKey, navigate),
      });
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
  const activeAgendaEvents = agendaEvents.filter((event) => {
    const st = getAgendaEventStatus(event);
    return st !== "cancelado" && st !== "concluido";
  });
  const now = new Date();
  const nowTimestamp = now.getTime();
  const overdueAgendaEvents = activeAgendaEvents
    .filter((event) => {
      const eventDate = new Date(event.scheduled_for);
      return eventDate.getTime() < nowTimestamp && isSameDay(eventDate, now);
    })
    .sort((left, right) => right.scheduled_for.localeCompare(left.scheduled_for));
  const futureAgendaEvents = activeAgendaEvents
    .filter((event) => new Date(event.scheduled_for).getTime() >= nowTimestamp)
    .sort((left, right) => left.scheduled_for.localeCompare(right.scheduled_for));
  const visiblePatientAgendaEvents = [...overdueAgendaEvents, ...futureAgendaEvents];
  // Prioriza o agendamento de hoje com menor distância absoluta para o horário atual
  const todayAgendaEvents = activeAgendaEvents.filter((event) => isSameDay(new Date(event.scheduled_for), now));
  const upcomingAgendaEvent =
    todayAgendaEvents.length > 0
      ? [...todayAgendaEvents].sort(
          (a, b) =>
            Math.abs(new Date(a.scheduled_for).getTime() - nowTimestamp) -
            Math.abs(new Date(b.scheduled_for).getTime() - nowTimestamp)
        )[0]
      : visiblePatientAgendaEvents[0] ?? null;
  const futureAgendaCount = futureAgendaEvents.length;
  const agendaDialogDateTime = agendaDate && agendaTime ? getAgendaEventDateTime(agendaDate, agendaTime) : null;
  const isAgendaDialogDateTimePast = agendaDialogDateTime ? isAgendaEventDateTimeInPast(agendaDialogDateTime, undefined, 15) : false;
  const selectedAgendaDateTime =
    selectedAgendaDate && selectedAgendaTime ? getAgendaEventDateTime(selectedAgendaDate, selectedAgendaTime || "00:00") : null;
  const isSelectedAgendaDateTimePast = selectedAgendaDateTime ? isAgendaEventDateTimeInPast(selectedAgendaDateTime, undefined, 15) : false;
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
  const effectiveClinicId = clinicId || clinic?.id || null;

  const handleSchedulePatientAgendaEvent = async () => {
    if (!user || !patient) {
      return;
    }

    try {
      const selectedDateTime = getAgendaEventDateTime(agendaDate, agendaTime);
      assertAgendaEventDateTimeIsFuture(selectedDateTime, undefined, 15);
      setSavingAgendaEvent(true);
      const payload = buildAgendaEventPayload({
        clinicId: effectiveClinicId,
        eventType: "atendimento",
        graceMinutes: 15,
        selectedDate: agendaDate as any,
        selectedPatient: { id: patient.id, name: patient.name },
        time: agendaTime,
        title: patient.name,
        userId: user.id,
      });

      let insertedResult = await supabase
        .from("agenda_events")
        .insert(payload)
        .select("*")
        .single();

      if (insertedResult.error && (insertedResult.error.code === "42703" || insertedResult.error.message.includes("duration_minutes"))) {
        const fallbackPayload = { ...payload };
        delete (fallbackPayload as any).duration_minutes;
        insertedResult = await supabase
          .from("agenda_events")
          .insert(fallbackPayload)
          .select("*")
          .single();
      }

      if (insertedResult.error) {
        throw insertedResult.error;
      }

      const data = insertedResult.data;

      if (data?.id && (newEventData.notifyPatient || newEventData.notifyTeam)) {
        void supabase.functions.invoke("agenda-whatsapp-reminders", {
          body: { action: "notify_new_booking", eventId: data.id },
        }).catch((err) => {
          console.warn("[PacienteDetalhe] Falha ao disparar notificação de WhatsApp:", err);
        });
      }

      if (data) {
        optimisticAddAgendaEvent(data as AgendaEvent);
      }
      setAgendaDialogOpen(false);
      notifyAgendaEventsUpdated();
      toast({ title: "Agendamento confirmado" });
    } catch (error) {
      const message = formatSupabaseErrorMessage(error, "Não foi possível salvar o agendamento.");
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
          const conflictingEvent = findConflictingAgendaEvent(
            nextDateTime,
            agendaEvents.filter(
              (event) =>
                event.patient_id === patient.id &&
                !event.generated_by_recurring_patient &&
                getAgendaEventStatus(event) !== "cancelado"
            )
          );

          if (!conflictingEvent) {
            const { error: insertError } = await supabase.from("agenda_events").insert({
              clinic_id: effectiveClinicId,
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
      const message = formatSupabaseErrorMessage(error, "Não foi possível salvar a recorrência.");
      toast({ title: "Erro ao salvar recorrência", description: message, variant: "destructive" });
    } finally {
      setSavingRecurrence(false);
    }
  };
  const handleApplyAgendaStatus = async (overrideAction?: AgendaStatusAction) => {
    if (!selectedAgendaEvent || !user || !patient) {
      return;
    }

    const effectiveAction = overrideAction ?? selectedAgendaStatusAction;

    try {
      setSavingAgendaDetails(true);

      if (effectiveAction === "delete") {
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
      const updatedAgendaRecord = { ...selectedAgendaEvent, status: effectiveAction };
      optimisticUpdateAgendaEvent(updatedAgendaRecord);

      const { data, error } = await supabase
        .from("agenda_events")
        .update({ status: effectiveAction })
        .eq("id", selectedAgendaEvent.id)
        .select("*")
        .single();

      if (error) {
        if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["agenda"]);
        throw error;
      }

      const updatedEvent = data as AgendaEvent;
      setSelectedAgendaEvent(updatedEvent);

      if (effectiveAction === "cancelado" && previousStatus !== "cancelado") {
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
      const message = formatSupabaseErrorMessage(error, "Não foi possível atualizar o agendamento.");
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
      const nextDate = getAgendaEventDateTime(selectedAgendaDate, selectedAgendaTime || "00:00");
      assertAgendaEventDateTimeIsFuture(nextDate, undefined, 15);
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
      const message = formatSupabaseErrorMessage(error, "Não foi possível trocar data/horário.");
      toast({ title: "Erro ao trocar data/horário", description: message, variant: "destructive" });
    } finally {
      setSavingAgendaDetails(false);
    }
  };

  return (
    <PatientFilesProvider patientId={patient?.id || id!} clinicId={clinicId}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-4 sm:space-y-6 pb-24 md:pb-6">


      {/* Header Unificado de Linha Única (Mobile & Desktop) */}
      <div data-tutorial="patient-profile-header" className="overflow-hidden rounded-2xl border bg-gradient-to-r from-card via-card to-primary/5 p-2.5 sm:px-4 sm:py-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h1 className="sr-only">
                {patient.name}
              </h1>

              {/* Status Bolinha no Mobile */}
              <button
                type="button"
                onClick={() => setMobileStatusSheetOpen(true)}
                aria-label={`Status: ${patient.status}. Tocar para alterar.`}
                className="flex md:hidden items-center gap-1 shrink-0 rounded-full border bg-background/80 px-2 py-0.5 text-[10px] font-semibold capitalize text-foreground"
              >
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    patient.status === "ativo"
                      ? "bg-success animate-pulse ring-2 ring-success/20"
                      : patient.status === "alta"
                        ? "bg-primary"
                        : patient.status === "arquivado"
                          ? "bg-muted-foreground"
                          : "bg-warning"
                  }`}
                />
                <span>{patient.status}</span>
              </button>

              {/* Badge de Paciente Exclusivo */}
              <ExclusivePatientBadge patient={patient} />

              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                {patient.age ? (
                  <span className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-2.5 py-0.5 sm:px-3 sm:py-1">
                    <Calendar className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                    {patient.age} anos
                  </span>
                ) : null}
                {canViewPatientContact && patient.phone ? (
                  <span className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-2.5 py-0.5 sm:px-3 sm:py-1">
                    <Phone className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                    {patient.phone}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => navigate(getPatientPath(patient, "cadastro"))}
                  title="Editar cadastro completo"
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 sm:px-3 sm:py-1 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    patient.registration_complete
                      ? "bg-success/10 text-success hover:bg-success/15"
                      : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                  }`}
                >
                  {patient.registration_complete ? <CheckCircle2 className="h-3 sm:h-3.5 w-3 sm:w-3.5" /> : <FileText className="h-3 sm:h-3.5 w-3 sm:w-3.5" />}
                  {patientRegistrationStatus}
                </button>
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


          <div className="flex items-center gap-2 rounded-2xl border bg-background/70 p-2 shadow-sm backdrop-blur w-full sm:w-auto justify-between sm:justify-start xl:shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
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
                className="h-9 rounded-xl border-primary/20 bg-background hover:border-primary/50 hover:bg-primary/5 text-xs font-medium shrink-0 px-2.5 sm:px-3"
                title="Abrir resumo clínico do paciente"
              >
                <FileText className="h-4 w-4 text-primary sm:mr-1.5" />
                <span className="hidden sm:inline">Resumo clínico</span>
              </Button>

              {/* Botão de Termos e Impressões */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Termos e impressões"
                    title="Termos e impressões do paciente"
                    className="h-9 rounded-xl border-border/80 bg-background hover:bg-muted/50 text-xs font-medium text-foreground gap-1.5 px-2.5 shrink-0"
                  >
                    <Printer className="h-4 w-4 text-primary" />
                    <span className="hidden sm:inline">Termos</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                    Termos & Documentos
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setShowPrintRegistrationModal(true);
                    }}
                    onClick={() => setShowPrintRegistrationModal(true)}
                    disabled={!canPrint}
                    className="cursor-pointer"
                  >
                    <Printer className="mr-2 h-4 w-4 text-primary" />
                    <div className="flex flex-col">
                      <span>Imprimir cadastro (PDF)</span>
                      <span className="text-[11px] text-muted-foreground">Dossiê cadastral diagramado A4</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setShowPrintAdultConsentModal(true);
                    }}
                    onClick={() => setShowPrintAdultConsentModal(true)}
                    disabled={!canPrint}
                    className="cursor-pointer"
                  >
                    <FileText className="mr-2 h-4 w-4 text-emerald-600" />
                    <div className="flex flex-col">
                      <span>Imprimir Termo de Consentimento (Adulto)</span>
                      <span className="text-[11px] text-muted-foreground">TCLE A4 para assinatura física</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setShowPrintGuardianConsentModal(true);
                    }}
                    onClick={() => setShowPrintGuardianConsentModal(true)}
                    disabled={!canPrint}
                    className="cursor-pointer"
                  >
                    <Baby className="mr-2 h-4 w-4 text-amber-600" />
                    <div className="flex flex-col">
                      <span>Imprimir Termo do Responsável (Menor)</span>
                      <span className="text-[11px] text-muted-foreground">LGPD Art. 14 / Pais e Tutores</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={patient.status}
                onValueChange={(value) => void handlePatientStatusChange(value as PatientStatusSelectValue)}
                disabled={updatingPatientStatus || deletingPatient}
              >
                <SelectTrigger className="h-9 w-[115px] sm:w-[130px] rounded-xl text-xs bg-background shrink-0">
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
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Mais opções"
                    title="Mais opções do paciente"
                    className="h-9 rounded-xl border-border/80 bg-background hover:bg-muted/50 text-xs font-medium text-foreground gap-1.5 px-2.5 shrink-0"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="hidden sm:inline">Opções</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                  Opções do paciente
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  data-tutorial="patient-btn-share-form"
                  onClick={() => handleOpenShareDialog()}
                  className="cursor-pointer"
                >
                  <Share2 className="mr-2 h-4 w-4 text-primary" />
                  <span>Compartilhar cadastro para o paciente preencher</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate(getPatientPath(patient, "resumo"))}
                  className="cursor-pointer"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Ver cadastro completo</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleExportPatientJson()}
                  disabled={!canExport}
                  className="cursor-pointer"
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  <span>Exportar dados (JSON)</span>
                </DropdownMenuItem>
                {canDeletePatient && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeletePatientDialogOpen(true)}
                      className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Excluir paciente</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
      {/* Dica Informativa Fechável (Substitui texto descritivo estático) */}
      <DismissibleInfoTip
        id="patient-detail-quick-actions-tip"
        variant="subtle"
        className="text-xs"
      >
        Acesse rapidamente contato, cadastro, status e novo atendimento sem sair da ficha do paciente.
      </DismissibleInfoTip>

      {/* Bento Grid Integrado: Métricas Rápidas + Agenda Dinâmica */}
      <div className={cn(
        "w-full min-w-0 space-y-2.5",
        "hidden md:block",
        (mobileTab === "agendar" || mobileTab === "agenda_completa") && "max-md:block"
      )}>
        {/* Faixa Bento de Métricas Rápidas (3 Colunas fluidas sem espaço em branco ocioso) */}
        <div data-tutorial="patient-metrics-panel" className={cn(
          "w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5",
          (mobileTab === "agendar" || mobileTab === "agenda_completa") && "max-md:hidden"
        )}>
          {/* Card 1: Último Atendimento */}
          <div className="rounded-2xl border bg-card/80 p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Último Atendimento</span>
              <ComponentHelpButton helpId="patient-metrics-panel" size="xs" />
            </div>
            <div className="mt-1.5">
              <p className="text-base sm:text-lg font-bold text-foreground tracking-tight">{formatSessionMetaDate(latestSession?.session_date ?? null)}</p>
              <p className="text-xs text-muted-foreground capitalize mt-0.5 truncate">{latestSession ? `Status: ${latestSession.status}` : "Sem atendimentos anteriores"}</p>
            </div>
          </div>

          {/* Card 2: Presença & Histórico */}
          <div className="rounded-2xl border bg-card/80 p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-primary/30 transition-colors">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Presença & Histórico</span>
            <div className="mt-1.5">
              <p className="text-base sm:text-lg font-bold text-foreground tracking-tight">{totalSessionsCount} atendimento{totalSessionsCount !== 1 ? "s" : ""}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {completedSessionsCount} conc. · {canceledSessionsCount} canc.
                {operationalSummary.averageDelayMinutes > 0 ? ` · ${operationalSummary.averageDelayMinutes}m méd.` : ""}
              </p>
            </div>
          </div>

          {/* Card 3: Financeiro / Agendamentos */}
          {canViewFinancialData ? (
            <div className="rounded-2xl border bg-card/80 p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-primary/30 transition-colors">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Financeiro do Paciente</span>
              <div className="mt-1.5">
                <p className="text-base sm:text-lg font-bold text-foreground tracking-tight">{formatMoneyCents(settledPaymentCents)}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {operationalSummary.openBalanceCents > 0 ? `Aberto: ${formatMoneyCents(operationalSummary.openBalanceCents)}` : "Em dia"}
                </p>
              </div>
            </div>
          ) : (
            <div
              role={upcomingAgendaEvent ? "button" : undefined}
              tabIndex={upcomingAgendaEvent ? 0 : undefined}
              onClick={() => {
                if (upcomingAgendaEvent) {
                  handleOpenAgendaDetails(upcomingAgendaEvent);
                }
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && upcomingAgendaEvent) {
                  e.preventDefault();
                  handleOpenAgendaDetails(upcomingAgendaEvent);
                }
              }}
              className={cn(
                "rounded-2xl border bg-card/80 p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-primary/30 transition-colors select-none",
                upcomingAgendaEvent && "cursor-pointer hover:bg-muted/40"
              )}
              title={upcomingAgendaEvent ? "Clique para gerenciar o agendamento" : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agendamentos</span>
                {upcomingAgendaEvent && (
                  <span className="text-[10px] font-medium text-primary hover:underline">Configurar</span>
                )}
              </div>
              <div className="mt-1.5">
                <p className="text-base sm:text-lg font-bold text-foreground tracking-tight">{futureAgendaCount} agendado{futureAgendaCount !== 1 ? "s" : ""}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {upcomingAgendaEvent ? `Próximo: ${formatAgendaEventDateTime(upcomingAgendaEvent.scheduled_for)}` : "Nenhum futuro"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Agenda Dinâmica Integrada (Largura Completa com Altura Otimizada) */}
        <div data-tutorial="patient-internal-agenda" className="w-full">
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
                className="h-8 rounded-xl text-xs gap-1.5 px-2.5 font-medium border-border/80 shadow-2xs hover:bg-accent transition-all active:scale-95"
                onClick={() => setRecurrenceDialogOpen(true)}
                title={patient.is_recurring ? `Recorrente: ${patientRecurrenceLabel}` : "Configurar recorrência"}
              >
                <CalendarClock className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{patientRecurrenceLabel}</span>
              </Button>
            }
          />
        </div>
      </div>

      {/* Group management toolbar */}
      <div className={cn(
        "space-y-4",
        (mobileTab === "agendar" || mobileTab === "agenda_completa") && "max-md:hidden",
        mobileTab === "inicio" && recordsView !== "list" && "max-md:hidden"
      )}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <LiquidTabs
            tabs={[
              { id: "list", label: "Atendimentos", icon: ClipboardList, dataTutorial: "patient-tab-sessions" },
              ...(isFeatureEnabled("storage_s3_integration") ? [{ id: "files", label: "Arquivos", icon: FileText, dataTutorial: "patient-tab-files" }] : []),
              ...(isFeatureEnabled("dashboards_patient") ? [{ id: "dashboard", label: "Estatísticas", icon: BarChart3 }] : [])
            ]}
            activeTab={recordsView}
            onChange={(val) => setRecordsView(val as "list" | "files" | "dashboard")}
            className="w-full sm:w-auto hidden md:flex"
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
          <DismissibleInfoTip
            id="patient-detail-drafts-warning-tip"
            variant="subtle"
            icon={<AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
            className="border-amber-500/30 bg-amber-500/10"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {sessions.filter((s) => s.status === "rascunho").length} atendimento(s) em rascunho pendente(s)
                </p>
                <p className="text-xs text-muted-foreground">
                  Revisar e concluir atendimentos em andamento mantém o prontuário clínico protegido e atualizado.
                </p>
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
          </DismissibleInfoTip>
        )}

        {/* Visão Exclusiva Mobile Início: Bloco Resumido da Agenda + Apenas Último Atendimento */}
        {mobileTab === "inicio" && (
          <PatientBentoOverview
            upcomingAgendaEvent={upcomingAgendaEvent}
            onOpenPatientAgendaDialog={handleOpenPatientAgendaDialog}
            onSelectAgendaEvent={handleOpenAgendaDetails}
            onViewFullHistory={() => handleMobileTabChange("historico")}
            latestSession={latestSession}
            patientGroupsMap={patientGroupsMap}
            profileMap={profileMap}
            sessionShareSummaries={sessionShareSummaries}
            canViewFinancialData={canViewFinancialData}
            baseSchema={baseSchema}
            sessionViewMode={sessionViewMode}
            expandedSessionIds={expandedSessionIds}
            toggleSessionExpansion={toggleSessionExpansion}
            onEvolveSession={(s) => setSessionToEvolve(s)}
            onLinkGroup={(s) => setSessionToLinkGroup(s)}
            evolvingSessionId={evolvingSessionId}
            onPressStart={handleSessionPressStart}
            onPressCancel={handleSessionPressCancel}
            toggleSessionSelection={toggleSessionSelection}
            onViewShareRecipients={(sessionId) => setShareRecipientsSessionId(sessionId)}
            onNavigateToSession={handleSessionNavigate}
            paymentPlanMap={paymentPlanMap}
          />
        )}

        {/* Mobile Filters Trigger & Compact Search (Exibido no Histórico) */}
        <div className={cn("items-center gap-2 md:hidden", (mobileTab === "inicio" || mobileTab === "agenda_completa") ? "hidden" : "flex")}>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar no prontuário..."
              className="pl-9 h-10 rounded-xl bg-card border text-sm"
            />
          </div>
          <MobileFilterDrawer
            open={mobileFilterDrawerOpen}
            onOpenChange={setMobileFilterDrawerOpen}
            sessionStatusFilter={sessionStatusFilter}
            onSessionStatusFilterChange={setSessionStatusFilter}
            selectedTagFilter={selectedTagFilter}
            onSelectedTagFilterChange={setSelectedTagFilter}
            groups={groups}
            filterableModularItems={filterableModularItems}
            groupByEvolution={groupByEvolution}
            onToggleGroupByEvolution={handleToggleGroupByEvolution}
            groupByMode={groupByMode}
            onGroupByModeChange={setGroupByMode}
            groupableModularFields={groupableModularFields}
          />
        </div>

        {/* Visão Desktop: Exibição Inicial do Último Atendimento com Ação para Ver Histórico Completo */}
        {(() => {
          const isFilterActive = Boolean(searchTerm.trim()) || sessionStatusFilter !== "all" || selectedTagFilter !== "all";
          const shouldShowFullHistory = showFullHistoryDesktop || isFilterActive;

          if (!shouldShowFullHistory) {
            const careLineIds = latestSession ? getSessionCareLineIds(latestSession) : [];
            const sessionGroups = careLineIds
              .map((groupId) => patientGroupsMap.get(groupId))
              .filter(Boolean) as PatientGroup[];
            const primaryColor = sessionGroups[0]?.color ? getLegacyGroupHex(sessionGroups[0].color) : undefined;

            return (
              <div className="hidden md:block space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-primary" />
                      Último Atendimento Realizado
                    </h3>
                    <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5 rounded-full">
                      {sessionView.totalCount} {sessionView.totalCount === 1 ? "atendimento" : "atendimentos"}
                    </Badge>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFullHistoryDesktop(true)}
                    className="h-8 gap-1.5 text-xs rounded-xl shadow-2xs font-medium hover:bg-accent"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Ver histórico completo ({sessionView.totalCount})</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>

                {latestSession ? (
                  <SessionCard
                    key={`desktop-latest-${latestSession.id}`}
                    baseSchema={baseSchema}
                    canViewFinancialData={canViewFinancialData}
                    creatorName={getSessionPersonLabel(profileMap.get(latestSession.user_id))}
                    creatorIsIntern={shouldShowSessionCreatorInternBadge(profileMap.get(latestSession.user_id)?.job_title)}
                    session={latestSession}
                    sessionGroups={sessionGroups}
                    shareSummary={sessionShareSummaries[latestSession.id]}
                    isSelected={false}
                    selectionMode={false}
                    borderColor={primaryColor}
                    isCompact={sessionViewMode === "compact"}
                    isExpanded={expandedSessionIds.includes(latestSession.id)}
                    onToggleExpand={() => toggleSessionExpansion(latestSession.id)}
                    onEvolve={() => setSessionToEvolve(latestSession)}
                    onLinkGroup={() => setSessionToLinkGroup(latestSession)}
                    isEvolving={evolvingSessionId === latestSession.id}
                    onPressStart={() => handleSessionPressStart(latestSession.id)}
                    onPressCancel={handleSessionPressCancel}
                    onToggleSelect={() => toggleSessionSelection(latestSession.id)}
                    onViewShareRecipients={() => setShareRecipientsSessionId(latestSession.id)}
                    navigateTo={() => handleSessionNavigate(latestSession.id)}
                    paymentPlan={latestSession.payment_plan_id ? paymentPlanMap.get(latestSession.payment_plan_id) : null}
                  />
                ) : (
                  <Card className="p-6 text-center border-dashed">
                    <Calendar className="mx-auto h-8 w-8 text-muted-foreground/60" />
                    <p className="mt-2 text-xs font-medium text-muted-foreground">
                      Este paciente ainda não possui atendimentos registrados.
                    </p>
                  </Card>
                )}

                {sessionView.totalCount > 1 && (
                  <div className="pt-1 flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFullHistoryDesktop(true)}
                      className="text-xs text-primary hover:text-primary gap-1.5 font-medium hover:bg-primary/5 rounded-lg"
                    >
                      <History className="h-3.5 w-3.5" />
                      <span>Ver histórico completo ({sessionView.totalCount} atendimentos)</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          }

          return null;
        })()}

        {/* Bloco de Busca, Filtros e Lista Completa (Desktop com Progressive Disclosure & Mobile na aba histórico) */}
        <div
          className={cn(
            "space-y-4",
            !showFullHistoryDesktop && !searchTerm.trim() && sessionStatusFilter === "all" && selectedTagFilter === "all" && "max-md:block md:hidden",
            (mobileTab === "agendar" || mobileTab === "agenda_completa") && "max-md:hidden"
          )}
        >
        {/* Desktop Filter Bar */}
        <Card className="hidden md:block">
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
                  {filterableModularItems.length > 0 && (
                    <>
                      {filterableModularItems.map((item) => (
                        <SelectItem key={item.filterKey} value={item.filterKey}>
                          {item.fieldLabel}: {item.value}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground block">Agrupamento</Label>
              <div className="flex items-center gap-3">
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
                {groupByEvolution && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Agrupar por:</span>
                    <Select value={groupByMode} onValueChange={setGroupByMode}>
                      <SelectTrigger className="h-10 min-w-[170px] bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="evolution">Evolução</SelectItem>
                        {groupableModularFields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
        {/* Barra de Filtros por Sintomas / Tags e Histórico (Ocultado no mobile se estiver na aba início ou agenda completa) */}
        <div className={cn("space-y-4", (mobileTab === "inicio" || mobileTab === "agenda_completa") && "max-md:hidden")}>
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

            {/* Ações Desktop: Recolher Histórico & Toggle Visão Detalhada / Compacta */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="hidden md:inline-flex h-7 text-xs px-2.5 gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => setShowFullHistoryDesktop(false)}
              >
                <ChevronUp className="h-3.5 w-3.5" />
                <span>Recolher histórico</span>
              </Button>

              <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border">
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
            {/* Grupos de Evolução Retráteis ou Grupos Modulares */}
            {groupByEvolution && groupByMode !== "evolution" && modularGroupedSessions ? (
              <div className="space-y-3">
                {modularGroupedSessions.groups.map((group) => {
                  const groupKey = `modular_${group.name}`;
                  const isCollapsed = collapsedModularGroupKeys.includes(groupKey);

                  return (
                    <div key={groupKey} className="rounded-2xl border bg-card shadow-xs overflow-hidden transition-all">
                      <div
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-muted/25 hover:bg-muted/40 cursor-pointer transition-colors border-b select-none"
                        onClick={() => toggleModularGroupCollapse(groupKey)}
                      >
                        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleModularGroupCollapse(groupKey);
                            }}
                          >
                            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                          </Button>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="h-3 w-3 rounded-full shrink-0 bg-primary" />
                            <h3 className="font-bold text-sm tracking-tight text-foreground truncate max-w-[280px] sm:max-w-md">
                              {group.name}
                            </h3>
                          </div>
                          <Badge variant="secondary" className="text-[11px] font-semibold px-2 py-0.5">
                            {group.count} {group.count === 1 ? "atendimento" : "atendimentos"}
                          </Badge>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="p-3 space-y-2.5 bg-background/50">
                          {group.sessions.map((session) => {
                            const careLineIds = getSessionCareLineIds(session);
                            const sessionGroups = careLineIds
                              .map((groupId) => patientGroupsMap.get(groupId))
                              .filter(Boolean) as PatientGroup[];

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
                                borderColor="var(--primary)"
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
                                paymentPlan={session.payment_plan_id ? paymentPlanMap.get(session.payment_plan_id) : null}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Atendimentos Sem este Valor Modular */}
                {modularGroupedSessions.ungrouped.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 pt-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Sem {modularGroupedSessions.fieldLabel} definido ({modularGroupedSessions.ungrouped.length})
                      </h4>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                    <div className="space-y-2.5">
                      {modularGroupedSessions.ungrouped.map((session) => {
                        const careLineIds = getSessionCareLineIds(session);
                        const sessionGroups = careLineIds
                          .map((groupId) => patientGroupsMap.get(groupId))
                          .filter(Boolean) as PatientGroup[];

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
                            paymentPlan={session.payment_plan_id ? paymentPlanMap.get(session.payment_plan_id) : null}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : groupByEvolution && sessionView.evolutionGroups.length > 0 ? (
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
                              .map((groupId) => patientGroupsMap.get(groupId))
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
                                paymentPlan={session.payment_plan_id ? paymentPlanMap.get(session.payment_plan_id) : null}
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
                          .map((groupId) => patientGroupsMap.get(groupId))
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
                            paymentPlan={session.payment_plan_id ? paymentPlanMap.get(session.payment_plan_id) : null}
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
                    .map((groupId) => patientGroupsMap.get(groupId))
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
                      paymentPlan={session.payment_plan_id ? paymentPlanMap.get(session.payment_plan_id) : null}
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
        </div>
        </div>
          </>
        )}
      </div>

      {/* Dialogs Operacionais e Clínicos do Paciente */}
      <EditEvolutionGroupDialog
        editingEvolutionGroup={editingEvolutionGroup}
        savingEvolutionGroupName={savingEvolutionGroupName}
        onClose={() => setEditingEvolutionGroup(null)}
        onChangeName={(name) => setEditingEvolutionGroup((curr) => (curr ? { ...curr, name } : null))}
        onSave={() => void handleSaveEvolutionGroupName()}
      />

      <CareLineGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        editingGroup={editingGroup}
        groupName={groupName}
        onGroupNameChange={setGroupName}
        groupComboboxOpen={groupComboboxOpen}
        onGroupComboboxOpenChange={setGroupComboboxOpen}
        groupSuggestions={groupSuggestions}
        patientGroupNameSet={patientGroupNameSet}
        existingPatientGroup={existingPatientGroup}
        existingSuggestion={existingSuggestion}
        onCreateTypedGroupName={handleCreateTypedGroupName}
        onSelectGroupSuggestion={handleSelectGroupSuggestion}
        groupStatus={groupStatus}
        onGroupStatusChange={setGroupStatus}
        groupColor={groupColor}
        groupColorSlotId={groupColorSlotId}
        resolvedClinicColorSlots={resolvedClinicColorSlots}
        onSaveClinicColorSlot={handleSaveClinicColorSlot}
        onSelectSlot={(slot) => {
          setGroupColorSlotId(slot.id);
          setGroupColor(slot.color_hex);
        }}
        savingGroup={savingGroup}
        onSaveGroup={handleSaveGroup}
      />

      <DeleteCareLineDialog
        deleteConfirmId={deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirmDelete={handleDeleteGroup}
      />

      <DeletePatientDialog
        open={deletePatientDialogOpen}
        onOpenChange={setDeletePatientDialogOpen}
        deletingPatient={deletingPatient}
        onConfirmDelete={handleDeletePatient}
      />

      <PatientRecurrenceDialog
        open={recurrenceDialogOpen}
        onOpenChange={(open) => {
          setRecurrenceDialogOpen(open);
          if (open && patient) {
            setRecurrenceEnabled(Boolean(patient.is_recurring));
            setRecurrenceWeekdays(normalizePatientRecurringWeekdays(patient.recurring_weekdays));
            setRecurrenceTime(normalizePatientRecurringTime(patient.recurring_time));
          }
        }}
        recurrenceEnabled={recurrenceEnabled}
        onRecurrenceEnabledChange={setRecurrenceEnabled}
        recurrenceWeekdays={recurrenceWeekdays}
        onToggleRecurrenceWeekday={toggleRecurrenceWeekday}
        recurrenceTime={recurrenceTime}
        onRecurrenceTimeChange={setRecurrenceTime}
        savingRecurrence={savingRecurrence}
        onSaveRecurrence={handleSaveRecurrence}
      />

      <PatientScheduleAttendanceDialog
        open={agendaDialogOpen}
        onOpenChange={setAgendaDialogOpen}
        patientName={patient?.name || ""}
        agendaDate={agendaDate}
        onAgendaDateChange={setAgendaDate}
        agendaTime={agendaTime}
        onAgendaTimeChange={setAgendaTime}
        isAgendaDialogDateTimePast={isAgendaDialogDateTimePast}
        savingAgendaEvent={savingAgendaEvent}
        onConfirmSchedule={handleSchedulePatientAgendaEvent}
      />

      <SelectedAgendaEventDialog
        selectedAgendaEvent={selectedAgendaEvent}
        onClose={() => setSelectedAgendaEvent(null)}
        patientName={patient?.name || ""}
        patientPhone={patient?.phone}
        clinicName={clinic?.name}
        selectedAgendaStatusAction={selectedAgendaStatusAction}
        onSelectAgendaStatusAction={setSelectedAgendaStatusAction}
        selectedAgendaDate={selectedAgendaDate}
        onSelectAgendaDateChange={setSelectedAgendaDate}
        selectedAgendaTime={selectedAgendaTime}
        onSelectAgendaTimeChange={setSelectedAgendaTime}
        isSelectedAgendaDateTimePast={isSelectedAgendaDateTimePast}
        savingAgendaDetails={savingAgendaDetails}
        onUpdateAgendaDateTime={handleUpdateAgendaDateTime}
        onApplyAgendaStatus={handleApplyAgendaStatus}
      />

      <AttendanceConfirmDialog
        open={attendanceConfirmDialogOpen}
        onOpenChange={setAttendanceConfirmDialogOpen}
        pendingAttendanceAgendaEvent={pendingAttendanceAgendaEvent}
        onClose={() => setAttendanceConfirmDialogOpen(false)}
        onCancelPendingAgendaEvent={handleCancelPendingAgendaEvent}
        onConfirmAttendanceWithPendingEvent={handleConfirmAttendanceWithPendingEvent}
        onStartUnscheduledAttendance={handleStartUnscheduledAttendance}
      />

      {patient && (
        <PatientInfoSummaryDialog
          open={patientInfoDialogOpen}
          onOpenChange={setPatientInfoDialogOpen}
          patient={patient}
          patientRegistrationStatus={patientRegistrationStatus}
          canViewPatientContact={canViewPatientContact}
          patientOriginDetails={patientOriginDetails}
          parsedClinicalProfile={parsedClinicalProfile}
          parsedEmergencyContact={parsedEmergencyContact}
          onViewFullRegistration={() => navigate(getPatientPath(patient || id, "resumo"))}
          onEditRegistration={() => navigate(getPatientPath(patient || id, "cadastro"))}
          onOpenShareDialog={handleOpenShareDialog}
        />
      )}

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
          void refreshSessionShareSummaries();
          if (realPatientId) {
            void invalidatePatientData(realPatientId, clinicId, ["sessions"]);
          }
        }}
        open={sessionShareDialogOpen}
        sessionCount={selectedSessionIds.length}
        sessionIds={selectedSessionIds}
      />

      <SessionShareRecipientsDialog
        open={!!shareRecipientsSessionId}
        onOpenChange={(open) => !open && setShareRecipientsSessionId(null)}
        session={shareRecipientsSession}
        shareRecipientsSummary={shareRecipientsSummary}
      />

      <LinkSessionEvolutionGroupDialog
        open={Boolean(sessionToLinkGroup)}
        onOpenChange={(open) => !open && setSessionToLinkGroup(null)}
        session={sessionToLinkGroup}
        evolutionGroupsMetadata={evolutionGroupsMetadata}
        evolutionGroupsView={sessionView.evolutionGroups}
        onLinkGroup={(s, gId) => void handleLinkSessionEvolutionGroup(s, gId)}
      />

      <EvolveSessionModal
        isOpen={Boolean(sessionToEvolve)}
        onClose={() => setSessionToEvolve(null)}
        onEvolveCopy={() => {
          if (sessionToEvolve) void handleEvolveSession(sessionToEvolve, { mode: "copy" });
        }}
        onEvolveBlank={(templateId) => {
          if (sessionToEvolve) void handleEvolveSession(sessionToEvolve, { mode: "blank", templateId });
        }}
        onStartUnlinked={(templateId) => {
          setSessionToEvolve(null);
          handleStartUnlinkedSession(templateId);
        }}
        templates={anamnesisTemplates as any}
        defaultTemplateId={sessionToEvolve?.anamnesis_template_id ?? null}
        isEvolving={Boolean(evolvingSessionId)}
      />

      <EvolveSessionModal
        isOpen={startAttendanceOptionsDialogOpen}
        onClose={() => {
          setStartAttendanceOptionsDialogOpen(false);
          setPendingAttendanceAgendaEvent(null);
        }}
        title="Iniciar Atendimento"
        description="Escolha como deseja iniciar este atendimento no histórico do paciente:"
        linkedAgendaEventDescription={
          pendingAttendanceAgendaEvent
            ? `Vinculado ao agendamento de ${formatAgendaEventDateTime(pendingAttendanceAgendaEvent.scheduled_for)}`
            : null
        }
        canEvolveFromPrevious={Boolean(latestSession)}
        onEvolveCopy={() => {
          if (latestSession) {
            setStartAttendanceOptionsDialogOpen(false);
            void handleEvolveSession(latestSession, {
              mode: "copy",
              agendaEvent: pendingAttendanceAgendaEvent,
            });
          }
        }}
        onEvolveBlank={(templateId) => {
          setStartAttendanceOptionsDialogOpen(false);
          if (latestSession) {
            void handleEvolveSession(latestSession, {
              mode: "blank",
              templateId,
              agendaEvent: pendingAttendanceAgendaEvent,
            });
          } else {
            handleStartUnlinkedSession(templateId);
          }
        }}
        onStartUnlinked={(templateId) => {
          handleStartUnlinkedSession(templateId);
        }}
        templates={anamnesisTemplates as any}
        defaultTemplateId={latestSession?.anamnesis_template_id ?? null}
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

      {/* Dossiê de Impressão do Cadastro (Renderizado sob demanda para proteção LGPD) */}
      {(showPrintRegistrationModal || isPrintingRegistration) && patient && (
        <PatientRegistrationPrintView
          patient={patient}
          clinic={clinic}
          profile={profile}
          user={user}
          clinicalProfile={parsedClinicalProfile}
          emergencyContact={parsedEmergencyContact}
        />
      )}

      {/* Modal de Confirmação & Termo LGPD de Impressão do Cadastro */}
      {patient && (
        <PrintResponsibilityModal
          isOpen={showPrintRegistrationModal}
          onConfirm={handleExecutePrintRegistration}
          onCancel={() => setShowPrintRegistrationModal(false)}
          documentTitle={`cadastro completo do paciente ${patient.name}`}
        />
      )}

      {/* Modal de Impressão do Termo de Consentimento Adulto (TCLE) */}
      <PrintAdultConsentModal
        open={showPrintAdultConsentModal}
        onOpenChange={setShowPrintAdultConsentModal}
        patient={patient}
        clinicId={clinicId}
        clinicName={clinic?.name}
      />

      {/* Modal de Impressão da Permissão dos Pais (Menor de Idade) */}
      <PrintGuardianConsentModal
        open={showPrintGuardianConsentModal}
        onOpenChange={setShowPrintGuardianConsentModal}
        patient={patient}
        clinicId={clinicId}
        clinicName={clinic?.name}
        onPrinted={() => {
          if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["patient"]);
        }}
      />

      {/* Dock Inferior Mobile com Scroll Horizontal e Gestos Touch DesignLab */}
      <PatientMobileDock
        activeTab={mobileTab}
        onTabChange={handleMobileTabChange}
        showFiles={isFeatureEnabled("storage_s3_integration")}
        showStats={isFeatureEnabled("dashboards_patient")}
      />

      {/* Bottom Sheet Mobile: Gerenciar Status do Paciente */}
      {patient && (
        <MobileStatusSheet
          open={mobileStatusSheetOpen}
          onOpenChange={setMobileStatusSheetOpen}
          patient={patient}
          onStatusChange={handlePatientStatusChange}
        />
      )}

      {/* Bottom Sheet Mobile: Termos & Documentos */}
      {patient && (
        <MobileTermsSheet
          open={mobileTermsSheetOpen}
          onOpenChange={setMobileTermsSheetOpen}
          patient={patient}
          canPrint={canPrint}
          onPrintAdultConsent={() => setShowPrintAdultConsentModal(true)}
          onPrintGuardianConsent={() => setShowPrintGuardianConsentModal(true)}
          onPrintRegistration={() => setShowPrintRegistrationModal(true)}
        />
      )}
      </motion.div>
    </PatientFilesProvider>
  );
};

export default PacienteDetalhe;
