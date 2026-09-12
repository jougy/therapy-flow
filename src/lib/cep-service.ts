export interface CepLookupResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  source?: string;
}

export type CepLookupErrorReason = "INVALID_LENGTH" | "NOT_FOUND";

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
 * Robust, direct multi-provider CEP lookup:
 * 1. ViaCEP (Primary official provider)
 * 2. BrasilAPI (Fallback)
 * 3. AwesomeAPI (Fallback)
 * 4. OpenCEP (Fallback)
 * 5. Local /api/cep proxy (Fallback for firewalled environments)
 */
export const lookupCep = async (rawCep: string): Promise<CepLookupResult> => {
  const digits = cleanCepDigits(rawCep);

  if (digits.length !== 8) {
    throw new CepLookupError("INVALID_LENGTH", "Informe um CEP com 8 dígitos.");
  }

  // 1. ViaCEP
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (res.ok) {
      const data = await res.json();
      if (!data.erro) {
        return {
          cep: data.cep || formatCepString(digits),
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: (data.uf || "").toUpperCase(),
          source: "viacep",
        };
      }
    }
  } catch {
    // continue to next provider
  }

  // 2. BrasilAPI
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`);
    if (res.ok) {
      const data = await res.json();
      if (data.city && data.state) {
        return {
          cep: formatCepString(data.cep || digits),
          street: data.street || "",
          neighborhood: data.neighborhood || "",
          city: data.city || "",
          state: (data.state || "").toUpperCase(),
          source: "brasilapi",
        };
      }
    }
  } catch {
    // continue to next provider
  }

  // 3. AwesomeAPI
  try {
    const res = await fetch(`https://cep.awesomeapi.com.br/json/${digits}`);
    if (res.ok) {
      const data = await res.json();
      if (data.city && data.state) {
        return {
          cep: formatCepString(data.cep || digits),
          street: data.address || data.address_name || "",
          neighborhood: data.district || "",
          city: data.city || "",
          state: (data.state || "").toUpperCase(),
          source: "awesomeapi",
        };
      }
    }
  } catch {
    // continue to next provider
  }

  // 4. OpenCEP
  try {
    const res = await fetch(`https://opencep.com/v1/${digits}`);
    if (res.ok) {
      const data = await res.json();
      if (data.localidade && data.uf) {
        return {
          cep: data.cep || formatCepString(digits),
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: (data.uf || "").toUpperCase(),
          source: "opencep",
        };
      }
    }
  } catch {
    // continue to next provider
  }

  // 5. Same-origin proxy fallback
  try {
    if (typeof window !== "undefined" && window.location) {
      const res = await fetch(`/api/cep/${digits}`);
      if (res.ok) {
        const data = await res.json();
        if (data.city && data.state) {
          return {
            cep: formatCepString(data.cep || digits),
            street: data.street || "",
            neighborhood: data.neighborhood || "",
            city: data.city || "",
            state: (data.state || "").toUpperCase(),
            source: "proxy",
          };
        }
      }
    }
  } catch {
    // all failed
  }

  throw new CepLookupError(
    "NOT_FOUND",
    "Não foi possível encontrar o endereço para o CEP informado. Preencha os campos manualmente."
  );
};
