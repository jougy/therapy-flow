import React from "react";
import { format, isSameDay, isSameMonth, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import type { AgendaEventItem } from "./types";

interface AgendaMonthDayCellProps {
  day: Date;
  currentDate: Date;
  dayEvents: AgendaEventItem[];
  onSelectDate: (date: Date) => void;
  onNavigateToDay?: (date: Date) => void;
  compact?: boolean;
}

/**
 * Célula individual de um dia na grade do mês.
 */
export const AgendaMonthDayCell = React.memo<AgendaMonthDayCellProps>(({
  day,
  currentDate,
  dayEvents,
  onSelectDate,
  onNavigateToDay,
  compact = false,
}) => {
  const isCurrentMonth = isSameMonth(day, currentDate);
  const isDayToday = isToday(day);
  const isSelected = isSameDay(day, currentDate);
  const hasEvents = dayEvents.length > 0;

  return (
    <button
      type="button"
      onClick={() => onSelectDate(day)}
      onDoubleClick={() => onNavigateToDay?.(day)}
      className={cn(
        "relative flex flex-col items-center justify-between rounded-xl transition-all duration-150 outline-none text-left border",
        compact
          ? "p-1 min-h-[36px] sm:min-h-[42px]"
          : "p-1.5 sm:p-2 min-h-[58px] sm:min-h-[72px]",
        isSelected
          ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40"
          : "border-border/40 hover:border-primary/40 hover:bg-muted/30",
        !isCurrentMonth && "opacity-35 bg-muted/10",
        isDayToday && !isSelected && "border-primary/50 bg-primary/[0.03]"
      )}
    >
      {/* Cabeçalho do dia */}
      <div className="w-full flex items-center justify-between">
        <span
          className={cn(
            "flex items-center justify-center rounded-full font-medium",
            compact ? "h-5 w-5 text-[11px]" : "h-6 w-6 text-xs",
            isDayToday
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : isSelected
              ? "font-bold text-primary"
              : "text-foreground"
          )}
        >
          {format(day, "d")}
        </span>

        {hasEvents && dayEvents.length > 1 && (
          <span className="text-[10px] font-semibold text-muted-foreground hidden sm:inline-block">
            {dayEvents.length}
          </span>
        )}
      </div>

      {/* Indicadores / Dots de compromisso */}
      <div className={cn("w-full flex items-center justify-center gap-1 mt-auto", compact ? "pt-0.5" : "pt-1")}>
        {hasEvents ? (
          <div className="flex items-center gap-1 overflow-hidden">
            {dayEvents.slice(0, 3).map((ev, i) => (
              <span
                key={ev.id || i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  ev.eventType === "atendimento"
                    ? "bg-primary"
                    : ev.eventType === "reuniao"
                    ? "bg-indigo-500"
                    : "bg-violet-500"
                )}
                title={`${ev.time} - ${ev.title}`}
              />
            ))}
            {dayEvents.length > 3 && (
              <span className="text-[9px] font-bold text-muted-foreground">
                +{dayEvents.length - 3}
              </span>
            )}
          </div>
        ) : (
          <span className="h-1.5" />
        )}
      </div>
    </button>
  );
});

AgendaMonthDayCell.displayName = "AgendaMonthDayCell";
