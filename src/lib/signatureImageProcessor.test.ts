import { describe, expect, it } from "vitest";
import {
  findOpaqueBounds,
  isSupportedSignatureFile,
  removeLightBackgroundFromPixels,
} from "./signatureImageProcessor";

describe("signatureImageProcessor", () => {
  describe("isSupportedSignatureFile", () => {
    it("accepts .jpg, .jpeg, .png, .svg, and .webp files", () => {
      expect(isSupportedSignatureFile({ name: "sig.jpg", type: "image/jpeg" })).toBe(true);
      expect(isSupportedSignatureFile({ name: "sig.JPEG", type: "image/jpeg" })).toBe(true);
      expect(isSupportedSignatureFile({ name: "sig.png", type: "image/png" })).toBe(true);
      expect(isSupportedSignatureFile({ name: "sig.svg", type: "image/svg+xml" })).toBe(true);
      expect(isSupportedSignatureFile({ name: "sig.webp", type: "" })).toBe(true);
    });

    it("rejects unsupported formats like .pdf or .gif", () => {
      expect(isSupportedSignatureFile({ name: "doc.pdf", type: "application/pdf" })).toBe(false);
      expect(isSupportedSignatureFile({ name: "anim.gif", type: "image/gif" })).toBe(false);
    });
  });

  describe("removeLightBackgroundFromPixels", () => {
    it("turns white and near-white pixels transparent while preserving dark and blue pen ink", () => {
      // 4 pixels: pure white, light off-white, black ink, blue pen ink
      const pixels = new Uint8ClampedArray([
        255, 255, 255, 255, // white background
        240, 240, 238, 255, // light paper background
        20, 20, 25, 255,    // black ink
        20, 60, 190, 255,   // blue ink
      ]);

      removeLightBackgroundFromPixels(pixels);

      expect(pixels[3]).toBe(0); // white -> transparent
      expect(pixels[7]).toBe(0); // light paper -> transparent
      expect(pixels[11]).toBe(255); // black ink -> fully opaque
      expect(pixels[15]).toBe(255); // blue ink -> fully opaque
    });

    it("applies smooth anti-aliased alpha transition on mid-light neutral edge pixels", () => {
      const pixels = new Uint8ClampedArray([
        210, 210, 210, 255, // mid-light gray edge
      ]);

      removeLightBackgroundFromPixels(pixels);

      expect(pixels[3]).toBeGreaterThan(0);
      expect(pixels[3]).toBeLessThan(255);
    });
  });

  describe("findOpaqueBounds", () => {
    it("detects bounding box of visible ink pixels", () => {
      // 4x3 image with visible pixels at (1,1) and (2,2)
      const width = 4;
      const height = 3;
      const data = new Uint8ClampedArray(width * height * 4);
      data[(1 * width + 1) * 4 + 3] = 255;
      data[(2 * width + 2) * 4 + 3] = 200;

      expect(findOpaqueBounds(data, width, height)).toEqual({
        minX: 1,
        minY: 1,
        maxX: 2,
        maxY: 2,
      });
    });

    it("returns null when all pixels are transparent", () => {
      const data = new Uint8ClampedArray(4 * 4 * 4);
      expect(findOpaqueBounds(data, 4, 4)).toBeNull();
    });
  });
});
