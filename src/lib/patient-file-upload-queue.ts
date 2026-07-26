import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createAppDiagnosticError, type AppDiagnosticError, type AppDiagnosticStage } from "@/lib/app-diagnostics";
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

class PatientFileUploadDiagnosticException extends Error {
  diagnosticError: AppDiagnosticError;

  constructor(diagnosticError: AppDiagnosticError) {
    super(diagnosticError.originalMessage);
    this.name = "PatientFileUploadDiagnosticException";
    this.diagnosticError = diagnosticError;
  }
}

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

const uploadWithProgress = ({
  blob,
  context,
  headers,
  jobId,
  uploadUrl,
}: {
  blob: Blob;
  context: Record<string, string | number | null>;
  headers: Record<string, string>;
  jobId: string;
  uploadUrl: string;
}) =>
  new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    Object.entries(headers).forEach(([key, value]) => request.setRequestHeader(key, value));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        patchItem(jobId, { progress: Math.min(92, 40 + Math.round((event.loaded / event.total) * 50)) });
      }
    };
    request.onerror = () => reject(new PatientFileUploadDiagnosticException(createAppDiagnosticError({
      category: "network",
      context,
      error: new Error("Falha de rede durante o upload."),
      probableCause: "A conexão pode ter caído, o navegador bloqueou a requisição ou o storage não respondeu.",
      stage: "Enviar para storage",
      title: "Falha de rede no envio ao Backblaze",
    })));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      reject(new PatientFileUploadDiagnosticException(createAppDiagnosticError({
        category: "storage",
        context,
        error: new Error(`Backblaze recusou o upload (${request.status}).`),
        probableCause: "A assinatura da URL, o CORS, o content-type ou a permissão do bucket podem estar divergentes.",
        stage: "Enviar para storage",
        status: request.status,
        technicalDetails: request.responseText,
        title: "Backblaze recusou o upload",
      })));
    };
    request.send(blob);
  });

const getUploadContext = (input: EnqueuePatientFileUploadInput, file: File | PatientFileUploadProcessedFile) => ({
  clinicId: input.clinicId,
  contentType: "type" in file ? file.type : file.storedContentType,
  fileName: "name" in file ? file.name : file.filename,
  fileSize: "size" in file ? file.size : file.storedByteSize,
  patientId: input.patientId,
  sessionId: input.sessionId ?? null,
});

const createUploadDiagnosticException = ({
  context,
  error,
  functionName,
  stage,
  status,
  technicalDetails,
}: {
  context: Record<string, string | number | null>;
  error: unknown;
  functionName?: string;
  stage: AppDiagnosticStage;
  status?: number;
  technicalDetails?: unknown;
}) =>
  new PatientFileUploadDiagnosticException(createAppDiagnosticError({
    category: functionName ? "edge_function" : stage === "Processar arquivo" ? "processing" : "unknown",
    context,
    error,
    functionName,
    stage,
    status,
    technicalDetails,
  }));

const invokePatientFileEdgeFunction = async <TData>(
  functionName: "b2-confirm-upload" | "b2-delete-upload" | "b2-upload-url",
  body: Record<string, unknown>,
  context: Record<string, string | number | null>,
  stage: AppDiagnosticStage,
) => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw createUploadDiagnosticException({
      context,
      error: sessionError ?? new Error("Sessão ausente para chamar a Edge Function."),
      functionName,
      stage,
      status: 401,
    });
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const responseText = await response.text();
  let payload: unknown = responseText;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = responseText;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error)
        : `Edge Function returned a non-2xx status code (${response.status}).`;
    throw createUploadDiagnosticException({
      context,
      error: new Error(message),
      functionName,
      stage,
      status: response.status,
      technicalDetails: payload,
    });
  }

  return payload as TData;
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

  patchItem(jobId, { fileName: processed.filename, progress: 35, status: "uploading" });
  const processedContext = getUploadContext(input, processed);

  const uploadData = await invokePatientFileEdgeFunction<{ headers?: Record<string, string>; uploadId?: string; uploadUrl?: string }>("b2-upload-url", {
    byteSize: processed.storedByteSize,
    category: getPatientUploadCategoryFromContentType(processed.originalContentType),
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

  const uploadUrl = String(uploadData?.uploadUrl ?? "");
  const uploadId = String(uploadData?.uploadId ?? "");
  const headers = (uploadData?.headers ?? {}) as Record<string, string>;

  if (!uploadUrl || !uploadId) {
    throw createUploadDiagnosticException({
      context: processedContext,
      error: new Error("O servidor não retornou a URL de upload."),
      functionName: "b2-upload-url",
      stage: "Preparar upload",
      technicalDetails: uploadData,
    });
  }

  patchItem(jobId, { progress: 42, uploadId });
  await uploadWithProgress({ blob: processed.blob, context: { ...processedContext, uploadId }, headers, jobId, uploadUrl });

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
};

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
