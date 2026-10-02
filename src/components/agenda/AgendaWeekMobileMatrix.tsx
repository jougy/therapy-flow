import React, { useMemo, useState, useRef, useCallback } from "react";
import { format, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronDown,
  Plus,
  Clock,
  Sun,
  Sunset,
  Moon,
  CloudMoon,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AgendaPatientOption } from "@/lib/agenda-events";
import {
  type AgendaEventItem,
  type AgendaShift,
  eventTypeColors,
  agendaStatusLabels,
} from "./types";

interface AgendaWeekMobileMatrixProps {
  currentDate: Date;
  weekDays: Date[];
  events: AgendaEventItem[];
  patients: AgendaPatientOption[];
  onSelectDate: (date: Date) => void;
  onNavigateToDay: (date: Date) => void;
  onOpenAddModal: (presetDate?: Date, presetTime?: string) => void;
  onOpenEditModal: (event: AgendaEventItem) => void;
}

interface ShiftDefinition {
  key: AgendaShift;
  label: string;
  rangeLabel: string;
  hours: number[]; // 6 faixas horárias
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeBg: string;
  dotColor: string;
}

const MATRIX_SHIFTS: ShiftDefinition[] = [
  {
    key: "dawn",
    label: "Madrugada",
    rangeLabel: "00:00 – 05:59",
    hours: [0, 1, 2, 3, 4, 5],
    icon: CloudMoon,
    accentColor: "text-indigo-600 dark:text-indigo-400",
    badgeBg: "bg-indigo-500/10 border-indigo-300/40 text-indigo-700 dark:text-indigo-300",
    dotColor: "bg-indigo-500",
  },
  {
    key: "morning",
    label: "Manhã",
    rangeLabel: "07:00 – 12:59",
    hours: [7, 8, 9, 10, 11, 12],
    icon: Sun,
    accentColor: "text-amber-600 dark:text-amber-400",
    badgeBg: "bg-amber-500/10 border-amber-300/40 text-amber-700 dark:text-amber-300",
    dotColor: "bg-amber-500",
  },
  {
    key: "afternoon",
    label: "Tarde",
    rangeLabel: "13:00 – 18:59",
    hours: [13, 14, 15, 16, 17, 18],
    icon: Sunset,
    accentColor: "text-blue-600 dark:text-blue-400",
    badgeBg: "bg-blue-500/10 border-blue-300/40 text-blue-700 dark:text-blue-300",
    dotColor: "bg-blue-500",
  },
  {
    key: "evening",
    label: "Noite",
    rangeLabel: "19:00 – 23:59",
    hours: [19, 20, 21, 22, 23],
    icon: Moon,
    accentColor: "text-purple-600 dark:text-purple-400",
    badgeBg: "bg-purple-500/10 border-purple-300/40 text-purple-700 dark:text-purple-300",
    dotColor: "bg-purple-500",
  },
];

/**
 * Matriz Semanal Compacta Mobile com expansão 6x7, microanimações fluidas e auto-scroll suave.
 */
export const AgendaWeekMobileMatrix: React.FC<AgendaWeekMobileMatrixProps> = React.memo(({
  currentDate,
  weekDays,
  events,
  patients,
  onSelectDate,
  onNavigateToDay,
  onOpenAddModal,
  onOpenEditModal,
}) => {
  const [expandedShift, setExpandedShift] = useState<AgendaShift | null>("morning");
  const containerRef = useRef<HTMLDivElement>(null);
  const shiftRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Mapeamento de paciente por ID
  const patientById = useMemo(() => {
    const map = new Map<string, AgendaPatientOption>();
    for (const p of patients) {
      map.set(p.id, p);
    }
    return map;
  }, [patients]);

  // Indexação rápida: "YYYY-MM-DD" -> Eventos
  const eventsByDayKey = useMemo(() => {
    const map = new Map<string, AgendaEventItem[]>();
    for (const ev of events) {
      const key = format(ev.date, "yyyy-MM-dd");
      const list = map.get(key) || [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  // Contagem de eventos por [shiftKey][dayKey]
  const shiftDayCounts = useMemo(() => {
    const counts: Record<AgendaShift, Record<string, number>> = {
      dawn: {},
      morning: {},
      afternoon: {},
      evening: {},
    };

    for (const shift of MATRIX_SHIFTS) {
      for (const day of weekDays) {
        const dayKey = format(day, "yyyy-MM-dd");
        counts[shift.key][dayKey] = 0;
      }
    }

    for (const ev of events) {
      if (ev.status === "cancelado") continue;
      const dayKey = format(ev.date, "yyyy-MM-dd");
      const hour = parseInt(ev.time.split(":")[0] ?? "0", 10);

      for (const shift of MATRIX_SHIFTS) {
        if (shift.hours.includes(hour)) {
          if (counts[shift.key][dayKey] !== undefined) {
            counts[shift.key][dayKey]++;
          }
          break;
        }
      }
    }

    return counts;
  }, [events, weekDays]);

  // Alternar expansão com auto-scroll suave
  const handleToggleShift = useCallback((shiftKey: AgendaShift) => {
    setExpandedShift((prev) => {
      const next = prev === shiftKey ? null : shiftKey;

      if (next) {
        // Auto-scroll suave para manter a matriz e os dias visíveis no topo
        requestAnimationFrame(() => {
          setTimeout(() => {
            const el = shiftRefs.current[shiftKey] || containerRef.current;
            if (el) {
              const yOffset = -70; // Espaço para topbar/header sticky
              const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
              window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
            }
          }, 60);
        });
      } else {
        // Ao contrair, rola suavemente para o início do container
        requestAnimationFrame(() => {
          if (containerRef.current) {
            const yOffset = -70;
            const y = containerRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
          }
        });
      }

      return next;
    });
  }, []);

  return (
    <div ref={containerRef} className="w-full space-y-2.5">
      {/* Bloco Cabeçalho Fixo da Matriz Semanal (7 Colunas) */}
      <div className="sticky top-14 z-20 rounded-2xl border bg-card/95 p-2 shadow-xs backdrop-blur-md">
        <div className="grid grid-cols-[38px_repeat(7,1fr)] items-center gap-1 text-center">
          {/* Célula Vazia de alinhamento com a coluna de setinhas */}
          <div className="flex items-center justify-center">
            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">
              Per.
            </span>
          </div>

          {/* 7 Dias da Semana (D | S | T | Q | Q | S | S) */}
          {weekDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const isDaySelected = isSameDay(day, currentDate);
            const isDayNow = isToday(day);
            const dayEventsCount = (eventsByDayKey.get(dayKey) || []).length;

            return (
              <motion.button
                key={dayKey}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  onSelectDate(day);
                  onNavigateToDay(day);
                }}
                className={cn(
                  "flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all duration-200 cursor-pointer",
                  isDaySelected
                    ? "bg-primary text-primary-foreground font-bold shadow-xs ring-1 ring-primary/40"
                    : isDayNow
                    ? "bg-primary/10 text-primary font-semibold border border-primary/30"
                    : "hover:bg-muted/60 text-foreground"
                )}
                title={`Ver detalhes de ${format(day, "EEEE, dd 'de' MMMM", { locale: ptBR })}`}
              >
                <span
                  className={cn(
                    "text-[11px] uppercase font-bold leading-none tracking-tight",
                    isDaySelected
                      ? "text-primary-foreground"
                      : isDayNow
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {format(day, "eeeee", { locale: ptBR })}
                </span>
                <span className="text-xs font-bold leading-tight mt-0.5">
                  {format(day, "dd")}
                </span>

                {/* Dot ou contagem rápida */}
                {dayEventsCount > 0 ? (
                  <span
                    className={cn(
                      "mt-0.5 h-1 w-1 rounded-full",
                      isDaySelected ? "bg-primary-foreground" : "bg-primary"
                    )}
                  />
                ) : (
                  <span className="mt-0.5 h-1 w-1 rounded-full bg-transparent" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 4 Linhas de Turnos com Sanfona Lateral e Matriz Expandida 6x7 */}
      <div className="space-y-2">
        {MATRIX_SHIFTS.map((shift) => {
          const isExpanded = expandedShift === shift.key;
          const ShiftIcon = shift.icon;

          // Somatório de atendimentos em toda a semana neste turno
          const weekTotalInShift = Object.values(shiftDayCounts[shift.key]).reduce(
            (acc, curr) => acc + curr,
            0
          );

          return (
            <Card
              key={shift.key}
              ref={(el) => (shiftRefs.current[shift.key] = el)}
              className={cn(
                "overflow-hidden rounded-2xl border transition-all duration-200",
                isExpanded
                  ? "border-primary/50 shadow-sm ring-1 ring-primary/20 bg-card"
                  : "border-border/70 bg-card/70 hover:border-primary/30"
              )}
            >
              {/* Linha Compacta do Turno (Botão Sanfona + 7 Colunas) */}
              <div
                onClick={() => handleToggleShift(shift.key)}
                className={cn(
                  "grid grid-cols-[38px_repeat(7,1fr)] items-center gap-1 p-2 cursor-pointer transition-colors select-none",
                  isExpanded ? "bg-muted/30 border-b border-border/50" : "hover:bg-muted/20"
                )}
              >
                {/* Botão Sanfona / Ícone do Turno */}
                <div className="flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg border",
                      isExpanded
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border/60 hover:text-foreground"
                    )}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.div>
                </div>

                {/* 7 Células com contagem de agendamentos de cada dia */}
                {weekDays.map((day) => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const count = shiftDayCounts[shift.key][dayKey] || 0;
                  const isDaySelected = isSameDay(day, currentDate);

                  return (
                    <div
                      key={dayKey}
                      className={cn(
                        "flex items-center justify-center h-8 rounded-lg text-center transition-all",
                        isDaySelected && "bg-primary/5"
                      )}
                    >
                      {count > 0 ? (
                        <motion.span
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className={cn(
                            "inline-flex h-6 min-w-6 px-1.5 items-center justify-center rounded-full text-[11px] font-bold border shadow-xs",
                            shift.badgeBg
                          )}
                        >
                          {count}
                        </motion.span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/30 font-medium">
                          —
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Cabeçalho de Identificação do Turno na Linha */}
              <div className="px-3 py-1.5 flex items-center justify-between bg-muted/10 text-[11px] border-b border-border/30">
                <div className="flex items-center gap-1.5">
                  <ShiftIcon className={cn("h-3.5 w-3.5", shift.accentColor)} />
                  <span className="font-semibold text-foreground">{shift.label}</span>
                  <span className="text-muted-foreground/70 text-[10px]">({shift.rangeLabel})</span>
                </div>

                {weekTotalInShift > 0 ? (
                  <Badge variant="secondary" className="h-4 text-[9px] px-1 font-bold">
                    {weekTotalInShift} agendamento(s)
                  </Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground/50">Nenhum</span>
                )}
              </div>

              {/* Área Expandida: A Matriz 6x7 de Horários do Turno */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="p-2 space-y-1 bg-background/50">
                      {shift.hours.map((hour) => {
                        const hourLabel = `${String(hour).padStart(2, "0")}:00`;

                        return (
                          <div
                            key={hour}
                            className="grid grid-cols-[38px_repeat(7,1fr)] items-stretch gap-1 rounded-xl border border-border/40 bg-card p-1 shadow-xs hover:border-primary/20 transition-all"
                          >
                            {/* Faixa Horária (ex: 08h) */}
                            <div className="flex flex-col items-center justify-center rounded-lg bg-muted/40 p-0.5 text-center">
                              <span className="text-[10px] font-bold text-foreground leading-tight">
                                {String(hour).padStart(2, "0")}h
                              </span>
                            </div>

                            {/* Células dos 7 Dias para esta Hora Específica */}
                            {weekDays.map((day) => {
                              const dayKey = format(day, "yyyy-MM-dd");
                              const isDaySelected = isSameDay(day, currentDate);
                              const dayEvents = eventsByDayKey.get(dayKey) || [];

                              // Filtrar eventos nesta hora cheia (ex: 08:00 até 08:59)
                              const cellEvents = dayEvents.filter((ev) => {
                                const evHour = parseInt(ev.time.split(":")[0] ?? "0", 10);
                                return evHour === hour;
                              });

                              return (
                                <div
                                  key={dayKey}
                                  className={cn(
                                    "flex flex-col min-h-[38px] p-0.5 rounded-lg border border-transparent transition-all",
                                    isDaySelected && "bg-primary/[0.03]",
                                    cellEvents.length > 0
                                      ? "bg-muted/30 border-border/60"
                                      : "hover:bg-muted/20"
                                  )}
                                >
                                  {cellEvents.length === 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => onOpenAddModal(day, hourLabel)}
                                      className="flex-1 w-full flex items-center justify-center rounded-md opacity-20 hover:opacity-100 hover:bg-primary/10 hover:text-primary transition-all text-muted-foreground group"
                                      title={`Agendar ${hourLabel} em ${format(day, "dd/MM")}`}
                                    >
                                      <Plus className="h-3 w-3 group-hover:scale-110 transition-transform" />
                                    </button>
                                  ) : (
                                    <div className="flex-1 flex flex-col gap-0.5 justify-center">
                                      {cellEvents.map((ev) => {
                                        const typeStyle = eventTypeColors[ev.eventType];
                                        const patient = ev.patientId ? patientById.get(ev.patientId) : null;
                                        const title = ev.title || (patient ? patient.name : "Agendamento");

                                        return (
                                          <motion.button
                                            key={ev.id}
                                            type="button"
                                            whileTap={{ scale: 0.94 }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onOpenEditModal(ev);
                                            }}
                                            className={cn(
                                              "w-full text-left rounded-md px-1 py-0.5 text-[9px] font-semibold truncate border leading-tight transition-all shadow-xs",
                                              ev.eventType === "atendimento"
                                                ? "bg-primary/15 text-primary border-primary/30"
                                                : "bg-muted/80 text-foreground border-border/80"
                                            )}
                                            title={`${ev.time} - ${title} (${agendaStatusLabels[ev.status]})`}
                                          >
                                            <div className="flex items-center gap-0.5 truncate">
                                              <span className={cn("h-1 w-1 rounded-full shrink-0", typeStyle.dot)} />
                                              <span className="truncate">{title}</span>
                                            </div>
                                          </motion.button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>
    </div>
  );
});

AgendaWeekMobileMatrix.displayName = "AgendaWeekMobileMatrix";
