import React, { useMemo } from "react";
import {
  format,
  isSameDay,
  isToday,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Clock, Sun, Sunset, Moon, CloudMoon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgendaPatientOption } from "@/lib/agenda-events";
import {
  type AgendaEventItem,
  type AgendaShift,
  getEventShift,
  eventTypeColors,
} from "./types";
import { AgendaWeekMobileMatrix } from "./AgendaWeekMobileMatrix";

interface AgendaWeekViewProps {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  onNavigateToDay: (date: Date) => void;
  events: AgendaEventItem[];
  patients: AgendaPatientOption[];
  onOpenAddModal: (presetDate?: Date, presetTime?: string) => void;
  onOpenEditModal: (event: AgendaEventItem) => void;
}

interface AgendaWeekDayCardProps {
  day: Date;
  isSelected: boolean;
  isDayToday: boolean;
  dayEvents: AgendaEventItem[];
  patientById: Map<string, AgendaPatientOption>;
  onSelectDate: (date: Date) => void;
  onNavigateToDay: (date: Date) => void;
  onOpenAddModal: (presetDate?: Date, presetTime?: string) => void;
  onOpenEditModal: (event: AgendaEventItem) => void;
}

/**
 * Card modular de um dia dentro do grid semanal.
 */
const AgendaWeekDayCard = React.memo<AgendaWeekDayCardProps>(({
  day,
  isSelected,
  isDayToday,
  dayEvents,
  patientById,
  onSelectDate,
  onNavigateToDay,
  onOpenAddModal,
  onOpenEditModal,
}) => {
  // Agrupar por turnos do dia
  const shiftsSummary = useMemo(() => {
    const summary: Record<AgendaShift, number> = {
      dawn: 0,
      morning: 0,
      afternoon: 0,
      evening: 0,
    };
    for (const ev of dayEvents) {
      const shift = getEventShift(ev.time);
      summary[shift]++;
    }
    return summary;
  }, [dayEvents]);

  return (
    <Card
      onClick={() => onSelectDate(day)}
      className={cn(
        "group relative flex flex-col min-h-[360px] rounded-2xl border transition-all duration-200 bg-card overflow-hidden cursor-pointer",
        isSelected
          ? "ring-2 ring-primary border-primary shadow-sm"
          : "border-border/80 hover:border-primary/40 hover:shadow-xs",
        isDayToday && "bg-primary/[0.02]"
      )}
    >
      {/* Cabeçalho do Dia */}
      <div className="p-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectDate(day);
            onNavigateToDay(day);
          }}
          className="text-left group/btn"
          title="Abrir visão do dia"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block group-hover/btn:text-primary transition-colors">
            {format(day, "EEE", { locale: ptBR })}
          </span>
          <span
            className={cn(
              "text-lg font-bold leading-tight block",
              isDayToday ? "text-primary" : "text-foreground"
            )}
          >
            {format(day, "dd")}
          </span>
        </button>

        {dayEvents.length > 0 ? (
          <Badge
            variant="secondary"
            className="text-[10px] h-5 px-1.5 rounded-full font-bold bg-primary/10 text-primary"
          >
            {dayEvents.length}
          </Badge>
        ) : (
          <span className="text-[10px] text-muted-foreground/50 font-medium">Livre</span>
        )}
      </div>

      {/* Resumo visual dos 4 turnos (Madrugada, Manhã, Tarde, Noite) */}
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5 border-b border-border/40 bg-muted/10 text-center">
        {/* Madrugada */}
        <div
          className={cn(
            "flex items-center justify-center gap-0.5 py-0.5 rounded-md text-[10px] font-medium border",
            shiftsSummary.dawn > 0
              ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-300/40 font-semibold"
              : "border-transparent text-muted-foreground/40"
          )}
          title={`Madrugada: ${shiftsSummary.dawn} compromisso(s)`}
        >
          <CloudMoon className="h-2.5 w-2.5" />
          <span>{shiftsSummary.dawn}</span>
        </div>

        {/* Manhã */}
        <div
          className={cn(
            "flex items-center justify-center gap-0.5 py-0.5 rounded-md text-[10px] font-medium border",
            shiftsSummary.morning > 0
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/40 font-semibold"
              : "border-transparent text-muted-foreground/40"
          )}
          title={`Manhã: ${shiftsSummary.morning} compromisso(s)`}
        >
          <Sun className="h-2.5 w-2.5" />
          <span>{shiftsSummary.morning}</span>
        </div>

        {/* Tarde */}
        <div
          className={cn(
            "flex items-center justify-center gap-0.5 py-0.5 rounded-md text-[10px] font-medium border",
            shiftsSummary.afternoon > 0
              ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300/40 font-semibold"
              : "border-transparent text-muted-foreground/40"
          )}
          title={`Tarde: ${shiftsSummary.afternoon} compromisso(s)`}
        >
          <Sunset className="h-2.5 w-2.5" />
          <span>{shiftsSummary.afternoon}</span>
        </div>

        {/* Noite */}
        <div
          className={cn(
            "flex items-center justify-center gap-0.5 py-0.5 rounded-md text-[10px] font-medium border",
            shiftsSummary.evening > 0
              ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300/40 font-semibold"
              : "border-transparent text-muted-foreground/40"
          )}
          title={`Noite: ${shiftsSummary.evening} compromisso(s)`}
        >
          <Moon className="h-2.5 w-2.5" />
          <span>{shiftsSummary.evening}</span>
        </div>
      </div>

      {/* Lista dos compromissos no card semanal */}
      <div className="flex-1 p-2 space-y-1.5 overflow-y-auto max-h-[220px]">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center text-muted-foreground/50">
            <p className="text-[11px]">Nenhum horário</p>
          </div>
        ) : (
          dayEvents.map((e) => {
            const typeStyle = eventTypeColors[e.eventType];
            const patient = e.patientId ? patientById.get(e.patientId) : null;
            const displayTitle = e.title || (patient ? patient.name : "Compromisso");

            return (
              <div
                key={e.id}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onOpenEditModal(e);
                }}
                className={cn(
                  "group/card p-2 rounded-xl border text-left text-xs transition-all duration-150 hover:shadow-xs hover:border-primary/40",
                  e.eventType === "atendimento"
                    ? "bg-primary/[0.04] border-primary/20"
                    : "bg-muted/40 border-border/60"
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="inline-flex items-center gap-1 font-bold text-[11px] text-foreground">
                    <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                    {e.time}
                  </span>
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", typeStyle.dot)} />
                </div>
                <p className="font-semibold text-[11px] text-foreground truncate mt-0.5" title={displayTitle}>
                  {displayTitle}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Rodapé com botão Adicionar */}
      <div className="p-2 border-t border-border/50 mt-auto bg-muted/10">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full h-7 text-[11px] font-semibold gap-1 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg"
          onClick={(ev) => {
            ev.stopPropagation();
            onOpenAddModal(day);
          }}
        >
          <Plus className="h-3 w-3" />
          Adicionar
        </Button>
      </div>
    </Card>
  );
});

AgendaWeekDayCard.displayName = "AgendaWeekDayCard";

/**
 * Visão semanal em grade de 7 colunas (Segunda a Domingo) com badges de turnos e lista de eventos.
 * Totalmente memoizada para evitar re-renderizações desnecessárias.
 */
export const AgendaWeekView = React.memo<AgendaWeekViewProps>(({
  currentDate,
  onSelectDate,
  onNavigateToDay,
  events,
  patients,
  onOpenAddModal,
  onOpenEditModal,
}) => {
  // Dias da semana corrente (Segunda a Domingo)
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Mapeamento de paciente por ID
  const patientById = useMemo(() => {
    const map = new Map<string, AgendaPatientOption>();
    for (const p of patients) {
      map.set(p.id, p);
    }
    return map;
  }, [patients]);

  // Agrupar eventos por dia ("YYYY-MM-DD") e já pré-ordenar por horário O(N log N)
  const eventsByDayKey = useMemo(() => {
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

  return (
    <div className="w-full">
      {/* Visão Semanal Mobile Compacta (Matriz 6x7 com Acordeon e Auto-Scroll Suave) */}
      <div className="block md:hidden">
        <AgendaWeekMobileMatrix
          currentDate={currentDate}
          weekDays={weekDays}
          events={events}
          patients={patients}
          onSelectDate={onSelectDate}
          onNavigateToDay={onNavigateToDay}
          onOpenAddModal={onOpenAddModal}
          onOpenEditModal={onOpenEditModal}
        />
      </div>

      {/* Visão Semanal Clássica Desktop (Grade de 7 Colunas Expandidas) */}
      <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-7 gap-3 w-full">
        {weekDays.map((day) => {
          const isDayToday = isToday(day);
          const isSelected = isSameDay(day, currentDate);
          const dayKey = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDayKey.get(dayKey) || [];

          return (
            <AgendaWeekDayCard
              key={day.toISOString()}
              day={day}
              isSelected={isSelected}
              isDayToday={isDayToday}
              dayEvents={dayEvents}
              patientById={patientById}
              onSelectDate={onSelectDate}
              onNavigateToDay={onNavigateToDay}
              onOpenAddModal={onOpenAddModal}
              onOpenEditModal={onOpenEditModal}
            />
          );
        })}
      </div>
    </div>
  );
});

AgendaWeekView.displayName = "AgendaWeekView";
