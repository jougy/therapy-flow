import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAntiPrintProtection } from "@/hooks/useAntiPrintProtection";

const trackEventMock = vi.fn();
const mockLocation = { pathname: "/pacientes/PAC-001" };

vi.mock("react-router-dom", () => ({
  useLocation: () => mockLocation,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ clinicId: "clinic-1" }),
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ trackEvent: trackEventMock }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          or: () => ({
            order: () => ({
              limit: vi.fn().mockResolvedValue({
                data: [{ value: true }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
  },
}));

describe("useAntiPrintProtection Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.pathname = "/pacientes/PAC-001";
  });

  it("does NOT blur when document visibility changes (removes false positive)", async () => {
    const { result } = renderHook(() => useAntiPrintProtection());

    // Simula troca de aba (document.hidden = true depois false)
    act(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    act(() => {
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.isBlurred).toBe(false);
  });

  it("detects PrintScreen keydown event on protected route", async () => {
    const { result } = renderHook(() => useAntiPrintProtection());

    // Aguarda carregar configuração
    await act(async () => {
      await result.current.refetchConfig();
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "PrintScreen", code: "PrintScreen" }));
    });

    expect(result.current.isBlurred).toBe(true);

    // Permite unblur manual
    act(() => {
      result.current.unblur();
    });
    expect(result.current.isBlurred).toBe(false);
  });
});
