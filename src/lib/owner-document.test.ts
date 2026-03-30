import { describe, expect, it } from "vitest";
import { formatOwnerDocument, isOwnerDocumentValid } from "@/lib/owner-document";

describe("owner-document", () => {
  it("formats cpf progressively", () => {
    expect(formatOwnerDocument("12345678901")).toBe("123.456.789-01");
  });

  it("formats cnpj progressively", () => {
    expect(formatOwnerDocument("12345678000190")).toBe("12.345.678/0001-90");
  });

  it("accepts only 11 or 14 digits as valid owner documents", () => {
    expect(isOwnerDocumentValid("12345678901")).toBe(true);
    expect(isOwnerDocumentValid("12345678000190")).toBe(true);
    expect(isOwnerDocumentValid("1234567890")).toBe(false);
    expect(isOwnerDocumentValid("1234567800019")).toBe(false);
  });
});
