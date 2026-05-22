import { useCallback, useEffect, useMemo, useState } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Check, ChevronLeft, ChevronRight, ChevronsUpDown, Clock, Loader2, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
}

const AgendaWidget = ({ fixedPatient, headerAccessory }: AgendaWidgetProps) => {
  const navigate = useNavigate();
  const { can, clinicId, user } = useAuth();
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

    const eventsRequest = supabase
      .from("agenda_events")
      .select("id, event_type, patient_id, status, title, scheduled_for")
      .order("scheduled_for", { ascending: true });
    const patientsRequest = fixedPatientId
      ? Promise.resolve({ data: [] as AgendaPatientOption[], error: null })
      : supabase
          .from("patients")
          .select("id, name")
          .order("name", { ascending: true });
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
  }, [fixedPatientId, user]);

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

  const scopedEvents = fixedPatientId ? events.filter((event) => event.patientId === fixedPatientId) : events;

  const dayEvents = scopedEvents
    .filter((event) => isSameDay(event.date, selectedDate))
    .sort((first, second) => first.time.localeCompare(second.time));

  const todayDay = getLocalDay();
  const selectedDayTimestamp = getLocalDayTimestamp(selectedDate);
  const eventsFromToday = scopedEvents.filter((event) => getLocalDayTimestamp(event.date) >= todayDay.getTime());
  const datesWithEvents = eventsFromToday.map((event) => event.date);
  const eventsBeforeSelectedDate = eventsFromToday.filter((event) => getLocalDayTimestamp(event.date) < selectedDayTimestamp);
  const eventsAfterSelectedDate = eventsFromToday.filter((event) => getLocalDayTimestamp(event.date) > selectedDayTimestamp);
  const previousEventDate = eventsBeforeSelectedDate
    .map((event) => getLocalDay(event.date))
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const nextEventDate = eventsAfterSelectedDate
    .map((event) => getLocalDay(event.date))
    .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
  const newEventDateTime = newTime ? getAgendaEventDateTime(selectedDate, newTime) : null;
  const isNewEventDateTimePast = newEventDateTime ? isAgendaEventDateTimeInPast(newEventDateTime) : false;
  const selectedEventDateTime =
    selectedEventDate && selectedEventTime ? new Date(`${selectedEventDate}T${selectedEventTime || "00:00"}:00`) : null;
  const isSelectedEventDateTimePast = selectedEventDateTime ? isAgendaEventDateTimeInPast(selectedEventDateTime) : false;
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
    setPatientQuery(value);
    setSelectedPatient(resolvePatientSelection(value, patients));
  };

  const handleSelectPatient = (patient: AgendaPatientOption) => {
    setPatientQuery(patient.name);
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
        const { error } = await supabase.from("agenda_events").delete().eq("id", selectedEvent.id);

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
    const { error } = await supabase.from("agenda_events").delete().eq("id", id);

    if (error) {
      toast({ title: "Erro ao remover evento", description: error.message, variant: "destructive" });
      return;
    }

    setEvents((previous) => previous.filter((event) => event.id !== id));
    notifyAgendaEventsUpdated();
  };

  return (
    <Card className="hover:shadow-md transition-shadow duration-150">
      <CardHeader className="space-y-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Agenda</CardTitle>
          <div className="flex items-center gap-2">
            {headerAccessory}
            <div className="rounded-lg bg-primary/10 p-2">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[auto,minmax(0,1fr),auto] items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="relative h-9 w-9"
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
              <Button variant="outline" size="sm" className="w-full min-w-0 justify-start text-left font-normal">
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
            className="relative h-9 w-9"
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

        <div className="space-y-1.5 max-h-36 overflow-y-auto overflow-x-hidden pr-1">
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
              className="group flex min-w-0 cursor-pointer items-center gap-1.5 overflow-hidden rounded bg-muted/50 px-2 py-2 transition-colors hover:bg-muted"
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
              <div className="grid min-w-0 flex-1 grid-cols-[auto,1fr] items-center gap-x-2 gap-y-1 text-left text-xs sm:flex sm:items-center sm:gap-1.5">
                <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  {event.time}
                </span>
                <span className="min-w-0 truncate font-medium sm:order-4">{event.title}</span>
                <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-1 sm:contents">
                  <Badge variant="outline" className="hidden text-[10px] uppercase min-[420px]:inline-flex">
                    {eventTypeLabels[event.eventType]}
                  </Badge>
                  <Badge variant="outline" className={`max-w-full truncate text-[10px] ${agendaStatusStyles[event.status]}`}>
                    {agendaStatusLabels[event.status]}
                  </Badge>
                </div>
              </div>
              {can("agenda.delete_events") && (
                <button
                  onPointerUp={(eventPointer) => eventPointer.stopPropagation()}
                  onClick={(eventClick) => {
                    eventClick.stopPropagation();
                    void handleRemove(event.id);
                  }}
                  className="ml-1 shrink-0 text-muted-foreground opacity-100 transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {fixedPatientId ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="default" size="sm" className="w-full" onClick={handleOpenAddDialog}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Agendar
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={handleStartAttendanceNow}>
              Iniciar atendimento agora
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={handleOpenAddDialog}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar evento
          </Button>
        )}

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
                    onChange={(event) => setNewTitle(event.target.value)}
                    placeholder="Digite o título do evento"
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
                      <SelectItem value={agendaDeleteOption.value} className="text-destructive focus:text-destructive">
                        {agendaDeleteOption.label}
                      </SelectItem>
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
              >
                Iniciar atendimento
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={savingSelectedEvent}>Fechar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AgendaWidget;
