import type { Database } from "@/integrations/supabase/types";
import { INPUT_LIMITS, sanitizeMultilineInput, sanitizeSingleLineInput } from "@/lib/input-security";
import type { PatientClinicalProfile, PatientEmergencyContact } from "@/lib/patient-clinical-profile";
import { buildClinicalProfilePayload, buildEmergencyContactPayload } from "@/lib/patient-clinical-profile";
import { buildPatientOriginPayload, type PatientOriginFormValues } from "@/lib/patient-origin";

export const extractCpfDigits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

export const getPatientRegistrationPassword = (cpf: string | null | undefined) => {
  const digits = extractCpfDigits(cpf);

  if (digits.length < 6) {
    return null;
  }

  return digits.slice(0, 6);
};

export const buildPatientRegistrationUrl = (origin: string, token: string) =>
  `${origin}/cadastro/paciente/${token}`;

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];

export interface PatientRegistrationFormValues extends PatientOriginFormValues {
  addressComplement: string;
  addressNumber: string;
  allergies: string;
  bloodType: string;
  cep: string;
  clinicalProfile: PatientClinicalProfile;
  cpf: string;
  chronicConditions: string;
  city: string;
  clinicalNotes: string;
  country: string;
  dateOfBirth: string;
  email: string;
  emergencyContact: PatientEmergencyContact;
  gender: string;
  name: string;
  neighborhood: string;
  phone: string;
  profession: string;
  pronoun: string;
  rg: string;
  state: string;
  street: string;
  surgeries: string;
  continuousMedications: string;
}

const trimToNull = (value: string | null | undefined) => {
  const trimmed = sanitizeSingleLineInput(value ?? "", INPUT_LIMITS.shortText).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const trimSingleLineToNull = (value: string | null | undefined, maxLength: number) => {
  const trimmed = sanitizeSingleLineInput(value ?? "", maxLength).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const trimMultilineToNull = (value: string | null | undefined, maxLength = INPUT_LIMITS.clinicalLongText) => {
  const trimmed = sanitizeMultilineInput(value ?? "", maxLength).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const digitsToNull = (value: string | null | undefined) => {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
};

export const calculatePatientAge = (birthDate: string | null | undefined) => {
  const normalizedBirthDate = trimToNull(birthDate);

  if (!normalizedBirthDate) {
    return null;
  }

  const today = new Date();
  const birth = new Date(`${normalizedBirthDate}T12:00:00`);

  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age;
};

export const buildPatientRegistrationPutPayload = (
  patient: PatientRow,
  formValues: PatientRegistrationFormValues
): PatientRow => {
  const normalizedName = trimToNull(formValues.name);
  const normalizedBirthDate = trimToNull(formValues.dateOfBirth);

  return {
    ...patient,
    address_complement: trimSingleLineToNull(formValues.addressComplement, INPUT_LIMITS.addressComplement),
    address_number: trimSingleLineToNull(formValues.addressNumber, INPUT_LIMITS.addressNumber),
    age: calculatePatientAge(normalizedBirthDate),
    allergies: trimMultilineToNull(formValues.allergies),
    blood_type: trimSingleLineToNull(formValues.bloodType, 8),
    cep: digitsToNull(formValues.cep),
    clinical_profile: buildClinicalProfilePayload(formValues.clinicalProfile),
    chronic_conditions: trimMultilineToNull(formValues.chronicConditions),
    city: trimSingleLineToNull(formValues.city, INPUT_LIMITS.city),
    clinical_notes: trimMultilineToNull(formValues.clinicalNotes),
    continuous_medications: trimMultilineToNull(formValues.continuousMedications),
    country: trimSingleLineToNull(formValues.country, INPUT_LIMITS.country) ?? "Brasil",
    cpf: digitsToNull(formValues.cpf),
    date_of_birth: normalizedBirthDate,
    email: trimSingleLineToNull(formValues.email, INPUT_LIMITS.email),
    emergency_contact: buildEmergencyContactPayload(formValues.emergencyContact),
    gender: trimSingleLineToNull(formValues.gender, INPUT_LIMITS.shortText),
    name: trimSingleLineToNull(normalizedName, INPUT_LIMITS.name) ?? patient.name,
    neighborhood: trimSingleLineToNull(formValues.neighborhood, INPUT_LIMITS.shortText),
    ...buildPatientOriginPayload(formValues),
    phone: digitsToNull(formValues.phone),
    profession: trimSingleLineToNull(formValues.profession, INPUT_LIMITS.profession),
    pronoun: trimSingleLineToNull(formValues.pronoun, INPUT_LIMITS.shortText),
    registration_complete: true,
    rg: trimSingleLineToNull(formValues.rg, INPUT_LIMITS.patientDocument),
    state: trimSingleLineToNull(formValues.state, INPUT_LIMITS.state),
    street: trimSingleLineToNull(formValues.street, INPUT_LIMITS.street),
    surgeries: trimMultilineToNull(formValues.surgeries),
  };
};

interface PutPatientRegistrationInput {
  accessToken: string;
  apiKey: string;
  patient: PatientRow;
  supabaseUrl: string;
  fetcher?: typeof fetch;
}

export const putPatientRegistration = async ({
  accessToken,
  apiKey,
  patient,
  supabaseUrl,
  fetcher = fetch,
}: PutPatientRegistrationInput) => {
  const response = await fetcher(`${supabaseUrl}/rest/v1/patients?id=eq.${patient.id}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      apikey: apiKey,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patient),
  });

  if (response.ok) {
    return;
  }

  let errorMessage = `Erro ao atualizar paciente (${response.status})`;

  try {
    const errorBody = await response.json() as { message?: string; details?: string; hint?: string };
    errorMessage = errorBody.message ?? errorBody.details ?? errorBody.hint ?? errorMessage;
  } catch {
    // keep the fallback message when the response body is empty or not JSON
  }

  throw new Error(errorMessage);
};
