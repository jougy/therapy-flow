import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import {
  Home,
  FileText,
  CalendarDays,
  PlayCircle,
  History,
  FolderOpen,
  BarChart3,
  FileCheck2,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PatientMobileTab =
  | "inicio"
  | "resumo"
  | "agendar"
  | "atender"
  | "historico"
  | "arquivos"
  | "estatisticas"
  | "termos"
  | "status";

export interface PatientMobileDockItem {
  id: PatientMobileTab;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
  disabled?: boolean;
}

interface PatientMobileDockProps {
  activeTab: PatientMobileTab;
  onTabChange: (tab: PatientMobileTab) => void;
  showFiles?: boolean;
  showStats?: boolean;
}

export const PatientMobileDock = memo(function PatientMobileDock({
  activeTab,
  onTabChange,
  showFiles = true,
  showStats = true,
}: PatientMobileDockProps) {
  const [mobileDockExpanded, setMobileDockExpanded] = useState(false);
  const [mobileDockPressedTab, setMobileDockPressedTab] = useState<PatientMobileTab | null>(null);
  const [mobileDockPointerActive, setMobileDockPointerActive] = useState(false);
  const [mobileDockTooltip, setMobileDockTooltip] = useState<{ title: string; x: number } | null>(null);

  const mobileLongPressTimerRef = useRef<number | null>(null);
  const mobileLongPressTriggeredRef = useRef(false);
  const mobileDockScrollResetTimerRef = useRef<number | null>(null);
  const mobileDockAutoScrollFrameRef = useRef<number | null>(null);
  const mobileDockGestureRef = useRef<{
    tab: PatientMobileTab;
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
    (button: HTMLButtonElement, tab: PatientMobileTab, title: string, clientX: number, clientY: number, pointerId = -1) => {
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
      }, 240);
    },
    [beginMobileDockSelection, clearMobileLongPress]
  );

  const updateMobileDockPressedTabFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const element = document.elementFromPoint(clientX, clientY);
      const button = element?.closest<HTMLButtonElement>("[data-patient-mobile-dock-tab]");
      const tab = button?.dataset.patientMobileDockTab as PatientMobileTab | undefined;
      const title = button?.dataset.patientMobileDockTitle;

      if (tab && title) {
        setMobileDockPressedTab(tab);
        updateMobileDockTooltipForButton(button, title);
      }
    },
    [updateMobileDockTooltipForButton]
  );

  const updateMobileDockAutoScroll = useCallback(
    (clientX: number, clientY: number) => {
      stopMobileDockAutoScroll();

      const dock = document.querySelector<HTMLElement>(".patient-mobile-dock-container");
      if (!dock) return;

      const rect = dock.getBoundingClientRect();
      const edgeSize = Math.min(92, Math.max(48, rect.width * 0.2));
      const leftPressure = Math.max(0, edgeSize - (clientX - rect.left));
      const rightPressure = Math.max(0, edgeSize - (rect.right - clientX));
      const direction = rightPressure > 0 ? 1 : leftPressure > 0 ? -1 : 0;
      const pressure = direction > 0 ? rightPressure : leftPressure;

      if (!direction || pressure <= 0) return;

      const step = () => {
        dock.scrollLeft += direction * Math.min(18, 4 + pressure * 0.16);
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
      if (gesture && Math.hypot(clientX - gesture.clientX, clientY - gesture.clientY) > 10) {
        clearMobileLongPress();
        mobileDockGestureRef.current = null;
      }

      return false;
    },
    [clearMobileLongPress, mobileDockPointerActive, updateMobileDockAutoScroll, updateMobileDockPressedTabFromPoint]
  );

  const finishMobileDockInteraction = useCallback(() => {
    if (mobileDockPointerActive && mobileDockPressedTab) {
      onTabChange(mobileDockPressedTab);
    }
    clearMobileLongPress();
    stopMobileDockAutoScroll();
    mobileDockGestureRef.current = null;
    setMobileDockPointerActive(false);
    setMobileDockExpanded(true);
    setMobileDockPressedTab(null);
    setMobileDockTooltip(null);
  }, [clearMobileLongPress, mobileDockPointerActive, mobileDockPressedTab, onTabChange, stopMobileDockAutoScroll]);

  const handleMobileDockClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, tab: PatientMobileTab) => {
      if (mobileLongPressTriggeredRef.current) {
        event.preventDefault();
        return;
      }

      setMobileDockExpanded(true);
      onTabChange(tab);
    },
    [onTabChange]
  );

  useEffect(() => {
    const handleScroll = () => {
      if (mobileDockScrollResetTimerRef.current !== null) {
        window.clearTimeout(mobileDockScrollResetTimerRef.current);
      }

      mobileDockScrollResetTimerRef.current = window.setTimeout(() => {
        setMobileDockExpanded(false);
        setMobileDockPressedTab(null);
        setMobileDockPointerActive(false);
        setMobileDockTooltip(null);
        stopMobileDockAutoScroll();
        mobileDockScrollResetTimerRef.current = null;
      }, 80);
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

  const dockItems: PatientMobileDockItem[] = [
    { id: "inicio", label: "Início", icon: Home },
    { id: "resumo", label: "Resumo clínico", icon: FileText },
    { id: "agendar", label: "Agendar", icon: CalendarDays },
    { id: "atender", label: "Atender", icon: PlayCircle, primary: true },
    { id: "historico", label: "Histórico", icon: History },
    ...(showFiles ? [{ id: "arquivos" as const, label: "Arquivos", icon: FolderOpen }] : []),
    ...(showStats ? [{ id: "estatisticas" as const, label: "Estatísticas", icon: BarChart3 }] : []),
    { id: "termos", label: "Termos", icon: FileCheck2 },
    { id: "status", label: "Status", icon: Activity },
  ];

  return (
    <nav
      className="designlab-settings-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/94 backdrop-blur supports-[backdrop-filter]:bg-background/88 md:hidden"
      aria-label="Navegação da ficha do paciente"
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
          className="patient-mobile-dock-container designlab-settings-mobile-dock flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden is-scrollable"
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
          {dockItems.map((item) => {
            const isActive = activeTab === item.id;
            const isPressed = mobileDockPressedTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                data-patient-mobile-dock-tab={item.id}
                data-patient-mobile-dock-title={item.label}
                aria-label={item.label}
                disabled={item.disabled}
                className={cn(
                  "designlab-settings-mobile-item group relative flex shrink-0 flex-col items-center justify-center rounded-xl p-[1px] text-center transition-[filter,transform] duration-150 ease-out active:translate-y-0.5 disabled:opacity-45",
                  isActive && "is-active",
                  item.primary && "is-primary",
                  isPressed && "is-pressed"
                )}
                onPointerDown={(event) => {
                  startMobileDockGesture(
                    event.currentTarget,
                    item.id,
                    item.label,
                    event.clientX,
                    event.clientY,
                    event.pointerId
                  );
                }}
                onTouchStart={(event) => {
                  const touch = event.touches[0];
                  if (!touch) return;
                  startMobileDockGesture(
                    event.currentTarget,
                    item.id,
                    item.label,
                    touch.clientX,
                    touch.clientY
                  );
                }}
                onClick={(event) => handleMobileDockClick(event, item.id)}
              >
                <span
                  className={cn(
                    "designlab-settings-mobile-surface flex h-full w-full flex-col items-center justify-center rounded-[0.68rem] border px-2.5 py-1.5 transition-colors duration-300",
                    isActive
                      ? "border-primary/45 bg-primary/10 text-primary"
                      : item.primary
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border/70 bg-card/90 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "designlab-settings-mobile-icon grid h-7 w-7 place-items-center rounded-lg transition-colors duration-300",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : item.primary
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-foreground group-hover:bg-background/80"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-active:scale-95" />
                  </span>
                  <span className="designlab-settings-mobile-label mt-1 block max-w-[64px] truncate text-[10px] font-medium leading-tight tracking-tight">
                    {item.label}
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
