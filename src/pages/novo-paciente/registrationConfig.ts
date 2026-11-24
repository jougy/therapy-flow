import type { PatientDocumentType } from "@/lib/patient-registration";

export type EnsurePatientResponse = {
  id: string;
  patient_code?: string | null;
  matched_by: "cpf" | "name_birth" | "created";
  status: "existing" | "created";
};

export type ExistingPatientMatch = {
  id: string;
  matchedBy: "cpf" | "name_birth";
  name: string;
  status: string | null;
};

export const isEnsurePatientResponse = (value: unknown): value is EnsurePatientResponse => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const data = value as Record<string, unknown>;
  return (
    typeof data.id === "string" &&
    (data.status === "existing" || data.status === "created") &&
    (data.matched_by === "cpf" || data.matched_by === "name_birth" || data.matched_by === "created")
  );
};

export const getRegistrationErrorMessage = (message: string | undefined) => {
  if (!message) {
    return "Não foi possível cadastrar agora. Revise os dados e tente novamente.";
  }
  if (message.includes("Could not find the function") && message.includes("ensure_clinic_patient")) {
    return "O banco de dados ainda não está com a atualização do cadastro aplicada. Atualize as migrations e tente novamente.";
  }
  if (message.includes("CPF inválido")) return "Informe um CPF válido.";
  if (message.includes("Telefone inválido")) return "Informe um telefone com DDD ou deixe o campo em branco.";
  if (message.includes("E-mail inválido")) return "Informe um e-mail válido ou deixe o campo em branco.";
  if (message.includes("Data de nascimento inválida")) return "Informe uma data de nascimento válida.";
  if (message.includes("Sem permissão")) return "Você não tem permissão para cadastrar pacientes nesta clínica.";
  return "Não foi possível cadastrar o paciente agora. Tente novamente em instantes.";
};

export const DOCUMENT_TYPE_OPTIONS: Array<{ value: PatientDocumentType; label: string; placeholder: string }> = [
  { value: "cpf", label: "CPF do paciente (Padrão)", placeholder: "000.000.000-00" },
  { value: "responsible_cpf", label: "CPF do responsável (Menor/Dependente)", placeholder: "000.000.000-00" },
  { value: "passport", label: "Passaporte / ID Estrangeiro", placeholder: "Ex: AB123456" },
  { value: "rg", label: "RG / Documento Nacional", placeholder: "Ex: 00.000.000-0" },
  { value: "none", label: "Não possui documento no momento", placeholder: "Identificação por Nome e Nascimento" },
];

export const GENDER_OPTIONS = [
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
  { value: "nao-binario", label: "Não-binário" },
  { value: "outro", label: "Outro" },
  { value: "nao-informar", label: "Prefiro não informar" },
];

export const PRONOUN_OPTIONS = [
  { value: "ela/dela", label: "Ela / Dela" },
  { value: "ele/dele", label: "Ele / Dele" },
  { value: "elu/delu", label: "Elu / Delu" },
  { value: "outro", label: "Outro" },
];
