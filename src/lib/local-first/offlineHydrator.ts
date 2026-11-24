import { supabase } from "@/integrations/supabase/client";
import { getLocalCacheItem, setLocalCacheItem } from "@/lib/indexed-db-persister";
import { AGENDA_EVENTS_CACHE_KEY, type AgendaEventQueryResult } from "@/lib/agenda-cache";
import { isAnamnesisTemplateSchema, type AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import type { HomePatientRecord } from "@/lib/home-patients-view";
import { PATIENTS_CACHE_KEY } from "@/hooks/queries/useClinicDataQueries";
import {
  PATIENT_BASE_SCHEMA_CACHE_KEY,
  PATIENT_DETAIL_CACHE_KEY,
  PATIENT_GROUPS_CACHE_KEY,
  PATIENT_SESSIONS_CACHE_KEY,
  PATIENT_TEMPLATES_CACHE_KEY,
  type PatientGroupRow,
  type PatientRow,
  type SessionRow,
} from "@/hooks/queries/usePatientDataQueries";
import { CLINIC_DOC_TEMPLATES_CACHE_KEY } from "@/components/patients/generate-document/useDocumentTemplates";
import type { DocumentTemplateItem } from "@/components/patients/generate-document/types";
import { deltaMergeById } from "./deltaMerge";
import { coalesceInFlight } from "./inFlightCoalescer";
import { setSyncStatus } from "./syncStatusStore";

export interface OfflineHydrationParams {
  clinicId: string;
  userId: string;
  force?: boolean;
}

const THROTTLE_MS = 5 * 60 * 1000;
const TOTAL_STEPS = 5;
const lastRunAt = new Map<string, number>();
const wmKey = (c: string, u: string) => `offline_hydrator_watermark_${c}_${u}`;

function readWatermark(c: string, u: string): string | null {
  try { return typeof window !== "undefined" ? window.localStorage.getItem(wmKey(c, u)) : null; } catch { return null; }
}
function writeWatermark(c: string, u: string, iso: string): void {
  try { if (typeof window !== "undefined") window.localStorage.setItem(wmKey(c, u), iso); } catch { /* ignore */ }
}

async function hydrateSessions(clinicId: string, userId: string, lastSync: string | null): Promise<string[]> {
  let q = supabase.from("sessions").select("*").eq("clinic_id", clinicId).or(`user_id.eq.${userId},provider_id.eq.${userId}`);
  if (lastSync) q = q.gt("updated_at", lastSync);
  const { data, error } = await q.order("updated_at", { ascending: false }).limit(500);
  if (error) throw error;
  const byPatient = new Map<string, SessionRow[]>();
  for (const row of (data ?? []) as SessionRow[]) {
    const list = byPatient.get(row.patient_id);
    if (list) list.push(row); else byPatient.set(row.patient_id, [row]);
  }
  await Promise.all(Array.from(byPatient.entries()).map(async ([pid, delta]) => {
    const key = PATIENT_SESSIONS_CACHE_KEY(pid, userId);
    const existing = (await getLocalCacheItem<SessionRow[]>(key)) ?? [];
    await setLocalCacheItem(key, deltaMergeById(existing, delta, (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()));
  }));
  return Array.from(byPatient.keys());
}

async function hydratePatients(clinicId: string, lastSync: string | null): Promise<void> {
  let q = supabase.from("patients").select("*").eq("clinic_id", clinicId);
  if (lastSync) q = q.gt("updated_at", lastSync);
  const { data, error } = await q.order("updated_at", { ascending: false }).limit(500);
  if (error) throw error;
  const rows = (data ?? []) as PatientRow[];
  if (rows.length === 0) return;

  const listKey = PATIENTS_CACHE_KEY(clinicId);
  const existing = (await getLocalCacheItem<HomePatientRecord[]>(listKey)) ?? [];
  const homeDelta: HomePatientRecord[] = rows.map((p) => ({
    id: p.id, name: p.name, patient_code: p.patient_code, status: p.status, updated_at: p.updated_at,
    deleted_at: p.deleted_at, cpf: p.cpf, date_of_birth: p.date_of_birth, gender: p.gender, pronoun: p.pronoun,
    phone: p.phone, is_recurring: p.is_recurring, recurring_weekdays: p.recurring_weekdays, recurring_time: p.recurring_time, origin_type: p.origin_type,
  }));
  await setLocalCacheItem(listKey, deltaMergeById(existing, homeDelta));
  await Promise.all(rows.flatMap((p) => p.deleted_at ? [] : [
    setLocalCacheItem(PATIENT_DETAIL_CACHE_KEY(clinicId, p.id), p),
    ...(p.patient_code ? [setLocalCacheItem(PATIENT_DETAIL_CACHE_KEY(clinicId, p.patient_code), p)] : []),
  ]));
}

async function hydrateGroups(patientIds: string[]): Promise<void> {
  if (patientIds.length === 0) return;
  const { data, error } = await supabase.from("patient_groups").select("*").in("patient_id", patientIds);
  if (error) throw error;
  const byPatient = new Map<string, PatientGroupRow[]>();
  for (const row of (data ?? []) as PatientGroupRow[]) {
    const list = byPatient.get(row.patient_id);
    if (list) list.push(row); else byPatient.set(row.patient_id, [row]);
  }
  await Promise.all(Array.from(byPatient.entries()).map(([pid, list]) => setLocalCacheItem(PATIENT_GROUPS_CACHE_KEY(pid), list)));
}

async function hydrateAgenda(clinicId: string, lastSync: string | null): Promise<void> {
  let q = supabase.from("agenda_events")
    .select("id, event_type, patient_id, status, title, scheduled_for, duration_minutes, origin_timezone, origin_lat, origin_lng, origin_city, updated_at")
    .eq("clinic_id", clinicId);
  if (lastSync) q = q.gt("updated_at", lastSync);
  const { data, error } = await q.order("scheduled_for", { ascending: true }).limit(500);
  if (error) throw error;
  const rows = (data ?? []) as unknown as AgendaEventQueryResult[];
  if (rows.length === 0) return;
  const key = AGENDA_EVENTS_CACHE_KEY(clinicId);
  const existing = (await getLocalCacheItem<AgendaEventQueryResult[]>(key)) ?? [];
  await setLocalCacheItem(key, deltaMergeById(existing, rows, (a, b) => a.scheduled_for.localeCompare(b.scheduled_for)));
}

async function hydrateTemplates(clinicId: string): Promise<void> {
  const [anamnesisRes, clinicRes, docTableRes] = await Promise.all([
    supabase.from("anamnesis_form_templates").select("id, name, schema").eq("clinic_id", clinicId).eq("is_active", true),
    supabase.from("clinics").select("id, cnpj, custom_fields, anamnesis_base_schema").eq("id", clinicId).maybeSingle(),
    supabase.from("clinic_document_templates" as unknown as "clinics").select("*").eq("clinic_id", clinicId).eq("is_active", true).is("deleted_at", null),
  ]);
  if (anamnesisRes.data) {
    const valid = anamnesisRes.data.filter((t) => isAnamnesisTemplateSchema(t.schema)).map((t) => ({ id: t.id, name: t.name, schema: t.schema as AnamnesisTemplateSchema }));
    await setLocalCacheItem(PATIENT_TEMPLATES_CACHE_KEY(clinicId), valid);
  }
  if (clinicRes.data) {
    const baseSchema = isAnamnesisTemplateSchema(clinicRes.data.anamnesis_base_schema) ? clinicRes.data.anamnesis_base_schema : [];
    await setLocalCacheItem(PATIENT_BASE_SCHEMA_CACHE_KEY(clinicId), baseSchema);
    const custom = (clinicRes.data.custom_fields || {}) as Record<string, unknown>;
    const terms = (custom.clinic_terms || {}) as { adult_terms?: { content?: string }; minor_terms?: { content?: string } };
    const customs: DocumentTemplateItem[] = Array.isArray(docTableRes.data)
      ? (docTableRes.data as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id), title: String(row.title || "Modelo Customizado"),
          description: row.description ? String(row.description) : undefined,
          category: String(row.category || "custom"), content: String(row.content_md || row.content_markdown || row.content || ""),
          isCustom: true, isFromTable: true,
        }))
      : [];
    await setLocalCacheItem(CLINIC_DOC_TEMPLATES_CACHE_KEY(clinicId), {
      clinicCnpj: clinicRes.data.cnpj || "", standardAdultContent: terms.adult_terms?.content || "",
      standardMinorContent: terms.minor_terms?.content || "", customTemplates: customs,
    });
  }
}

export async function runOfflineHydration({ clinicId, userId, force = false }: OfflineHydrationParams): Promise<void> {
  if (!clinicId || !userId || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  const scope = `${clinicId}:${userId}`;
  if (!force && Date.now() - (lastRunAt.get(scope) ?? 0) < THROTTLE_MS) return;
  await coalesceInFlight(`offline_hydrate:${scope}`, async () => {
    lastRunAt.set(scope, Date.now());
    const lastSync = readWatermark(clinicId, userId);
    const nextWm = new Date().toISOString();
    setSyncStatus({ isSyncing: true, hydrationProgress: 0, hydrationTotal: TOTAL_STEPS, lastError: null });
    try {
      const patientIds = await hydrateSessions(clinicId, userId, lastSync);
      setSyncStatus({ hydrationProgress: 1 });
      await hydratePatients(clinicId, lastSync);
      setSyncStatus({ hydrationProgress: 2 });
      await hydrateGroups(patientIds);
      setSyncStatus({ hydrationProgress: 3 });
      await hydrateAgenda(clinicId, lastSync);
      setSyncStatus({ hydrationProgress: 4 });
      await hydrateTemplates(clinicId);
      writeWatermark(clinicId, userId, nextWm);
      setSyncStatus({ isSyncing: false, hydrationProgress: TOTAL_STEPS, hydrationTotal: TOTAL_STEPS, lastSyncedAt: Date.now(), lastError: null });
    } catch (err) {
      setSyncStatus({ isSyncing: false, lastError: err instanceof Error ? err.message : String(err) });
    }
  });
}

export function scheduleOfflineHydration(params: OfflineHydrationParams): () => void {
  if (typeof window === "undefined" || import.meta.env.MODE === "test") return () => {};
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(() => void runOfflineHydration(params), { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }
  const timer = window.setTimeout(() => void runOfflineHydration(params), 1200);
  return () => window.clearTimeout(timer);
}
