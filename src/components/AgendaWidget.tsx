import { useCallback, useEffect, useMemo, useState } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Check, ChevronLeft, ChevronRight, ChevronsUpDown, Clock, Loader2, Maximize2, Plus, X, Play } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { getDesignLabButtonClass, designLabIconClass, designLabLabelClass } from "@/lib/design-animations";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  AGENDA_EVENTS_UPDATED_EVENT,
  AGENDA_PAST_EVENT_ERROR_MESSAGE,
  assertAgendaEventDateTimeIsFuture,
  buildAgendaEventPayload,
  getAgendaEventDateTime,
  isAgendaEventDateTimeInPast,
  notifyAgendaEventsUpdated,
  resolvePatientSelection,
  type AgendaEventStatus,
  type AgendaEventType,
  type AgendaPatientOption,
} from "@/lib/agenda-events";
import { INPUT_LIMITS, sanitizeSingleLineInput } from "@/lib/input-security";
import type { Database } from "@/integrations/supabase/types";

type Session = Database["public"]["Tables"]["sessions"]["Row"];

interface AgendaEvent {
  eventType: AgendaEventType;
  id: string;
  patientId: string | null;
  scheduledFor: string;
  status: AgendaEventStatus;
  title: string;
  date: Date;
  time: string;
}

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

const agendaStatusStyles: Record<AgendaEventStatus, string> = {
  aguardando_confirmacao: "bg-warning/15 text-warning border-warning/20",
  cancelado: "bg-destructive/15 text-destructive border-destructive/20",
  confirmado: "bg-success/15 text-success border-success/20",
  lembrete: "bg-primary/10 text-primary border-primary/20",
};

const normalizeAgendaStatus = (status: string | null | undefined): AgendaEventStatus => {
  if (status === "lembrete" || status === "aguardando_confirmacao" || status === "confirmado" || status === "cancelado") {
    return status;
  }

  return "aguardando_confirmacao";
};

const agendaStatusOptions: { value: AgendaEventStatus; label: string }[] = [
  { value: "lembrete", label: "Lembrete" },
  { value: "aguardando_confirmacao", label: "Aguardando confirmação" },
  { value: "confirmado", label: "Confirmado" },
  { value: "cancelado", label: "Cancelado" },
];

const agendaDeleteOption = { value: "delete" as const, label: "Excluir agendamento" };

type AgendaStatusAction = AgendaEventStatus | "delete";

const getDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getLocalDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getLocalDayTimestamp = (date = new Date()) => getLocalDay(date).getTime();

const getTimeInputValue = (value: string) => {
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
};

const getDefaultNewEventTime = () => {
  const nextSlot = new Date();
  nextSlot.setMinutes(nextSlot.getMinutes() + 30, 0, 0);
  return getTimeInputValue(nextSlot.toISOString());
};

const formatAgendaEventDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });

interface AgendaWidgetProps {
  fixedPatient?: AgendaPatientOption;
  headerAccessory?: React.ReactNode;
  onStartAttendance?: () => void;
  startAttendanceLabel?: string;
  showExpandButton?: boolean;
  variant?: "card" | "modal";
}

const AgendaWidget = ({
  fixedPatient,
  headerAccessory,
  onStartAttendance,
  startAttendanceLabel,
  showExpandButton,
  variant = "card",
}: AgendaWidgetProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clinicKey } = useParams<{ clinicKey?: string }>();
  const { can, clinic, clinicId, user } = useAuth();
  const isDesignLab = location.pathname.startsWith("/designlab");
  const effectiveClinicKey = clinicKey || clinic?.route_key;
  const canExpand = isDesignLab && (showExpandButton ?? true);
  const fullAgendaPath = effectiveClinicKey
    ? `/designlab/clinica/${effectiveClinicKey}/agenda`
    : "/designlab/agenda";
  const fixedPatientId = fixedPatient?.id ?? null;
  const fixedPatientName = fixedPatient?.name ?? null;
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [patients, setPatients] = useState<AgendaPatientOption[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [eventType, setEventType] = useState<AgendaEventType>("atendimento");
  const [patientQuery, setPatientQuery] = useState("");
  const [patientComboboxOpen, setPatientComboboxOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<AgendaPatientOption | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState(() => getDefaultNewEventTime());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [selectedStatusAction, setSelectedStatusAction] = useState<AgendaStatusAction>("aguardando_confirmacao");
  const [selectedEventDate, setSelectedEventDate] = useState(getDateInputValue());
  const [selectedEventTime, setSelectedEventTime] = useState("09:00");
  const [savingSelectedEvent, setSavingSelectedEvent] = useState(false);

  const fetchAgendaData = useCallback(async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    if (!user) return;

    if (showLoading) {
      setLoading(true);
    }

    const eventsBase = supabase
      .from("agenda_events")
      .select("id, event_type, patient_id, status, title, scheduled_for");
    const eventsRequest = clinicId
      ? eventsBase.eq("clinic_id", clinicId).order("scheduled_for", { ascending: true })
      : eventsBase.order("scheduled_for", { ascending: true });

    const patientsBase = supabase
      .from("patients")
      .select("id, name");
    const patientsRequest = fixedPatientId
      ? Promise.resolve({ data: [] as AgendaPatientOption[], error: null })
      : clinicId
        ? patientsBase.eq("clinic_id", clinicId).order("name", { ascending: true })
        : patientsBase.order("name", { ascending: true });

    const [eventsRes, patientsRes] = await Promise.all([eventsRequest, patientsRequest]);

    if (eventsRes.error) {
      toast({ title: "Erro ao carregar agenda", description: eventsRes.error.message, variant: "destructive" });
    }

    if (patientsRes.error) {
      toast({ title: "Erro ao carregar pacientes", description: patientsRes.error.message, variant: "destructive" });
    }

    setEvents(
      (eventsRes.data ?? []).map((event) => ({
        id: event.id,
        eventType: event.event_type as AgendaEventType,
        patientId: event.patient_id,
        scheduledFor: event.scheduled_for,
        status: normalizeAgendaStatus(event.status),
        title: event.title,
        date: parseISO(event.scheduled_for),
        time: format(parseISO(event.scheduled_for), "HH:mm"),
      }))
    );
    setPatients(Array.isArray(patientsRes.data) ? patientsRes.data : []);
    setLoading(false);
  }, [clinicId, fixedPatientId, user]);

  useEffect(() => {
    void fetchAgendaData();
  }, [fetchAgendaData]);

  useEffect(() => {
    const handleAgendaEventsUpdated = () => {
      void fetchAgendaData({ showLoading: false });
    };

    window.addEventListener(AGENDA_EVENTS_UPDATED_EVENT, handleAgendaEventsUpdated);

    return () => {
      window.removeEventListener(AGENDA_EVENTS_UPDATED_EVENT, handleAgendaEventsUpdated);
    };
  }, [fetchAgendaData]);

  const scopedEvents = useMemo(
    () => (fixedPatientId ? events.filter((event) => event.patientId === fixedPatientId) : events),
    [events, fixedPatientId]
  );

  const dayEvents = useMemo(
    () =>
      scopedEvents
        .filter((event) => isSameDay(event.date, selectedDate))
        .sort((first, second) => first.time.localeCompare(second.time)),
    [scopedEvents, selectedDate]
  );

  const todayDay = useMemo(() => getLocalDay(), []);
  const selectedDayTimestamp = useMemo(() => getLocalDayTimestamp(selectedDate), [selectedDate]);

  const {
    datesWithEvents,
    eventsAfterSelectedDate,
    eventsBeforeSelectedDate,
    eventsFromToday,
    nextEventDate,
    previousEventDate,
  } = useMemo(() => {
    const fromToday = scopedEvents.filter((event) => getLocalDayTimestamp(event.date) >= todayDay.getTime());
    const dates = fromToday.map((event) => event.date);
    const beforeSelected = fromToday.filter((event) => getLocalDayTimestamp(event.date) < selectedDayTimestamp);
    const afterSelected = fromToday.filter((event) => getLocalDayTimestamp(event.date) > selectedDayTimestamp);
    const prevDate = beforeSelected
      .map((event) => getLocalDay(event.date))
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
    const nextDate = afterSelected
      .map((event) => getLocalDay(event.date))
      .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;

    return {
      datesWithEvents: dates,
      eventsAfterSelectedDate: afterSelected,
      eventsBeforeSelectedDate: beforeSelected,
      eventsFromToday: fromToday,
      nextEventDate: nextDate,
      previousEventDate: prevDate,
    };
  }, [scopedEvents, selectedDayTimestamp, todayDay]);

  const newEventDateTime = useMemo(
    () => (newTime ? getAgendaEventDateTime(selectedDate, newTime) : null),
    [newTime, selectedDate]
  );
  const isNewEventDateTimePast = useMemo(
    () => (newEventDateTime ? isAgendaEventDateTimeInPast(newEventDateTime) : false),
    [newEventDateTime]
  );
  const selectedEventDateTime = useMemo(
    () => (selectedEventDate && selectedEventTime ? new Date(`${selectedEventDate}T${selectedEventTime || "00:00"}:00`) : null),
    [selectedEventDate, selectedEventTime]
  );
  const isSelectedEventDateTimePast = useMemo(
    () => (selectedEventDateTime ? isAgendaEventDateTimeInPast(selectedEventDateTime) : false),
    [selectedEventDateTime]
  );
  const filteredPatients = useMemo(() => {
    const query = patientQuery.trim().toLowerCase();

    if (!query) {
      return patients.slice(0, 8);
    }

    return patients
      .filter((patient) => patient.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [patientQuery, patients]);

  const canSave = useMemo(() => {
    if (!user || saving || isNewEventDateTimePast) return false;
    if (eventType === "atendimento") {
      return Boolean((fixedPatientId || selectedPatient) && newTime);
    }
    return Boolean(newTitle.trim() && newTime);
  }, [eventType, fixedPatientId, isNewEventDateTimePast, newTime, newTitle, saving, selectedPatient, user]);

  const resetDialog = () => {
    setEventType("atendimento");
    setPatientQuery("");
    setPatientComboboxOpen(false);
    setSelectedPatient(null);
    setNewTitle("");
    setNewTime(getDefaultNewEventTime());
    setShowAdd(false);
  };

  const handleOpenAddDialog = () => {
    setNewTime(getDefaultNewEventTime());
    setShowAdd(true);
  };

  const handleEventTypeChange = (value: AgendaEventType) => {
    setEventType(value);
    setPatientQuery("");
    setPatientComboboxOpen(false);
    setSelectedPatient(null);
    setNewTitle("");
  };

  const handlePatientQueryChange = (value: string) => {
    const sanitizedQuery = sanitizeSingleLineInput(value, INPUT_LIMITS.name);
    setPatientQuery(sanitizedQuery);
    setSelectedPatient(resolvePatientSelection(sanitizedQuery, patients));
  };

  const handleTitleChange = (value: string) => {
    setNewTitle(sanitizeSingleLineInput(value, INPUT_LIMITS.agendaTitle));
  };

  const handleSelectPatient = (patient: AgendaPatientOption) => {
    const sanitizedName = sanitizeSingleLineInput(patient.name, INPUT_LIMITS.name);
    setPatientQuery(sanitizedName);
    setSelectedPatient(patient);
    setPatientComboboxOpen(false);
  };

  const handleAdd = async () => {
    if (!user) return;

    try {
      assertAgendaEventDateTimeIsFuture(getAgendaEventDateTime(selectedDate, newTime));
      setSaving(true);
      const payload = buildAgendaEventPayload({
        clinicId,
        eventType,
        selectedDate,
        selectedPatient: fixedPatientId && fixedPatientName ? { id: fixedPatientId, name: fixedPatientName } : selectedPatient,
        time: newTime,
        title: newTitle,
        userId: user.id,
      });

      const { data, error } = await supabase
        .from("agenda_events")
        .insert(payload)
        .select("id, event_type, patient_id, status, title, scheduled_for")
        .single();

      if (error) {
        throw error;
      }

      setEvents((previous) => [
        ...previous,
        {
          id: data.id,
          eventType: data.event_type as AgendaEventType,
          patientId: data.patient_id,
          scheduledFor: data.scheduled_for,
          status: normalizeAgendaStatus(data.status),
          title: data.title,
          date: parseISO(data.scheduled_for),
          time: format(parseISO(data.scheduled_for), "HH:mm"),
        },
      ]);

      notifyAgendaEventsUpdated();
      toast({ title: "Agendamento confirmado" });
      resetDialog();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel salvar o agendamento.";
      toast({ title: "Erro ao salvar agendamento", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEventDetails = (event: AgendaEvent) => {
    setSelectedEvent(event);
    setSelectedStatusAction(event.status);
    setSelectedEventDate(getDateInputValue(event.date));
    setSelectedEventTime(getTimeInputValue(event.scheduledFor));
  };

  const handleApplyEventStatus = async () => {
    if (!selectedEvent || !user) {
      return;
    }

    try {
      setSavingSelectedEvent(true);

      if (selectedStatusAction === "delete") {
        if (!can("agenda.delete_events")) {
          toast({
            title: "Permissão negada",
            description: "Você não tem permissão para excluir agendamentos.",
            variant: "destructive",
          });
          return;
        }

        const deleteQuery = supabase.from("agenda_events").delete().eq("id", selectedEvent.id);
        const { error } = clinicId ? await deleteQuery.eq("clinic_id", clinicId) : await deleteQuery;

        if (error) {
          throw error;
        }

        setEvents((previous) => previous.filter((event) => event.id !== selectedEvent.id));
        setSelectedEvent(null);
        notifyAgendaEventsUpdated();
        toast({ title: "Agendamento excluído" });
        return;
      }

      const previousStatus = selectedEvent.status;
      const { data, error } = await supabase
        .from("agenda_events")
        .update({ status: selectedStatusAction })
        .eq("id", selectedEvent.id)
        .select("id, event_type, patient_id, status, title, scheduled_for")
        .single();

      if (error) {
        throw error;
      }

      const updatedEvent: AgendaEvent = {
        id: data.id,
        eventType: data.event_type as AgendaEventType,
        patientId: data.patient_id,
        scheduledFor: data.scheduled_for,
        status: normalizeAgendaStatus(data.status),
        title: data.title,
        date: parseISO(data.scheduled_for),
        time: format(parseISO(data.scheduled_for), "HH:mm"),
      };

      setEvents((previous) =>
        previous
          .map((event) => (event.id === updatedEvent.id ? updatedEvent : event))
          .sort((first, second) => first.scheduledFor.localeCompare(second.scheduledFor))
      );
      setSelectedEvent(updatedEvent);

      if (selectedStatusAction === "cancelado" && previousStatus !== "cancelado" && selectedEvent.patientId) {
        const canceledGroupRes = await supabase
          .from("patient_groups")
          .select("id, group_kind, is_default")
          .eq("patient_id", selectedEvent.patientId);

        const canceledGroup = (canceledGroupRes.data ?? []).find((group) => group.group_kind === "cancelados") ?? null;

        const { error: sessionError } = await supabase
          .from("sessions")
          .insert({
            clinic_id: clinicId,
            group_id: canceledGroup?.id ?? null,
            notes: "Atendimento cancelado a partir da agenda da homepage.",
            patient_id: selectedEvent.patientId,
            provider_id: user.id,
            session_date: selectedEvent.scheduledFor,
            status: "cancelado",
            user_id: user.id,
          });

        if (sessionError) {
          throw sessionError;
        }
      }

      notifyAgendaEventsUpdated();
      toast({ title: "Status do agendamento atualizado" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel atualizar o agendamento.";
      toast({ title: "Erro ao atualizar agendamento", description: message, variant: "destructive" });
    } finally {
      setSavingSelectedEvent(false);
    }
  };

  const handleUpdateSelectedDateTime = async () => {
    if (!selectedEvent) {
      return;
    }

    try {
      setSavingSelectedEvent(true);
      const nextDate = new Date(`${selectedEventDate}T${selectedEventTime || "00:00"}:00`);
      assertAgendaEventDateTimeIsFuture(nextDate);
      const { data, error } = await supabase
        .from("agenda_events")
        .update({ scheduled_for: nextDate.toISOString() })
        .eq("id", selectedEvent.id)
        .select("id, event_type, patient_id, status, title, scheduled_for")
        .single();

      if (error) {
        throw error;
      }

      const updatedEvent: AgendaEvent = {
        id: data.id,
        eventType: data.event_type as AgendaEventType,
        patientId: data.patient_id,
        scheduledFor: data.scheduled_for,
        status: normalizeAgendaStatus(data.status),
        title: data.title,
        date: parseISO(data.scheduled_for),
        time: format(parseISO(data.scheduled_for), "HH:mm"),
      };

      setEvents((previous) =>
        previous
          .map((event) => (event.id === updatedEvent.id ? updatedEvent : event))
          .sort((first, second) => first.scheduledFor.localeCompare(second.scheduledFor))
      );
      setSelectedEvent(updatedEvent);
      notifyAgendaEventsUpdated();
      toast({ title: "Data e horário atualizados" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel trocar data/horario.";
      toast({ title: "Erro ao trocar data/horário", description: message, variant: "destructive" });
    } finally {
      setSavingSelectedEvent(false);
    }
  };

  const handleStartAttendanceFromEvent = () => {
    if (!selectedEvent?.patientId) {
      return;
    }

    navigate(`/pacientes/${selectedEvent.patientId}/sessao/novo`, {
      state: {
        agendaEventId: selectedEvent.id,
        scheduledFor: selectedEvent.scheduledFor,
      },
    });
  };

  const handleStartAttendanceNow = () => {
    if (!fixedPatientId) {
      return;
    }

    navigate(`/pacientes/${fixedPatientId}/sessao/novo`);
  };

  const handleRemove = async (id: string) => {
    if (!can("agenda.delete_events")) {
      toast({
        title: "Permissão negada",
        description: "Você não tem permissão para excluir agendamentos.",
        variant: "destructive",
      });
      return;
    }

    const deleteQuery = supabase.from("agenda_events").delete().eq("id", id);
    const { error } = clinicId ? await deleteQuery.eq("clinic_id", clinicId) : await deleteQuery;

    if (error) {
      toast({ title: "Erro ao remover evento", description: error.message, variant: "destructive" });
      return;
    }

    setEvents((previous) => previous.filter((event) => event.id !== id));
    notifyAgendaEventsUpdated();
  };

  const isModal = variant === "modal";

  const content = (
    <div className={cn("space-y-3", isModal && "w-full min-w-0")}>
      <div data-tutorial="agenda-nav-arrows" className="grid grid-cols-[auto,minmax(0,1fr),auto] items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-9 w-9 shrink-0"
          disabled={!previousEventDate}
          onClick={() => previousEventDate && setSelectedDate(previousEventDate)}
          aria-label={`Ir para o dia anterior com agendamentos. ${eventsBeforeSelectedDate.length} agendamento${eventsBeforeSelectedDate.length !== 1 ? "s" : ""} antes desta data.`}
        >
          <ChevronLeft className="h-4 w-4" />
          {eventsBeforeSelectedDate.length > 0 ? (
            <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {eventsBeforeSelectedDate.length}
            </span>
          ) : null}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button data-tutorial="agenda-date-picker-btn" variant="outline" size="sm" className="w-full min-w-0 justify-start text-left font-normal">
              <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">{format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && getLocalDayTimestamp(date) >= todayDay.getTime() && setSelectedDate(date)}
              disabled={(date) => getLocalDayTimestamp(date) < todayDay.getTime()}
              className={cn("p-3 pointer-events-auto")}
              modifiers={{ hasEvent: datesWithEvents }}
              modifiersClassNames={{ hasEvent: "bg-primary/20 font-bold" }}
            />
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-9 w-9 shrink-0"
          disabled={!nextEventDate}
          onClick={() => nextEventDate && setSelectedDate(nextEventDate)}
          aria-label={`Ir para o próximo dia com agendamentos. ${eventsAfterSelectedDate.length} agendamento${eventsAfterSelectedDate.length !== 1 ? "s" : ""} depois desta data.`}
        >
          <ChevronRight className="h-4 w-4" />
          {eventsAfterSelectedDate.length > 0 ? (
            <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {eventsAfterSelectedDate.length}
            </span>
          ) : null}
        </Button>
      </div>

      <div
        data-tutorial="agenda-events-list"
        className={cn(
          "space-y-1.5 overflow-y-auto overflow-x-hidden pr-1",
          isModal ? "max-h-64 sm:max-h-80" : "max-h-36"
        )}
      >
        {loading && (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
        {!loading && dayEvents.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Sem eventos</p>
        )}
        {dayEvents.map((event) => (
          <div
            key={event.id}
            data-tutorial="agenda-event-item"
            className="group flex min-w-0 cursor-pointer flex-col gap-1.5 overflow-hidden rounded bg-muted/50 p-2 text-xs transition-colors hover:bg-muted sm:flex-row sm:items-center"
            role="button"
            tabIndex={0}
            onClick={() => handleOpenEventDetails(event)}
            onPointerUp={(pointerEvent) => {
              if (pointerEvent.pointerType === "touch") {
                handleOpenEventDetails(event);
              }
            }}
            onKeyDown={(keyboardEvent) => {
              if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                keyboardEvent.preventDefault();
                handleOpenEventDetails(event);
              }
            }}
          >
            {/* Linha 1 no Mobile (< sm) / Alinhado inline no Desktop (sm:) */}
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:contents">
              <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                {event.time}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium sm:order-4">{event.title}</span>

              {/* Botões de Ação no Mobile (com alvos confortáveis) */}
              <div className="flex shrink-0 items-center gap-1 sm:hidden">
                {event.eventType === "atendimento" && event.patientId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 min-h-[36px] px-2 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 gap-1 shrink-0"
                    onClick={(eventClick) => {
                      eventClick.stopPropagation();
                      navigate(`/pacientes/${event.patientId}/sessao/novo`, {
                        state: {
                          agendaEventId: event.id,
                          scheduledFor: event.scheduledFor,
                        },
                      });
                    }}
                    title="Iniciar atendimento a partir deste agendamento"
                  >
                    <Play className="h-3.5 w-3.5 fill-primary text-primary" />
                    <span>Iniciar</span>
                  </Button>
                )}
                {can("agenda.delete_events") && (
                  <button
                    type="button"
                    onPointerUp={(eventPointer) => eventPointer.stopPropagation()}
                    onClick={(eventClick) => {
                      eventClick.stopPropagation();
                      void handleRemove(event.id);
                    }}
                    className="flex h-8 w-8 min-h-[36px] min-w-[36px] items-center justify-center text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="Excluir agendamento"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Linha 2 no Mobile (< sm) / Inline Badges no Desktop (sm:) */}
            <div className="flex min-w-0 flex-wrap items-center gap-1 sm:contents">
              <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                {eventTypeLabels[event.eventType]}
              </Badge>
              <Badge variant="outline" className={`shrink-0 text-[10px] ${agendaStatusStyles[event.status]}`}>
                {agendaStatusLabels[event.status]}
              </Badge>
            </div>

            {/* Ações Desktop (sm:) */}
            {event.eventType === "atendimento" && event.patientId && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="hidden sm:inline-flex h-7 px-2 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 gap-1 shrink-0"
                onClick={(eventClick) => {
                  eventClick.stopPropagation();
                  navigate(`/pacientes/${event.patientId}/sessao/novo`, {
                    state: {
                      agendaEventId: event.id,
                      scheduledFor: event.scheduledFor,
                    },
                  });
                }}
                title="Iniciar atendimento a partir deste agendamento"
              >
                <Play className="h-3 w-3 fill-primary text-primary shrink-0" />
                <span className="hidden min-[520px]:inline">Iniciar</span>
              </Button>
            )}
            {can("agenda.delete_events") && (
              <button
                type="button"
                onPointerUp={(eventPointer) => eventPointer.stopPropagation()}
                onClick={(eventClick) => {
                  eventClick.stopPropagation();
                  void handleRemove(event.id);
                }}
                className="ml-1 hidden sm:inline-flex shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                aria-label="Excluir agendamento"
              >
                <X className="h-3 w-3 shrink-0" />
              </button>
            )}
          </div>
        ))}
      </div>

      {fixedPatientId ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button data-tutorial="agenda-add-btn" variant="default" size="sm" className={getDesignLabButtonClass("hover:w-[120px]")} onClick={handleOpenAddDialog}>
            <Plus className={`${designLabIconClass} h-3.5 w-3.5`} />
            <span className={designLabLabelClass}>Agendar</span>
          </Button>
          <Button
            data-tutorial="agenda-quick-start"
            type="button"
            size="sm"
            className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-sm px-3.5 transition-all"
            onClick={onStartAttendance ?? handleStartAttendanceNow}
          >
            <Play className="h-3.5 w-3.5 fill-current text-white" />
            <span>{startAttendanceLabel ?? "Iniciar Atendimento Agora"}</span>
          </Button>
        </div>
      ) : (
        <Button data-tutorial="agenda-add-btn" variant="ghost" size="sm" className="w-full text-xs" onClick={handleOpenAddDialog}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar evento
        </Button>
      )}
    </div>
  );

  const containerContent = isModal ? (
    <div data-tutorial="agenda-widget" className="w-full min-w-0 space-y-3">
      {content}
    </div>
  ) : (
    <Card data-tutorial="agenda-widget" className="hover:shadow-md transition-shadow duration-150">
      <CardHeader className="space-y-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm font-medium text-muted-foreground">Agenda</CardTitle>
            <ComponentHelpButton helpId="agenda-widget" size="xs" />
          </div>
          <div className="flex items-center gap-2">
            {headerAccessory}
            {canExpand && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => navigate(fullAgendaPath)}
                title="Expandir agenda para tela cheia"
                aria-label="Expandir agenda para tela cheia"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            <div className="rounded-lg bg-primary/10 p-2">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {content}
      </CardContent>
    </Card>
  );

  return (
    <>
      {containerContent}

        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-sm sm:p-6">
            <DialogHeader>
              <DialogTitle>Novo evento — {format(selectedDate, "dd/MM/yyyy")}</DialogTitle>
              <DialogDescription>
                  Crie um novo agendamento usando a mesma agenda compartilhada da clínica.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(eventTypeLabels) as Array<[AgendaEventType, string]>).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={eventType === value ? "default" : "outline"}
                      onClick={() => handleEventTypeChange(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {eventType === "atendimento" && fixedPatientName ? (
                <div className="space-y-2">
                  <Label>Paciente</Label>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm font-medium">{fixedPatientName}</div>
                </div>
              ) : eventType === "atendimento" ? (
                <div className="space-y-2">
                  <Label>Paciente</Label>
                  <Popover open={patientComboboxOpen} onOpenChange={setPatientComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={patientComboboxOpen}
                        className="h-10 w-full justify-between px-3 text-left font-normal"
                      >
                        <span className={selectedPatient ? "truncate" : "truncate text-muted-foreground"}>
                          {selectedPatient?.name || "Busque e selecione um paciente"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command shouldFilter={false}>
                        <CommandInput
                          value={patientQuery}
                          onValueChange={handlePatientQueryChange}
                          placeholder="Buscar paciente..."
                          aria-label="Buscar paciente para agendamento"
                        />
                        <CommandList>
                          <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {filteredPatients.map((patient) => {
                              const selected = selectedPatient?.id === patient.id;

                              return (
                                <CommandItem
                                  key={patient.id}
                                  value={patient.name}
                                  onSelect={() => handleSelectPatient(patient)}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                  <span className="truncate">{patient.name}</span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {patientQuery && !selectedPatient && (
                    <p className="text-xs text-muted-foreground">
                      Selecione um paciente existente da lista para confirmar o atendimento.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={newTitle}
                    onChange={(event) => handleTitleChange(event.target.value)}
                    placeholder="Digite o título do evento"
                    maxLength={INPUT_LIMITS.agendaTitle}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Horário</Label>
                <Input type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} />
              </div>
              {isNewEventDateTimePast ? (
                <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  {AGENDA_PAST_EVENT_ERROR_MESSAGE}
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm" onClick={resetDialog}>Cancelar</Button>
              </DialogClose>
              <Button size="sm" onClick={handleAdd} disabled={!canSave}>
                {saving ? "Salvando..." : "Confirmar agendamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
          <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] grid-rows-none flex-col overflow-hidden p-0 sm:max-w-3xl">
            <DialogHeader className="shrink-0 border-b px-5 pb-3 pt-5 text-left">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Agendamento</p>
              <DialogTitle className="break-words pr-7 text-xl leading-tight sm:text-3xl">{selectedEvent?.title ?? "Agendamento"}</DialogTitle>
              <DialogDescription>
                Revise o horário, atualize o status ou inicie o atendimento a partir deste agendamento.
              </DialogDescription>
            </DialogHeader>

            {selectedEvent ? (
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-muted/25 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Horário</p>
                    <p className="mt-1 font-semibold">{formatAgendaEventDateTime(selectedEvent.scheduledFor)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/25 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Status atual</p>
                    <Badge variant="outline" className={`mt-1 ${agendaStatusStyles[selectedEvent.status]}`}>
                      {agendaStatusLabels[selectedEvent.status]}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Trocar status</Label>
                  <Select value={selectedStatusAction} onValueChange={(value) => setSelectedStatusAction(value as AgendaStatusAction)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {agendaStatusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                      {can("agenda.delete_events") && (
                        <SelectItem value={agendaDeleteOption.value} className="text-destructive focus:text-destructive">
                          {agendaDeleteOption.label}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {selectedStatusAction === "cancelado" ? (
                    <p className="text-xs text-muted-foreground">
                      Ao aplicar Cancelado, um atendimento vazio com status cancelado será registrado no histórico do paciente.
                    </p>
                  ) : selectedStatusAction === "delete" ? (
                    <p className="text-xs text-destructive">
                      Excluir remove apenas o agendamento da agenda. Nenhum atendimento será criado.
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr,1fr,auto] md:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="homepage-agenda-date">Nova data</Label>
                    <Input
                      id="homepage-agenda-date"
                      type="date"
                      value={selectedEventDate}
                      onChange={(event) => setSelectedEventDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="homepage-agenda-time">Novo horário</Label>
                    <Input
                      id="homepage-agenda-time"
                      type="time"
                      value={selectedEventTime}
                      onChange={(event) => setSelectedEventTime(event.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleUpdateSelectedDateTime()}
                    disabled={savingSelectedEvent || !selectedEventDate || !selectedEventTime || isSelectedEventDateTimePast}
                  >
                    Trocar data/horário
                  </Button>
                </div>
                {isSelectedEventDateTimePast ? (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                    {AGENDA_PAST_EVENT_ERROR_MESSAGE}
                  </div>
                ) : null}
              </div>
            ) : null}

          <DialogFooter className="grid shrink-0 grid-cols-2 gap-2 border-t bg-background px-5 py-4 sm:grid-cols-3">
              <Button
                type="button"
                className="col-span-2 sm:col-span-1"
                onClick={() => void handleApplyEventStatus()}
                disabled={savingSelectedEvent}
                variant={selectedStatusAction === "delete" ? "destructive" : "default"}
              >
                {savingSelectedEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Aplicar status
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleStartAttendanceFromEvent}
                disabled={savingSelectedEvent || !selectedEvent?.patientId}
                className="gap-1.5 font-medium"
              >
                <Play className="h-4 w-4 fill-primary text-primary" />
                Iniciar atendimento
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={savingSelectedEvent}>Fechar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
};

export default AgendaWidget;
