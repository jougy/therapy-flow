import { supabase } from "@/integrations/supabase/client";
import { logRuntimeRpc, logRuntimeError } from "@/lib/runtime-debug";
import type { AccountOperation, DetailKind, PlatformDirectoryItem } from "./types";

export const callRpc = async (
  fn: string,
  args?: Record<string, unknown>,
  options?: { silentError?: boolean }
) => {
  const startedAt = performance.now();
  const result = (await supabase.rpc(fn as never, args as never)) as {
    data: unknown;
    error: { message?: string } | null;
  };
  const durationMs = Math.round(performance.now() - startedAt);
  const status = result.error ? "error" : "success";

  logRuntimeRpc(
    fn,
    args ?? {},
    status,
    durationMs,
    result.data,
    result.error
  );

  if (result.error && !options?.silentError) {
    logRuntimeError("platform.rpc", `Erro ao executar RPC ${fn}: ${result.error.message}`, {
      args,
      error: result.error,
    });
  }
  return result;
};

export const callPlatformAccountAdmin = async (action: string, payload: Record<string, unknown>, reason: string) => {
  const startedAt = performance.now();

  const { data, error } = await supabase.functions.invoke("platform-account-admin", {
    body: { action, payload, reason },
  });

  const durationMs = Math.round(performance.now() - startedAt);

  if (error) {
    let errorMsg = error.message || "Operação administrativa não pôde ser executada.";
    if ("context" in error && error.context && typeof (error.context as Response).json === "function") {
      try {
        const errorJson = (await (error.context as Response).json()) as { error?: string; msg?: string; message?: string };
        if (errorJson?.error) errorMsg = errorJson.error;
        else if (errorJson?.msg) errorMsg = errorJson.msg;
        else if (errorJson?.message) errorMsg = errorJson.message;
      } catch {
        // ignore fallback
      }
    }
    logRuntimeRpc(
      `functions/platform-account-admin:${action}`,
      payload,
      "error",
      durationMs,
      null,
      errorMsg
    );
    logRuntimeError("platform.admin", `Falha na ação ${action}: ${errorMsg}`, {
      payload,
      reason,
      error,
    });
    throw new Error(errorMsg);
  }

  logRuntimeRpc(
    `functions/platform-account-admin:${action}`,
    payload,
    "success",
    durationMs,
    data
  );

  const responseBody = data as { data?: unknown } | null;
  return responseBody?.data ?? data;
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

export const directoryKindLabels: Record<string, string> = {
  all: "Todos os tipos",
  clinic: "Clínicas",
  owner: "Owners (Proprietários)",
  account: "Usuários comuns",
  patient: "Pacientes",
  pending_account: "Pendências de cadastro",
};

export const directoryStatusLabels: Record<string, string> = {
  all: "Todos os status",
  active: "Ativo / Regular",
  pending: "Pendente de ativação",
  expiring_soon: "Próximo do vencimento (≤ 7d)",
  expired: "Vencido / Expirado",
  banned: "Bloqueado / Banido",
  paused: "Pausado temporariamente",
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
