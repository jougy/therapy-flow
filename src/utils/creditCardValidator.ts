export type CardBrand = "visa" | "mastercard" | "elo" | "amex" | "hipercard" | "unknown";

export function detectCardBrand(cardNumber: string): CardBrand {
  const clean = cardNumber.replace(/\D/g, "");
  if (/^4/.test(clean)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(clean)) return "mastercard";
  if (/^(4011|438935|451416|4576|504175|5067|5090|627780|636297|636368|650|6516|6550)/.test(clean)) return "elo";
  if (/^3[47]/.test(clean)) return "amex";
  if (/^(606282|3841)/.test(clean)) return "hipercard";
  return "unknown";
}

export function validateLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

export function validateExpiry(expiry: string): { valid: boolean; error?: string } {
  const clean = expiry.replace(/\D/g, "");
  if (clean.length !== 4) {
    return { valid: false, error: "Informe a validade no formato MM/AA." };
  }

  const month = parseInt(clean.slice(0, 2), 10);
  const year = parseInt(`20${clean.slice(2, 4)}`, 10);

  if (month < 1 || month > 12) {
    return { valid: false, error: "Mês de validade inválido (01 a 12)." };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return { valid: false, error: "Cartão expirado." };
  }

  if (year > currentYear + 20) {
    return { valid: false, error: "Ano de validade inconsistente." };
  }

  return { valid: true };
}

export function validateCvv(cvv: string, brand: CardBrand = "unknown"): boolean {
  const clean = cvv.replace(/\D/g, "");
  if (brand === "amex") {
    return clean.length === 4;
  }
  return clean.length === 3 || clean.length === 4;
}

export function validateCardHolder(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 3 && trimmed.includes(" ");
}
