export const PATIENT_FILE_UPLOAD_MAX_BYTES = 52_428_800;
export const PATIENT_FILE_IMAGE_MAX_DIMENSION = 2_200;
export const PATIENT_FILE_IMAGE_WEBP_QUALITY = 0.82;

export const PATIENT_FILE_UPLOAD_ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type PatientFileUploadContentType = (typeof PATIENT_FILE_UPLOAD_ALLOWED_TYPES)[number];
export type PatientFileUploadCategory = "anamnesis" | "exam" | "image" | "document" | "other";
export type PatientFileUploadStatus = "pending" | "uploaded" | "failed" | "deleted";
export type PatientFileUploadQueueStatus = "queued" | "processing" | "uploading" | "confirming" | "uploaded" | "failed";
export type PatientFileStorageEncoding = "gzip" | "deflate";

export interface PatientFileUploadCandidate {
  name: string;
  size: number;
  type: string;
}

export interface PatientFileUploadProcessingMetadata {
  compressionProfile: string;
  imageHeight?: number | null;
  imageWidth?: number | null;
  originalByteSize: number;
  originalContentType: string;
  pageCount?: number | null;
  storageEncoding?: PatientFileStorageEncoding | null;
  storedByteSize: number;
  storedContentType: PatientFileUploadContentType;
}

export interface PatientFileUploadProcessedFile extends PatientFileUploadProcessingMetadata {
  blob: Blob;
  checksumSha256: string;
  filename: string;
}

const allowedTypeSet = new Set<string>(PATIENT_FILE_UPLOAD_ALLOWED_TYPES);

export const normalizePatientUploadContentType = (value: string | null | undefined, filename?: string) => {
  const normalized = (value ?? "").split(";")[0].trim().toLowerCase();
  if (normalized && allowedTypeSet.has(normalized)) return normalized;

  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "application/pdf";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "webp") return "image/webp";
    if (ext === "heic") return "image/heic";
    if (ext === "heif") return "image/heif";
    if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (ext === "doc") return "application/msword";
  }

  return normalized;
};

export const isPatientUploadContentTypeAllowed = (value: string | null | undefined, filename?: string): value is PatientFileUploadContentType =>
  allowedTypeSet.has(normalizePatientUploadContentType(value, filename));

export const getPatientUploadCategoryFromContentType = (value: string | null | undefined, filename?: string): PatientFileUploadCategory => {
  const contentType = normalizePatientUploadContentType(value, filename);
  if (
    contentType === "application/pdf" ||
    contentType === "application/msword" ||
    contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "document";
  }
  if (contentType.startsWith("image/")) return "image";
  return "other";
};

export const validatePatientFileUploadCandidate = (file: PatientFileUploadCandidate) => {
  const errors: string[] = [];
  const filename = file.name.trim();
  const contentType = normalizePatientUploadContentType(file.type, filename);

  if (!filename) {
    errors.push("O arquivo precisa ter nome.");
  }

  if (!isPatientUploadContentTypeAllowed(contentType, filename)) {
    errors.push("Envie apenas PDF, DOC/DOCX ou imagens nos formatos JPEG, PNG, WebP, HEIC ou HEIF.");
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    errors.push("O arquivo está vazio ou inválido.");
  } else if (file.size > PATIENT_FILE_UPLOAD_MAX_BYTES) {
    errors.push("O arquivo precisa ter no máximo 50 MB.");
  }

  return {
    contentType,
    errors,
    isValid: errors.length === 0,
  };
};

export const formatPatientFileSize = (bytes: number | null | undefined) => {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export const getPatientFileCompressionRatio = (originalBytes: number | null | undefined, storedBytes: number | null | undefined) => {
  const original = Number(originalBytes ?? 0);
  const stored = Number(storedBytes ?? 0);
  if (!Number.isFinite(original) || !Number.isFinite(stored) || original <= 0 || stored <= 0 || stored >= original) {
    return 0;
  }

  return Math.round((1 - stored / original) * 100);
};

export const shouldUseProcessedPatientFile = (originalBytes: number, processedBytes: number) =>
  Number.isFinite(originalBytes) &&
  Number.isFinite(processedBytes) &&
  processedBytes > 0 &&
  processedBytes < originalBytes * 0.98;

export const shouldUseClinicalRasterPdf = (originalBytes: number, processedBytes: number) =>
  Number.isFinite(originalBytes) &&
  Number.isFinite(processedBytes) &&
  processedBytes > 0 &&
  processedBytes < originalBytes * 0.9;

export const buildPatientFileObjectPrefix = ({
  clinicId,
  patientId,
  sessionId,
}: {
  clinicId: string;
  patientId: string;
  sessionId?: string | null;
}) => `clinics/${clinicId}/patients/${patientId}/sessions/${sessionId || "general"}/files`;
