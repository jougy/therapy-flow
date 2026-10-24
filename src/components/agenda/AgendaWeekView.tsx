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
import { Plus, Clock, Sun, Sunset, Moon, CloudMoon, Globe } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRelativeTimezoneComparison } from "@/lib/geo-timezone";
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
  compact?: boolean;
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
  compact?: boolean;
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
  compact = false,
}) => {
  // Estado local de turnos filtrados no card (multiseleção)
  const [selectedLocalShifts, setSelectedLocalShifts] = React.useState<AgendaShift[]>([]);

  // Agrupar por turnos do dia (resumo total do dia antes de filtros locais)
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

  // Alternar turno selecionado no card (multiseleção)
  const handleToggleLocalShift = (shift: AgendaShift, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLocalShifts((prev) => {
      if (prev.includes(shift)) {
        return prev.filter((s) => s !== shift);
      }
      return [...prev, shift];
    });
  };

  // Eventos exibidos após aplicar filtro de turno local se houver
  const displayedEvents = useMemo(() => {
    if (selectedLocalShifts.length === 0 || selectedLocalShifts.length === 4) {
      return dayEvents;
    }
    return dayEvents.filter((ev) => selectedLocalShifts.includes(getEventShift(ev.time)));
  }, [dayEvents, selectedLocalShifts]);

  return (
    <Card
      onClick={() => onSelectDate(day)}
      className={cn(
        "group relative flex flex-col rounded-2xl border transition-all duration-200 bg-card overflow-hidden cursor-pointer",
        compact ? "min-h-[190px]" : "min-h-[360px]",
        isSelected
          ? "ring-2 ring-primary border-primary shadow-sm"
          : "border-border/80 hover:border-primary/40 hover:shadow-xs",
        isDayToday && "bg-primary/[0.02]"
      )}
    >
      {/* Cabeçalho do Dia */}
      <div
        className={cn(
          "border-b border-border/60 bg-muted/20 flex items-center justify-between",
          compact ? "p-2" : "p-3"
        )}
      >
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
              "font-bold leading-tight block",
              compact ? "text-base" : "text-lg",
              isDayToday ? "text-primary" : "text-foreground"
            )}
          >
            {format(day, "dd")}
          </span>
        </button>

        <div className="flex items-center gap-1">
          {selectedLocalShifts.length > 0 && selectedLocalShifts.length < 4 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedLocalShifts([]);
              }}
              className="text-[10px] text-muted-foreground hover:text-primary underline px-1"
              title="Limpar filtro de turnos"
            >
              Todos
            </button>
          )}
          {dayEvents.length > 0 ? (
            <Badge
              variant="secondary"
              className="text-[10px] h-5 px-1.5 rounded-full font-bold bg-primary/10 text-primary"
            >
              {displayedEvents.length !== dayEvents.length
                ? `${displayedEvents.length}/${dayEvents.length}`
                : dayEvents.length}
            </Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground/50 font-medium">Livre</span>
          )}
        </div>
      </div>

      {/* Resumo interativo dos 4 turnos (Madrugada, Manhã, Tarde, Noite) - Multisselecionáveis */}
      <div
        className={cn(
          "grid grid-cols-4 border-b border-border/40 bg-muted/10 text-center",
          compact ? "gap-0.5 px-1 py-0.5" : "gap-1 px-2 py-1.5"
        )}
      >
        {/* Madrugada */}
        <button
          type="button"
          onClick={(e) => handleToggleLocalShift("dawn", e)}
          className={cn(
            "flex items-center justify-center rounded-lg font-medium border transition-all select-none cursor-pointer",
            compact ? "gap-0.5 py-0.5 px-0.5 text-[9px] h-5" : "gap-0.5 py-1 px-0.5 text-[10px]",
            selectedLocalShifts.includes("dawn")
              ? "bg-indigo-600 text-white border-indigo-700 shadow-xs font-bold ring-1 ring-indigo-400"
              : shiftsSummary.dawn > 0
              ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-300/40 hover:bg-indigo-500/20 font-semibold"
              : "border-transparent text-muted-foreground/40 hover:bg-muted/40"
          )}
          title={`Madrugada: ${shiftsSummary.dawn} compromisso(s). Clique para filtrar.`}
        >
          <CloudMoon className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", "shrink-0")} />
          <span>{shiftsSummary.dawn}</span>
        </button>

        {/* Manhã */}
        <button
          type="button"
          onClick={(e) => handleToggleLocalShift("morning", e)}
          className={cn(
            "flex items-center justify-center rounded-lg font-medium border transition-all select-none cursor-pointer",
            compact ? "gap-0.5 py-0.5 px-0.5 text-[9px] h-5" : "gap-0.5 py-1 px-0.5 text-[10px]",
            selectedLocalShifts.includes("morning")
              ? "bg-amber-600 text-white border-amber-700 shadow-xs font-bold ring-1 ring-amber-400"
              : shiftsSummary.morning > 0
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/40 hover:bg-amber-500/20 font-semibold"
              : "border-transparent text-muted-foreground/40 hover:bg-muted/40"
          )}
          title={`Manhã: ${shiftsSummary.morning} compromisso(s). Clique para filtrar.`}
        >
          <Sun className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", "shrink-0")} />
          <span>{shiftsSummary.morning}</span>
        </button>

        {/* Tarde */}
        <button
          type="button"
          onClick={(e) => handleToggleLocalShift("afternoon", e)}
          className={cn(
            "flex items-center justify-center rounded-lg font-medium border transition-all select-none cursor-pointer",
            compact ? "gap-0.5 py-0.5 px-0.5 text-[9px] h-5" : "gap-0.5 py-1 px-0.5 text-[10px]",
            selectedLocalShifts.includes("afternoon")
              ? "bg-blue-600 text-white border-blue-700 shadow-xs font-bold ring-1 ring-blue-400"
              : shiftsSummary.afternoon > 0
              ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300/40 hover:bg-blue-500/20 font-semibold"
              : "border-transparent text-muted-foreground/40 hover:bg-muted/40"
          )}
          title={`Tarde: ${shiftsSummary.afternoon} compromisso(s). Clique para filtrar.`}
        >
          <Sunset className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", "shrink-0")} />
          <span>{shiftsSummary.afternoon}</span>
        </button>

        {/* Noite */}
        <button
          type="button"
          onClick={(e) => handleToggleLocalShift("evening", e)}
          className={cn(
            "flex items-center justify-center rounded-lg font-medium border transition-all select-none cursor-pointer",
            compact ? "gap-0.5 py-0.5 px-0.5 text-[9px] h-5" : "gap-0.5 py-1 px-0.5 text-[10px]",
            selectedLocalShifts.includes("evening")
              ? "bg-purple-600 text-white border-purple-700 shadow-xs font-bold ring-1 ring-purple-400"
              : shiftsSummary.evening > 0
              ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300/40 hover:bg-purple-500/20 font-semibold"
              : "border-transparent text-muted-foreground/40 hover:bg-muted/40"
          )}
          title={`Noite: ${shiftsSummary.evening} compromisso(s). Clique para filtrar.`}
        >
          <Moon className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", "shrink-0")} />
          <span>{shiftsSummary.evening}</span>
        </button>
      </div>

      {/* Lista dos compromissos no card semanal */}
      <div
        className={cn(
          "flex-1 overflow-y-auto",
          compact ? "p-1.5 space-y-1 max-h-[120px]" : "p-2 space-y-1.5 max-h-[220px]"
        )}
      >
        {displayedEvents.length === 0 ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center h-full text-center text-muted-foreground/50",
              compact ? "py-3" : "py-8"
            )}
          >
            <p className={cn(compact ? "text-[10px]" : "text-[11px]")}>
              {dayEvents.length > 0 ? "Nenhum no turno selecionado" : "Nenhum horário"}
            </p>
            {selectedLocalShifts.length > 0 && selectedLocalShifts.length < 4 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLocalShifts([]);
                }}
                className="text-[10px] text-primary hover:underline font-semibold mt-1"
              >
                Ver todos ({dayEvents.length})
              </button>
            )}
          </div>
        ) : (
          displayedEvents.map((e) => {
            const typeStyle = eventTypeColors[e.eventType];
            const patient = e.patientId ? patientById.get(e.patientId) : null;
            const displayTitle = e.title || (patient ? patient.name : "Compromisso");
            const tzInfo = getRelativeTimezoneComparison(e.scheduledFor, e.originTimezone);

            return (
              <div
                key={e.id}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onOpenEditModal(e);
                }}
                className={cn(
                  "group/card border text-left transition-all duration-150 hover:shadow-xs hover:border-primary/40",
                  compact ? "p-1.5 rounded-lg text-[10px]" : "p-2 rounded-xl text-xs",
                  e.eventType === "atendimento"
                    ? "bg-primary/[0.04] border-primary/20"
                    : "bg-muted/40 border-border/60"
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="inline-flex items-center gap-1 font-bold text-[11px] text-foreground shrink-0">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                      {e.time}
                    </span>
                    {tzInfo.hasDifference && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700/50 truncate max-w-[65px]"
                        title={tzInfo.tooltip ?? undefined}
                      >
                        <Globe className="h-2 w-2 shrink-0" />
                        {tzInfo.originTime}
                      </span>
                    )}
                  </div>
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
      <div className={cn("border-t border-border/50 mt-auto bg-muted/10", compact ? "p-1.5" : "p-2")}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "w-full font-semibold gap-1 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg",
            compact ? "h-6 text-[10px]" : "h-7 text-[11px]"
          )}
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
  compact = false,
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
      <div
        className={cn(
          "hidden md:grid md:grid-cols-3 lg:grid-cols-7 w-full",
          compact ? "gap-2" : "gap-3"
        )}
      >
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
              compact={compact}
            />
          );
        })}
      </div>
    </div>
  );
});

AgendaWeekView.displayName = "AgendaWeekView";
