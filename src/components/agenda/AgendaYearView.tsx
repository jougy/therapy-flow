import React, { useMemo } from "react";
import {
  format,
  isSameDay,
  isToday,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  setMonth,
  setYear,
  getYear,
  addYears,
  subYears,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgendaEventItem } from "./types";

interface AgendaYearViewProps {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  onNavigateToView: (view: "month" | "day", targetDate: Date) => void;
  events: AgendaEventItem[];
  compact?: boolean;
}

interface MonthData {
  index: number;
  date: Date;
  name: string;
  days: Date[];
  leadingEmptyDays: number;
  totalEvents: number;
}

const WEEKDAY_HEADERS = ["S", "T", "Q", "Q", "S", "S", "D"] as const;

/**
 * Card modular de um mês no grid anual.
 */
const AgendaYearMonthCard = React.memo<{
  month: MonthData;
  currentDate: Date;
  eventsByDateKey: Map<string, AgendaEventItem[]>;
  onSelectDate: (date: Date) => void;
  onNavigateToView: (view: "month" | "day", targetDate: Date) => void;
  compact?: boolean;
}>(({ month, currentDate, eventsByDateKey, onSelectDate, onNavigateToView, compact = false }) => {
  return (
    <Card
      className={cn(
        "group relative flex flex-col rounded-2xl border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 bg-card",
        compact ? "p-2.5" : "p-3"
      )}
    >
      {/* Cabeçalho do Mês */}
      <div
        className={cn(
          "flex items-center justify-between border-b border-border/50",
          compact ? "pb-1.5 mb-1" : "pb-2 mb-2"
        )}
      >
        <button
          type="button"
          onClick={() => onNavigateToView("month", month.date)}
          className={cn(
            "font-bold capitalize text-foreground hover:text-primary transition-colors text-left flex items-center gap-1",
            compact ? "text-xs" : "text-sm"
          )}
          title={`Ver mês de ${month.name}`}
        >
          <span>{month.name}</span>
          <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            →
          </span>
        </button>

        {month.totalEvents > 0 && (
          <Badge
            variant="secondary"
            className={cn(
              "rounded-full font-semibold bg-primary/10 text-primary hover:bg-primary/20",
              compact ? "text-[9px] h-4 px-1" : "text-[10px] h-4.5 px-1.5"
            )}
            onClick={() => onNavigateToView("month", month.date)}
          >
            {month.totalEvents}
          </Badge>
        )}
      </div>

      {/* Cabeçalho dos dias da semana */}
      <div className={cn("grid grid-cols-7 text-center", compact ? "mb-0.5" : "mb-1")}>
        {WEEKDAY_HEADERS.map((h, i) => (
          <span
            key={i}
            className={cn(
              "font-semibold text-muted-foreground/70",
              compact ? "text-[9px]" : "text-[10px]"
            )}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Grid dos dias */}
      <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center text-xs">
        {/* Espaços vazios no início */}
        {Array.from({ length: month.leadingEmptyDays }).map((_, i) => (
          <div key={`empty-${i}`} className={cn(compact ? "h-5 w-5" : "h-6 w-6", "mx-auto")} />
        ))}

        {/* Dias do mês */}
        {month.days.map((day) => {
          const dayIsToday = isToday(day);
          const dayIsSelected = isSameDay(day, currentDate);
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDateKey.get(key) || [];
          const hasEvents = dayEvents.length > 0;

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => {
                onSelectDate(day);
                onNavigateToView("day", day);
              }}
              className={cn(
                "group/day relative flex flex-col items-center justify-center mx-auto rounded-full font-medium transition-all duration-150",
                compact ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-[11px]",
                dayIsToday
                  ? "bg-primary text-primary-foreground font-bold shadow-xs scale-105"
                  : dayIsSelected
                  ? "ring-2 ring-primary font-bold text-primary"
                  : "text-foreground hover:bg-muted/80"
              )}
              title={`${format(day, "dd/MM/yyyy")}: ${
                hasEvents ? `${dayEvents.length} agendamento(s)` : "Livre"
              }`}
            >
              <span>{format(day, "d")}</span>
              {hasEvents && !dayIsToday && (
                <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
});

AgendaYearMonthCard.displayName = "AgendaYearMonthCard";

/**
 * Visão anual exibindo os 12 meses do ano selecionado com indicadores visuais de agendamentos.
 * Totalmente memoizada para evitar re-renderizações desnecessárias.
 */
export const AgendaYearView = React.memo<AgendaYearViewProps>(({
  currentDate,
  onSelectDate,
  onNavigateToView,
  events,
  compact = false,
}) => {
  const selectedYear = getYear(currentDate);

  // Mapear eventos por chave "YYYY-MM-DD" para pesquisa O(1)
  const eventsByDateKey = useMemo(() => {
    const map = new Map<string, AgendaEventItem[]>();
    for (const ev of events) {
      const key = format(ev.date, "yyyy-MM-dd");
      const list = map.get(key) || [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const months: MonthData[] = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const monthDate = setMonth(setYear(new Date(), selectedYear), index);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      const days = eachDayOfInterval({ start, end });

      // Início na segunda-feira (1): dom=0 -> offset 6, seg=1 -> offset 0
      const startDayOfWeek = getDay(start);
      const leadingEmptyDays = (startDayOfWeek + 6) % 7;

      // Total de eventos no mês
      let totalMonthEvents = 0;
      for (const d of days) {
        const key = format(d, "yyyy-MM-dd");
        totalMonthEvents += eventsByDateKey.get(key)?.length ?? 0;
      }

      return {
        index,
        date: monthDate,
        name: format(monthDate, "MMMM", { locale: ptBR }),
        days,
        leadingEmptyDays,
        totalEvents: totalMonthEvents,
      };
    });
  }, [selectedYear, eventsByDateKey]);

  const handlePrevYear = () => {
    onSelectDate(subYears(currentDate, 1));
  };

  const handleNextYear = () => {
    onSelectDate(addYears(currentDate, 1));
  };

  const handleCurrentYear = () => {
    onSelectDate(new Date());
  };

  return (
    <div className={cn("flex flex-col w-full", compact ? "gap-3" : "gap-5")}>
      {/* Header do Ano */}
      <div
        className={cn(
          "flex items-center justify-between rounded-2xl border bg-card/60 backdrop-blur-xs shadow-xs",
          compact ? "px-3 py-2" : "px-4 py-3"
        )}
      >
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn("rounded-xl", compact ? "h-7 w-7" : "h-8 w-8")}
            onClick={handlePrevYear}
            aria-label="Ano anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span
            className={cn(
              "font-bold tracking-tight text-foreground px-1",
              compact ? "text-base sm:text-lg" : "text-lg sm:text-xl"
            )}
          >
            {selectedYear}
          </span>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn("rounded-xl", compact ? "h-7 w-7" : "h-8 w-8")}
            onClick={handleNextYear}
            aria-label="Próximo ano"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {selectedYear !== getYear(new Date()) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-xl text-xs text-primary font-medium",
                compact ? "h-7 px-2" : "h-8"
              )}
              onClick={handleCurrentYear}
            >
              Ano atual
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span>Hoje</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>Com agendamentos</span>
          </div>
        </div>
      </div>

      {/* Grid Anual: 3x4 no mobile, 4x3 no desktop */}
      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
          compact ? "gap-2.5" : "gap-4"
        )}
      >
        {months.map((month) => (
          <AgendaYearMonthCard
            key={month.index}
            month={month}
            currentDate={currentDate}
            eventsByDateKey={eventsByDateKey}
            onSelectDate={onSelectDate}
            onNavigateToView={onNavigateToView}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
});

AgendaYearView.displayName = "AgendaYearView";
