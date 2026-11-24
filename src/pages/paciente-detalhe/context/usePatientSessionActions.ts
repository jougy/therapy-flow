import { useCallback, useMemo, useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { createTrashToastAction } from "@/lib/trashUtils";
import { logRuntimeError } from "@/lib/runtime-debug";
import { notifyAgendaEventsUpdated } from "@/lib/agenda-events";
import type { AgendaEventQueryResult } from "@/lib/agenda-cache";
import { getClinicPatientSessionPath } from "@/lib/patient-routing";
import { clearSessionDraft } from "@/lib/session-draft";
import { buildSessionPayload, formatDateTimeForInput, getCurrentDateTimeInputValue } from "@/lib/session-payload";
import { canDeleteSelectedSessionsForRole } from "@/lib/patient-sessions-view";
import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import { PATIENT_EXTRA_QUERY_KEYS } from "@/hooks/queries/usePatientExtraQueries";
import type { AgendaEvent, Patient, PatientGroup, Session } from "../pacienteDetalheTypes";
import { getPatientGroupKind } from "../pacienteDetalheHelpers";

interface Params {
  id: string | undefined;
  patient: Patient | null;
  realPatientId: string | undefined;
  clinicId: string | null | undefined;
  targetClinicKey: string | undefined;
  user: User | null;
  groups: PatientGroup[];
  sessions: Session[];
  upcomingAgendaEvent: AgendaEvent | null;
  anamnesisTemplates: Array<{ id: string; name: string; schema: AnamnesisTemplateSchema }>;
  canBulkManageSessions: boolean;
  canManageAllSessions: boolean;
  canDeleteAllSessions: boolean;
  canDeleteDraftSession: boolean;
  navigate: NavigateFunction;
  queryClient: QueryClient;
  invalidatePatientData: (patientId: string, clinicId?: string | null, keys?: string[]) => Promise<void>;
  optimisticUpdateSessionStatus: (ids: string[], status: string) => void;
  optimisticMoveSessions: (ids: string[], groupId: string | null) => void;
  optimisticMoveSessionsToEvolutionGroup: (ids: string[], evolutionGroupId: string | null) => void;
  optimisticDeleteSessions: (ids: string[]) => void;
  optimisticUpsertAgendaEvent: (event: AgendaEventQueryResult) => Promise<void>;
}

export function usePatientSessionActions(params: Params) {
  const {
    id, patient, realPatientId, clinicId, targetClinicKey, user, groups, sessions,
    upcomingAgendaEvent, anamnesisTemplates, canBulkManageSessions, canManageAllSessions,
    canDeleteAllSessions, canDeleteDraftSession, navigate, queryClient, invalidatePatientData,
    optimisticUpdateSessionStatus, optimisticMoveSessions, optimisticMoveSessionsToEvolutionGroup,
    optimisticDeleteSessions, optimisticUpsertAgendaEvent,
  } = params;

  const [sessionShareDialogOpen, setSessionShareDialogOpen] = useState(false);
  const [shareRecipientsSessionId, setShareRecipientsSessionId] = useState<string | null>(null);
  const [evolvingSessionId, setEvolvingSessionId] = useState<string | null>(null);
  const [sessionToEvolve, setSessionToEvolve] = useState<Session | null>(null);
  const [sessionToLinkGroup, setSessionToLinkGroup] = useState<Session | null>(null);
  const [attendanceConfirmDialogOpen, setAttendanceConfirmDialogOpen] = useState(false);
  const [startAttendanceOptionsDialogOpen, setStartAttendanceOptionsDialogOpen] = useState(false);
  const [pendingAttendanceAgendaEvent, setPendingAttendanceAgendaEvent] = useState<AgendaEvent | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const sessionCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...sessions].sort((a, b) => {
      const diff = new Date(a.session_date).getTime() - new Date(b.session_date).getTime();
      return diff !== 0 ? diff : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    sorted.forEach((sess, idx) => map.set(sess.id, `ATD-${idx + 1}`));
    return map;
  }, [sessions]);

  const clearLongPress = () => {
    if (longPressTimerRef.current) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };

  const handleSessionPressStart = (sessionId: string) => {
    if (selectionMode) return;
    clearLongPress();
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      if (canBulkManageSessions) { setSelectionMode(true); setSelectedSessionIds([sessionId]); }
    }, 420);
  };

  const handleSessionPressCancel = () => clearLongPress();
  const toggleSessionSelection = (sid: string) => setSelectedSessionIds((curr) => (curr.includes(sid) ? curr.filter((x) => x !== sid) : [...curr, sid]));
  const handleExitSelectionMode = () => { setSelectionMode(false); setSelectedSessionIds([]); longPressTriggeredRef.current = false; clearLongPress(); };

  const handleSessionNavigate = (sessionId: string) => {
    if (selectionMode) { toggleSessionSelection(sessionId); return; }
    if (longPressTriggeredRef.current) { longPressTriggeredRef.current = false; return; }
    const target = patient || id;
    if (target) navigate(getClinicPatientSessionPath(targetClinicKey, target, sessionCodeMap.get(sessionId) || sessionId));
  };

  const handleStartAttendanceNow = useCallback(() => {
    if (!patient && !id) return;
    if (upcomingAgendaEvent) { setPendingAttendanceAgendaEvent(upcomingAgendaEvent); setAttendanceConfirmDialogOpen(true); }
    else { setPendingAttendanceAgendaEvent(null); setStartAttendanceOptionsDialogOpen(true); }
  }, [id, patient, upcomingAgendaEvent]);

  const handleConfirmAttendanceWithPendingEvent = () => { if (pendingAttendanceAgendaEvent) { setAttendanceConfirmDialogOpen(false); setStartAttendanceOptionsDialogOpen(true); } };
  const handleStartUnscheduledAttendance = () => { setPendingAttendanceAgendaEvent(null); setAttendanceConfirmDialogOpen(false); setStartAttendanceOptionsDialogOpen(true); };

  const handleStartUnlinkedSession = (templateId?: string | null) => {
    const targetKey = patient || id;
    if (!targetKey) return;
    const effectiveCid = clinicId || patient?.clinic_id;
    if (effectiveCid && (realPatientId || id)) clearSessionDraft(effectiveCid, realPatientId || id!, "novo");
    const event = pendingAttendanceAgendaEvent;
    setStartAttendanceOptionsDialogOpen(false); setPendingAttendanceAgendaEvent(null);
    navigate(getClinicPatientSessionPath(targetClinicKey, targetKey, "novo"), {
      state: { agendaEventId: event?.id, scheduledFor: event?.scheduled_for, autoArrival: Boolean(event), startInEditMode: true, forceClean: true, templateId: templateId || null },
    });
  };

  const handleCancelPendingAgendaEvent = async () => {
    if (!pendingAttendanceAgendaEvent || !patient || !user) return;
    const event = pendingAttendanceAgendaEvent;
    setAttendanceConfirmDialogOpen(false); setPendingAttendanceAgendaEvent(null);
    try {
      await optimisticUpsertAgendaEvent({ ...event, status: "cancelado" });
      const { error: uErr } = await supabase.from("agenda_events").update({ status: "cancelado" }).eq("id", event.id);
      if (uErr) throw uErr;
      const canceledGroup = groups.find((g) => getPatientGroupKind(g) === "cancelados") ?? null;
      const { data: canceledSess, error: sErr } = await supabase
        .from("sessions")
        .insert({ clinic_id: clinicId, group_id: canceledGroup?.id ?? null, notes: "Atendimento cancelado / Paciente faltou.", patient_id: patient.id, provider_id: user.id, session_date: event.scheduled_for, status: "cancelado", user_id: user.id })
        .select("*").single();
      if (sErr) throw sErr;
      if (canceledSess && realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]);
      notifyAgendaEventsUpdated();
      toast({ title: "Agendamento cancelado", description: "Falta/cancelamento registrado com sucesso no prontuário." });
    } catch (err) {
      logRuntimeError("patient_detail.cancel_pending_agenda_event", err);
      toast({ title: "Erro ao cancelar agendamento", description: "Não foi possível cancelar o agendamento.", variant: "destructive" });
    }
  };

  const ensureEvolutionGroupId = async (existingId: string | null) => {
    if (existingId !== "__new__") return existingId === "none" ? null : existingId;
    if (!realPatientId || !clinicId) return null;
    const { data, error } = await supabase.from("patient_evolution_groups").insert({ clinic_id: clinicId, patient_id: realPatientId }).select("*").maybeSingle();
    if (error || !data) { toast({ title: "Erro ao criar grupo de evolução", description: error?.message, variant: "destructive" }); return undefined; }
    queryClient.setQueryData<Array<typeof data>>(PATIENT_EXTRA_QUERY_KEYS.evolutionGroups(realPatientId), (curr = []) => [...curr, data]);
    return data.id;
  };

  const handleEvolveSession = async (session: Session, options?: { mode?: "copy" | "blank"; templateId?: string | null; agendaEvent?: AgendaEvent | null }) => {
    if (!id || !user) return;
    setEvolvingSessionId(session.id); setSessionToEvolve(null);
    try {
      const targetPatientId = realPatientId || id;
      const clinicRes = await supabase.rpc("get_user_clinic_id", { _user_id: user.id });
      const activeCid = clinicRes.data ?? session.clinic_id ?? clinicId;
      let evoGroupId = session.evolution_group_id;
      if (!evoGroupId && activeCid && targetPatientId) {
        const { data: newGroup, error: gErr } = await supabase.from("patient_evolution_groups").insert({ clinic_id: activeCid, patient_id: targetPatientId }).select("*").maybeSingle();
        if (!gErr && newGroup) {
          evoGroupId = newGroup.id;
          queryClient.setQueryData<Array<typeof newGroup>>(PATIENT_EXTRA_QUERY_KEYS.evolutionGroups(targetPatientId), (curr = []) => [...curr, newGroup]);
          await supabase.from("sessions").update({ evolution_group_id: evoGroupId }).eq("id", session.id);
        }
      }
      const isBlank = options?.mode === "blank";
      const scheduledStartAt = options?.agendaEvent?.scheduled_for ? formatDateTimeForInput(options.agendaEvent.scheduled_for) : "";
      const patientArrivedAt = options?.agendaEvent ? getCurrentDateTimeInputValue() : "";
      const treatment = (session.treatment && typeof session.treatment === "object" ? session.treatment : {}) as Record<string, unknown>;
      const anamnesis = (session.anamnesis && typeof session.anamnesis === "object" ? session.anamnesis : {}) as Record<string, unknown>;
      const careLineIds = Array.isArray(anamnesis.care_line_ids) ? (anamnesis.care_line_ids as string[]) : session.group_id ? [session.group_id] : [];
      const chosenTpl = options?.templateId !== undefined ? options.templateId : isBlank ? (anamnesisTemplates[0]?.id ?? null) : session.anamnesis_template_id;
      const values = isBlank
        ? { amountCharged: "", amountOriginal: "", amountPaid: "", anamnesisFormResponse: {}, anamnesisTemplateId: chosenTpl, careLineIds, complexityScore: 0, groupId: session.group_id, notes: "", observacoes: "", painScore: 0, patientArrivedAt, paymentAdjustmentReason: "", paymentInstallments: 1, paymentMethod: "nao_informado" as const, paymentStatus: "nao_cobrado" as const, paymentStatusDate: "", queixa: "", scheduledStartAt, sintomas: "", status: "rascunho" as const, treatmentBlocks: [], treatmentGeneralGuidance: "" }
        : { amountCharged: session.amount_charged_cents ? (session.amount_charged_cents / 100).toFixed(2).replace(".", ",") : "", amountOriginal: session.amount_original_cents ? (session.amount_original_cents / 100).toFixed(2).replace(".", ",") : "", amountPaid: session.amount_paid_cents ? (session.amount_paid_cents / 100).toFixed(2).replace(".", ",") : "", anamnesisFormResponse: (session.anamnesis_form_response as Record<string, unknown>) || {}, anamnesisTemplateId: chosenTpl, careLineIds, complexityScore: session.complexity_score ?? 0, groupId: session.group_id, notes: session.notes ?? "", observacoes: String(anamnesis.observacoes ?? ""), painScore: session.pain_score ?? 0, patientArrivedAt, paymentAdjustmentReason: session.payment_adjustment_reason ?? "", paymentInstallments: session.payment_installments ?? 1, paymentMethod: (session.payment_method as "nao_informado") ?? "nao_informado", paymentStatus: (session.payment_status as "nao_cobrado") ?? "nao_cobrado", paymentStatusDate: session.payment_status_date ?? "", queixa: String(anamnesis.queixa ?? ""), scheduledStartAt, sintomas: String(anamnesis.sintomas ?? ""), status: "rascunho" as const, treatmentBlocks: Array.isArray(treatment.blocks) ? (treatment.blocks as never[]) : [], treatmentGeneralGuidance: String(treatment.generalGuidance ?? "") };
      const { data, error } = await supabase.from("sessions").insert(buildSessionPayload({ clinicId: activeCid, creatorUserId: user.id, patientId: targetPatientId, sessionDate: getCurrentDateTimeInputValue(), statusOverride: "rascunho", parentSessionId: session.id, evolutionGroupId: evoGroupId, values })).select("id").single();
      if (error) { toast({ title: "Erro ao evoluir atendimento", description: error.message, variant: "destructive" }); return; }
      clearSessionDraft(activeCid, targetPatientId, "novo"); clearSessionDraft(activeCid, targetPatientId, data.id);
      toast({ title: isBlank ? "Novo atendimento em branco iniciado" : "Novo atendimento de evolução iniciado", description: isBlank ? "Uma nova ficha vinculada a este ciclo está pronta para preenchimento." : "Os dados foram copiados e o atendimento está pronto para preenchimento." });
      navigate(getClinicPatientSessionPath(targetClinicKey, patient || id, `ATD-${sessions.length + 1}`, "?edit=true"), { state: { startInEditMode: true, agendaEventId: options?.agendaEvent?.id, scheduledFor: options?.agendaEvent?.scheduled_for } });
    } catch (err) {
      toast({ title: "Erro ao evoluir atendimento", description: err instanceof Error ? err.message : "Ocorreu um erro inesperado", variant: "destructive" });
    } finally { setEvolvingSessionId(null); }
  };

  const selectedSessions = useMemo(() => sessions.filter((s) => selectedSessionIds.includes(s.id)), [selectedSessionIds, sessions]);
  const canDeleteSelection = canDeleteSelectedSessionsForRole({ canDeleteAll: canDeleteAllSessions, canDeleteDraft: canDeleteDraftSession, currentUserId: user?.id, selectedSessions });
  const canShareSelection = selectedSessions.length > 0 && selectedSessions.every((s) => canManageAllSessions || s.user_id === user?.id || s.provider_id === user?.id);

  const handleBulkMove = async (nextGroupId: string) => {
    if (selectedSessionIds.length === 0) return;
    const resolved = nextGroupId === "none" ? null : nextGroupId;
    optimisticMoveSessions(selectedSessionIds, resolved); handleExitSelectionMode(); setBulkUpdating(true);
    const { error } = await supabase.from("sessions").update({ group_id: resolved }).in("id", selectedSessionIds);
    if (error) { toast({ title: "Erro ao mover atendimentos", description: error.message, variant: "destructive" }); if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]); }
    else toast({ title: "Atendimentos movidos" });
    setBulkUpdating(false);
  };

  const handleBulkLinkEvolutionGroup = async (targetGroupId: string) => {
    if (selectedSessionIds.length === 0 || !realPatientId || !clinicId) return;
    const finalId = await ensureEvolutionGroupId(targetGroupId);
    if (finalId === undefined) return;
    optimisticMoveSessionsToEvolutionGroup(selectedSessionIds, finalId); handleExitSelectionMode(); setBulkUpdating(true);
    const { error } = await supabase.from("sessions").update({ evolution_group_id: finalId }).in("id", selectedSessionIds);
    if (error) { toast({ title: "Erro ao vincular ao grupo de evolução", description: error.message, variant: "destructive" }); if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]); }
    else { toast({ title: finalId ? "Atendimentos vinculados ao grupo de evolução" : "Atendimentos desvinculados do grupo" }); if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]); }
    setBulkUpdating(false);
  };

  const handleLinkSessionEvolutionGroup = async (session: Session, targetGroupId: string) => {
    if (!realPatientId || !clinicId) return;
    const finalId = await ensureEvolutionGroupId(targetGroupId);
    if (finalId === undefined) return;
    optimisticMoveSessionsToEvolutionGroup([session.id], finalId); setSessionToLinkGroup(null);
    const { error } = await supabase.from("sessions").update({ evolution_group_id: finalId }).eq("id", session.id);
    if (error) { toast({ title: "Erro ao vincular atendimento ao grupo", description: error.message, variant: "destructive" }); if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]); }
    else { toast({ title: finalId ? "Atendimento vinculado ao grupo de evolução" : "Atendimento desvinculado do grupo" }); if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]); }
  };

  const handleBulkStatusUpdate = async (nextStatus: string) => {
    if (selectedSessionIds.length === 0) return;
    optimisticUpdateSessionStatus(selectedSessionIds, nextStatus); handleExitSelectionMode(); setBulkUpdating(true);
    const { error } = await supabase.from("sessions").update({ status: nextStatus }).in("id", selectedSessionIds);
    if (error) { toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" }); if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]); }
    else toast({ title: "Status dos atendimentos atualizado" });
    setBulkUpdating(false);
  };

  const handleBulkDelete = async () => {
    if (!canDeleteSelection) {
      toast({ title: canDeleteAllSessions ? "Não foi possível excluir os atendimentos" : "Seleção sem permissão para exclusão", description: canDeleteAllSessions ? "Tente novamente em alguns instantes." : "Profissionais só podem excluir atendimentos que eles mesmos criaram.", variant: "destructive" });
      return;
    }
    optimisticDeleteSessions(selectedSessionIds);
    const idsToDelete = [...selectedSessionIds];
    handleExitSelectionMode(); setBulkUpdating(true);
    const { error } = await supabase.rpc("move_entity_to_trash", { _entity_type: "sessions", _entity_ids: idsToDelete });
    if (error) { toast({ title: "Erro ao mover atendimentos para a lixeira", description: error.message, variant: "destructive" }); if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]); }
    else toast({ title: "Atendimentos movidos para a lixeira", description: "Os atendimentos foram enviados para a lixeira da clínica e podem ser restaurados até domingo.", action: createTrashToastAction(targetClinicKey, navigate) });
    setBulkUpdating(false);
  };

  const handleOpenSessionShareDialog = () => {
    if (!canShareSelection) { toast({ title: "Não foi possível compartilhar", description: "Selecione apenas atendimentos criados por você ou que você administra.", variant: "destructive" }); return; }
    setSessionShareDialogOpen(true);
  };

  return {
    sessionShareDialogOpen, setSessionShareDialogOpen, shareRecipientsSessionId, setShareRecipientsSessionId,
    evolvingSessionId, sessionToEvolve, setSessionToEvolve, sessionToLinkGroup, setSessionToLinkGroup, handleEvolveSession,
    attendanceConfirmDialogOpen, setAttendanceConfirmDialogOpen, startAttendanceOptionsDialogOpen, setStartAttendanceOptionsDialogOpen,
    pendingAttendanceAgendaEvent, setPendingAttendanceAgendaEvent, handleStartAttendanceNow,
    handleConfirmAttendanceWithPendingEvent, handleStartUnscheduledAttendance, handleStartUnlinkedSession, handleCancelPendingAgendaEvent,
    selectionMode, selectedSessionIds, bulkUpdating, handleSessionPressStart, handleSessionPressCancel,
    toggleSessionSelection, handleExitSelectionMode, handleSessionNavigate,
    canDeleteSelection, canShareSelection, handleBulkMove, handleBulkLinkEvolutionGroup,
    handleLinkSessionEvolutionGroup, handleBulkStatusUpdate, handleBulkDelete, handleOpenSessionShareDialog,
  };
}
