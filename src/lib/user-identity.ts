/**
 * Utilitário de Identidade Global de Usuários (Pluri-Health Identity)
 * Gera identificadores descritivos, descentralizados e verificáveis
 * combinando Base 36 (0-9, A-Z) com dígito verificador de integridade (mod 36).
 */

const BASE36_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Calcula o dígito de verificação ponderado (Módulo 36)
 * Similar ao algoritmo de verificação de CPF/CNPJ adaptado para alfanumérico.
 */
export function calculateMod36CheckDigit(payload: string): string {
  const clean = payload.toUpperCase().replace(/[^0-9A-Z]/g, "");
  let sum = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const val = BASE36_CHARS.indexOf(char);
    if (val >= 0) {
      const weight = ((i % 7) + 2); // Pesos de 2 a 8
      sum += val * weight;
    }
  }
  const remainder = sum % 36;
  return BASE36_CHARS[remainder];
}

/**
 * Gera ou formata um ID Global de Identidade do Usuário
 * Exemplo de formato resultante: PLR-8K4F-92X-7
 */
export function generateGlobalUserId(params: {
  userId?: string | null;
  publicCode?: string | null;
  createdAt?: string | null;
  email?: string | null;
}): string {
  const { userId, publicCode, email } = params;

  // Se já for um código no formato moderno com PLR-, preserva ou valida
  if (publicCode && publicCode.startsWith("PLR-") && publicCode.length >= 10) {
    return publicCode.toUpperCase();
  }

  // Se for um public_code numérico legado (ex: "004" ou "4"), converte para base alfanumérica descritiva
  let seed = "";
  if (userId) {
    // Usa partes do UUID
    const cleanUuid = userId.replace(/-/g, "").toUpperCase();
    seed = cleanUuid.slice(0, 7);
  } else if (email) {
    // Hash simples do e-mail
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = ((hash << 5) - hash) + email.charCodeAt(i);
      hash |= 0;
    }
    const abs = Math.abs(hash);
    seed = abs.toString(36).toUpperCase().padStart(6, "0").slice(0, 7);
  } else if (publicCode) {
    const num = parseInt(publicCode, 10);
    if (!isNaN(num)) {
      const baseNum = (num * 16807 + 104729) % 2176782336; // 36^6
      seed = baseNum.toString(36).toUpperCase().padStart(6, "0");
    } else {
      seed = publicCode.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 7);
    }
  } else {
    seed = Math.floor(Math.random() * 2176782336).toString(36).toUpperCase().padStart(6, "0");
  }

  // Assegura 7 caracteres no corpo da seed
  const paddedSeed = seed.padEnd(7, "X").slice(0, 7);
  const part1 = paddedSeed.slice(0, 4);
  const part2 = paddedSeed.slice(4, 7);
  const checkDigit = calculateMod36CheckDigit(`${part1}${part2}`);

  return `PLR-${part1}-${part2}-${checkDigit}`;
}

/**
 * Valida se um ID Global possui o dígito verificador correto
 */
export function validateGlobalUserId(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  const match = code.toUpperCase().match(/^PLR-([0-9A-Z]{4})-([0-9A-Z]{3})-([0-9A-Z])$/);
  if (!match) return false;
  const [, part1, part2, checkDigit] = match;
  const expectedCheck = calculateMod36CheckDigit(`${part1}${part2}`);
  return checkDigit === expectedCheck;
}
