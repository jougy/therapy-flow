import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { isSameDay } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useTelemetry } from "@/hooks/useTelemetry";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getClinicPatientPath, getPatientRouteKey } from "@/lib/patient-routing";
import { useUnifiedClinicAgenda, toRawAgendaEvent } from "@/services/clinicAgendaService";
import {
  useClinicShareCollaboratorsQuery,
  useInvalidatePatientData,
  useOptimisticPatientDetailUpdates,
  usePatientAnamnesisTemplatesQuery,
  usePatientClinicBaseSchemaQuery,
  usePatientDetailQuery,
  usePatientEvolutionGroupsQuery,
  usePatientGroupSuggestionsQuery,
  usePatientGroupsQuery,
  usePatientPaymentPlansQuery,
  usePatientSessionsQuery,
  useSessionShareSummariesQuery,
} from "@/hooks/queries/usePatientDataQueries";
import { useClinicCollaboratorsQuery, useClinicGroupColorSlotsQuery } from "@/hooks/queries/useClinicDataQueries";
import { useDocumentTemplates } from "@/components/patients/generate-document";
import type { ClinicGroupColorSlot } from "@/components/GroupColorPaletteField";
import { DEFAULT_GROUP_COLOR_SLOT_SEEDS, normalizeGroupName } from "@/lib/group-colors";
import { buildPatientAnamnesisDashboard, type PatientAnamnesisChartType } from "@/lib/patient-anamnesis-dashboard";
import { getFunctionalIndependenceLabel, getPatientRiskFlagLabel, parseClinicalProfile, parseEmergencyContact } from "@/lib/patient-clinical-profile";
import { formatPatientOriginDetails } from "@/lib/patient-origin";
import { formatPatientRecurringWeekdays, normalizePatientRecurringTime, normalizePatientRecurringWeekdays } from "@/lib/patient-recurrence";
import { buildPatientSessionsView, extractFilterableModularItems, extractModularFieldsByFlag, filterSessionsForOperationalRole, groupSessionsByModularField } from "@/lib/patient-sessions-view";
import { buildPatientOperationalSummary, getSessionBalanceCents } from "@/lib/session-operations";
import { getSessionPersonLabel } from "@/lib/session-people";
import { getSessionPreviewContent } from "@/lib/session-preview";
import type { SessionShareSummary } from "@/lib/session-sharing";
import { scheduleOfflineHydration } from "@/lib/local-first/offlineHydrator";
import { buildPatientWhatsAppHref, EMPTY_ARRAY, getAgendaEventStatus, splitClinicalAlertItems } from "../pacienteDetalheHelpers";
import type { AgendaEvent, ProfileSummary, Session } from "../pacienteDetalheTypes";
import type { PatientWorkspaceContextValue } from "./patientWorkspaceTypes";
import { usePatientAgendaActions } from "./usePatientAgendaActions";
import { usePatientCareLineActions } from "./usePatientCareLineActions";
import { usePatientProfileActions } from "./usePatientProfileActions";
import { usePatientSessionActions } from "./usePatientSessionActions";

const PatientWorkspaceContext = createContext<PatientWorkspaceContextValue | null>(null);

export function usePatientWorkspace(): PatientWorkspaceContextValue {
  const ctx = useContext(PatientWorkspaceContext);
  if (!ctx) throw new Error("usePatientWorkspace must be used within PatientWorkspaceProvider");
  return ctx;
}

export function PatientWorkspaceProvider({ children }: { children: ReactNode }) {
  const { id, clinicKey } = useParams<{ id?: string; clinicKey?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { accountRole, can, clinic, clinicId, profile, user } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const { trackDocumentPrint, trackExportJson } = useTelemetry();

  const isAccountOwner = accountRole === "account_owner" || clinic?.account_owner_user_id === user?.id;
  const targetClinicKey = clinic?.route_key || clinicKey;
  const clinicHomePath = targetClinicKey ? `/clinica/${targetClinicKey}` : "/espacopessoal";
  const effectiveClinicId = clinicId || clinic?.id || null;

  const canViewPatientContact = can("patients.read");
  const canViewFinancialData = can("treasury.manage");
  const canPrint = Boolean(can("system.print")) && isFeatureEnabled("print_general");
  const canExport = Boolean(can("patients.read") && can("system.print"));
  const canDeletePatient = can("patients.delete") || isAccountOwner;
  const canManageAllSessions = can("sessions.read_all") || can("sessions.write_others") || isAccountOwner;
  const canBulkManageSessions = canManageAllSessions || can("sessions.share") || can("session.delete_draft") || can("sessions.delete");
  const canManageForms = can("forms.read") || can("forms.manage") || isAccountOwner;

  const { data: patientQueryData, isLoading: isPatientLoading } = usePatientDetailQuery(id, clinicId);
  const patient = patientQueryData ?? null;
  const realPatientId = patient?.id;
  const loading = isPatientLoading && !patient;

  const { data: groups = EMPTY_ARRAY } = usePatientGroupsQuery(realPatientId, Boolean(realPatientId));
  const { data: allSessions = EMPTY_ARRAY } = usePatientSessionsQuery(realPatientId, Boolean(realPatientId));
  const { index: agendaIndex, refetch: refetchAgenda, optimisticUpsertEvent: optimisticUpsertAgendaEvent, optimisticDeleteEvent: optimisticDeleteAgendaEvent } =
    useUnifiedClinicAgenda(effectiveClinicId, Boolean(realPatientId));
  const { data: groupSuggestions = EMPTY_ARRAY } = usePatientGroupSuggestionsQuery(clinicId, Boolean(clinicId));
  const { data: anamnesisTemplates = EMPTY_ARRAY } = usePatientAnamnesisTemplatesQuery(clinicId, Boolean(clinicId));
  const { data: baseSchema = EMPTY_ARRAY } = usePatientClinicBaseSchemaQuery(clinicId, Boolean(clinicId));
  const { data: clinicColorSlots = EMPTY_ARRAY } = useClinicGroupColorSlotsQuery(clinicId, Boolean(clinicId));
  const { data: collaboratorProfiles = EMPTY_ARRAY } = useClinicCollaboratorsQuery(clinicId, Boolean(clinicId));
  const { data: evolutionGroupsData = EMPTY_ARRAY } = usePatientEvolutionGroupsQuery(realPatientId, Boolean(realPatientId));
  const { data: paymentPlans = EMPTY_ARRAY } = usePatientPaymentPlansQuery(realPatientId, Boolean(realPatientId));

  const allSessionIds = useMemo(() => allSessions.map((s) => s.id), [allSessions]);
  const { data: shareSummariesList = EMPTY_ARRAY } = useSessionShareSummariesQuery(allSessionIds, allSessionIds.length > 0);
  const sessionShareSummaries = useMemo(
    () => Object.fromEntries(shareSummariesList.map((s) => [s.session_id, s])) as Record<string, SessionShareSummary>,
    [shareSummariesList]
  );

  const profiles: ProfileSummary[] = collaboratorProfiles;
  const patientGroupsMap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const paymentPlanMap = useMemo(() => new Map(paymentPlans.map((p) => [p.id, p])), [paymentPlans]);
  const evolutionGroupsMetadata = useMemo(() => evolutionGroupsData.map((g) => ({ id: g.id, custom_name: g.custom_name })), [evolutionGroupsData]);
  const agendaEvents = useMemo<AgendaEvent[]>(
    () => (realPatientId ? (agendaIndex.byPatientId.get(realPatientId) ?? []).map((ev) => toRawAgendaEvent(ev) as AgendaEvent) : EMPTY_ARRAY),
    [agendaIndex.byPatientId, realPatientId]
  );

  const {
    optimisticUpdatePatientStatus, optimisticUpdatePatient, optimisticUpdateSessionStatus,
    optimisticUpsertSession, optimisticMoveSessions, optimisticMoveSessionsToEvolutionGroup, optimisticDeleteSessions,
    optimisticAddOrUpdateGroup, optimisticDeleteGroup,
  } = useOptimisticPatientDetailUpdates(realPatientId, clinicId, id);
  const invalidatePatientData = useInvalidatePatientData();

  const [mobileStatusSheetOpen, setMobileStatusSheetOpen] = useState(false);
  const [mobileTermsSheetOpen, setMobileTermsSheetOpen] = useState(false);
  const [mobileShareSheetOpen, setMobileShareSheetOpen] = useState(false);
  const [mobileFilterDrawerOpen, setMobileFilterDrawerOpen] = useState(false);

  const parsedClinicalProfile = useMemo(() => parseClinicalProfile(patient?.clinical_profile), [patient?.clinical_profile]);
  const parsedEmergencyContact = useMemo(() => parseEmergencyContact(patient?.emergency_contact), [patient?.emergency_contact]);
  const patientOriginDetails = useMemo(() => (patient ? formatPatientOriginDetails(patient) : null), [patient]);

  const profileActions = usePatientProfileActions({
    patient, realPatientId, clinicId, targetClinicKey, clinicHomePath, clinic, profile, user,
    canDeletePatient, canExport, parsedClinicalProfile, parsedEmergencyContact, navigate,
    trackDocumentPrint, trackExportJson, invalidatePatientData, optimisticUpdatePatientStatus,
  });

  const agendaActions = usePatientAgendaActions({
    patient, realPatientId, clinicId, effectiveClinicId, user, groups, agendaEvents,
    invalidatePatientData, optimisticUpdatePatient, optimisticUpsertAgendaEvent, optimisticDeleteAgendaEvent,
  });

  const { customTemplates } = useDocumentTemplates({
    open: Boolean(clinicId) && (mobileTermsSheetOpen || profileActions.showGenerateDocumentModal || profileActions.termsMenuOpen),
    clinicId,
  });

  // Normalização canônica case-insensitive preservando o sub-path atual (/atendimentos, /agenda, etc.)
  useEffect(() => {
    if (!patient || !id || !targetClinicKey) return;
    const canonicalRouteKey = getPatientRouteKey(patient);
    const sameCaseInsensitive = id.toLowerCase() === canonicalRouteKey.toLowerCase();
    if (id === canonicalRouteKey && sameCaseInsensitive) return;
    const match = location.pathname.match(/\/pacientes\/[^/]+(\/.*)?$/i);
    const subpath = match?.[1] ?? "";
    navigate(`${getClinicPatientPath(targetClinicKey, canonicalRouteKey, subpath)}${location.search}`, { replace: true });
  }, [id, location.pathname, location.search, navigate, patient, targetClinicKey]);

  useEffect(() => {
    if (patient?.name) {
      window.dispatchEvent(new CustomEvent("pluri:set-patient-title", { detail: { title: patient.name, patientKey: getPatientRouteKey(patient), id: patient.id, avatarUrl: patient.avatar_url ?? null, gender: patient.gender ?? null } }));
    }
  }, [patient]);

  useEffect(() => {
    if (!user || can("patients.read") || isAccountOwner) return;
    toast({ title: "Acesso restrito", description: "Você não possui permissão para consultar o prontuário deste paciente.", variant: "destructive" });
    navigate("/espacopessoal", { replace: true });
  }, [can, isAccountOwner, navigate, user]);

  useEffect(() => {
    if (!effectiveClinicId || !user?.id) return;
    return scheduleOfflineHydration({ clinicId: effectiveClinicId, userId: user.id });
  }, [effectiveClinicId, user?.id]);

  useEffect(() => {
    if (allSessions.length === 0 || !user?.id || can("session.delete_draft") || can("sessions.write_others") || isAccountOwner) return;
    const staleIds = allSessions
      .filter((s) => s.user_id === user.id && s.status === "rascunho" && Boolean(s.created_at) && Date.now() - new Date(s.created_at).getTime() >= 1000 * 60 * 60 * 48)
      .map((s) => s.id);
    if (staleIds.length > 0) {
      void supabase.from("sessions").update({ status: "concluído" }).in("id", staleIds).then(({ error }) => {
        if (!error) optimisticUpdateSessionStatus(staleIds, "concluído");
      });
    }
  }, [allSessions, can, isAccountOwner, optimisticUpdateSessionStatus, user?.id]);

  useEffect(() => {
    const shouldOpen = (location.state as { openShareDialog?: boolean } | null)?.openShareDialog;
    if (!shouldOpen || !patient) return;
    profileActions.handleOpenShareDialog();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, patient, profileActions]);

  const sharedSessionIds = useMemo(() => {
    if (!user?.id) return new Set<string>();
    return new Set(Object.values(sessionShareSummaries).filter((s) => s.recipients.some((r) => r.id === user.id)).map((s) => s.session_id));
  }, [sessionShareSummaries, user?.id]);

  const sessions = useMemo(
    () => filterSessionsForOperationalRole({ canReadAll: can("sessions.read_all"), currentUserId: user?.id, sharedSessionIds, sessions: allSessions }),
    [allSessions, can, sharedSessionIds, user?.id]
  );

  const resolvedClinicColorSlots = useMemo<ClinicGroupColorSlot[]>(
    () => clinicColorSlots.length > 0 ? clinicColorSlots : DEFAULT_GROUP_COLOR_SLOT_SEEDS.map((s) => ({ alpha: s.alpha, color_hex: s.colorHex, id: `seed-${s.slotIndex}`, slot_index: s.slotIndex })),
    [clinicColorSlots]
  );

  const upcomingAgendaEvent = useMemo(() => {
    const active = agendaEvents.filter((ev) => { const st = getAgendaEventStatus(ev); return st !== "cancelado" && st !== "concluido"; });
    const now = new Date();
    const nowMs = now.getTime();
    const todayEvents = active.filter((ev) => isSameDay(new Date(ev.scheduled_for), now));
    if (todayEvents.length > 0) {
      return [...todayEvents].sort((a, b) => Math.abs(new Date(a.scheduled_for).getTime() - nowMs) - Math.abs(new Date(b.scheduled_for).getTime() - nowMs))[0];
    }
    return active.filter((ev) => new Date(ev.scheduled_for).getTime() >= nowMs).sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))[0] ?? null;
  }, [agendaEvents]);

  const careLineActions = usePatientCareLineActions({
    id, realPatientId, clinicId, user, groups, groupSuggestions, clinicColorSlots,
    resolvedClinicColorSlots, queryClient, invalidatePatientData, optimisticAddOrUpdateGroup, optimisticDeleteGroup,
  });

  const sessionActions = usePatientSessionActions({
    id, patient, realPatientId, clinicId, targetClinicKey, user, groups, sessions, allSessions, upcomingAgendaEvent,
    anamnesisTemplates, canBulkManageSessions, canManageAllSessions,
    canDeleteAllSessions: can("sessions.delete") || isAccountOwner,
    canDeleteDraftSession: can("session.delete_draft"),
    navigate, queryClient, invalidatePatientData, optimisticUpdateSessionStatus, optimisticUpsertSession, optimisticMoveSessions,
    optimisticMoveSessionsToEvolutionGroup, optimisticDeleteSessions, optimisticUpsertAgendaEvent,
  });

  const { data: shareCollaborators = EMPTY_ARRAY } = useClinicShareCollaboratorsQuery(clinicId, sessionActions.sessionShareDialogOpen);

  const [searchTerm, setSearchTerm] = useState("");
  const [sessionStatusFilter, setSessionStatusFilter] = useState("all");
  const [selectedTagFilter, setSelectedTagFilter] = useState("all");
  const [sessionViewMode, setSessionViewMode] = useState<"detailed" | "compact">(() => {
    try { return window.localStorage.getItem("therapy-flow:session-view-mode") === "compact" ? "compact" : "detailed"; } catch { return "detailed"; }
  });
  const [expandedSessionIds, setExpandedSessionIds] = useState<string[]>([]);
  const [collapsedEvolutionGroupIds, setCollapsedEvolutionGroupIds] = useState<string[]>([]);
  const [groupByEvolution, setGroupByEvolution] = useState<boolean>(() => {
    try { const v = window.localStorage.getItem("therapy-flow:group-by-evolution"); return v !== null ? v === "true" : true; } catch { return true; }
  });
  const [groupByMode, setGroupByMode] = useState("evolution");
  const [collapsedModularGroupKeys, setCollapsedModularGroupKeys] = useState<string[]>([]);
  const [dashboardTemplateFilter, setDashboardTemplateFilter] = useState("all");
  const [dashboardChartPreferences, setDashboardChartPreferences] = useState<Record<string, PatientAnamnesisChartType>>({});

  const dashboardStorageKey = clinicId && id ? `therapy-flow:patient-anamnesis-dashboard:v1:${clinicId}:${id}` : null;
  useEffect(() => {
    if (!dashboardStorageKey) { setDashboardChartPreferences({}); return; }
    try {
      const parsed = JSON.parse(window.localStorage.getItem(dashboardStorageKey) ?? "{}");
      setDashboardChartPreferences(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
    } catch { setDashboardChartPreferences({}); }
  }, [dashboardStorageKey]);

  const handleSetSessionViewMode = (mode: "detailed" | "compact") => { setSessionViewMode(mode); try { window.localStorage.setItem("therapy-flow:session-view-mode", mode); } catch { /* ignore */ } };
  const handleToggleGroupByEvolution = (checked: boolean) => { setGroupByEvolution(checked); try { window.localStorage.setItem("therapy-flow:group-by-evolution", String(checked)); } catch { /* ignore */ } };
  const toggleSessionExpansion = (sid: string) => setExpandedSessionIds((c) => (c.includes(sid) ? c.filter((x) => x !== sid) : [...c, sid]));
  const toggleEvolutionGroupCollapse = (gid: string) => setCollapsedEvolutionGroupIds((c) => (c.includes(gid) ? c.filter((x) => x !== gid) : [...c, gid]));
  const toggleModularGroupCollapse = (key: string) => setCollapsedModularGroupKeys((c) => (c.includes(key) ? c.filter((x) => x !== key) : [...c, key]));
  const handleDashboardChartChange = (metricKey: string, chart: PatientAnamnesisChartType) => {
    const next = { ...dashboardChartPreferences, [metricKey]: chart };
    setDashboardChartPreferences(next);
    if (dashboardStorageKey) window.localStorage.setItem(dashboardStorageKey, JSON.stringify(next));
  };
  const getSessionSearchText = useCallback((session: Session) => {
    const p = getSessionPreviewContent(session, baseSchema);
    return [p.complaint, p.treatment, getSessionPersonLabel(profileMap.get(session.user_id))].filter(Boolean).join(" ");
  }, [baseSchema, profileMap]);
  const sessionView = useMemo(
    () => buildPatientSessionsView({ groups, sessions, filters: { searchTerm, sessionStatus: sessionStatusFilter, selectedTagId: selectedTagFilter }, evolutionGroupsMetadata, getSessionText: getSessionSearchText }),
    [evolutionGroupsMetadata, getSessionSearchText, groups, searchTerm, selectedTagFilter, sessionStatusFilter, sessions]
  );
  const groupableModularFields = useMemo(() => extractModularFieldsByFlag([baseSchema, ...anamnesisTemplates.map((t) => t.schema)], "enableGrouping"), [anamnesisTemplates, baseSchema]);
  const modularGroupedSessions = useMemo(() => {
    if (groupByMode === "evolution" || !groupByMode) return null;
    const field = groupableModularFields.find((f) => f.id === groupByMode);
    return field ? groupSessionsByModularField(sessionView.chronologicalSessions, field as never) : null;
  }, [groupByMode, groupableModularFields, sessionView.chronologicalSessions]);
  const filterableModularItems = useMemo(() => extractFilterableModularItems(sessions, extractModularFieldsByFlag([baseSchema, ...anamnesisTemplates.map((t) => t.schema)], "enableFilter")), [anamnesisTemplates, baseSchema, sessions]);
  const anamnesisDashboard = useMemo(() => buildPatientAnamnesisDashboard({ baseSchema, sessions, templates: anamnesisTemplates }), [anamnesisTemplates, baseSchema, sessions]);
  const latestSession = useMemo(() => [...sessions].sort((l, r) => new Date(r.session_date).getTime() - new Date(l.session_date).getTime())[0] ?? null, [sessions]);
  const operationalSummary = useMemo(() => buildPatientOperationalSummary(sessions), [sessions]);
  const pendingPaymentsCount = useMemo(() => {
    if (!canViewFinancialData) return 0;
    const pSessions = sessions.filter((s) => s.status !== "cancelado" && (s.payment_status === "pendente" || s.payment_status === "parcial" || getSessionBalanceCents(s) > 0)).length;
    return pSessions + paymentPlans.filter((p) => p.payment_status === "pendente" || p.payment_status === "parcial").length;
  }, [canViewFinancialData, paymentPlans, sessions]);
  const futureAgendaCount = useMemo(() => agendaEvents.filter((ev) => { const st = getAgendaEventStatus(ev); return st !== "cancelado" && st !== "concluido" && new Date(ev.scheduled_for).getTime() >= Date.now(); }).length, [agendaEvents]);
  const normGroup = normalizeGroupName(careLineActions.groupName);
  const existingPatientGroup = normGroup ? groups.find((g) => careLineActions.editingGroup?.id !== g.id && normalizeGroupName(g.name) === normGroup) : undefined;
  const existingSuggestion = normGroup ? groupSuggestions.find((s) => normalizeGroupName(s.name) === normGroup) : undefined;
  const patientGroupNameSet = useMemo(() => new Set(groups.map((g) => normalizeGroupName(g.name))), [groups]);
  const selectedShareRecipients = useMemo(() => {
    const map = new Map<string, NonNullable<SessionShareSummary["recipients"]>[number]>();
    sessionActions.selectedSessionIds.forEach((sid) => sessionShareSummaries[sid]?.recipients.forEach((r) => map.set(r.id, r)));
    return Array.from(map.values());
  }, [sessionActions.selectedSessionIds, sessionShareSummaries]);
  const recWeekdays = normalizePatientRecurringWeekdays(patient?.recurring_weekdays);
  const patientRecurrenceLabel = patient?.is_recurring && recWeekdays.length > 0 ? `${formatPatientRecurringWeekdays(recWeekdays)} · ${normalizePatientRecurringTime(patient?.recurring_time)}` : "Recorrência";

  const value: PatientWorkspaceContextValue = {
    id, patient, realPatientId, clinicId, effectiveClinicId, targetClinicKey, clinicHomePath, loading, clinic, profile, user,
    invalidatePatientData, refetchAgenda,
    isAccountOwner, canViewPatientContact, canViewFinancialData, canPrint, canExport, canDeletePatient,
    canManageAllSessions, canBulkManageSessions, canManageForms,
    groups, sessions, agendaEvents, upcomingAgendaEvent, futureAgendaCount, groupSuggestions, anamnesisTemplates, baseSchema,
    resolvedClinicColorSlots, profiles, profileMap, patientGroupsMap, evolutionGroupsMetadata, paymentPlans, paymentPlanMap,
    sessionShareSummaries, shareCollaborators, customTemplates,
    parsedClinicalProfile, parsedEmergencyContact, patientOriginDetails,
    patientRegistrationStatus: patient?.registration_complete ? "Cadastro concluído" : "Cadastro pendente",
    patientWhatsAppHref: buildPatientWhatsAppHref(patient?.phone),
    allAllergyAlertItems: [...(parsedClinicalProfile.risk_flags.includes("allergy") ? ["Alergia marcada no cadastro"] : []), ...splitClinicalAlertItems(patient?.allergies)],
    fallRiskAlertItems: [
      ...(parsedClinicalProfile.risk_flags.includes("fall_risk") ? ["Risco marcado no cadastro"] : []),
      ...splitClinicalAlertItems(parsedClinicalProfile.falls_history),
      ...(parsedClinicalProfile.functional_independence === "parcialmente_dependente" || parsedClinicalProfile.functional_independence === "dependente"
        ? [`Contexto funcional: ${getFunctionalIndependenceLabel(parsedClinicalProfile.functional_independence)}`] : []),
    ],
    structuredRiskAlertItems: parsedClinicalProfile.risk_flags.filter((r) => r !== "fall_risk" && r !== "allergy").map(getPatientRiskFlagLabel),
    latestSession, totalSessionsCount: sessions.length,
    completedSessionsCount: sessions.filter((s) => s.status === "concluído").length,
    canceledSessionsCount: sessions.filter((s) => s.status === "cancelado").length,
    operationalSummary, settledPaymentCents: Math.min(operationalSummary.paidCents, operationalSummary.chargedCents),
    pendingPaymentsCount, patientRecurrenceLabel,
    searchTerm, setSearchTerm, sessionStatusFilter, setSessionStatusFilter, selectedTagFilter, setSelectedTagFilter,
    sessionViewMode, handleSetSessionViewMode, expandedSessionIds, toggleSessionExpansion,
    collapsedEvolutionGroupIds, toggleEvolutionGroupCollapse, groupByEvolution, handleToggleGroupByEvolution,
    groupByMode, setGroupByMode, collapsedModularGroupKeys, toggleModularGroupCollapse,
    sessionView, groupableModularFields, modularGroupedSessions, filterableModularItems,
    selectedShareRecipients,
    shareRecipientsSession: sessionActions.shareRecipientsSessionId ? sessions.find((s) => s.id === sessionActions.shareRecipientsSessionId) ?? null : null,
    shareRecipientsSummary: sessionActions.shareRecipientsSessionId ? sessionShareSummaries[sessionActions.shareRecipientsSessionId] : undefined,
    anamnesisDashboard, dashboardTemplateFilter, setDashboardTemplateFilter, dashboardChartPreferences, handleDashboardChartChange,
    existingPatientGroup, existingSuggestion, patientGroupNameSet,
    mobileStatusSheetOpen, setMobileStatusSheetOpen, mobileTermsSheetOpen, setMobileTermsSheetOpen,
    mobileShareSheetOpen, setMobileShareSheetOpen, mobileFilterDrawerOpen, setMobileFilterDrawerOpen,
    ...profileActions, ...agendaActions, ...careLineActions, ...sessionActions,
  };

  return <PatientWorkspaceContext.Provider value={value}>{children}</PatientWorkspaceContext.Provider>;
}
