import { useState, useEffect, useRef } from "react";

interface ScrollDirectionOptions {
  threshold?: number;
  topOffset?: number;
}

interface ScrollDirectionState {
  scrollDirection: "up" | "down" | null;
  isNearTop: boolean;
  scrollY: number;
}

/**
 * Hook para detectar a direção de rolagem da página com amortecimento (threshold)
 * e verificação se o usuário está próximo do topo.
 * 
 * - Retorna 'up' quando rola para cima
 * - Retorna 'down' quando rola para baixo
 * - isNearTop é true quando scrollY <= topOffset
 */
export function useScrollDirection({
  threshold = 12,
  topOffset = 100,
}: ScrollDirectionOptions = {}): ScrollDirectionState {
  const [scrollDirection, setScrollDirection] = useState<"up" | "down" | null>(null);
  const [isNearTop, setIsNearTop] = useState(true);
  const [scrollY, setScrollY] = useState(0);

  const prevScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    // Initial check
    const currentY = window.pageYOffset || document.documentElement.scrollTop || 0;
    prevScrollY.current = currentY;
    setScrollY(currentY);
    setIsNearTop(currentY <= topOffset);

    const updateScrollDirection = () => {
      const latestY = window.pageYOffset || document.documentElement.scrollTop || 0;
      setScrollY(latestY);

      const nearTop = latestY <= topOffset;
      setIsNearTop(nearTop);

      const diff = latestY - prevScrollY.current;

      // Ignore micro scrolls within threshold
      if (Math.abs(diff) >= threshold) {
        if (latestY > prevScrollY.current && latestY > topOffset) {
          setScrollDirection("down");
        } else if (latestY < prevScrollY.current) {
          setScrollDirection("up");
        }
        prevScrollY.current = latestY;
      }

      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(updateScrollDirection);
        ticking.current = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [threshold, topOffset]);

  return { scrollDirection, isNearTop, scrollY };
}
