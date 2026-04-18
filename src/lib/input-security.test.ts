import { describe, expect, it } from "vitest";
import { sanitizeMultilineInput, sanitizeSingleLineInput, sanitizeTextInput } from "@/lib/input-security";

describe("input security helpers", () => {
  it("truncates single-line input by code points", () => {
    expect(sanitizeSingleLineInput("abcdef", 4)).toBe("abcd");
  });

  it("keeps unicode content but enforces a reasonable limit", () => {
    expect(sanitizeSingleLineInput("Ana😀🚀", 5)).toBe("Ana😀🚀");
    expect(sanitizeSingleLineInput("Ana😀🚀✨", 5)).toBe("Ana😀🚀");
  });

  it("removes control characters from single-line input and flattens line breaks", () => {
    expect(sanitizeSingleLineInput("Clínica\u0000\r\nAurora\tTeste", 40)).toBe("Clínica Aurora Teste");
  });

  it("preserves line breaks for multiline input while removing unsafe control chars", () => {
    expect(sanitizeMultilineInput("Linha 1\r\nLinha\u0000 2\tok", 100)).toBe("Linha 1\nLinha 2 ok");
  });

  it("respects the multiline option in the generic sanitizer", () => {
    expect(sanitizeTextInput("a\r\nb", { maxLength: 10, multiline: true })).toBe("a\nb");
    expect(sanitizeTextInput("a\r\nb", { maxLength: 10, multiline: false })).toBe("a b");
  });
});
