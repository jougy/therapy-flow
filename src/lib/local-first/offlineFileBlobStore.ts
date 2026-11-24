import {
  deleteOfflineBlob,
  getLocalCacheItem,
  getOfflineBlob,
  putOfflineBlob,
  setLocalCacheItem,
} from "@/lib/indexed-db-persister";
import type { PatientFileUploadProcessedFile } from "@/lib/patient-file-uploads";

export const OFFLINE_FILE_UPLOAD_INDEX_KEY = "offline_file_upload_index";

export interface OfflineFileBlobRecord {
  jobId: string;
  clinicId: string;
  patientId: string;
  sessionId: string | null;
  processed: PatientFileUploadProcessedFile;
  createdAt: number;
}

export async function getPendingOfflineFileBlobIds(): Promise<string[]> {
  const index = await getLocalCacheItem<string[]>(OFFLINE_FILE_UPLOAD_INDEX_KEY);
  if (!Array.isArray(index)) return [];
  return Array.from(new Set(index.filter((id): id is string => typeof id === "string" && id.length > 0)));
}

export async function persistOfflineFileBlob(record: OfflineFileBlobRecord): Promise<boolean> {
  const stored = await putOfflineBlob(record.jobId, record);
  if (!stored) return false;

  const currentIds = await getPendingOfflineFileBlobIds();
  if (!currentIds.includes(record.jobId)) {
    await setLocalCacheItem(OFFLINE_FILE_UPLOAD_INDEX_KEY, [...currentIds, record.jobId], 7 * 24 * 60 * 60 * 1000);
  }
  return true;
}

export async function loadOfflineFileBlob(jobId: string): Promise<OfflineFileBlobRecord | null> {
  return getOfflineBlob<OfflineFileBlobRecord>(jobId);
}

export async function clearOfflineFileBlob(jobId: string): Promise<void> {
  await deleteOfflineBlob(jobId);
  const currentIds = await getPendingOfflineFileBlobIds();
  if (currentIds.includes(jobId)) {
    const nextIds = currentIds.filter((id) => id !== jobId);
    await setLocalCacheItem(OFFLINE_FILE_UPLOAD_INDEX_KEY, nextIds, 7 * 24 * 60 * 60 * 1000);
  }
}
