import { useSyncExternalStore } from "react";
import { createAppDiagnosticError, type AppDiagnosticError } from "@/lib/app-diagnostics";
import { isOfflineOrNetworkError } from "@/lib/local-first/networkError";
import {
  clearOfflineFileBlob,
  getPendingOfflineFileBlobIds,
  loadOfflineFileBlob,
  persistOfflineFileBlob,
} from "@/lib/local-first/offlineFileBlobStore";
import { resolveOfflineEntityId } from "@/lib/local-first/reconciliationMap";
import {
  createUploadDiagnosticException,
  invokePatientFileEdgeFunction,
  PatientFileUploadDiagnosticException,
  uploadWithProgress,
} from "@/lib/patient-file-upload-transport";
import {
  getPatientUploadCategoryFromContentType,
  normalizePatientUploadContentType,
  validatePatientFileUploadCandidate,
  type PatientFileUploadProcessedFile,
  type PatientFileUploadQueueStatus,
} from "@/lib/patient-file-uploads";

type ProcessWorkerSuccess = {
  blob: Blob;
  checksumSha256: string;
  compressionProfile: string;
  filename: string;
  imageHeight: number | null;
  imageWidth: number | null;
  originalByteSize: number;
  originalContentType: string;
  pageCount: number | null;
  storageEncoding: "gzip" | "deflate" | null;
  storedByteSize: number;
  storedContentType: string;
};

type ProcessWorkerResponse =
  | { jobId: string; ok: true; result: ProcessWorkerSuccess }
  | { error: string; jobId: string; ok: false };

export type PatientFileUploadQueueItem = {
  clinicId: string;
  diagnosticError: AppDiagnosticError | null;
  error: string | null;
  fileName: string;
  id: string;
  offlineMessage?: string | null;
  patientId: string;
  progress: number;
  sessionId: string | null;
  status: PatientFileUploadQueueStatus;
  uploadId: string | null;
};

export type EnqueuePatientFileUploadInput = {
  clinicId: string;
  file: File;
  patientId: string;
  sessionId?: string | null;
};

const listeners = new Set<() => void>();
let items: PatientFileUploadQueueItem[] = [];
let worker: Worker | null = null;
const pendingResolvers = new Map<string, { reject: (error: Error) => void; resolve: (file: PatientFileUploadProcessedFile) => void }>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const patchItem = (id: string, changes: Partial<PatientFileUploadQueueItem>) => {
  items = items.map((item) => (item.id === id ? { ...item, ...changes } : item));
  emit();
};

const getWorker = () => {
  if (worker) return worker;

  worker = new Worker(new URL("./patient-file-processing.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<ProcessWorkerResponse>) => {
    const message = event.data;
    const resolver = pendingResolvers.get(message.jobId);
    if (!resolver) return;
    pendingResolvers.delete(message.jobId);

    if (!message.ok) {
      resolver.reject(new Error(message.error));
      return;
    }

    resolver.resolve({
      ...message.result,
      storedContentType: message.result.storedContentType as PatientFileUploadProcessedFile["storedContentType"],
    });
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || "Falha no processador de arquivos.");
    pendingResolvers.forEach(({ reject }) => reject(error));
    pendingResolvers.clear();
    worker?.terminate();
    worker = null;
  };

  return worker;
};

const processFile = (jobId: string, file: File) =>
  new Promise<PatientFileUploadProcessedFile>((resolve, reject) => {
    pendingResolvers.set(jobId, { reject, resolve });
    getWorker().postMessage({ file, jobId });
  });

const getUploadContext = (input: EnqueuePatientFileUploadInput, file: File | PatientFileUploadProcessedFile) => ({
  clinicId: input.clinicId,
  contentType: "type" in file ? file.type : file.storedContentType,
  fileName: "name" in file ? file.name : file.filename,
  fileSize: "size" in file ? file.size : file.storedByteSize,
  patientId: input.patientId,
  sessionId: input.sessionId ?? null,
});

const uploadProcessedFile = async (
  input: { clinicId: string; patientId: string; sessionId?: string | null },
  jobId: string,
  processed: PatientFileUploadProcessedFile,
) => {
  patchItem(jobId, { fileName: processed.filename, offlineMessage: null, progress: 35, status: "uploading" });
  const processedContext = {
    clinicId: input.clinicId,
    contentType: processed.storedContentType,
    fileName: processed.filename,
    fileSize: processed.storedByteSize,
    patientId: input.patientId,
    sessionId: input.sessionId ?? null,
  };

  const uploadData = await invokePatientFileEdgeFunction<{
    deduplicatedFrom?: string;
    headers?: Record<string, string>;
    uploadId?: string;
    uploadUrl?: string | null;
  }>("b2-upload-url", {
    byteSize: processed.storedByteSize,
    category: getPatientUploadCategoryFromContentType(processed.originalContentType, processed.filename),
    checksumSha256: processed.checksumSha256,
    clinicId: input.clinicId,
    compressionProfile: processed.compressionProfile,
    contentType: processed.storedContentType,
    filename: processed.filename,
    imageHeight: processed.imageHeight,
    imageWidth: processed.imageWidth,
    originalByteSize: processed.originalByteSize,
    originalContentType: processed.originalContentType,
    pageCount: processed.pageCount,
    patientId: input.patientId,
    sessionId: input.sessionId ?? null,
    storageEncoding: processed.storageEncoding,
    storedByteSize: processed.storedByteSize,
    storedContentType: processed.storedContentType,
  }, processedContext, "Preparar upload");

  const uploadId = String(uploadData?.uploadId ?? "");
  if (!uploadId) {
    throw createUploadDiagnosticException({
      context: processedContext,
      error: new Error("O servidor não retornou o ID de upload."),
      functionName: "b2-upload-url",
      stage: "Preparar upload",
      technicalDetails: uploadData,
    });
  }

  patchItem(jobId, { progress: 42, uploadId });

  if (uploadData?.deduplicatedFrom) {
    patchItem(jobId, { progress: 100, status: "uploaded" });
    window.dispatchEvent(new CustomEvent("patient-file-uploads-updated", {
      detail: {
        deduplicatedFrom: uploadData.deduplicatedFrom,
        patientId: input.patientId,
        sessionId: input.sessionId ?? null,
        uploadId,
      },
    }));
    return;
  }

  const uploadUrl = String(uploadData?.uploadUrl ?? "");
  const headers = (uploadData?.headers ?? {}) as Record<string, string>;
  if (!uploadUrl) {
    throw createUploadDiagnosticException({
      context: processedContext,
      error: new Error("O servidor não retornou a URL de upload."),
      functionName: "b2-upload-url",
      stage: "Preparar upload",
      technicalDetails: uploadData,
    });
  }

  await uploadWithProgress({
    blob: processed.blob,
    context: { ...processedContext, uploadId },
    headers,
    onProgress: (progress) => patchItem(jobId, { progress }),
    uploadUrl,
  });

  patchItem(jobId, { progress: 95, status: "confirming" });
  await invokePatientFileEdgeFunction("b2-confirm-upload", { uploadId }, { ...processedContext, uploadId }, "Confirmar upload");

  patchItem(jobId, { progress: 100, status: "uploaded" });
  window.dispatchEvent(new CustomEvent("patient-file-uploads-updated", {
    detail: {
      patientId: input.patientId,
      sessionId: input.sessionId ?? null,
      uploadId,
    },
  }));
};

const queueOfflineProcessedFile = async (
  input: { clinicId: string; patientId: string; sessionId?: string | null },
  jobId: string,
  processed: PatientFileUploadProcessedFile,
) => {
  await persistOfflineFileBlob({
    clinicId: input.clinicId,
    createdAt: Date.now(),
    jobId,
    patientId: input.patientId,
    processed,
    sessionId: input.sessionId ?? null,
  });
  patchItem(jobId, {
    diagnosticError: null,
    error: null,
    fileName: processed.filename,
    offlineMessage: "Salvo offline — envio automático ao reconectar.",
    progress: 35,
    status: "queued",
  });
};

const startUpload = async (input: EnqueuePatientFileUploadInput, jobId: string) => {
  const validation = validatePatientFileUploadCandidate(input.file);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(" "));
  }

  const initialContext = getUploadContext(input, input.file);

  patchItem(jobId, { progress: 5, status: "processing" });
  let processed: PatientFileUploadProcessedFile;
  try {
    processed = await processFile(jobId, input.file);
  } catch (error) {
    throw createUploadDiagnosticException({
      context: initialContext,
      error,
      stage: "Processar arquivo",
    });
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await queueOfflineProcessedFile(input, jobId, processed);
    return;
  }

  try {
    await uploadProcessedFile(input, jobId, processed);
  } catch (error) {
    if (isOfflineOrNetworkError(error)) {
      await queueOfflineProcessedFile(input, jobId, processed);
      return;
    }
    throw error;
  }
};

export const enqueuePatientFileUpload = (input: EnqueuePatientFileUploadInput) => {
  const id = crypto.randomUUID();
  const item: PatientFileUploadQueueItem = {
    clinicId: input.clinicId,
    diagnosticError: null,
    error: null,
    fileName: input.file.name,
    id,
    patientId: input.patientId,
    progress: 0,
    sessionId: input.sessionId ?? null,
    status: "queued",
    uploadId: null,
  };

  items = [item, ...items].slice(0, 30);
  emit();

  void startUpload(input, id).catch((error) => {
    const diagnosticError =
      error instanceof PatientFileUploadDiagnosticException
        ? error.diagnosticError
        : createAppDiagnosticError({
            context: {
              clinicId: input.clinicId,
              fileName: input.file.name,
              fileSize: input.file.size,
              patientId: input.patientId,
              sessionId: input.sessionId ?? null,
            },
            error,
            stage: "Erro técnico",
          });

    patchItem(id, {
      diagnosticError,
      error: diagnosticError.humanSummary,
      status: "failed",
    });
  });

  return id;
};

export const retryPatientFileUpload = (_id: string) => {
  // A v1 não persiste o Blob original fora da memória da tentativa em execução.
};

export const clearFinishedPatientFileUploads = () => {
  items = items.filter((item) => item.status !== "uploaded" && item.status !== "failed");
  emit();
};

export const removePatientFileUploadQueueItem = (id: string) => {
  items = items.filter((item) => item.id !== id);
  emit();
  void clearOfflineFileBlob(id);
};

let activeOfflineFlushPromise: Promise<{ uploaded: number; failed: number }> | null = null;

export const flushOfflineFileUploads = async (): Promise<{ uploaded: number; failed: number }> => {
  if (activeOfflineFlushPromise) return activeOfflineFlushPromise;

  activeOfflineFlushPromise = (async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { uploaded: 0, failed: 0 };
    }

    const indexedIds = await getPendingOfflineFileBlobIds();
    const memoryQueuedIds = items.filter((item) => item.status === "queued").map((item) => item.id);
    const pendingIds = Array.from(new Set([...indexedIds, ...memoryQueuedIds]));
    let uploaded = 0;
    let failed = 0;

    for (const jobId of pendingIds) {
      const record = await loadOfflineFileBlob(jobId);
      if (!record?.processed?.blob) {
        await clearOfflineFileBlob(jobId);
        continue;
      }

      if (!items.some((item) => item.id === jobId)) {
        items = [{
          clinicId: record.clinicId,
          diagnosticError: null,
          error: null,
          fileName: record.processed.filename,
          id: jobId,
          offlineMessage: null,
          patientId: record.patientId,
          progress: 35,
          sessionId: record.sessionId,
          status: "uploading",
          uploadId: null,
        }, ...items].slice(0, 30);
        emit();
      }

      const resolvedPatientId = resolveOfflineEntityId(record.patientId);
      const resolvedSessionId = record.sessionId ? resolveOfflineEntityId(record.sessionId) : null;

      try {
        await uploadProcessedFile(
          { clinicId: record.clinicId, patientId: resolvedPatientId, sessionId: resolvedSessionId },
          jobId,
          record.processed,
        );
        await clearOfflineFileBlob(jobId);
        uploaded += 1;
      } catch (error) {
        if (isOfflineOrNetworkError(error)) {
          patchItem(jobId, {
            offlineMessage: "Salvo offline — envio automático ao reconectar.",
            progress: 35,
            status: "queued",
          });
          break;
        }
        const diagnosticError = error instanceof PatientFileUploadDiagnosticException
          ? error.diagnosticError
          : createAppDiagnosticError({
              context: {
                clinicId: record.clinicId,
                fileName: record.processed.filename,
                fileSize: record.processed.storedByteSize,
                patientId: resolvedPatientId,
                sessionId: resolvedSessionId,
              },
              error,
              stage: "Erro técnico",
            });
        patchItem(jobId, { diagnosticError, error: diagnosticError.humanSummary, offlineMessage: null, status: "failed" });
        await clearOfflineFileBlob(jobId);
        failed += 1;
      }
    }

    return { uploaded, failed };
  })().finally(() => {
    activeOfflineFlushPromise = null;
  });

  return activeOfflineFlushPromise;
};

let offlineUploadListenersRegistered = false;
if (typeof window !== "undefined" && !offlineUploadListenersRegistered) {
  offlineUploadListenersRegistered = true;
  window.addEventListener("online", () => {
    void flushOfflineFileUploads();
  });
}

export const deleteUploadedPatientFile = async ({
  clinicId,
  fileName,
  patientId,
  sessionId,
  uploadId,
}: {
  clinicId: string;
  fileName: string;
  patientId: string;
  sessionId: string | null;
  uploadId: string;
}) =>
  invokePatientFileEdgeFunction("b2-delete-upload", { uploadId }, {
    clinicId,
    fileName,
    patientId,
    sessionId,
    uploadId,
  }, "Descartar arquivo");

export const getPatientFileUploadQueueSnapshot = () => items;

export const subscribePatientFileUploadQueue = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const usePatientFileUploadQueue = () =>
  useSyncExternalStore(subscribePatientFileUploadQueue, getPatientFileUploadQueueSnapshot, getPatientFileUploadQueueSnapshot);

export const isPatientFileUploadImage = (contentType: string | null | undefined) =>
  normalizePatientUploadContentType(contentType).startsWith("image/");
