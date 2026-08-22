import type { Database, Json } from "@/integrations/supabase/types";
import type { AnamnesisFormResponse, AnamnesisFormValue, AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import type { SessionPaymentMethod, SessionPaymentStatus } from "@/lib/session-operations";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/session-operations";
import { readProfileAddress } from "@/lib/profile-settings";

export type PatientGroup = Database["public"]["Tables"]["patient_groups"]["Row"];
export type AnamnesisTemplate = Database["public"]["Tables"]["anamnesis_form_templates"]["Row"];
export type ClinicDocumentSummary = Pick<
  Database["public"]["Tables"]["clinics"]["Row"],
  "address" | "anamnesis_base_schema" | "business_hours" | "cnpj" | "email" | "legal_name" | "logo_url" | "name" | "phone"
>;
export type CollaboratorProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "email" | "full_name" | "id" | "job_title" | "phone" | "professional_license" | "specialty"
>;
export type PatientPaymentSession = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  "amount_charged_cents" | "amount_paid_cents" | "id" | "payment_status"
>;
export type SessionEditHistoryRow = Database["public"]["Tables"]["session_edit_history"]["Row"];
export type ClinicColorSlotRow = Database["public"]["Tables"]["clinic_group_color_slots"]["Row"];
export type PatientGroupStatus = "em_andamento" | "concluido" | "pausado";
export type GroupSuggestion = {
  clinic_color_slot_id: string | null;
  color: string | null;
  name: string;
  normalized_name: string;
  status: string | null;
};

export const GROUP_STATUSES: { label: string; value: PatientGroupStatus }[] = [
  { label: "Em andamento", value: "em_andamento" },
  { label: "Concluído", value: "concluido" },
  { label: "Pausado", value: "pausado" },
];

export type ErrorDetails = {
  title: string;
  context: string;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export const isJsonObject = (value: Json | null): value is Record<string, Json | undefined> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const readJsonString = (value: Json | undefined) => (typeof value === "string" ? value : "");

export const getErrorDetails = (error: unknown, title: string, context: string): ErrorDetails => {
  if (error && typeof error === "object") {
    const data = error as Partial<{
      code: string;
      details: string;
      hint: string;
      message: string;
      name: string;
      status: number;
      statusText: string;
    }>;

    return {
      title,
      context,
      message: data.message ?? data.statusText ?? "Erro sem mensagem técnica retornada.",
      code: data.code ?? (data.status ? String(data.status) : data.name),
      details: data.details,
      hint: data.hint,
    };
  }

  return {
    title,
    context,
    message: typeof error === "string" ? error : "Erro desconhecido.",
  };
};

export const readJsonRecord = (value: Json | null): AnamnesisFormResponse =>
  isJsonObject(value) ? (value as Record<string, AnamnesisFormValue>) : {};

export const readTemplateSchema = (value: Json): AnamnesisTemplateSchema =>
  Array.isArray(value) ? (value as AnamnesisTemplateSchema) : [];

export const formatDateTimeLabel = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

export const formatDateLabel = (value: string | null | undefined) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

export const PAYMENT_AMOUNT_INPUT_MAX_LENGTH = 16;

export const getPatientAvailableCreditCents = (sessions: PatientPaymentSession[], currentSessionId: string | undefined) => {
  const totals = sessions
    .filter((session) => session.id !== currentSessionId && session.payment_status !== "cortesia")
    .reduce(
      (sum, session) => ({
        charged: sum.charged + (session.amount_charged_cents ?? 0),
        paid: sum.paid + (session.amount_paid_cents ?? 0),
      }),
      { charged: 0, paid: 0 },
    );

  return Math.max(0, totals.paid - totals.charged);
};

export const paymentStatusBadgeClassNames: Record<SessionPaymentStatus, string> = {
  nao_cobrado: "border-muted bg-muted/60 text-muted-foreground",
  pendente: "border-warning/20 bg-warning/15 text-warning",
  parcial: "border-destructive/20 bg-destructive/10 text-destructive",
  pago: "border-success/20 bg-success/10 text-success",
  credito: "border-primary/20 bg-primary/10 text-primary",
  cortesia: "border-success/20 bg-success/10 text-success",
};

export const normalizePaymentMethod = (method: string | null | undefined): SessionPaymentMethod =>
  PAYMENT_METHOD_OPTIONS.some((option) => option.value === method)
    ? (method as SessionPaymentMethod)
    : "nao_informado";

export const formatArrivalDeltaLabel = (minutes: number | null) => {
  if (minutes === null || minutes === 0) {
    return null;
  }

  return `${minutes > 0 ? "+" : "-"} ${Math.abs(minutes)}min`;
};

export const formatCnpj = (value: string | null | undefined) => {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 14);

  if (digits.length !== 14) {
    return value?.trim() || "";
  }

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

export const formatAddressLine = (value: Json | null | undefined) => {
  const address = readProfileAddress(value);

  return [
    [address.street, address.number].filter(Boolean).join(", "),
    address.complement,
    address.neighborhood,
    [address.city, address.state].filter(Boolean).join(" - "),
    address.cep,
  ]
    .filter(Boolean)
    .join(", ");
};
