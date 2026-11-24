import { useCallback, useContext, useEffect, useMemo } from "react";
import { QueryClientContext, useQuery, type QueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { CLINIC_QUERY_KEYS } from "@/hooks/queries/useClinicDataQueries";
import { appQueryClient } from "@/lib/query-client";
import { AGENDA_EVENTS_CACHE_KEY, AGENDA_PATIENTS_CACHE_KEY, mapRawEventToItem, type AgendaEventQueryResult } from "@/lib/agenda-cache";
import { AGENDA_EVENTS_UPDATED_EVENT, notifyAgendaEventsUpdated, type AgendaEventItem, type AgendaPatientOption } from "@/lib/agenda-events";
import { getLocalCacheItem, getSyncMemoryCacheItem, setLocalCacheItem } from "@/lib/indexed-db-persister";
import { deltaMergeById } from "@/lib/local-first/deltaMerge";
import { coalesceInFlight } from "@/lib/local-first/inFlightCoalescer";
import { enqueueOfflineMutation } from "@/lib/local-first/offlineMutationQueue";
import { isUuid } from "@/lib/patient-routing";

export interface AgendaPatientWithPhone extends AgendaPatientOption {
  phone?: string | null;
}

export interface AgendaIndex {
  byId: Map<string, AgendaEventItem>;
  byPatientId: Map<string, AgendaEventItem[]>;
  byDayKey: Map<string, AgendaEventItem[]>;
  upcomingByPatientId: Map<string, AgendaEventItem | null>;
}

export interface OptimisticUpsertAgendaOptions {
  tempId?: string;
  offlineRecord?: Database["public"]["Tables"]["agenda_events"]["Insert"];
  enqueueOffline?: boolean;
}

export interface OptimisticDeleteAgendaOptions {
  enqueueOffline?: boolean;
}

const AGENDA_FULL_COLUMNS = "id, event_type, patient_id, status, title, scheduled_for, duration_minutes, origin_timezone, origin_lat, origin_lng, origin_city";
const AGENDA_BASE_COLUMNS = "id, event_type, patient_id, status, title, scheduled_for";
let internalUpdateDepth = 0;

function dispatchInternalAgendaUpdate(): void {
  internalUpdateDepth += 1;
  try {
    notifyAgendaEventsUpdated();
  } finally {
    internalUpdateDepth = Math.max(0, internalUpdateDepth - 1);
  }
}

const isBrowserOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

export function isNetworkOrOfflineError(error: unknown): boolean {
  if (isBrowserOffline()) return true;
  if (!error || typeof error !== "object") return false;
  const msg = String((error as { message?: unknown }).message ?? "").toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network request failed") || msg.includes("load failed") || msg.includes("offline");
}

const getAgendaCacheKey = (clinicId?: string | null) => AGENDA_EVENTS_CACHE_KEY(clinicId || "personal");
const getAgendaPatientsCacheKey = (clinicId?: string | null) => AGENDA_PATIENTS_CACHE_KEY(clinicId || "personal");
const compareRawEvents = (a: AgendaEventQueryResult, b: AgendaEventQueryResult) => a.scheduled_for.localeCompare(b.scheduled_for);

export function toRawAgendaEvent(input: AgendaEventQueryResult | AgendaEventItem): AgendaEventQueryResult {
  if ("scheduled_for" in input) return input;
  return {
    id: input.id,
    event_type: input.eventType,
    patient_id: input.patientId,
    scheduled_for: input.scheduledFor,
    status: input.status,
    title: input.title,
    duration_minutes: input.durationMinutes ?? null,
    origin_timezone: input.originTimezone ?? null,
    origin_lat: input.originLat ?? null,
    origin_lng: input.originLng ?? null,
    origin_city: input.originCity ?? null,
  };
}

/** Constrói índices O(1) para lookup por ID, paciente, dia e próximo agendamento. */
export function buildAgendaIndex(events: AgendaEventItem[], referenceNowMs = Date.now()): AgendaIndex {
  const byId = new Map<string, AgendaEventItem>();
  const byPatientId = new Map<string, AgendaEventItem[]>();
  const byDayKey = new Map<string, AgendaEventItem[]>();
  const upcomingByPatientId = new Map<string, AgendaEventItem | null>();

  const sorted = [...events].sort((a, b) => {
    const diff = (a.date?.getTime() || 0) - (b.date?.getTime() || 0);
    return diff !== 0 ? diff : a.scheduledFor.localeCompare(b.scheduledFor);
  });

  for (const event of sorted) {
    byId.set(event.id, event);
    const eventTimeMs = event.date instanceof Date ? event.date.getTime() : Number.NaN;
    if (!Number.isNaN(eventTimeMs)) {
      const dayKey = format(event.date, "yyyy-MM-dd");
      const dayList = byDayKey.get(dayKey);
      if (dayList) dayList.push(event);
      else byDayKey.set(dayKey, [event]);
    }
    if (!event.patientId) continue;
    const patientList = byPatientId.get(event.patientId);
    if (patientList) patientList.push(event);
    else byPatientId.set(event.patientId, [event]);

    if (!upcomingByPatientId.has(event.patientId)) upcomingByPatientId.set(event.patientId, null);
    if (
      upcomingByPatientId.get(event.patientId) === null &&
      event.status !== "cancelado" &&
      event.status !== "concluido" &&
      !Number.isNaN(eventTimeMs) &&
      eventTimeMs >= referenceNowMs
    ) {
      upcomingByPatientId.set(event.patientId, event);
    }
  }

  return { byId, byPatientId, byDayKey, upcomingByPatientId };
}

async function fetchClinicAgendaEventsRaw(clinicId?: string | null): Promise<AgendaEventQueryResult[]> {
  const scopeKey = clinicId || "personal";
  const cacheKey = getAgendaCacheKey(clinicId);

  return coalesceInFlight(`clinic_agenda_events:${scopeKey}`, async () => {
    if (isBrowserOffline()) return (await getLocalCacheItem<AgendaEventQueryResult[]>(cacheKey)) ?? [];

    const buildQuery = (columns: string) => {
      const base = supabase.from("agenda_events").select(columns);
      return clinicId ? base.eq("clinic_id", clinicId).order("scheduled_for", { ascending: true }) : base.order("scheduled_for", { ascending: true });
    };

    let res = await buildQuery(AGENDA_FULL_COLUMNS);
    if (res.error && (res.error.code === "42703" || res.error.message.includes("duration_minutes") || res.error.message.includes("origin_timezone"))) {
      res = await buildQuery(AGENDA_BASE_COLUMNS);
    }
    if (res.error) {
      const cached = await getLocalCacheItem<AgendaEventQueryResult[]>(cacheKey);
      if (cached && cached.length > 0) return cached;
      throw res.error;
    }

    const rawEvents = (res.data ?? []) as unknown as AgendaEventQueryResult[];
    void setLocalCacheItem(cacheKey, rawEvents);
    return rawEvents;
  });
}

async function fetchClinicAgendaPatientsRaw(clinicId?: string | null): Promise<AgendaPatientWithPhone[]> {
  const scopeKey = clinicId || "personal";
  const cacheKey = getAgendaPatientsCacheKey(clinicId);

  return coalesceInFlight(`clinic_agenda_patients:${scopeKey}`, async () => {
    if (isBrowserOffline()) return (await getLocalCacheItem<AgendaPatientWithPhone[]>(cacheKey)) ?? [];

    const base = supabase.from("patients").select("id, name, phone");
    const res = clinicId ? await base.eq("clinic_id", clinicId).order("name", { ascending: true }) : await base.order("name", { ascending: true });
    if (res.error) {
      const cached = await getLocalCacheItem<AgendaPatientWithPhone[]>(cacheKey);
      if (cached && cached.length > 0) return cached;
      throw res.error;
    }

    const patients = Array.isArray(res.data) ? (res.data as AgendaPatientWithPhone[]) : [];
    void setLocalCacheItem(cacheKey, patients);
    return patients;
  });
}

function useSafeQueryClient(): QueryClient {
  return useContext(QueryClientContext) ?? appQueryClient;
}

export function useUnifiedClinicAgenda(clinicId: string | null | undefined, enabled = true) {
  const queryClient = useSafeQueryClient();
  const queryKey = useMemo(() => CLINIC_QUERY_KEYS.agendaEvents(clinicId), [clinicId]);
  const cacheKey = useMemo(() => getAgendaCacheKey(clinicId), [clinicId]);

  const query = useQuery<AgendaEventQueryResult[]>(
    {
      queryKey,
      queryFn: () => fetchClinicAgendaEventsRaw(clinicId),
      enabled,
      staleTime: 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      placeholderData: () => (enabled ? (getSyncMemoryCacheItem<AgendaEventQueryResult[]>(cacheKey) ?? undefined) : undefined),
    },
    queryClient
  );

  useEffect(() => {
    if (!enabled || getSyncMemoryCacheItem(cacheKey) || queryClient.getQueryData(queryKey)) return;
    let active = true;
    void getLocalCacheItem<AgendaEventQueryResult[]>(cacheKey).then((cached) => {
      if (active && cached && cached.length > 0 && !queryClient.getQueryData(queryKey)) {
        queryClient.setQueryData(queryKey, cached, { updatedAt: 0 });
      }
    });
    return () => {
      active = false;
    };
  }, [cacheKey, enabled, queryClient, queryKey]);

  const { refetch } = query;
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const handleExternalAgendaUpdated = () => {
      if (internalUpdateDepth === 0) void refetch();
    };
    window.addEventListener(AGENDA_EVENTS_UPDATED_EVENT, handleExternalAgendaUpdated);
    return () => window.removeEventListener(AGENDA_EVENTS_UPDATED_EVENT, handleExternalAgendaUpdated);
  }, [enabled, refetch]);

  const events = useMemo(() => (query.data ?? []).map(mapRawEventToItem), [query.data]);
  const index = useMemo(() => buildAgendaIndex(events), [events]);

  const optimisticUpsertEvents = useCallback(
    async (eventInputs: Array<AgendaEventQueryResult | AgendaEventItem>, options?: OptimisticUpsertAgendaOptions) => {
      if (eventInputs.length === 0) return;
      const rawEvents = eventInputs.map(toRawAgendaEvent);
      const current = queryClient.getQueryData<AgendaEventQueryResult[]>(queryKey) ?? [];
      const next = deltaMergeById(current, rawEvents, compareRawEvents);
      queryClient.setQueryData<AgendaEventQueryResult[]>(queryKey, next);
      void setLocalCacheItem(cacheKey, next);

      const shouldEnqueue = options?.enqueueOffline === true || (options?.enqueueOffline !== false && Boolean(options?.offlineRecord) && isBrowserOffline());
      if (shouldEnqueue && options?.offlineRecord) {
        const firstRaw = rawEvents[0];
        await enqueueOfflineMutation("upsert_agenda_event", {
          tempId: options.tempId ?? (!isUuid(firstRaw.id) ? firstRaw.id : undefined),
          record: options.offlineRecord,
        });
      }
      dispatchInternalAgendaUpdate();
    },
    [cacheKey, queryClient, queryKey]
  );

  const optimisticUpsertEvent = useCallback(
    async (eventInput: AgendaEventQueryResult | AgendaEventItem, options?: OptimisticUpsertAgendaOptions) => {
      await optimisticUpsertEvents([eventInput], options);
    },
    [optimisticUpsertEvents]
  );

  const optimisticDeleteEvent = useCallback(
    async (eventId: string, options?: OptimisticDeleteAgendaOptions) => {
      const current = queryClient.getQueryData<AgendaEventQueryResult[]>(queryKey) ?? [];
      const next = current.filter((ev) => ev.id !== eventId);
      queryClient.setQueryData<AgendaEventQueryResult[]>(queryKey, next);
      void setLocalCacheItem(cacheKey, next);

      const shouldEnqueue = options?.enqueueOffline === true || (options?.enqueueOffline !== false && isBrowserOffline());
      if (shouldEnqueue) await enqueueOfflineMutation("delete_agenda_event", { eventId });
      dispatchInternalAgendaUpdate();
    },
    [cacheKey, queryClient, queryKey]
  );

  return {
    events,
    index,
    isLoading: enabled ? query.isLoading && events.length === 0 : false,
    refetch: query.refetch,
    optimisticUpsertEvent,
    optimisticUpsertEvents,
    optimisticDeleteEvent,
  };
}

export function useClinicAgendaPatients(clinicId: string | null | undefined, enabled = true) {
  const queryClient = useSafeQueryClient();
  const cacheKey = useMemo(() => getAgendaPatientsCacheKey(clinicId), [clinicId]);
  const queryKey = useMemo(() => ["clinic", clinicId ?? "personal", "agenda-patients"] as const, [clinicId]);

  const query = useQuery<AgendaPatientWithPhone[]>(
    {
      queryKey,
      queryFn: () => fetchClinicAgendaPatientsRaw(clinicId),
      enabled,
      staleTime: 2 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      placeholderData: () => (enabled ? (getSyncMemoryCacheItem<AgendaPatientWithPhone[]>(cacheKey) ?? undefined) : undefined),
    },
    queryClient
  );

  return {
    patients: query.data ?? [],
    isLoading: enabled ? query.isLoading && (query.data?.length ?? 0) === 0 : false,
    refetch: query.refetch,
  };
}
