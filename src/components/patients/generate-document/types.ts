import { defaultUrlTransform } from "react-markdown";
import { SUGGESTED_TERM_VARIABLES } from "@/lib/termVariables";

export interface DocumentPatientData {
  id?: string;
  name?: string;
  full_name?: string;
  cpf?: string | null;
  rg?: string | null;
  date_of_birth?: string | null;
  birth_date?: string | null;
  marital_status?: string | null;
  profession?: string | null;
  address?: string | Record<string, unknown> | null;
  phone?: string | null;
  email?: string | null;
  responsible_name?: string | null;
  responsible_cpf?: string | null;
  responsible_phone?: string | null;
  legal_guardian_name?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  clinic_id?: string | null;
  patient_code?: string | null;
}

export interface DocumentTemplateItem {
  id: string;
  title: string;
  description?: string;
  category: "adult_consent" | "minor_consent" | "print_responsibility" | "custom" | string;
  content: string;
  isCustom?: boolean;
  isFromTable?: boolean;
}

export type DocumentSignatureChannel = "whatsapp" | "in_person" | "paper";
export type DocumentSignatureStatus =
  | "pending"
  | "signed_in_person"
  | "signed_remote"
  | "pending_physical";
export type DocumentSignerRole = "paciente" | "responsavel" | "colaborador" | "owner";

export interface InPersonSignedSnapshot {
  id?: string;
  signToken: string;
  signerName: string;
  signerCpf: string | null;
  signerRole: "paciente" | "responsavel";
  signatureImageUrl: string;
  signedAt: string;
  location?: string;
}

export interface GenerateDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: DocumentPatientData | null;
  clinicId?: string | null;
  clinicName?: string;
  sessionId?: string | null;
  initialTemplateId?: string;
  onPrinted?: () => void;
}

export const KNOWN_VARIABLES: readonly string[] = SUGGESTED_TERM_VARIABLES.map((v) => v.key);

/**
 * Permite URLs seguras padrão e Data URLs de imagens (ex: assinatura .webp) no ReactMarkdown.
 */
export function allowSignatureUrlTransform(url: string): string {
  if (/^data:image\/(webp|png|jpeg|jpg);base64,/i.test(url)) {
    return url;
  }
  return defaultUrlTransform(url);
}

export function formatBirthDate(dob?: string | null): string {
  if (!dob) return "";
  const clean = dob.trim().split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const date = new Date(dob);
  return isNaN(date.getTime()) ? dob : date.toLocaleDateString("pt-BR");
}

export function formatCnpj(value?: string | null): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  return value;
}

export function formatVariableLabel(key: string): string {
  const clean = key.replace(/[<>]/g, "").trim();
  const found = SUGGESTED_TERM_VARIABLES.find((v) => v.key === key || v.name === clean);
  if (found) return found.label;
  return clean
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value?: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value.trim()));
}

export function generateDocumentSignToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function normalizeWhatsAppDigits(phone?: string | null): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function buildPublicDocumentSignUrl(origin: string, token: string): string {
  const cleanOrigin = origin.replace(/\/$/, "");
  return `${cleanOrigin}/assinar-documento/${encodeURIComponent(token)}`;
}

export function buildPublicSignatureVerificationUrl(
  origin: string,
  token?: string | null
): string {
  const cleanOrigin = origin.replace(/\/$/, "");
  const cleanToken = token?.trim();
  if (cleanToken) {
    return `${cleanOrigin}/verificar-assinatura/${encodeURIComponent(cleanToken)}`;
  }
  return `${cleanOrigin}/verificar-assinatura/preview`;
}

export function buildWhatsAppSignatureUrl(phone: string | null | undefined, message: string): string {
  const digits = normalizeWhatsAppDigits(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
