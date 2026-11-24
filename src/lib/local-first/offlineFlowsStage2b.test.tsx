import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import {
  clearLocalCache,
  getLocalCacheItem,
  getSyncMemoryCacheItem,
  setLocalCacheItem,
} from "@/lib/indexed-db-persister";
import * as idb from "@/lib/indexed-db-persister";
import { CLINIC_QUERY_KEYS, PATIENTS_CACHE_KEY } from "@/hooks/queries/useClinicDataQueries";
import {
  PATIENT_DETAIL_CACHE_KEY,
  PATIENT_QUERY_KEYS,
  type PatientRow,
} from "@/hooks/queries/usePatientDataQueries";
import {
  persistOfflineCreatedPatient,
  persistOfflineUpdatedPatient,
} from "./offlinePatientHelpers";
import * as offlineQueue from "./offlineMutationQueue";
import { computeSha256Hex, cacheOfflineGuardianConsent, cacheOfflineDocumentSignature } from "./offlineSignatureHelpers";
import {
  CLINIC_DOC_TEMPLATES_CACHE_KEY,
  useDocumentTemplates,
} from "@/components/patients/generate-document/useDocumentTemplates";
import {
  enqueuePatientFileUpload,
  flushOfflineFileUploads,
  getPatientFileUploadQueueSnapshot,
  removePatientFileUploadQueueItem,
} from "@/lib/patient-file-upload-queue";
import { supabase } from "@/integrations/supabase/client";

describe("Etapa 2B - Offline-First Patient, Upload & Signature Flows", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearLocalCache();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: originalOnLine });
  });

  it("1. persists offline-created patient with UUID v4 + PAC-OFF-XXXX in QueryClient, IndexedDB and outbox", async () => {
    const queryClient = new QueryClient();
    const enqueueSpy = vi.spyOn(offlineQueue, "enqueueOfflineMutation").mockResolvedValue({
      id: "outbox-1",
      type: "create_patient",
      payload: {} as never,
      createdAt: Date.now(),
      attempts: 0,
    });

    const created = await persistOfflineCreatedPatient(queryClient, {
      clinicId: "clinic-1",
      userId: "user-1",
      name: "Ana Offline Silva",
      dateOfBirth: "1995-03-20",
      age: 31,
      cpf: "52998224725",
      rg: null,
      phone: "11999998888",
      email: "ana@offline.com",
      gender: "feminino",
      pronoun: "ela/dela",
      usesResponsibleCpf: false,
      responsibleCpf: null,
      responsibleName: null,
      responsibleRelationship: null,
      isExclusive: false,
      exclusiveUserIds: [],
    });

    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(created.patient_code).toMatch(/^PAC-OFF-[0-9A-F]{4}$/);

    const clinicPatients = queryClient.getQueryData<Array<{ id: string }>>(CLINIC_QUERY_KEYS.patients("clinic-1"));
    expect(clinicPatients?.some((p) => p.id === created.id)).toBe(true);

    const detailById = queryClient.getQueryData<PatientRow>(PATIENT_QUERY_KEYS.patient(created.id, "clinic-1"));
    expect(detailById?.name).toBe("Ana Offline Silva");

    const cachedDetail = getSyncMemoryCacheItem<PatientRow>(PATIENT_DETAIL_CACHE_KEY("clinic-1", created.id));
    expect(cachedDetail?.patient_code).toBe(created.patient_code);

    const cachedList = await getLocalCacheItem<Array<{ id: string }>>(PATIENTS_CACHE_KEY("clinic-1"));
    expect(cachedList?.some((p) => p.id === created.id)).toBe(true);

    expect(enqueueSpy).toHaveBeenCalledWith(
      "create_patient",
      expect.objectContaining({
        tempId: created.id,
        record: expect.objectContaining({ id: created.id, name: "Ana Offline Silva", patient_code: null }),
      })
    );
  });

  it("2. updates L1/L2 caches optimistically and enqueues update_patient when offline", async () => {
    const queryClient = new QueryClient();
    const enqueueSpy = vi.spyOn(offlineQueue, "enqueueOfflineMutation").mockResolvedValue({
      id: "outbox-2",
      type: "update_patient",
      payload: {} as never,
      createdAt: Date.now(),
      attempts: 0,
    });

    const basePatient = {
      id: "pat-uuid-1",
      clinic_id: "clinic-1",
      user_id: "user-1",
      patient_code: "PAC-001",
      name: "Carlos Atualizado",
      status: "ativo",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      version: 1,
    } as PatientRow;

    await persistOfflineUpdatedPatient(queryClient, basePatient, "PAC-001", "clinic-1", "clinica-teste");

    expect(
      getSyncMemoryCacheItem<PatientRow>(PATIENT_DETAIL_CACHE_KEY("clinic-1", "pat-uuid-1"))?.name
    ).toBe("Carlos Atualizado");
    expect(
      queryClient.getQueryData<PatientRow>(PATIENT_QUERY_KEYS.patient("PAC-001", "clinic-1"))?.name
    ).toBe("Carlos Atualizado");

    expect(enqueueSpy).toHaveBeenCalledWith(
      "update_patient",
      expect.objectContaining({
        patientId: "pat-uuid-1",
        patch: expect.objectContaining({ name: "Carlos Atualizado" }),
      })
    );
  });

  it("3. queues processed file blob offline and flushes to B2 when back online", async () => {
    const blobStore = new Map<string, unknown>();
    const putBlobSpy = vi.spyOn(idb, "putOfflineBlob").mockImplementation(async (k, v) => {
      blobStore.set(k, v);
      return true;
    });
    vi.spyOn(idb, "getOfflineBlob").mockImplementation(async <T,>(k: string) => (blobStore.get(k) as T) ?? null);
    const deleteBlobSpy = vi.spyOn(idb, "deleteOfflineBlob").mockImplementation(async (k) => {
      blobStore.delete(k);
      return true;
    });

    const processedBlob = new Blob(["pdf-content"], { type: "application/pdf" });
    class MockWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage({ jobId }: { jobId: string }) {
        queueMicrotask(() => {
          this.onmessage?.({
            data: {
              jobId,
              ok: true,
              result: {
                blob: processedBlob,
                checksumSha256: "abc123sha",
                compressionProfile: "pdf-pass-through",
                filename: "exame.pdf",
                imageHeight: null,
                imageWidth: null,
                originalByteSize: 11,
                originalContentType: "application/pdf",
                pageCount: 1,
                storageEncoding: null,
                storedByteSize: 11,
                storedContentType: "application/pdf",
              },
            },
          } as MessageEvent);
        });
      }
      terminate() {}
    }

    const originalWorker = globalThis.Worker;
    globalThis.Worker = MockWorker as unknown as typeof Worker;

    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });

    const file = new File(["pdf-content"], "exame.pdf", { type: "application/pdf" });
    const jobId = enqueuePatientFileUpload({
      clinicId: "clinic-1",
      patientId: "pat-1",
      file,
    });

    await waitFor(() => {
      expect(putBlobSpy).toHaveBeenCalledWith(jobId, expect.objectContaining({ jobId, patientId: "pat-1" }));
      const queuedItem = getPatientFileUploadQueueSnapshot().find((i) => i.id === jobId);
      expect(queuedItem?.status).toBe("queued");
      expect(queuedItem?.offlineMessage).toContain("offline");
    });

    // Simulate coming back online with deduplicated B2 response
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const invokeMock = vi.fn().mockResolvedValue({
      data: { uploadId: "up-123", deduplicatedFrom: "existing-up" },
      error: null,
    });
    vi.spyOn(supabase, "functions", "get").mockReturnValue({ invoke: invokeMock } as never);

    const flushRes = await flushOfflineFileUploads();
    expect(invokeMock).toHaveBeenCalledWith("b2-upload-url", expect.anything());
    expect(flushRes.uploaded).toBe(1);
    expect(deleteBlobSpy).toHaveBeenCalledWith(jobId);
    expect(getPatientFileUploadQueueSnapshot().find((i) => i.id === jobId)?.status).toBe("uploaded");

    removePatientFileUploadQueueItem(jobId);
    globalThis.Worker = originalWorker;
  });

  it("4. caches clinic templates + CNPJ and falls back immediately when offline + computes SHA-256 signature", async () => {
    await setLocalCacheItem(CLINIC_DOC_TEMPLATES_CACHE_KEY("clinic-99"), {
      clinicCnpj: "12345678000190",
      standardAdultContent: "# Termo Customizado Clínica 99",
      standardMinorContent: "# Termo Menor Clínica 99",
      customTemplates: [{ id: "tpl-1", title: "Anamnese", category: "custom", content: "Texto", isCustom: true }],
    });

    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const fromSpy = vi.spyOn(supabase, "from");

    const { result } = renderHook(() =>
      useDocumentTemplates({ open: true, clinicId: "clinic-99" })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fromSpy).not.toHaveBeenCalled();
    expect(result.current.clinicCnpj).toBe("12345678000190");
    expect(result.current.availableTemplates.some((t) => t.id === "tpl-1")).toBe(true);

    const hash = await computeSha256Hex("termo-assinado-teste");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    await cacheOfflineGuardianConsent("pat-1", "clinic-1", { status: "signed", signature_hash_sha256: hash });
    const cachedConsent = await getLocalCacheItem<{ signature_hash_sha256: string }>("guardian_consent_pat-1");
    expect(cachedConsent?.signature_hash_sha256).toBe(hash);

    await cacheOfflineDocumentSignature("pat-1", "tok-1", { id: "sig-1", sign_token: "tok-1", sha256: hash });
    const cachedDocSig = await getLocalCacheItem<{ sha256: string }>("doc_signature_pat-1_tok-1");
    expect(cachedDocSig?.sha256).toBe(hash);
  });
});
