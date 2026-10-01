import type { AgendaEventItem } from "@/lib/agenda-events";

/**
 * Representa os 4 turnos clínicos do dia (Madrugada, Manhã, Tarde, Noite).
 */
export type AgendaTurn = "dawn" | "morning" | "afternoon" | "night";

/**
 * Spanning interperíodo: indica se um evento invade múltiplos turnos.
 */
export interface AgendaSlotSpanningInfo {
  isSpanning: boolean;
  startsBeforeTurn: boolean;
  endsAfterTurn: boolean;
  spanLabel?: string;
}

/**
 * Slot livre condensado representando um intervalo de tempo contíguo disponível para agendamento.
 */
export interface AgendaCondensedFreeSlot {
  type: "free";
  startTime: string;
  endTime: string;
  durationMinutes: number;
  label: string;
}

/**
 * Slot ocupado representando um compromisso clínico agendado.
 */
export interface AgendaCondensedOccupiedSlot {
  type: "occupied";
  startTime: string;
  endTime: string;
  durationMinutes: number;
  event: AgendaEventItem;
  label: string;
  spanning?: AgendaSlotSpanningInfo;
}

/**
 * União discriminada dos slots calculados na visão condensada da agenda.
 */
export type AgendaCondensedSlot = AgendaCondensedFreeSlot | AgendaCondensedOccupiedSlot;

/**
 * Configuração dos limites de minutos e horários de um turno clínico.
 */
export interface TurnBoundaryConfig {
  turn: AgendaTurn;
  startMinute: number;
  endMinute: number;
  startTime: string;
  endTime: string;
}

/**
 * Limites operacionais dos 4 turnos equilibrados (4 blocos de ~6h59 cobrindo 24 horas contínuas):
 * - Madrugada: 00:00 às 06:59 (0 a 419 min) -> 420 min
 * - Manhã: 07:00 às 12:59 (420 a 779 min) -> 360 min
 * - Tarde: 13:00 às 18:59 (780 a 1139 min) -> 360 min
 * - Noite: 19:00 às 23:59 (1140 a 1439 min) -> 300 min
 */
export const TURN_BOUNDARIES: Record<AgendaTurn, TurnBoundaryConfig> = {
  dawn: {
    turn: "dawn",
    startMinute: 0,
    endMinute: 419,
    startTime: "00:00",
    endTime: "06:59",
  },
  morning: {
    turn: "morning",
    startMinute: 420,
    endMinute: 779,
    startTime: "07:00",
    endTime: "12:59",
  },
  afternoon: {
    turn: "afternoon",
    startMinute: 780,
    endMinute: 1139,
    startTime: "13:00",
    endTime: "18:59",
  },
  night: {
    turn: "night",
    startMinute: 1140,
    endMinute: 1439,
    startTime: "19:00",
    endTime: "23:59",
  },
};

/**
 * Converte um offset em minutos (a partir da meia-noite) em string formatada "HH:mm".
 *
 * @param minute Offset em minutos (suporta valores negativos ou que ultrapassem 1440).
 * @returns Horário no formato "HH:mm".
 */
export const minuteToTimeString = (minute: number): string => {
  const normalized = ((Math.floor(minute) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

/**
 * Formata uma duração em minutos para formato amigável ao usuário ("1h 30min", "50min", etc.).
 *
 * @param minutes Duração em minutos.
 * @returns Texto formatado legível.
 */
export const formatSlotDuration = (minutes: number): string => {
  const totalMins = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(totalMins / 60);
  const remainingMinutes = totalMins % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}min`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${remainingMinutes}min`;
};

/**
 * Formata o rótulo do slot livre ("Xh Ymin livre").
 *
 * @param minutes Quantidade de minutos livres.
 * @returns Rótulo formatado.
 */
export const formatFreeSlotLabel = (minutes: number): string => {
  return `${formatSlotDuration(minutes)} livre`;
};

interface EventWithMinutes {
  event: AgendaEventItem;
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
}

const TIME_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const resolveEventMinutes = (ev: AgendaEventItem, baseDayStart: Date): EventWithMinutes => {
  let eventDate: Date;
  if (ev.date instanceof Date && !Number.isNaN(ev.date.getTime())) {
    eventDate = new Date(ev.date.getFullYear(), ev.date.getMonth(), ev.date.getDate());
  } else if (ev.scheduledFor) {
    const d = new Date(ev.scheduledFor);
    if (!Number.isNaN(d.getTime())) {
      eventDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    } else {
      eventDate = new Date(baseDayStart);
    }
  } else {
    eventDate = new Date(baseDayStart);
  }

  let hours = 0;
  let minutes = 0;
  if (ev.time && TIME_REGEX.test(ev.time.trim())) {
    const parts = ev.time.trim().split(":").map(Number);
    hours = Number.isFinite(parts[0]) ? Math.max(0, Math.min(23, parts[0])) : 0;
    minutes = Number.isFinite(parts[1]) ? Math.max(0, Math.min(59, parts[1])) : 0;
  } else if (ev.scheduledFor) {
    const d = new Date(ev.scheduledFor);
    if (!Number.isNaN(d.getTime())) {
      hours = d.getHours();
      minutes = d.getMinutes();
    }
  }

  const baseTime = Number.isNaN(baseDayStart.getTime()) ? 0 : baseDayStart.getTime();
  const eventTime = Number.isNaN(eventDate.getTime()) ? baseTime : eventDate.getTime();
  const dayDiff = Math.round((eventTime - baseTime) / (24 * 3600_000));
  const startMinute = dayDiff * 1440 + hours * 60 + minutes;

  // Clamped strictly to [1, 1440] minutes conforme constraint do Supabase
  const durationMinutes =
    typeof ev.durationMinutes === "number" &&
    Number.isFinite(ev.durationMinutes) &&
    ev.durationMinutes > 0 &&
    ev.durationMinutes <= 1440
      ? Math.round(ev.durationMinutes)
      : 60;

  const endMinute = startMinute + durationMinutes;

  return {
    event: ev,
    startMinute,
    endMinute,
    durationMinutes,
  };
};

/**
 * Motor de condensação de slots da agenda.
 * Função pura e determinística com complexidade O(N log N) onde N é o número de eventos.
 *
 * Intercala slots ocupados (com evento) e blocos condensados contíguos de horário livre.
 */
export const condenseAgendaTurnSlots = (
  events: AgendaEventItem[],
  turn: AgendaTurn,
  day: Date
): AgendaCondensedSlot[] => {
  const boundary = TURN_BOUNDARIES[turn];
  if (!boundary) {
    return [];
  }

  const baseDayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);

  // 1. Filtrar eventos ativos que colidem com a janela do turno (O(N))
  const relevantEvents: EventWithMinutes[] = [];
  for (const ev of events) {
    if (ev.status === "cancelado") {
      continue;
    }

    const resolved = resolveEventMinutes(ev, baseDayStart);
    // Verifica colisão com a janela do turno
    if (resolved.startMinute < boundary.endMinute && resolved.endMinute > boundary.startMinute) {
      relevantEvents.push(resolved);
    }
  }

  // 2. Ordenar cronologicamente O(N log N)
  relevantEvents.sort((a, b) => {
    if (a.startMinute !== b.startMinute) {
      return a.startMinute - b.startMinute;
    }
    return a.endMinute - b.endMinute;
  });

  const slots: AgendaCondensedSlot[] = [];
  let currentMinute = boundary.startMinute;

  // 3. Iterar e intercalar slots livres e ocupados O(N)
  for (const item of relevantEvents) {
    const effectiveStart = Math.max(boundary.startMinute, item.startMinute);

    // Se houver lacuna entre o ponteiro atual e o início do evento, gerar slot livre condensado
    if (effectiveStart > currentMinute) {
      const freeDuration = effectiveStart - currentMinute;
      if (freeDuration > 0) {
        slots.push({
          type: "free",
          startTime: minuteToTimeString(currentMinute),
          endTime: minuteToTimeString(effectiveStart),
          durationMinutes: freeDuration,
          label: formatFreeSlotLabel(freeDuration),
        });
      }
    }

    // Determinar se o evento invade outros turnos (spanning interperíodo)
    const startsBeforeTurn = item.startMinute < boundary.startMinute;
    const endsAfterTurn = item.endMinute > boundary.endMinute;
    const isSpanning = startsBeforeTurn || endsAfterTurn;

    let spanLabel: string | undefined;
    if (startsBeforeTurn && endsAfterTurn) {
      spanLabel = `Inicia antes (${item.event.time || minuteToTimeString(item.startMinute)}) e continua após`;
    } else if (startsBeforeTurn) {
      spanLabel = `Inicia no período anterior (${item.event.time || minuteToTimeString(item.startMinute)})`;
    } else if (endsAfterTurn) {
      spanLabel = `Continua no próximo período (término às ${minuteToTimeString(item.endMinute)})`;
    }

    // Adicionar slot ocupado pelo evento com metadados de spanning
    slots.push({
      type: "occupied",
      startTime: item.event.time || minuteToTimeString(item.startMinute),
      endTime: minuteToTimeString(item.endMinute),
      durationMinutes: item.durationMinutes,
      event: item.event,
      label: item.event.title,
      spanning: isSpanning
        ? {
            isSpanning,
            startsBeforeTurn,
            endsAfterTurn,
            spanLabel,
          }
        : undefined,
    });

    // Avançar o ponteiro para o final deste evento (sem retroceder em caso de sobreposição)
    currentMinute = Math.max(currentMinute, item.endMinute);
  }

  // 4. Se restar tempo livre após o último evento até o término do turno
  if (currentMinute < boundary.endMinute) {
    const trailingDuration = boundary.endMinute - currentMinute;
    if (trailingDuration > 0) {
      slots.push({
        type: "free",
        startTime: minuteToTimeString(currentMinute),
        endTime: boundary.endTime,
        durationMinutes: trailingDuration,
        label: formatFreeSlotLabel(trailingDuration),
      });
    }
  }

  return slots;
};

/**
 * Conflito detectado entre dois agendamentos.
 */
export interface AgendaConflictInfo {
  conflictingEvent: AgendaEventItem;
  event: AgendaEventItem;
  existingStart: string;
  existingEnd: string;
  endTime: string;
  overlapMinutes: number;
}

/**
 * Localiza todos os agendamentos existentes que colidem com um novo horário pretendido.
 * Algoritmo puro com complexidade O(N).
 *
 * @param targetDate Data pretendida do agendamento (aceita também alias `date`)
 * @param targetStartTime Horário inicial pretendido ("HH:mm") (aceita também alias `startTime`)
 * @param targetDurationMinutes Duração pretendida em minutos (aceita também alias `durationMinutes`)
 * @param existingEvents Lista de eventos existentes da clínica
 * @param ignoreEventId ID opcional a ignorar (aceita também alias `excludeEventId`)
 * @returns Lista de conflitos detectados
 */
export const findConflictingAgendaEvents = (params: {
  targetDate?: Date;
  date?: Date;
  targetStartTime?: string;
  startTime?: string;
  targetDurationMinutes?: number;
  durationMinutes?: number;
  existingEvents: AgendaEventItem[];
  ignoreEventId?: string | null;
  excludeEventId?: string | null;
}): AgendaConflictInfo[] => {
  const targetDate = params.targetDate || params.date || new Date();
  const targetStartTime = params.targetStartTime || params.startTime || "";
  const targetDurationMinutes = params.targetDurationMinutes ?? params.durationMinutes ?? 50;
  const existingEvents = params.existingEvents || [];
  const ignoreId = params.ignoreEventId ?? params.excludeEventId ?? null;

  if (!targetStartTime || !TIME_REGEX.test(targetStartTime.trim())) {
    return [];
  }

  const baseDayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
  const [targetH, targetM] = targetStartTime.trim().split(":").map(Number);
  const targetStartMinute = targetH * 60 + targetM;
  const targetEndMinute = targetStartMinute + Math.max(1, targetDurationMinutes);

  const conflicts: AgendaConflictInfo[] = [];

  for (const ev of existingEvents) {
    if (ev.status === "cancelado") {
      continue;
    }
    if (ignoreId && ev.id === ignoreId) {
      continue;
    }

    const resolved = resolveEventMinutes(ev, baseDayStart);

    // Considera sobreposição na linha contínua em minutos
    const overlapStart = Math.max(targetStartMinute, resolved.startMinute);
    const overlapEnd = Math.min(targetEndMinute, resolved.endMinute);

    if (overlapEnd > overlapStart) {
      const overlapMinutes = overlapEnd - overlapStart;
      const startStr = ev.time || minuteToTimeString(resolved.startMinute);
      const endStr = minuteToTimeString(resolved.endMinute);

      conflicts.push({
        conflictingEvent: ev,
        event: ev,
        existingStart: startStr,
        existingEnd: endStr,
        endTime: endStr,
        overlapMinutes,
      });
    }
  }

  return conflicts;
};
