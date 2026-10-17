import { useCallback, useState } from "react";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  formatSupabaseErrorMessage,
  isValidTimeString,
  normalizeAgendaStatus,
  normalizeEventDurationMinutes,
  notifyAgendaEventsUpdated,
  type AgendaEventStatus,
  type AgendaEventType,
} from "@/lib/agenda-events";
import { INPUT_LIMITS, sanitizeSingleLineInput } from "@/lib/input-security";
import type { AgendaEventItem, AgendaViewMode, CopiedPeriodState } from "@/components/agenda";

export type { CopiedPeriodState };

const VALID_EVENT_TYPES = new Set<AgendaEventType>(["atendimento", "reuniao", "evento"]);

export interface AgendaEventDbRow {
  id: string;
  clinic_id?: string | null;
  user_id?: string;
  patient_id: string | null;
  title: string;
  event_type: string;
  scheduled_for: string;
  status: string | null;
  duration_minutes?: number | null;
}

export interface AgendaEventInsertPayload {
  clinic_id: string | null;
  user_id: string;
  patient_id: string | null;
  title: string;
  event_type: AgendaEventType;
  scheduled_for: string;
  status: AgendaEventStatus;
  duration_minutes: number;
}

export function calculatePastedEventDate({
  sourceMode,
  sourceReferenceDate,
  targetReferenceDate,
  eventDate,
}: {
  sourceMode: "day" | "week" | "month";
  sourceReferenceDate: Date;
  targetReferenceDate: Date;
  eventDate: Date;
}): Date {
  if (sourceMode === "day") {
    const dayDiff = differenceInCalendarDays(targetReferenceDate, sourceReferenceDate);
    return addDays(eventDate, dayDiff);
  }
  if (sourceMode === "week") {
    const sourceWeekStart = startOfWeek(sourceReferenceDate, { weekStartsOn: 1 });
    const targetWeekStart = startOfWeek(targetReferenceDate, { weekStartsOn: 1 });
    const dayDiff = differenceInCalendarDays(targetWeekStart, sourceWeekStart);
    return addDays(eventDate, dayDiff);
  }
  const monthDiff = differenceInCalendarMonths(targetReferenceDate, sourceReferenceDate);
  return addMonths(eventDate, monthDiff);
}

export interface UseAgendaPeriodClipboardProps {
  user: { id: string } | null;
  effectiveClinicId: string | null;
  viewMode: AgendaViewMode;
  selectedDate: Date;
  events: AgendaEventItem[];
  setEvents: React.Dispatch<React.SetStateAction<AgendaEventItem[]>>;
  can?: (capability: string) => boolean;
}

export function useAgendaPeriodClipboard({
  user,
  effectiveClinicId,
  viewMode,
  selectedDate,
  events,
  setEvents,
  can,
}: UseAgendaPeriodClipboardProps) {
  const [copiedPeriod, setCopiedPeriod] = useState<CopiedPeriodState | null>(null);
  const [isPasting, setIsPasting] = useState(false);

  const copyCurrentPeriod = useCallback(() => {
    if (viewMode === "year") return;

    let periodEvents: AgendaEventItem[] = [];
    let periodLabel = "";

    if (viewMode === "day") {
      const targetYear = selectedDate.getFullYear();
      const targetMonth = selectedDate.getMonth();
      const targetDay = selectedDate.getDate();

      periodEvents = events.filter((ev) => {
        const d = ev.date;
        return (
          d.getFullYear() === targetYear &&
          d.getMonth() === targetMonth &&
          d.getDate() === targetDay
        );
      });
      periodLabel = `o dia ${format(selectedDate, "dd/MM/yyyy")}`;
    } else if (viewMode === "week") {
      const wStart = startOfWeek(selectedDate, { weekStartsOn: 1 }).getTime();
      const wEnd = endOfWeek(selectedDate, { weekStartsOn: 1 }).getTime();

      periodEvents = events.filter((ev) => {
        const t = ev.date.getTime();
        return t >= wStart && t <= wEnd;
      });
      periodLabel = `a semana (${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM")} a ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM")})`;
    } else if (viewMode === "month") {
      const mStart = startOfMonth(selectedDate).getTime();
      const mEnd = endOfMonth(selectedDate).getTime();

      periodEvents = events.filter((ev) => {
        const t = ev.date.getTime();
        return t >= mStart && t <= mEnd;
      });
      periodLabel = `o mês de ${format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}`;
    }

    if (periodEvents.length === 0) {
      toast({
        title: "Nenhum compromisso para copiar",
        description: `Não há agendamentos para copiar n${periodLabel.startsWith("o") ? "e" : "a"} ${periodLabel}.`,
        variant: "destructive",
      });
      return;
    }

    setCopiedPeriod({
      mode: viewMode,
      sourceReferenceDate: new Date(selectedDate.getTime()),
      events: periodEvents,
    });

    const modeName = viewMode === "day" ? "Dia" : viewMode === "week" ? "Semana" : "Mês";
    toast({
      title: `${modeName} copiado! (${periodEvents.length} compromissos)`,
      description: "Agora navegue para o período de destino desejado e clique em 'Colar'. Você pode colar quantas vezes quiser.",
    });
  }, [viewMode, selectedDate, events]);

  const cancelCopy = useCallback(() => {
    setCopiedPeriod(null);
    toast({
      title: "Cópia cancelada",
      description: "A área de transferência da agenda foi limpa.",
    });
  }, []);

  const pastePeriod = useCallback(async () => {
    if (!user || !copiedPeriod || isPasting) return;
    if (copiedPeriod.events.length === 0) return;

    // Hardening de Governança e RBAC: checar se possui capability para agendar compromissos
    if (can && !can("schedule.write")) {
      toast({
        title: "Permissão negada",
        description: "Você não tem permissão para criar ou colar agendamentos na agenda.",
        variant: "destructive",
      });
      return;
    }

    const cleanUserId = sanitizeSingleLineInput(user.id, 64).trim();
    if (!cleanUserId) {
      toast({
        title: "Erro de autenticação",
        description: "Usuário não autenticado para colar agendamentos.",
        variant: "destructive",
      });
      return;
    }

    const cleanClinicId = effectiveClinicId ? sanitizeSingleLineInput(effectiveClinicId, 64).trim() || null : null;
    const sourceMode = copiedPeriod.mode;
    setIsPasting(true);

    try {
      // Sanitização O(N) e validação de integridade dos payloads
      const payloads: AgendaEventInsertPayload[] = [];

      for (const ev of copiedPeriod.events) {
        if (!ev || !ev.date) continue;
        const targetDate = calculatePastedEventDate({
          sourceMode,
          sourceReferenceDate: copiedPeriod.sourceReferenceDate,
          targetReferenceDate: selectedDate,
          eventDate: ev.date,
        });
        if (Number.isNaN(targetDate.getTime())) continue;

        // Extrair e sanitizar horário
        const timeStr = typeof ev.time === "string" ? ev.time.trim() : "";
        let hours = 8;
        let minutes = 0;
        if (isValidTimeString(timeStr)) {
          const parts = timeStr.split(":").map(Number);
          hours = parts[0];
          minutes = parts[1];
        } else {
          const parsedHours = parseInt(timeStr.slice(0, 2), 10);
          const parsedMinutes = parseInt(timeStr.slice(3, 5), 10);
          if (!Number.isNaN(parsedHours) && parsedHours >= 0 && parsedHours <= 23) hours = parsedHours;
          if (!Number.isNaN(parsedMinutes) && parsedMinutes >= 0 && parsedMinutes <= 59) minutes = parsedMinutes;
        }

        const scheduledFor = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          hours,
          minutes,
          0,
          0
        );

        if (Number.isNaN(scheduledFor.getTime())) continue;

        const rawTitle = ev.title || "Agendamento";
        const sanitizedTitle = sanitizeSingleLineInput(rawTitle, INPUT_LIMITS.agendaTitle).trim() || "Agendamento";
        const sanitizedPatientId = ev.patientId ? sanitizeSingleLineInput(ev.patientId, 64).trim() || null : null;
        const validEventType: AgendaEventType = VALID_EVENT_TYPES.has(ev.eventType) ? ev.eventType : "evento";

        payloads.push({
          clinic_id: cleanClinicId,
          user_id: cleanUserId,
          patient_id: sanitizedPatientId,
          title: sanitizedTitle,
          event_type: validEventType,
          scheduled_for: scheduledFor.toISOString(),
          status: "aguardando_confirmacao",
          duration_minutes: normalizeEventDurationMinutes(ev.durationMinutes),
        });
      }

      if (payloads.length === 0) {
        toast({
          title: "Nenhum compromisso válido",
          description: "Não foi possível preparar os agendamentos para o período de destino.",
          variant: "destructive",
        });
        return;
      }

      // Inserção em lotes (chunks de 100) para prevenir estouro de limites Postgres/PostgREST
      const CHUNK_SIZE = 100;
      const created: AgendaEventDbRow[] = [];

      for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
        const chunk = payloads.slice(i, i + CHUNK_SIZE);
        let insertResult = await supabase
          .from("agenda_events")
          .insert(chunk)
          .select();

        // Fallback Expand & Contract: caso coluna duration_minutes não exista no banco legado
        if (
          insertResult.error &&
          (insertResult.error.code === "42703" || insertResult.error.message?.includes("duration_minutes"))
        ) {
          const fallbackChunk = chunk.map(({ duration_minutes: _ignored, ...rest }) => rest);
          insertResult = await supabase
            .from("agenda_events")
            .insert(fallbackChunk)
            .select();
        }

        if (insertResult.error) throw insertResult.error;
        if (insertResult.data) {
          created.push(...(insertResult.data as unknown as AgendaEventDbRow[]));
        }
      }

      if (created.length > 0) {
        const mappedCreated: AgendaEventItem[] = created.map((item) => {
          const parsed = parseISO(item.scheduled_for);
          return {
            id: item.id,
            eventType: VALID_EVENT_TYPES.has(item.event_type as AgendaEventType)
              ? (item.event_type as AgendaEventType)
              : "evento",
            patientId: item.patient_id,
            scheduledFor: item.scheduled_for,
            status: normalizeAgendaStatus(item.status),
            title: item.title,
            date: parsed,
            time: format(parsed, "HH:mm"),
            durationMinutes: item.duration_minutes ?? 60,
          };
        });

        // Deduplicação O(M + N) usando Set para evitar colisões de chaves no React
        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const toAdd = mappedCreated.filter((e) => !existingIds.has(e.id));
          return [...prev, ...toAdd];
        });
      }

      notifyAgendaEventsUpdated();

      const periodDesc =
        sourceMode === "day"
          ? `no dia ${format(selectedDate, "dd/MM/yyyy")}`
          : sourceMode === "week"
          ? `na semana de ${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM")}`
          : `no mês de ${format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}`;

      toast({
        title: "Compromissos colados com sucesso!",
        description: `${payloads.length} compromissos criados ${periodDesc} como 'Aguardando confirmação'. O clipboard permanece ativo para colar em outros períodos.`,
      });
    } catch (err) {
      toast({
        title: "Erro ao colar agendamentos",
        description: formatSupabaseErrorMessage(err, "Não foi possível colar os compromissos no período selecionado."),
        variant: "destructive",
      });
    } finally {
      setIsPasting(false);
    }
  }, [user, effectiveClinicId, copiedPeriod, selectedDate, isPasting, setEvents, can]);

  return {
    copiedPeriod,
    isPasting,
    copyCurrentPeriod,
    pastePeriod,
    cancelCopy,
  };
}
