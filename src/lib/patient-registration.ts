import type { Database } from "@/integrations/supabase/types";

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

export interface PatientRegistrationFormValues {
  addressComplement: string;
  addressNumber: string;
  allergies: string;
  bloodType: string;
  cep: string;
  cpf: string;
  chronicConditions: string;
  city: string;
  clinicalNotes: string;
  country: string;
  dateOfBirth: string;
  email: string;
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
  const trimmed = (value ?? "").trim();
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
    address_complement: trimToNull(formValues.addressComplement),
    address_number: trimToNull(formValues.addressNumber),
    age: calculatePatientAge(normalizedBirthDate),
    allergies: trimToNull(formValues.allergies),
    blood_type: trimToNull(formValues.bloodType),
    cep: digitsToNull(formValues.cep),
    chronic_conditions: trimToNull(formValues.chronicConditions),
    city: trimToNull(formValues.city),
    clinical_notes: trimToNull(formValues.clinicalNotes),
    continuous_medications: trimToNull(formValues.continuousMedications),
    country: trimToNull(formValues.country) ?? "Brasil",
    cpf: digitsToNull(formValues.cpf),
    date_of_birth: normalizedBirthDate,
    email: trimToNull(formValues.email),
    gender: trimToNull(formValues.gender),
    name: normalizedName ?? patient.name,
    neighborhood: trimToNull(formValues.neighborhood),
    phone: digitsToNull(formValues.phone),
    profession: trimToNull(formValues.profession),
    pronoun: trimToNull(formValues.pronoun),
    registration_complete: true,
    rg: trimToNull(formValues.rg),
    state: trimToNull(formValues.state),
    street: trimToNull(formValues.street),
    surgeries: trimToNull(formValues.surgeries),
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
