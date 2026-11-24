import type { Json } from "@/integrations/supabase/types";
import { getLocalCacheItem, setLocalCacheItem } from "@/lib/indexed-db-persister";
import { PATIENT_DETAIL_CACHE_KEY, type PatientRow } from "@/hooks/queries/usePatientDataQueries";

const SIGNATURE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const GUARDIAN_CONSENT_CACHE_KEY = (patientId: string) => `guardian_consent_${patientId}`;
export const DOC_SIGNATURE_CACHE_KEY = (patientId: string, signToken: string) =>
  `doc_signature_${patientId}_${signToken}`;
export const DOC_SIGNATURES_LIST_CACHE_KEY = (patientId: string) => `doc_signatures_${patientId}`;

/**
 * Generates a deterministic SHA-256 hex digest using Web Crypto API.
 */
export async function computeSha256Hex(payload: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle && typeof TextEncoder !== "undefined") {
    const encoded = new TextEncoder().encode(payload);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
  return `offline-${Date.now().toString(16)}`;
}

export async function cacheOfflineGuardianConsent(
  patientId: string,
  clinicId: string | null | undefined,
  consentPayload: Json
): Promise<void> {
  await setLocalCacheItem(GUARDIAN_CONSENT_CACHE_KEY(patientId), consentPayload, SIGNATURE_CACHE_TTL_MS);

  const detailKey = PATIENT_DETAIL_CACHE_KEY(clinicId, patientId);
  const cachedPatient = await getLocalCacheItem<PatientRow>(detailKey);
  if (cachedPatient) {
    await setLocalCacheItem(detailKey, {
      ...cachedPatient,
      guardian_consent: consentPayload,
      updated_at: new Date().toISOString(),
    });
  }
}

export async function cacheOfflineDocumentSignature(
  patientId: string,
  signToken: string,
  record: Record<string, unknown>
): Promise<void> {
  await setLocalCacheItem(DOC_SIGNATURE_CACHE_KEY(patientId, signToken), record, SIGNATURE_CACHE_TTL_MS);

  const listKey = DOC_SIGNATURES_LIST_CACHE_KEY(patientId);
  const existing = await getLocalCacheItem<Array<Record<string, unknown>>>(listKey);
  const nextList = Array.isArray(existing)
    ? [record, ...existing.filter((item) => item.sign_token !== signToken)]
    : [record];
  await setLocalCacheItem(listKey, nextList, SIGNATURE_CACHE_TTL_MS);
}
