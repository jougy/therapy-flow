export const PUBLIC_APP_ORIGIN = "https://fisioterapia.prontohealth.workers.dev";

export const getPublicAppOrigin = (): string => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return import.meta.env.VITE_PUBLIC_APP_URL || PUBLIC_APP_ORIGIN;
};

export const buildPublicAppUrl = (path: string): string => {
  const origin = getPublicAppOrigin();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
};

