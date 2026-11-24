import type { QueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import type { HomePatientRecord } from "@/lib/home-patients-view";
import { getLocalCacheItem, setLocalCacheItem } from "@/lib/indexed-db-persister";
import { fetchPatientByRef } from "@/lib/patient-routing";
import { CLINIC_QUERY_KEYS, PATIENTS_CACHE_KEY } from "@/hooks/queries/useClinicDataQueries";
import {
  PATIENT_DETAIL_CACHE_KEY,
  PATIENT_QUERY_KEYS,
  type PatientRow,
} from "@/hooks/queries/usePatientDataQueries";
import {
  PATIENT_SUMMARY_CACHE_KEY,
  type PatientSummaryData,
} from "@/hooks/usePatientSummary";
import { isOfflineOrNetworkError } from "./networkError";
import { enqueueOfflineMutation } from "./offlineMutationQueue";

export interface OfflinePatientCreateInput {
  clinicId: string;
  userId: string;
  name: string;
  dateOfBirth: string;
  age: number | null;
  cpf: string | null;
  rg: string | null;
  phone: string | null;
  email: string | null;
  gender: string | null;
  pronoun: string | null;
  usesResponsibleCpf: boolean;
  responsibleCpf: string | null;
  responsibleName: string | null;
  responsibleRelationship: string | null;
  isExclusive: boolean;
  exclusiveUserIds: string[];
}

export function generateOfflinePatientCode(tempId: string): string {
  const suffix = tempId.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `PAC-OFF-${suffix}`;
}

export function buildOfflinePatientEntities(input: OfflinePatientCreateInput): {
  tempId: string;
  tempCode: string;
  patientRow: PatientRow;
  insertRecord: Database["public"]["Tables"]["patients"]["Insert"];
  homeRecord: HomePatientRecord;
} {
  const tempId = crypto.randomUUID();
  const tempCode = generateOfflinePatientCode(tempId);
  const nowIso = new Date().toISOString();

  const patientRow: PatientRow = {
    address_complement: null,
    address_number: null,
    age: input.age,
    allergies: null,
    blood_type: null,
    cep: null,
    chronic_conditions: null,
    city: null,
    clinic_id: input.clinicId,
    clinical_notes: null,
    clinical_profile: null,
    continuous_medications: null,
    country: null,
    cpf: input.cpf,
    created_at: nowIso,
    date_of_birth: input.dateOfBirth,
    deleted_at: null,
    deleted_by_user_id: null,
    email: input.email,
    emergency_contact: null,
    exclusive_user_ids: input.exclusiveUserIds,
    gender: input.gender,
    guardian_consent: null,
    id: tempId,
    is_exclusive: input.isExclusive,
    is_recurring: false,
    name: input.name,
    neighborhood: null,
    origin_insurance_member_id: null,
    origin_insurance_plan: null,
    origin_insurance_provider: null,
    origin_other_description: null,
    origin_other_name: null,
    origin_referrer_name: null,
    origin_type: "direto",
    patient_code: tempCode,
    phone: input.phone,
    profession: null,
    pronoun: input.pronoun,
    recurring_time: "",
    recurring_weekdays: [],
    registration_complete: false,
    responsible_cpf: input.responsibleCpf,
    responsible_name: input.responsibleName,
    responsible_relationship: input.responsibleRelationship,
    rg: input.rg,
    state: null,
    status: "ativo",
    street: null,
    surgeries: null,
    updated_at: nowIso,
    user_id: input.userId,
    uses_responsible_cpf: input.usesResponsibleCpf,
    version: 1,
  };

  const insertRecord: Database["public"]["Tables"]["patients"]["Insert"] = {
    id: tempId,
    clinic_id: input.clinicId,
    user_id: input.userId,
    name: input.name,
    date_of_birth: input.dateOfBirth,
    age: input.age,
    cpf: input.cpf,
    rg: input.rg,
    phone: input.phone,
    email: input.email,
    gender: input.gender,
    pronoun: input.pronoun,
    uses_responsible_cpf: input.usesResponsibleCpf,
    responsible_cpf: input.responsibleCpf,
    responsible_name: input.responsibleName,
    responsible_relationship: input.responsibleRelationship,
    is_exclusive: input.isExclusive,
    exclusive_user_ids: input.exclusiveUserIds,
    status: "ativo",
    origin_type: "direto",
    patient_code: null,
  };

  const homeRecord: HomePatientRecord = {
    id: tempId,
    patient_code: tempCode,
    name: input.name,
    cpf: input.cpf,
    date_of_birth: input.dateOfBirth,
    gender: input.gender,
    pronoun: input.pronoun,
    phone: input.phone,
    status: "ativo",
    updated_at: nowIso,
    is_recurring: false,
    recurring_weekdays: [],
    recurring_time: "",
    origin_type: "direto",
  };

  return { tempId, tempCode, patientRow, insertRecord, homeRecord };
}

export async function persistOfflineCreatedPatient(
  queryClient: QueryClient,
  input: OfflinePatientCreateInput
): Promise<PatientRow> {
  const { tempId, tempCode, patientRow, insertRecord, homeRecord } = buildOfflinePatientEntities(input);

  queryClient.setQueryData<HomePatientRecord[]>(
    CLINIC_QUERY_KEYS.patients(input.clinicId),
    (current = []) => [homeRecord, ...current.filter((p) => p.id !== tempId)]
  );
  queryClient.setQueryData<PatientRow>(PATIENT_QUERY_KEYS.patient(tempId, input.clinicId), patientRow);
  queryClient.setQueryData<PatientRow>(PATIENT_QUERY_KEYS.patient(tempCode, input.clinicId), patientRow);

  const cachedList = await getLocalCacheItem<HomePatientRecord[]>(PATIENTS_CACHE_KEY(input.clinicId));
  const nextList = Array.isArray(cachedList)
    ? [homeRecord, ...cachedList.filter((p) => p.id !== tempId)]
    : [homeRecord];

  await Promise.all([
    setLocalCacheItem(PATIENTS_CACHE_KEY(input.clinicId), nextList),
    setLocalCacheItem(PATIENT_DETAIL_CACHE_KEY(input.clinicId, tempId), patientRow),
    setLocalCacheItem(PATIENT_DETAIL_CACHE_KEY(input.clinicId, tempCode), patientRow),
  ]);

  await enqueueOfflineMutation("create_patient", {
    tempId,
    record: insertRecord,
  });

  return patientRow;
}

export async function loadPatientWithOfflineFallback(
  ref: string,
  clinicId?: string | null
): Promise<PatientRow | null> {
  const detailKey = PATIENT_DETAIL_CACHE_KEY(clinicId, ref);

  if (typeof navigator === "undefined" || navigator.onLine) {
    try {
      const { data, error } = await fetchPatientByRef(ref, clinicId);
      if (!error && data) {
        void setLocalCacheItem(detailKey, data);
        if (data.id && data.id !== ref) {
          void setLocalCacheItem(PATIENT_DETAIL_CACHE_KEY(clinicId, data.id), data);
        }
        return data;
      }
      if (!isOfflineOrNetworkError(error)) {
        return null;
      }
    } catch (err) {
      if (!isOfflineOrNetworkError(err)) {
        throw err;
      }
    }
  }

  const cachedDetail = await getLocalCacheItem<PatientRow>(detailKey);
  if (cachedDetail) return cachedDetail;

  const cachedSummary = await getLocalCacheItem<PatientSummaryData>(PATIENT_SUMMARY_CACHE_KEY(clinicId, ref));
  return cachedSummary?.patient ?? null;
}

export function buildPatientUpdatePatch(
  payload: PatientRow
): Database["public"]["Tables"]["patients"]["Update"] {
  const {
    id: _id,
    created_at: _createdAt,
    clinic_id: _clinicId,
    user_id: _userId,
    patient_code: _patientCode,
    version: _version,
    ...patch
  } = payload;
  return {
    ...patch,
    updated_at: new Date().toISOString(),
  };
}

export async function persistOfflineUpdatedPatient(
  queryClient: QueryClient,
  payload: PatientRow,
  routeRef: string,
  clinicId?: string | null,
  clinicRouteKey?: string | null
): Promise<void> {
  const nowIso = new Date().toISOString();
  const updatedPatient: PatientRow = { ...payload, updated_at: nowIso };
  const targetClinicId = updatedPatient.clinic_id || clinicId || null;

  const refs = Array.from(
    new Set([updatedPatient.id, routeRef, updatedPatient.patient_code].filter((v): v is string => Boolean(v)))
  );

  for (const ref of refs) {
    queryClient.setQueryData<PatientRow | null>(PATIENT_QUERY_KEYS.patient(ref, targetClinicId), updatedPatient);
    await setLocalCacheItem(PATIENT_DETAIL_CACHE_KEY(targetClinicId, ref), updatedPatient);

    const summaryScope = targetClinicId || clinicRouteKey || "global";
    const summaryCacheKey = PATIENT_SUMMARY_CACHE_KEY(summaryScope, ref);
    const cachedSummary = await getLocalCacheItem<PatientSummaryData>(summaryCacheKey);
    if (cachedSummary) {
      await setLocalCacheItem(summaryCacheKey, { ...cachedSummary, patient: updatedPatient });
    }
  }

  if (targetClinicId) {
    const patchHome = (p: HomePatientRecord): HomePatientRecord =>
      p.id === updatedPatient.id
        ? {
            ...p,
            name: updatedPatient.name,
            cpf: updatedPatient.cpf,
            date_of_birth: updatedPatient.date_of_birth,
            gender: updatedPatient.gender,
            pronoun: updatedPatient.pronoun,
            phone: updatedPatient.phone,
            origin_type: updatedPatient.origin_type,
            updated_at: nowIso,
          }
        : p;

    queryClient.setQueryData<HomePatientRecord[]>(
      CLINIC_QUERY_KEYS.patients(targetClinicId),
      (current = []) => current.map(patchHome)
    );

    const cachedList = await getLocalCacheItem<HomePatientRecord[]>(PATIENTS_CACHE_KEY(targetClinicId));
    if (Array.isArray(cachedList)) {
      await setLocalCacheItem(PATIENTS_CACHE_KEY(targetClinicId), cachedList.map(patchHome));
    }
  }

  await enqueueOfflineMutation("update_patient", {
    patientId: updatedPatient.id,
    patch: buildPatientUpdatePatch(updatedPatient),
  });
}
