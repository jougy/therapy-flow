import React, { useMemo } from "react";
import {
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  CalendarDays,
  Calendar as CalendarIcon,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgendaPatientOption } from "@/lib/agenda-events";
import { type AgendaEventItem } from "./types";
import { AgendaMonthDayCell } from "./AgendaMonthDayCell";
import { AgendaMonthSideEventCard } from "./AgendaMonthSideEventCard";

export interface AgendaMonthViewProps {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  events: AgendaEventItem[];
  patients: AgendaPatientOption[];
  onOpenAddModal: (presetDate?: Date, presetTime?: string) => void;
  onOpenEditModal: (event: AgendaEventItem) => void;
  onNavigateToDay?: (date: Date) => void;
  compact?: boolean;
}

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

/**
 * Visão em grade mensal com painel lateral contextual do dia selecionado.
 * Totalmente memoizada para evitar re-renderizações desnecessárias.
 */
export const AgendaMonthView = React.memo<AgendaMonthViewProps>(({
  currentDate,
  onSelectDate,
  events,
  patients,
  onOpenAddModal,
  onOpenEditModal,
  onNavigateToDay,
  compact = false,
}) => {
  // Intervalo do grid (começando na segunda-feira)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  // Mapa de eventos por chave "YYYY-MM-DD" com ordenação antecipada O(N log N)
  const eventsByDateKey = useMemo(() => {
    const map = new Map<string, AgendaEventItem[]>();
    for (const ev of events) {
      const key = format(ev.date, "yyyy-MM-dd");
      const list = map.get(key) || [];
      list.push(ev);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [events]);

  // Eventos do dia selecionado (já pré-ordenados O(1))
  const selectedDayKey = format(currentDate, "yyyy-MM-dd");
  const selectedDayEvents = useMemo(() => {
    return eventsByDateKey.get(selectedDayKey) || [];
  }, [eventsByDateKey, selectedDayKey]);

  const handlePrevMonth = () => {
    onSelectDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    onSelectDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    onSelectDate(new Date());
  };

  // Mapeamento de paciente por ID
  const patientById = useMemo(() => {
    const map = new Map<string, AgendaPatientOption>();
    for (const p of patients) {
      map.set(p.id, p);
    }
    return map;
  }, [patients]);

  return (
    <div
      className={cn(
        "grid grid-cols-1 lg:grid-cols-12 w-full items-start",
        compact ? "gap-3" : "gap-5"
      )}
    >
      {/* Coluna Principal: Calendário do Mês (8 cols) */}
      <Card
        className={cn(
          "lg:col-span-8 rounded-2xl border bg-card shadow-xs",
          compact ? "p-3" : "p-4 sm:p-5"
        )}
      >
        {/* Cabeçalho do Mês estilo < 9 / 2026 > ou < Setembro de 2026 > */}
        <div
          className={cn(
            "flex flex-wrap items-center justify-between border-b",
            compact ? "pb-2 mb-2 gap-2" : "pb-4 mb-3 gap-3"
          )}
        >
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn("rounded-xl", compact ? "h-7 w-7" : "h-8 w-8")}
              onClick={handlePrevMonth}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span
              className={cn(
                "font-bold tracking-tight text-foreground text-center capitalize",
                compact
                  ? "text-sm sm:text-base min-w-[110px]"
                  : "text-base sm:text-lg min-w-[130px]"
              )}
            >
              {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn("rounded-xl", compact ? "h-7 w-7" : "h-8 w-8")}
              onClick={handleNextMonth}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {!isSameMonth(currentDate, new Date()) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-xl text-xs text-primary font-medium",
                  compact ? "h-7 px-2" : "h-8"
                )}
                onClick={handleToday}
              >
                Mês atual
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-semibold rounded-lg bg-muted text-muted-foreground",
                compact ? "text-[11px] px-1.5 py-0.5" : "text-xs px-2 py-1"
              )}
            >
              {format(currentDate, "M / yyyy")}
            </span>
            {onNavigateToDay && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-xl text-xs gap-1.5 text-muted-foreground hover:text-foreground",
                  compact ? "h-7 px-2" : "h-8"
                )}
                onClick={() => onNavigateToDay(currentDate)}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                Abrir Dia
              </Button>
            )}
          </div>
        </div>

        {/* Cabeçalho dos dias da semana */}
        <div className={cn("grid grid-cols-7 text-center", compact ? "mb-1" : "mb-2")}>
          {WEEKDAYS.map((dayName, idx) => (
            <div
              key={dayName}
              className={cn(
                "font-semibold tracking-wider text-muted-foreground",
                compact ? "py-1 text-[11px]" : "py-1.5 text-xs",
                idx >= 5 && "text-muted-foreground/60"
              )}
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* Grade dos dias do mês */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarDays.map((day) => (
            <AgendaMonthDayCell
              key={day.toISOString()}
              day={day}
              currentDate={currentDate}
              dayEvents={eventsByDateKey.get(format(day, "yyyy-MM-dd")) || []}
              onSelectDate={onSelectDate}
              onNavigateToDay={onNavigateToDay}
              compact={compact}
            />
          ))}
        </div>
      </Card>

      {/* Painel Contextual do Dia Selecionado (Lateral no Desktop, Inferior no Mobile) (4 cols) */}
      <Card
        className={cn(
          "lg:col-span-4 rounded-2xl border bg-card shadow-xs flex flex-col",
          compact ? "p-3 gap-2.5" : "p-4 sm:p-5 gap-4"
        )}
      >
        {/* Cabeçalho do Painel Contextual */}
        <div
          className={cn(
            "flex items-start justify-between border-b gap-2",
            compact ? "pb-2" : "pb-3"
          )}
        >
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Dia Selecionado
            </span>
            <h3
              className={cn(
                "capitalize text-foreground leading-tight mt-0.5",
                compact ? "text-sm font-semibold" : "text-base font-bold"
              )}
            >
              {format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h3>
          </div>

          <Badge
            variant="outline"
            className={cn("font-medium shrink-0", compact ? "text-[10px] h-5 px-1.5" : "text-xs h-6 px-2")}
          >
            {selectedDayEvents.length}{" "}
            {selectedDayEvents.length === 1 ? "compromisso" : "compromissos"}
          </Badge>
        </div>

        {/* Botão de Agendamento Rápido no Dia Selecionado */}
        <Button
          type="button"
          onClick={() => onOpenAddModal(currentDate)}
          className={cn(
            "w-full gap-2 rounded-xl text-xs font-semibold shadow-xs",
            compact ? "h-8 py-1" : ""
          )}
        >
          <Plus className="h-4 w-4" />
          Agendar horário
        </Button>

        {/* Lista Compacta de Compromissos do Dia */}
        <div
          className={cn(
            "flex-1 flex flex-col overflow-y-auto pr-1",
            compact ? "max-h-[220px] gap-1.5" : "max-h-[380px] gap-2"
          )}
        >
          {selectedDayEvents.length === 0 ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center text-center rounded-xl border border-dashed text-muted-foreground",
                compact ? "p-3" : "p-6"
              )}
            >
              <CalendarDays
                className={cn(
                  "text-muted-foreground/40",
                  compact ? "h-6 w-6 mb-1.5" : "h-8 w-8 mb-2"
                )}
              />
              <p className="text-xs font-medium text-foreground">Nenhum compromisso marcado</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Clique no botão acima para abrir um novo horário neste dia.
              </p>
            </div>
          ) : (
            selectedDayEvents.map((ev) => {
              const patient = ev.patientId ? patientById.get(ev.patientId) || null : null;

              return (
                <AgendaMonthSideEventCard
                  key={ev.id}
                  event={ev}
                  patient={patient}
                  onOpenEditModal={onOpenEditModal}
                  compact={compact}
                />
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
});

AgendaMonthView.displayName = "AgendaMonthView";
