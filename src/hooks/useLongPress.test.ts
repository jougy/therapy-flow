import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLongPress } from "./useLongPress";

describe("useLongPress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("triggers onLongPress after threshold has elapsed", () => {
    const onLongPress = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ onLongPress, onClick, threshold: 500 }),
    );

    act(() => {
      result.current.handlers.onPointerDown({
        clientX: 100,
        clientY: 100,
        button: 0,
      } as any);
    });

    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(result.current.hasLongPressed()).toBe(true);

    // Clicking right after long press should be consumed
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    act(() => {
      result.current.handlers.onClick({
        preventDefault,
        stopPropagation,
      } as any);
    });

    expect(onClick).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
  });

  it("cancels long-press if movement exceeds moveThreshold (e.g. scroll)", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ onLongPress, threshold: 500, moveThreshold: 10 }),
    );

    act(() => {
      result.current.handlers.onPointerDown({
        clientX: 100,
        clientY: 100,
        button: 0,
      } as any);
    });

    // Move pointer by 15px (scroll gesture)
    act(() => {
      result.current.handlers.onPointerMove({
        clientX: 100,
        clientY: 115,
      } as any);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("triggers onLongPress immediately on context menu event (right click)", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    const preventDefault = vi.fn();
    act(() => {
      result.current.handlers.onContextMenu({
        preventDefault,
      } as any);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(result.current.hasLongPressed()).toBe(true);
  });

  it("calls regular onClick when pointer is released before threshold", () => {
    const onLongPress = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() =>
      useLongPress({ onLongPress, onClick, threshold: 500 }),
    );

    act(() => {
      result.current.handlers.onPointerDown({
        clientX: 100,
        clientY: 100,
        button: 0,
      } as any);
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      result.current.handlers.onPointerUp();
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      result.current.handlers.onClick({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any);
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
