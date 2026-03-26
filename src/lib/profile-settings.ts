import type { Json } from "@/integrations/supabase/types";

export interface ProfileAddress {
  cep: string;
  city: string;
  complement: string;
  neighborhood: string;
  number: string;
  state: string;
  street: string;
}

const digitsOnly = (value: string) => value.replace(/\D/g, "");

export const formatCpf = (value: string) => {
  const digits = digitsOnly(value).slice(0, 11);

  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
};

export const formatPhone = (value: string) => {
  const digits = digitsOnly(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
};

export const formatCep = (value: string) => digitsOnly(value).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");

export const readProfileAddress = (value: Json | null | undefined): ProfileAddress => {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

  return {
    cep: typeof record.cep === "string" ? record.cep : "",
    city: typeof record.city === "string" ? record.city : "",
    complement: typeof record.complement === "string" ? record.complement : "",
    neighborhood: typeof record.neighborhood === "string" ? record.neighborhood : "",
    number: typeof record.number === "string" ? record.number : "",
    state: typeof record.state === "string" ? record.state : "",
    street: typeof record.street === "string" ? record.street : "",
  };
};

export const buildProfileAddress = (address: ProfileAddress) => ({
  cep: address.cep.trim(),
  city: address.city.trim(),
  complement: address.complement.trim(),
  neighborhood: address.neighborhood.trim(),
  number: address.number.trim(),
  state: address.state.trim(),
  street: address.street.trim(),
});

export const getProfilePublicCodeLabel = (value: string | null) => value || "Aguardando código";
