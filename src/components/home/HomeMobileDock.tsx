import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { BarChart3, CalendarDays, FileText, Plus, UsersRound, Settings, Building2, UserCog, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { HomeListMode } from "@/components/home/PatientSearchToolbar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export type ClinicMobileDockAction = "patients" | "sessions" | "new-patient" | "agenda" | "stats" | "settings";

interface HomeMobileDockProps {
  listMode: HomeListMode;
  onListModeChange: (mode: HomeListMode) => void;
  hasClinicSessionsList: boolean;
  canViewFinancialData: boolean;
  clinicHomePath?: string;
  onOpenNewPatient: () => void;
  onOpenAgenda: () => void;
  onOpenDashboard: () => void;
}

export const HomeMobileDock = memo(function HomeMobileDock({
  listMode,
  onListModeChange,
  hasClinicSessionsList,
  canViewFinancialData,
  clinicHomePath = "",
  onOpenNewPatient,
  onOpenAgenda,
  onOpenDashboard,
}: HomeMobileDockProps) {
  const navigate = useNavigate();
  const [mobileDockExpanded, setMobileDockExpanded] = useState(false);
  const [mobileDockPressedAction, setMobileDockPressedAction] = useState<ClinicMobileDockAction | null>(null);
  const [mobileDockPointerActive, setMobileDockPointerActive] = useState(false);
  const [mobileDockTooltip, setMobileDockTooltip] = useState<{ title: string; x: number } | null>(null);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);

  const mobileLongPressTimerRef = useRef<number | null>(null);
  const mobileLongPressTriggeredRef = useRef(false);
  const mobileDockScrollResetTimerRef = useRef<number | null>(null);
  const mobileDockAutoScrollFrameRef = useRef<number | null>(null);
  const mobileDockGestureRef = useRef<{
    action: ClinicMobileDockAction;
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
    setMobileDockPressedAction(gesture.action);
    updateMobileDockTooltipForButton(gesture.button, gesture.title);
  }, [updateMobileDockTooltipForButton]);

  const startMobileDockGesture = useCallback(
    (button: HTMLButtonElement, action: ClinicMobileDockAction, title: string, clientX: number, clientY: number, pointerId = -1) => {
      mobileLongPressTriggeredRef.current = false;
      clearMobileLongPress();
      mobileDockGestureRef.current = {
        action,
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

  const updateMobileDockPressedActionFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const element = document.elementFromPoint(clientX, clientY);
      const button = element?.closest<HTMLButtonElement>("[data-clinic-mobile-dock-action]");
      const action = button?.dataset.clinicMobileDockAction as ClinicMobileDockAction | undefined;
      const title = button?.dataset.clinicMobileDockTitle;

      if (action && title) {
        setMobileDockPressedAction(action);
        updateMobileDockTooltipForButton(button, title);
      }
    },
    [updateMobileDockTooltipForButton]
  );

  const updateMobileDockAutoScroll = useCallback(
    (clientX: number, clientY: number) => {
      stopMobileDockAutoScroll();

      const dock = document.querySelector<HTMLElement>(".clinic-home-mobile-dock");
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
        updateMobileDockPressedActionFromPoint(clientX, clientY);
        mobileDockAutoScrollFrameRef.current = window.requestAnimationFrame(step);
      };

      mobileDockAutoScrollFrameRef.current = window.requestAnimationFrame(step);
    },
    [stopMobileDockAutoScroll, updateMobileDockPressedActionFromPoint]
  );

  const moveMobileDockGesture = useCallback(
    (clientX: number, clientY: number) => {
      if (mobileDockPointerActive) {
        updateMobileDockPressedActionFromPoint(clientX, clientY);
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
    [clearMobileLongPress, mobileDockPointerActive, updateMobileDockAutoScroll, updateMobileDockPressedActionFromPoint]
  );

  const finishMobileDockInteraction = useCallback(() => {
    clearMobileLongPress();
    stopMobileDockAutoScroll();
    mobileDockGestureRef.current = null;
    setMobileDockPointerActive(false);
    setMobileDockExpanded(true);
    setMobileDockPressedAction(null);
    setMobileDockTooltip(null);
  }, [clearMobileLongPress, stopMobileDockAutoScroll]);

  const handleMobileDockClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, action: ClinicMobileDockAction) => {
      if (mobileLongPressTriggeredRef.current) {
        event.preventDefault();
        return;
      }

      setMobileDockExpanded(true);

      if (action === "patients") {
        onListModeChange("patients");
        return;
      }

      if (action === "sessions") {
        onListModeChange("sessions");
        return;
      }

      if (action === "new-patient") {
        onOpenNewPatient();
        return;
      }

      if (action === "agenda") {
        onOpenAgenda();
        return;
      }

      if (action === "stats" && canViewFinancialData) {
        onOpenDashboard();
        return;
      }

      if (action === "settings") {
        setSettingsSheetOpen(true);
      }
    },
    [canViewFinancialData, onListModeChange, onOpenAgenda, onOpenDashboard, onOpenNewPatient]
  );

  useEffect(() => {
    const handleScroll = () => {
      if (mobileDockScrollResetTimerRef.current !== null) {
        window.clearTimeout(mobileDockScrollResetTimerRef.current);
      }

      mobileDockScrollResetTimerRef.current = window.setTimeout(() => {
        setMobileDockExpanded(false);
        setMobileDockPressedAction(null);
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

  const dockItems = [
    { action: "patients" as const, title: "Pacientes", icon: UsersRound, active: listMode === "patients" },
    ...(hasClinicSessionsList ? [{ action: "sessions" as const, title: "Atendimentos", icon: FileText, active: listMode === "sessions" }] : []),
    { action: "new-patient" as const, title: "Novo paciente", icon: Plus, active: false, primary: true },
    { action: "agenda" as const, title: "Agenda", icon: CalendarDays, active: false },
    { action: "stats" as const, title: "Estatísticas", icon: BarChart3, active: false, disabled: !canViewFinancialData },
    { action: "settings" as const, title: "Configurações", icon: Settings, active: false },
  ];

  return (
    <nav
      className="designlab-settings-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/94 backdrop-blur supports-[backdrop-filter]:bg-background/88 md:hidden"
      aria-label="Navegação principal da clínica"
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
          className="clinic-home-mobile-dock designlab-settings-mobile-dock flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            const Icon = item.icon;
            const isPressed = mobileDockPressedAction === item.action;

            return (
              <button
                key={item.action}
                type="button"
                aria-label={item.title}
                aria-pressed={item.active}
                data-clinic-mobile-dock-action={item.action}
                data-clinic-mobile-dock-title={item.title}
                disabled={item.disabled}
                className={`designlab-settings-mobile-item group relative flex shrink-0 flex-col items-center justify-center rounded-xl p-[1px] text-center transition-[filter,transform] duration-150 ease-out active:translate-y-0.5 disabled:opacity-45 ${item.active ? "is-active" : ""} ${item.primary ? "is-primary" : ""} ${isPressed ? "is-pressed" : ""}`}
                onPointerDown={(event) => {
                  startMobileDockGesture(event.currentTarget, item.action, item.title, event.clientX, event.clientY, event.pointerId);
                }}
                onTouchStart={(event) => {
                  const touch = event.touches[0];
                  if (touch) {
                    startMobileDockGesture(event.currentTarget, item.action, item.title, touch.clientX, touch.clientY);
                  }
                }}
                onClick={(event) => handleMobileDockClick(event, item.action)}
              >
                <span
                  className={`designlab-settings-mobile-surface flex h-full w-full flex-col items-center justify-center rounded-[0.68rem] border px-2 py-2 transition-colors duration-300 ${
                    item.active || item.primary
                      ? "border-primary/45 bg-primary/10 text-primary"
                      : "border-border/80 bg-card/92 text-muted-foreground"
                  }`}
                >
                  <span
                    className={`designlab-settings-mobile-icon grid h-7 w-7 place-items-center rounded-lg transition-colors duration-300 ${
                      item.active || item.primary ? "bg-primary/14 text-primary" : "bg-muted/70 text-foreground"
                    }`}
                  >
                    <Icon className={item.primary ? "h-[1.15rem] w-[1.15rem]" : "h-4 w-4"} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Settings Action Sheet */}
      <Sheet open={settingsSheetOpen} onOpenChange={setSettingsSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-8 pt-5">
          <SheetHeader className="text-left pb-3">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Configurações
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Escolha qual área de configuração você deseja gerenciar.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-3 pt-2">
            {/* Opção 1: Configurações da Clínica */}
            <button
              type="button"
              className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card/80 hover:bg-muted/50 active:scale-[0.99] transition-all text-left group"
              onClick={() => {
                setSettingsSheetOpen(false);
                const target = clinicHomePath
                  ? `${clinicHomePath}/configuracoes/perfil`
                  : "/configuracoes/perfil";
                navigate(target);
              }}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">Configurações da clínica</h4>
                  <p className="text-xs text-muted-foreground truncate">
                    Perfil da clínica, logo, equipe, planos e preferências
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
            </button>

            {/* Opção 2: Configurações Pessoais */}
            <button
              type="button"
              className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card/80 hover:bg-muted/50 active:scale-[0.99] transition-all text-left group"
              onClick={() => {
                setSettingsSheetOpen(false);
                const target = clinicHomePath
                  ? `${clinicHomePath}/configuracoes/pessoal/perfil`
                  : "/configuracoes/pessoal/perfil";
                navigate(target);
              }}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                  <UserCog className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">Configurações da sua conta pessoal</h4>
                  <p className="text-xs text-muted-foreground truncate">
                    Seu perfil, segurança, e-mail, senha e notificações
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
});
