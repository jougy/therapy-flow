import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  subDays,
  addMonths,
  subMonths,
  addYears,
  subYears,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
} from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { useAgendaPeriodClipboard } from "@/hooks/useAgendaPeriodClipboard";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AGENDA_PAST_EVENT_ERROR_MESSAGE,
  assertAgendaEventDateTimeIsFuture,
  buildAgendaEventPayload,
  formatSupabaseErrorMessage,
  getAgendaEventDateTime,
  normalizeAgendaStatus,
  type AgendaEventStatus,
  type AgendaEventType,
} from "@/lib/agenda-events";
import { INPUT_LIMITS, sanitizeSingleLineInput } from "@/lib/input-security";
import { resolveCurrentGeoLocation } from "@/lib/geo-timezone";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import {
  type AgendaEventItem,
  type AgendaShift,
  type AgendaViewMode,
  getEventShift,
  AgendaViewSelector,
  AgendaYearView,
  AgendaMonthView,
  AgendaDayView,
  AgendaWeekView,
  AgendaEventModal,
  AgendaFiltersToolbar,
  AgendaPeriodClipboardActions,
} from "@/components/agenda";

export type { AgendaEventItem };

import { type AgendaEventQueryResult } from "@/lib/agenda-cache";
import {
  isNetworkOrOfflineError,
  toRawAgendaEvent,
  useClinicAgendaPatients,
  useUnifiedClinicAgenda,
} from "@/services/clinicAgendaService";

function getDefaultNewEventPreset(referenceDate = new Date()) {
  const current = new Date();
  const todayStart = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  const refStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  const nextSlot = new Date(current.getTime() + 60 * 60 * 1000);
  nextSlot.setMinutes(0, 0, 0);

  // Se o dia visualizado na agenda estiver no passado, ancore no dia atual (ou amanhã se já virou 23h)
  const presetDate = refStart.getTime() < todayStart.getTime() ? new Date(todayStart) : new Date(refStart);
  const isTodayPreset = presetDate.getTime() === todayStart.getTime();
  const nextSlotRolledOverDay =
    nextSlot.getFullYear() !== current.getFullYear() ||
    nextSlot.getMonth() !== current.getMonth() ||
    nextSlot.getDate() !== current.getDate();

  if (isTodayPreset && nextSlotRolledOverDay) {
    presetDate.setDate(presetDate.getDate() + 1);
    return {
      presetDate,
      presetTime: format(nextSlot, "HH:mm"),
    };
  }

  return {
    presetDate,
    presetTime: isTodayPreset ? format(nextSlot, "HH:mm") : "09:00",
  };
}

export default function ClinicAgendaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clinicKey } = useParams<{ clinicKey?: string }>();
  const { accessibleClinics, can, clinic, clinicId, loading: authLoading, user } = useAuth();

  const isDesignLab = location.pathname.startsWith("/designlab");
  const effectiveClinicKey = clinicKey || clinic?.route_key;
  const clinicHomePath = isDesignLab
    ? effectiveClinicKey
      ? `/designlab/clinica/${effectiveClinicKey}`
      : "/designlab/clinica/testesteseqsadqwdas"
    : effectiveClinicKey
      ? `/clinica/${effectiveClinicKey}`
      : "/espacopessoal";

  const routeClinicId = clinicKey
    ? accessibleClinics?.find((opt) => opt.clinic?.route_key === clinicKey)?.clinic?.id
    : undefined;
  const effectiveClinicId = clinicId || clinic?.id || routeClinicId || null;

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<AgendaViewMode>("day");

  // Filtros
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterShifts, setFilterShifts] = useState<AgendaShift[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal Unificado de Criação e Edição
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalPresetDate, setModalPresetDate] = useState<Date>(() => getDefaultNewEventPreset().presetDate);
  const [modalPresetTime, setModalPresetTime] = useState<string>(() => getDefaultNewEventPreset().presetTime);
  const [selectedEventForModal, setSelectedEventForModal] = useState<AgendaEventItem | null>(null);

  const currentUserId = user?.id;
  const isAgendaQueryEnabled = Boolean(currentUserId) && !authLoading && !(clinicKey && !effectiveClinicId);

  const {
    events,
    index: agendaIndex,
    isLoading: loadingEvents,
    optimisticUpsertEvent,
    optimisticUpsertEvents,
    optimisticDeleteEvent,
  } = useUnifiedClinicAgenda(effectiveClinicId, isAgendaQueryEnabled);

  const { patients, isLoading: loadingPatients } = useClinicAgendaPatients(effectiveClinicId, isAgendaQueryEnabled);
  const loading = (loadingEvents || loadingPatients) && events.length === 0;

  const setEventsForClipboard = useCallback<React.Dispatch<React.SetStateAction<AgendaEventItem[]>>>(
    (updater) => {
      const next = typeof updater === "function" ? updater(events) : updater;
      const added = next.filter((ev) => !agendaIndex.byId.has(ev.id));
      if (added.length > 0) {
        void optimisticUpsertEvents(added);
      }
    },
    [agendaIndex.byId, events, optimisticUpsertEvents]
  );

  // Hook modular de Copiar & Colar Flexível de Período (Dia, Semana, Mês)
  const {
    copiedPeriod,
    isPasting,
    copyCurrentPeriod: handleCopyCurrentPeriod,
    pastePeriod: handlePastePeriod,
    cancelCopy: handleCancelCopy,
  } = useAgendaPeriodClipboard({
    user,
    effectiveClinicId,
    viewMode,
    selectedDate,
    events,
    setEvents: setEventsForClipboard,
    can,
  });

  // Feature Flags da Agenda
  const { isFeatureEnabled, flags: featureFlags } = useFeatureFlags();
  const isAgendaEnabled = isFeatureEnabled("agenda_module");
  const rawAgendaConfig = (featureFlags.agenda_module as Record<string, unknown>) || {};
  const allowedViews = (rawAgendaConfig.allowedViews as {
    day?: boolean;
    week?: boolean;
    month?: boolean;
    year?: boolean;
  }) || { day: true, week: true, month: true, year: true };
  const maintenanceMessage = (rawAgendaConfig.maintenanceMessage as string) || "";

  // Configurações granulares da Agenda vindas das feature flags
  const enableConflictWarning =
    isFeatureEnabled("agenda_conflict_warning") &&
    (rawAgendaConfig.enableConflictWarning !== false);
  const defaultDurationMinutes =
    typeof rawAgendaConfig.defaultDurationMinutes === "number" && rawAgendaConfig.defaultDurationMinutes > 0
      ? rawAgendaConfig.defaultDurationMinutes
      : 50;

  // Sincroniza a visão padrão se configurada via feature flags
  useEffect(() => {
    if (rawAgendaConfig.defaultView && typeof rawAgendaConfig.defaultView === "string") {
      const def = rawAgendaConfig.defaultView as AgendaViewMode;
      if (allowedViews[def] !== false) {
        setViewMode(def);
      }
    }
  }, [rawAgendaConfig.defaultView]);

  const patientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of patients) {
      map.set(p.id, p.name.toLowerCase());
    }
    return map;
  }, [patients]);

  // Filtragem dos eventos
  const filteredEvents = useMemo(() => {
    const q = sanitizeSingleLineInput(searchQuery, INPUT_LIMITS.name).trim().toLowerCase();
    const hasShiftConstraint = filterShifts.length > 0 && filterShifts.length < 4;

    return events.filter((ev) => {
      if (filterType !== "all" && ev.eventType !== filterType) return false;
      if (filterStatus !== "all" && ev.status !== filterStatus) return false;
      if (hasShiftConstraint) {
        const evShift = getEventShift(ev.time);
        if (!filterShifts.includes(evShift)) return false;
      }
      if (q) {
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const patientName = ev.patientId ? patientNameById.get(ev.patientId) : undefined;
        const matchesPatient = patientName ? patientName.includes(q) : false;
        if (!matchesTitle && !matchesPatient) return false;
      }
      return true;
    });
  }, [events, filterType, filterStatus, filterShifts, searchQuery, patientNameById]);

  // Eventos do dia selecionado em O(1) via índice por dia quando sem filtros ativos
  const dayEvents = useMemo(() => {
    const hasFilters =
      filterType !== "all" ||
      filterStatus !== "all" ||
      (filterShifts.length > 0 && filterShifts.length < 4) ||
      Boolean(searchQuery.trim());

    if (!hasFilters) {
      return agendaIndex.byDayKey.get(format(selectedDate, "yyyy-MM-dd")) ?? [];
    }

    const targetYear = selectedDate.getFullYear();
    const targetMonth = selectedDate.getMonth();
    const targetDay = selectedDate.getDate();

    return filteredEvents
      .filter((ev) => {
        const d = ev.date;
        return (
          d.getFullYear() === targetYear &&
          d.getMonth() === targetMonth &&
          d.getDate() === targetDay
        );
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [agendaIndex.byDayKey, filterShifts.length, filterStatus, filterType, filteredEvents, searchQuery, selectedDate]);

  // Dias da semana corrente
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);

  // Estatísticas do dia selecionado em passagem única O(D)
  const dayStats = useMemo(() => {
    let confirmados = 0;
    let aguardando = 0;
    let cancelados = 0;
    for (const e of dayEvents) {
      if (e.status === "confirmado") confirmados++;
      else if (e.status === "aguardando_confirmacao") aguardando++;
      else if (e.status === "cancelado") cancelados++;
    }
    return { total: dayEvents.length, confirmados, aguardando, cancelados };
  }, [dayEvents]);

  // Handlers de navegação de data
  const handlePrev = useCallback(() => {
    if (viewMode === "day") setSelectedDate((d) => subDays(d, 1));
    else if (viewMode === "week") setSelectedDate((d) => addDays(d, -7));
    else if (viewMode === "month") setSelectedDate((d) => subMonths(d, 1));
    else setSelectedDate((d) => subYears(d, 1));
  }, [viewMode]);

  const handleNext = useCallback(() => {
    if (viewMode === "day") setSelectedDate((d) => addDays(d, 1));
    else if (viewMode === "week") setSelectedDate((d) => addDays(d, 7));
    else if (viewMode === "month") setSelectedDate((d) => addMonths(d, 1));
    else setSelectedDate((d) => addYears(d, 1));
  }, [viewMode]);

  const handleToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  // Abrir Modal de Novo Agendamento
  const handleOpenAddModal = useCallback((presetDate?: Date, presetTime?: string) => {
    const defaultPreset = getDefaultNewEventPreset(presetDate || selectedDate);
    setModalPresetDate(defaultPreset.presetDate);
    setModalPresetTime(presetTime || defaultPreset.presetTime);
    setSelectedEventForModal(null);
    setModalMode("create");
    setModalOpen(true);
  }, [selectedDate]);

  // Abrir Modal de Edição
  const handleOpenEditModal = useCallback((ev: AgendaEventItem) => {
    setSelectedEventForModal(ev);
    setModalMode("edit");
    setModalOpen(true);
  }, []);

  // Navegar diretamente para um dia específico (usado por YearView, MonthView e WeekView)
  const handleNavigateToDay = useCallback((day: Date) => {
    setSelectedDate(day);
    setViewMode("day");
  }, []);

  // Navegar entre modos de visualização com data alvo
  const handleNavigateToView = useCallback((view: AgendaViewMode, targetDate: Date) => {
    setSelectedDate(targetDate);
    setViewMode(view);
  }, []);

  // Salvar Criação de Agendamento
  const handleSaveCreate = useCallback(async (data: {
    eventType: AgendaEventType;
    patientId: string | null;
    title: string;
    date: Date;
    time: string;
    durationMinutes: number;
    reminderSettings?: any;
    notifyPatient?: boolean;
    notifyTeam?: boolean;
  }) => {
    if (!user) return;
    if (!can("schedule.write")) {
      toast({
        title: "Permissão negada",
        description: "Você não tem permissão para criar agendamentos.",
        variant: "destructive",
        telemetry: "validation",
      });
      return;
    }
    const scheduledDateTime = getAgendaEventDateTime(data.date, data.time);

    try {
      assertAgendaEventDateTimeIsFuture(scheduledDateTime, undefined, 15);
    } catch (err) {
      toast({
        title: "Horário inválido",
        description: err instanceof Error ? err.message : AGENDA_PAST_EVENT_ERROR_MESSAGE,
        variant: "destructive",
        telemetry: "validation",
      });
      return;
    }

    const selectedPatient = data.patientId
      ? patients.find((p) => p.id === data.patientId) || null
      : null;

    let payload: ReturnType<typeof buildAgendaEventPayload> | null = null;
    const tempId = `offline-agenda-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const saveOffline = async (insertPayload: ReturnType<typeof buildAgendaEventPayload>) => {
      const offlineRaw: AgendaEventQueryResult = {
        id: tempId,
        event_type: insertPayload.event_type,
        patient_id: insertPayload.patient_id ?? null,
        scheduled_for: insertPayload.scheduled_for,
        status: insertPayload.status ?? "aguardando_confirmacao",
        title: insertPayload.title,
        duration_minutes: insertPayload.duration_minutes ?? data.durationMinutes,
        origin_timezone: insertPayload.origin_timezone ?? null,
        origin_lat: insertPayload.origin_lat ?? null,
        origin_lng: insertPayload.origin_lng ?? null,
        origin_city: insertPayload.origin_city ?? null,
      };
      await optimisticUpsertEvent(offlineRaw, { tempId, offlineRecord: insertPayload, enqueueOffline: true });
      setModalOpen(false);
      toast({ title: "Agendamento salvo offline", description: "Será sincronizado ao reconectar." });
    };

    try {
      const geo = await resolveCurrentGeoLocation();

      payload = buildAgendaEventPayload({
        clinicId: effectiveClinicId,
        durationMinutes: data.durationMinutes,
        eventType: data.eventType,
        graceMinutes: 15,
        notifiedColleagueIds: data.reminderSettings?.notifiedColleagueIds,
        notifyPatient: data.reminderSettings?.notifyPatient,
        notifyTeam: data.reminderSettings?.notifyTeam,
        originCity: geo.city,
        originLat: geo.lat,
        originLng: geo.lng,
        originTimezone: geo.timezone,
        reminderConfigs: data.reminderSettings?.reminderConfigs,
        selectedDate: data.date,
        selectedPatient,
        time: data.time,
        title: data.title,
        userId: user.id,
      });

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await saveOffline(payload);
        return;
      }

      let insertedResult = await supabase
        .from("agenda_events")
        .insert(payload)
        .select()
        .single();

      if (
        insertedResult.error &&
        (insertedResult.error.code === "42703" ||
          insertedResult.error.code === "PGRST204" ||
          insertedResult.error.message.includes("duration_minutes") ||
          insertedResult.error.message.includes("notified_colleague_ids") ||
          insertedResult.error.message.includes("reminder_configs") ||
          insertedResult.error.message.includes("origin_timezone") ||
          insertedResult.error.message.includes("schema cache"))
      ) {
        const fallbackPayload = { ...payload };
        delete (fallbackPayload as Record<string, unknown>).duration_minutes;
        delete (fallbackPayload as Record<string, unknown>).reminder_configs;
        delete (fallbackPayload as Record<string, unknown>).notify_team;
        delete (fallbackPayload as Record<string, unknown>).notify_patient;
        delete (fallbackPayload as Record<string, unknown>).notified_colleague_ids;
        delete (fallbackPayload as Record<string, unknown>).origin_timezone;
        delete (fallbackPayload as Record<string, unknown>).origin_lat;
        delete (fallbackPayload as Record<string, unknown>).origin_lng;
        delete (fallbackPayload as Record<string, unknown>).origin_city;
        insertedResult = await supabase
          .from("agenda_events")
          .insert(fallbackPayload)
          .select()
          .single();
      }

      if (insertedResult.error) throw insertedResult.error;
      const inserted = insertedResult.data;

      if (inserted) {
        if (inserted.id && (data.notifyPatient || data.notifyTeam)) {
          void supabase.functions.invoke("agenda-whatsapp-reminders", {
            body: { action: "notify_new_booking", eventId: inserted.id },
          }).catch(() => {});
        }

        const newEvent: AgendaEventItem = {
          id: inserted.id,
          eventType: inserted.event_type as AgendaEventType,
          patientId: inserted.patient_id,
          scheduledFor: inserted.scheduled_for,
          status: normalizeAgendaStatus(inserted.status),
          title: inserted.title,
          date: parseISO(inserted.scheduled_for),
          time: format(parseISO(inserted.scheduled_for), "HH:mm"),
          durationMinutes: (inserted as { duration_minutes?: number | null }).duration_minutes ?? data.durationMinutes,
          originTimezone: (inserted as { origin_timezone?: string | null }).origin_timezone ?? geo.timezone,
          originLat: (inserted as { origin_lat?: number | null }).origin_lat ?? geo.lat,
          originLng: (inserted as { origin_lng?: number | null }).origin_lng ?? geo.lng,
          originCity: (inserted as { origin_city?: string | null }).origin_city ?? geo.city,
        };
        await optimisticUpsertEvent(newEvent);
      }

      setModalOpen(false);
      toast({ title: "Agendamento criado com sucesso" });
    } catch (err) {
      if (payload && isNetworkOrOfflineError(err)) {
        await saveOffline(payload);
        return;
      }
      toast({
        title: "Erro ao criar agendamento",
        description: formatSupabaseErrorMessage(err, "Não foi possível criar o agendamento. Verifique os dados e tente novamente."),
        variant: "destructive",
      });
    }
  }, [can, user, patients, effectiveClinicId, optimisticUpsertEvent]);

  // Salvar Edição de Agendamento
  const handleSaveEdit = useCallback(async (data: {
    id: string;
    status: AgendaEventStatus;
    date: string;
    time: string;
    durationMinutes?: number;
  }) => {
    if (!user) return;
    if (!can("schedule.write")) {
      toast({
        title: "Permissão negada",
        description: "Você não tem permissão para editar agendamentos.",
        variant: "destructive",
        telemetry: "validation",
      });
      return;
    }

    const existingEvent = agendaIndex.byId.get(data.id);
    const newDateTime = getAgendaEventDateTime(data.date, data.time);

    const saveEditOffline = async () => {
      if (!existingEvent) return;
      const updatedItem: AgendaEventItem = {
        ...existingEvent,
        status: data.status,
        scheduledFor: newDateTime.toISOString(),
        date: newDateTime,
        time: data.time,
        durationMinutes: data.durationMinutes ?? existingEvent.durationMinutes,
      };
      await optimisticUpsertEvent(updatedItem, {
        enqueueOffline: true,
        offlineRecord: {
          id: existingEvent.id,
          clinic_id: effectiveClinicId,
          user_id: user.id,
          event_type: existingEvent.eventType,
          patient_id: existingEvent.patientId,
          scheduled_for: newDateTime.toISOString(),
          status: data.status,
          title: existingEvent.title,
          duration_minutes: updatedItem.durationMinutes ?? 60,
        },
      });
      setModalOpen(false);
      toast({ title: "Agendamento salvo offline", description: "Será sincronizado ao reconectar." });
    };

    try {
      const updatePayload: {
        status: AgendaEventStatus;
        scheduled_for: string;
        duration_minutes?: number;
      } = {
        status: data.status,
        scheduled_for: newDateTime.toISOString(),
      };

      if (typeof data.durationMinutes === "number" && data.durationMinutes > 0 && data.durationMinutes <= 1440) {
        updatePayload.duration_minutes = Math.round(data.durationMinutes);
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await saveEditOffline();
        return;
      }

      const updateQuery = supabase
        .from("agenda_events")
        .update(updatePayload)
        .eq("id", data.id);

      let updateResult = effectiveClinicId ? await updateQuery.eq("clinic_id", effectiveClinicId) : await updateQuery;

      if (updateResult.error && (updateResult.error.code === "42703" || updateResult.error.message.includes("duration_minutes"))) {
        const fallbackUpdatePayload: { status: AgendaEventStatus; scheduled_for: string } = {
          status: data.status,
          scheduled_for: newDateTime.toISOString(),
        };
        const fallbackQuery = supabase
          .from("agenda_events")
          .update(fallbackUpdatePayload)
          .eq("id", data.id);
        updateResult = effectiveClinicId ? await fallbackQuery.eq("clinic_id", effectiveClinicId) : await fallbackQuery;
      }

      if (updateResult.error) throw updateResult.error;

      if (existingEvent) {
        const updatedRaw: AgendaEventQueryResult = {
          ...toRawAgendaEvent(existingEvent),
          status: data.status,
          scheduled_for: newDateTime.toISOString(),
          duration_minutes: data.durationMinutes ?? existingEvent.durationMinutes ?? null,
        };
        await optimisticUpsertEvent(updatedRaw);
      }

      setModalOpen(false);
      toast({ title: "Agendamento atualizado" });
    } catch (err) {
      if (existingEvent && isNetworkOrOfflineError(err)) {
        await saveEditOffline();
        return;
      }
      toast({
        title: "Erro ao atualizar",
        description: formatSupabaseErrorMessage(err, "Não foi possível atualizar o agendamento."),
        variant: "destructive",
      });
    }
  }, [agendaIndex.byId, can, user, effectiveClinicId, optimisticUpsertEvent]);

  // Excluir Agendamento
  const handleDeleteEvent = useCallback(async (id: string) => {
    if (!can("agenda.delete_events")) {
      toast({
        title: "Permissão negada",
        description: "Você não tem permissão para excluir agendamentos.",
        variant: "destructive",
        telemetry: "validation",
      });
      return;
    }

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await optimisticDeleteEvent(id, { enqueueOffline: true });
        setModalOpen(false);
        toast({ title: "Agendamento excluído offline" });
        return;
      }

      const deleteQuery = supabase.from("agenda_events").delete().eq("id", id);
      const { error } = effectiveClinicId ? await deleteQuery.eq("clinic_id", effectiveClinicId) : await deleteQuery;

      if (error) throw error;

      await optimisticDeleteEvent(id);
      setModalOpen(false);
      toast({ title: "Agendamento excluído" });
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        await optimisticDeleteEvent(id, { enqueueOffline: true });
        setModalOpen(false);
        toast({ title: "Agendamento excluído offline" });
        return;
      }
      toast({
        title: "Erro ao excluir",
        description: formatSupabaseErrorMessage(err, "Não foi possível excluir o agendamento."),
        variant: "destructive",
      });
    }
  }, [can, effectiveClinicId, optimisticDeleteEvent]);

  if (!isAgendaEnabled) {
    return (
      <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4 rounded-2xl border bg-card p-8 shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">Agenda Temporariamente Indisponível</h2>
            <p className="text-xs text-muted-foreground">
              O módulo da agenda está desativado para esta clínica pelas configurações de governança e feature flags.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(clinicHomePath)}
            className="rounded-xl text-xs"
          >
            Voltar ao Início
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-5 overflow-y-auto px-4 pb-24 pt-4 sm:p-6 lg:px-8">
      {/* Banner de Manutenção Opcional */}
      {maintenanceMessage && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3">
          <span>{maintenanceMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full sm:h-9 sm:w-9"
              onClick={() => navigate(clinicHomePath)}
              aria-label="Voltar para a página inicial"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-2xl truncate">
                  Agenda da Clínica
                </h1>
                <ComponentHelpButton helpId="agenda-widget" size="sm" />
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Visualização expandida de agendamentos, reuniões e eventos.
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            className="sm:hidden gap-1 rounded-xl text-xs font-semibold shadow-xs shrink-0 h-8"
            onClick={() => handleOpenAddModal()}
          >
            <Plus className="h-3.5 w-3.5" />
            Novo
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Seletor com 4 modos (Ano, Mês, Semana, Dia) */}
          <AgendaViewSelector
            value={viewMode}
            onChange={setViewMode}
            allowedViews={allowedViews}
          />

          <Button
            type="button"
            className="hidden sm:inline-flex gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
            onClick={() => handleOpenAddModal()}
          >
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </Button>
        </div>
      </header>

      {/* Date Navigation & Summary Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-2xl border bg-card p-2.5 sm:p-3 shadow-xs">
        <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg shrink-0"
              onClick={handlePrev}
              aria-label="Período anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 rounded-lg text-xs font-medium shrink-0"
              onClick={handleToday}
            >
              Hoje
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg shrink-0"
              onClick={handleNext}
              aria-label="Próximo período"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="gap-1.5 text-xs sm:text-sm font-semibold capitalize text-foreground hover:bg-muted/50 px-2 sm:px-3 truncate max-w-[190px] sm:max-w-none justify-start"
              >
                <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">
                  {viewMode === "day" &&
                    format(selectedDate, "EEE, dd 'de' MMM", { locale: ptBR })}
                  {viewMode === "week" &&
                    `Semana ${format(weekDays[0], "dd/MM")} - ${format(weekDays[6], "dd/MM")}`}
                  {viewMode === "month" && format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
                  {viewMode === "year" && format(selectedDate, "yyyy")}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          {/* Ações de Copiar & Colar de Período (Dia, Semana, Mês) */}
          <AgendaPeriodClipboardActions
            viewMode={viewMode}
            copiedPeriod={copiedPeriod}
            isPasting={isPasting}
            onCopy={handleCopyCurrentPeriod}
            onPaste={handlePastePeriod}
            onCancel={handleCancelCopy}
            canScheduleWrite={can("schedule.write")}
          />
        </div>

        {/* Quick Stats Badges - Carousel tátil no mobile */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1 sm:pb-0 snap-x snap-mandatory [-webkit-overflow-scrolling:touch]">
          <Badge variant="outline" className="gap-1 border-primary/20 bg-primary/5 text-primary shrink-0 snap-start">
            <Clock className="h-3 w-3" />
            {dayStats.total} total
          </Badge>
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 shrink-0 snap-start"
          >
            <Check className="h-3 w-3" />
            {dayStats.confirmados} confirmados
          </Badge>
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400 shrink-0 snap-start"
          >
            {dayStats.aguardando} aguardando
          </Badge>
        </div>
      </div>

      {/* Filters Toolbar */}
      <AgendaFiltersToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterType={filterType}
        setFilterType={setFilterType}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterShifts={filterShifts}
        setFilterShifts={setFilterShifts}
      />

      {/* Main Agenda View Grid (Year, Month, Week, Day) */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : viewMode === "year" ? (
        <AgendaYearView
          currentDate={selectedDate}
          onSelectDate={setSelectedDate}
          onNavigateToView={handleNavigateToView}
          events={filteredEvents}
        />
      ) : viewMode === "month" ? (
        <AgendaMonthView
          currentDate={selectedDate}
          onSelectDate={setSelectedDate}
          events={filteredEvents}
          patients={patients}
          onOpenAddModal={handleOpenAddModal}
          onOpenEditModal={handleOpenEditModal}
          onNavigateToDay={handleNavigateToDay}
        />
      ) : viewMode === "week" ? (
        <AgendaWeekView
          currentDate={selectedDate}
          onSelectDate={setSelectedDate}
          onNavigateToDay={handleNavigateToDay}
          events={filteredEvents}
          patients={patients}
          onOpenAddModal={handleOpenAddModal}
          onOpenEditModal={handleOpenEditModal}
        />
      ) : (
        <AgendaDayView
          currentDate={selectedDate}
          events={filteredEvents}
          patients={patients}
          onOpenAddModal={handleOpenAddModal}
          onOpenEditModal={handleOpenEditModal}
        />
      )}

      {/* Modal Unificado de Criação e Edição */}
      <AgendaEventModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        initialDate={modalPresetDate}
        initialTime={modalPresetTime}
        selectedEvent={selectedEventForModal}
        patients={patients}
        existingEvents={events}
        defaultDurationMinutes={defaultDurationMinutes}
        showConflictWarning={enableConflictWarning}
        onSaveCreate={handleSaveCreate}
        onSaveEdit={handleSaveEdit}
        onDeleteEvent={handleDeleteEvent}
        canDelete={can("agenda.delete_events")}
      />
    </main>
  );
}
