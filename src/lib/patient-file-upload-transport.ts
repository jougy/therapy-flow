import { supabase } from "@/integrations/supabase/client";
import { createAppDiagnosticError, type AppDiagnosticError, type AppDiagnosticStage } from "@/lib/app-diagnostics";

export class PatientFileUploadDiagnosticException extends Error {
  diagnosticError: AppDiagnosticError;

  constructor(diagnosticError: AppDiagnosticError) {
    super(diagnosticError.originalMessage);
    this.name = "PatientFileUploadDiagnosticException";
    this.diagnosticError = diagnosticError;
  }
}

export const createUploadDiagnosticException = ({
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

export const uploadWithProgress = ({
  blob,
  context,
  headers,
  onProgress,
  uploadUrl,
}: {
  blob: Blob;
  context: Record<string, string | number | null>;
  headers: Record<string, string>;
  onProgress: (progress: number) => void;
  uploadUrl: string;
}) =>
  new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    Object.entries(headers).forEach(([key, value]) => request.setRequestHeader(key, value));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(92, 40 + Math.round((event.loaded / event.total) * 50)));
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

export const invokePatientFileEdgeFunction = async <TData>(
  functionName: "b2-confirm-upload" | "b2-delete-upload" | "b2-upload-url",
  body: Record<string, unknown>,
  context: Record<string, string | number | null>,
  stage: AppDiagnosticStage,
) => {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    let status = 400;
    let message = error.message;
    let technicalDetails: unknown = error;

    if ("context" in error && error.context && typeof error.context === "object") {
      const resp = error.context as Response;
      if (resp.status) status = resp.status;
      try {
        const cloned = resp.clone();
        const jsonBody = await cloned.json();
        if (jsonBody && typeof jsonBody === "object") {
          technicalDetails = jsonBody;
          if (typeof jsonBody.error === "string") {
            message = jsonBody.error;
          }
        }
      } catch {
        try {
          const text = await resp.clone().text();
          if (text) message = text;
        } catch {
          // ignora
        }
      }
    }

    throw createUploadDiagnosticException({
      context,
      error: new Error(message),
      functionName,
      stage,
      status,
      technicalDetails,
    });
  }

  return data as TData;
};
