import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTutorial } from "@/contexts/TutorialContext";
import { TutorialCard } from "./TutorialCard";
import { TutorialChapterModal } from "./TutorialChapterModal";
import { MousePointerClick } from "lucide-react";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export const TutorialOverlay = () => {
  const { isOpen, isPaused, currentStep, currentStepIndex, handleTargetClick } = useTutorial();
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [cardPosition, setCardPosition] = useState<React.CSSProperties>({});
  const activeElementRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Update target rect & calculate card position with strict boundary collision avoidance
  const updateRect = useCallback(() => {
    if (!isOpen || isPaused || !currentStep?.targetSelector) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (el) {
      const rect = el.getBoundingClientRect();
      const padding = currentStep.highlightPadding ?? 8;
      const computedRect: TargetRect = {
        top: Math.max(0, rect.top - padding),
        left: Math.max(0, rect.left - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        bottom: rect.bottom + padding,
        right: rect.right + padding,
      };
      setTargetRect(computedRect);

      // Apply focus animation class to target element
      if (activeElementRef.current && activeElementRef.current !== el) {
        activeElementRef.current.classList.remove(
          "tutorial-dancing-target",
          "tutorial-bouncing-target",
          "tutorial-pulsing-target"
        );
      }

      activeElementRef.current = el;
      const animationType = currentStep.animation || "dance";
      if (animationType === "dance") {
        el.classList.add("tutorial-dancing-target");
      } else if (animationType === "bounce") {
        el.classList.add("tutorial-bouncing-target");
      } else if (animationType === "pulse" || animationType === "glow") {
        el.classList.add("tutorial-pulsing-target");
      }

      // Viewport dimensions & Safety margins (min 16px desktop, 12px mobile)
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = viewportWidth < 640 ? 12 : 16;

      // Real measured card dimensions (with safe fallbacks)
      const cardEl = cardRef.current;
      const cardRect = cardEl?.getBoundingClientRect();
      const measuredWidth = cardRect?.width && cardRect.width > 50 ? cardRect.width : 420;
      const measuredHeight = cardRect?.height && cardRect.height > 50 ? cardRect.height : 420;

      const cardWidth = Math.min(measuredWidth, viewportWidth - margin * 2);
      const cardHeight = Math.min(measuredHeight, viewportHeight - margin * 2);

      const availableAbove = computedRect.top - margin;
      const availableBelow = viewportHeight - computedRect.bottom - margin;
      const availableLeft = computedRect.left - margin;
      const availableRight = viewportWidth - computedRect.right - margin;

      const preferredPlacement = currentStep.placement || "bottom";
      let finalPlacement = preferredPlacement;

      // Smart flip & Non-occlusion guard:
      // If preferred placement lacks space for the full card without overlapping the target, pick the opposite side
      if (preferredPlacement === "bottom") {
        if (availableBelow < cardHeight && availableAbove > availableBelow) {
          finalPlacement = "top";
        }
      } else if (preferredPlacement === "top") {
        if (availableAbove < cardHeight && availableBelow > availableAbove) {
          finalPlacement = "bottom";
        }
      } else if (preferredPlacement === "right") {
        if (availableRight < cardWidth && availableLeft > availableRight) {
          finalPlacement = "left";
        }
      } else if (preferredPlacement === "left") {
        if (availableLeft < cardWidth && availableRight > availableLeft) {
          finalPlacement = "right";
        }
      }

      let top = 0;
      let left = 0;

      if (finalPlacement === "bottom") {
        top = computedRect.bottom + margin;
        // Never pull top upwards into the target: if it touches target, ensure it stays below
        if (top + cardHeight > viewportHeight - margin && availableAbove >= cardHeight) {
          // Flip to top if it would overflow bottom and top fits cleanly
          top = computedRect.top - cardHeight - margin;
        } else {
          top = Math.max(computedRect.bottom + margin, Math.min(top, viewportHeight - cardHeight - margin));
        }
        left = computedRect.left + (computedRect.width - cardWidth) / 2;
      } else if (finalPlacement === "top") {
        top = computedRect.top - cardHeight - margin;
        // Never push top downwards into the target
        if (top < margin && availableBelow >= cardHeight) {
          // Flip to bottom if top overflows and bottom fits cleanly
          top = computedRect.bottom + margin;
        } else {
          top = Math.max(margin, Math.min(top, computedRect.top - cardHeight - margin));
        }
        left = computedRect.left + (computedRect.width - cardWidth) / 2;
      } else if (finalPlacement === "right") {
        left = computedRect.right + margin;
        top = Math.max(margin, Math.min(computedRect.top + (computedRect.height - cardHeight) / 2, viewportHeight - cardHeight - margin));
      } else if (finalPlacement === "left") {
        left = computedRect.left - cardWidth - margin;
        top = Math.max(margin, Math.min(computedRect.top + (computedRect.height - cardHeight) / 2, viewportHeight - cardHeight - margin));
      } else {
        // center fallback
        top = (viewportHeight - cardHeight) / 2;
        left = (viewportWidth - cardWidth) / 2;
      }

      // Strict Boundary Clamping: Never allow popup to touch or overflow viewport edges
      const maxTop = Math.max(margin, viewportHeight - cardHeight - margin);
      const maxLeft = Math.max(margin, viewportWidth - cardWidth - margin);

      top = Math.max(margin, Math.min(top, maxTop));
      left = Math.max(margin, Math.min(left, maxLeft));

      setCardPosition({
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
      });
    } else {
      setTargetRect(null);
      // Fallback: center card
      setCardPosition({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
    }
  }, [isOpen, isPaused, currentStep]);

  // Observe card element resizing dynamically (e.g. previews loading, text expanding)
  useEffect(() => {
    if (!cardRef.current || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      updateRect();
    });

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [updateRect, isOpen]);

  // Clean up animation classes on unmount or step change
  useEffect(() => {
    return () => {
      if (activeElementRef.current) {
        activeElementRef.current.classList.remove(
          "tutorial-dancing-target",
          "tutorial-bouncing-target",
          "tutorial-pulsing-target"
        );
      }
    };
  }, [currentStepIndex, isOpen]);

  // Scroll into view & update rect on step change with placement awareness
  useEffect(() => {
    if (!isOpen || !currentStep?.targetSelector) return;

    const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (el) {
      const placement = currentStep.placement || "bottom";
      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const cardHeightEst = 440;

      // Smart scroll based on desired card placement
      if (placement === "bottom") {
        const spaceBelow = viewportHeight - rect.bottom - 16;
        if (spaceBelow < cardHeightEst || rect.top < 60) {
          el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
        }
      } else if (placement === "top") {
        const spaceAbove = rect.top - 16;
        if (spaceAbove < cardHeightEst || rect.bottom > viewportHeight - 60) {
          el.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
        }
      } else {
        const isInViewport =
          rect.top >= 60 &&
          rect.bottom <= viewportHeight - 60 &&
          rect.left >= 20 &&
          rect.right <= viewportWidth - 20;

        if (!isInViewport) {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        }
      }
    }

    // Run multi-pass updates as animations/layout render and smooth scroll animates
    updateRect();
    const t1 = setTimeout(updateRect, 60);
    const t2 = setTimeout(updateRect, 180);
    const t3 = setTimeout(updateRect, 350);
    const t4 = setTimeout(updateRect, 550);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [isOpen, currentStepIndex, currentStep, updateRect]);

  // Listeners for window resize and scroll with capturing
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      requestAnimationFrame(updateRect);
    };

    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    window.addEventListener("scroll", handleScrollOrResize, { capture: true, passive: true });

    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isOpen, updateRect]);

  // Handle clicking on target element
  useEffect(() => {
    if (!isOpen || !currentStep?.targetSelector) return;
    const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (!el) return;

    const onClick = () => {
      // Small timeout to allow element's own action (e.g. open dialog, toggle) to trigger
      setTimeout(() => {
        handleTargetClick();
      }, 100);
    };

    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("click", onClick);
    };
  }, [isOpen, currentStep, handleTargetClick]);

  if (!isOpen || isPaused) {
    return <TutorialChapterModal />;
  }

  return createPortal(
    <>
      <TutorialChapterModal />
      <div className="fixed inset-0 z-[99990] pointer-events-none">
        {/* SVG Mask Spotlight Overlay */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-auto transition-all duration-300"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="tutorial-spotlight-mask">
              {/* White base = transparent to show background */}
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {/* Black cutout = hole in the dark overlay */}
              {targetRect && (
                <rect
                  x={targetRect.left}
                  y={targetRect.top}
                  width={targetRect.width}
                  height={targetRect.height}
                  rx={12}
                  ry={12}
                  fill="black"
                />
              )}
            </mask>
          </defs>

          {/* Semi-transparent dark overlay with mask cutout */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.75)"
            mask="url(#tutorial-spotlight-mask)"
          />
        </svg>

        {/* Target Spotlight Highlight Ring & Click Area */}
        {targetRect && (
          <div
            style={{
              position: "fixed",
              top: `${targetRect.top}px`,
              left: `${targetRect.left}px`,
              width: `${targetRect.width}px`,
              height: `${targetRect.height}px`,
              borderRadius: "14px",
            }}
            className="pointer-events-auto z-[99995] ring-4 ring-primary/80 ring-offset-2 ring-offset-transparent shadow-[0_0_32px_rgba(56,189,248,0.65)] transition-all duration-300 animate-pulse"
          >
            {/* Glowing Animated Outer Border */}
            <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-primary via-emerald-400 to-purple-500 opacity-80 blur-[4px] animate-pulse" />

            {/* Click Indicator Badge if interactive or requires action */}
            {(currentStep?.requiresAction || currentStep?.actionPrompt) && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-lg animate-bounce">
                <MousePointerClick className="h-3 w-3" />
                <span>Clique Aqui</span>
              </div>
            )}
          </div>
        )}

        {/* Floating Guided Card */}
        <div className="pointer-events-auto">
          <TutorialCard ref={cardRef} style={cardPosition} />
        </div>
      </div>
    </>,
    document.body
  );
};
