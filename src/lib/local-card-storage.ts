/**
 * Utilitário seguro para salvar metadados de cartão de crédito no dispositivo local.
 *
 * RIGOROSAMENTE CONFORME AO PADRÃO PCI-DSS:
 * - NUNCA armazena o número completo do cartão (PAN cru).
 * - NUNCA armazena o código de segurança (CVV / CVC).
 * - Armazena apenas: nome do titular (holderName), últimos 4 dígitos (last4), bandeira (brand) e validade (expiry).
 */

export interface SavedLocalCard {
  holderName: string;
  last4: string;
  brand: string;
  expiry: string;
  savedAt: string;
}

const LOCAL_CARD_KEY = "pluri_saved_card_meta_v1";

/**
 * Salva os metadados mascarados do cartão no LocalStorage do navegador.
 */
export function saveLocalCardMetadata(card: {
  holderName: string;
  cardNumber: string;
  brand?: string;
  expiry: string;
}): void {
  try {
    if (typeof localStorage === "undefined" || typeof localStorage.setItem !== "function") return;
    const cleanNumber = card.cardNumber.replace(/\D/g, "");
    const last4 = cleanNumber.slice(-4);
    if (!last4 || last4.length < 4) return;

    const data: SavedLocalCard = {
      holderName: card.holderName.trim().toUpperCase(),
      last4,
      brand: (card.brand || "unknown").toLowerCase(),
      expiry: card.expiry.trim(),
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem(LOCAL_CARD_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("[local-card-storage] Erro ao salvar metadados do cartão localmente:", err);
  }
}

/**
 * Recupera os metadados do cartão salvo localmente, caso existam.
 */
export function getSavedLocalCardMetadata(): SavedLocalCard | null {
  try {
    if (typeof localStorage === "undefined" || typeof localStorage.getItem !== "function") return null;
    const raw = localStorage.getItem(LOCAL_CARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedLocalCard;
    if (parsed && parsed.last4 && parsed.holderName) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Remove os metadados do cartão salvo localmente.
 */
export function clearSavedLocalCardMetadata(): void {
  try {
    if (typeof localStorage === "undefined" || typeof localStorage.removeItem !== "function") return;
    localStorage.removeItem(LOCAL_CARD_KEY);
  } catch (err) {
    console.warn("[local-card-storage] Erro ao remover cartão salvo:", err);
  }
}
