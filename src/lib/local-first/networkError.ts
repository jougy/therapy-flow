const NETWORK_ERROR_PATTERNS = [
  "failed to fetch",
  "networkerror",
  "network request failed",
  "load failed",
  "internet disconnected",
  "err_internet_disconnected",
  "fetch failed",
  "econnreset",
  "etimedout",
];

/**
 * Checks whether the browser is offline or an error represents a network transport failure.
 */
export function isOfflineOrNetworkError(error?: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }

  if (!error) return false;

  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return true;
  }

  if (typeof error === "string") {
    const lower = error.toLowerCase();
    return NETWORK_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
  }

  if (typeof error === "object") {
    const errObj = error as { message?: unknown; details?: unknown; name?: unknown };
    const text = [errObj.name, errObj.message, errObj.details]
      .filter((part): part is string => typeof part === "string")
      .join(" ")
      .toLowerCase();

    if (text && NETWORK_ERROR_PATTERNS.some((pattern) => text.includes(pattern))) {
      return true;
    }
  }

  return false;
}
