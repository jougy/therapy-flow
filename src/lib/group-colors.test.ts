import { describe, expect, it } from "vitest";
import {
  cmykToRgb,
  getLegacyGroupHex,
  getReadableTextColor,
  hexToRgb,
  hsvToRgb,
  normalizeHexColor,
  rgbToCmyk,
  rgbToHex,
  rgbToHsv,
  toRgbaString,
} from "@/lib/group-colors";

describe("group color helpers", () => {
  it("normalizes hex strings", () => {
    expect(normalizeHexColor("abc")).toBe("#AABBCC");
    expect(normalizeHexColor("#11aa22")).toBe("#11AA22");
    expect(normalizeHexColor("wat")).toBeNull();
  });

  it("converts between rgb, hsv and cmyk", () => {
    const rgb = { r: 120, g: 200, b: 80 };
    const hsv = rgbToHsv(rgb);
    const cmyk = rgbToCmyk(rgb);

    expect(hsvToRgb(hsv)).toEqual(rgb);
    expect(cmykToRgb(cmyk)).toEqual(rgb);
    expect(rgbToHex(rgb)).toBe("#78C850");
    expect(hexToRgb("#78C850")).toEqual(rgb);
  });

  it("builds rgba strings and contrast colors", () => {
    expect(toRgbaString("#FF0000", 50)).toBe("rgba(255, 0, 0, 0.5)");
    expect(getReadableTextColor("#FFFFFF")).toBe("#111827");
    expect(getReadableTextColor("#111827")).toBe("#F8FAFC");
  });

  it("falls back from legacy names to hex", () => {
    expect(getLegacyGroupHex("lavender")).toBe("#C4B5FD");
    expect(getLegacyGroupHex("#010203")).toBe("#010203");
  });
});
