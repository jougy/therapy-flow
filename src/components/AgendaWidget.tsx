import { useEffect, useMemo, useState } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock, Loader2, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  buildAgendaEventPayload,
  resolvePatientSelection,
  type AgendaEventType,
  type AgendaPatientOption,
} from "@/lib/agenda-events";

interface AgendaEvent {
  eventType: AgendaEventType;
  id: string;
  patientId: string | null;
  title: string;
  date: Date;
  time: string;
}

const eventTypeLabels: Record<AgendaEventType, string> = {
  atendimento: "Atendimento",
  reuniao: "Reunião",
  evento: "Evento",
};

const AgendaWidget = () => {
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

  useEffect(() => {
    if (!user) return;

    const fetchAgendaData = async () => {
      setLoading(true);

      const [eventsRes, patientsRes] = await Promise.all([
        supabase
          .from("agenda_events")
          .select("id, event_type, patient_id, title, scheduled_for")
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
        .select("id, event_type, patient_id, title, scheduled_for")
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
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Agenda</CardTitle>
        <div className="p-2 rounded-lg bg-primary/10">
          <CalendarDays className="h-4 w-4 text-primary" />
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
            <div key={event.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1.5 group">
              <div className="flex items-center gap-1.5 min-w-0">
                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{event.time}</span>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {eventTypeLabels[event.eventType]}
                </Badge>
                <span className="font-medium truncate">{event.title}</span>
              </div>
              {can("agenda.delete_events") && (
                <button
                  onClick={() => handleRemove(event.id)}
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
      </CardContent>
    </Card>
  );
};

export default AgendaWidget;
