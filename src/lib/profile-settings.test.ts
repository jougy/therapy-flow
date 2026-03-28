import { describe, expect, it } from "vitest";
import {
  formatCep,
  formatCpf,
  formatPhone,
  getProfilePublicCodeLabel,
  hasProfileAddressValue,
  isSelfServiceProfileAddressLocked,
  isSelfServiceProfileDateLocked,
  isSelfServiceProfileFieldLocked,
  readProfileAddress,
} from "@/lib/profile-settings";

describe("profile settings helpers", () => {
  it("formats cpf progressively", () => {
    expect(formatCpf("12345678910")).toBe("123.456.789-10");
  });

  it("formats brazilian phone progressively", () => {
    expect(formatPhone("11999998888")).toBe("(11) 99999-8888");
  });

  it("formats cep progressively", () => {
    expect(formatCep("01310930")).toBe("01310-930");
  });

  it("reads a safe address shape from json values", () => {
    expect(
      readProfileAddress({
        cep: "01310-930",
        city: "Sao Paulo",
        complement: "Sala 10",
        neighborhood: "Bela Vista",
        number: "100",
        state: "SP",
        street: "Av. Paulista",
      })
    ).toEqual({
      cep: "01310-930",
      city: "Sao Paulo",
      complement: "Sala 10",
      neighborhood: "Bela Vista",
      number: "100",
      state: "SP",
      street: "Av. Paulista",
    });
  });

  it("provides a fallback label for symbolic ids", () => {
    expect(getProfilePublicCodeLabel("003")).toBe("003");
    expect(getProfilePublicCodeLabel(null)).toBe("Aguardando ID");
  });

  it("detects when self-service fields should be locked", () => {
    expect(isSelfServiceProfileFieldLocked("Jougy")).toBe(true);
    expect(isSelfServiceProfileFieldLocked("")).toBe(false);
    expect(isSelfServiceProfileDateLocked("2026-03-27")).toBe(true);
    expect(isSelfServiceProfileDateLocked(null)).toBe(false);
  });

  it("detects whether an address was already filled", () => {
    expect(
      hasProfileAddressValue({
        cep: "",
        city: "",
        complement: "",
        neighborhood: "",
        number: "",
        state: "",
        street: "",
      })
    ).toBe(false);

    expect(
      isSelfServiceProfileAddressLocked({
        city: "Manaus",
      })
    ).toBe(true);
  });
});
