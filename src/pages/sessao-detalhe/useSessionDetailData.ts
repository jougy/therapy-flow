import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  usePatientAnamnesisTemplatesQuery,
  usePatientClinicBaseSchemaQuery,
  usePatientDetailQuery,
  usePatientGroupSuggestionsQuery,
  usePatientGroupsQuery,
  usePatientSessionsQuery,
  useClinicShareCollaboratorsQuery,
  type SessionRow,
} from "@/hooks/queries/usePatientDataQueries";
import { useClinicCollaboratorsQuery, useClinicGroupColorSlotsQuery } from "@/hooks/queries/useClinicDataQueries";
import { isUuid, parseSessionRef, resolveSessionReference } from "@/lib/patient-routing";
import { fetchSessionShareRecipients, type SessionShareCollaborator, type SessionShareRecipient } from "@/lib/session-sharing";
import type {
  ClinicColorSlotRow,
  ClinicDocumentSummary,
  CollaboratorProfile,
  GroupSuggestion,
  PatientGroup,
  PatientPaymentSession,
  SessionEditHistoryRow,
} from "@/components/sessions";
import type { DatabaseAnamnesisTemplate } from "./sessaoDetalheTypes";

export interface UseSessionDetailDataParams {
  patientId?: string;
  sessionId?: string;
  clinicId: string | null;
  clinicRouteKey?: string | null;
  isNew: boolean;
  sessionShareDialogOpen: boolean;
}

const EMPTY_GROUPS: PatientGroup[] = [];
const EMPTY_SESSIONS: SessionRow[] = [];
const EMPTY_TEMPLATES: { id: string; name: string; schema: unknown }[] = [];
const EMPTY_COLOR_SLOTS: ClinicColorSlotRow[] = [];
const EMPTY_SUGGESTIONS: GroupSuggestion[] = [];
const EMPTY_COLLABORATORS: SessionShareCollaborator[] = [];

function sortChronological(sessions: SessionRow[]): SessionRow[] {
  return [...sessions]
    .filter((s) => !s.deleted_at)
    .sort((a, b) => {
      const diff = new Date(a.session_date).getTime() - new Date(b.session_date).getTime();
      return diff !== 0 ? diff : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
}

export function useSessionDetailData({
  patientId,
  sessionId,
  clinicId,
  clinicRouteKey,
  isNew,
  sessionShareDialogOpen,
}: UseSessionDetailDataParams) {
  const location = useLocation();
  const preloadedSession = (location.state as { preloadedSession?: SessionRow } | null)?.preloadedSession ?? null;

  const { data: patientQueryData, isLoading: isPatientLoading } = usePatientDetailQuery(patientId, clinicId);
  const patientRow = patientQueryData ?? null;
  const resolvedPatientId = patientRow?.id ?? (patientId && isUuid(patientId) ? patientId : null);

  const { data: groups = EMPTY_GROUPS } = usePatientGroupsQuery(resolvedPatientId, Boolean(resolvedPatientId));
  const { data: cachedSessions = EMPTY_SESSIONS, isLoading: isSessionsLoading, isFetched: isSessionsFetched } =
    usePatientSessionsQuery(resolvedPatientId, Boolean(resolvedPatientId));
  const { data: rawTemplates = EMPTY_TEMPLATES } = usePatientAnamnesisTemplatesQuery(clinicId, Boolean(clinicId));
  const { data: baseTemplateSchema = [] } = usePatientClinicBaseSchemaQuery(clinicId, Boolean(clinicId));
  const { data: clinicColorSlots = EMPTY_COLOR_SLOTS } = useClinicGroupColorSlotsQuery(clinicId, Boolean(clinicId));
  const { data: groupSuggestions = EMPTY_SUGGESTIONS } = usePatientGroupSuggestionsQuery(clinicId, Boolean(clinicId));
  const { data: rawCollaborators = [] } = useClinicCollaboratorsQuery(clinicId, Boolean(clinicId));
  const { data: shareCollaborators = EMPTY_COLLABORATORS } = useClinicShareCollaboratorsQuery(clinicId, sessionShareDialogOpen);

  const { data: clinicDocumentInfo = null } = useQuery({
    queryKey: ["clinic-document-summary", clinicId],
    queryFn: async (): Promise<ClinicDocumentSummary | null> => {
      if (!clinicId) return null;
      const { data } = await supabase
        .from("clinics")
        .select("address, anamnesis_base_schema, business_hours, cnpj, email, legal_name, logo_url, name, phone")
        .eq("id", clinicId)
        .single();
      return (data as ClinicDocumentSummary) ?? null;
    },
    enabled: Boolean(clinicId),
    staleTime: 10 * 60 * 1000,
  });

  const anamnesisTemplates = useMemo<DatabaseAnamnesisTemplate[]>(
    () =>
      rawTemplates.map((tmpl) => ({
        clinic_id: clinicId ?? "",
        created_at: "",
        created_by_user_id: null,
        description: (tmpl as { description?: string | null }).description ?? null,
        id: tmpl.id,
        is_active: true,
        is_system_default: false,
        name: tmpl.name,
        schema: tmpl.schema as Json,
        updated_at: "",
      })),
    [clinicId, rawTemplates]
  );

  const collaboratorProfiles = useMemo<CollaboratorProfile[]>(
    () =>
      rawCollaborators.map((c) => ({
        email: c.email ?? null,
        full_name: c.full_name ?? null,
        id: c.id,
        job_title: c.job_title ?? null,
        phone: null,
        professional_license: null,
        specialty: null,
      })),
    [rawCollaborators]
  );

  const chronologicalSessions = useMemo(() => sortChronological(cachedSessions), [cachedSessions]);

  const patientPaymentSessions = useMemo<PatientPaymentSession[]>(
    () => cachedSessions.map((s) => ({ amount_charged_cents: s.amount_charged_cents, amount_paid_cents: s.amount_paid_cents, id: s.id, payment_status: s.payment_status })),
    [cachedSessions]
  );

  const lastUsedGroupId = useMemo<string | null>(() => {
    const withGroup = [...cachedSessions]
      .filter((s) => !s.deleted_at && s.group_id)
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
    return withGroup[0]?.group_id ?? null;
  }, [cachedSessions]);

  // Resolução em 0ms via preloadedSession ou cache do usePatientSessionsQuery
  const syncResolution = useMemo<{ data: SessionRow; sessionIndex: number | null } | null>(() => {
    if (isNew || !sessionId) return null;
    const parsed = parseSessionRef(sessionId);
    if (!parsed.isValid) return null;

    if (preloadedSession && !preloadedSession.deleted_at) {
      const samePatient = !resolvedPatientId || preloadedSession.patient_id === resolvedPatientId;
      const matchesRef = parsed.isUuid ? preloadedSession.id === parsed.raw : parsed.sessionIndex !== null;
      if (samePatient && matchesRef) {
        const idx = chronologicalSessions.findIndex((s) => s.id === preloadedSession.id);
        return { data: preloadedSession, sessionIndex: idx >= 0 ? idx + 1 : parsed.sessionIndex };
      }
    }

    if (chronologicalSessions.length > 0) {
      if (parsed.isUuid) {
        const idx = chronologicalSessions.findIndex((s) => s.id === parsed.raw);
        if (idx >= 0) return { data: chronologicalSessions[idx], sessionIndex: idx + 1 };
      } else if (parsed.sessionIndex !== null) {
        const target = chronologicalSessions[parsed.sessionIndex - 1];
        if (target) return { data: target, sessionIndex: parsed.sessionIndex };
      }
    }
    return null;
  }, [chronologicalSessions, isNew, preloadedSession, resolvedPatientId, sessionId]);

  const [fallbackResolution, setFallbackResolution] = useState<{ key: string; data: SessionRow | null; sessionIndex: number | null } | null>(null);
  const [isResolvingFallback, setIsResolvingFallback] = useState(false);
  const resolutionKey = `${clinicId ?? ""}:${patientId ?? ""}:${sessionId ?? ""}`;

  useEffect(() => {
    if (isNew || !sessionId || !patientId || syncResolution) {
      setIsResolvingFallback(false);
      return;
    }
    if (resolvedPatientId && isSessionsLoading && !isSessionsFetched) return;

    let isMounted = true;
    setIsResolvingFallback(true);
    void resolveSessionReference(sessionId, patientId, clinicId, clinicRouteKey, {
      knownPatient: patientRow,
      knownSessions: cachedSessions,
    })
      .then((res) => {
        if (isMounted) setFallbackResolution({ key: resolutionKey, data: res.data, sessionIndex: res.sessionIndex });
      })
      .finally(() => {
        if (isMounted) setIsResolvingFallback(false);
      });
    return () => { isMounted = false; };
  }, [cachedSessions, clinicId, clinicRouteKey, isNew, isSessionsFetched, isSessionsLoading, patientId, patientRow, resolutionKey, resolvedPatientId, sessionId, syncResolution]);

  const activeSession = syncResolution?.data ?? (fallbackResolution?.key === resolutionKey ? fallbackResolution.data : null);
  const resolvedSessionIndex =
    syncResolution?.sessionIndex ?? (fallbackResolution?.key === resolutionKey ? fallbackResolution.sessionIndex : null);

  const [editHistory, setEditHistory] = useState<SessionEditHistoryRow[]>([]);
  const [shareRecipients, setShareRecipients] = useState<SessionShareRecipient[]>([]);
  const [recipientsLoaded, setRecipientsLoaded] = useState(false);

  const loadSecondarySessionData = useCallback(async (targetSessionId: string) => {
    const [historyRes, recipients] = await Promise.all([
      supabase.from("session_edit_history").select("*").eq("session_id", targetSessionId).order("edited_at", { ascending: false }),
      fetchSessionShareRecipients(targetSessionId).catch(() => [] as SessionShareRecipient[]),
    ]);
    return { history: (historyRes.data ?? []) as SessionEditHistoryRow[], recipients };
  }, []);

  useEffect(() => {
    if (isNew || !activeSession?.id) {
      setEditHistory([]);
      setShareRecipients([]);
      setRecipientsLoaded(false);
      return;
    }
    let isMounted = true;
    setRecipientsLoaded(false);
    void loadSecondarySessionData(activeSession.id).then(({ history, recipients }) => {
      if (!isMounted) return;
      setEditHistory(history);
      setShareRecipients(recipients);
      setRecipientsLoaded(true);
    });
    return () => { isMounted = false; };
  }, [activeSession?.id, isNew, loadSecondarySessionData]);

  const refreshSecondarySessionData = useCallback(async () => {
    if (isNew || !activeSession?.id) return;
    const { history, recipients } = await loadSecondarySessionData(activeSession.id);
    setEditHistory(history);
    setShareRecipients(recipients);
    setRecipientsLoaded(true);
  }, [activeSession?.id, isNew, loadSecondarySessionData]);

  const loading = isNew
    ? isPatientLoading && !patientRow
    : (!patientRow && isPatientLoading) || (!activeSession && (isSessionsLoading || isResolvingFallback));

  return {
    activeSession, anamnesisTemplates, baseTemplateSchema, cachedSessions,
    clinicColorSlots, clinicDocumentInfo, collaboratorProfiles, editHistory,
    groupSuggestions, groups, lastUsedGroupId, loading, patientPaymentSessions,
    patientRow, recipientsLoaded, refreshSecondarySessionData, resolvedPatientId,
    resolvedSessionIndex, sessionsFetched: isSessionsFetched, shareCollaborators, shareRecipients,
  };
}
