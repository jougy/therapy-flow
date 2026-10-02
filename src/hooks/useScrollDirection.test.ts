import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScrollDirection } from "@/hooks/useScrollDirection";

describe("useScrollDirection Hook", () => {
  beforeEach(() => {
    // Reset window scroll
    window.pageYOffset = 0;
    (document.documentElement as any).scrollTop = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with nearTop true and scrollDirection null at top of page", () => {
    const { result } = renderHook(() => useScrollDirection({ topOffset: 100 }));

    expect(result.current.isNearTop).toBe(true);
    expect(result.current.scrollDirection).toBe(null);
    expect(result.current.scrollY).toBe(0);
  });

  it("detects downward scrolling and updates scrollDirection to 'down'", () => {
    const { result } = renderHook(() => useScrollDirection({ threshold: 10, topOffset: 100 }));

    // Simular scroll para baixo além do topOffset
    act(() => {
      window.pageYOffset = 250;
      window.dispatchEvent(new Event("scroll"));
      vi.runAllTimers();
    });

    expect(result.current.isNearTop).toBe(false);
    expect(result.current.scrollDirection).toBe("down");
    expect(result.current.scrollY).toBe(250);
  });

  it("detects upward scrolling and updates scrollDirection to 'up'", () => {
    const { result } = renderHook(() => useScrollDirection({ threshold: 10, topOffset: 100 }));

    // Primeiro scroll para baixo
    act(() => {
      window.pageYOffset = 500;
      window.dispatchEvent(new Event("scroll"));
      vi.runAllTimers();
    });

    expect(result.current.scrollDirection).toBe("down");

    // Agora scroll para cima
    act(() => {
      window.pageYOffset = 420;
      window.dispatchEvent(new Event("scroll"));
      vi.runAllTimers();
    });

    expect(result.current.isNearTop).toBe(false);
    expect(result.current.scrollDirection).toBe("up");
    expect(result.current.scrollY).toBe(420);
  });

  it("marks isNearTop true when scrolling back close to top", () => {
    const { result } = renderHook(() => useScrollDirection({ threshold: 10, topOffset: 100 }));

    act(() => {
      window.pageYOffset = 500;
      window.dispatchEvent(new Event("scroll"));
      vi.runAllTimers();
    });

    expect(result.current.isNearTop).toBe(false);

    act(() => {
      window.pageYOffset = 50;
      window.dispatchEvent(new Event("scroll"));
      vi.runAllTimers();
    });

    expect(result.current.isNearTop).toBe(true);
  });
});
