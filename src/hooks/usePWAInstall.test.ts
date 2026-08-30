import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePWAInstall, detectUserOS, isRunningInApp } from "./usePWAInstall";

describe("detectUserOS", () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
    });
  });

  it("identifica Windows corretamente", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", platform: "Win32" },
      writable: true,
    });
    expect(detectUserOS()).toBe("windows");
  });

  it("identifica macOS corretamente", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel" },
      writable: true,
    });
    expect(detectUserOS()).toBe("mac");
  });

  it("identifica Linux corretamente", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)", platform: "Linux x86_64" },
      writable: true,
    });
    expect(detectUserOS()).toBe("linux");
  });

  it("identifica Android corretamente", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7)", platform: "Linux armv8l" },
      writable: true,
    });
    expect(detectUserOS()).toBe("android");
  });

  it("identifica iOS corretamente", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)", platform: "iPhone" },
      writable: true,
    });
    expect(detectUserOS()).toBe("ios");
  });
});

describe("isRunningInApp", () => {
  it("detecta modo standalone via matchMedia", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(isRunningInApp()).toBe(true);
  });
});

describe("usePWAInstall hook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("inicia com estado padrão e detecta evento beforeinstallprompt", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => usePWAInstall());

    expect(result.current.isInstalled).toBe(false);
    expect(result.current.isApp).toBe(false);
    expect(result.current.isInstallable).toBe(false);

    // Simula disparo do evento beforeinstallprompt
    const mockEvent = new Event("beforeinstallprompt") as any;
    mockEvent.prompt = vi.fn().mockResolvedValue(undefined);
    mockEvent.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });

    act(() => {
      window.dispatchEvent(mockEvent);
    });

    expect(result.current.isInstallable).toBe(true);
  });
});
