import type React from "react";
import { ToastAction } from "@/components/ui/toast";

export type TrashEntityType = "sessions" | "patients" | "forms";

export interface TrashItem {
  id: string;
  entity_type: TrashEntityType;
  title: string;
  subtitle: string | null;
  deleted_at: string;
  deleted_by_name: string;
  expires_at: string;
}

export interface SundayCountdownResult {
  nextSundayDateFormatted: string;
  daysRemaining: number;
  expiresAt: Date;
}

/**
 * Formatação amigável de data ISO para exibição na lixeira (ex: "18/09/2026 às 11:00").
 */
export const formatTrashDate = (isoString?: string | null): string => {
  if (!isoString) return "-";
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  } catch {
    return "-";
  }
};

/**
 * Calcula a data e contagem regressiva até o próximo domingo às 23:59:59.
 * Se a data fornecida já for domingo após as 23:59:59.999, calcula o domingo seguinte.
 */
export const calculateNextSundayCountdown = (nowDate: Date = new Date()): SundayCountdownResult => {
  const current = new Date(nowDate);
  const dayOfWeek = current.getDay(); // 0 = Domingo, 1 = Segunda, etc.
  let daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

  const nextSunday = new Date(current);
  nextSunday.setDate(current.getDate() + daysUntilSunday);
  nextSunday.setHours(23, 59, 59, 999);

  // Se já passou das 23:59:59.999 do domingo atual, aponta para o próximo domingo
  if (current.getTime() > nextSunday.getTime()) {
    daysUntilSunday = 7;
    nextSunday.setDate(nextSunday.getDate() + 7);
  }

  const day = String(nextSunday.getDate()).padStart(2, "0");
  const month = String(nextSunday.getMonth() + 1).padStart(2, "0");
  const year = nextSunday.getFullYear();

  return {
    nextSundayDateFormatted: `${day}/${month}/${year} às 23:59`,
    daysRemaining: daysUntilSunday,
    expiresAt: nextSunday,
  };
};

/**
 * Retorna o caminho de navegação canônico para a lixeira da clínica ou rota global de fallback.
 */
export const getTrashRoutePath = (clinicKey?: string | null): string => {
  return clinicKey ? `/clinica/${clinicKey}/configuracoes/lixeira` : "/configuracoes/lixeira";
};

/**
 * Executa navegação segura para a lixeira da clínica.
 * Funciona perfeitamente tanto com a função `navigate` do React Router quanto sem ela (fallback para `window.location.assign`).
 */
export const navigateToClinicTrash = (
  clinicKey?: string | null,
  navigate?: ((path: string) => void) | null
): void => {
  const targetPath = getTrashRoutePath(clinicKey);

  if (typeof navigate === "function") {
    try {
      navigate(targetPath);
      return;
    } catch {
      // Falha graciosa caso o hook/contexto de navegação tenha sido desmontado
    }
  }

  if (typeof window !== "undefined" && window.location) {
    window.location.assign(targetPath);
  }
};

/**
 * Cria a ação interativa de Toast para acessar a lixeira.
 * Suporta execução isolada (com ou sem contexto de router).
 */
export const createTrashToastAction = (
  clinicKey?: string | null,
  navigate?: ((path: string) => void) | null,
  label = "Acessar a lixeira"
): React.ReactElement => {
  return (
    <ToastAction
      altText={label}
      onClick={() => navigateToClinicTrash(clinicKey, navigate)}
    >
      {label}
    </ToastAction>
  );
};
