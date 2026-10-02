import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveLocalCardMetadata,
  getSavedLocalCardMetadata,
  clearSavedLocalCardMetadata,
} from "./local-card-storage";

describe("local-card-storage (PCI-DSS compliant metadata cache)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should safely save masked card metadata without storing full PAN or CVV", () => {
    saveLocalCardMetadata({
      holderName: "Dra. Maria Silva",
      cardNumber: "4111 2222 3333 4567",
      brand: "visa",
      expiry: "12/28",
    });

    const saved = getSavedLocalCardMetadata();
    expect(saved).not.toBeNull();
    expect(saved?.holderName).toBe("DRA. MARIA SILVA");
    expect(saved?.last4).toBe("4567");
    expect(saved?.brand).toBe("visa");
    expect(saved?.expiry).toBe("12/28");
    expect(saved?.savedAt).toBeDefined();

    // Verify localStorage raw content to ensure full PAN was never written
    const raw = localStorage.getItem("pluri_saved_card_meta_v1");
    expect(raw).not.toContain("4111222233334567");
    expect(raw).not.toContain("4111 2222 3333 4567");
  });

  it("should default brand to 'unknown' when not provided", () => {
    saveLocalCardMetadata({
      holderName: "João Santos",
      cardNumber: "5500000000009876",
      expiry: "05/29",
    });

    const saved = getSavedLocalCardMetadata();
    expect(saved).not.toBeNull();
    expect(saved?.brand).toBe("unknown");
    expect(saved?.last4).toBe("9876");
  });

  it("should ignore saving if cardNumber has fewer than 4 digits", () => {
    saveLocalCardMetadata({
      holderName: "Teste Invalido",
      cardNumber: "12",
      expiry: "05/29",
    });

    const saved = getSavedLocalCardMetadata();
    expect(saved).toBeNull();
  });

  it("should return null if nothing is saved in localStorage", () => {
    const saved = getSavedLocalCardMetadata();
    expect(saved).toBeNull();
  });

  it("should return null and handle corrupt JSON in localStorage gracefully", () => {
    localStorage.setItem("pluri_saved_card_meta_v1", "{invalid json");
    const saved = getSavedLocalCardMetadata();
    expect(saved).toBeNull();
  });

  it("should return null if saved payload is missing essential fields (last4 or holderName)", () => {
    localStorage.setItem("pluri_saved_card_meta_v1", JSON.stringify({ brand: "mastercard" }));
    const saved = getSavedLocalCardMetadata();
    expect(saved).toBeNull();
  });

  it("should clear saved card metadata when clearSavedLocalCardMetadata is called", () => {
    saveLocalCardMetadata({
      holderName: "Dra. Ana Costa",
      cardNumber: "4000123456789010",
      brand: "elo",
      expiry: "11/30",
    });

    expect(getSavedLocalCardMetadata()).not.toBeNull();

    clearSavedLocalCardMetadata();

    expect(getSavedLocalCardMetadata()).toBeNull();
    expect(localStorage.getItem("pluri_saved_card_meta_v1")).toBeNull();
  });

  it("should handle storage exceptions gracefully without crashing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => {
      saveLocalCardMetadata({
        holderName: "Dra. Falha",
        cardNumber: "4000123456781111",
        expiry: "08/30",
      });
    }).not.toThrow();
  });
});
