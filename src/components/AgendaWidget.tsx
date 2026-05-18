import { useEffect, useMemo, useState } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock, Loader2, Plus, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  buildAgendaEventPayload,
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

const getTimeInputValue = (value: string) => {
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
};

const formatAgendaEventDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });

interface AgendaWidgetProps {
  headerAccessory?: React.ReactNode;
}

const AgendaWidget = ({ headerAccessory }: AgendaWidgetProps) => {
  const navigate = useNavigate();
  const { can, clinicId, user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [patients, setPatients] = useState<AgendaPatientOption[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [eventType, setEventType] = useState<AgendaEventType>("atendimento");
  const [patientQuery, setPatientQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<AgendaPatientOption | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [selectedStatusAction, setSelectedStatusAction] = useState<AgendaStatusAction>("aguardando_confirmacao");
  const [selectedEventDate, setSelectedEventDate] = useState(getDateInputValue());
  const [selectedEventTime, setSelectedEventTime] = useState("09:00");
  const [savingSelectedEvent, setSavingSelectedEvent] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchAgendaData = async () => {
      setLoading(true);

      const [eventsRes, patientsRes] = await Promise.all([
        supabase
          .from("agenda_events")
          .select("id, event_type, patient_id, status, title, scheduled_for")
          .order("scheduled_for", { ascending: true }),
        supabase
          .from("patients")
          .select("id, name")
          .order("name", { ascending: true }),
      ]);

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
      setPatients(patientsRes.data ?? []);
      setLoading(false);
    };

    fetchAgendaData();
  }, [user]);

  const dayEvents = events
    .filter((event) => isSameDay(event.date, selectedDate))
    .sort((first, second) => first.time.localeCompare(second.time));

  const datesWithEvents = events.map((event) => event.date);

  const canSave = useMemo(() => {
    if (!user || saving) return false;
    if (eventType === "atendimento") {
      return Boolean(selectedPatient && newTime);
    }
    return Boolean(newTitle.trim() && newTime);
  }, [eventType, newTime, newTitle, saving, selectedPatient, user]);

  const resetDialog = () => {
    setEventType("atendimento");
    setPatientQuery("");
    setSelectedPatient(null);
    setNewTitle("");
    setNewTime("09:00");
    setShowAdd(false);
  };

  const handleEventTypeChange = (value: AgendaEventType) => {
    setEventType(value);
    setPatientQuery("");
    setSelectedPatient(null);
    setNewTitle("");
  };

  const handlePatientQueryChange = (value: string) => {
    setPatientQuery(value);
    setSelectedPatient(resolvePatientSelection(value, patients));
  };

  const handleAdd = async () => {
    if (!user) return;

    try {
      setSaving(true);
      const payload = buildAgendaEventPayload({
        clinicId,
        eventType,
        selectedDate,
        selectedPatient,
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

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("agenda_events").delete().eq("id", id);

    if (error) {
      toast({ title: "Erro ao remover evento", description: error.message, variant: "destructive" });
      return;
    }

    setEvents((previous) => previous.filter((event) => event.id !== id));
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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
              <CalendarDays className="h-4 w-4 mr-2" />
              {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className={cn("p-3 pointer-events-auto")}
              modifiers={{ hasEvent: datesWithEvents }}
              modifiersClassNames={{ hasEvent: "bg-primary/20 font-bold" }}
            />
          </PopoverContent>
        </Popover>

        <div className="space-y-1.5 max-h-28 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          )}
          {!loading && dayEvents.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Sem eventos</p>
          )}
          {dayEvents.map((event) => (
            <div key={event.id} className="flex items-center gap-1.5 rounded bg-muted/50 px-2 py-1.5 group">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs"
                onClick={() => handleOpenEventDetails(event)}
              >
                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{event.time}</span>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {eventTypeLabels[event.eventType]}
                </Badge>
                <Badge variant="outline" className={`text-[10px] ${agendaStatusStyles[event.status]}`}>
                  {agendaStatusLabels[event.status]}
                </Badge>
                <span className="font-medium truncate">{event.title}</span>
              </button>
              {can("agenda.delete_events") && (
                <button
                  onClick={(eventClick) => {
                    eventClick.stopPropagation();
                    void handleRemove(event.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar evento
        </Button>

        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent className="sm:max-w-sm">
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

              {eventType === "atendimento" ? (
                <div className="space-y-2">
                  <Label>Paciente</Label>
                  <Input
                    list="agenda-patients"
                    value={patientQuery}
                    onChange={(event) => handlePatientQueryChange(event.target.value)}
                    placeholder="Busque e selecione um paciente"
                  />
                  <datalist id="agenda-patients">
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.name} />
                    ))}
                  </datalist>
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
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Agendamento</p>
              <DialogTitle className="text-3xl">{selectedEvent?.title ?? "Agendamento"}</DialogTitle>
              <DialogDescription>
                Revise o horário, atualize o status ou inicie o atendimento a partir deste agendamento.
              </DialogDescription>
            </DialogHeader>

            {selectedEvent ? (
              <div className="space-y-5 py-2">
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
                    disabled={savingSelectedEvent || !selectedEventDate || !selectedEventTime}
                  >
                    Trocar data/horário
                  </Button>
                </div>
              </div>
            ) : null}

            <DialogFooter className="grid gap-2 sm:grid-cols-3">
              <Button
                type="button"
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
