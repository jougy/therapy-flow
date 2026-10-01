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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgendaPatientOption } from "@/lib/agenda-events";
import {
  type AgendaEventItem,
  agendaStatusLabels,
  eventTypeColors,
  eventTypeLabels,
  statusBadgeStyles,
} from "./types";

interface AgendaMonthViewProps {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  events: AgendaEventItem[];
  patients: AgendaPatientOption[];
  onOpenAddModal: (presetDate?: Date, presetTime?: string) => void;
  onOpenEditModal: (event: AgendaEventItem) => void;
  onNavigateToDay?: (date: Date) => void;
}

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

/**
 * Célula individual de um dia na grade do mês.
 */
const AgendaMonthDayCell = React.memo<{
  day: Date;
  currentDate: Date;
  dayEvents: AgendaEventItem[];
  onSelectDate: (date: Date) => void;
  onNavigateToDay?: (date: Date) => void;
}>(({ day, currentDate, dayEvents, onSelectDate, onNavigateToDay }) => {
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
        "relative flex flex-col items-center justify-between p-1.5 sm:p-2 rounded-xl min-h-[58px] sm:min-h-[72px] transition-all duration-150 outline-none text-left border",
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
            "flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium",
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
      <div className="w-full flex items-center justify-center gap-1 mt-auto pt-1">
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

/**
 * Card de evento no painel lateral contextual do dia selecionado.
 */
const AgendaMonthSideEventCard = React.memo<{
  event: AgendaEventItem;
  patient: AgendaPatientOption | null;
  onOpenEditModal: (event: AgendaEventItem) => void;
}>(({ event, patient, onOpenEditModal }) => {
  const typeStyle = eventTypeColors[event.eventType];

  return (
    <div
      onClick={() => onOpenEditModal(event)}
      className="group relative flex flex-col gap-2 p-3 rounded-xl border bg-muted/20 hover:bg-muted/50 hover:border-primary/40 cursor-pointer transition-all duration-150"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 font-bold text-xs text-foreground bg-background px-2 py-0.5 rounded-lg border shadow-2xs">
            <Clock className="h-3 w-3 text-muted-foreground" />
            {event.time}
          </span>
          <Badge
            variant="outline"
            className={cn("text-[9px] px-1.5 py-0 capitalize", statusBadgeStyles[event.status])}
          >
            {agendaStatusLabels[event.status]}
          </Badge>
        </div>

        <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
          Editar
        </span>
      </div>

      <div>
        <h4 className="font-semibold text-xs text-foreground truncate">{event.title}</h4>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", typeStyle.dot)} />
            {eventTypeLabels[event.eventType]}
          </span>
          {patient && (
            <span className="inline-flex items-center gap-1 truncate">
              <User className="h-3 w-3" />
              {patient.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

AgendaMonthSideEventCard.displayName = "AgendaMonthSideEventCard";

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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full items-start">
      {/* Coluna Principal: Calendário do Mês (8 cols) */}
      <Card className="lg:col-span-8 rounded-2xl border bg-card p-4 sm:p-5 shadow-xs">
        {/* Cabeçalho do Mês estilo < 9 / 2026 > ou < Setembro de 2026 > */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-3 border-b">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-xl"
              onClick={handlePrevMonth}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="text-base font-bold tracking-tight text-foreground sm:text-lg min-w-[130px] text-center capitalize">
              {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-xl"
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
                className="h-8 rounded-xl text-xs text-primary font-medium"
                onClick={handleToday}
              >
                Mês atual
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-muted text-muted-foreground">
              {format(currentDate, "M / yyyy")}
            </span>
            {onNavigateToDay && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-xl text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => onNavigateToDay(currentDate)}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                Abrir Dia
              </Button>
            )}
          </div>
        </div>

        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 mb-2 text-center">
          {WEEKDAYS.map((dayName, idx) => (
            <div
              key={dayName}
              className={cn(
                "py-1.5 text-xs font-semibold tracking-wider text-muted-foreground",
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
            />
          ))}
        </div>
      </Card>

      {/* Painel Contextual do Dia Selecionado (Lateral no Desktop, Inferior no Mobile) (4 cols) */}
      <Card className="lg:col-span-4 rounded-2xl border bg-card p-4 sm:p-5 shadow-xs flex flex-col gap-4">
        {/* Cabeçalho do Painel Contextual */}
        <div className="flex items-start justify-between border-b pb-3 gap-2">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Dia Selecionado
            </span>
            <h3 className="text-base font-bold capitalize text-foreground leading-tight mt-0.5">
              {format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h3>
          </div>

          <Badge variant="outline" className="text-xs h-6 px-2 font-medium shrink-0">
            {selectedDayEvents.length}{" "}
            {selectedDayEvents.length === 1 ? "compromisso" : "compromissos"}
          </Badge>
        </div>

        {/* Botão de Agendamento Rápido no Dia Selecionado */}
        <Button
          type="button"
          onClick={() => onOpenAddModal(currentDate)}
          className="w-full gap-2 rounded-xl text-xs font-semibold shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Agendar horário
        </Button>

        {/* Lista Compacta de Compromissos do Dia */}
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[380px] pr-1">
          {selectedDayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed text-muted-foreground">
              <CalendarDays className="h-8 w-8 text-muted-foreground/40 mb-2" />
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
