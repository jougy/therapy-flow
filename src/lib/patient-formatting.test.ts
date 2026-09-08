import { describe, it, expect } from "vitest";
import {
  formatPatientDate,
  formatDateTime,
  formatAddress,
  cleanDigits,
  parseSnapshotState,
} from "@/lib/patient-formatting";

describe("patient-formatting utilities", () => {
  it("formats date correctly", () => {
    expect(formatPatientDate("1990-05-15")).toBe("15/05/1990");
    expect(formatPatientDate(null)).toBeNull();
    expect(formatPatientDate(undefined)).toBeNull();
  });

  it("formats datetime or returns fallback", () => {
    expect(formatDateTime(null)).toBe("Sem data registrada");
    expect(formatDateTime("2026-03-01T10:00:00Z")).toContain("2026");
  });

  it("formats address with multiline output", () => {
    const address = formatAddress({
      street: "Av. Paulista",
      address_number: "1000",
      address_complement: "Apto 42",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
      cep: "01310-100",
      country: "Brasil",
    });
    expect(address).toContain("Av. Paulista, 1000");
    expect(address).toContain("Apto 42");
    expect(address).toContain("Bela Vista, São Paulo, SP");
    expect(address).toContain("01310-100");
  });

  it("returns null for empty address", () => {
    expect(formatAddress(null)).toBeNull();
    expect(formatAddress({})).toBeNull();
  });

  it("cleans digits from formatted strings", () => {
    expect(cleanDigits("(11) 98765-4321")).toBe("11987654321");
    expect(cleanDigits("123.456.789-00")).toBe("12345678900");
    expect(cleanDigits(null)).toBe("");
  });

  it("safely parses snapshot state from JSON", () => {
    const rawJson = {
      allergies: "Dipirona",
      diagnoses: "CID F32",
      invalidField: 123,
    };
    const parsed = parseSnapshotState(rawJson);
    expect(parsed.allergies).toBe("Dipirona");
    expect(parsed.diagnoses).toBe("CID F32");
    expect(parsed.blood_type).toBe("");
    expect(parsed.clinical_notes).toBe("");
  });

  it("handles null or primitive JSON gracefully", () => {
    const parsed = parseSnapshotState(null as any);
    expect(parsed.allergies).toBe("");
    expect(parsed.diagnoses).toBe("");
  });
});
