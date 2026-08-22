import { supabase } from "@/integrations/supabase/client";
import type { AccountOperation, DetailKind, PlatformDirectoryItem } from "./types";

export const callRpc = (fn: string, args?: Record<string, unknown>) =>
  supabase.rpc(fn as never, args as never) as Promise<{ data: unknown; error: { message?: string } | null }>;

export const callPlatformAccountAdmin = async (action: string, payload: Record<string, unknown>, reason: string) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão master indisponível.");

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-account-admin`, {
    body: JSON.stringify({ action, payload, reason }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    method: "POST",
  });

  const body = (await response.json().catch(() => ({}))) as { data?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(body.error || "Operação administrativa não pôde ser executada.");
  }
  return body.data;
};

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

export const compactDocument = (value: string | null | undefined) => value || "Sem documento";

export const clinicAccessStatusLabels: Record<string, string> = {
  active: "Ativa",
  banned: "Bloqueada",
  payment_pending: "Pagamento pendente",
  temporarily_paused: "Pausada temporariamente",
};

export const formatClinicAccessStatus = (value: string) => clinicAccessStatusLabels[value] ?? value;

export const accountOperationLabels: Record<AccountOperation, string> = {
  confirm_user_email_manually: "Confirmar e-mail manualmente",
  create_patient: "Criar paciente",
  create_subaccount: "Criar subconta",
  delete_patient: "Excluir paciente",
  delete_subaccount: "Excluir subconta",
  delete_user_attempt: "Excluir tentativa de cadastro",
  resend_invitation: "Reenviar convite / ativação",
  update_clinic_access: "Editar acesso da clínica",
  update_owner_access: "Editar acesso do owner",
  update_patient: "Editar paciente",
  update_subaccount_access: "Editar acesso da subconta",
};

export const destructiveOperations = new Set<AccountOperation>(["delete_patient", "delete_subaccount", "delete_user_attempt"]);

export const itemLabels: Record<DetailKind, string> = {
  account: "Conta",
  clinic: "Clínica",
  patient: "Paciente",
};

export const eventLabel: Record<string, string> = {
  feature_flag_upserted: "Feature flag alterada",
  platform_clinic_access_ended: "Saiu da clínica",
  platform_clinic_access_started: "Acessou clínica",
  platform_clinic_created: "Criou clínica",
  platform_dashboard_opened: "Abriu painel global",
  platform_directory_detail_read: "Leu detalhe mestre",
};

export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "Operação indisponível.";
};

export const metadataNumber = (metadata: Record<string, unknown> | null | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === "number" ? value : 0;
};

export const metadataString = (metadata: Record<string, unknown> | null | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
};

export const PLATFORM_SELECTED_CLINIC_KEY = "pluri-health.platform.selectedClinicKey";
export const PLATFORM_CLINIC_DETAIL_ROUTE = "/platform/clinicas/detalhes";

export const storePlatformClinicKey = (clinicKey: string) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PLATFORM_SELECTED_CLINIC_KEY, clinicKey);
};

export const readStoredPlatformClinicKey = () => {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(PLATFORM_SELECTED_CLINIC_KEY) ?? "";
};

export const clinicMaskedRouteKey = (item: Pick<PlatformDirectoryItem, "item_id" | "item_type" | "metadata">) =>
  metadataString(item.metadata, "route_key");

export const toRoute = (item: Pick<PlatformDirectoryItem, "item_id" | "item_type" | "metadata">) => {
  if (item.item_type === "clinic") {
    const routeKey = clinicMaskedRouteKey(item);
    return routeKey ? PLATFORM_CLINIC_DETAIL_ROUTE : "/platform";
  }
  if (item.item_type === "account") return `/platform/usuarios/${item.item_id}`;
  return `/platform/pacientes/${item.item_id}`;
};
