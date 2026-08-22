import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useFeedbackTrigger,
  notifySessionCompletedFeedback,
  triggerFeedbackPrompt,
  STORAGE_KEYS,
} from "./useFeedbackTrigger";
import { useAuth } from "@/hooks/useAuth";

// In-memory mock for localStorage and sessionStorage
const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(window, "sessionStorage", {
  value: sessionStorageMock,
  writable: true,
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

describe("useFeedbackTrigger Hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorageMock.clear();
    sessionStorageMock.clear();
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-123", email: "dr@clinica.com" } as any,
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with closed modal and default trigger source", () => {
    const { result } = renderHook(() => useFeedbackTrigger());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.triggerSource).toBe("manual");
  });

  it("opens modal immediately and sets source when openManualFeedback is called", () => {
    const { result } = renderHook(() => useFeedbackTrigger());

    act(() => {
      result.current.openManualFeedback();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.triggerSource).toBe("manual");
  });

  it("triggers automatic feedback when not in cooldown", () => {
    const { result } = renderHook(() => useFeedbackTrigger());

    act(() => {
      const triggered = result.current.triggerAutomaticFeedback("session_completed");
      expect(triggered).toBe(true);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.triggerSource).toBe("session_completed");
  });

  it("blocks automatic feedback if user submitted recently (in cooldown)", () => {
    // Registra envio há 10 minutos (cooldown é 24h)
    localStorageMock.setItem(STORAGE_KEYS.LAST_SUBMITTED, String(Date.now() - 10 * 60 * 1000));

    const { result } = renderHook(() => useFeedbackTrigger());

    act(() => {
      const triggered = result.current.triggerAutomaticFeedback("session_completed");
      expect(triggered).toBe(false);
    });

    expect(result.current.isOpen).toBe(false);
  });

  it("blocks automatic feedback if user dismissed recently (in cooldown)", () => {
    // Registra dispensa há 5 minutos (cooldown de dispensa é 45m)
    localStorageMock.setItem(STORAGE_KEYS.LAST_DISMISSED, String(Date.now() - 5 * 60 * 1000));

    const { result } = renderHook(() => useFeedbackTrigger());

    act(() => {
      const triggered = result.current.triggerAutomaticFeedback("session_completed");
      expect(triggered).toBe(false);
    });

    expect(result.current.isOpen).toBe(false);
  });

  it("responds to window 'pluri:trigger-feedback' event", () => {
    const { result } = renderHook(() => useFeedbackTrigger());

    act(() => {
      notifySessionCompletedFeedback(0);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.triggerSource).toBe("session_completed");
  });

  it("supports delayed trigger in window event", () => {
    const { result } = renderHook(() => useFeedbackTrigger());

    act(() => {
      notifySessionCompletedFeedback(1500);
    });

    // Antes do timer de 1500ms
    expect(result.current.isOpen).toBe(false);

    // Avança o timer
    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.triggerSource).toBe("session_completed");
  });

  it("records dismissal timestamp when closing the modal", () => {
    const { result } = renderHook(() => useFeedbackTrigger());

    act(() => {
      result.current.openManualFeedback();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.setIsOpen(false);
    });

    expect(result.current.isOpen).toBe(false);
    expect(localStorageMock.getItem(STORAGE_KEYS.LAST_DISMISSED)).toBeTruthy();
  });

  it("triggers automatic feedback when connected time threshold is reached", () => {
    // Simula início de sessão no momento atual
    sessionStorageMock.setItem(STORAGE_KEYS.SESSION_START, String(Date.now()));

    const { result } = renderHook(() =>
      useFeedbackTrigger({
        initialTimeThresholdMs: 15 * 60 * 1000,
      })
    );

    expect(result.current.isOpen).toBe(false);

    // Avança o relógio em 15 minutos e 1 segundo
    act(() => {
      vi.advanceTimersByTime(15 * 60 * 1000 + 1000);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.triggerSource).toBe("time_connected");
  });
});
