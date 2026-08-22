import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { motion } from "framer-motion";
import { Clock3, ChevronRight, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import AgendaWidget from "@/components/AgendaWidget";
import PatientCard from "@/components/PatientCard";
import {
  DEFAULT_HOME_PATIENT_SORT_KEY,
  DEFAULT_HOME_SESSION_SORT_KEY,
  HOME_PATIENT_SORT_OPTIONS,
  buildHomePatientViews,
  getActiveHomePatientFilterCount,
  hasActiveHomePatientFilters,
  type HomeAgendaEventRecord,
  type HomePatientAgendaFilterStatus,
  type HomePatientFilters,
  type HomePatientGroupRecord,
  type HomePatientPaymentFilterStatus,
  type HomePatientRecurrenceFilterStatus,
  type HomePatientRecord,
  type HomePatientSortKey,
  type HomeSessionRecord,
  type HomeSessionSortKey,
} from "@/lib/home-patients-view";
import { filterAndSortHomeSessions } from "@/lib/home-sessions-view";
import { PATIENT_STATUS_OPTIONS } from "@/lib/patient-statuses";
import { PATIENT_ORIGIN_OPTIONS, type PatientOriginType } from "@/lib/patient-origin";
import { AGENDA_EVENTS_UPDATED_EVENT } from "@/lib/agenda-events";
import { PATIENTS_UPDATED_EVENT } from "@/lib/patient-events";
import { formatMoneyCents, getPaymentMethodLabel, getPaymentStatusLabel, sanitizeDashboardCents } from "@/lib/session-operations";
import {
  useClinicPatientsQuery,
  useClinicSessionsSummaryQuery,
  useClinicPatientGroupsQuery,
  useClinicAgendaEventsQuery,
  useClinicCollaboratorsQuery,
  useInvalidateClinicData,
  useOptimisticSessionUpdates,
  useOptimisticPatientUpdates,
  usePrefetchPatientDetail,
} from "@/hooks/queries/useClinicDataQueries";
import { PatientSearchToolbar, type HomeListMode } from "@/components/home/PatientSearchToolbar";
import { PatientFilterDialog } from "@/components/home/PatientFilterDialog";
import { HomeSessionsBulkActionBar } from "@/components/home/HomeSessionsBulkActionBar";
import { HomeMobileDock } from "@/components/home/HomeMobileDock";
import { HomeDashboardModal } from "@/components/home/HomeDashboardModal";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const PatientCardSkeleton = () => (
  <Card className="p-4 select-none">
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-40 rounded bg-muted animate-pulse" />
          <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-3 w-28 rounded bg-muted/60 animate-pulse" />
          <div className="h-3 w-32 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-5 w-20 rounded-full bg-muted/40 animate-pulse" />
          <div className="h-5 w-24 rounded-full bg-muted/40 animate-pulse" />
        </div>
      </div>
      <div className="h-4 w-4 rounded bg-muted animate-pulse ml-4" />
    </div>
  </Card>
);

const Index = () => {
  const { can, clinicId, user } = useAuth();
  const { isFeatureEnabled, flags } = useFeatureFlags();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const deletedPatientId =
    typeof (location.state as { deletedPatientId?: unknown } | null)?.deletedPatientId === "string"
      ? (location.state as { deletedPatientId: string }).deletedPatientId
      : null;

  // React Query hooks with client-first caching & delta sync
  const { data: rawPatients = [], isLoading: loadingPatients } = useClinicPatientsQuery(clinicId, Boolean(user));
  const patients = useMemo(() => {
    if (!deletedPatientId) return rawPatients;
    return rawPatients.filter((patient) => patient.id !== deletedPatientId);
  }, [rawPatients, deletedPatientId]);

  const { data: patientGroups = [] } = useClinicPatientGroupsQuery(clinicId, Boolean(user));
  const { data: collaborators = [] } = useClinicCollaboratorsQuery(clinicId, Boolean(user));
  const { data: sessions = [] } = useClinicSessionsSummaryQuery(clinicId, Boolean(user));
  const { data: agendaEvents = [] } = useClinicAgendaEventsQuery(clinicId, Boolean(user));

  const invalidateClinicData = useInvalidateClinicData();
  const { optimisticMoveSessions, optimisticUpdateStatus, optimisticDeleteSessions } = useOptimisticSessionUpdates(clinicId);
  const { optimisticRemovePatient } = useOptimisticPatientUpdates(clinicId);
  const prefetchPatient = usePrefetchPatientDetail(clinicId);

  // Search & Filter States
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [selectedAgendaStatuses, setSelectedAgendaStatuses] = useState<HomePatientAgendaFilterStatus[]>([]);
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<HomePatientPaymentFilterStatus[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedGroupNames, setSelectedGroupNames] = useState<string[]>([]);
  const [selectedOriginTypes, setSelectedOriginTypes] = useState<PatientOriginType[]>([]);
  const [selectedRecurrenceStatuses, setSelectedRecurrenceStatuses] = useState<HomePatientRecurrenceFilterStatus[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedCollaboratorIds, setSelectedCollaboratorIds] = useState<string[]>([]);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [selectedRecurringWeekdays, setSelectedRecurringWeekdays] = useState<number[]>([]);
  const [sessionDateFrom, setSessionDateFrom] = useState("");
  const [sessionDateTo, setSessionDateTo] = useState("");
  const [sortKey, setSortKey] = useState<HomePatientSortKey>(DEFAULT_HOME_PATIENT_SORT_KEY);
  const [sessionSortKey, setSessionSortKey] = useState<HomeSessionSortKey>(DEFAULT_HOME_SESSION_SORT_KEY);
  const [listMode, setListMode] = useState<HomeListMode>("patients");

  // Modal Dialog States
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [agendaDialogOpen, setAgendaDialogOpen] = useState(false);
  const [dashboardDialogOpen, setDashboardDialogOpen] = useState(false);
  const [mobileSearchFocused, setMobileSearchFocused] = useState(false);
  const [toolbarFixed, setToolbarFixed] = useState(false);

  // Bulk Selection for Sessions
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const selectionMode = selectedSessionIds.length > 0;

  // Refs for scroll and long-press interactions
  const sessionLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressOccurredRef = useRef(false);
  const toolbarSentinelRef = useRef<HTMLDivElement | null>(null);
  const toolbarPlaceholderRef = useRef<HTMLDivElement | null>(null);
  const toolbarStartTopRef = useRef<number | null>(null);

  const hasClinicSessionsList = isFeatureEnabled("clinic_sessions_list");
  const clinicSessionsListConfig = flags["clinic_sessions_list"] || {};
  const canUseBulkSelection = hasClinicSessionsList && clinicSessionsListConfig.bulk_selection !== false;
  const canViewFinancialData = can("treasury.manage");

  useEffect(() => {
    if (!hasClinicSessionsList && listMode === "sessions") {
      setListMode("patients");
    }
  }, [hasClinicSessionsList, listMode]);

  // Handle deleted patient from navigation state optimistically
  useEffect(() => {
    if (!deletedPatientId || !clinicId) return;
    optimisticRemovePatient(deletedPatientId);
  }, [clinicId, deletedPatientId, optimisticRemovePatient]);

  // Global Keyboard Shortcuts (Cmd+K, /, N, Esc)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInputActive =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        Boolean(target?.closest("[role='dialog']"));

      // Cmd+K / Ctrl+K or '/' -> Focus search
      if (
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") ||
        (event.key === "/" && !isInputActive)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // 'N' outside of any active input -> Navigate to new patient
      if (event.key.toLowerCase() === "n" && !isInputActive && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        navigate("/pacientes/novo");
        return;
      }

      // 'Escape' -> Clear search or blur input
      if (event.key === "Escape") {
        if (document.activeElement === searchInputRef.current) {
          if (search) {
            setSearch("");
          } else {
            searchInputRef.current?.blur();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, search]);

  // Targeted Event Listeners (Zero full-table re-fetch)
  useEffect(() => {
    if (!clinicId) return;

    const handleAgendaUpdated = () => {
      void invalidateClinicData(clinicId, ["agenda"]);
    };

    const handlePatientsUpdated = () => {
      void invalidateClinicData(clinicId, ["patients"]);
    };

    window.addEventListener(AGENDA_EVENTS_UPDATED_EVENT, handleAgendaUpdated);
    window.addEventListener(PATIENTS_UPDATED_EVENT, handlePatientsUpdated);

    return () => {
      window.removeEventListener(AGENDA_EVENTS_UPDATED_EVENT, handleAgendaUpdated);
      window.removeEventListener(PATIENTS_UPDATED_EVENT, handlePatientsUpdated);
    };
  }, [clinicId, invalidateClinicData]);

  // Highly-optimized scroll listener with requestAnimationFrame
  useEffect(() => {
    let ticking = false;

    const measureToolbarStart = () => {
      if (!toolbarSentinelRef.current) return;
      toolbarStartTopRef.current = toolbarSentinelRef.current.getBoundingClientRect().top + window.scrollY;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (toolbarStartTopRef.current === null) {
            measureToolbarStart();
          }
          const shouldFix = window.scrollY > (toolbarStartTopRef.current ?? Number.POSITIVE_INFINITY);
          setToolbarFixed(shouldFix);
          ticking = false;
        });
        ticking = true;
      }
    };

    measureToolbarStart();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", measureToolbarStart);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", measureToolbarStart);
    };
  }, []);

  // Selection callbacks
  const toggleSessionSelection = useCallback(
    (sessionId: string) => {
      if (!canUseBulkSelection) return;
      setSelectedSessionIds((current) =>
        current.includes(sessionId) ? current.filter((id) => id !== sessionId) : [...current, sessionId]
      );
    },
    [canUseBulkSelection]
  );

  const handleSessionPressStart = useCallback(
    (sessionId: string) => {
      if (!canUseBulkSelection) return;
      if (sessionLongPressTimerRef.current) clearTimeout(sessionLongPressTimerRef.current);
      sessionLongPressTimerRef.current = setTimeout(() => {
        longPressOccurredRef.current = true;
        setSelectedSessionIds((current) => (!current.includes(sessionId) ? [...current, sessionId] : current));
        if (window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(50);
        }
      }, 500);
    },
    [canUseBulkSelection]
  );

  const handleSessionPressCancel = useCallback(() => {
    if (sessionLongPressTimerRef.current) {
      clearTimeout(sessionLongPressTimerRef.current);
      sessionLongPressTimerRef.current = null;
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSessionIds([]);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedStatuses([]);
    setSelectedAgendaStatuses([]);
    setSelectedPaymentStatuses([]);
    setSelectedRecurrenceStatuses([]);
    setSelectedRecurringWeekdays([]);
    setSelectedGroupNames([]);
    setSelectedOriginTypes([]);
    setSelectedColors([]);
    setSelectedCollaboratorIds([]);
    setSelectedWeekdays([]);
    setSessionDateFrom("");
    setSessionDateTo("");
  }, []);

  // Filter structures (using deferredSearch for zero typing latency)
  const filters: HomePatientFilters = useMemo(
    () => ({
      agendaStatuses: selectedAgendaStatuses,
      collaboratorIds: selectedCollaboratorIds,
      colors: selectedColors,
      groupNames: selectedGroupNames,
      originTypes: selectedOriginTypes,
      paymentStatuses: selectedPaymentStatuses,
      recurrenceStatuses: selectedRecurrenceStatuses,
      recurringWeekdays: selectedRecurringWeekdays,
      searchTerm: deferredSearch,
      sessionDateFrom,
      sessionDateTo,
      statuses: selectedStatuses,
      weekdays: selectedWeekdays,
    }),
    [
      selectedAgendaStatuses,
      selectedCollaboratorIds,
      selectedColors,
      selectedGroupNames,
      selectedOriginTypes,
      selectedPaymentStatuses,
      selectedRecurrenceStatuses,
      selectedRecurringWeekdays,
      deferredSearch,
      sessionDateFrom,
      sessionDateTo,
      selectedStatuses,
      selectedWeekdays,
    ]
  );

  const activeFilterCount = useMemo(() => getActiveHomePatientFilterCount(filters), [filters]);
  const filtersAreActive = useMemo(() => hasActiveHomePatientFilters(filters), [filters]);
  const isShowingPatientList = deferredSearch.trim().length > 0 || filtersAreActive || sortKey !== DEFAULT_HOME_PATIENT_SORT_KEY;

  // Memoized ID lookup maps
  const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const groupById = useMemo(
    () => new Map(patientGroups.filter((g) => g.id).map((g) => [g.id as string, g])),
    [patientGroups]
  );
  const patientGroupsByPatientId = useMemo(() => {
    const map = new Map<string, HomePatientGroupRecord[]>();
    patientGroups.forEach((group) => {
      map.set(group.patient_id, [...(map.get(group.patient_id) ?? []), group]);
    });
    return map;
  }, [patientGroups]);

  // Memoized Patient Views
  const visiblePatients = useMemo(
    () =>
      buildHomePatientViews({
        agendaEvents,
        filters,
        patientGroups,
        patients,
        sessions,
        sortKey,
        showFinancialData: canViewFinancialData,
      }),
    [agendaEvents, filters, patientGroups, patients, sessions, sortKey, canViewFinancialData]
  );

  const recentPatients = useMemo(
    () =>
      buildHomePatientViews({
        agendaEvents,
        filters: {
          collaboratorIds: [],
          agendaStatuses: [],
          colors: [],
          groupNames: [],
          originTypes: [],
          paymentStatuses: [],
          recurrenceStatuses: [],
          recurringWeekdays: [],
          searchTerm: "",
          sessionDateFrom: "",
          sessionDateTo: "",
          statuses: [],
          weekdays: [],
        },
        patientGroups,
        patients,
        sessions,
        sortKey: DEFAULT_HOME_PATIENT_SORT_KEY,
        showFinancialData: canViewFinancialData,
      }),
    [agendaEvents, patientGroups, patients, sessions, canViewFinancialData]
  );

  // Memoized Sessions Views
  const sessionFilters = useMemo(
    () => ({
      searchTerm: deferredSearch,
      selectedStatuses,
      selectedOriginTypes,
      selectedRecurrenceStatuses,
      selectedRecurringWeekdays,
      selectedCollaboratorIds,
      selectedGroupNames,
      selectedColors,
      selectedPaymentStatuses,
      sessionDateFrom,
      sessionDateTo,
      selectedWeekdays,
    }),
    [
      deferredSearch,
      selectedStatuses,
      selectedOriginTypes,
      selectedRecurrenceStatuses,
      selectedRecurringWeekdays,
      selectedCollaboratorIds,
      selectedGroupNames,
      selectedColors,
      selectedPaymentStatuses,
      sessionDateFrom,
      sessionDateTo,
      selectedWeekdays,
    ]
  );

  const visibleSessions = useMemo(
    () =>
      filterAndSortHomeSessions({
        sessions,
        patientById,
        groupById,
        patientGroupsByPatientId,
        filters: sessionFilters,
        sortKey: sessionSortKey,
        canViewFinancialData,
      }),
    [sessions, patientById, groupById, patientGroupsByPatientId, sessionFilters, sessionSortKey, canViewFinancialData]
  );

  const selectedPatientSortLabel =
    HOME_PATIENT_SORT_OPTIONS.find((option) => option.value === sortKey)?.label ?? "Pacientes recentes";

  // Optimistic Bulk Handlers (0ms perceived latency, no server re-fetch)
  const handleBulkMove = async (nextGroupId: string) => {
    if (selectedSessionIds.length === 0) return;
    const targetGroupId = nextGroupId === "none" ? null : nextGroupId;
    const ids = [...selectedSessionIds];
    setBulkUpdating(true);

    optimisticMoveSessions(ids, targetGroupId);
    clearSelection();

    const { error } = await supabase.from("sessions").update({ group_id: targetGroupId }).in("id", ids);

    setBulkUpdating(false);
    if (error) {
      toast({ title: "Erro ao mover atendimentos", description: error.message, variant: "destructive" });
      if (clinicId) void invalidateClinicData(clinicId, ["sessions"]);
    } else {
      toast({ title: "Atendimentos movidos" });
    }
  };

  const handleBulkStatusUpdate = async (nextStatus: string) => {
    if (selectedSessionIds.length === 0) return;
    const ids = [...selectedSessionIds];
    setBulkUpdating(true);

    optimisticUpdateStatus(ids, nextStatus);
    clearSelection();

    const { error } = await supabase.from("sessions").update({ status: nextStatus }).in("id", ids);

    setBulkUpdating(false);
    if (error) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
      if (clinicId) void invalidateClinicData(clinicId, ["sessions"]);
    } else {
      toast({ title: "Status dos atendimentos atualizado" });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSessionIds.length === 0) return;
    const ids = [...selectedSessionIds];
    setBulkUpdating(true);

    optimisticDeleteSessions(ids);
    clearSelection();

    const { error } = await supabase.from("sessions").delete().in("id", ids);

    setBulkUpdating(false);
    if (error) {
      toast({ title: "Erro ao excluir atendimentos", description: error.message, variant: "destructive" });
      if (clinicId) void invalidateClinicData(clinicId, ["sessions"]);
    } else {
      toast({ title: "Atendimentos excluídos" });
    }
  };

  // Render individual session card
  const renderSessionCard = (session: HomeSessionRecord) => {
    const patient = patientById.get(session.patient_id);
    const group = session.group_id ? groupById.get(session.group_id) : null;
    const patientGroupsForSession = patientGroupsByPatientId.get(session.patient_id) ?? [];
    const fallbackGroup = patientGroupsForSession[0] ?? null;
    const charged = sanitizeDashboardCents(session.amount_charged_cents);
    const paid = sanitizeDashboardCents(session.amount_paid_cents);
    const balance = Math.max(0, charged - paid);
    const credit = Math.max(0, paid - charged);
    const sessionPath = `/pacientes/${session.patient_id}/sessao/${session.id}`;
    const patientPath = `/pacientes/${session.patient_id}`;
    const isSelected = selectedSessionIds.includes(session.id);

    return (
      <Card
        key={session.id}
        className={`cursor-pointer select-none p-4 transition-shadow duration-150 hover:shadow-md ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
        onClick={() => {
          if (longPressOccurredRef.current) {
            longPressOccurredRef.current = false;
            return;
          }
          if (selectionMode) {
            toggleSessionSelection(session.id);
          } else {
            navigate(sessionPath);
          }
        }}
        onPointerDown={(e) => {
          if (selectionMode || (e.button !== undefined && e.button !== 0)) return;
          touchStartPosRef.current = { x: e.clientX, y: e.clientY };
          handleSessionPressStart(session.id);
        }}
        onPointerMove={(e) => {
          if (selectionMode || !touchStartPosRef.current) return;
          const dx = Math.abs(e.clientX - touchStartPosRef.current.x);
          const dy = Math.abs(e.clientY - touchStartPosRef.current.y);
          if (dx > 10 || dy > 10) {
            touchStartPosRef.current = null;
            handleSessionPressCancel();
          }
        }}
        onPointerUp={() => {
          touchStartPosRef.current = null;
          if (!selectionMode) handleSessionPressCancel();
        }}
        onPointerCancel={() => {
          touchStartPosRef.current = null;
          if (!selectionMode) handleSessionPressCancel();
        }}
        onContextMenu={(e) => {
          if (canUseBulkSelection && !selectionMode) {
            e.preventDefault();
            longPressOccurredRef.current = true;
            touchStartPosRef.current = null;
            setSelectedSessionIds([session.id]);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Abrir atendimento de ${patient?.name ?? "paciente sem nome"}`}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (selectionMode) {
              toggleSessionSelection(session.id);
            } else {
              navigate(sessionPath);
            }
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{formatDateTime(session.session_date)}</span>
              <Badge variant="outline" className="capitalize">
                {session.status || "sem status"}
              </Badge>
              {selectionMode && (
                <Badge variant={isSelected ? "default" : "outline"} className="text-xs">
                  {isSelected ? "Selecionado" : "Toque para selecionar"}
                </Badge>
              )}
              {group || fallbackGroup ? (
                <Badge variant="secondary" className="max-w-[180px] gap-1.5 truncate text-muted-foreground">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: (group ?? fallbackGroup)?.color }}
                  />
                  {(group ?? fallbackGroup)?.name}
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <button
                type="button"
                className="font-medium text-foreground hover:underline"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(patientPath);
                }}
              >
                {patient?.name ?? "Paciente não encontrado"}
              </button>
              <span>{getPaymentMethodLabel(session.payment_method)}</span>
              {canViewFinancialData && <span>{getPaymentStatusLabel(session.payment_status)}</span>}
            </div>
            {canViewFinancialData && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Cobrado {formatMoneyCents(charged)}</span>
                <span>Pago {formatMoneyCents(paid)}</span>
                {balance > 0 ? <span className="text-destructive">Em aberto {formatMoneyCents(balance)}</span> : null}
                {credit > 0 ? <span className="text-primary">Crédito {formatMoneyCents(credit)}</span> : null}
              </div>
            )}
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </Card>
    );
  };

  // Progressive loading: Elegant Skeletons on cold load (cache empty)
  if (loadingPatients && patients.length === 0) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl space-y-4 pb-20 md:space-y-6 md:pb-0">
        <div className="rounded-2xl border border-border/60 bg-background/95 p-2.5 shadow-sm md:rounded-xl md:p-3">
          <div className="h-10 w-full rounded-xl bg-muted/60 animate-pulse" />
        </div>
        <div className="space-y-3">
          <PatientCardSkeleton />
          <PatientCardSkeleton />
          <PatientCardSkeleton />
          <PatientCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto w-full max-w-screen-2xl space-y-4 pb-20 md:space-y-6 md:pb-0"
    >
      <div ref={toolbarSentinelRef} aria-hidden="true" className="h-0" />
      <div
        ref={toolbarPlaceholderRef}
        aria-hidden="true"
        className={toolbarFixed ? "block h-[64px] md:h-[62px]" : "hidden"}
      />
      <div
        className={
          toolbarFixed
            ? "!mt-0 fixed left-0 right-0 top-0 z-30 border-b border-border/60 bg-background/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85 md:px-6"
            : "rounded-2xl border border-border/60 bg-background/95 p-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85 md:rounded-xl md:p-3"
        }
      >
        <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
          <PatientSearchToolbar
            searchInputRef={searchInputRef}
            listMode={listMode}
            onListModeChange={setListMode}
            hasClinicSessionsList={hasClinicSessionsList}
            search={search}
            onSearchChange={setSearch}
            activeFilterCount={activeFilterCount}
            sortKey={sortKey}
            onSortKeyChange={setSortKey}
            sessionSortKey={sessionSortKey}
            onSessionSortKeyChange={setSessionSortKey}
            onOpenNewPatient={() => navigate("/pacientes/novo")}
            onOpenAgenda={() => setAgendaDialogOpen(true)}
            onOpenDashboard={() => setDashboardDialogOpen(true)}
            canViewFinancialData={canViewFinancialData}
            showGeneralDashboard={isFeatureEnabled("dashboards_general")}
            mobileSearchFocused={mobileSearchFocused}
            onMobileSearchFocusChange={setMobileSearchFocused}
          />

          <PatientFilterDialog
            canViewFinancialData={canViewFinancialData}
            patientGroups={patientGroups}
            collaborators={collaborators}
            selectedStatuses={selectedStatuses}
            onSelectedStatusesChange={setSelectedStatuses}
            selectedOriginTypes={selectedOriginTypes}
            onSelectedOriginTypesChange={setSelectedOriginTypes}
            selectedPaymentStatuses={selectedPaymentStatuses}
            onSelectedPaymentStatusesChange={setSelectedPaymentStatuses}
            selectedAgendaStatuses={selectedAgendaStatuses}
            onSelectedAgendaStatusesChange={setSelectedAgendaStatuses}
            selectedRecurrenceStatuses={selectedRecurrenceStatuses}
            onSelectedRecurrenceStatusesChange={setSelectedRecurrenceStatuses}
            selectedRecurringWeekdays={selectedRecurringWeekdays}
            onSelectedRecurringWeekdaysChange={setSelectedRecurringWeekdays}
            selectedGroupNames={selectedGroupNames}
            onSelectedGroupNamesChange={setSelectedGroupNames}
            selectedColors={selectedColors}
            onSelectedColorsChange={setSelectedColors}
            selectedCollaboratorIds={selectedCollaboratorIds}
            onSelectedCollaboratorIdsChange={setSelectedCollaboratorIds}
            sessionDateFrom={sessionDateFrom}
            onSessionDateFromChange={setSessionDateFrom}
            sessionDateTo={sessionDateTo}
            onSessionDateToChange={setSessionDateTo}
            selectedWeekdays={selectedWeekdays}
            onSelectedWeekdaysChange={setSelectedWeekdays}
            onClearFilters={clearFilters}
            onApplyFilters={() => setFilterDialogOpen(false)}
          />
        </Dialog>

        {/* Agenda Dialog */}
        <Dialog open={agendaDialogOpen} onOpenChange={setAgendaDialogOpen}>
          <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
            <DialogHeader className="text-left">
              <DialogTitle>Agenda</DialogTitle>
              <DialogDescription>Veja e gerencie os agendamentos da clínica.</DialogDescription>
            </DialogHeader>
            <AgendaWidget />
          </DialogContent>
        </Dialog>

        {/* Dashboard Modal */}
        {canViewFinancialData && isFeatureEnabled("dashboards_general") && (
          <HomeDashboardModal
            open={dashboardDialogOpen}
            onOpenChange={setDashboardDialogOpen}
            patients={patients}
            sessions={sessions}
            agendaEvents={agendaEvents}
            onNavigateForms={() => navigate("configuracoes?secao=forms")}
            onNavigateDashboard={() => navigate("dashboard")}
          />
        )}
      </div>

      {/* Mobile Dock Navigation */}
      <HomeMobileDock
        listMode={listMode}
        onListModeChange={setListMode}
        hasClinicSessionsList={hasClinicSessionsList}
        canViewFinancialData={canViewFinancialData}
        onOpenNewPatient={() => navigate("/pacientes/novo")}
        onOpenAgenda={() => setAgendaDialogOpen(true)}
        onOpenDashboard={() => setDashboardDialogOpen(true)}
      />

      {/* Active Filter Badges */}
      {filtersAreActive && (
        <div className="flex items-center gap-2 flex-wrap">
          {selectedGroupNames.length > 0 && (
            <Badge variant="secondary">Grupos: {selectedGroupNames.join(", ")}</Badge>
          )}
          {selectedColors.length > 0 && (
            <Badge variant="secondary">Cores: {selectedColors.join(", ")}</Badge>
          )}
          {selectedCollaboratorIds.length > 0 && (
            <Badge variant="secondary">
              Colaborador:{" "}
              {selectedCollaboratorIds
                .map(
                  (id) =>
                    collaborators.find((c) => c.id === id)?.full_name ??
                    collaborators.find((c) => c.id === id)?.email ??
                    id
                )
                .join(", ")}
            </Badge>
          )}
          {selectedStatuses.length > 0 && (
            <Badge variant="secondary">
              Status:{" "}
              {selectedStatuses
                .map((status) => PATIENT_STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status)
                .join(", ")}
            </Badge>
          )}
          {selectedOriginTypes.length > 0 && (
            <Badge variant="secondary">
              Origem:{" "}
              {PATIENT_ORIGIN_OPTIONS.filter((opt) => selectedOriginTypes.includes(opt.value))
                .map((opt) => opt.label)
                .join(", ")}
            </Badge>
          )}
          {selectedPaymentStatuses.length > 0 && (
            <Badge variant="secondary">
              Pagamento: {selectedPaymentStatuses.join(", ")}
            </Badge>
          )}
          {selectedAgendaStatuses.length > 0 && (
            <Badge variant="secondary">
              Agendamento: {selectedAgendaStatuses.join(", ")}
            </Badge>
          )}
          {selectedRecurrenceStatuses.length > 0 && (
            <Badge variant="secondary">
              Recorrência: {selectedRecurrenceStatuses.join(", ")}
            </Badge>
          )}
          {selectedRecurringWeekdays.length > 0 && (
            <Badge variant="secondary">
              Dias recorrentes: {selectedRecurringWeekdays.join(", ")}
            </Badge>
          )}
          {(sessionDateFrom || sessionDateTo) && (
            <Badge variant="secondary">
              Período: {sessionDateFrom || "início"} até {sessionDateTo || "hoje"}
            </Badge>
          )}
          {selectedWeekdays.length > 0 && (
            <Badge variant="secondary">
              Dias dos atendimentos: {selectedWeekdays.join(", ")}
            </Badge>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4" />
            Limpar filtros
          </Button>
        </div>
      )}

      {/* Main Content Area: Sessions Mode or Patients Mode */}
      {listMode === "sessions" ? (
        <div className="space-y-3">
          <HomeSessionsBulkActionBar
            selectedSessionIds={selectedSessionIds}
            patientGroups={patientGroups}
            bulkUpdating={bulkUpdating}
            onBulkMove={handleBulkMove}
            onBulkStatusUpdate={handleBulkStatusUpdate}
            onBulkDelete={handleBulkDelete}
            onClearSelection={clearSelection}
          />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Atendimentos</h2>
            <p className="text-sm text-muted-foreground">
              {visibleSessions.length} atendimento{visibleSessions.length !== 1 ? "s" : ""} encontrado
              {visibleSessions.length !== 1 ? "s" : ""}
            </p>
          </div>
          {visibleSessions.map((session) => (
            <motion.div key={session.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
              {renderSessionCard(session)}
            </motion.div>
          ))}
          {visibleSessions.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Nenhum atendimento encontrado.</p>
            </Card>
          )}
        </div>
      ) : isShowingPatientList ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">{selectedPatientSortLabel}</h2>
            <p className="text-sm text-muted-foreground">
              {visiblePatients.length} paciente{visiblePatients.length !== 1 ? "s" : ""} encontrado
              {visiblePatients.length !== 1 ? "s" : ""}
            </p>
          </div>
          {visiblePatients.map((patient, index) => (
            <motion.div
              key={patient.id}
              {...(index === 0 ? { "data-tutorial": "patient-card-first" } : {})}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
            >
              <PatientCard patient={patient} onPrefetch={prefetchPatient} />
            </motion.div>
          ))}
          {visiblePatients.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum paciente encontrado.</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {recentPatients.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-muted-foreground">Pacientes recentes</h2>
                <p className="text-sm text-muted-foreground">
                  {recentPatients.length} paciente{recentPatients.length !== 1 ? "s" : ""} encontrado
                  {recentPatients.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="space-y-2">
                {recentPatients.map((patient, index) => (
                  <div key={patient.id} {...(index === 0 ? { "data-tutorial": "patient-card-first" } : {})}>
                    <PatientCard patient={patient} onPrefetch={prefetchPatient} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {recentPatients.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Nenhum paciente cadastrado ainda.</p>
              <Button className="mt-4" onClick={() => navigate("/pacientes/novo")}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar primeiro paciente
              </Button>
            </Card>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default Index;
