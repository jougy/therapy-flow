import React, { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { checkPlatformFlagFromAuth, NAV_ID_TO_PLATFORM_FLAG } from "@/lib/platform-feature-flags";
import {
  Award,
  UsersRound,
  CalendarDays,
  BookOpen,
  MessageSquareHeart,
  Sparkles,
  Tags,
  SlidersHorizontal,
  ShieldAlert,
  CreditCard,
  Bug,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface BackofficeDockTabItem {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

export const BACKOFFICE_DOCK_TABS: BackofficeDockTabItem[] = [
  {
    id: "directory",
    label: "Diretório Mestre",
    shortLabel: "Diretório",
    icon: UsersRound,
  },
  {
    id: "affiliates",
    label: "Marketing & Leads",
    shortLabel: "Marketing",
    icon: Award,
  },
  {
    id: "agenda",
    label: "Agenda de Reuniões",
    shortLabel: "Agenda",
    icon: CalendarDays,
  },
  {
    id: "forms-library",
    label: "Biblioteca de Formulários",
    shortLabel: "Formulários",
    icon: BookOpen,
  },
  {
    id: "feedbacks",
    label: "Feedbacks & Avaliações",
    shortLabel: "Feedbacks",
    icon: MessageSquareHeart,
  },
  {
    id: "news",
    label: "Notas de Novidades",
    shortLabel: "Novidades",
    icon: Sparkles,
  },
  {
    id: "tags",
    label: "Gestão de Tags",
    shortLabel: "Tags",
    icon: Tags,
  },
  {
    id: "flags",
    label: "Feature Flags",
    shortLabel: "Flags",
    icon: SlidersHorizontal,
  },
  {
    id: "governance",
    label: "Governança & Segurança",
    shortLabel: "Governança",
    icon: ShieldAlert,
  },
  {
    id: "billing",
    label: "Faturamento & Webhooks",
    shortLabel: "Faturamento",
    icon: CreditCard,
  },
  {
    id: "errors",
    label: "Erros & Logs",
    shortLabel: "Erros",
    icon: Bug,
  },
];

interface PlatformMobileDockProps {
  activeTab: string;
  onChange: (tabId: string) => void;
  tabs?: BackofficeDockTabItem[];
  className?: string;
}

export const PlatformMobileDock = memo(function PlatformMobileDock({
  activeTab,
  onChange,
  tabs: customTabs,
  className,
}: PlatformMobileDockProps) {
  const auth = useAuth();
  const tabs = useMemo(() => {
    if (customTabs) return customTabs;
    return BACKOFFICE_DOCK_TABS.filter((tab) => {
      const flag = NAV_ID_TO_PLATFORM_FLAG[tab.id];
      return !flag || checkPlatformFlagFromAuth(auth, flag);
    });
  }, [auth, customTabs]);
  const [mobileDockExpanded, setMobileDockExpanded] = useState(false);
  const [mobileDockPressedTab, setMobileDockPressedTab] = useState<string | null>(null);
  const [mobileDockPointerActive, setMobileDockPointerActive] = useState(false);
  const [mobileDockTooltip, setMobileDockTooltip] = useState<{ title: string; x: number } | null>(null);

  const mobileLongPressTimerRef = useRef<number | null>(null);
  const mobileLongPressTriggeredRef = useRef(false);
  const mobileDockScrollResetTimerRef = useRef<number | null>(null);
  const mobileDockAutoScrollFrameRef = useRef<number | null>(null);
  const mobileDockGestureRef = useRef<{
    tab: string;
    button: HTMLButtonElement;
    clientX: number;
    clientY: number;
    pointerId: number;
    title: string;
  } | null>(null);

  const clearMobileLongPress = useCallback(() => {
    if (mobileLongPressTimerRef.current !== null) {
      window.clearTimeout(mobileLongPressTimerRef.current);
      mobileLongPressTimerRef.current = null;
    }
  }, []);

  const stopMobileDockAutoScroll = useCallback(() => {
    if (mobileDockAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(mobileDockAutoScrollFrameRef.current);
      mobileDockAutoScrollFrameRef.current = null;
    }
  }, []);

  const updateMobileDockTooltipForButton = useCallback((button: HTMLButtonElement, title: string) => {
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || rect.right;
    const safeInset = 68;
    const x = Math.min(Math.max(rect.left + rect.width / 2, safeInset), Math.max(safeInset, viewportWidth - safeInset));
    setMobileDockTooltip({ title, x });
  }, []);

  const beginMobileDockSelection = useCallback(() => {
    const gesture = mobileDockGestureRef.current;
    if (!gesture) return;

    mobileLongPressTriggeredRef.current = true;
    setMobileDockPointerActive(true);
    setMobileDockExpanded(true);
    setMobileDockPressedTab(gesture.tab);
    updateMobileDockTooltipForButton(gesture.button, gesture.title);
  }, [updateMobileDockTooltipForButton]);

  const startMobileDockGesture = useCallback(
    (button: HTMLButtonElement, tab: string, title: string, clientX: number, clientY: number, pointerId = -1) => {
      mobileLongPressTriggeredRef.current = false;
      clearMobileLongPress();
      mobileDockGestureRef.current = {
        tab,
        button,
        clientX,
        clientY,
        pointerId,
        title,
      };
      mobileLongPressTimerRef.current = window.setTimeout(() => {
        beginMobileDockSelection();
      }, 180);
    },
    [beginMobileDockSelection, clearMobileLongPress]
  );

  const updateMobileDockPressedTabFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const target = document.elementFromPoint(clientX, clientY);
      const button = target?.closest<HTMLButtonElement>("[data-platform-mobile-dock-tab]");
      const tab = button?.dataset.platformMobileDockTab;
      const title = button?.dataset.platformMobileDockTitle;

      if (tab && title && button) {
        setMobileDockPressedTab(tab);
        updateMobileDockTooltipForButton(button, title);
      }
    },
    [updateMobileDockTooltipForButton]
  );

  const updateMobileDockAutoScroll = useCallback(
    (clientX: number, clientY: number) => {
      stopMobileDockAutoScroll();

      const dock = document.querySelector<HTMLElement>(".platform-mobile-dock");
      if (!dock) return;

      const rect = dock.getBoundingClientRect();
      const edgeThreshold = 34;
      let delta = 0;

      if (clientX < rect.left + edgeThreshold) {
        delta = -Math.max(2, Math.round((rect.left + edgeThreshold - clientX) * 0.22));
      } else if (clientX > rect.right - edgeThreshold) {
        delta = Math.max(2, Math.round((clientX - (rect.right - edgeThreshold)) * 0.22));
      }

      if (delta === 0) return;

      const step = () => {
        dock.scrollLeft += delta;
        updateMobileDockPressedTabFromPoint(clientX, clientY);
        mobileDockAutoScrollFrameRef.current = window.requestAnimationFrame(step);
      };

      mobileDockAutoScrollFrameRef.current = window.requestAnimationFrame(step);
    },
    [stopMobileDockAutoScroll, updateMobileDockPressedTabFromPoint]
  );

  const moveMobileDockGesture = useCallback(
    (clientX: number, clientY: number) => {
      if (mobileDockPointerActive) {
        updateMobileDockPressedTabFromPoint(clientX, clientY);
        updateMobileDockAutoScroll(clientX, clientY);
        return true;
      }

      const gesture = mobileDockGestureRef.current;
      if (!gesture) return false;

      if (Math.hypot(clientX - gesture.clientX, clientY - gesture.clientY) > 8) {
        clearMobileLongPress();
        mobileDockGestureRef.current = null;
      }

      return false;
    },
    [clearMobileLongPress, mobileDockPointerActive, updateMobileDockAutoScroll, updateMobileDockPressedTabFromPoint]
  );

  const finishMobileDockInteraction = useCallback(() => {
    clearMobileLongPress();
    mobileDockGestureRef.current = null;
    if (mobileDockPointerActive && mobileDockPressedTab) {
      onChange(mobileDockPressedTab);
    }
    stopMobileDockAutoScroll();

    setMobileDockPointerActive(false);
    setMobileDockExpanded(true);
    setMobileDockPressedTab(null);
    setMobileDockTooltip(null);
  }, [clearMobileLongPress, mobileDockPointerActive, mobileDockPressedTab, onChange, stopMobileDockAutoScroll]);

  const handleMobileDockClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, tabId: string) => {
      if (mobileLongPressTriggeredRef.current) {
        mobileLongPressTriggeredRef.current = false;
        event.preventDefault();
        return;
      }

      setMobileDockExpanded(true);
      onChange(tabId);
    },
    [onChange]
  );

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;
      if (Math.abs(currentY - lastScrollY) > 6) {
        setMobileDockExpanded(false);
        setMobileDockPressedTab(null);
        setMobileDockPointerActive(false);
        setMobileDockTooltip(null);
        stopMobileDockAutoScroll();
      }
      lastScrollY = currentY;

      if (mobileDockScrollResetTimerRef.current !== null) {
        window.clearTimeout(mobileDockScrollResetTimerRef.current);
      }
      mobileDockScrollResetTimerRef.current = window.setTimeout(() => {
        lastScrollY = window.scrollY;
      }, 180);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (mobileDockScrollResetTimerRef.current !== null) {
        window.clearTimeout(mobileDockScrollResetTimerRef.current);
      }
    };
  }, [stopMobileDockAutoScroll]);

  useEffect(() => {
    return () => {
      clearMobileLongPress();
      stopMobileDockAutoScroll();
    };
  }, [clearMobileLongPress, stopMobileDockAutoScroll]);

  return (
    <nav
      className={cn(
        "designlab-settings-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/94 backdrop-blur supports-[backdrop-filter]:bg-background/88 lg:hidden",
        className
      )}
      aria-label="Navegação do Backoffice"
      data-dock-state={mobileDockExpanded || mobileDockPointerActive ? "medium" : "compact"}
      data-dock-pressing={mobileDockPointerActive ? "true" : "false"}
    >
      <div className="relative mx-auto max-w-screen-sm px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
        {mobileDockTooltip && (
          <span
            className="designlab-settings-mobile-floating-tooltip"
            style={{ "--mobile-dock-tooltip-x": `${mobileDockTooltip.x}px` } as CSSProperties}
          >
            {mobileDockTooltip.title}
          </span>
        )}
        <div
          className="platform-mobile-dock designlab-settings-mobile-dock flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onPointerMove={(event) => {
            if (moveMobileDockGesture(event.clientX, event.clientY)) {
              event.preventDefault();
            }
          }}
          onTouchMove={(event) => {
            const touch = event.touches[0];
            if (touch && moveMobileDockGesture(touch.clientX, touch.clientY)) {
              event.preventDefault();
            }
          }}
          onPointerUp={finishMobileDockInteraction}
          onPointerCancel={finishMobileDockInteraction}
          onTouchEnd={finishMobileDockInteraction}
          onTouchCancel={finishMobileDockInteraction}
          onPointerLeave={() => {
            if (mobileDockPointerActive) {
              finishMobileDockInteraction();
            }
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isPressed = mobileDockPressedTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                aria-label={tab.label}
                aria-pressed={isActive}
                data-platform-mobile-dock-tab={tab.id}
                data-platform-mobile-dock-title={tab.label}
                className={cn(
                  "designlab-settings-mobile-item group relative flex shrink-0 flex-col items-center justify-center rounded-xl p-[1px] text-center transition-[filter,transform] duration-150 ease-out active:translate-y-0.5",
                  isActive && "is-active",
                  isPressed && "is-pressed"
                )}
                onPointerDown={(event) => {
                  startMobileDockGesture(event.currentTarget, tab.id, tab.label, event.clientX, event.clientY, event.pointerId);
                }}
                onTouchStart={(event) => {
                  const touch = event.touches[0];
                  if (touch) {
                    startMobileDockGesture(event.currentTarget, tab.id, tab.label, touch.clientX, touch.clientY);
                  }
                }}
                onClick={(event) => handleMobileDockClick(event, tab.id)}
              >
                <span
                  className={cn(
                    "designlab-settings-mobile-surface flex h-full w-full flex-col items-center justify-center rounded-[0.68rem] border px-2 py-2 transition-colors duration-300",
                    isActive
                      ? "border-primary/45 bg-primary/10 text-primary"
                      : "border-border/80 bg-card/92 text-muted-foreground"
                  )}
                >
                  <Icon className="designlab-settings-mobile-icon h-4 w-4 shrink-0" />
                  <span className="designlab-settings-mobile-label mt-1 text-[10px] font-medium leading-tight">
                    {tab.shortLabel}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
});
