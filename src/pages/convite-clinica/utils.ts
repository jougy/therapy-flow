import type { InviteSummary } from "./types";

export const sanitizeDigits = (value: string) => value.replace(/\D/g, "");

export const formatCpf = (value: string) => {
  const digits = sanitizeDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export const formatPhone = (value: string) => {
  const digits = sanitizeDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export const isValidCpf = (cpf: string) => {
  const digits = sanitizeDigits(cpf);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits.charAt(i), 10) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(9), 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits.charAt(i), 10) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(digits.charAt(10), 10);
};

export const asInviteSummary = (value: unknown): InviteSummary | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<InviteSummary>;
  if (!data.email || !data.clinic_name || !data.status) return null;
  return {
    clinic_name: String(data.clinic_name),
    email: String(data.email).trim().toLowerCase(),
    existing_user: Boolean(data.existing_user),
    expires_at: String(data.expires_at || ""),
    job_title: data.job_title ? String(data.job_title) : null,
    operational_role: String(data.operational_role || "professional"),
    specialty: data.specialty ? String(data.specialty) : null,
    status: data.status,
  };
};
