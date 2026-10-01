import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  format,
  isSameDay,
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
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AGENDA_EVENTS_UPDATED_EVENT,
  AGENDA_PAST_EVENT_ERROR_MESSAGE,
  assertAgendaEventDateTimeIsFuture,
  buildAgendaEventPayload,
  formatSupabaseErrorMessage,
  getAgendaEventDateTime,
  notifyAgendaEventsUpdated,
  type AgendaEventStatus,
  type AgendaEventType,
  type AgendaPatientOption,
} from "@/lib/agenda-events";
import { INPUT_LIMITS, sanitizeSingleLineInput } from "@/lib/input-security";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import {
  type AgendaEventItem,
  type AgendaViewMode,
  AgendaViewSelector,
  AgendaYearView,
  AgendaMonthView,
  AgendaDayView,
  AgendaWeekView,
  AgendaEventModal,
} from "@/components/agenda";

export type { AgendaEventItem };

function normalizeStatus(value: string | null | undefined): AgendaEventStatus {
  if (value === "confirmado" || value === "cancelado" || value === "lembrete") {
    return value;
  }
  return "aguardando_confirmacao";
}

function getDefaultNewEventTime() {
  const current = new Date();
  const nextHour = new Date(current.getTime() + 60 * 60 * 1000);
  nextHour.setMinutes(0, 0, 0);
  return format(nextHour, "HH:mm");
}

export default function ClinicAgendaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clinicKey } = useParams<{ clinicKey?: string }>();
  const { can, clinic, clinicId, loading: authLoading, user } = useAuth();

  const isDesignLab = location.pathname.startsWith("/designlab");
  const effectiveClinicKey = clinicKey || clinic?.route_key;
  const clinicHomePath = isDesignLab
    ? effectiveClinicKey
      ? `/designlab/clinica/${effectiveClinicKey}`
      : "/designlab/clinica/testesteseqsadqwdas"
    : effectiveClinicKey
      ? `/clinica/${effectiveClinicKey}`
      : "/espacopessoal";

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<AgendaViewMode>("day");
  const [events, setEvents] = useState<AgendaEventItem[]>([]);
  const [patients, setPatients] = useState<AgendaPatientOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal Unificado de Criação e Edição
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalPresetDate, setModalPresetDate] = useState<Date>(new Date());
  const [modalPresetTime, setModalPresetTime] = useState<string>(() => getDefaultNewEventTime());
  const [selectedEventForModal, setSelectedEventForModal] = useState<AgendaEventItem | null>(null);

  const effectiveClinicId = clinicId || clinic?.id || null;

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

  const currentUserId = user?.id;

  const fetchAgendaData = useCallback(async () => {
    if (authLoading) return;
    if (!currentUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      let eventsRes = effectiveClinicId
        ? await supabase
            .from("agenda_events")
            .select("id, event_type, patient_id, status, title, scheduled_for, duration_minutes")
            .eq("clinic_id", effectiveClinicId)
            .order("scheduled_for", { ascending: true })
        : await supabase
            .from("agenda_events")
            .select("id, event_type, patient_id, status, title, scheduled_for, duration_minutes")
            .order("scheduled_for", { ascending: true });

      // Fallback Expand and Contract: se o banco ainda não tiver duration_minutes, tenta sem a coluna
      if (eventsRes.error && (eventsRes.error.code === "42703" || eventsRes.error.message.includes("duration_minutes"))) {
        eventsRes = effectiveClinicId
          ? await supabase
              .from("agenda_events")
              .select("id, event_type, patient_id, status, title, scheduled_for")
              .eq("clinic_id", effectiveClinicId)
              .order("scheduled_for", { ascending: true })
          : await supabase
              .from("agenda_events")
              .select("id, event_type, patient_id, status, title, scheduled_for")
              .order("scheduled_for", { ascending: true });
      }

      const patientsRequest = effectiveClinicId
        ? supabase
            .from("patients")
            .select("id, name")
            .eq("clinic_id", effectiveClinicId)
            .order("name", { ascending: true })
        : supabase
            .from("patients")
            .select("id, name")
            .order("name", { ascending: true });

      const patientsRes = await patientsRequest;

      if (eventsRes.error) {
        toast({
          title: "Erro ao carregar agenda",
          description: eventsRes.error.message,
          variant: "destructive",
        });
      } else {
        setEvents(
          (eventsRes.data ?? []).map((ev: any) => ({
            id: ev.id,
            eventType: ev.event_type as AgendaEventType,
            patientId: ev.patient_id,
            scheduledFor: ev.scheduled_for,
            status: normalizeStatus(ev.status),
            title: ev.title,
            date: parseISO(ev.scheduled_for),
            time: format(parseISO(ev.scheduled_for), "HH:mm"),
            durationMinutes: ev.duration_minutes ?? 60,
          }))
        );
      }

      if (patientsRes.error) {
        toast({
          title: "Erro ao carregar pacientes",
          description: patientsRes.error.message,
          variant: "destructive",
        });
      } else {
        setPatients(Array.isArray(patientsRes.data) ? patientsRes.data : []);
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, effectiveClinicId, currentUserId]);

  useEffect(() => {
    void fetchAgendaData();
  }, [fetchAgendaData]);

  useEffect(() => {
    const handleEventsUpdated = () => {
      void fetchAgendaData();
    };

    window.addEventListener(AGENDA_EVENTS_UPDATED_EVENT, handleEventsUpdated);
    return () => {
      window.removeEventListener(AGENDA_EVENTS_UPDATED_EVENT, handleEventsUpdated);
    };
  }, [fetchAgendaData]);

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

    return events.filter((ev) => {
      if (filterType !== "all" && ev.eventType !== filterType) return false;
      if (filterStatus !== "all" && ev.status !== filterStatus) return false;
      if (q) {
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const patientName = ev.patientId ? patientNameById.get(ev.patientId) : undefined;
        const matchesPatient = patientName ? patientName.includes(q) : false;
        if (!matchesTitle && !matchesPatient) return false;
      }
      return true;
    });
  }, [events, filterType, filterStatus, searchQuery, patientNameById]);

  // Eventos do dia selecionado
  const dayEvents = useMemo(() => {
    return filteredEvents
      .filter((ev) => isSameDay(ev.date, selectedDate))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [filteredEvents, selectedDate]);

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
    setModalPresetDate(presetDate || selectedDate);
    setModalPresetTime(presetTime || getDefaultNewEventTime());
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
  }) => {
    if (!user) return;
    const scheduledDateTime = getAgendaEventDateTime(data.date, data.time);

    try {
      assertAgendaEventDateTimeIsFuture(scheduledDateTime, undefined, 15);
    } catch (err) {
      toast({
        title: "Horário inválido",
        description: err instanceof Error ? err.message : AGENDA_PAST_EVENT_ERROR_MESSAGE,
        variant: "destructive",
      });
      return;
    }

    const selectedPatient = data.patientId
      ? patients.find((p) => p.id === data.patientId) || null
      : null;

    try {
      const payload = buildAgendaEventPayload({
        clinicId: effectiveClinicId,
        durationMinutes: data.durationMinutes,
        eventType: data.eventType,
        graceMinutes: 15,
        selectedDate: data.date,
        selectedPatient,
        time: data.time,
        title: data.title,
        userId: user.id,
      });

      let insertedResult = await supabase
        .from("agenda_events")
        .insert(payload)
        .select()
        .single();

      if (insertedResult.error && (insertedResult.error.code === "42703" || insertedResult.error.message.includes("duration_minutes"))) {
        const fallbackPayload = { ...payload };
        delete (fallbackPayload as any).duration_minutes;
        insertedResult = await supabase
          .from("agenda_events")
          .insert(fallbackPayload)
          .select()
          .single();
      }

      if (insertedResult.error) throw insertedResult.error;
      const inserted = insertedResult.data;

      if (inserted) {
        setEvents((prev) => [
          ...prev,
          {
            id: inserted.id,
            eventType: inserted.event_type as AgendaEventType,
            patientId: inserted.patient_id,
            scheduledFor: inserted.scheduled_for,
            status: normalizeStatus(inserted.status),
            title: inserted.title,
            date: parseISO(inserted.scheduled_for),
            time: format(parseISO(inserted.scheduled_for), "HH:mm"),
            durationMinutes: (inserted as any).duration_minutes ?? data.durationMinutes,
          },
        ]);
      }

      notifyAgendaEventsUpdated();
      setModalOpen(false);
      toast({ title: "Agendamento criado com sucesso" });
    } catch (err) {
      toast({
        title: "Erro ao criar agendamento",
        description: formatSupabaseErrorMessage(err, "Não foi possível criar o agendamento. Verifique os dados e tente novamente."),
        variant: "destructive",
      });
    }
  }, [user, patients, effectiveClinicId]);

  // Salvar Edição de Agendamento
  const handleSaveEdit = useCallback(async (data: {
    id: string;
    status: AgendaEventStatus;
    date: string;
    time: string;
    durationMinutes?: number;
  }) => {
    if (!user) return;

    try {
      const newDateTime = new Date(`${data.date}T${data.time}:00`);
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

      setEvents((prev) =>
        prev.map((e) =>
          e.id === data.id
            ? {
                ...e,
                status: data.status,
                scheduledFor: newDateTime.toISOString(),
                date: newDateTime,
                time: data.time,
                durationMinutes: data.durationMinutes ?? e.durationMinutes,
              }
            : e
        )
      );

      notifyAgendaEventsUpdated();
      setModalOpen(false);
      toast({ title: "Agendamento atualizado" });
    } catch (err) {
      toast({
        title: "Erro ao atualizar",
        description: formatSupabaseErrorMessage(err, "Não foi possível atualizar o agendamento."),
        variant: "destructive",
      });
    }
  }, [user, effectiveClinicId]);

  // Excluir Agendamento
  const handleDeleteEvent = useCallback(async (id: string) => {
    if (!can("agenda.delete_events")) {
      toast({
        title: "Permissão negada",
        description: "Você não tem permissão para excluir agendamentos.",
        variant: "destructive",
      });
      return;
    }

    try {
      const deleteQuery = supabase.from("agenda_events").delete().eq("id", id);
      const { error } = effectiveClinicId ? await deleteQuery.eq("clinic_id", effectiveClinicId) : await deleteQuery;

      if (error) throw error;

      setEvents((prev) => prev.filter((e) => e.id !== id));
      notifyAgendaEventsUpdated();
      setModalOpen(false);
      toast({ title: "Agendamento excluído" });
    } catch (err) {
      toast({
        title: "Erro ao excluir",
        description: formatSupabaseErrorMessage(err, "Não foi possível excluir o agendamento."),
        variant: "destructive",
      });
    }
  }, [can, effectiveClinicId]);

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
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente ou título..."
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(sanitizeSingleLineInput(e.target.value, INPUT_LIMITS.name))
            }
            maxLength={INPUT_LIMITS.name}
            className="h-9 pl-9 rounded-xl text-xs"
          />
        </div>

        {/* Mobile Filters Sheet Trigger */}
        <div className="sm:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={`h-9 w-9 rounded-xl shrink-0 ${
                  filterType !== "all" || filterStatus !== "all"
                    ? "border-primary text-primary bg-primary/5"
                    : ""
                }`}
                aria-label="Abrir filtros"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl pb-8">
              <SheetHeader className="text-left pb-3">
                <SheetTitle className="text-base font-bold">Filtrar Agendamentos</SheetTitle>
                <SheetDescription className="text-xs">
                  Selecione o tipo de evento e o status desejado.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Tipo de Evento</label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-10 w-full rounded-xl text-xs">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todos os tipos</SelectItem>
                      <SelectItem value="atendimento" className="text-xs">Atendimento</SelectItem>
                      <SelectItem value="reuniao" className="text-xs">Reunião</SelectItem>
                      <SelectItem value="evento" className="text-xs">Evento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Status do Evento</label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-10 w-full rounded-xl text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todos os status</SelectItem>
                      <SelectItem value="confirmado" className="text-xs">Confirmado</SelectItem>
                      <SelectItem value="aguardando_confirmacao" className="text-xs">Aguardando confirmação</SelectItem>
                      <SelectItem value="cancelado" className="text-xs">Cancelado</SelectItem>
                      <SelectItem value="lembrete" className="text-xs">Lembrete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(filterType !== "all" || filterStatus !== "all" || searchQuery.trim()) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full h-10 text-xs text-muted-foreground"
                    onClick={() => {
                      setFilterType("all");
                      setFilterStatus("all");
                      setSearchQuery("");
                    }}
                  >
                    Limpar todos os filtros
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop Filter Selects */}
        <div className="hidden sm:flex items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9 w-[140px] rounded-xl text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Todos os tipos
              </SelectItem>
              <SelectItem value="atendimento" className="text-xs">
                Atendimento
              </SelectItem>
              <SelectItem value="reuniao" className="text-xs">
                Reunião
              </SelectItem>
              <SelectItem value="evento" className="text-xs">
                Evento
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-[150px] rounded-xl text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Todos os status
              </SelectItem>
              <SelectItem value="confirmado" className="text-xs">
                Confirmado
              </SelectItem>
              <SelectItem value="aguardando_confirmacao" className="text-xs">
                Aguardando
              </SelectItem>
              <SelectItem value="cancelado" className="text-xs">
                Cancelado
              </SelectItem>
              <SelectItem value="lembrete" className="text-xs">
                Lembrete
              </SelectItem>
            </SelectContent>
          </Select>

          {(filterType !== "all" || filterStatus !== "all" || searchQuery.trim()) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setFilterType("all");
                setFilterStatus("all");
                setSearchQuery("");
              }}
            >
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

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
