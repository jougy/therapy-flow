import { useCallback, useEffect, useRef } from "react";
import type { PatientClinicalProfile, PatientEmergencyContact } from "@/lib/patient-clinical-profile";

export interface SharedPatientDraftValues {
  name: string;
  dateOfBirth: string;
  gender: string;
  pronoun: string;
  rg: string;
  profession: string;
  originType: string;
  originReferrerName: string;
  originInsuranceProvider: string;
  originInsurancePlan: string;
  originInsuranceMemberId: string;
  originOtherName: string;
  originOtherDescription: string;
  cep: string;
  country: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  addressNumber: string;
  addressComplement: string;
  bloodType: string;
  chronicConditions: string;
  surgeries: string;
  continuousMedications: string;
  allergies: string;
  clinicalNotes: string;
  clinicalProfile: PatientClinicalProfile;
  emergencyContact: PatientEmergencyContact;
  phone: string;
  email: string;
}

interface StoredDraftEnvelope {
  token: string;
  savedAt: number;
  values: SharedPatientDraftValues;
}

const DRAFT_KEY_PREFIX = "therapy-flow:shared-patient-draft:";

export const getDraftStorageKey = (token: string) => `${DRAFT_KEY_PREFIX}${token.trim()}`;

/**
 * Lê o rascunho salvo no localStorage para o token específico.
 */
export function getSharedPatientDraft(token?: string | null): SharedPatientDraftValues | null {
  if (!token || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(token));
    if (!raw) return null;

    const envelope = JSON.parse(raw) as StoredDraftEnvelope;
    if (!envelope || typeof envelope !== "object" || envelope.token !== token) {
      return null;
    }

    return envelope.values ?? null;
  } catch {
    return null;
  }
}

/**
 * Salva o rascunho no localStorage associado ao token público.
 */
export function saveSharedPatientDraft(token: string, values: SharedPatientDraftValues): void {
  if (!token || typeof window === "undefined") return;

  try {
    const envelope: StoredDraftEnvelope = {
      token,
      savedAt: Date.now(),
      values,
    };
    window.localStorage.setItem(getDraftStorageKey(token), JSON.stringify(envelope));
  } catch (err) {
    console.warn("Não foi possível salvar o rascunho local:", err);
  }
}

/**
 * Remove o rascunho do localStorage (usado após submissão bem-sucedida).
 */
export function clearSharedPatientDraft(token?: string | null): void {
  if (!token || typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(getDraftStorageKey(token));
  } catch {
    // Silent fail
  }
}

/**
 * Hook para auto-salvar o progresso de preenchimento do formulário público com debounce.
 */
export function useSharedPatientAutoSave(
  token: string | undefined,
  values: SharedPatientDraftValues,
  enabled = true
) {
  const valuesRef = useRef(values);
  valuesRef.current = values;

  // Auto-salva quando os valores mudam com debounce de 600ms
  useEffect(() => {
    if (!token || !enabled) return;

    const timer = setTimeout(() => {
      saveSharedPatientDraft(token, valuesRef.current);
    }, 600);

    return () => clearTimeout(timer);
  }, [token, enabled, values]);

  // Salva imediatamente ao descarregar a página
  useEffect(() => {
    if (!token || !enabled) return;

    const handleBeforeUnload = () => {
      saveSharedPatientDraft(token, valuesRef.current);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [token, enabled]);

  const clear = useCallback(() => {
    if (token) {
      clearSharedPatientDraft(token);
    }
  }, [token]);

  return {
    clearDraft: clear,
  };
}
