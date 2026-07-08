export const PUBLIC_APP_ORIGIN = "https://fisioterapia.prontohealth.workers.dev";

export const buildPublicAppUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${PUBLIC_APP_ORIGIN}${normalizedPath}`;
};
