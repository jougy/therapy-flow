import { motion } from "framer-motion";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Info, Loader2, FileText, CheckCircle2, Layers } from "lucide-react";
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
import { DEFAULT_GROUP_COLOR_SLOT_SEEDS, normalizeGroupName, sanitizeColorSlotId } from "@/lib/group-colors";
import { Textarea } from "@/components/ui/textarea";
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
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { toast } from "@/hooks/use-toast";
import { notifySessionCompletedFeedback } from "@/hooks/useFeedbackTrigger";
import { fetchPatientByRef, isUuid, type PatientRow } from "@/lib/patient-routing";
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
import {
  fetchClinicShareCollaborators,
  fetchSessionShareRecipients,
  type SessionShareCollaborator,
  type SessionShareRecipient,
} from "@/lib/session-sharing";
import { FieldLabelWithHelp } from "@/components/anamnesis/FieldLabelWithHelp";
import {
  buildTemplateLayout,
  getVisibleTemplateFields,
  type AnamnesisField,
  type AnamnesisFormResponse,
  type AnamnesisTemplateSchema,
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
  SessionCareLinesPicker,
  SessionHeaderBar,
  SessionPaymentSection,
  SessionPrintDocumentsModal,
  SessionQuickEditModals,
  SessionReadOnlyOverview,
  SessionTreatmentFields,
  type ClinicColorSlotRow,
  type ClinicDocumentSummary,
  type CollaboratorProfile,
  type ErrorDetails,
  type GroupSuggestion,
  type PatientGroup,
  type PatientGroupStatus,
  type PatientPaymentSession,
  type SessionEditHistoryRow,
} from "@/components/sessions";

const SessaoDetalhe = () => {
  const { id: patientId, sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { can, user, clinic, clinicId, operationalRole, profile } = useAuth();
  const quota = useClinicPlanQuota(clinicId);
  const clinicHomePath = clinic?.route_key ? `/clinica/${clinic.route_key}` : "/espacopessoal";
  const isNew = sessionId === "novo";
  const newSessionState = location.state as { agendaEventId?: string; scheduledFor?: string } | null;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [startingFromThis, setStartingFromThis] = useState(false);
  const [isEditing, setIsEditing] = useState(
    isNew ||
    (location.state as any)?.startInEditMode === true ||
    new URLSearchParams(location.search).get("edit") === "true"
  );
  const [evolutionGroupId, setEvolutionGroupId] = useState<string | null>(null);
  const [parentSessionId, setParentSessionId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientRow, setPatientRow] = useState<PatientRow | null>(null);
  const [resolvedPatientId, setResolvedPatientId] = useState<string | null>(null);
  const [groups, setGroups] = useState<PatientGroup[]>([]);
  const [patientPaymentSessions, setPatientPaymentSessions] = useState<PatientPaymentSession[]>([]);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<CollaboratorProfile[]>([]);
  const [shareCollaborators, setShareCollaborators] = useState<SessionShareCollaborator[]>([]);
  const [shareRecipients, setShareRecipients] = useState<SessionShareRecipient[]>([]);
  const [sessionShareDialogOpen, setSessionShareDialogOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [anamnesisTemplates, setAnamnesisTemplates] = useState<DatabaseAnamnesisTemplate[]>([]);
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
  const { isFeatureEnabled } = useFeatureFlags();
  const canPrintSessionDoc = can("system.print") && isFeatureEnabled("print_general") && isFeatureEnabled("records_session_print");
  const [isPrintTermsOpen, setIsPrintTermsOpen] = useState(false);
  const [pendingPrintKind, setPendingPrintKind] = useState<SessionDocumentKind | null>(null);

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
  const [careLineIds, setCareLineIds] = useState<string[]>([]);
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

  const [clinicColorSlots, setClinicColorSlots] = useState<ClinicColorSlotRow[]>([]);
  const [groupSuggestions, setGroupSuggestions] = useState<GroupSuggestion[]>([]);

  const loadSessionPage = useCallback(async (force = false) => {
    if (!patientId || !clinicId) {
      return;
    }

    const currentKey = `${clinicId}:${patientId}:${sessionId}`;
    if (!force && loadedSessionKeyRef.current === currentKey) {
      return;
    }

    setLoading(true);

    const patientRes = await fetchPatientByRef(patientId, clinicId);
    const realPatientId = patientRes.data?.id || patientId;
    setResolvedPatientId(realPatientId);

    const [groupsRes, lastUsedGroupRes, paymentSessionsRes, templatesRes, clinicRes, profilesRes, colorSlotsRes, groupTemplatesRes] = await Promise.all([
      supabase.from("patient_groups").select("*").eq("patient_id", realPatientId),
      supabase
        .from("sessions")
        .select("group_id")
        .eq("patient_id", realPatientId)
        .not("group_id", "is", null)
        .order("session_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sessions")
        .select("id, amount_charged_cents, amount_paid_cents, payment_status")
        .eq("patient_id", realPatientId),
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
      supabase
        .from("clinic_group_color_slots")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("slot_index", { ascending: true }),
      supabase
        .from("patient_group_templates")
        .select("clinic_color_slot_id, color, name, normalized_name, status")
        .eq("clinic_id", clinicId)
        .order("name", { ascending: true }),
    ]);

    if (colorSlotsRes?.data) {
      setClinicColorSlots(colorSlotsRes.data as ClinicColorSlotRow[]);
    }
    if (groupTemplatesRes?.data) {
      setGroupSuggestions(groupTemplatesRes.data as GroupSuggestion[]);
    }

    if (patientRes.data) {
      setPatientName(patientRes.data.name);
      setPatientRow(patientRes.data as PatientRow);
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

    let loadedFormValues: SessionFormValues | null = null;

    if (!isNew && sessionId) {
      const [{ data: fetchedSessionData }, { data: historyData }] = await Promise.all([
        supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle(),
        supabase.from("session_edit_history").select("*").eq("session_id", sessionId).order("edited_at", { ascending: false }),
      ]);

      let sessionData = fetchedSessionData;

      if (sessionData) {
        let recipients: SessionShareRecipient[] = [];
        try {
          recipients = await fetchSessionShareRecipients(sessionData.id);
          setShareRecipients(recipients);
        } catch {
          setShareRecipients([]);
        }

        const isSharedWithMe = user?.id ? recipients.some((r) => r.id === user.id) : false;

        if (
          sessionData.user_id !== user?.id &&
          sessionData.provider_id !== user?.id &&
          !can("sessions.read_all") &&
          operationalRole !== "owner" &&
          operationalRole !== "admin" &&
          !isSharedWithMe
        ) {
          toast({
            title: "Acesso restrito",
            description: "Você não possui permissão para visualizar atendimentos de outros colaboradores.",
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
        const initialGroupId = sessionData.group_id || (initialCareLineIds[0] ?? null);
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
        setEditHistory(historyData ?? []);
        setEvolutionGroupId(sessionData.evolution_group_id ?? null);
        setParentSessionId(sessionData.parent_session_id ?? null);

        const shouldStartInEditMode =
          (location.state as any)?.startInEditMode === true ||
          new URLSearchParams(location.search).get("edit") === "true";
        setIsEditing(shouldStartInEditMode && !isSessionImmutable(false, sessionData.status));

        loadedFormValues = {
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
          sessionDate: initialSessionDate,
          sintomas: initialSintomas,
          status: sessionData.status,
          treatmentBlocks: treatmentState.blocks,
          treatmentGeneralGuidance: treatmentState.generalGuidance,
        };
      }
    } else {
      setLocked(false);
      setIsEditing(true);
      setCreatedByUserId(user?.id ?? null);
      setCareLineIds([]);
      setGroupId(null);
      const scheduledFor = newSessionState?.scheduledFor ?? "";
      const initialDate = scheduledFor ? formatDateTimeForInput(scheduledFor) : getCurrentDateTimeInputValue();
      const initialScheduled = scheduledFor ? formatDateTimeForInput(scheduledFor) : "";
      setSessionDate(initialDate);
      setScheduledStartAt(initialScheduled);
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

      loadedFormValues = {
        amountCharged: "",
        amountOriginal: "",
        amountPaid: "",
        anamnesisFormResponse: {},
        anamnesisTemplateId: templatesRes.data?.[0]?.id ?? null,
        careLineIds: [],
        complexityScore: 0,
        groupId: null,
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
        scheduledStartAt: initialScheduled,
        sessionDate: initialDate,
        sintomas: "",
        status: "rascunho",
        treatmentBlocks: [],
        treatmentGeneralGuidance: "",
      };
    }

    if (loadedFormValues) {
      initialFormValuesRef.current = JSON.stringify(loadedFormValues);

      // Verificação Local-First: Restaura rascunho persistido localmente no dispositivo (se houver)
      const localDraft = getSessionDraft(clinicId, realPatientId, sessionId);
      if (localDraft && localDraft.values) {
        const d = localDraft.values;
        if (d.queixa !== undefined) setQueixa(d.queixa);
        if (d.sintomas !== undefined) setSintomas(d.sintomas);
        if (d.observacoes !== undefined) setObservacoes(d.observacoes);
        if (d.painScore !== undefined) setPainScore(Array.isArray(d.painScore) ? d.painScore : [d.painScore || 0]);
        if (d.complexityScore !== undefined) setComplexityScore(Array.isArray(d.complexityScore) ? d.complexityScore : [d.complexityScore || 0]);
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
    setLoading(false);
  }, [clinicId, isNew, navigate, newSessionState?.scheduledFor, operationalRole, patientId, sessionId, user?.id, can, location.search, location.state]);

  useEffect(() => {
    void loadSessionPage();
  }, [clinicId, patientId, sessionId, loadSessionPage]);

  useEffect(() => {
    if (!patientId) return;
    let isMounted = true;
    void fetchPatientByRef(patientId, clinicId).then((res) => {
      if (isMounted && res.data) {
        setPatientName(res.data.name);
        setPatientRow(res.data as PatientRow);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [patientId, clinicId]);

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
    groupId: careLineIds[0] ?? groupId ?? null,
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
    const targetPath = `/pacientes/${patientId}`;
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
      values: formValues,
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

  const handleSaveClinicColorSlot = async (slotIndex: number, colorHex: string, alpha: number) => {
    if (!clinicId) return;
    const existingSlot = clinicColorSlots.find((slot) => slot.slot_index === slotIndex) ?? null;
    const result = await supabase
      .from("clinic_group_color_slots")
      .upsert(
        {
          alpha,
          clinic_id: clinicId,
          color_hex: colorHex,
          id: existingSlot?.id ?? undefined,
          slot_index: slotIndex,
        },
        { onConflict: "clinic_id,slot_index" }
      )
      .select("*")
      .single();

    if (result.data) {
      setClinicColorSlots((current) => {
        const withoutCurrent = current.filter((slot) => slot.slot_index !== slotIndex);
        return [...withoutCurrent, result.data as ClinicColorSlotRow].sort((a, b) => a.slot_index - b.slot_index);
      });
    }
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
            clinic_id: clinicId,
            user_id: user.id,
          })
          .select("*")
          .single();

        if (error) {
          toast({ title: "Erro ao criar linha de cuidado", description: error.message, variant: "destructive" });
        } else if (data) {
          setGroups((prev) => [...prev, data]);
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

  const handleSaveNewCareLineModal = async (
    name: string,
    color: string,
    colorSlotId: string | null,
    status: PatientGroupStatus
  ) => {
    if (!name.trim() || !patientId || !user) return;
    const normalizedName = normalizeGroupName(name);
    const duplicateGroup = groups.find((group) => normalizeGroupName(group.name) === normalizedName);

    if (duplicateGroup) {
      setCareLineIds((prev) => {
        const next = prev.includes(duplicateGroup.id) ? prev : [...prev, duplicateGroup.id];
        setGroupId(next[0] ?? null);
        return next;
      });
      toast({
        title: "Linha de Cuidado existente",
        description: `"${duplicateGroup.name}" já existia e foi selecionada para este atendimento.`,
      });
      return;
    }

    const targetPatientId = resolvedPatientId || patientId;
    const { data, error } = await supabase
      .from("patient_groups")
      .insert({
        patient_id: targetPatientId,
        name: name.trim(),
        color,
        clinic_color_slot_id: sanitizeColorSlotId(colorSlotId),
        group_kind: "custom",
        status,
        is_default: false,
        clinic_id: clinicId,
        user_id: user.id,
      })
      .select("*")
      .single();

    if (error) {
      toast({ title: "Erro ao criar linha de cuidado", description: error.message, variant: "destructive" });
    } else if (data) {
      setGroups((prev) => [...prev, data]);
      setCareLineIds((prev) => {
        const next = [...prev, data.id];
        setGroupId(next[0] ?? null);
        return next;
      });
      toast({
        title: "Linha de Cuidado criada",
        description: `"${data.name}" foi criada com sucesso e vinculada a este atendimento.`,
      });
    }
  };

  const handleSave = async (explicitStatus?: "concluído" | "rascunho") => {
    if (!patientId || !user || locked || (!isNew && !isEditing)) return;
    setSaving(true);

    const targetStatus = explicitStatus || (status as "concluído" | "rascunho") || "rascunho";
    if (explicitStatus) {
      setStatus(explicitStatus);
    }

    let targetPatientId = resolvedPatientId;
    if (!targetPatientId || !isUuid(targetPatientId)) {
      const patientRes = await fetchPatientByRef(patientId, clinicId);
      targetPatientId = patientRes.data?.id || patientId;
      if (targetPatientId) {
        setResolvedPatientId(targetPatientId);
      }
    }

    const clinicRes = await supabase.rpc("get_user_clinic_id", { _user_id: user.id });
    const targetClinicId = clinicRes.data ?? clinicId;

    if (isNew && targetStatus !== "rascunho" && quota.isFreeTrial && quota.attendances.isLimitReached) {
      toast({
        title: "Limite de Atendimentos Atingido",
        description: `Seu plano de teste grátis atingiu o limite de ${quota.attendances.max} atendimentos. Faça o upgrade para continuar evoluindo e registrando novos atendimentos.`,
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    const sessionData = buildCurrentSessionPayload(targetClinicId, targetPatientId, targetStatus);

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
      const { data, error } = await supabase
        .from("sessions")
        .insert(sessionData)
        .select("id")
        .single();

      if (error) {
        showErrorToast("Erro ao criar atendimento", error, "Criação de atendimento");
      } else {
        if (newSessionState?.agendaEventId) {
          const { error: agendaDeleteError } = await supabase.from("agenda_events").delete().eq("id", newSessionState.agendaEventId);

          if (agendaDeleteError) {
            showErrorToast("Atendimento criado, mas o agendamento não foi removido", agendaDeleteError, "Remoção do agendamento de origem");
          } else {
            notifyAgendaEventsUpdated();
          }
        }

        clearSessionDraft(targetClinicId, targetPatientId, "novo");
        clearSessionDraft(targetClinicId, targetPatientId, data.id);
        initialFormValuesRef.current = JSON.stringify(formValues);
        setHasRestoredDraft(false);

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
        clearSessionDraft(targetClinicId, targetPatientId, sessionId);
        initialFormValuesRef.current = JSON.stringify(formValues);
        setHasRestoredDraft(false);

        if (targetStatus === "concluído") {
          setIsEditing(false);
          await loadSessionPage(true);
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
    if (quota.isFreeTrial && quota.attendances.isLimitReached) {
      toast({
        title: "Limite de Atendimentos Atingido",
        description: `Seu plano de teste grátis atingiu o limite de ${quota.attendances.max} atendimentos. Faça o upgrade para continuar evoluindo novos atendimentos.`,
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
      let targetPatientId = resolvedPatientId;
      if (!targetPatientId || !isUuid(targetPatientId)) {
        const patientRes = await fetchPatientByRef(patientId, clinicId);
        targetPatientId = patientRes.data?.id || patientId;
        if (targetPatientId) {
          setResolvedPatientId(targetPatientId);
        }
      }

      const clinicRes = await supabase.rpc("get_user_clinic_id", { _user_id: user.id });
      const targetClinicId = clinicRes.data ?? clinicId;

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
          if (sessionId && sessionId !== "novo") {
            void supabase
              .from("sessions")
              .update({ evolution_group_id: targetEvolutionGroupId })
              .eq("id", sessionId);
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
            groupId: formValues.groupId,
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
        parentSessionId: sessionId && sessionId !== "novo" ? sessionId : null,
        evolutionGroupId: targetEvolutionGroupId,
      });

      const { data, error } = await supabase
        .from("sessions")
        .insert(sessionData)
        .select("id")
        .single();

      if (error) {
        showErrorToast("Erro ao iniciar novo atendimento", error, "Início de atendimento de evolução");
      } else {
        toast({
          title: isBlank ? "Novo atendimento em branco iniciado" : "Novo atendimento de evolução iniciado",
          description: isBlank ? "Uma nova ficha vinculada a este ciclo está pronta para preenchimento." : "Os dados foram copiados e o atendimento está pronto para preenchimento.",
        });
        navigate(`/pacientes/${patientId}/sessao/${data.id}?edit=true`, {
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

  const canManageSessionDeletion = operationalRole === "owner" || operationalRole === "admin";
  const canEditOthersSessions = can("sessions.write_others") || canManageSessionDeletion;
  const canEditSessionContent = createdByUserId === user?.id || canEditOthersSessions;
  const currentShareRecipient = shareRecipients.find((r) => r.id === user?.id);
  const isSharedWithReadOnlyAccess = currentShareRecipient && currentShareRecipient.access_level === "read_only" && createdByUserId !== user?.id && !canEditOthersSessions;
  const canStartNewSessionFromThis = !isSharedWithReadOnlyAccess;
  const canDeleteOwnProfessionalSession = (operationalRole === "professional" || operationalRole === "estagiario") && createdByUserId === user?.id;
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
    appName: "Pluri-Health",
    clinic: {
      address: formatAddressLine(clinicDocumentInfo?.address),
      businessHours: readBusinessHours(clinicDocumentInfo?.business_hours).summary,
      cnpj: formatCnpj(clinicDocumentInfo?.cnpj),
      email: clinicDocumentInfo?.email ?? null,
      legalName: clinicDocumentInfo?.legal_name ?? null,
      logoUrl: clinicDocumentInfo?.logo_url ?? null,
      name: clinicDocumentInfo?.name ?? "Pluri-Health",
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

  const renderBaseSliderSection = (mode: "edit" | "view") => {
    if (visibleBaseSliderFields.length === 0) {
      return null;
    }

    return (
      <Card data-tutorial="session-pain-scale">
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="mx-auto w-full max-w-[min(100vw-1.5rem,1680px)] space-y-6 px-3 sm:max-w-[min(100vw-2rem,1680px)] sm:px-6 lg:max-w-[min(100vw-3rem,1760px)] [overscroll-behavior-x:contain]"
    >
      <SessionHeaderBar
        canDeleteSession={canDeleteSession}
        canEditPresenceSummary={canEditPresenceSummary}
        canEditSavedDraft={canEditSavedDraft}
        canManageSessionSharing={canManageSessionSharing}
        canPrintSessionDoc={canPrintSessionDoc}
        canStartNewSessionFromThis={canStartNewSessionFromThis}
        isEditing={isEditing}
        isNew={isNew}
        locked={locked}
        patient={patientRow}
        patientId={patientId}
        patientName={patientName}
        saving={saving}
        sessionDate={sessionDate}
        startingFromThis={startingFromThis}
        status={status}
        onBack={handleBackNavigation}
        onDelete={handleDelete}
        onEdit={() => setIsEditing(true)}
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
          <div data-tutorial="session-timer">
            <Card>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Presença</h2>
                    <p className="text-sm text-muted-foreground">Registre o horário combinado e a chegada do paciente.</p>
                  </div>
                  <ComponentHelpButton helpId="session-timer" size="xs" />
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

          {/* Notes / Conduta */}
          <div data-tutorial="session-conduct-notes">
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="notes" className="text-sm font-medium">Anotações rápidas e conduta</Label>
              <ComponentHelpButton helpId="session-conduct-notes" size="xs" />
            </div>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações gerais sobre o atendimento..."
              className="mt-1"
              rows={2}
              disabled={locked}
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="anamnese" className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="anamnese" className="px-2 py-2 text-xs sm:text-sm">Anamnese</TabsTrigger>
              <TabsTrigger value="arquivos" className="px-2 py-2 text-xs sm:text-sm">Arquivos</TabsTrigger>
              <TabsTrigger data-tutorial="session-tab-treatment" value="tratamento" className="px-2 py-2 text-xs sm:text-sm">Tratamento</TabsTrigger>
              <TabsTrigger data-tutorial="session-tab-payment" value="pagamento" className="px-2 py-2 text-xs sm:text-sm">Pagamento</TabsTrigger>
            </TabsList>

            <TabsContent value="anamnese" className="mt-4 space-y-5">
              {/* 1. Primeiro Bloco da Anamnese: Sintomas & Linhas de Cuidado / Motivos */}
              <Card data-tutorial="session-carelines" className="border-primary/20 bg-card/80 p-5 space-y-3.5 shadow-sm">
                <SessionCareLinesPicker
                  careLineIds={careLineIds}
                  clinicColorSlots={clinicColorSlots}
                  groups={groups}
                  groupSuggestions={groupSuggestions}
                  locked={locked}
                  resolvedClinicColorSlots={resolvedClinicColorSlots}
                  onCareLineIdsChange={setCareLineIds}
                  onGroupIdChange={setGroupId}
                  onSaveClinicColorSlot={handleSaveClinicColorSlot}
                  onSaveNewCareLine={handleSaveNewCareLineModal}
                  onSelectCareLinePreset={handleSelectCareLinePreset}
                />
              </Card>

              {/* 2. Anamnese Universal / Base */}
              {renderBaseSliderSection("edit")}

              <Card>
                <CardContent className="p-6 space-y-5">
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
              {anamnesisTemplates.length > 0 && (
                <div data-tutorial="session-custom-forms-box" className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/15 p-5 sm:p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-primary/60">
                  <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/20 blur-2xl" />
                  <div className="pointer-events-none absolute -left-8 -bottom-8 h-36 w-36 rounded-full bg-accent/25 blur-2xl" />

                  <div className="relative z-10 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/30 animate-pulse">
                            <FileText className="h-4 w-4" />
                          </div>
                          <h3 className="font-bold text-base text-foreground tracking-tight flex items-center gap-2">
                            Ficha Complementar de Avaliação
                            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-semibold uppercase tracking-wider">
                              Especializada
                            </Badge>
                          </h3>
                          <ComponentHelpButton helpId="session-custom-forms" size="xs" />
                        </div>
                        <p className="text-xs text-muted-foreground max-w-xl">
                          Deseja aprofundar a avaliação deste atendimento com um formulário clínico estruturado da clínica? Escolha uma ficha abaixo:
                        </p>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs bg-background/80 hover:bg-background border-primary/30 text-primary hover:text-primary gap-1 self-start sm:self-auto shrink-0 shadow-sm"
                        onClick={() => navigate(`${clinicHomePath}/configuracoes?secao=forms`)}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Gerenciar fichas da clínica
                      </Button>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 pt-1">
                      {anamnesisTemplates.map((template) => {
                        const isSelected = anamnesisTemplateId === template.id;
                        return (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => {
                              if (locked) return;
                              if (isSelected) {
                                setAnamnesisTemplateId(null);
                                setAnamnesisFormResponse({});
                              } else {
                                setAnamnesisTemplateId(template.id);
                                setAnamnesisFormResponse({});
                              }
                            }}
                            className={`group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all duration-200 ${
                              isSelected
                                ? "border-primary bg-primary/15 shadow-md shadow-primary/10 ring-2 ring-primary/40"
                                : "border-border/80 bg-background/90 hover:border-primary/50 hover:bg-accent/40 hover:shadow-sm"
                            }`}
                            disabled={locked}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <FileText className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
                                  <span className="font-semibold text-xs text-foreground line-clamp-1">{template.name}</span>
                                </div>
                                {isSelected ? (
                                  <Badge className="h-5 px-1.5 text-[10px] bg-primary text-primary-foreground gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Ativa
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] font-medium text-muted-foreground group-hover:text-primary">
                                    + Usar
                                  </span>
                                )}
                              </div>
                              {template.description && (
                                <p className="text-[11px] text-muted-foreground line-clamp-2">{template.description}</p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
                        onClick={() => {
                          setAnamnesisTemplateId(null);
                          setAnamnesisFormResponse({});
                        }}
                        disabled={locked}
                      >
                        {anamnesisTemplateId ? "✕ Remover Ficha Complementar (Usar apenas evolução livre)" : "✓ Utilizando apenas evolução livre"}
                      </Button>
                    </div>

                    {activeTemplate && (
                      <div className="mt-4 rounded-xl border border-primary/30 bg-background/95 p-5 space-y-4 shadow-sm animate-in fade-in">
                        <div className="flex items-center justify-between gap-3 border-b pb-3">
                          <div>
                            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                              <Layers className="h-4 w-4 text-primary" />
                              {activeTemplate.name}
                            </h4>
                            {activeTemplate.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{activeTemplate.description}</p>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setAnamnesisTemplateId(null);
                              setAnamnesisFormResponse({});
                            }}
                            disabled={locked}
                          >
                            Desvincular
                          </Button>
                        </div>
                        <SessionAnamnesisRuntime
                          anamnesisFormResponse={anamnesisFormResponse}
                          complexityScore={complexityScore}
                          horizontalScrollRefs={horizontalScrollRefs}
                          horizontalScrollState={horizontalScrollState}
                          layout={extraLayout}
                          locked={locked}
                          observacoes={observacoes}
                          painScore={painScore}
                          queixa={queixa}
                          sintomas={sintomas}
                          suggestedCareLine={suggestedCareLine}
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
                      </div>
                    )}
                  </div>
                </div>
              )}
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
          void loadSessionPage();
        }}
        open={sessionShareDialogOpen}
        sessionCount={1}
        sessionIds={sessionId && sessionId !== "novo" ? [sessionId] : []}
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

      <SessionPrintDocumentsModal
        isOpen={isPrintTermsOpen}
        pendingPrintKind={pendingPrintKind}
        onConfirm={handleConfirmPrintDocument}
        onCancel={() => {
          setIsPrintTermsOpen(false);
          setPendingPrintKind(null);
        }}
      />

      {/* Modal de Confirmação de Saída com Alterações Não Salvas */}
      <AlertDialog open={leaveConfirmModalOpen} onOpenChange={setLeaveConfirmModalOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Atendimento em andamento</AlertDialogTitle>
            <AlertDialogDescription>
              Você possui alterações que ainda não foram salvas no prontuário. O que deseja fazer antes de sair?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              type="button"
              variant="default"
              className="w-full justify-center"
              onClick={async () => {
                await handleSave("rascunho");
                setLeaveConfirmModalOpen(false);
                navigate(pendingNavigationPath || `/pacientes/${patientId}`);
              }}
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sair e salvar como rascunho
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="w-full justify-center"
              onClick={() => {
                clearSessionDraft(clinicId, resolvedPatientId || patientId, sessionId);
                setLeaveConfirmModalOpen(false);
                navigate(pendingNavigationPath || `/pacientes/${patientId}`);
              }}
              disabled={saving}
            >
              Sair sem salvar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              onClick={() => setLeaveConfirmModalOpen(false)}
              disabled={saving}
            >
              Continuar atendimento
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EvolveSessionModal
        isOpen={evolveModalOpen}
        onClose={() => setEvolveModalOpen(false)}
        onEvolveCopy={() => void handleStartFromThis({ mode: "copy" })}
        onEvolveBlank={(templateId) => void handleStartFromThis({ mode: "blank", templateId })}
        templates={anamnesisTemplates}
        defaultTemplateId={anamnesisTemplateId}
        isEvolving={startingFromThis}
      />
    </motion.div>
  );
};

export default SessaoDetalhe;
