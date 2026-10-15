import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isChunkLoadError, reloadForNewVersion, registerChunkReloadHandler } from "./chunk-reload";

describe("chunk-reload", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe("isChunkLoadError", () => {
    it("detects dynamic import errors correctly", () => {
      expect(isChunkLoadError(new Error("error loading dynamically imported module: https://app.plurifisio.com.br/assets/PacienteDetalhe.js"))).toBe(true);
      expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module"))).toBe(true);
      expect(isChunkLoadError("importing a module script failed")).toBe(true);
      expect(isChunkLoadError("Loading chunk 42 failed")).toBe(true);
      expect(isChunkLoadError("Unable to preload CSS for /assets/index.css")).toBe(true);
    });

    it("returns false for regular application errors", () => {
      expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
      expect(isChunkLoadError(new Error("Network request failed"))).toBe(false);
      expect(isChunkLoadError(null)).toBe(false);
      expect(isChunkLoadError(undefined)).toBe(false);
    });
  });

  describe("reloadForNewVersion", () => {
    it("triggers reload and stores timestamp in sessionStorage", () => {
      const reloadMock = vi.fn();
      // Mock window.location.reload
      Object.defineProperty(window, "location", {
        writable: true,
        value: { ...window.location, reload: reloadMock },
      });

      const reloaded = reloadForNewVersion();
      expect(reloaded).toBe(true);
      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem("pluri_chunk_reload_timestamp")).toBeTruthy();
    });

    it("prevents infinite reload loops when called repeatedly within cooldown window", () => {
      const reloadMock = vi.fn();
      Object.defineProperty(window, "location", {
        writable: true,
        value: { ...window.location, reload: reloadMock },
      });

      // First reload succeeds
      const first = reloadForNewVersion();
      expect(first).toBe(true);
      expect(reloadMock).toHaveBeenCalledTimes(1);

      // Second immediate reload is blocked by cooldown
      const second = reloadForNewVersion();
      expect(second).toBe(false);
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("registerChunkReloadHandler", () => {
    it("listens to vite:preloadError and triggers reload", () => {
      const reloadMock = vi.fn();
      Object.defineProperty(window, "location", {
        writable: true,
        value: { ...window.location, reload: reloadMock },
      });

      registerChunkReloadHandler();

      const event = new Event("vite:preloadError", { cancelable: true });
      window.dispatchEvent(event);

      expect(reloadMock).toHaveBeenCalledTimes(1);
    });
  });
});
