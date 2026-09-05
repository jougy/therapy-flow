import { useCallback, useEffect, useMemo, useState } from "react";
import { format, isSameDay, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Loader2,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  AGENDA_EVENTS_UPDATED_EVENT,
  AGENDA_PAST_EVENT_ERROR_MESSAGE,
  assertAgendaEventDateTimeIsFuture,
  buildAgendaEventPayload,
  getAgendaEventDateTime,
  notifyAgendaEventsUpdated,
  resolvePatientSelection,
  type AgendaEventStatus,
  type AgendaEventType,
  type AgendaPatientOption,
} from "@/lib/agenda-events";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";

export interface AgendaEventItem {
  id: string;
  eventType: AgendaEventType;
  patientId: string | null;
  scheduledFor: string;
  status: AgendaEventStatus;
  title: string;
  date: Date;
  time: string;
}

type AgendaViewMode = "day" | "week" | "month";

const eventTypeLabels: Record<AgendaEventType, string> = {
  atendimento: "Atendimento",
  reuniao: "Reunião",
  evento: "Evento",
};

const agendaStatusLabels: Record<AgendaEventStatus, string> = {
  aguardando_confirmacao: "Aguardando",
  cancelado: "Cancelado",
  confirmado: "Confirmado",
  lembrete: "Lembrete",
};

const statusBadgeStyles: Record<AgendaEventStatus, string> = {
  aguardando_confirmacao: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700",
  cancelado: "bg-destructive/10 text-destructive border-destructive/20 line-through",
  confirmado: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700",
  lembrete: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
};

const eventTypeColors: Record<AgendaEventType, { bg: string; text: string; border: string; dot: string }> = {
  atendimento: { bg: "bg-primary/5", text: "text-primary", border: "border-primary/30", dot: "bg-primary" },
  reuniao: { bg: "bg-indigo-500/5", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-300 dark:border-indigo-700", dot: "bg-indigo-500" },
  evento: { bg: "bg-violet-500/5", text: "text-violet-600 dark:text-violet-400", border: "border-violet-300 dark:border-violet-700", dot: "bg-violet-500" },
};

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
  const { clinic, clinicId, loading: authLoading, user } = useAuth();

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

  // Filters
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal Novo Agendamento
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEventType, setAddEventType] = useState<AgendaEventType>("atendimento");
  const [addPatientQuery, setAddPatientQuery] = useState("");
  const [addPatientComboboxOpen, setAddPatientComboboxOpen] = useState(false);
  const [addSelectedPatient, setAddSelectedPatient] = useState<AgendaPatientOption | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addDate, setAddDate] = useState<Date>(new Date());
  const [addTime, setAddTime] = useState(() => getDefaultNewEventTime());
  const [savingAdd, setSavingAdd] = useState(false);

  // Modal Edicao / Detalhes de Agendamento
  const [selectedEvent, setSelectedEvent] = useState<AgendaEventItem | null>(null);
  const [editStatus, setEditStatus] = useState<AgendaEventStatus>("aguardando_confirmacao");
  const [editTime, setEditTime] = useState("09:00");
  const [editDate, setEditDate] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchAgendaData = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const eventsRequest = clinicId
        ? supabase
            .from("agenda_events")
            .select("id, event_type, patient_id, status, title, scheduled_for")
            .eq("clinic_id", clinicId)
            .order("scheduled_for", { ascending: true })
        : supabase
            .from("agenda_events")
            .select("id, event_type, patient_id, status, title, scheduled_for")
            .order("scheduled_for", { ascending: true });

      const patientsRequest = clinicId
        ? supabase
            .from("patients")
            .select("id, name")
            .eq("clinic_id", clinicId)
            .order("name", { ascending: true })
        : supabase
            .from("patients")
            .select("id, name")
            .order("name", { ascending: true });

      const [eventsRes, patientsRes] = await Promise.all([eventsRequest, patientsRequest]);

      if (eventsRes.error) {
        toast({ title: "Erro ao carregar agenda", description: eventsRes.error.message, variant: "destructive" });
      } else {
        setEvents(
          (eventsRes.data ?? []).map((ev) => ({
            id: ev.id,
            eventType: ev.event_type as AgendaEventType,
            patientId: ev.patient_id,
            scheduledFor: ev.scheduled_for,
            status: normalizeStatus(ev.status),
            title: ev.title,
            date: parseISO(ev.scheduled_for),
            time: format(parseISO(ev.scheduled_for), "HH:mm"),
          }))
        );
      }

      if (patientsRes.error) {
        toast({ title: "Erro ao carregar pacientes", description: patientsRes.error.message, variant: "destructive" });
      } else {
        setPatients(Array.isArray(patientsRes.data) ? patientsRes.data : []);
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, clinicId, user?.id]);

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

  // Filtragem dos eventos
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (filterType !== "all" && ev.eventType !== filterType) return false;
      if (filterStatus !== "all" && ev.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const patient = patients.find((p) => p.id === ev.patientId);
        const matchesPatient = patient?.name.toLowerCase().includes(q);
        if (!matchesTitle && !matchesPatient) return false;
      }
      return true;
    });
  }, [events, filterType, filterStatus, searchQuery, patients]);

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

  // Resumo de Metricas para o dia
  const dayStats = useMemo(() => {
    const total = dayEvents.length;
    const confirmados = dayEvents.filter((e) => e.status === "confirmado").length;
    const aguardando = dayEvents.filter((e) => e.status === "aguardando_confirmacao").length;
    const cancelados = dayEvents.filter((e) => e.status === "cancelado").length;
    return { total, confirmados, aguardando, cancelados };
  }, [dayEvents]);

  // Handlers de navegacao de data
  const handlePrev = () => {
    if (viewMode === "day") setSelectedDate((d) => subDays(d, 1));
    else if (viewMode === "week") setSelectedDate((d) => addDays(d, -7));
    else setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const handleNext = () => {
    if (viewMode === "day") setSelectedDate((d) => addDays(d, 1));
    else if (viewMode === "week") setSelectedDate((d) => addDays(d, 7));
    else setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  // Abrir Modal de Novo Agendamento
  const handleOpenAddModal = (presetDate?: Date, presetTime?: string) => {
    setAddDate(presetDate || selectedDate);
    setAddTime(presetTime || getDefaultNewEventTime());
    setAddTitle("");
    setAddSelectedPatient(null);
    setAddEventType("atendimento");
    setAddPatientQuery("");
    setShowAddModal(true);
  };

  // Salvar Novo Agendamento
  const handleSaveAdd = async () => {
    if (!user) return;
    const scheduledDateTime = getAgendaEventDateTime(addDate, addTime);

    try {
      assertAgendaEventDateTimeIsFuture(scheduledDateTime);
    } catch (err) {
      toast({
        title: "Horário inválido",
        description: err instanceof Error ? err.message : AGENDA_PAST_EVENT_ERROR_MESSAGE,
        variant: "destructive",
      });
      return;
    }

    const { error: resolveError, patientId: resolvedPatientId, title: resolvedTitle } = resolvePatientSelection({
      eventType: addEventType,
      fixedPatient: null,
      selectedPatient: addSelectedPatient,
      title: addTitle,
    });

    if (resolveError) {
      toast({ title: "Preencha os campos obrigatórios", description: resolveError, variant: "destructive" });
      return;
    }

    setSavingAdd(true);
    try {
      const payload = buildAgendaEventPayload({
        clinicId: clinicId ?? null,
        eventType: addEventType,
        patientId: resolvedPatientId,
        scheduledFor: scheduledDateTime.toISOString(),
        title: resolvedTitle,
        userId: user.id,
      });

      const { data, error } = await supabase.from("agenda_events").insert(payload).select().single();
      if (error) throw error;

      if (data) {
        setEvents((prev) => [
          ...prev,
          {
            id: data.id,
            eventType: data.event_type as AgendaEventType,
            patientId: data.patient_id,
            scheduledFor: data.scheduled_for,
            status: normalizeStatus(data.status),
            title: data.title,
            date: parseISO(data.scheduled_for),
            time: format(parseISO(data.scheduled_for), "HH:mm"),
          },
        ]);
      }

      notifyAgendaEventsUpdated();
      setShowAddModal(false);
      toast({ title: "Agendamento criado com sucesso" });
    } catch (err) {
      toast({
        title: "Erro ao criar agendamento",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSavingAdd(false);
    }
  };

  // Abrir Modal de Edicao
  const handleOpenEditModal = (ev: AgendaEventItem) => {
    setSelectedEvent(ev);
    setEditStatus(ev.status);
    setEditTime(ev.time);
    setEditDate(format(ev.date, "yyyy-MM-dd"));
  };

  // Salvar Edicao
  const handleSaveEdit = async () => {
    if (!selectedEvent || !user) return;
    setSavingEdit(true);

    try {
      const newDateTime = new Date(`${editDate}T${editTime}:00`);
      const { error } = await supabase
        .from("agenda_events")
        .update({
          status: editStatus,
          scheduled_for: newDateTime.toISOString(),
        })
        .eq("id", selectedEvent.id);

      if (error) throw error;

      setEvents((prev) =>
        prev.map((e) =>
          e.id === selectedEvent.id
            ? {
                ...e,
                status: editStatus,
                scheduledFor: newDateTime.toISOString(),
                date: newDateTime,
                time: editTime,
              }
            : e
        )
      );

      notifyAgendaEventsUpdated();
      setSelectedEvent(null);
      toast({ title: "Agendamento atualizado" });
    } catch (err) {
      toast({
        title: "Erro ao atualizar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // Excluir Agendamento
  const handleDeleteEvent = async (id: string) => {
    try {
      const { error } = await supabase.from("agenda_events").delete().eq("id", id);
      if (error) throw error;

      setEvents((prev) => prev.filter((e) => e.id !== id));
      notifyAgendaEventsUpdated();
      setSelectedEvent(null);
      toast({ title: "Agendamento excluído" });
    } catch (err) {
      toast({
        title: "Erro ao excluir",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Filtragem de pacientes no autocomplete
  const filteredAutocompletePatients = useMemo(() => {
    const q = addPatientQuery.trim().toLowerCase();
    if (!q) return patients.slice(0, 10);
    return patients.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 10);
  }, [addPatientQuery, patients]);

  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-5 overflow-y-auto px-4 pb-24 pt-4 sm:p-6 lg:px-8">
      {/* Top Header */}
      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={() => navigate(clinicHomePath)}
            aria-label="Voltar para a página inicial"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Agenda da Clínica
              </h1>
              <ComponentHelpButton helpId="agenda-widget" size="sm" />
            </div>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Visualização expandida de agendamentos, reuniões e eventos.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Modo de Visualizacao */}
          <div className="inline-flex rounded-xl border bg-muted/30 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={cn(
                "rounded-lg px-3 py-1.5 font-medium transition-colors",
                viewMode === "day"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={cn(
                "rounded-lg px-3 py-1.5 font-medium transition-colors",
                viewMode === "week"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={cn(
                "rounded-lg px-3 py-1.5 font-medium transition-colors",
                viewMode === "month"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mês
            </button>
          </div>

          <Button
            type="button"
            className="gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
            onClick={() => handleOpenAddModal()}
          >
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </Button>
        </div>
      </header>

      {/* Date Navigation & Summary Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border bg-card p-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={handlePrev}
            aria-label="Período anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-xs"
            onClick={handleToday}
          >
            Hoje
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={handleNext}
            aria-label="Próximo período"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="gap-2 text-sm font-semibold capitalize text-foreground hover:bg-muted/50"
              >
                <CalendarIcon className="h-4 w-4 text-primary" />
                {viewMode === "day" && format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                {viewMode === "week" &&
                  `Semana de ${format(weekDays[0], "dd/MM")} a ${format(weekDays[6], "dd/MM/yyyy")}`}
                {viewMode === "month" && format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
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

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs">
          <Badge variant="outline" className="gap-1 border-primary/20 bg-primary/5 text-primary">
            <Clock className="h-3 w-3" />
            {dayStats.total} total no dia
          </Badge>
          <Badge variant="outline" className="gap-1 border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" />
            {dayStats.confirmados} confirmados
          </Badge>
          <Badge variant="outline" className="gap-1 border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400">
            {dayStats.aguardando} aguardando
          </Badge>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente ou título..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 rounded-xl text-xs"
          />
        </div>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-9 w-[140px] rounded-xl text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os tipos</SelectItem>
            <SelectItem value="atendimento" className="text-xs">Atendimento</SelectItem>
            <SelectItem value="reuniao" className="text-xs">Reunião</SelectItem>
            <SelectItem value="evento" className="text-xs">Evento</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-[150px] rounded-xl text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os status</SelectItem>
            <SelectItem value="confirmado" className="text-xs">Confirmado</SelectItem>
            <SelectItem value="aguardando_confirmacao" className="text-xs">Aguardando</SelectItem>
            <SelectItem value="cancelado" className="text-xs">Cancelado</SelectItem>
            <SelectItem value="lembrete" className="text-xs">Lembrete</SelectItem>
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

      {/* Main Agenda View Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : viewMode === "day" ? (
        /* DAY TIMELINE VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0">
          {/* Timeline list (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-3 min-w-0">
            {dayEvents.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed">
                <CalendarDays className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-semibold text-foreground">Nenhum agendamento neste dia</p>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Não há atendimentos ou eventos marcados para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-4 gap-1.5 rounded-xl text-xs"
                  onClick={() => handleOpenAddModal(selectedDate)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agendar horário
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {dayEvents.map((ev) => {
                  const typeStyle = eventTypeColors[ev.eventType];
                  const patient = patients.find((p) => p.id === ev.patientId);

                  return (
                    <Card
                      key={ev.id}
                      onClick={() => handleOpenEditModal(ev)}
                      className={cn(
                        "transition-all hover:shadow-md cursor-pointer border-l-4",
                        ev.eventType === "atendimento"
                          ? "border-l-primary"
                          : ev.eventType === "reuniao"
                          ? "border-l-indigo-500"
                          : "border-l-violet-500"
                      )}
                    >
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="flex flex-col items-center justify-center rounded-xl bg-muted/40 p-2 min-w-[58px] text-center shrink-0">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
                            <span className="text-sm font-bold text-foreground leading-tight">{ev.time}</span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground text-sm truncate">
                                {ev.title}
                              </span>
                              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 capitalize", statusBadgeStyles[ev.status])}>
                                {agendaStatusLabels[ev.status]}
                              </Badge>
                            </div>

                            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <span className={cn("h-2 w-2 rounded-full", typeStyle.dot)} />
                                {eventTypeLabels[ev.eventType]}
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

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-primary hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(ev);
                            }}
                          >
                            Editar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mini Calendar & Summary (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Navegação no Mês
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  locale={ptBR}
                  className="rounded-md border-0"
                />
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Próximos Compromissos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2 text-xs">
                {filteredEvents
                  .filter((e) => e.date >= new Date())
                  .slice(0, 5)
                  .map((nextEv) => (
                    <div
                      key={nextEv.id}
                      onClick={() => handleOpenEditModal(nextEv)}
                      className="flex items-center justify-between p-2 rounded-lg bg-background border hover:border-primary/40 cursor-pointer transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{nextEv.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(nextEv.date, "dd/MM 'às' HH:mm")}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn("text-[9px] px-1 py-0", statusBadgeStyles[nextEv.status])}>
                        {agendaStatusLabels[nextEv.status]}
                      </Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : viewMode === "week" ? (
        /* WEEK VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 min-w-0 overflow-x-auto">
          {weekDays.map((day) => {
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDate);
            const eventsForDay = filteredEvents.filter((e) => isSameDay(e.date, day));

            return (
              <Card
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "flex flex-col min-h-[300px] cursor-pointer transition-all hover:border-primary/40",
                  isSelected && "ring-2 ring-primary border-primary",
                  isToday && "bg-primary/[0.02]"
                )}
              >
                <div className="p-2.5 border-b flex items-center justify-between">
                  <div className="text-left">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      {format(day, "EEE", { locale: ptBR })}
                    </span>
                    <span className={cn("text-base font-bold leading-tight", isToday ? "text-primary" : "text-foreground")}>
                      {format(day, "dd")}
                    </span>
                  </div>
                  {eventsForDay.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      {eventsForDay.length}
                    </Badge>
                  )}
                </div>

                <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
                  {eventsForDay.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/60 text-center py-6">Sem agendamentos</p>
                  ) : (
                    eventsForDay.map((e) => (
                      <div
                        key={e.id}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handleOpenEditModal(e);
                        }}
                        className={cn(
                          "p-1.5 rounded-lg border text-left text-[11px] hover:shadow-xs transition-shadow",
                          e.eventType === "atendimento" ? "bg-primary/5 border-primary/20 text-primary" : "bg-muted/40 border-border"
                        )}
                      >
                        <p className="font-semibold truncate">{e.title}</p>
                        <p className="text-[10px] text-muted-foreground">{e.time}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 border-t mt-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleOpenAddModal(day);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* MONTH VIEW */
        <Card className="p-4">
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => {
                if (d) {
                  setSelectedDate(d);
                  setViewMode("day");
                }
              }}
              locale={ptBR}
              className="rounded-md border p-3 w-full max-w-2xl"
            />
          </div>
        </Card>
      )}

      {/* DIALOG NOVO AGENDAMENTO */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-md sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle>Novo Agendamento</DialogTitle>
            <DialogDescription>
              Crie um novo agendamento, atendimento ou evento na agenda.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de agendamento</Label>
              <Select value={addEventType} onValueChange={(v) => setAddEventType(v as AgendaEventType)}>
                <SelectTrigger className="h-9 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="atendimento" className="text-xs">Atendimento</SelectItem>
                  <SelectItem value="reuniao" className="text-xs">Reunião</SelectItem>
                  <SelectItem value="evento" className="text-xs">Evento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {addEventType === "atendimento" ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Paciente</Label>
                <Popover open={addPatientComboboxOpen} onOpenChange={setAddPatientComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={addPatientComboboxOpen}
                      className="h-9 w-full justify-between rounded-xl text-xs"
                    >
                      {addSelectedPatient ? addSelectedPatient.name : "Selecionar paciente..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Buscar paciente..."
                        value={addPatientQuery}
                        onValueChange={setAddPatientQuery}
                        className="h-9 text-xs"
                      />
                      <CommandList>
                        <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">
                          Nenhum paciente encontrado.
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredAutocompletePatients.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.name}
                              onSelect={() => {
                                setAddSelectedPatient(p);
                                setAddPatientComboboxOpen(false);
                              }}
                              className="text-xs"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  addSelectedPatient?.id === p.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {p.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Título</Label>
                <Input
                  placeholder="Ex: Reunião de equipe"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-start text-xs rounded-xl font-normal">
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      {format(addDate, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={addDate}
                      onSelect={(d) => d && setAddDate(d)}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Horário</Label>
                <Input
                  type="time"
                  value={addTime}
                  onChange={(e) => setAddTime(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddModal(false)}
              disabled={savingAdd}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveAdd}
              disabled={savingAdd}
              className="gap-1.5"
            >
              {savingAdd && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG EDITAR / EXCLUIR AGENDAMENTO */}
      {selectedEvent && (
        <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
          <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-md sm:p-6">
            <DialogHeader className="text-left">
              <DialogTitle>{selectedEvent.title}</DialogTitle>
              <DialogDescription>
                Gerencie os detalhes ou altere o status deste compromisso.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Status do agendamento</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as AgendaEventStatus)}>
                  <SelectTrigger className="h-9 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aguardando_confirmacao" className="text-xs">Aguardando confirmação</SelectItem>
                    <SelectItem value="confirmado" className="text-xs">Confirmado</SelectItem>
                    <SelectItem value="cancelado" className="text-xs">Cancelado</SelectItem>
                    <SelectItem value="lembrete" className="text-xs">Lembrete</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Data</Label>
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Horário</Label>
                  <Input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteEvent(selectedEvent.id)}
                disabled={savingEdit}
              >
                Excluir
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedEvent(null)}
                  disabled={savingEdit}
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="gap-1.5"
                >
                  {savingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Atualizar
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
