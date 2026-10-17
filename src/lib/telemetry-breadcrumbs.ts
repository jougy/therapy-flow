/**
 * Telemetry Breadcrumbs Manager
 * Mantém um buffer circular leve em memória (últimos 15 passos do usuário)
 * para anexar o histórico de ações quando ocorrer um erro ou bug report.
 */

export type BreadcrumbCategory = "navigation" | "action" | "rpc" | "ui";

export interface TelemetryBreadcrumb {
  id: string;
  timestamp: number;
  timeString: string;
  category: BreadcrumbCategory;
  message: string;
  data?: Record<string, unknown>;
}

const MAX_BREADCRUMBS = 15;
let breadcrumbBuffer: TelemetryBreadcrumb[] = [];

/**
 * Registra um novo passo/breadcrumb na trilha do usuário
 */
export const addBreadcrumb = (
  category: BreadcrumbCategory,
  message: string,
  data?: Record<string, unknown>
): TelemetryBreadcrumb => {
  const now = new Date();
  const timeString = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now
    .getMilliseconds()
    .toString()
    .padStart(3, "0")}`;

  const breadcrumb: TelemetryBreadcrumb = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now.getTime(),
    timeString,
    category,
    message,
    data,
  };

  breadcrumbBuffer = [...breadcrumbBuffer.slice(-(MAX_BREADCRUMBS - 1)), breadcrumb];
  return breadcrumb;
};

/**
 * Retorna os breadcrumbs recentes acumulados
 */
export const getRecentBreadcrumbs = (): TelemetryBreadcrumb[] => {
  return [...breadcrumbBuffer];
};

/**
 * Limpa o histórico de breadcrumbs (útil após logout ou em testes)
 */
export const clearBreadcrumbs = () => {
  breadcrumbBuffer = [];
};

/**
 * Helper para capturar metadados do ambiente de execução
 */
export const getEnvironmentMetadata = () => {
  if (typeof window === "undefined") {
    return {
      isServer: true,
      viewport: "unknown",
      userAgent: "unknown",
      platform: "unknown",
      deviceType: "desktop" as const,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const ua = window.navigator.userAgent || "";
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || width < 768;

  let os = "Desktop";
  if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Mac/i.test(ua)) os = "macOS";
  else if (/Win/i.test(ua)) os = "Windows";
  else if (/Linux/i.test(ua)) os = "Linux";

  return {
    viewport: `${width}x${height}`,
    viewportWidth: width,
    viewportHeight: height,
    deviceType: isMobile ? ("mobile" as const) : ("desktop" as const),
    os,
    userAgent: ua,
    pathname: window.location.pathname,
  };
};
