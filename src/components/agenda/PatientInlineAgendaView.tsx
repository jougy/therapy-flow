import React, { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sun,
  Sunset,
  Moon,
  CloudMoon,
  Clock,
  Plus,
  Play,
  User,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgendaPatientOption } from "@/lib/agenda-events";
import {
  type AgendaEventItem,
  type AgendaShift,
  getEventShift,
  agendaStatusLabels,
  statusBadgeStyles,
  eventTypeColors,
  eventTypeLabels,
} from "./types";
import {
  AgendaWeekView,
  AgendaMonthView,
  AgendaYearView,
} from "@/components/agenda";

interface PatientInlineAgendaViewProps {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  viewMode: "day" | "week" | "month" | "year";
  events: AgendaEventItem[];
  currentPatientId: string;
  patients: AgendaPatientOption[];
  onOpenEventDetails: (event: AgendaEventItem) => void;
  onOpenAddModal: (presetDate?: Date, presetTime?: string) => void;
  onStartAttendance?: (event: AgendaEventItem) => void;
  canStartAttendance?: boolean;
}

const SHIFT_METADATA: Record<
  AgendaShift,
  { label: string; range: string; icon: React.ComponentType<{ className?: string }> }
> = {
  dawn: { label: "Madrugada", range: "00:00 – 06:59", icon: CloudMoon },
  morning: { label: "Manhã", range: "07:00 – 12:59", icon: Sun },
  afternoon: { label: "Tarde", range: "13:00 – 18:59", icon: Sunset },
  evening: { label: "Noite", range: "19:00 – 23:59", icon: Moon },
};

const SHIFTS_ORDER: readonly AgendaShift[] = [
  "dawn",
  "morning",
  "afternoon",
  "evening",
] as const;

/**
 * Visualização da agenda interna da ficha do paciente.
 * - Modo Dia: esconde períodos vazios por padrão; distribui turnos ativos em colunas retráteis/compactas.
 * - Destaque visual expressivo para agendamentos do paciente atual.
 * - Suporta semana, mês e ano em modo compacto.
 */
export const PatientInlineAgendaView: React.FC<PatientInlineAgendaViewProps> = React.memo(({
  currentDate,
  onSelectDate,
  viewMode,
  events,
  currentPatientId,
  patients,
  onOpenEventDetails,
  onOpenAddModal,
  onStartAttendance,
  canStartAttendance = true,
}) => {
  // Eventos do dia atual
  const dayEvents = useMemo(() => {
    return events
      .filter((ev) => isSameDay(ev.date, currentDate))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [events, currentDate]);

  // Agrupamento por turnos (apenas turnos que tiverem eventos)
  const activeShiftsWithEvents = useMemo(() => {
    const map: Record<AgendaShift, AgendaEventItem[]> = {
      dawn: [],
      morning: [],
      afternoon: [],
      evening: [],
    };

    for (const ev of dayEvents) {
      const shift = getEventShift(ev.time);
      map[shift].push(ev);
    }

    return SHIFTS_ORDER.map((shiftKey) => ({
      shiftKey,
      meta: SHIFT_METADATA[shiftKey],
      events: map[shiftKey],
    })).filter((group) => group.events.length > 0);
  }, [dayEvents]);

  // Se estiver no modo Semana, Mês ou Ano
  if (viewMode === "week") {
    return (
      <div className="max-h-[300px] overflow-y-auto pr-1">
        <AgendaWeekView
          currentDate={currentDate}
          onSelectDate={onSelectDate}
          onNavigateToDay={(d) => onSelectDate(d)}
          events={events}
          patients={patients}
          onOpenAddModal={onOpenAddModal}
          onOpenEditModal={onOpenEventDetails}
        />
      </div>
    );
  }

  if (viewMode === "month") {
    return (
      <div className="max-h-[320px] overflow-y-auto pr-1">
        <AgendaMonthView
          currentDate={currentDate}
          onSelectDate={onSelectDate}
          events={events}
          patients={patients}
          onOpenAddModal={onOpenAddModal}
          onOpenEditModal={onOpenEventDetails}
          onNavigateToDay={(d) => onSelectDate(d)}
        />
      </div>
    );
  }

  if (viewMode === "year") {
    return (
      <div className="max-h-[340px] overflow-y-auto pr-1">
        <AgendaYearView
          currentDate={currentDate}
          onSelectDate={onSelectDate}
          onNavigateToView={(_, targetDate) => onSelectDate(targetDate)}
          events={events}
        />
      </div>
    );
  }

  // --- Modo Dia (Padrão e Cirúrgico) ---
  if (dayEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 px-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 text-center">
        <CalendarDays className="h-6 w-6 text-muted-foreground/60 mb-1.5" />
        <p className="text-xs font-semibold text-foreground">Sem eventos</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Nenhum agendamento programado para {format(currentDate, "dd 'de' MMMM", { locale: ptBR })}.
        </p>
      </div>
    );
  }

  return (
    <div
      data-tutorial="agenda-events-list"
      className={cn(
        "grid gap-2.5 max-h-[220px] overflow-y-auto pr-1 select-none",
        activeShiftsWithEvents.length === 1 && "grid-cols-1",
        activeShiftsWithEvents.length === 2 && "grid-cols-1 sm:grid-cols-2",
        activeShiftsWithEvents.length === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        activeShiftsWithEvents.length >= 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      )}
    >
      {activeShiftsWithEvents.map(({ shiftKey, meta, events: shiftEvents }) => {
        const Icon = meta.icon;

        return (
          <div
            key={shiftKey}
            className="flex flex-col rounded-xl border border-border/70 bg-card/60 p-2 sm:p-2.5 shadow-2xs space-y-1.5 min-w-0"
          >
            {/* Cabeçalho do Período */}
            <div className="flex items-center justify-between pb-1 border-b border-border/40">
              <div className="flex items-center gap-1.5 min-w-0">
                <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs font-bold text-foreground truncate">{meta.label}</span>
                <span className="text-[10px] text-muted-foreground hidden xl:inline">
                  ({meta.range})
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold">
                {shiftEvents.length}
              </Badge>
            </div>

            {/* Lista de eventos do período */}
            <div className="space-y-1.5 overflow-y-auto max-h-[160px] pr-0.5">
              {shiftEvents.map((event) => {
                const isThisPatient = event.patientId === currentPatientId;
                const statusStyle = statusBadgeStyles[event.status] || "";
                const statusLabel = agendaStatusLabels[event.status] || event.status;
                const typeLabel = eventTypeLabels[event.eventType] || event.eventType;

                return (
                  <div
                    key={event.id}
                    data-tutorial="agenda-event-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenEventDetails(event)}
                    onPointerUp={(pointerEvent) => {
                      if (pointerEvent.pointerType === "touch") {
                        onOpenEventDetails(event);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenEventDetails(event);
                      }
                    }}
                    className={cn(
                      "group relative flex flex-col gap-1 rounded-lg p-2 text-xs transition-all duration-150 cursor-pointer border",
                      isThisPatient
                        ? "bg-primary/5 hover:bg-primary/10 border-primary/40 ring-1 ring-primary/20 shadow-2xs"
                        : "bg-muted/30 hover:bg-muted/60 border-border/50 opacity-80 hover:opacity-100"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <span className="flex items-center gap-1 font-bold text-foreground shrink-0">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {event.time}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        {isThisPatient ? (
                          <Badge
                            variant="default"
                            className="text-[9px] px-1.5 py-0 h-4 bg-primary text-primary-foreground font-semibold"
                          >
                            Este paciente
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 h-4 text-muted-foreground bg-muted/40 font-normal"
                          >
                            Outro
                          </Badge>
                        )}

                        <Badge
                          variant="outline"
                          className={cn("text-[9px] px-1 py-0 h-4 capitalize shrink-0", statusStyle || "bg-warning/15 text-warning border-warning/20")}
                        >
                          {statusLabel}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span
                        className={cn(
                          "truncate font-medium min-w-0 flex-1",
                          isThisPatient ? "text-foreground font-semibold" : "text-muted-foreground"
                        )}
                        title={event.title}
                      >
                        {event.title}
                      </span>

                      {/* Botão de Iniciar Atendimento se for deste paciente */}
                      {isThisPatient && canStartAttendance && onStartAttendance && (
                        <button
                          type="button"
                          onPointerUp={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartAttendance(event);
                          }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors shrink-0"
                          title="Iniciar atendimento a partir deste agendamento"
                        >
                          <Play className="h-2.5 w-2.5 fill-current" />
                          <span>Atender</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});

PatientInlineAgendaView.displayName = "PatientInlineAgendaView";
