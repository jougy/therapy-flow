import { describe, expect, it } from "vitest";
import {
  formatCep,
  formatCpf,
  formatPhone,
  getProfilePublicCodeLabel,
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
    expect(getProfilePublicCodeLabel("COL-AB12CD34")).toBe("COL-AB12CD34");
    expect(getProfilePublicCodeLabel(null)).toBe("Aguardando código");
  });
});
