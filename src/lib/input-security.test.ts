import { describe, expect, it } from "vitest";
import { sanitizeMultilineInput, sanitizeSingleLineInput, sanitizeTextInput } from "@/lib/input-security";

describe("input security helpers", () => {
  it("truncates single-line input by code points", () => {
    expect(sanitizeSingleLineInput("abcdef", 4)).toBe("abcd");
  });

  it("keeps linguistic unicode content but strips emojis and flags", () => {
    expect(sanitizeSingleLineInput("Ana😀🚀🇧🇷✨", 20)).toBe("Ana");
    expect(sanitizeSingleLineInput("Café こんにちは مرحبا", 40)).toBe("Café こんにちは مرحبا");
  });

  it("removes control characters from single-line input and flattens line breaks", () => {
    expect(sanitizeSingleLineInput("Clínica\u0000\r\nAurora\tTeste", 40)).toBe("Clínica Aurora Teste");
  });

  it("removes invisible bidi and zero-width controls used to disguise text", () => {
    expect(sanitizeSingleLineInput("abc\u202Egpj.exe\u200B", 40)).toBe("abcgpj.exe");
  });

  it("normalizes translated and accented content without preserving pictographs", () => {
    expect(sanitizeSingleLineInput("Cafe\u0301 こんにちは مرحبا 😀", 40)).toBe("Café こんにちは مرحبا ");
  });

  it("preserves line breaks for multiline input while removing unsafe control chars", () => {
    expect(sanitizeMultilineInput("Linha 1\r\nLinha\u0000 2\tok", 100)).toBe("Linha 1\nLinha 2 ok");
  });

  it("respects the multiline option in the generic sanitizer", () => {
    expect(sanitizeTextInput("a\r\nb", { maxLength: 10, multiline: true })).toBe("a\nb");
    expect(sanitizeTextInput("a\r\nb", { maxLength: 10, multiline: false })).toBe("a b");
  });
});
