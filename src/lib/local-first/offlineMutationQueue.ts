import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  deleteOutboxItem,
  getAllOutboxItems,
  putOutboxItem,
} from "@/lib/indexed-db-persister";
import { isUuid } from "@/lib/patient-routing";
import {
  createDocumentSignatureRecord,
  type CreateDocumentSignatureInput,
} from "@/components/patients/generate-document/signatureService";
import { setSyncStatus } from "./syncStatusStore";
import {
  ensureReconciliationLoaded,
  getReconciledIdMap,
  registerReconciledId,
  resolveOfflineEntityId,
} from "./reconciliationMap";

export { getReconciledIdMap, registerReconciledId, resolveOfflineEntityId };

export type OfflineMutationType =
  | "create_patient"
  | "update_patient"
  | "upsert_session"
  | "delete_agenda_event"
  | "upsert_agenda_event"
  | "sign_guardian_consent"
  | "create_document_signature";

export interface OfflineMutationPayloadMap {
  create_patient: {
    tempId: string;
    record: Database["public"]["Tables"]["patients"]["Insert"];
  };
  update_patient: {
    patientId: string;
    patch: Database["public"]["Tables"]["patients"]["Update"];
  };
  upsert_session: {
    tempId?: string;
    record: Database["public"]["Tables"]["sessions"]["Insert"];
  };
  delete_agenda_event: {
    eventId: string;
  };
  upsert_agenda_event: {
    tempId?: string;
    record: Database["public"]["Tables"]["agenda_events"]["Insert"];
  };
  sign_guardian_consent: {
    patientId: string;
    consentPayload: Json;
  };
  create_document_signature: CreateDocumentSignatureInput;
}

export interface OfflineOutboxItem<T extends OfflineMutationType = OfflineMutationType> {
  id: string;
  type: T;
  payload: OfflineMutationPayloadMap[T];
  createdAt: number;
  attempts: number;
  lastError?: string | null;
  status?: "pending" | "failed_permanent";
}

function isPermanentOutboxError(message: string, attempts: number): boolean {
  if (/Failed to fetch|NetworkError|Load failed|timeout|502|503|504/i.test(message)) {
    return false;
  }
  if (
    /42501|23503|23505|22P02|PGRST116|row-level security|violates|invalid input syntax|permission denied|not found/i.test(
      message
    )
  ) {
    return true;
  }
  return attempts >= 5;
}

export interface FlushOutboxResult {
  processed: number;
  failed: number;
  remaining: number;
}

let sequenceCounter = 0;
let activeFlushPromise: Promise<FlushOutboxResult> | null = null;

function buildSortableOutboxKey(createdAt: number): string {
  sequenceCounter = (sequenceCounter + 1) % 10000;
  const seq = String(sequenceCounter).padStart(4, "0");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${String(createdAt).padStart(15, "0")}_${seq}_${rand}`;
}

function applyReconciledRecordId<T extends { id?: string }>(record: T, tempId?: string): T {
  const next = { ...record };
  const existingServerId = tempId ? resolveOfflineEntityId(tempId) : null;
  if (existingServerId && existingServerId !== tempId && isUuid(existingServerId)) {
    next.id = existingServerId;
  } else if (next.id && !isUuid(next.id)) {
    delete next.id;
  }
  return next;
}

export async function refreshOfflineOutboxCount(): Promise<number> {
  const items = await getAllOutboxItems<OfflineOutboxItem>();
  const failedCount = items.filter((i) => i.status === "failed_permanent").length;
  const pendingCount = items.length - failedCount;
  setSyncStatus({ pendingCount, failedCount });
  return pendingCount;
}

export async function enqueueOfflineMutation<T extends OfflineMutationType>(
  type: T,
  payload: OfflineMutationPayloadMap[T]
): Promise<OfflineOutboxItem<T>> {
  const createdAt = Date.now();
  const item: OfflineOutboxItem<T> = {
    id: buildSortableOutboxKey(createdAt),
    type,
    payload,
    createdAt,
    attempts: 0,
    lastError: null,
  };

  await putOutboxItem(item.id, item);
  await refreshOfflineOutboxCount();
  return item;
}

async function executeOutboxItem(item: OfflineOutboxItem): Promise<void> {
  switch (item.type) {
    case "create_patient": {
      const { tempId, record } = item.payload as OfflineMutationPayloadMap["create_patient"];
      const existingServerId = resolveOfflineEntityId(tempId);
      if (existingServerId !== tempId && isUuid(existingServerId)) return;

      const payloadToInsert = applyReconciledRecordId(record);
      const { data, error } = await supabase
        .from("patients")
        .upsert(payloadToInsert, { onConflict: "id" })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Falha ao sincronizar criação do paciente.");
      }
      await registerReconciledId(tempId, data.id);
      return;
    }

    case "update_patient": {
      const { patientId, patch } = item.payload as OfflineMutationPayloadMap["update_patient"];
      const { error } = await supabase
        .from("patients")
        .update(patch)
        .eq("id", resolveOfflineEntityId(patientId));

      if (error) throw new Error(error.message);
      return;
    }

    case "upsert_session": {
      const { tempId, record } = item.payload as OfflineMutationPayloadMap["upsert_session"];
      const payloadToUpsert = applyReconciledRecordId(
        { ...record, patient_id: resolveOfflineEntityId(record.patient_id) },
        tempId
      );

      const { data, error } = await supabase
        .from("sessions")
        .upsert(payloadToUpsert, { onConflict: "id" })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Falha ao sincronizar sessão.");
      }
      if (tempId) await registerReconciledId(tempId, data.id);
      return;
    }

    case "upsert_agenda_event": {
      const { tempId, record } = item.payload as OfflineMutationPayloadMap["upsert_agenda_event"];
      const payloadToUpsert = applyReconciledRecordId(
        { ...record, patient_id: record.patient_id ? resolveOfflineEntityId(record.patient_id) : null },
        tempId
      );

      const { data, error } = await supabase
        .from("agenda_events")
        .upsert(payloadToUpsert, { onConflict: "id" })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Falha ao sincronizar agendamento.");
      }
      if (tempId) await registerReconciledId(tempId, data.id);
      return;
    }

    case "delete_agenda_event": {
      const { eventId } = item.payload as OfflineMutationPayloadMap["delete_agenda_event"];
      const resolvedEventId = resolveOfflineEntityId(eventId);
      if (!isUuid(resolvedEventId)) return;

      const { error } = await supabase.from("agenda_events").delete().eq("id", resolvedEventId);
      if (error) throw new Error(error.message);
      return;
    }

    case "sign_guardian_consent": {
      const { patientId, consentPayload } = item.payload as OfflineMutationPayloadMap["sign_guardian_consent"];
      const { error } = await supabase.rpc("update_patient_guardian_consent", {
        _patient_id: resolveOfflineEntityId(patientId),
        _consent_payload: consentPayload,
      });
      if (error) throw new Error(error.message);
      return;
    }

    case "create_document_signature": {
      const input = item.payload as OfflineMutationPayloadMap["create_document_signature"];
      await createDocumentSignatureRecord({
        ...input,
        patientId: resolveOfflineEntityId(input.patientId),
        sessionId: input.sessionId ? resolveOfflineEntityId(input.sessionId) : null,
      });
      return;
    }
  }
}

export function compactOfflineOutbox(items: OfflineOutboxItem[]): {
  compacted: OfflineOutboxItem[];
  droppedIds: string[];
} {
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const droppedIds: string[] = [];
  const result: OfflineOutboxItem[] = [];

  const patientCreateIdx = new Map<string, number>();
  const patientUpdateIdx = new Map<string, number>();
  const sessionUpsertIdx = new Map<string, number>();
  const agendaUpsertIdx = new Map<string, number>();

  for (const item of sorted) {
    if (item.type === "create_patient") {
      const p = item.payload as OfflineMutationPayloadMap["create_patient"];
      patientCreateIdx.set(p.tempId, result.length);
      result.push(item);
      continue;
    }

    if (item.type === "update_patient") {
      const p = item.payload as OfflineMutationPayloadMap["update_patient"];
      const createIdx = patientCreateIdx.get(p.patientId);
      if (createIdx !== undefined) {
        const prev = result[createIdx];
        const prevPayload = prev.payload as OfflineMutationPayloadMap["create_patient"];
        result[createIdx] = {
          ...prev,
          payload: { ...prevPayload, record: { ...prevPayload.record, ...p.patch } },
        };
        droppedIds.push(item.id);
        continue;
      }
      const prevUpdIdx = patientUpdateIdx.get(p.patientId);
      if (prevUpdIdx !== undefined) {
        const prev = result[prevUpdIdx];
        const prevPayload = prev.payload as OfflineMutationPayloadMap["update_patient"];
        droppedIds.push(prev.id);
        result[prevUpdIdx] = {
          ...item,
          payload: { patientId: p.patientId, patch: { ...prevPayload.patch, ...p.patch } },
        };
        continue;
      }
      patientUpdateIdx.set(p.patientId, result.length);
      result.push(item);
      continue;
    }

    if (item.type === "upsert_session") {
      const p = item.payload as OfflineMutationPayloadMap["upsert_session"];
      const key = p.tempId || p.record.id;
      if (key) {
        const prevIdx = sessionUpsertIdx.get(key);
        if (prevIdx !== undefined) {
          droppedIds.push(result[prevIdx].id);
          result[prevIdx] = item;
          continue;
        }
        sessionUpsertIdx.set(key, result.length);
      }
      result.push(item);
      continue;
    }

    if (item.type === "upsert_agenda_event") {
      const p = item.payload as OfflineMutationPayloadMap["upsert_agenda_event"];
      const key = p.tempId || p.record.id;
      if (key) {
        const prevIdx = agendaUpsertIdx.get(key);
        if (prevIdx !== undefined) {
          droppedIds.push(result[prevIdx].id);
          result[prevIdx] = item;
          continue;
        }
        agendaUpsertIdx.set(key, result.length);
      }
      result.push(item);
      continue;
    }

    if (item.type === "delete_agenda_event") {
      const p = item.payload as OfflineMutationPayloadMap["delete_agenda_event"];
      const prevIdx = agendaUpsertIdx.get(p.eventId);
      if (prevIdx !== undefined && !isUuid(p.eventId)) {
        droppedIds.push(result[prevIdx].id, item.id);
        result.splice(prevIdx, 1);
        agendaUpsertIdx.delete(p.eventId);
        continue;
      }
      result.push(item);
      continue;
    }

    result.push(item);
  }

  return { compacted: result, droppedIds };
}

export async function flushOfflineOutbox(): Promise<FlushOutboxResult> {
  if (activeFlushPromise) return activeFlushPromise;

  activeFlushPromise = (async (): Promise<FlushOutboxResult> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const remaining = await refreshOfflineOutboxCount();
      return { processed: 0, failed: 0, remaining };
    }

    await ensureReconciliationLoaded();
    const rawItems = await getAllOutboxItems<OfflineOutboxItem>();
    const syncableRaw = rawItems.filter((i) => i.status !== "failed_permanent");
    const { compacted: items, droppedIds } = compactOfflineOutbox(syncableRaw);
    for (const droppedId of droppedIds) {
      await deleteOutboxItem(droppedId);
    }

    if (items.length === 0) {
      await refreshOfflineOutboxCount();
      setSyncStatus({ isSyncing: false });
      return { processed: 0, failed: 0, remaining: 0 };
    }

    setSyncStatus({ isSyncing: true, pendingCount: items.length, lastError: null });
    let processed = 0;
    let failed = 0;

    try {
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        try {
          await executeOutboxItem(item);
          await deleteOutboxItem(item.id);
          processed++;
          setSyncStatus({ pendingCount: items.length - idx - 1, lastSyncedAt: Date.now() });
        } catch (err) {
          failed++;
          const nextAttempts = item.attempts + 1;
          const message = err instanceof Error ? err.message : "Erro ao sincronizar fila offline.";
          const permanent = isPermanentOutboxError(message, nextAttempts);
          await putOutboxItem(item.id, {
            ...item,
            attempts: nextAttempts,
            lastError: message,
            status: permanent ? "failed_permanent" : "pending",
          });
          setSyncStatus({ lastError: message });
          if (permanent) {
            continue;
          }
          break;
        }
      }
    } finally {
      const remaining = await refreshOfflineOutboxCount();
      setSyncStatus({ isSyncing: false, pendingCount: remaining });
    }

    const remaining = await refreshOfflineOutboxCount();
    return { processed, failed, remaining };
  })().finally(() => {
    activeFlushPromise = null;
  });

  return activeFlushPromise;
}

export async function retryFailedOfflineMutations(): Promise<FlushOutboxResult> {
  const items = await getAllOutboxItems<OfflineOutboxItem>();
  for (const item of items) {
    if (item.status === "failed_permanent") {
      await putOutboxItem(item.id, { ...item, status: "pending", attempts: 0, lastError: null });
    }
  }
  await refreshOfflineOutboxCount();
  return flushOfflineOutbox();
}

export async function discardFailedOfflineMutations(): Promise<number> {
  const items = await getAllOutboxItems<OfflineOutboxItem>();
  let removed = 0;
  for (const item of items) {
    if (item.status === "failed_permanent") {
      await deleteOutboxItem(item.id);
      removed++;
    }
  }
  await refreshOfflineOutboxCount();
  setSyncStatus({ lastError: null });
  return removed;
}

let outboxListenersRegistered = false;

export function initOfflineOutboxListeners(): void {
  if (outboxListenersRegistered || typeof window === "undefined") return;
  outboxListenersRegistered = true;

  void refreshOfflineOutboxCount().then((pending) => {
    if (pending > 0 && (typeof navigator === "undefined" || navigator.onLine)) {
      void flushOfflineOutbox();
    }
  });
  window.addEventListener("online", () => {
    void flushOfflineOutbox();
  });
}

initOfflineOutboxListeners();
