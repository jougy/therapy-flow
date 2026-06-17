import type { Database } from "@/integrations/supabase/types";
import { INPUT_LIMITS, sanitizeMultilineInput, sanitizeSingleLineInput } from "@/lib/input-security";
import type { PatientClinicalProfile, PatientEmergencyContact } from "@/lib/patient-clinical-profile";
import { buildClinicalProfilePayload, buildEmergencyContactPayload } from "@/lib/patient-clinical-profile";
import { buildPatientOriginPayload, type PatientOriginFormValues } from "@/lib/patient-origin";

export const extractCpfDigits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

export const normalizePatientPhoneDigits = (value: string | null | undefined) => {
  const digits = (value ?? "").replace(/\D/g, "");
  const withoutBrazilPrefix = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  return withoutBrazilPrefix.slice(0, 11);
};

export const formatPatientCpf = (value: string) => {
  const digits = extractCpfDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

export const formatPatientPhone = (value: string) => {
  const digits = normalizePatientPhoneDigits(value);

  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export const isValidCpfDigits = (digits: string) => {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const calculateDigit = (base: string, factor: number) => {
    const sum = Array.from(base).reduce((total, digit) => {
      const nextTotal = total + Number(digit) * factor;
      factor -= 1;
      return nextTotal;
    }, 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(digits.slice(0, 9), 10) === Number(digits[9]) &&
    calculateDigit(digits.slice(0, 10), 11) === Number(digits[10]);
};

export const isValidPatientBirthDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const birth = new Date(`${value}T12:00:00`);
  if (Number.isNaN(birth.getTime())) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (birth.getFullYear() !== year || birth.getMonth() + 1 !== month || birth.getDate() !== day) {
    return false;
  }

  const today = new Date();
  const oldest = new Date(today.getFullYear() - 130, today.getMonth(), today.getDate());

  return birth <= today && birth >= oldest;
};

export const isValidPatientEmail = (value: string) =>
  value.length <= INPUT_LIMITS.email &&
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(value);

export const normalizePatientNameKey = (value: string) =>
  sanitizeSingleLineInput(value, INPUT_LIMITS.name)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLocaleLowerCase("pt-BR");

export interface PatientPreRegistrationValues {
  cpf: string;
  dateOfBirth: string;
  email: string;
  name: string;
  phone: string;
}

export const validatePatientPreRegistration = (values: PatientPreRegistrationValues) => {
  const normalized = {
    cpf: extractCpfDigits(values.cpf).slice(0, 11),
    dateOfBirth: sanitizeSingleLineInput(values.dateOfBirth, 10).trim(),
    email: sanitizeSingleLineInput(values.email, INPUT_LIMITS.email).trim().toLowerCase(),
    name: sanitizeSingleLineInput(values.name, INPUT_LIMITS.name).trim(),
    phone: normalizePatientPhoneDigits(values.phone),
  };
  const errors: Partial<Record<keyof PatientPreRegistrationValues, string>> = {};

  if (normalized.name.length < 3) {
    errors.name = "Informe o nome completo do paciente.";
  }

  if (!isValidPatientBirthDate(normalized.dateOfBirth)) {
    errors.dateOfBirth = "Informe uma data de nascimento válida.";
  }

  if (!isValidCpfDigits(normalized.cpf)) {
    errors.cpf = "Informe um CPF válido com 11 dígitos.";
  }

  if (!/^\d{10,11}$/.test(normalized.phone)) {
    errors.phone = "Informe um telefone com DDD.";
  }

  if (!isValidPatientEmail(normalized.email)) {
    errors.email = "Informe um e-mail válido.";
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    values: normalized,
  };
};

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

const phoneDigitsToNull = (value: string | null | undefined) => {
  const digits = normalizePatientPhoneDigits(value);
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
    phone: phoneDigitsToNull(formValues.phone),
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
