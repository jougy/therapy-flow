import { motion } from "framer-motion";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getActiveBrand } from "@/hooks/useActiveBrand";
import { Info, Loader2, FileText, CheckCircle2, Layers, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DEFAULT_GROUP_COLOR_SLOT_SEEDS, normalizeGroupName } from "@/lib/group-colors";
import { INPUT_LIMITS, sanitizeSingleLineInput } from "@/lib/input-security";
import { Textarea } from "@/components/ui/textarea";
import { ClinicalSpellcheckTextarea } from "@/components/spellcheck";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { SessionShareDialog } from "@/components/SessionShareDialog";
import { PatientFilesPanel } from "@/components/PatientFilesPanel";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { PatientFilesProvider } from "@/contexts/PatientFilesContext";
import { detectSuggestedCareLine } from "@/lib/care-lines-classifier";
import { getSessionDraft, saveSessionDraft, clearSessionDraft } from "@/lib/session-draft";
import {
  DEFAULT_PAYMENT_PLAN_FORM_VALUES,
  calculateSessionUnitAmountCents,
  generatePlanScheduleDates,
  type PatientPaymentPlanRow,
  type PaymentPlanFormValues,
} from "@/lib/payment-plans";
import { useState, useEffect, useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useClinicPlanQuota } from "@/hooks/useClinicPlanQuota";
import { TrialReadOnlyModal } from "@/components/TrialReadOnlyModal";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { toast } from "@/hooks/use-toast";
import { notifySessionCompletedFeedback } from "@/hooks/useFeedbackTrigger";
import {
  getClinicPatientPath,
  getClinicPatientSessionPath,
  isUuid,
  type SessionRow,
} from "@/lib/patient-routing";
import {
  useInvalidatePatientData,
  useOptimisticPatientDetailUpdates,
} from "@/hooks/queries/usePatientDataQueries";
import { enqueueOfflineMutation } from "@/lib/local-first/offlineMutationQueue";
import { ToastAction } from "@/components/ui/toast";
import { createTrashToastAction } from "@/lib/trashUtils";
import { readBusinessHours } from "@/lib/clinic-settings";
import { readProfileAddress } from "@/lib/profile-settings";
import {
  buildSessionPayload,
  extractDashboardCareLineItems,
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
  getArrivalDelayMinutes,
  getPaymentAdjustmentCents,
  getPaymentAdjustmentPercent,
  getSessionOriginalAmountCents,
  hasPaymentAdjustment,
  normalizeSessionPaymentStatus,
  normalizePaymentInstallments,
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
import { buildSessionEditHistoryView, getSessionPersonLabel } from "@/lib/session-people";
import { formatTreatmentSummary, readTreatmentState, type TreatmentBlock } from "@/lib/session-treatment";
import { getSessionPreviewIndicators, getSessionSummaryContent } from "@/lib/session-preview";
import { shouldAutoCompleteInternDraft } from "@/lib/patient-sessions-view";
import { notifyAgendaEventsUpdated } from "@/lib/agenda-events";
import { FieldLabelWithHelp } from "@/components/anamnesis/FieldLabelWithHelp";
import {
  buildTemplateLayout,
  getVisibleTemplateFields,
  type AnamnesisField,
  type AnamnesisFormResponse,
} from "@/lib/anamnesis-forms";
import {
  formatAddressLine,
  formatArrivalDeltaLabel,
  formatCnpj,
  getErrorDetails,
  getPatientAvailableCreditCents,
  isJsonObject,
  normalizePaymentMethod,
  readJsonRecord,
  readJsonString,
  readTemplateSchema,
  EvolveSessionModal,
  ScaleIndicator,
  SessionAnamnesisRuntime,
  SessionHeaderBar,
  SessionPaymentSection,
  SessionPrintDocumentsModal,
  SessionQuickEditModals,
  SessionReadOnlyOverview,
  SessionTreatmentFields,
  SessionFloatingActionPills,
  type ErrorDetails,
  type PatientGroup,
} from "@/components/sessions";
import { GenerateDocumentModal } from "@/components/patients/GenerateDocumentModal";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import {
  SessaoDetalheSkeleton,
  SessionBaseSliderSection,
  SessionComplementaryFormsBlock,
  SessionConductNotes,
  SessionErrorDialog,
  SessionLeaveConfirmDialog,
  SessionPresenceCard,
  useSessionDetailData,
} from "@/pages/sessao-detalhe";

const SessaoDetalhe = () => {
  const { id: patientId, sessionId, clinicKey } = useParams<{ id: string; sessionId: string; clinicKey?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { accountRole, can, user, clinic, clinicId, operationalRole, profile } = useAuth();
  const isAccountOwner = accountRole === "account_owner" || clinic?.account_owner_user_id === user?.id;
  const quota = useClinicPlanQuota(clinicId);
  const targetClinicKey = clinic?.route_key || clinicKey;
  const clinicHomePath = targetClinicKey ? `/clinica/${targetClinicKey}` : "/espacopessoal";
  const isNew = sessionId === "novo";
  const newSessionState = location.state as { agendaEventId?: string; scheduledFor?: string; autoArrival?: boolean } | null;

  const [saving, setSaving] = useState(false);
  const [startingFromThis, setStartingFromThis] = useState(false);
  const [isEditing, setIsEditing] = useState(
    isNew ||
    (location.state as any)?.startInEditMode === true ||
    new URLSearchParams(location.search).get("edit") === "true"
  );
  const [evolutionGroupId, setEvolutionGroupId] = useState<string | null>(null);
  const [parentSessionId, setParentSessionId] = useState<string | null>(null);
  const [resolvedPatientIdOverride, setResolvedPatientIdOverride] = useState<string | null>(null);
  const [resolvedSessionId, setResolvedSessionId] = useState<string | null>(null);
  const [localCreatedGroups, setLocalCreatedGroups] = useState<PatientGroup[]>([]);
  const [sessionShareDialogOpen, setSessionShareDialogOpen] = useState(false);
  const [isReadOnlyModalOpen, setIsReadOnlyModalOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [locked, setLocked] = useState(false);
  const [createdByUserId, setCreatedByUserId] = useState<string | null>(user?.id ?? null);
  const [sessionCreatedAt, setSessionCreatedAt] = useState<string | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [presenceDialogOpen, setPresenceDialogOpen] = useState(false);
  const [savingPresence, setSavingPresence] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const { isFeatureEnabled } = useFeatureFlags();
  const canPrintSessionDoc = can("system.print") && isFeatureEnabled("print_general") && isFeatureEnabled("records_session_print");
  const [isPrintTermsOpen, setIsPrintTermsOpen] = useState(false);
  const [isGenerateDocumentOpen, setIsGenerateDocumentOpen] = useState(false);
  const [pendingPrintKind, setPendingPrintKind] = useState<SessionDocumentKind | null>(null);
  const [clinicalSummaryDialogOpen, setClinicalSummaryDialogOpen] = useState(false);

  const {
    activeSession,
    anamnesisTemplates,
    baseTemplateSchema,
    cachedSessions,
    clinicColorSlots,
    clinicDocumentInfo,
    collaboratorProfiles,
    editHistory,
    groupSuggestions,
    groups: cachedGroups,
    lastUsedGroupId,
    loading,
    patientPaymentSessions,
    patientRow,
    recipientsLoaded,
    refreshSecondarySessionData,
    resolvedPatientId: resolvedPatientIdFromData,
    resolvedSessionIndex,
    sessionsFetched,
    shareCollaborators,
    shareRecipients,
  } = useSessionDetailData({
    patientId,
    sessionId,
    clinicId,
    clinicRouteKey: targetClinicKey,
    isNew,
    sessionShareDialogOpen,
  });

  const resolvedPatientId = resolvedPatientIdOverride || resolvedPatientIdFromData;
  const patientName = patientRow?.name ?? "";
  const groups = useMemo(() => {
    if (localCreatedGroups.length === 0) return cachedGroups;
    const seen = new Set(cachedGroups.map((g) => g.id));
    return [...cachedGroups, ...localCreatedGroups.filter((g) => !seen.has(g.id))];
  }, [cachedGroups, localCreatedGroups]);

  const { optimisticUpsertSession, optimisticAddOrUpdateGroup } = useOptimisticPatientDetailUpdates(
    resolvedPatientId || patientId,
    clinicId,
    patientId
  );
  const invalidatePatientData = useInvalidatePatientData();

  // Hook de direção de rolagem para botões flutuantes inteligentes nos cantos inferiores
  const { scrollDirection, isNearTop } = useScrollDirection({ threshold: 14, topOffset: 110 });
  const showFloatingPills = scrollDirection === "up" && !isNearTop;

  // Form state
  const [queixa, setQueixa] = useState(""), [sintomas, setSintomas] = useState(""), [observacoes, setObservacoes] = useState("");
  const [painScore, setPainScore] = useState([0]), [complexityScore, setComplexityScore] = useState([0]);
  const [treatmentBlocks, setTreatmentBlocks] = useState<TreatmentBlock[]>([]);
  const [treatmentGeneralGuidance, setTreatmentGeneralGuidance] = useState("");
  const [status, setStatus] = useState("rascunho"), [notes, setNotes] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null), [careLineIds, setCareLineIds] = useState<string[]>([]);
  const [sessionDate, setSessionDate] = useState<string>(""), [scheduledStartAt, setScheduledStartAt] = useState<string>(""), [patientArrivedAt, setPatientArrivedAt] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<SessionPaymentStatus>("nao_cobrado");
  const [amountCharged, setAmountCharged] = useState(""), [amountOriginal, setAmountOriginal] = useState(""), [amountPaid, setAmountPaid] = useState("");
  const [paymentAdjustmentReason, setPaymentAdjustmentReason] = useState(""), [paymentInstallments, setPaymentInstallments] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<SessionPaymentMethod>("nao_informado"), [paymentStatusDate, setPaymentStatusDate] = useState(""), [creditAppliedCents, setCreditAppliedCents] = useState(0);
  const [draftScheduledStartAt, setDraftScheduledStartAt] = useState(""), [draftPatientArrivedAt, setDraftPatientArrivedAt] = useState(""), [draftSessionDate, setDraftSessionDate] = useState("");
  const [draftPaymentStatus, setDraftPaymentStatus] = useState<SessionPaymentStatus>("nao_cobrado");
  const [draftAmountCharged, setDraftAmountCharged] = useState(""), [draftAmountOriginal, setDraftAmountOriginal] = useState(""), [draftAmountPaid, setDraftAmountPaid] = useState("");
  const [draftPaymentAdjustmentReason, setDraftPaymentAdjustmentReason] = useState(""), [draftPaymentInstallments, setDraftPaymentInstallments] = useState(1);
  const [draftPaymentMethod, setDraftPaymentMethod] = useState<SessionPaymentMethod>("nao_informado"), [draftPaymentStatusDate, setDraftPaymentStatusDate] = useState(""), [draftCreditAppliedCents, setDraftCreditAppliedCents] = useState(0);
  const [paymentPlanForm, setPaymentPlanForm] = useState<PaymentPlanFormValues>(DEFAULT_PAYMENT_PLAN_FORM_VALUES);
  const [activePaymentPlan, setActivePaymentPlan] = useState<PatientPaymentPlanRow | null>(null);
  const [anamnesisTemplateId, setAnamnesisTemplateId] = useState<string | null>(null);
  const [anamnesisFormResponse, setAnamnesisFormResponse] = useState<AnamnesisFormResponse>({});
  const [horizontalScrollState, setHorizontalScrollState] = useState<Record<string, { clientWidth: number; scrollLeft: number; scrollWidth: number }>>({});
  const [leaveConfirmModalOpen, setLeaveConfirmModalOpen] = useState(false);
  const [evolveModalOpen, setEvolveModalOpen] = useState(false);
  const [pendingNavigationPath, setPendingNavigationPath] = useState<string | null>(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const loadedSessionKeyRef = useRef<string | null>(null);
  const initialFormValuesRef = useRef<string>("");

  const horizontalScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const horizontalScrollRaf = useRef<number | null>(null);
  const horizontalDragRef = useRef<{ key: string | null; pointerId: number | null; trackLeft: number; trackWidth: number } | null>(null);

  const defaultsAppliedRef = useRef<{ key: string; template: boolean; group: boolean }>({
    key: "",
    template: false,
    group: false,
  });

  // Prefetch da tela de paciente em idle para retorno instantâneo
  useEffect(() => {
    const prefetch = () => {
      void import("@/pages/paciente-detalhe/PatientLayout");
      void import("@/pages/paciente-detalhe/pages/PatientOverviewPage");
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(prefetch);
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = window.setTimeout(prefetch, 200);
    return () => window.clearTimeout(timer);
  }, []);

  const hydrateFormFromSession = useCallback(
    (sessionData: SessionRow): SessionFormValues => {
      const anamnesis = isJsonObject(sessionData.anamnesis) ? sessionData.anamnesis : {};
      const treatment = isJsonObject(sessionData.treatment) ? sessionData.treatment : {};
      const treatmentState = readTreatmentState(treatment);

      const initialQueixa = readJsonString(anamnesis.queixa);
      const initialSintomas = readJsonString(anamnesis.sintomas);
      const initialObservacoes = readJsonString(anamnesis.observacoes);
      const initialPainScore = [sessionData.pain_score || 0];
      const initialComplexityScore = [sessionData.complexity_score || 0];
      const initialNotes = sessionData.notes || "";
      const rawCareLineIds = anamnesis.care_line_ids;
      const initialCareLineIds = Array.isArray(rawCareLineIds)
        ? (rawCareLineIds as string[])
        : sessionData.group_id
        ? [sessionData.group_id]
        : [];
      const initialGroupId = initialCareLineIds.length > 0 ? initialCareLineIds[0] : null;
      const initialSessionDate = formatDateTimeForInput(sessionData.session_date);
      const initialScheduledStartAt = formatDateTimeForInput(sessionData.scheduled_start_at);
      const initialPatientArrivedAt = formatDateTimeForInput(sessionData.patient_arrived_at);
      const initialPaymentStatus = (sessionData.payment_status as SessionPaymentStatus | null) ?? "nao_cobrado";
      const initialAmountCharged = centsToCurrencyInput(sessionData.amount_charged_cents);
      const initialAmountOriginal = centsToCurrencyInput(getSessionOriginalAmountCents(sessionData));
      const initialAmountPaid = centsToCurrencyInput(sessionData.amount_paid_cents);
      const initialPaymentAdjustmentReason = sessionData.payment_adjustment_reason ?? "";
      const initialPaymentInstallments = normalizePaymentInstallments(sessionData.payment_installments);
      const initialPaymentMethod = normalizePaymentMethod(sessionData.payment_method);
      const initialPaymentStatusDate = sessionData.payment_status_date ?? "";
      const initialAnamnesisTemplateId = sessionData.anamnesis_template_id;
      const initialAnamnesisFormResponse = readJsonRecord(sessionData.anamnesis_form_response);

      setResolvedSessionId(sessionData.id);
      setQueixa(initialQueixa);
      setSintomas(initialSintomas);
      setObservacoes(initialObservacoes);
      setPainScore(initialPainScore);
      setComplexityScore(initialComplexityScore);
      setTreatmentBlocks(treatmentState.blocks);
      setTreatmentGeneralGuidance(treatmentState.generalGuidance);
      setStatus(sessionData.status);
      setNotes(initialNotes);
      setCareLineIds(initialCareLineIds);
      setGroupId(initialGroupId);
      setSessionDate(initialSessionDate);
      setScheduledStartAt(initialScheduledStartAt);
      setPatientArrivedAt(initialPatientArrivedAt);
      setPaymentStatus(initialPaymentStatus);
      setAmountCharged(initialAmountCharged);
      setAmountOriginal(initialAmountOriginal);
      setAmountPaid(initialAmountPaid);
      setCreditAppliedCents(0);
      setPaymentAdjustmentReason(initialPaymentAdjustmentReason);
      setPaymentInstallments(initialPaymentInstallments);
      setPaymentMethod(initialPaymentMethod);
      setPaymentStatusDate(initialPaymentStatusDate);
      setAnamnesisTemplateId(initialAnamnesisTemplateId);
      setAnamnesisFormResponse(initialAnamnesisFormResponse);
      setLocked(isSessionImmutable(false, sessionData.status));
      setCreatedByUserId(sessionData.user_id);
      setSessionCreatedAt(sessionData.created_at);
      setEvolutionGroupId(sessionData.evolution_group_id ?? null);
      setParentSessionId(sessionData.parent_session_id ?? null);

      const shouldStartInEditMode =
        (location.state as { startInEditMode?: boolean } | null)?.startInEditMode === true ||
        new URLSearchParams(location.search).get("edit") === "true";
      setIsEditing(shouldStartInEditMode && !isSessionImmutable(false, sessionData.status));

      return {
        amountCharged: initialAmountCharged,
        amountOriginal: initialAmountOriginal,
        amountPaid: initialAmountPaid,
        anamnesisFormResponse: initialAnamnesisFormResponse,
        anamnesisTemplateId: initialAnamnesisTemplateId,
        careLineIds: initialCareLineIds,
        complexityScore: initialComplexityScore[0],
        groupId: initialGroupId,
        notes: initialNotes,
        observacoes: initialObservacoes,
        painScore: initialPainScore[0],
        patientArrivedAt: initialPatientArrivedAt,
        paymentAdjustmentReason: initialPaymentAdjustmentReason,
        paymentInstallments: initialPaymentInstallments,
        paymentMethod: initialPaymentMethod,
        paymentStatusDate: initialPaymentStatusDate,
        paymentStatus: initialPaymentStatus,
        queixa: initialQueixa,
        scheduledStartAt: initialScheduledStartAt,
        sintomas: initialSintomas,
        status: sessionData.status,
        treatmentBlocks: treatmentState.blocks,
        treatmentGeneralGuidance: treatmentState.generalGuidance,
      };
    },
    [location.search, location.state]
  );

  // Barreira de acesso (usando capabilities RBAC sem hardcode de papéis)
  useEffect(() => {
    if (isNew || !activeSession || !patientId || !user?.id) return;

    const hasDirectAccess =
      activeSession.user_id === user.id ||
      activeSession.provider_id === user.id ||
      can("sessions.read_all") ||
      can("sessions.manage");
    const isSharedWithMe = shareRecipients.some((r) => r.id === user.id);

    if (!hasDirectAccess && recipientsLoaded && !isSharedWithMe) {
      toast({
        title: "Acesso restrito",
        description: "Você não possui permissão para visualizar atendimentos de outros colaboradores.",
        variant: "destructive",
      });
      navigate(getClinicPatientPath(targetClinicKey, patientRow || patientId));
    }
  }, [
    activeSession,
    can,
    isNew,
    navigate,
    patientId,
    patientRow,
    recipientsLoaded,
    shareRecipients,
    targetClinicKey,
    user?.id,
  ]);

  // Redirecionamento canônico com escopo da clínica (zero bounces) e hidratação instantânea
  useEffect(() => {
    if (loading || !clinicId || !patientId) return;

    if (!isNew && activeSession) {
      const canonicalPatientKey = patientRow?.patient_code || resolvedPatientId || patientId;
      const canonicalSessionKey = resolvedSessionIndex ? `ATD-${resolvedSessionIndex}` : activeSession.id;
      const canonicalPath = getClinicPatientSessionPath(targetClinicKey, canonicalPatientKey, canonicalSessionKey);

      if (location.pathname !== canonicalPath && !location.pathname.endsWith("/sessao/novo")) {
        loadedSessionKeyRef.current = `${clinicId}:${canonicalPatientKey}:${canonicalSessionKey}:${activeSession.id}`;
        const currentState =
          location.state && typeof location.state === "object"
            ? (location.state as Record<string, unknown>)
            : {};
        navigate(`${canonicalPath}${location.search}`, {
          replace: true,
          state: { ...currentState, preloadedSession: activeSession },
        });
      }
    }

    const currentKey = isNew
      ? `${clinicId}:${patientId}:novo`
      : activeSession
      ? `${clinicId}:${patientId}:${sessionId}:${activeSession.id}`
      : null;

    if (!currentKey || loadedSessionKeyRef.current === currentKey) return;

    let loadedFormValues: SessionFormValues | null = null;
    const realPatientId = resolvedPatientId || patientId;

    if (!isNew && activeSession) {
      loadedFormValues = hydrateFormFromSession(activeSession);

      if (
        typeof navigator !== "undefined" &&
        navigator.onLine !== false &&
        shouldAutoCompleteInternDraft({
          createdAt: activeSession.created_at,
          currentUserId: user?.id,
          operationalRole,
          sessionStatus: activeSession.status,
          userId: activeSession.user_id,
        })
      ) {
        void supabase
          .from("sessions")
          .update({ status: "concluído" })
          .eq("id", activeSession.id)
          .select("*")
          .maybeSingle()
          .then(({ data: updatedSessionData }) => {
            if (updatedSessionData) {
              const nextValues = hydrateFormFromSession(updatedSessionData as SessionRow);
              initialFormValuesRef.current = JSON.stringify(nextValues);
              optimisticUpsertSession(updatedSessionData as SessionRow);
            }
          });
      }
    } else if (isNew) {
      setResolvedSessionId(null);
      setLocked(false);
      setIsEditing(true);
      setCreatedByUserId(user?.id ?? null);
      setCareLineIds([]);
      const preferredGroupId = groups.length > 0 ? getPreferredPatientGroupId(groups, lastUsedGroupId) : null;
      setGroupId(preferredGroupId);
      const defaultTemplateId = anamnesisTemplates[0]?.id ?? null;
      setAnamnesisTemplateId(defaultTemplateId);
      const scheduledFor = newSessionState?.scheduledFor ?? "";
      const initialDate = scheduledFor ? formatDateTimeForInput(scheduledFor) : getCurrentDateTimeInputValue();
      const initialScheduled = scheduledFor ? formatDateTimeForInput(scheduledFor) : "";
      const initialArrived =
        newSessionState?.autoArrival || newSessionState?.agendaEventId ? getCurrentDateTimeInputValue() : "";
      setSessionDate(initialDate);
      setScheduledStartAt(initialScheduled);
      setPatientArrivedAt(initialArrived);
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
      defaultsAppliedRef.current = {
        key: currentKey,
        template: defaultTemplateId !== null,
        group: preferredGroupId !== null,
      };

      loadedFormValues = {
        amountCharged: "",
        amountOriginal: "",
        amountPaid: "",
        anamnesisFormResponse: {},
        anamnesisTemplateId: defaultTemplateId,
        careLineIds: [],
        complexityScore: 0,
        groupId: null,
        notes: "",
        observacoes: "",
        painScore: 0,
        patientArrivedAt: initialArrived,
        paymentAdjustmentReason: "",
        paymentInstallments: 1,
        paymentMethod: "nao_informado",
        paymentStatusDate: "",
        paymentStatus: "nao_cobrado",
        queixa: "",
        scheduledStartAt: initialScheduled,
        sintomas: "",
        status: "rascunho",
        treatmentBlocks: [],
        treatmentGeneralGuidance: "",
      };
    }

    if (loadedFormValues) {
      initialFormValuesRef.current = JSON.stringify(loadedFormValues);

      const localDraft = getSessionDraft(clinicId, realPatientId, sessionId);
      if (localDraft?.values) {
        const d = localDraft.values;
        if (d.queixa !== undefined) setQueixa(d.queixa);
        if (d.sintomas !== undefined) setSintomas(d.sintomas);
        if (d.observacoes !== undefined) setObservacoes(d.observacoes);
        if (d.painScore !== undefined) setPainScore(Array.isArray(d.painScore) ? d.painScore : [d.painScore || 0]);
        if (d.complexityScore !== undefined) {
          setComplexityScore(Array.isArray(d.complexityScore) ? d.complexityScore : [d.complexityScore || 0]);
        }
        if (d.treatmentBlocks !== undefined) setTreatmentBlocks(d.treatmentBlocks);
        if (d.treatmentGeneralGuidance !== undefined) setTreatmentGeneralGuidance(d.treatmentGeneralGuidance);
        if (d.notes !== undefined) setNotes(d.notes);
        if (d.careLineIds !== undefined) setCareLineIds(d.careLineIds);
        if (d.groupId !== undefined) setGroupId(d.groupId);
        if (d.sessionDate) setSessionDate(d.sessionDate);
        if (d.scheduledStartAt) setScheduledStartAt(d.scheduledStartAt);
        if (d.patientArrivedAt) setPatientArrivedAt(d.patientArrivedAt);
        if (d.paymentStatus) setPaymentStatus(d.paymentStatus);
        if (d.amountCharged !== undefined) setAmountCharged(d.amountCharged);
        if (d.amountOriginal !== undefined) setAmountOriginal(d.amountOriginal);
        if (d.amountPaid !== undefined) setAmountPaid(d.amountPaid);
        if (d.paymentAdjustmentReason !== undefined) setPaymentAdjustmentReason(d.paymentAdjustmentReason);
        if (d.paymentInstallments !== undefined) setPaymentInstallments(d.paymentInstallments);
        if (d.paymentMethod !== undefined) setPaymentMethod(d.paymentMethod);
        if (d.paymentStatusDate !== undefined) setPaymentStatusDate(d.paymentStatusDate);
        if (d.anamnesisTemplateId !== undefined) setAnamnesisTemplateId(d.anamnesisTemplateId);
        if (d.anamnesisFormResponse !== undefined) setAnamnesisFormResponse(d.anamnesisFormResponse);
        if (d.status) setStatus(d.status);
        setHasRestoredDraft(true);
      }
    }

    loadedSessionKeyRef.current = currentKey;
  }, [
    activeSession,
    anamnesisTemplates,
    clinicId,
    groups,
    hydrateFormFromSession,
    isNew,
    lastUsedGroupId,
    loading,
    location.pathname,
    location.search,
    location.state,
    navigate,
    newSessionState?.agendaEventId,
    newSessionState?.autoArrival,
    newSessionState?.scheduledFor,
    operationalRole,
    optimisticUpsertSession,
    patientId,
    patientRow,
    resolvedPatientId,
    resolvedSessionIndex,
    sessionId,
    targetClinicKey,
    user?.id,
  ]);

  // Aplica defaults assíncronos em nova sessão sem sujar o formulário
  useEffect(() => {
    if (!isNew || !clinicId || !patientId) return;
    const currentKey = `${clinicId}:${patientId}:novo`;
    if (loadedSessionKeyRef.current !== currentKey || hasRestoredDraft) return;

    if (!defaultsAppliedRef.current.template && anamnesisTemplates.length > 0 && anamnesisTemplateId === null) {
      const nextTemplateId = anamnesisTemplates[0].id;
      defaultsAppliedRef.current.template = true;
      setAnamnesisTemplateId(nextTemplateId);
      if (initialFormValuesRef.current) {
        try {
          const parsed = JSON.parse(initialFormValuesRef.current) as SessionFormValues;
          parsed.anamnesisTemplateId = nextTemplateId;
          initialFormValuesRef.current = JSON.stringify(parsed);
        } catch {
          // noop
        }
      }
    }

    if (!defaultsAppliedRef.current.group && groups.length > 0 && groupId === null) {
      const preferred = getPreferredPatientGroupId(groups, lastUsedGroupId);
      defaultsAppliedRef.current.group = true;
      if (preferred) {
        setGroupId(preferred);
      }
    }
  }, [anamnesisTemplateId, anamnesisTemplates, clinicId, groupId, groups, hasRestoredDraft, isNew, lastUsedGroupId, patientId]);

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

  type DatabaseAnamnesisTemplate = Database["public"]["Tables"]["anamnesis_form_templates"]["Row"];
  const activeTemplate = anamnesisTemplates.find((template) => template.id === anamnesisTemplateId) ?? null;
  const activeTemplateSchema = activeTemplate ? readTemplateSchema(activeTemplate.schema) : [];
  const visibleBaseFields = getVisibleTemplateFields(baseTemplateSchema, anamnesisFormResponse);
  const visibleTemplateFields = getVisibleTemplateFields(activeTemplateSchema, anamnesisFormResponse);
  const visibleBaseSliderFields = visibleBaseFields.filter((field) => field.type === "slider");
  const baseLayout = buildTemplateLayout(baseTemplateSchema.filter((field) => field.type !== "slider")).filter(
    (item) => item.type === "field" || item.items.length > 0
  );
  const extraLayout = buildTemplateLayout(activeTemplateSchema);
  const suggestedCareLine = useMemo(
    () => detectSuggestedCareLine(queixa, careLineIds[0] ?? groupId, groups),
    [queixa, careLineIds, groupId, groups]
  );
  const resolvedClinicColorSlots = useMemo<ClinicGroupColorSlot[]>(
    () =>
      clinicColorSlots.length > 0
        ? clinicColorSlots.map((slot) => ({
            alpha: slot.alpha,
            color_hex: slot.color_hex,
            id: slot.id,
            slot_index: slot.slot_index,
          }))
        : DEFAULT_GROUP_COLOR_SLOT_SEEDS.map((slot) => ({
            alpha: slot.alpha,
            color_hex: slot.colorHex,
            id: `seed-${slot.slotIndex}`,
            slot_index: slot.slotIndex,
          })),
    [clinicColorSlots]
  );

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

    setAnamnesisFormResponse((current) => ({
      ...current,
      [field.id]: next,
    }));
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
    careLineIds,
    complexityScore: complexityScore[0],
    groupId: careLineIds.length > 0 ? careLineIds[0] : null,
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

  const isDirty = useMemo(() => {
    if (!isEditing || loading || !initialFormValuesRef.current) return false;
    return JSON.stringify(formValues) !== initialFormValuesRef.current;
  }, [isEditing, loading, formValues]);

  // Persistência Client-First (Local Draft) em tempo real no localStorage
  useEffect(() => {
    if (loading || !clinicId || !patientId || !sessionId || !isEditing) return;

    saveSessionDraft(clinicId, resolvedPatientId || patientId, sessionId, formValues);
  }, [clinicId, formValues, isEditing, loading, patientId, resolvedPatientId, sessionId]);

  // Proteção contra fechamento de aba / recarregamento do browser
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleBackNavigation = () => {
    const targetPath =
      (location.state as { from?: string } | null)?.from === "/espacopessoal"
        ? "/espacopessoal"
        : getClinicPatientPath(targetClinicKey, patientRow || patientId || "");
    if (isDirty) {
      setPendingNavigationPath(targetPath);
      setLeaveConfirmModalOpen(true);
    } else {
      navigate(targetPath);
    }
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

  const buildCurrentSessionPayload = (clinicId: string | null, targetPatientId: string, statusOverride?: string) =>
    buildSessionPayload({
      clinicId,
      creatorUserId: createdByUserId ?? user!.id,
      patientId: targetPatientId,
      sessionDate,
      values: {
        ...formValues,
        careLineIds,
        groupId: careLineIds.length > 0 ? careLineIds[0] : null,
      },
      statusOverride,
      parentSessionId,
      evolutionGroupId,
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

  const handleSelectCareLinePreset = async (presetName: string) => {
    const existing = groups.find((g) => normalizeGroupName(g.name) === normalizeGroupName(presetName));
    if (existing) {
      setCareLineIds((prev) => {
        const next = prev.includes(existing.id) ? prev.filter((id) => id !== existing.id) : [...prev, existing.id];
        setGroupId(next[0] ?? null);
        return next;
      });
      return;
    }

    if (patientId && user) {
      const targetPatientId = resolvedPatientId || patientId;
      try {
        const availableSlots = resolvedClinicColorSlots.length > 0
          ? resolvedClinicColorSlots
          : DEFAULT_GROUP_COLOR_SLOT_SEEDS.map((s) => ({ id: `seed-${s.slotIndex}`, color_hex: s.colorHex, slot_index: s.slotIndex, alpha: s.alpha }));
        const randomSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
        const chosenColor = randomSlot?.color_hex || "#3B82F6";
        const chosenSlotId = randomSlot && !randomSlot.id.startsWith("seed-") ? randomSlot.id : null;

        let effectiveClinicId = clinicId;
        if (!effectiveClinicId && user) {
          const clinicRes = await supabase.rpc("get_user_clinic_id", { _user_id: user.id });
          effectiveClinicId = clinicRes.data ?? null;
        }

        const { data, error } = await supabase
          .from("patient_groups")
          .insert({
            patient_id: targetPatientId,
            name: presetName,
            color: chosenColor,
            clinic_color_slot_id: chosenSlotId,
            group_kind: "custom",
            status: "em_andamento",
            is_default: false,
            clinic_id: effectiveClinicId,
            user_id: user.id,
          })
          .select("*")
          .single();

        if (error) {
          toast({ title: "Erro ao criar linha de cuidado", description: error.message, variant: "destructive" });
        } else if (data) {
          setLocalCreatedGroups((prev) => [...prev, data]);
          optimisticAddOrUpdateGroup(data);
          setCareLineIds((prev) => {
            const next = [...prev, data.id];
            setGroupId(next[0] ?? null);
            return next;
          });
          toast({
            title: "Linha de Cuidado criada",
            description: `"${presetName}" foi criada com sucesso com cor automática e vinculada a este atendimento.`,
          });
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const buildOptimisticSessionRow = (
    id: string,
    payload: ReturnType<typeof buildCurrentSessionPayload>,
    base?: SessionRow | null
  ): SessionRow => {
    const now = new Date().toISOString();
    return {
      amount_charged_cents: payload.amount_charged_cents ?? base?.amount_charged_cents ?? 0,
      amount_original_cents: payload.amount_original_cents ?? base?.amount_original_cents ?? 0,
      amount_paid_cents: payload.amount_paid_cents ?? base?.amount_paid_cents ?? 0,
      anamnesis: (payload.anamnesis ?? base?.anamnesis ?? null) as Json | null,
      anamnesis_form_response: (payload.anamnesis_form_response ?? base?.anamnesis_form_response ?? null) as Json | null,
      anamnesis_template_id: payload.anamnesis_template_id ?? base?.anamnesis_template_id ?? null,
      clinic_id: payload.clinic_id ?? base?.clinic_id ?? null,
      complexity_score: payload.complexity_score ?? base?.complexity_score ?? null,
      created_at: base?.created_at ?? now,
      deleted_at: base?.deleted_at ?? null,
      deleted_by_user_id: base?.deleted_by_user_id ?? null,
      evolution_group_id: payload.evolution_group_id ?? base?.evolution_group_id ?? null,
      group_id: payload.group_id ?? base?.group_id ?? null,
      id,
      notes: payload.notes ?? base?.notes ?? null,
      pain_score: payload.pain_score ?? base?.pain_score ?? null,
      parent_session_id: payload.parent_session_id ?? base?.parent_session_id ?? null,
      patient_arrived_at: payload.patient_arrived_at ?? base?.patient_arrived_at ?? null,
      patient_id: payload.patient_id,
      payment_adjustment_reason: payload.payment_adjustment_reason ?? base?.payment_adjustment_reason ?? null,
      payment_installments: payload.payment_installments ?? base?.payment_installments ?? 1,
      payment_method: payload.payment_method ?? base?.payment_method ?? "nao_informado",
      payment_plan_id: (payload as { payment_plan_id?: string | null }).payment_plan_id ?? base?.payment_plan_id ?? null,
      payment_plan_session_index:
        (payload as { payment_plan_session_index?: number | null }).payment_plan_session_index ??
        base?.payment_plan_session_index ??
        null,
      payment_status: payload.payment_status ?? base?.payment_status ?? "nao_cobrado",
      payment_status_date: payload.payment_status_date ?? base?.payment_status_date ?? null,
      provider_id: base?.provider_id ?? payload.user_id ?? null,
      scheduled_start_at: payload.scheduled_start_at ?? base?.scheduled_start_at ?? null,
      session_date: payload.session_date,
      status: payload.status ?? base?.status ?? "rascunho",
      treatment: (payload.treatment ?? base?.treatment ?? null) as Json | null,
      updated_at: now,
      user_id: payload.user_id,
      version: (base?.version ?? 0) + 1,
    };
  };

  const computeNextSessionKey = (targetSession: SessionRow) => {
    const chronological = [
      ...cachedSessions.filter((s) => !s.deleted_at && s.id !== targetSession.id),
      targetSession,
    ].sort((a, b) => {
      const diff = new Date(a.session_date).getTime() - new Date(b.session_date).getTime();
      return diff !== 0 ? diff : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    const idx = chronological.findIndex((s) => s.id === targetSession.id);
    return (sessionsFetched || cachedSessions.length > 0) && idx >= 0 ? `ATD-${idx + 1}` : targetSession.id;
  };

  const handleSave = async (explicitStatus?: "concluído" | "rascunho") => {
    if (!patientId || !user || locked || (!isNew && !isEditing)) return;
    setSaving(true);

    const targetStatus = explicitStatus || (status as "concluído" | "rascunho") || "rascunho";
    if (explicitStatus) {
      setStatus(explicitStatus);
    }

    const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
    const targetPatientId = resolvedPatientId || patientId;
    if (targetPatientId && targetPatientId !== resolvedPatientId) {
      setResolvedPatientIdOverride(targetPatientId);
    }

    let targetClinicId = clinicId;
    if (!targetClinicId && !isOffline) {
      const clinicRes = await supabase.rpc("get_user_clinic_id", { _user_id: user.id });
      targetClinicId = clinicRes.data ?? clinicId;
    }

    // Sincronização de campos modulares com includeInGlobalDashboard ou systemKey "sintomas" para Linhas de Cuidado / Grupos
    const combinedSchema = [...baseTemplateSchema, ...activeTemplateSchema];
    const dashboardItems = extractDashboardCareLineItems(combinedSchema, anamnesisFormResponse);

    const updatedCareLineIdsSet = new Set(careLineIds);
    const groupsByNormalizedName = new Map<string, (typeof groups)[number]>();
    const groupsById = new Map<string, (typeof groups)[number]>();
    for (const g of groups) {
      if (g.id) groupsById.set(g.id, g);
      const norm = normalizeGroupName(g.name);
      if (norm && !groupsByNormalizedName.has(norm)) {
        groupsByNormalizedName.set(norm, g);
      }
    }

    const newlyCreatedGroups: typeof groups = [];
    const isTenantValid = Boolean(
      !isOffline &&
      targetClinicId &&
      isUuid(targetClinicId) &&
      user?.id &&
      isUuid(user.id) &&
      targetPatientId &&
      isUuid(targetPatientId)
    );

    for (const sanitizedName of dashboardItems) {
      const normalizedItem = normalizeGroupName(sanitizedName);
      if (!normalizedItem) continue;

      let matchingGroup = groupsByNormalizedName.get(normalizedItem);

      if (!matchingGroup && isTenantValid) {
        const availableSlots = resolvedClinicColorSlots.length > 0
          ? resolvedClinicColorSlots
          : DEFAULT_GROUP_COLOR_SLOT_SEEDS.map((s) => ({ id: `seed-${s.slotIndex}`, color_hex: s.colorHex, slot_index: s.slotIndex, alpha: s.alpha }));
        const randomSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
        const rawColor = randomSlot?.color_hex || "#3B82F6";
        const chosenColor = /^#[0-9A-Fa-f]{6}$/.test(rawColor) ? rawColor : "#3B82F6";
        const chosenSlotId = randomSlot && !randomSlot.id.startsWith("seed-") && isUuid(randomSlot.id) ? randomSlot.id : null;

        const { data: newGroup, error: insertGroupError } = await supabase
          .from("patient_groups")
          .insert({
            patient_id: targetPatientId,
            name: sanitizedName,
            color: chosenColor,
            clinic_color_slot_id: chosenSlotId,
            group_kind: "custom",
            status: "em_andamento",
            is_default: false,
            clinic_id: targetClinicId,
            user_id: user.id,
          })
          .select("*")
          .maybeSingle();

        if (insertGroupError) {
          console.error("Erro ao sincronizar linha de cuidado a partir de campo modular:", insertGroupError);
        }

        if (newGroup) {
          matchingGroup = newGroup;
          const normNew = normalizeGroupName(newGroup.name);
          if (normNew) groupsByNormalizedName.set(normNew, newGroup);
          if (newGroup.id) groupsById.set(newGroup.id, newGroup);
          newlyCreatedGroups.push(newGroup);
        }
      }

      if (matchingGroup) {
        updatedCareLineIdsSet.add(matchingGroup.id);
      }
    }

    if (newlyCreatedGroups.length > 0) {
      setLocalCreatedGroups((prev) => [...prev, ...newlyCreatedGroups]);
      newlyCreatedGroups.forEach((g) => optimisticAddOrUpdateGroup(g));
    }

    const updatedCareLineIds = Array.from(updatedCareLineIdsSet);
    if (updatedCareLineIds.length !== careLineIds.length || updatedCareLineIds.some((id, idx) => id !== careLineIds[idx])) {
      setCareLineIds(updatedCareLineIds);
      setGroupId(updatedCareLineIds[0] ?? null);
      formValues.careLineIds = updatedCareLineIds;
      formValues.groupId = updatedCareLineIds[0] ?? null;
    }

    if ((isNew && targetStatus !== "rascunho" && (quota.isTrialExpired || quota.isExpired || (quota.isFreeTrial && quota.attendances.isLimitReached))) || (quota.isTrialExpired || quota.isExpired)) {
      setIsReadOnlyModalOpen(true);
      toast({
        title: "Limite de Atendimentos Atingido",
        description: `Seu plano atingiu o limite de atendimentos ou está no modo somente leitura. Faça o upgrade para continuar evoluindo e registrando novos atendimentos.`,
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    const sessionData = buildCurrentSessionPayload(targetClinicId, targetPatientId, targetStatus);

    if (isOffline) {
      if (isNew) {
        const tempId = `offline-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const offlineSession = buildOptimisticSessionRow(tempId, sessionData);
        optimisticUpsertSession(offlineSession);
        await enqueueOfflineMutation("upsert_session", { tempId, record: sessionData });

        clearSessionDraft(targetClinicId, targetPatientId, "novo");
        clearSessionDraft(targetClinicId, targetPatientId, tempId);
        initialFormValuesRef.current = JSON.stringify({ ...formValues, status: targetStatus });
        setHasRestoredDraft(false);
        setIsEditing(false);

        toast({
          title: targetStatus === "concluído" ? "Atendimento concluído (offline)" : "Rascunho salvo (offline)",
          description: "Salvo no dispositivo e será sincronizado automaticamente ao reconectar.",
        });
        const nextSessionKey = computeNextSessionKey(offlineSession);
        navigate(getClinicPatientSessionPath(targetClinicKey, patientRow || patientId, nextSessionKey), {
          replace: true,
          state: { preloadedSession: offlineSession },
        });
      } else {
        const targetSessionId = resolvedSessionId || (sessionId && isUuid(sessionId) ? sessionId : null);
        if (!targetSessionId) {
          showErrorToast("Erro ao salvar atendimento", new Error("Identificador do atendimento não encontrado."), "Atualização dos dados do atendimento");
          setSaving(false);
          return;
        }
        const offlineUpdated = buildOptimisticSessionRow(targetSessionId, sessionData, activeSession);
        optimisticUpsertSession(offlineUpdated);
        await enqueueOfflineMutation("upsert_session", {
          record: { ...sessionData, id: targetSessionId },
        });

        clearSessionDraft(targetClinicId, targetPatientId, sessionId);
        if (targetSessionId !== sessionId) clearSessionDraft(targetClinicId, targetPatientId, targetSessionId);
        initialFormValuesRef.current = JSON.stringify({ ...formValues, status: targetStatus });
        setHasRestoredDraft(false);
        setLocked(isSessionImmutable(false, targetStatus));
        if (targetStatus === "concluído") {
          setIsEditing(false);
        }
        toast({
          title: targetStatus === "concluído" ? "Atendimento concluído (offline)" : "Rascunho salvo (offline)",
          description: "Alterações salvas localmente e serão sincronizadas ao reconectar.",
        });
      }
      setSaving(false);
      return;
    }

    if (paymentPlanForm.createPlan && targetClinicId && targetPatientId) {
      const totalAmountCents = parseCurrencyToCents(paymentPlanForm.totalAmount);
      const unitAmountCents = calculateSessionUnitAmountCents(totalAmountCents, paymentPlanForm.totalSessions);

      const { data: newPlan } = await supabase
        .from("patient_payment_plans")
        .insert({
          clinic_id: targetClinicId,
          patient_id: targetPatientId,
          name: paymentPlanForm.name,
          total_sessions: paymentPlanForm.totalSessions,
          used_sessions: 1,
          total_amount_cents: totalAmountCents,
          session_unit_amount_cents: unitAmountCents,
          payment_method: paymentPlanForm.paymentMethod,
          payment_installments: paymentPlanForm.paymentInstallments,
          payment_status: paymentPlanForm.paymentStatus,
          payment_status_date: paymentPlanForm.paymentStatusDate || new Date().toISOString().split("T")[0],
          start_date: paymentPlanForm.startDate || new Date().toISOString().split("T")[0],
          created_by_user_id: user.id,
        })
        .select("*")
        .single();

      if (newPlan) {
        (sessionData as any).payment_plan_id = newPlan.id;
        (sessionData as any).payment_plan_session_index = 1;
        sessionData.payment_status = "credito";

        if (paymentPlanForm.autoPreScheduleAgenda && paymentPlanForm.totalSessions > 1) {
          const scheduleDates = generatePlanScheduleDates({
            count: paymentPlanForm.totalSessions - 1,
            startDateStr: paymentPlanForm.startDate || new Date().toISOString().split("T")[0],
            recurringWeekdays: paymentPlanForm.recurringWeekdays,
            recurringTime: paymentPlanForm.recurringTime || "14:00",
          });

          const agendaEvents = scheduleDates.map((date, idx) => ({
            clinic_id: targetClinicId,
            patient_id: targetPatientId,
            user_id: user.id,
            event_type: "atendimento" as const,
            title: `${patientName || "Paciente"} (${paymentPlanForm.name} - ${idx + 2}/${paymentPlanForm.totalSessions})`,
            scheduled_for: date.toISOString(),
            status: "aguardando_confirmacao" as const,
            payment_plan_id: newPlan.id,
            payment_plan_session_index: idx + 2,
          }));

          await supabase.from("agenda_events").insert(agendaEvents);
          notifyAgendaEventsUpdated();
        }
      }
    }

    if (isNew) {
      const { data: inserted, error } = await supabase
        .from("sessions")
        .insert(sessionData)
        .select("*")
        .single();

      if (error || !inserted) {
        showErrorToast("Erro ao criar atendimento", error, "Criação de atendimento");
      } else {
        const insertedSession = inserted as SessionRow;
        if (newSessionState?.agendaEventId) {
          const { error: agendaDeleteError } = await supabase.from("agenda_events").delete().eq("id", newSessionState.agendaEventId);

          if (agendaDeleteError) {
            showErrorToast("Atendimento criado, mas o agendamento não foi removido", agendaDeleteError, "Remoção do agendamento de origem");
          } else {
            notifyAgendaEventsUpdated();
          }
        }

        clearSessionDraft(targetClinicId, targetPatientId, "novo");
        clearSessionDraft(targetClinicId, targetPatientId, insertedSession.id);
        initialFormValuesRef.current = JSON.stringify(formValues);
        setHasRestoredDraft(false);
        setIsEditing(false);

        optimisticUpsertSession(insertedSession);
        void invalidatePatientData(targetPatientId, targetClinicId, ["sessions"]);

        if (targetStatus === "concluído") {
          toast({
            title: "Atendimento concluído e registrado no prontuário!",
            description: "O atendimento foi finalizado com sucesso.",
          });
          notifySessionCompletedFeedback(1500);
        } else {
          toast({
            title: "Rascunho salvo",
            description: "Você pode continuar preenchendo mais tarde.",
          });
        }

        const nextSessionKey = computeNextSessionKey(insertedSession);
        navigate(getClinicPatientSessionPath(targetClinicKey, patientRow || patientId, nextSessionKey), {
          replace: true,
          state: { preloadedSession: insertedSession },
        });
      }
    } else {
      const targetSessionId = resolvedSessionId || (sessionId && isUuid(sessionId) ? sessionId : null);
      if (!targetSessionId) {
        showErrorToast("Erro ao salvar atendimento", new Error("Identificador do atendimento não encontrado."), "Atualização dos dados do atendimento");
        setSaving(false);
        return;
      }
      const { data: updated, error } = await supabase
        .from("sessions")
        .update(sessionData)
        .eq("id", targetSessionId)
        .select("*")
        .single();

      if (error) {
        showErrorToast("Erro ao salvar atendimento", error, "Atualização dos dados do atendimento");
      } else {
        clearSessionDraft(targetClinicId, targetPatientId, sessionId);
        if (targetSessionId !== sessionId) clearSessionDraft(targetClinicId, targetPatientId, targetSessionId);

        if (updated) {
          const updatedSession = updated as SessionRow;
          const nextFormValues = hydrateFormFromSession(updatedSession);
          initialFormValuesRef.current = JSON.stringify(nextFormValues);
          optimisticUpsertSession(updatedSession);
        } else {
          initialFormValuesRef.current = JSON.stringify(formValues);
        }
        setHasRestoredDraft(false);
        void invalidatePatientData(targetPatientId, targetClinicId, ["sessions"]);

        if (targetStatus === "concluído") {
          setIsEditing(false);
          setLocked(true);
          toast({
            title: "Atendimento concluído e registrado no prontuário!",
            description: "Este atendimento foi bloqueado para edição. Use a duplicação para iniciar o próximo.",
          });
          notifySessionCompletedFeedback(1500);
        } else {
          toast({
            title: "Rascunho salvo",
            description: "Alterações parciais salvas com sucesso.",
          });
        }
      }
    }
    setSaving(false);
  };

  const handleStartFromThis = async (options?: { mode?: "copy" | "blank"; templateId?: string | null }) => {
    if (!patientId || !user || isNew) return;
    if (quota.isTrialExpired || quota.isExpired || (quota.isFreeTrial && quota.attendances.isLimitReached)) {
      setIsReadOnlyModalOpen(true);
      toast({
        title: "Limite de Atendimentos Atingido",
        description: `Seu plano atingiu o limite de atendimentos ou está no modo somente leitura. Faça o upgrade para continuar evoluindo novos atendimentos.`,
        variant: "destructive",
      });
      return;
    }
    if (!canStartNewSessionFromThis) {
      toast({
        title: "Acesso de visualização apenas",
        description: "Este atendimento foi compartilhado com você com permissão apenas de visualização. Não é possível iniciar um novo atendimento a partir dele.",
        variant: "destructive",
      });
      return;
    }
    setStartingFromThis(true);
    setEvolveModalOpen(false);

    try {
      const targetPatientId = resolvedPatientId || patientId;
      let targetClinicId = clinicId;
      if (!targetClinicId) {
        const clinicRes = await supabase.rpc("get_user_clinic_id", { _user_id: user.id });
        targetClinicId = clinicRes.data ?? clinicId;
      }

      let targetEvolutionGroupId = evolutionGroupId;
      if (!targetEvolutionGroupId && targetClinicId && targetPatientId) {
        const { data: newGroup } = await supabase
          .from("patient_evolution_groups")
          .insert({
            clinic_id: targetClinicId,
            patient_id: targetPatientId,
          })
          .select("id")
          .maybeSingle();

        if (newGroup) {
          targetEvolutionGroupId = newGroup.id;
          const targetSessionId = resolvedSessionId || (sessionId && isUuid(sessionId) ? sessionId : null);
          if (targetSessionId) {
            void supabase.from("sessions").update({ evolution_group_id: targetEvolutionGroupId }).eq("id", targetSessionId);
          }
        }
      }

      const isBlank = options?.mode === "blank";
      const chosenTemplateId = options?.templateId !== undefined ? options.templateId : (isBlank ? (anamnesisTemplates[0]?.id ?? null) : formValues.anamnesisTemplateId);

      const targetValues: SessionFormValues = isBlank
        ? {
            amountCharged: "",
            amountOriginal: "",
            amountPaid: "",
            anamnesisFormResponse: {},
            anamnesisTemplateId: chosenTemplateId,
            careLineIds: formValues.careLineIds,
            complexityScore: 0,
            groupId: formValues.careLineIds && formValues.careLineIds.length > 0 ? formValues.careLineIds[0] : null,
            notes: "",
            observacoes: "",
            painScore: 0,
            patientArrivedAt: "",
            paymentAdjustmentReason: "",
            paymentInstallments: 1,
            paymentMethod: "nao_informado",
            paymentStatusDate: "",
            paymentStatus: "nao_cobrado",
            queixa: "",
            scheduledStartAt: "",
            sessionDate: getCurrentDateTimeInputValue(),
            sintomas: "",
            status: "rascunho",
            treatmentBlocks: [],
            treatmentGeneralGuidance: "",
          }
        : formValues;

      const sessionData = buildSessionPayload({
        clinicId: targetClinicId,
        creatorUserId: user.id,
        patientId: targetPatientId,
        sessionDate: getCurrentDateTimeInputValue(),
        statusOverride: "rascunho",
        values: targetValues,
        parentSessionId: resolvedSessionId || (sessionId && isUuid(sessionId) ? sessionId : null),
        evolutionGroupId: targetEvolutionGroupId,
      });

      const { data: inserted, error } = await supabase
        .from("sessions")
        .insert(sessionData)
        .select("*")
        .single();

      if (error || !inserted) {
        showErrorToast("Erro ao iniciar novo atendimento", error, "Início de atendimento de evolução");
      } else {
        const insertedSession = inserted as SessionRow;
        optimisticUpsertSession(insertedSession);
        void invalidatePatientData(targetPatientId, targetClinicId, ["sessions"]);
        toast({
          title: isBlank ? "Novo atendimento em branco iniciado" : "Novo atendimento de evolução iniciado",
          description: isBlank ? "Uma nova ficha vinculada a este ciclo está pronta para preenchimento." : "Os dados foram copiados e o atendimento está pronto para preenchimento.",
        });
        const nextSessionKey = computeNextSessionKey(insertedSession);
        navigate(getClinicPatientSessionPath(targetClinicKey, patientRow || patientId, nextSessionKey, "?edit=true"), {
          state: { startInEditMode: true, preloadedSession: insertedSession },
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro ao evoluir atendimento",
        description: err.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    } finally {
      setStartingFromThis(false);
    }
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
    const targetSessionId = resolvedSessionId || (sessionId && isUuid(sessionId) ? sessionId : null);
    if (!targetSessionId) {
      setSavingPresence(false);
      return;
    }
    const { data: updatedPresence, error } = await supabase
      .from("sessions")
      .update(nextPresence)
      .eq("id", targetSessionId)
      .select("*")
      .maybeSingle();

    if (error) {
      showErrorToast("Erro ao salvar presença", error, "Atualização rápida dos horários do atendimento");
      setSavingPresence(false);
      return;
    }

    if (updatedPresence) {
      optimisticUpsertSession(updatedPresence as SessionRow);
    }
    void invalidatePatientData(resolvedPatientId || patientId, clinicId, ["sessions"]);

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
    const targetSessionId = resolvedSessionId || (sessionId && isUuid(sessionId) ? sessionId : null);
    if (!targetSessionId) {
      setSavingPayment(false);
      return;
    }
    const { data: updatedPayment, error } = await supabase
      .from("sessions")
      .update(nextPayment)
      .eq("id", targetSessionId)
      .select("*")
      .maybeSingle();

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
    if (updatedPayment) {
      optimisticUpsertSession(updatedPayment as SessionRow);
    }
    void invalidatePatientData(resolvedPatientId || patientId, clinicId, ["sessions"]);
    setPaymentDialogOpen(false);
    setSavingPayment(false);
    toast({ title: "Pagamento atualizado" });
  };

  const canManageSessionDeletion = can("sessions.delete") || isAccountOwner;
  const canEditOthersSessions = can("sessions.write_others") || canManageSessionDeletion;
  const canEditSessionContent = createdByUserId === user?.id || canEditOthersSessions;
  const currentShareRecipient = shareRecipients.find((r) => r.id === user?.id);
  const isSharedWithReadOnlyAccess = currentShareRecipient && currentShareRecipient.access_level === "read_only" && createdByUserId !== user?.id && !canEditOthersSessions;
  const canStartNewSessionFromThis = !isSharedWithReadOnlyAccess;
  const canDeleteOwnProfessionalSession =
    createdByUserId === user?.id &&
    (canManageSessionDeletion || (status === "rascunho" && can("session.delete_draft")));
  const canManageSessionSharing = !isNew && (canManageSessionDeletion || canEditSessionContent);
  const canEditSavedDraft = !isNew && status === "rascunho";
  const canEditPresenceSummary = !isNew && !isEditing && canEditSessionContent;
  const canEditPaymentSummary = !isNew && !isEditing && canEditSessionContent;
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
    const targetSessionId = resolvedSessionId || (sessionId && isUuid(sessionId) ? sessionId : null);
    if (!targetSessionId || !canDeleteSession) {
      return;
    }

    if (!window.confirm("Mover este atendimento para a lixeira?")) {
      return;
    }

    const { error } = await supabase.rpc("move_entity_to_trash", {
      _entity_type: "sessions",
      _entity_ids: [targetSessionId],
    });

    if (error) {
      showErrorToast("Erro ao mover atendimento para a lixeira", error, "Lixeira da clínica");
      return;
    }

    const clinicKey = clinic?.route_key;
    toast({
      title: "Atendimento movido para a lixeira",
      description: "O atendimento foi enviado para a lixeira da clínica e pode ser restaurado até domingo.",
      action: createTrashToastAction(clinicKey, navigate),
    });

    if ((location.state as any)?.from === "/espacopessoal") {
      navigate("/espacopessoal");
    } else {
      navigate(getClinicPatientPath(targetClinicKey, patientRow || patientId || ""));
    }
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
    appName: getActiveBrand().name,
    clinic: {
      address: formatAddressLine(clinicDocumentInfo?.address),
      businessHours: readBusinessHours(clinicDocumentInfo?.business_hours).summary,
      cnpj: formatCnpj(clinicDocumentInfo?.cnpj),
      email: clinicDocumentInfo?.email ?? null,
      legalName: clinicDocumentInfo?.legal_name ?? null,
      logoUrl: clinicDocumentInfo?.logo_url ?? null,
      name: clinicDocumentInfo?.name ?? getActiveBrand().name,
      phone: clinicDocumentInfo?.phone ?? null,
    },
    generatedAt: new Date().toLocaleString("pt-BR"),
    patientName,
    provider: {
      email: creatorProfile?.email ?? null,
      fullName: getSessionPersonLabel(creatorProfile as any, "Profissional responsável"),
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

  const handlePrintDocument = (kind: SessionDocumentKind) => {
    setPendingPrintKind(kind);
    setIsPrintTermsOpen(true);
  };

  const handleConfirmPrintDocument = async () => {
    if (!pendingPrintKind) return;
    setIsPrintTermsOpen(false);
    try {
      await printSessionDocument(pendingPrintKind, buildCurrentDocumentData());
    } catch (error) {
      toast({
        title: "Não foi possível imprimir o documento",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setPendingPrintKind(null);
    }
  };

  const renderBaseSliderSection = (mode: "edit" | "view") => (
    <SessionBaseSliderSection
      mode={mode}
      visibleBaseSliderFields={visibleBaseSliderFields}
      readBaseSliderValue={readBaseSliderValue}
      updateBaseSliderValue={updateBaseSliderValue}
      locked={locked}
    />
  );

  if (loading) {
    return <SessaoDetalheSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="mx-auto w-full min-w-0 max-w-full space-y-6 px-1 pb-24 sm:pb-8 sm:max-w-[min(100vw-2rem,1680px)] sm:px-6 lg:max-w-[min(100vw-3rem,1760px)] [overscroll-behavior-x:contain] overflow-x-hidden"
    >
      <SessionHeaderBar
        canDeleteSession={canDeleteSession} canEditPresenceSummary={canEditPresenceSummary}
        canEditSavedDraft={canEditSavedDraft} canManageSessionSharing={canManageSessionSharing}
        canPrintSessionDoc={canPrintSessionDoc} canStartNewSessionFromThis={canStartNewSessionFromThis}
        isEditing={isEditing} isNew={isNew} locked={locked}
        patient={patientRow} patientId={patientId} patientName={patientName}
        saving={saving} sessionDate={sessionDate} startingFromThis={startingFromThis} status={status}
        summaryDialogOpen={clinicalSummaryDialogOpen}
        onSummaryDialogOpenChange={setClinicalSummaryDialogOpen}
        onBack={handleBackNavigation}
        onDelete={handleDelete}
        onEdit={() => setIsEditing(true)}
        onGenerateDocument={() => setIsGenerateDocumentOpen(true)}
        onOpenShareAccess={handleOpenShareAccess}
        onPrintDocument={handlePrintDocument}
        onSave={handleSave}
        onShareDocument={handleShareDocument}
        onStartFromThis={() => setEvolveModalOpen(true)}
        onStatusChange={setStatus}
      />

      {!isNew && !isEditing ? (
        <SessionReadOnlyOverview
          activeTemplate={activeTemplate}
          amountChargedCents={amountChargedCents}
          amountOriginalCents={amountOriginalCents}
          amountPaidCents={amountPaidCents}
          arrivalDelayMinutes={arrivalDelayMinutes}
          arrivalDeltaLabel={arrivalDeltaLabel}
          canEditPaymentSummary={canEditPaymentSummary}
          canEditPresenceSummary={canEditPresenceSummary}
          clinicHomePath={clinicHomePath}
          clinicId={clinicId}
          creatorProfile={creatorProfile}
          currentHasPaymentAdjustment={currentHasPaymentAdjustment}
          currentNormalizedPaymentStatus={currentNormalizedPaymentStatus}
          currentPaymentAdjustmentCents={currentPaymentAdjustmentCents}
          currentPaymentAdjustmentPercent={currentPaymentAdjustmentPercent}
          editHistory={editHistory}
          editHistoryView={editHistoryView}
          groupId={groupId}
          groups={groups}
          historyDialogOpen={historyDialogOpen}
          notes={notes}
          patientArrivedAt={patientArrivedAt}
          patientId={patientId!}
          paymentAdjustmentReason={paymentAdjustmentReason}
          paymentBalanceCents={paymentBalanceCents}
          paymentInstallments={paymentInstallments}
          paymentMethod={paymentMethod}
          paymentStatus={paymentStatus}
          paymentStatusDate={paymentStatusDate}
          readBaseSliderValue={readBaseSliderValue}
          resolvedPatientId={resolvedPatientId}
          scheduledStartAt={scheduledStartAt}
          sessionCreatedAt={sessionCreatedAt}
          sessionDate={sessionDate}
          sessionId={sessionId}
          sessionSummary={sessionSummary}
          shareRecipients={shareRecipients}
          status={status}
          treatmentBlocks={treatmentBlocks}
          treatmentGeneralGuidance={treatmentGeneralGuidance}
          visibleBaseSliderFields={visibleBaseSliderFields}
          onNavigate={navigate}
          onOpenHistoryDialogChange={setHistoryDialogOpen}
          onOpenPaymentDialog={handleOpenPaymentDialog}
          onOpenPresenceDialog={handleOpenPresenceDialog}
        />
      ) : (
        <>
          {/* Presença / Timer */}
          <SessionPresenceCard
            scheduledStartAt={scheduledStartAt}
            patientArrivedAt={patientArrivedAt}
            sessionDate={sessionDate}
            arrivalDeltaLabel={arrivalDeltaLabel}
            arrivalDelayMinutes={arrivalDelayMinutes}
            locked={locked}
            onScheduledStartAtChange={setScheduledStartAt}
            onPatientArrivedAtChange={setPatientArrivedAt}
            onSessionDateChange={setSessionDate}
          />

          {/* Notes / Conduta */}
          <SessionConductNotes
            notes={notes}
            locked={locked}
            onNotesChange={setNotes}
            clinicId={clinicId ?? undefined}
          />

          {/* Tabs */}
          <Tabs defaultValue="anamnese" className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="anamnese" className="px-2 py-2 text-xs sm:text-sm">Anamnese</TabsTrigger>
              <TabsTrigger value="arquivos" className="px-2 py-2 text-xs sm:text-sm">Arquivos</TabsTrigger>
              <TabsTrigger data-tutorial="session-tab-treatment" value="tratamento" className="px-2 py-2 text-xs sm:text-sm">Tratamento</TabsTrigger>
              <TabsTrigger data-tutorial="session-tab-payment" value="pagamento" className="px-2 py-2 text-xs sm:text-sm">Pagamento</TabsTrigger>
            </TabsList>

            <TabsContent value="anamnese" className="mt-4 space-y-5">
              {/* Anamnese Universal / Base */}
              {renderBaseSliderSection("edit")}

              <Card data-tutorial="session-anamnesis-form">
                <CardContent className="p-3.5 sm:p-6 space-y-5">
                  <SessionAnamnesisRuntime
                    anamnesisFormResponse={anamnesisFormResponse}
                    complexityScore={complexityScore}
                    horizontalScrollRefs={horizontalScrollRefs}
                    horizontalScrollState={horizontalScrollState}
                    layout={baseLayout}
                    locked={locked}
                    observacoes={observacoes}
                    painScore={painScore}
                    queixa={queixa}
                    sintomas={sintomas}
                    suggestedCareLine={suggestedCareLine}
                    clinicColorSlots={resolvedClinicColorSlots}
                    groupSuggestions={groupSuggestions}
                    clinicId={clinicId}
                    patientId={patientId}
                    sessionId={sessionId}
                    onAnamnesisFormResponseChange={setAnamnesisFormResponse}
                    onComplexityScoreChange={setComplexityScore}
                    onObservacoesChange={setObservacoes}
                    onPainScoreChange={setPainScore}
                    onQueixaChange={setQueixa}
                    onSintomasChange={setSintomas}
                    onSelectCareLinePreset={handleSelectCareLinePreset}
                    scrollHorizontalSectionToRatio={scrollHorizontalSectionToRatio}
                    scrollHorizontalSectionToSibling={scrollHorizontalSectionToSibling}
                    beginHorizontalDrag={beginHorizontalDrag}
                    updateHorizontalDrag={updateHorizontalDrag}
                    endHorizontalDrag={endHorizontalDrag}
                    scheduleHorizontalScrollSync={scheduleHorizontalScrollSync}
                  />
                </CardContent>
              </Card>

              {/* 3. Bloco Chamativo Neon de Fichas Complementares */}
              <SessionComplementaryFormsBlock
                anamnesisTemplates={anamnesisTemplates}
                anamnesisTemplateId={anamnesisTemplateId}
                activeTemplate={activeTemplate}
                extraLayout={extraLayout}
                locked={locked}
                anamnesisFormResponse={anamnesisFormResponse}
                complexityScore={complexityScore}
                horizontalScrollRefs={horizontalScrollRefs}
                horizontalScrollState={horizontalScrollState}
                observacoes={observacoes}
                painScore={painScore}
                queixa={queixa}
                sintomas={sintomas}
                suggestedCareLine={suggestedCareLine}
                clinicColorSlots={resolvedClinicColorSlots}
                groupSuggestions={groupSuggestions}
                clinicId={clinicId}
                patientId={patientId}
                sessionId={sessionId}
                onAnamnesisTemplateSelect={(nextId) => {
                  setAnamnesisTemplateId(nextId);
                  setAnamnesisFormResponse({});
                }}
                onAnamnesisFormResponseChange={setAnamnesisFormResponse}
                onComplexityScoreChange={setComplexityScore}
                onObservacoesChange={setObservacoes}
                onPainScoreChange={setPainScore}
                onQueixaChange={setQueixa}
                onSintomasChange={setSintomas}
                onSelectCareLinePreset={handleSelectCareLinePreset}
                scrollHorizontalSectionToRatio={scrollHorizontalSectionToRatio}
                scrollHorizontalSectionToSibling={scrollHorizontalSectionToSibling}
                beginHorizontalDrag={beginHorizontalDrag}
                updateHorizontalDrag={updateHorizontalDrag}
                endHorizontalDrag={endHorizontalDrag}
                scheduleHorizontalScrollSync={scheduleHorizontalScrollSync}
                onNavigateToTemplates={() => navigate(`${clinicHomePath}/configuracoes?secao=forms`)}
              />
            </TabsContent>

            <TabsContent value="arquivos" className="mt-4 space-y-4">
              <PatientFilesProvider patientId={resolvedPatientId || patientId!} clinicId={clinicId}>
                <PatientFilesPanel
                  clinicId={clinicId}
                  disabledReason={isNew ? "Salve o atendimento antes de anexar arquivos a esta sessão." : undefined}
                  patientId={resolvedPatientId || patientId!}
                  sessionId={isNew ? null : sessionId}
                  variant="session"
                />
              </PatientFilesProvider>
            </TabsContent>

            <TabsContent value="tratamento" className="mt-4 space-y-4">
              <SessionTreatmentFields
                locked={locked}
                treatmentBlocks={treatmentBlocks}
                treatmentGeneralGuidance={treatmentGeneralGuidance}
                onTreatmentBlocksChange={setTreatmentBlocks}
                onTreatmentGeneralGuidanceChange={setTreatmentGeneralGuidance}
                clinicId={clinicId}
              />
            </TabsContent>

            <TabsContent value="pagamento" className="mt-4 space-y-4">
              <Card>
                <SessionPaymentSection
                  amountCharged={amountCharged}
                  amountOriginal={amountOriginal}
                  amountPaid={amountPaid}
                  canApplyPatientCredit={canApplyPatientCredit}
                  currentNormalizedPaymentStatus={currentNormalizedPaymentStatus}
                  effectiveCreditAppliedCents={effectiveCreditAppliedCents}
                  locked={locked}
                  paymentAdjustmentReason={paymentAdjustmentReason}
                  paymentBalanceCents={paymentBalanceCents}
                  paymentInstallments={paymentInstallments}
                  paymentMethod={paymentMethod}
                  paymentPlanForm={paymentPlanForm}
                  activePaymentPlan={activePaymentPlan}
                  patientAvailableCreditCents={patientAvailableCreditCents}
                  paymentStatusDate={paymentStatusDate}
                  remainingPatientCreditCents={remainingPatientCreditCents}
                  onApplyPatientCredit={applyPatientCredit}
                  onPaymentAdjustmentReasonChange={setPaymentAdjustmentReason}
                  onPaymentInstallmentsChange={setPaymentInstallments}
                  onPaymentMethodChange={setPaymentMethod}
                  onPaymentPlanFormChange={setPaymentPlanForm}
                  onPaymentStatusChange={setPaymentStatus}
                  onPaymentStatusDateChange={setPaymentStatusDate}
                  onAmountChargedChange={setAmountCharged}
                  onAmountOriginalChange={setAmountOriginal}
                  onAmountPaidChange={setAmountPaid}
                />
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
          void refreshSecondarySessionData();
        }}
        open={sessionShareDialogOpen}
        sessionCount={1}
        sessionIds={resolvedSessionId ? [resolvedSessionId] : (sessionId && isUuid(sessionId) ? [sessionId] : [])}
      />

      <SessionQuickEditModals
        presenceDialogOpen={presenceDialogOpen}
        savingPresence={savingPresence}
        draftScheduledStartAt={draftScheduledStartAt}
        draftPatientArrivedAt={draftPatientArrivedAt}
        draftSessionDate={draftSessionDate}
        draftArrivalDeltaLabel={draftArrivalDeltaLabel}
        draftArrivalDeltaMinutes={draftArrivalDeltaMinutes}
        onPresenceDialogOpenChange={setPresenceDialogOpen}
        onDraftScheduledStartAtChange={setDraftScheduledStartAt}
        onDraftPatientArrivedAtChange={setDraftPatientArrivedAt}
        onDraftSessionDateChange={setDraftSessionDate}
        onSavePresenceSummary={handleSavePresenceSummary}
        paymentDialogOpen={paymentDialogOpen}
        savingPayment={savingPayment}
        draftNormalizedPaymentStatus={draftNormalizedPaymentStatus}
        draftPaymentStatusDate={draftPaymentStatusDate}
        draftPaymentMethod={draftPaymentMethod}
        draftPaymentInstallments={draftPaymentInstallments}
        draftAmountOriginal={draftAmountOriginal}
        draftAmountCharged={draftAmountCharged}
        draftAmountPaid={draftAmountPaid}
        draftPaymentAdjustmentReason={draftPaymentAdjustmentReason}
        draftHasPaymentAdjustment={draftHasPaymentAdjustment}
        draftAmountOriginalCents={draftAmountOriginalCents}
        draftAmountChargedCents={draftAmountChargedCents}
        draftAmountPaidCents={draftAmountPaidCents}
        draftPaymentAdjustmentCents={draftPaymentAdjustmentCents}
        draftPaymentAdjustmentPercent={draftPaymentAdjustmentPercent}
        patientAvailableCreditCents={patientAvailableCreditCents}
        remainingDraftPatientCreditCents={remainingDraftPatientCreditCents}
        canApplyDraftPatientCredit={canApplyDraftPatientCredit}
        effectiveDraftCreditAppliedCents={effectiveDraftCreditAppliedCents}
        draftPaymentStatus={draftPaymentStatus}
        onPaymentDialogOpenChange={setPaymentDialogOpen}
        onDraftPaymentStatusChange={setDraftPaymentStatus}
        onDraftPaymentStatusDateChange={setDraftPaymentStatusDate}
        onDraftPaymentMethodChange={setDraftPaymentMethod}
        onDraftPaymentInstallmentsChange={setDraftPaymentInstallments}
        onDraftAmountOriginalChange={setDraftAmountOriginal}
        onDraftAmountChargedChange={setDraftAmountCharged}
        onDraftAmountPaidChange={setDraftAmountPaid}
        onDraftPaymentAdjustmentReasonChange={setDraftPaymentAdjustmentReason}
        onApplyDraftPatientCredit={applyDraftPatientCredit}
        onSavePaymentSummary={handleSavePaymentSummary}
      />

      <SessionErrorDialog errorDetails={errorDetails} onClose={() => setErrorDetails(null)} />

      <SessionPrintDocumentsModal
        isOpen={isPrintTermsOpen}
        pendingPrintKind={pendingPrintKind}
        onConfirm={handleConfirmPrintDocument}
        onCancel={() => { setIsPrintTermsOpen(false); setPendingPrintKind(null); }}
      />

      <GenerateDocumentModal
        open={isGenerateDocumentOpen}
        onOpenChange={setIsGenerateDocumentOpen}
        patient={patientRow}
        clinicId={clinicId}
        clinicName={clinic?.name}
      />

      {/* Modal de Confirmação de Saída com Alterações Não Salvas */}
      <SessionLeaveConfirmDialog
        open={leaveConfirmModalOpen}
        saving={saving}
        onOpenChange={setLeaveConfirmModalOpen}
        onSaveAsDraftAndLeave={async () => {
          await handleSave("rascunho");
          setLeaveConfirmModalOpen(false);
          const fallbackPath =
            (location.state as { from?: string } | null)?.from === "/espacopessoal"
              ? "/espacopessoal"
              : getClinicPatientPath(targetClinicKey, patientRow || patientId || "");
          navigate(pendingNavigationPath || fallbackPath);
        }}
        onLeaveWithoutSaving={() => {
          clearSessionDraft(clinicId, resolvedPatientId || patientId, sessionId);
          setLeaveConfirmModalOpen(false);
          const fallbackPath =
            (location.state as { from?: string } | null)?.from === "/espacopessoal"
              ? "/espacopessoal"
              : getClinicPatientPath(targetClinicKey, patientRow || patientId || "");
          navigate(pendingNavigationPath || fallbackPath);
        }}
        onContinueSession={() => setLeaveConfirmModalOpen(false)}
      />

      <EvolveSessionModal
        isOpen={evolveModalOpen}
        onClose={() => setEvolveModalOpen(false)}
        onEvolveCopy={() => void handleStartFromThis({ mode: "copy" })}
        onEvolveBlank={(templateId) => void handleStartFromThis({ mode: "blank", templateId })}
        templates={anamnesisTemplates}
        defaultTemplateId={anamnesisTemplateId}
        isEvolving={startingFromThis}
      />

      <TrialReadOnlyModal
        isOpen={isReadOnlyModalOpen}
        onClose={() => setIsReadOnlyModalOpen(false)}
        clinicId={clinicId}
        actionAttempted="evoluir ou registrar atendimentos"
      />

      {/* Pílulas flutuantes inteligentes nos cantos inferiores (Resumo Clínico à esquerda e Salvar/Concluir à direita ao scrollar para cima) */}
      <SessionFloatingActionPills
        visible={showFloatingPills}
        canEdit={(isNew || isEditing) && !locked}
        saving={saving}
        hasPatient={Boolean(patientRow)}
        onOpenSummary={() => setClinicalSummaryDialogOpen(true)}
        onSave={handleSave}
      />
    </motion.div>
  );
};

export default SessaoDetalhe;
