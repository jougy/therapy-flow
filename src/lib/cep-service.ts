export interface CepLookupResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  source?: "viacep" | "brasilapi" | "awesomeapi";
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

const fetchWithTimeout = async (url: string, timeoutMs = 3500): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

const lookupViaCep = async (cleanCep: string): Promise<CepLookupResult | null> => {
  try {
    const res = await fetchWithTimeout(`https://viacep.com.br/ws/${cleanCep}/json/`, 3500);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro === true || data.erro === "true") {
      return null;
    }
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

const lookupBrasilApi = async (cleanCep: string): Promise<CepLookupResult | null> => {
  try {
    const res = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`, 3500);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.city || !data.state) {
      return null;
    }
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

const lookupAwesomeApi = async (cleanCep: string): Promise<CepLookupResult | null> => {
  try {
    const res = await fetchWithTimeout(`https://cep.awesomeapi.com.br/json/${cleanCep}`, 3500);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.city || !data.state) {
      return null;
    }
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
 * Searches address by CEP with multiple fallbacks:
 * 1. ViaCEP
 * 2. BrasilAPI
 * 3. AwesomeAPI
 */
export const lookupCep = async (rawCep: string): Promise<CepLookupResult> => {
  const clean = cleanCepDigits(rawCep);

  if (clean.length !== 8) {
    throw new CepLookupError("INVALID_LENGTH", "O CEP deve conter exatamente 8 dígitos.");
  }

  // 1. Try ViaCEP
  const viaCepResult = await lookupViaCep(clean);
  if (viaCepResult) return viaCepResult;

  // 2. Fallback to BrasilAPI
  const brasilApiResult = await lookupBrasilApi(clean);
  if (brasilApiResult) return brasilApiResult;

  // 3. Fallback to AwesomeAPI
  const awesomeApiResult = await lookupAwesomeApi(clean);
  if (awesomeApiResult) return awesomeApiResult;

  throw new CepLookupError(
    "NOT_FOUND",
    "Não foi possível encontrar o endereço para o CEP informado. Preencha os campos manualmente."
  );
};
