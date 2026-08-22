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
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
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

export const suggestEmailTypo = (email: string): string | null => {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex === -1) return null;

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);
  if (!localPart || !domainPart) return null;

  const TYPO_MAP: Record<string, string> = {
    "gmai.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "gmai.com.br": "gmail.com",
    "gmail.co": "gmail.com",
    "gmail.com.br": "gmail.com",
    "hotmial.com": "hotmail.com",
    "hotmai.com": "hotmail.com",
    "hotmaill.com": "hotmail.com",
    "hormail.com": "hotmail.com",
    "hotmial.com.br": "hotmail.com",
    "outlok.com": "outlook.com",
    "outloo.com": "outlook.com",
    "outllok.com": "outlook.com",
    "outlok.com.br": "outlook.com",
    "yaho.com": "yahoo.com",
    "yahooo.com": "yahoo.com",
    "yaho.com.br": "yahoo.com.br",
    "iclud.com": "icloud.com",
    "icoud.com": "icloud.com",
    "icloud.co": "icloud.com",
  };

  const suggestion = TYPO_MAP[domainPart];
  if (suggestion && suggestion !== domainPart) {
    return `${localPart}@${suggestion}`;
  }

  return null;
};

export const calculateAgeDetails = (
  birthDateStr?: string | null
): { years: number; months: number; label: string; isMinor: boolean } | null => {
  if (!birthDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(birthDateStr)) return null;
  const [year, month, day] = birthDateStr.split("-").map(Number);
  const birth = new Date(year, month - 1, day);
  const today = new Date();

  if (birth > today || isNaN(birth.getTime())) return null;

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  const days = today.getDate() - birth.getDate();

  if (days < 0) {
    months--;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  let label = "";
  if (years === 0) {
    if (months === 0) {
      label = "Recém-nascido";
    } else {
      label = `${months} ${months === 1 ? "mês" : "meses"}`;
    }
  } else if (years === 1) {
    label = months > 0 ? `1 ano e ${months} m` : "1 ano";
  } else {
    label = `${years} anos`;
  }

  return {
    years,
    months,
    label,
    isMinor: years < 18,
  };
};

export const formatNameTitleCase = (name: string): string => {
  const lowercaseWords = new Set(["de", "da", "do", "das", "dos", "e", "del", "van", "von"]);
  return name
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && lowercaseWords.has(lower)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
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

export type PatientDocumentType =
  | "cpf"
  | "responsible_cpf"
  | "passport"
  | "rg"
  | "none";

export interface PatientPreRegistrationValues {
  cpf: string;
  dateOfBirth: string;
  documentNumber?: string;
  documentType?: PatientDocumentType;
  email: string;
  name: string;
  phone: string;
  usesResponsibleCpf?: boolean;
  gender?: string;
  pronoun?: string;
}

export const validatePatientPreRegistration = (values: PatientPreRegistrationValues) => {
  const docType = values.documentType ?? (values.usesResponsibleCpf ? "responsible_cpf" : "cpf");
  const normalized = {
    cpf: extractCpfDigits(values.cpf).slice(0, 11),
    dateOfBirth: sanitizeSingleLineInput(values.dateOfBirth, 10).trim(),
    documentNumber: sanitizeSingleLineInput(values.documentNumber ?? "", 32).trim(),
    documentType: docType,
    email: sanitizeSingleLineInput(values.email, INPUT_LIMITS.email).trim().toLowerCase(),
    name: sanitizeSingleLineInput(values.name, INPUT_LIMITS.name).trim(),
    phone: normalizePatientPhoneDigits(values.phone),
    usesResponsibleCpf: docType === "responsible_cpf" || Boolean(values.usesResponsibleCpf),
    gender: sanitizeSingleLineInput(values.gender ?? "", INPUT_LIMITS.shortText).trim(),
    pronoun: sanitizeSingleLineInput(values.pronoun ?? "", INPUT_LIMITS.shortText).trim(),
  };
  const errors: Partial<Record<keyof PatientPreRegistrationValues, string>> = {};

  if (normalized.name.length < 3) {
    errors.name = "Informe o nome completo do paciente.";
  }

  if (!isValidPatientBirthDate(normalized.dateOfBirth)) {
    errors.dateOfBirth = "Informe uma data de nascimento válida.";
  }

  if (docType === "cpf") {
    if (!isValidCpfDigits(normalized.cpf)) {
      errors.cpf = "Informe um CPF válido do paciente.";
    }
  } else if (docType === "responsible_cpf") {
    if (!isValidCpfDigits(normalized.cpf)) {
      errors.cpf = "Informe um CPF válido do responsável.";
    }
  } else if (docType === "passport") {
    if (normalized.documentNumber.length > 0 && normalized.documentNumber.length < 3) {
      errors.documentNumber = "Informe um número de passaporte/ID válido.";
    }
  } else if (docType === "rg") {
    if (normalized.documentNumber.length > 0 && normalized.documentNumber.length < 3) {
      errors.documentNumber = "Informe um número de documento válido.";
    }
  }

  if (normalized.phone.length > 0 && !/^\d{10,11}$/.test(normalized.phone)) {
    errors.phone = "Informe um telefone com DDD (10 ou 11 dígitos).";
  }

  if (normalized.email.length > 0 && !isValidPatientEmail(normalized.email)) {
    errors.email = "Informe um e-mail válido.";
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    values: normalized,
  };
};

export const getPatientRegistrationPassword = (
  patientOrCpf:
    | {
        cpf?: string | null;
        responsible_cpf?: string | null;
        date_of_birth?: string | null;
      }
    | string
    | null
    | undefined
) => {
  if (!patientOrCpf) return null;

  if (typeof patientOrCpf === "string") {
    const digits = extractCpfDigits(patientOrCpf);
    return digits.length >= 6 ? digits.slice(0, 6) : null;
  }

  const cpfDigits = extractCpfDigits(patientOrCpf.cpf || patientOrCpf.responsible_cpf);
  if (cpfDigits.length >= 6) {
    return cpfDigits.slice(0, 6);
  }

  if (patientOrCpf.date_of_birth) {
    const rawDigits = patientOrCpf.date_of_birth.replace(/\D/g, "");
    if (rawDigits.length === 8) {
      const yyyy = rawDigits.slice(0, 4);
      const mm = rawDigits.slice(4, 6);
      const dd = rawDigits.slice(6, 8);
      return `${dd}${mm}${yyyy.slice(2, 4)}`;
    }
  }

  return null;
};

export interface PatientShareMessageOptions {
  patientName: string;
  clinicName?: string;
  shareUrl: string;
  passwordPrefix: string;
  gender?: string | null;
  pronoun?: string | null;
  phone?: string | null;
  email?: string | null;
}

export const buildPatientShareMessages = ({
  patientName,
  clinicName = "nossa clínica",
  shareUrl,
  passwordPrefix,
  gender,
  pronoun,
  phone,
  email,
}: PatientShareMessageOptions) => {
  const firstName = patientName.trim().split(" ")[0] || "Paciente";

  const isFeminine = pronoun === "ela/dela" || gender === "feminino";
  const isMasculine = pronoun === "ele/dele" || gender === "masculino";
  const welcomeWord = isFeminine ? "bem-vinda" : isMasculine ? "bem-vindo" : "bem-vindo(a)";

  const whatsappMessage = `Olá, ${firstName}! Seja muito ${welcomeWord} à ${clinicName}. 👋

Para agilizar o seu atendimento e garantir que tenhamos todas as informações necessárias para a sua consulta, por favor realize o preenchimento da sua ficha cadastral no link seguro abaixo:

🔗 ${shareUrl}

🔐 *Senha de acesso:* \`${passwordPrefix}\` (primeiros 6 dígitos do CPF/documento)

O preenchimento leva menos de 3 minutos e pode ser feito pelo celular. Qualquer dúvida, estamos à disposição!`;

  const phoneDigits = normalizePatientPhoneDigits(phone);
  const whatsappUrl = phoneDigits
    ? `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(whatsappMessage)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;

  const emailSubject = `[${clinicName}] - Conclusão do cadastro de ${firstName}`;
  const emailBody = `Olá, ${firstName}!\n\nSeja muito ${welcomeWord} à ${clinicName}.\n\nPara agilizar o seu atendimento e iniciar o seu prontuário eletrônico com total segurança, por favor preencha a sua ficha cadastral através do link abaixo:\n\n${shareUrl}\n\nSenha de acesso: ${passwordPrefix} (primeiros 6 dígitos do CPF/documento)\n\nO preenchimento é rápido e seguro.\n\nAtenciosamente,\nEquipe ${clinicName}`;

  const mailtoUrl = `mailto:${email ? encodeURIComponent(email) : ""}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  return {
    firstName,
    whatsappMessage,
    whatsappUrl,
    emailSubject,
    emailBody,
    mailtoUrl,
  };
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
