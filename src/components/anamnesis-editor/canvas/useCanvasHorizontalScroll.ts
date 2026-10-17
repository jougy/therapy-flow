import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { DesignLabTemplateLayoutItem } from "../types";

export function useCanvasHorizontalScroll(groupedLayout: DesignLabTemplateLayoutItem[]) {
  const editorCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const horizontalScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const horizontalScrollRaf = useRef<number | null>(null);
  const horizontalDragRef = useRef<{
    key: string | null;
    pointerId: number | null;
    trackLeft: number;
    trackWidth: number;
  } | null>(null);
  const [horizontalScrollState, setHorizontalScrollState] = useState<
    Record<string, { clientWidth: number; scrollLeft: number; scrollWidth: number }>
  >({});
  const [canvasActiveSteps, setCanvasActiveSteps] = useState<Record<string, number>>({});

  const syncHorizontalScrollState = useCallback(() => {
    const nextState: Record<string, { clientWidth: number; scrollLeft: number; scrollWidth: number }> = {};

    Object.entries(horizontalScrollRefs.current).forEach(([key, node]) => {
      if (!node) return;

      nextState[key] = {
        clientWidth: node.clientWidth,
        scrollLeft: node.scrollLeft,
        scrollWidth: node.scrollWidth,
      };
    });

    setHorizontalScrollState(nextState);
  }, []);

  const scheduleHorizontalScrollSync = useCallback(() => {
    if (horizontalScrollRaf.current !== null) {
      window.cancelAnimationFrame(horizontalScrollRaf.current);
    }

    horizontalScrollRaf.current = window.requestAnimationFrame(syncHorizontalScrollState);
  }, [syncHorizontalScrollState]);

  useEffect(() => {
    scheduleHorizontalScrollSync();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => scheduleHorizontalScrollSync()) : null;
    Object.values(horizontalScrollRefs.current).forEach((node) => {
      if (node) {
        resizeObserver?.observe(node);
      }
    });

    window.addEventListener("resize", scheduleHorizontalScrollSync);

    return () => {
      if (horizontalScrollRaf.current !== null) {
        window.cancelAnimationFrame(horizontalScrollRaf.current);
        horizontalScrollRaf.current = null;
      }

      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleHorizontalScrollSync);
    };
  }, [groupedLayout, scheduleHorizontalScrollSync]);

  const scrollHorizontalSectionToRatio = useCallback(
    (key: string, ratio: number, behavior: ScrollBehavior = "auto") => {
      const node = horizontalScrollRefs.current[key];
      if (!node) return;

      const maxScrollLeft = Math.max(node.scrollWidth - node.clientWidth, 1);
      node.scrollTo({ left: Math.max(0, Math.min(1, ratio)) * maxScrollLeft, behavior });
    },
    []
  );

  const scrollHorizontalSectionToSibling = useCallback((key: string, direction: "left" | "right") => {
    const node = horizontalScrollRefs.current[key];
    const content = node?.firstElementChild;
    if (!node || !content) return;

    const cards = Array.from(content.children) as HTMLElement[];
    if (cards.length === 0) return;

    const currentLeft = node.scrollLeft;
    const tolerance = 8;

    if (direction === "right") {
      const nextCard = cards.find((card) => card.offsetLeft > currentLeft + tolerance);
      if (nextCard) {
        node.scrollTo({ left: nextCard.offsetLeft, behavior: "smooth" });
      }
      return;
    }

    const prevCard = [...cards].reverse().find((card) => card.offsetLeft < currentLeft - tolerance);
    if (prevCard) {
      node.scrollTo({ left: prevCard.offsetLeft, behavior: "smooth" });
    }
  }, []);

  const beginHorizontalDrag = useCallback(
    (key: string, event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const trackRect = event.currentTarget.getBoundingClientRect();
      horizontalDragRef.current = {
        key,
        pointerId: event.pointerId,
        trackLeft: trackRect.left,
        trackWidth: Math.max(trackRect.width, 1),
      };

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (err) {
        console.debug("Pointer capture failed:", err);
      }

      const ratio = (event.clientX - trackRect.left) / Math.max(trackRect.width, 1);
      scrollHorizontalSectionToRatio(key, ratio, "auto");
    },
    [scrollHorizontalSectionToRatio]
  );

  const updateHorizontalDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = horizontalDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId || !drag.key) return;

      const ratio = (event.clientX - drag.trackLeft) / drag.trackWidth;
      scrollHorizontalSectionToRatio(drag.key, ratio, "auto");
    },
    [scrollHorizontalSectionToRatio]
  );

  const endHorizontalDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = horizontalDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch (err) {
      console.debug("Release pointer capture failed:", err);
    }

    horizontalDragRef.current = null;
  }, []);

  return {
    editorCardRefs,
    horizontalScrollRefs,
    horizontalScrollState,
    canvasActiveSteps,
    setCanvasActiveSteps,
    syncHorizontalScrollState,
    scheduleHorizontalScrollSync,
    scrollHorizontalSectionToRatio,
    scrollHorizontalSectionToSibling,
    beginHorizontalDrag,
    updateHorizontalDrag,
    endHorizontalDrag,
  };
}
