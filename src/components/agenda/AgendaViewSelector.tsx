import React from "react";
import { Calendar, CalendarDays, CalendarRange, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgendaViewMode } from "./types";

interface AgendaViewSelectorProps {
  value: AgendaViewMode;
  onChange: (mode: AgendaViewMode) => void;
  className?: string;
  allowedViews?: {
    day?: boolean;
    week?: boolean;
    month?: boolean;
    year?: boolean;
  };
}

interface AgendaViewOption {
  id: AgendaViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MODES: readonly AgendaViewOption[] = [
  { id: "year", label: "Ano", icon: CalendarRange },
  { id: "month", label: "Mês", icon: Calendar },
  { id: "week", label: "Semana", icon: CalendarDays },
  { id: "day", label: "Dia", icon: Clock },
] as const;

/**
 * Seletor de modo de visualização da agenda clínica (Ano, Mês, Semana, Dia).
 * Memoizado com React.memo para evitar re-renderizações desnecessárias em cascata.
 */
export const AgendaViewSelector = React.memo<AgendaViewSelectorProps>(({
  value,
  onChange,
  className,
  allowedViews,
}) => {
  const visibleModes = React.useMemo(() => {
    if (!allowedViews) return MODES;
    return MODES.filter((m) => allowedViews[m.id] !== false);
  }, [allowedViews]);

  // Se a lista de visíveis estiver vazia por configuração extrema, manter ao menos o modo atual
  const finalModes = visibleModes.length > 0 ? visibleModes : MODES;

  return (
    <nav
      aria-label="Modo de visualização da agenda"
      className={cn(
        "relative flex flex-wrap sm:flex-nowrap items-center gap-1 p-1 rounded-2xl bg-muted/60 dark:bg-muted/30 border border-border/60 shadow-xs backdrop-blur-xs select-none w-full sm:w-auto",
        className
      )}
    >
      {finalModes.map((mode) => {
        const Icon = mode.icon;
        const isActive = value === mode.id;

        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            data-active={isActive}
            className={cn(
              "group relative flex items-center justify-center gap-1.5 py-1.5 px-2.5 sm:px-3.5 rounded-xl text-xs font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isActive
                ? "bg-background text-foreground shadow-xs ring-1 ring-border/50 dark:shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40"
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                isActive ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground"
              )}
            />
            <span className="truncate">{mode.label}</span>
          </button>
        );
      })}
    </nav>
  );
});

AgendaViewSelector.displayName = "AgendaViewSelector";

