import { describe, expect, it } from "vitest";

import {
  buildPatientRegistrationUrl,
  extractCpfDigits,
  getPatientRegistrationPassword,
} from "@/lib/patient-registration";

describe("patient registration helpers", () => {
  it("extracts only cpf digits", () => {
    expect(extractCpfDigits("123.456.789-00")).toBe("12345678900");
  });

  it("returns the first six digits when cpf is complete enough", () => {
    expect(getPatientRegistrationPassword("123.456.789-00")).toBe("123456");
  });

  it("returns null when cpf has fewer than six digits", () => {
    expect(getPatientRegistrationPassword("123.4")).toBeNull();
  });

  it("builds the public registration url from origin and token", () => {
    expect(buildPatientRegistrationUrl("https://example.com", "abc123")).toBe(
      "https://example.com/cadastro/paciente/abc123",
    );
  });
});
