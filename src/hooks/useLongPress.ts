import { useCallback, useRef } from "react";

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  threshold?: number;
  moveThreshold?: number;
  vibrate?: boolean | number;
  disabled?: boolean;
}

export function useLongPress({
  onLongPress,
  onClick,
  threshold = 500,
  moveThreshold = 10,
  vibrate = 50,
  disabled = false,
}: UseLongPressOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressOccurredRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      // Only handle primary pointer (left click or touch)
      if (e.button !== undefined && e.button !== 0) return;

      cancel();
      longPressOccurredRef.current = false;
      startPosRef.current = { x: e.clientX, y: e.clientY };

      timerRef.current = setTimeout(() => {
        longPressOccurredRef.current = true;
        if (vibrate && typeof window !== "undefined" && window.navigator?.vibrate) {
          try {
            window.navigator.vibrate(typeof vibrate === "number" ? vibrate : 50);
          } catch {
            // Ignore vibration errors if blocked by browser
          }
        }
        onLongPress();
      }, threshold);
    },
    [disabled, cancel, vibrate, onLongPress, threshold],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startPosRef.current) return;
      const dx = Math.abs(e.clientX - startPosRef.current.x);
      const dy = Math.abs(e.clientY - startPosRef.current.y);
      if (dx > moveThreshold || dy > moveThreshold) {
        cancel();
      }
    },
    [moveThreshold, cancel],
  );

  const onPointerUp = useCallback(() => {
    cancel();
  }, [cancel]);

  const onPointerCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  const onPointerLeave = useCallback(() => {
    cancel();
  }, [cancel]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      cancel();
      longPressOccurredRef.current = true;
      onLongPress();
    },
    [disabled, cancel, onLongPress],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (longPressOccurredRef.current) {
        e.preventDefault();
        e.stopPropagation();
        longPressOccurredRef.current = false;
        return;
      }
      onClick?.();
    },
    [onClick],
  );

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      onContextMenu,
      onClick: handleClick,
    },
    cancel,
    hasLongPressed: () => longPressOccurredRef.current,
  };
}
