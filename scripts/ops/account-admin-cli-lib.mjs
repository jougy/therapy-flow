import { sanitizeDigits } from "./account-admin-lib.mjs";

export const MAIN_MENU_OPTIONS = [
  "1) Listar contas",
  "2) Buscar contas",
  "3) Ver conta",
  "4) Criar conta solo",
  "5) Criar conta clinic",
  "6) Selecionar uma conta",
  "0) Sair",
];

export const buildSelectedAccountMenuOptions = (account) => {
  const label = account?.email || account?.clinic_name || account?.user_id || "conta";

  return [
    `Conta selecionada: ${label}`,
    "0) Voltar",
    "1) Criar subconta clinic",
    "2) Editar acesso",
    "3) Excluir",
    "4) Listar pacientes",
    "5) Criar paciente",
    "6) Editar paciente",
    "7) Excluir paciente",
  ];
};

export const calculatePatientAge = (dateOfBirth, today = new Date()) => {
  const normalized = String(dateOfBirth ?? "").trim();
  if (!normalized) {
    return null;
  }

  const birthDate = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) {
    throw new Error("Data de nascimento inválida.");
  }

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age < 0 ? 0 : age;
};

const normalizeOptionalText = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const normalizeOptionalDigits = (value) => {
  const digits = sanitizeDigits(value);
  return digits || null;
};

export const buildPatientCreatePayload = (account, fields, today = new Date()) => {
  const name = String(fields?.name ?? "").trim();
  if (!name) {
    throw new Error("Nome do paciente é obrigatório.");
  }

  const dateOfBirth = normalizeOptionalText(fields?.dateOfBirth);

  return {
    clinic_id: account.clinic_id,
    user_id: account.user_id,
    name,
    date_of_birth: dateOfBirth,
    age: dateOfBirth ? calculatePatientAge(dateOfBirth, today) : null,
    cpf: normalizeOptionalDigits(fields?.cpf),
    phone: normalizeOptionalDigits(fields?.phone),
    email: normalizeOptionalText(fields?.email),
    status: normalizeOptionalText(fields?.status) ?? "ativo",
    registration_complete: false,
  };
};

export const buildPatientUpdatePayload = (fields, today = new Date()) => {
  const payload = {};

  if (Object.hasOwn(fields, "name")) {
    const name = String(fields.name ?? "").trim();
    if (!name) {
      throw new Error("Nome do paciente é obrigatório.");
    }
    payload.name = name;
  }

  if (Object.hasOwn(fields, "dateOfBirth")) {
    const dateOfBirth = normalizeOptionalText(fields.dateOfBirth);
    payload.date_of_birth = dateOfBirth;
    payload.age = dateOfBirth ? calculatePatientAge(dateOfBirth, today) : null;
  }

  if (Object.hasOwn(fields, "cpf")) {
    payload.cpf = normalizeOptionalDigits(fields.cpf);
  }

  if (Object.hasOwn(fields, "phone")) {
    payload.phone = normalizeOptionalDigits(fields.phone);
  }

  if (Object.hasOwn(fields, "email")) {
    payload.email = normalizeOptionalText(fields.email);
  }

  if (Object.hasOwn(fields, "status")) {
    payload.status = normalizeOptionalText(fields.status) ?? "ativo";
  }

  return payload;
};
