export interface CepLookupResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  source?: string;
}

export type CepLookupErrorReason = "INVALID_LENGTH" | "NOT_FOUND" | "NETWORK_ERROR";

export class CepLookupError extends Error {
  reason: CepLookupErrorReason;

  constructor(reason: CepLookupErrorReason, message: string) {
    super(message);
    this.name = "CepLookupError";
    this.reason = reason;
  }
}

export const cleanCepDigits = (value: string): string => {
  return value.replace(/\D/g, "").slice(0, 8);
};

export const formatCepString = (value: string): string => {
  const digits = cleanCepDigits(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

/**
 * Returns the first promise that resolves to a non-null, valid value.
 * Resolves to null only when all provided promises resolve to null or reject.
 */
export const raceFirstSuccess = async <T>(promises: Promise<T | null>[]): Promise<T | null> => {
  return new Promise((resolve) => {
    let resolved = false;
    let pending = promises.length;

    if (pending === 0) {
      resolve(null);
      return;
    }

    promises.forEach((p) => {
      p.then((val) => {
        if (!resolved && val !== null && val !== undefined) {
          resolved = true;
          resolve(val);
        } else {
          pending--;
          if (pending === 0 && !resolved) {
            resolve(null);
          }
        }
      }).catch(() => {
        pending--;
        if (pending === 0 && !resolved) {
          resolve(null);
        }
      });
    });
  });
};

/**
 * Tier 1: Same-origin API endpoint (/api/cep/:cep)
 * Handled by Vite dev server middleware locally and Cloudflare Pages Functions in production.
 * This completely eliminates CORS, mobile CGNAT carrier blocks, and mobile DNS adblocker blocks.
 */
const fetchLocalProxy = async (cleanCep: string, timeoutMs = 3000): Promise<CepLookupResult | null> => {
  try {
    if (typeof window === "undefined" || !window.location) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`/api/cep/${cleanCep}`, {
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.city && data.state) {
        return {
          cep: formatCepString(data.cep || cleanCep),
          street: data.street || "",
          neighborhood: data.neighborhood || "",
          city: data.city || "",
          state: (data.state || "").toUpperCase(),
          source: data.source || "api-proxy",
        };
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return null;
  }
};

/**
 * Tier 2: Public API - BrasilAPI
 */
const fetchBrasilApi = async (cleanCep: string, signal?: AbortSignal): Promise<CepLookupResult | null> => {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`, {
      signal,
      mode: "cors",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.city || !data.state) return null;

    return {
      cep: formatCepString(data.cep || cleanCep),
      street: data.street || "",
      neighborhood: data.neighborhood || "",
      city: data.city || "",
      state: (data.state || "").toUpperCase(),
      source: "brasilapi",
    };
  } catch {
    return null;
  }
};

/**
 * Tier 2: Public API - ViaCEP
 */
const fetchViaCep = async (cleanCep: string, signal?: AbortSignal): Promise<CepLookupResult | null> => {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
      signal,
      mode: "cors",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.erro === true || data.erro === "true") return null;

    return {
      cep: data.cep || formatCepString(cleanCep),
      street: data.logradouro || "",
      neighborhood: data.bairro || "",
      city: data.localidade || "",
      state: (data.uf || "").toUpperCase(),
      source: "viacep",
    };
  } catch {
    return null;
  }
};

/**
 * Tier 2: Public API - OpenCEP
 */
const fetchOpenCep = async (cleanCep: string, signal?: AbortSignal): Promise<CepLookupResult | null> => {
  try {
    const res = await fetch(`https://opencep.com/v1/${cleanCep}`, {
      signal,
      mode: "cors",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.erro || !data.localidade) return null;

    return {
      cep: data.cep || formatCepString(cleanCep),
      street: data.logradouro || "",
      neighborhood: data.bairro || "",
      city: data.localidade || "",
      state: (data.uf || "").toUpperCase(),
      source: "opencep",
    };
  } catch {
    return null;
  }
};

/**
 * Tier 2: Public API - AwesomeAPI
 */
const fetchAwesomeApi = async (cleanCep: string, signal?: AbortSignal): Promise<CepLookupResult | null> => {
  try {
    const res = await fetch(`https://cep.awesomeapi.com.br/json/${cleanCep}`, {
      signal,
      mode: "cors",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.city || !data.state) return null;

    return {
      cep: formatCepString(data.cep || cleanCep),
      street: data.address || data.address_name || "",
      neighborhood: data.district || "",
      city: data.city || "",
      state: (data.state || "").toUpperCase(),
      source: "awesomeapi",
    };
  } catch {
    return null;
  }
};

/**
 * Tier 3: ViaCEP JSONP via dynamic <script> tag.
 * Completely immune to CORS restrictions, preflight failures, and mixed-content fetch rules.
 */
const fetchViaCepJsonp = (cleanCep: string, timeoutMs = 6000): Promise<CepLookupResult | null> => {
  return new Promise((resolve) => {
    if (
      typeof document === "undefined" ||
      typeof window === "undefined" ||
      (typeof process !== "undefined" && process.env?.NODE_ENV === "test")
    ) {
      return resolve(null);
    }

    const callbackName = `__viacep_cb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const script = document.createElement("script");
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (script.parentNode) script.parentNode.removeChild(script);
      delete (window as Record<string, unknown>)[callbackName];
    };

    (window as Record<string, unknown>)[callbackName] = (data: any) => {
      cleanup();
      if (!data || data.erro) {
        resolve(null);
      } else {
        resolve({
          cep: data.cep || formatCepString(cleanCep),
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: (data.uf || "").toUpperCase(),
          source: "viacep-jsonp",
        });
      }
    };

    script.src = `https://viacep.com.br/ws/${cleanCep}/json/?callback=${callbackName}`;
    script.onerror = () => {
      cleanup();
      resolve(null);
    };

    timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    document.head.appendChild(script);
  });
};

/**
 * Multi-tier resilient CEP lookup:
 * 1. Same-Origin internal proxy (/api/cep/:cep)
 * 2. Parallel racing of BrasilAPI, ViaCEP, OpenCEP, and AwesomeAPI
 * 3. ViaCEP JSONP fallback
 */
export const lookupCep = async (rawCep: string): Promise<CepLookupResult> => {
  const clean = cleanCepDigits(rawCep);

  if (clean.length !== 8) {
    throw new CepLookupError("INVALID_LENGTH", "O CEP deve conter exatamente 8 dígitos.");
  }

  // 1. Try same-origin proxy first
  const proxyResult = await fetchLocalProxy(clean, 2500);
  if (proxyResult) {
    return proxyResult;
  }

  // 2. Parallel race across all external APIs + JSONP
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const providers: Promise<CepLookupResult | null>[] = [
      fetchBrasilApi(clean, controller.signal),
      fetchViaCep(clean, controller.signal),
      fetchOpenCep(clean, controller.signal),
      fetchAwesomeApi(clean, controller.signal),
      fetchViaCepJsonp(clean, 7000),
    ];

    const result = await raceFirstSuccess(providers);
    if (result) {
      return result;
    }
  } finally {
    clearTimeout(timeoutId);
  }

  throw new CepLookupError(
    "NOT_FOUND",
    "Não foi possível encontrar o endereço para o CEP informado. Preencha os campos manualmente."
  );
};
