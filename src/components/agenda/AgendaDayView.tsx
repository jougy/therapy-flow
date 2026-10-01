import React, { useMemo } from "react";
import { isSameDay } from "date-fns";
import {
  Sun,
  Sunset,
  Moon,
  CloudMoon,
  Clock,
  User,
  Plus,
  ArrowRightLeft,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgendaPatientOption } from "@/lib/agenda-events";
import {
  type AgendaEventItem,
  type AgendaShift,
  getEventShift,
  SHIFT_CONFIG,
  agendaStatusLabels,
  statusBadgeStyles,
  eventTypeColors,
  eventTypeLabels,
} from "./types";
import {
  condenseAgendaTurnSlots,
  type AgendaTurn,
  type AgendaCondensedSlot,
  type AgendaCondensedOccupiedSlot,
} from "@/lib/agenda-slot-condenser";

interface AgendaDayViewProps {
  currentDate: Date;
  events: AgendaEventItem[];
  patients: AgendaPatientOption[];
  onOpenAddModal: (presetDate?: Date, presetTime?: string) => void;
  onOpenEditModal: (event: AgendaEventItem) => void;
}

const SHIFT_ICONS: Record<AgendaShift, React.ComponentType<{ className?: string }>> = {
  dawn: CloudMoon,
  morning: Sun,
  afternoon: Sunset,
  evening: Moon,
};

const SHIFT_TO_TURN: Record<AgendaShift, AgendaTurn> = {
  dawn: "dawn",
  morning: "morning",
  afternoon: "afternoon",
  evening: "night",
};

const AGENDA_SHIFTS: readonly AgendaShift[] = ["dawn", "morning", "afternoon", "evening"] as const;

/**
 * Card modular para exibição de um agendamento ocupado no turno do dia,
 * com indicação de horário de início e fim, duração e badge contextual se invadir outros turnos.
 */
const AgendaOccupiedSlotCard = React.memo<{
  slot: AgendaCondensedOccupiedSlot;
  patient: AgendaPatientOption | null;
  onOpenEditModal: (event: AgendaEventItem) => void;
}>(({ slot, patient, onOpenEditModal }) => {
  const event = slot.event;
  const typeStyle = eventTypeColors[event.eventType];
  const isSpanning = Boolean(slot.spanning?.isSpanning);

  return (
    <Card
      onClick={() => onOpenEditModal(event)}
      className={cn(
        "cursor-pointer border-l-4 transition-all duration-150 hover:shadow-md bg-card/90",
        event.eventType === "atendimento"
          ? "border-l-primary hover:border-l-primary"
          : event.eventType === "reuniao"
          ? "border-l-indigo-500 hover:border-l-indigo-500"
          : "border-l-violet-500 hover:border-l-violet-500"
      )}
    >
      <CardContent className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Horário com Início e Fim */}
          <div className="flex flex-col items-center justify-center rounded-xl bg-muted/60 px-2.5 py-1.5 min-w-[76px] text-center shrink-0 border border-border/40">
            <Clock className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
            <span className="text-xs font-bold text-foreground leading-tight">
              {event.time} – {slot.endTime}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              {slot.durationMinutes} min
            </span>
          </div>

          {/* Detalhes do compromisso */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground truncate">
                {event.title}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0 capitalize",
                  statusBadgeStyles[event.status]
                )}
              >
                {agendaStatusLabels[event.status]}
              </Badge>

              {/* Tag contextual caso o evento invada múltiplos períodos */}
              {isSpanning && slot.spanning?.spanLabel && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0 border-indigo-300 dark:border-indigo-700 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium inline-flex items-center gap-1"
                  title="Este compromisso ultrapassa o limite do turno"
                >
                  <ArrowRightLeft className="h-2.5 w-2.5" />
                  {slot.spanning.spanLabel}
                </Badge>
              )}
            </div>

            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className={cn("h-1.5 w-1.5 rounded-full", typeStyle.dot)} />
                {eventTypeLabels[event.eventType]}
              </span>
              {patient && (
                <span className="inline-flex items-center gap-1 truncate font-medium">
                  <User className="h-3 w-3" />
                  {patient.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Botão de Ação */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/5"
            onClick={(e) => {
              e.stopPropagation();
              onOpenEditModal(event);
            }}
          >
            Editar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

AgendaOccupiedSlotCard.displayName = "AgendaOccupiedSlotCard";

/**
 * Linha de slot condensado livre, permitindo agendamento direto com um clique.
 */
const AgendaFreeSlotRow = React.memo<{
  startTime: string;
  endTime: string;
  label: string;
  currentDate: Date;
  onOpenAddModal: (presetDate?: Date, presetTime?: string) => void;
}>(({ startTime, endTime, label, currentDate, onOpenAddModal }) => {
  return (
    <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl border border-dashed border-border/70 bg-muted/15 hover:bg-primary/[0.03] hover:border-primary/40 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-foreground">
          {startTime} – {endTime}
        </span>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 bg-background/80 border-border text-muted-foreground"
        >
          {label}
        </Badge>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1 font-semibold text-primary hover:text-primary hover:bg-primary/10 rounded-lg"
        onClick={() => onOpenAddModal(currentDate, startTime)}
      >
        <Plus className="h-3.5 w-3.5" />
        Agendar
      </Button>
    </div>
  );
});

AgendaFreeSlotRow.displayName = "AgendaFreeSlotRow";

/**
 * Visão diária com 3 turnos (Manhã, Tarde, Noite) em acordeão com slots condensados.
 * Totalmente memoizada para evitar re-renderizações desnecessárias.
 */
export const AgendaDayView = React.memo<AgendaDayViewProps>(({
  currentDate,
  events,
  patients,
  onOpenAddModal,
  onOpenEditModal,
}) => {
  // Filtrar eventos do dia selecionado
  const dayEvents = useMemo(() => {
    return events
      .filter((ev) => isSameDay(ev.date, currentDate))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [events, currentDate]);

  // Contagem de eventos por turno (4 turnos)
  const eventsCountByShift = useMemo(() => {
    const map: Record<AgendaShift, number> = {
      dawn: 0,
      morning: 0,
      afternoon: 0,
      evening: 0,
    };

    for (const ev of dayEvents) {
      const shift = getEventShift(ev.time);
      map[shift]++;
    }

    return map;
  }, [dayEvents]);

  // Slots condensados (livres contíguos e ocupados) calculados pelo motor de condensação
  const condensedSlotsByShift = useMemo(() => {
    const map: Record<AgendaShift, AgendaCondensedSlot[]> = {
      dawn: condenseAgendaTurnSlots(dayEvents, SHIFT_TO_TURN.dawn, currentDate),
      morning: condenseAgendaTurnSlots(dayEvents, SHIFT_TO_TURN.morning, currentDate),
      afternoon: condenseAgendaTurnSlots(dayEvents, SHIFT_TO_TURN.afternoon, currentDate),
      evening: condenseAgendaTurnSlots(dayEvents, SHIFT_TO_TURN.evening, currentDate),
    };

    return map;
  }, [dayEvents, currentDate]);

  // Mapeamento de paciente por ID para pesquisa O(1)
  const patientById = useMemo(() => {
    const map = new Map<string, AgendaPatientOption>();
    for (const p of patients) {
      map.set(p.id, p);
    }
    return map;
  }, [patients]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <Accordion
        type="multiple"
        defaultValue={["morning", "afternoon", "evening"]}
        className="space-y-4"
      >
        {AGENDA_SHIFTS.map((shiftKey) => {
          const config = SHIFT_CONFIG[shiftKey];
          const shiftSlots = condensedSlotsByShift[shiftKey];
          const shiftEventsCount = eventsCountByShift[shiftKey];
          const Icon = SHIFT_ICONS[shiftKey];
          const hasEvents = shiftEventsCount > 0;

          return (
            <AccordionItem
              key={shiftKey}
              value={shiftKey}
              className="rounded-2xl border bg-card shadow-xs overflow-hidden border-border/80"
            >
              {/* Cabeçalho do Acordeão */}
              <AccordionTrigger className="px-4 py-3 sm:px-5 hover:no-underline hover:bg-muted/30 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-3 w-full pr-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-muted/60 border border-border/50">
                      <Icon className="h-4 w-4 text-foreground" />
                    </div>

                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {config.label}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-2 py-0 font-medium", config.badgeStyle)}
                        >
                          {config.rangeLabel}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs px-2.5 py-0.5 rounded-full font-semibold",
                        hasEvents ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {shiftEventsCount}{" "}
                      {shiftEventsCount === 1 ? "compromisso" : "compromissos"}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>

              {/* Conteúdo do Turno: Intercalando slots condensados livres e ocupados */}
              <AccordionContent className="px-4 pb-4 sm:px-5 pt-1 space-y-2.5">
                {shiftSlots.length === 0 ? (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-dashed bg-muted/10 text-muted-foreground text-xs">
                    <span>Nenhum compromisso marcado para este turno.</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 rounded-lg"
                      onClick={() =>
                        onOpenAddModal(
                          currentDate,
                          `${String(config.hours[0] || 0).padStart(2, "0")}:00`
                        )
                      }
                    >
                      <Plus className="h-3 w-3" />
                      Agendar
                    </Button>
                  </div>
                ) : (
                  shiftSlots.map((slot, index) => {
                    if (slot.type === "occupied") {
                      const ev = slot.event;
                      const patient = ev.patientId ? patientById.get(ev.patientId) || null : null;

                      return (
                        <AgendaOccupiedSlotCard
                          key={`${ev.id}-${shiftKey}`}
                          slot={slot}
                          patient={patient}
                          onOpenEditModal={onOpenEditModal}
                        />
                      );
                    }

                    return (
                      <AgendaFreeSlotRow
                        key={`free-${slot.startTime}-${slot.endTime}-${index}`}
                        startTime={slot.startTime}
                        endTime={slot.endTime}
                        label={slot.label}
                        currentDate={currentDate}
                        onOpenAddModal={onOpenAddModal}
                      />
                    );
                  })
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
});

AgendaDayView.displayName = "AgendaDayView";
