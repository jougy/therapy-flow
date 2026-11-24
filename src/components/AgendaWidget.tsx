import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Check, ChevronLeft, ChevronRight, ChevronsUpDown, Clock, Eye, EyeOff, Loader2, Maximize2, MessageCircle, Plus, Trash2, X, Play } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  AgendaViewSelector,
  PatientInlineAgendaView,
  AgendaEventQuickDialog,
  agendaDeleteOption,
  agendaStatusOptions,
  agendaStatusStyles,
  type AgendaStatusAction,
  type AgendaViewMode,
} from "@/components/agenda";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { DismissibleInfoTip } from "@/components/ui/dismissible-info-tip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { AgendaNewEventDialog } from "@/components/agenda/AgendaNewEventDialog";
import {
  AgendaReminderSettingsBlock,
  DEFAULT_REMINDER_SETTINGS,
  type AgendaReminderSettingsValues,
} from "@/components/agenda/AgendaReminderSettingsBlock";
import {
  AGENDA_PAST_EVENT_ERROR_MESSAGE,
  assertAgendaEventDateTimeIsFuture,
  buildAgendaEventPayload,
  getAgendaEventDateTime,
  isAgendaEventDateTimeInPast,
  formatSupabaseErrorMessage,
  resolvePatientSelection,
  type AgendaEventItem,
  type AgendaEventStatus,
  type AgendaEventType,
  type AgendaPatientOption,
} from "@/lib/agenda-events";
import { mapRawEventToItem, type AgendaEventQueryResult } from "@/lib/agenda-cache";
import { INPUT_LIMITS, sanitizeSingleLineInput } from "@/lib/input-security";
import { getClinicPatientPath } from "@/lib/patient-routing";
import {
  isNetworkOrOfflineError,
  toRawAgendaEvent,
  useClinicAgendaPatients,
  useUnifiedClinicAgenda,
} from "@/services/clinicAgendaService";
import type { Database } from "@/integrations/supabase/types";

type Session = Database["public"]["Tables"]["sessions"]["Row"];
type AgendaEvent = AgendaEventItem;

const eventTypeLabels: Record<AgendaEventType, string> = {
  atendimento: "Atendimento",
  reuniao: "Reunião",
  evento: "Evento",
};

const agendaStatusLabels: Record<AgendaEventStatus, string> = {
  aguardando_confirmacao: "Aguardando",
  cancelado: "Cancelado",
  confirmado: "Confirmado",
  concluido: "Concluído",
  lembrete: "Lembrete",
};


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
  autoOpenAdd?: boolean;
  fixedPatient?: AgendaPatientOption;
  headerAccessory?: React.ReactNode;
  onOpenAddChange?: (open: boolean) => void;
  onStartAttendance?: () => void;
  startAttendanceLabel?: string;
  showExpandButton?: boolean;
  variant?: "card" | "modal";
}

const AgendaWidget = ({
  autoOpenAdd = false,
  fixedPatient,
  headerAccessory,
  onOpenAddChange,
  onStartAttendance,
  startAttendanceLabel,
  showExpandButton,
  variant = "card",
}: AgendaWidgetProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clinicKey } = useParams<{ clinicKey?: string }>();
  const { accessibleClinics, can, clinic, clinicId, user } = useAuth();
  const isDesignLab = location.pathname.startsWith("/designlab");
  const routeClinic = clinicKey
    ? accessibleClinics?.find((opt) => opt.clinic?.route_key === clinicKey)?.clinic
    : undefined;
  const effectiveClinicId = clinicId || clinic?.id || routeClinic?.id || null;
  const effectiveClinicKey =
    clinicKey ||
    clinic?.route_key ||
    routeClinic?.route_key ||
    (effectiveClinicId
      ? accessibleClinics?.find((opt) => opt.clinic?.id === effectiveClinicId)?.clinic?.route_key
      : undefined);
  const fixedPatientId = fixedPatient?.id ?? null;
  const fixedPatientName = fixedPatient?.name ?? null;
  const canExpand = showExpandButton ?? true;
  const fullAgendaPath = effectiveClinicKey
    ? isDesignLab
      ? `/designlab/clinica/${effectiveClinicKey}/agenda`
      : `/clinica/${effectiveClinicKey}/agenda`
    : isDesignLab
      ? "/designlab/agenda"
      : "/espacopessoal";
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [newEventDate, setNewEventDate] = useState<Date | null>(() => (autoOpenAdd ? null : new Date()));
  const [showAdd, setShowAdd] = useState(autoOpenAdd);
  const [eventType, setEventType] = useState<AgendaEventType>("atendimento");
  const [patientQuery, setPatientQuery] = useState("");
  const [patientComboboxOpen, setPatientComboboxOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<AgendaPatientOption | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState(() => (autoOpenAdd ? "" : getDefaultNewEventTime()));
  const [reminderSettings, setReminderSettings] = useState<AgendaReminderSettingsValues>(DEFAULT_REMINDER_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [selectedStatusAction, setSelectedStatusAction] = useState<AgendaStatusAction>("aguardando_confirmacao");
  const [selectedEventDate, setSelectedEventDate] = useState(getDateInputValue());
  const [selectedEventTime, setSelectedEventTime] = useState("09:00");
  const [savingSelectedEvent, setSavingSelectedEvent] = useState(false);
  const [viewMode, setViewMode] = useState<AgendaViewMode>("day");
  const [showOtherPatients, setShowOtherPatients] = useState(false);

  const {
    events,
    index: agendaIndex,
    isLoading: loadingEvents,
    optimisticUpsertEvent,
    optimisticDeleteEvent,
  } = useUnifiedClinicAgenda(effectiveClinicId, Boolean(user));
  const { patients, isLoading: loadingPatients } = useClinicAgendaPatients(effectiveClinicId, Boolean(user));
  const loading = (loadingEvents || loadingPatients) && events.length === 0;

  const scopedEvents = useMemo(
    () => (fixedPatientId && !showOtherPatients ? (agendaIndex.byPatientId.get(fixedPatientId) ?? []) : events),
    [agendaIndex.byPatientId, events, fixedPatientId, showOtherPatients]
  );

  const dayEvents = useMemo(() => {
    const dayKey = format(selectedDate, "yyyy-MM-dd");
    const dayBucket = agendaIndex.byDayKey.get(dayKey) ?? [];
    if (fixedPatientId && !showOtherPatients) {
      return dayBucket.filter((event) => event.patientId === fixedPatientId);
    }
    return dayBucket;
  }, [agendaIndex.byDayKey, fixedPatientId, selectedDate, showOtherPatients]);

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
    () => (newEventDate && newTime ? getAgendaEventDateTime(newEventDate, newTime) : null),
    [newEventDate, newTime]
  );
  const isNewEventDateTimePast = useMemo(
    () => (newEventDateTime ? isAgendaEventDateTimeInPast(newEventDateTime, undefined, 15) : false),
    [newEventDateTime]
  );
  const selectedEventDateTime = useMemo(
    () => (selectedEventDate && selectedEventTime ? getAgendaEventDateTime(selectedEventDate, selectedEventTime || "00:00") : null),
    [selectedEventDate, selectedEventTime]
  );
  const isSelectedEventDateTimePast = useMemo(
    () => (selectedEventDateTime ? isAgendaEventDateTimeInPast(selectedEventDateTime, undefined, 15) : false),
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
    if (!newEventDate || !newTime) return false;
    if (eventType === "atendimento") {
      return Boolean(fixedPatientId || selectedPatient);
    }
    return Boolean(newTitle.trim());
  }, [eventType, fixedPatientId, isNewEventDateTimePast, newEventDate, newTime, newTitle, saving, selectedPatient, user]);

  const resetDialog = () => {
    setEventType("atendimento");
    setPatientQuery("");
    setPatientComboboxOpen(false);
    setSelectedPatient(null);
    setNewTitle("");
    setNewEventDate(new Date());
    setNewTime(getDefaultNewEventTime());
    setReminderSettings(DEFAULT_REMINDER_SETTINGS);
    setShowAdd(false);
    onOpenAddChange?.(false);
  };

  const handleOpenAddDialog = () => {
    setNewEventDate(selectedDate);
    setNewTime(getDefaultNewEventTime());
    setShowAdd(true);
    onOpenAddChange?.(true);
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
    if (!user || !newEventDate) return;

    let payload: Database["public"]["Tables"]["agenda_events"]["Insert"] | null = null;
    const tempId = `offline-agenda-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const saveOffline = async (insertPayload: Database["public"]["Tables"]["agenda_events"]["Insert"]) => {
      const offlineRaw: AgendaEventQueryResult = {
        id: tempId,
        event_type: insertPayload.event_type,
        patient_id: insertPayload.patient_id ?? null,
        scheduled_for: insertPayload.scheduled_for,
        status: insertPayload.status ?? "aguardando_confirmacao",
        title: insertPayload.title,
        duration_minutes: insertPayload.duration_minutes ?? 60,
        origin_timezone: insertPayload.origin_timezone ?? null,
        origin_lat: insertPayload.origin_lat ?? null,
        origin_lng: insertPayload.origin_lng ?? null,
        origin_city: insertPayload.origin_city ?? null,
      };
      await optimisticUpsertEvent(offlineRaw, { tempId, offlineRecord: insertPayload, enqueueOffline: true });
      toast({ title: "Agendamento salvo offline", description: "Será sincronizado ao reconectar." });
      resetDialog();
    };

    try {
      assertAgendaEventDateTimeIsFuture(getAgendaEventDateTime(newEventDate, newTime), undefined, 15);
      setSaving(true);
      const reminderConfigs = [
        ...(reminderSettings.remindAtEvent ? [{ minutesBefore: 0 }] : []),
        ...reminderSettings.additionalReminders.map((mins) => ({ minutesBefore: mins })),
      ];

      payload = buildAgendaEventPayload({
        clinicId: effectiveClinicId,
        eventType,
        graceMinutes: 15,
        notifiedColleagueIds: reminderSettings.notifiedColleagueIds,
        notifyPatient: reminderSettings.notifyPatient,
        notifyTeam: reminderSettings.notifyTeam,
        reminderConfigs,
        selectedDate: newEventDate,
        selectedPatient: fixedPatientId && fixedPatientName ? { id: fixedPatientId, name: fixedPatientName } : selectedPatient,
        time: newTime,
        title: newTitle,
        userId: user.id,
      });

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await saveOffline(payload);
        return;
      }

      let insertedResult = await supabase
        .from("agenda_events")
        .insert(payload)
        .select("id, event_type, patient_id, status, title, scheduled_for")
        .single();

      if (insertedResult.error && (insertedResult.error.code === "42703" || insertedResult.error.message.includes("duration_minutes") || insertedResult.error.message.includes("reminder_configs"))) {
        const fallbackPayload = { ...payload };
        delete (fallbackPayload as Record<string, unknown>).duration_minutes;
        delete (fallbackPayload as Record<string, unknown>).reminder_configs;
        delete (fallbackPayload as Record<string, unknown>).notify_team;
        delete (fallbackPayload as Record<string, unknown>).notify_patient;
        delete (fallbackPayload as Record<string, unknown>).notified_colleague_ids;
        insertedResult = await supabase
          .from("agenda_events")
          .insert(fallbackPayload)
          .select("id, event_type, patient_id, status, title, scheduled_for")
          .single();
      }

      if (insertedResult.error) throw insertedResult.error;
      const data = insertedResult.data;
      if (data) {
        if (data.id && (reminderSettings.notifyPatient || reminderSettings.notifyTeam)) {
          void supabase.functions.invoke("agenda-whatsapp-reminders", {
            body: { action: "notify_new_booking", eventId: data.id },
          }).catch(() => {});
        }
        await optimisticUpsertEvent(data as AgendaEventQueryResult);
      }

      toast({ title: "Agendamento confirmado" });
      resetDialog();
    } catch (error) {
      if (payload && isNetworkOrOfflineError(error)) {
        await saveOffline(payload);
        return;
      }
      const message = formatSupabaseErrorMessage(error, "Não foi possível salvar o agendamento.");
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

        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await optimisticDeleteEvent(selectedEvent.id, { enqueueOffline: true });
          setSelectedEvent(null);
          toast({ title: "Agendamento excluído offline" });
          return;
        }

        const deleteQuery = supabase.from("agenda_events").delete().eq("id", selectedEvent.id);
        const { error } = effectiveClinicId ? await deleteQuery.eq("clinic_id", effectiveClinicId) : await deleteQuery;

        if (error) {
          if (isNetworkOrOfflineError(error)) {
            await optimisticDeleteEvent(selectedEvent.id, { enqueueOffline: true });
            setSelectedEvent(null);
            toast({ title: "Agendamento excluído offline" });
            return;
          }
          throw error;
        }

        await optimisticDeleteEvent(selectedEvent.id);
        setSelectedEvent(null);
        toast({ title: "Agendamento excluído" });
        return;
      }

      const previousStatus = selectedEvent.status;
      const offlineStatusUpdate = async () => {
        const nextRaw: AgendaEventQueryResult = {
          ...toRawAgendaEvent(selectedEvent),
          status: selectedStatusAction,
        };
        await optimisticUpsertEvent(nextRaw, {
          enqueueOffline: true,
          offlineRecord: {
            id: selectedEvent.id,
            clinic_id: effectiveClinicId,
            user_id: user.id,
            event_type: selectedEvent.eventType,
            patient_id: selectedEvent.patientId,
            scheduled_for: selectedEvent.scheduledFor,
            status: selectedStatusAction,
            title: selectedEvent.title,
          },
        });
        setSelectedEvent(mapRawEventToItem(nextRaw));
        toast({ title: "Status salvo offline", description: "Será sincronizado ao reconectar." });
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await offlineStatusUpdate();
        return;
      }

      const updateQuery = supabase
        .from("agenda_events")
        .update({ status: selectedStatusAction })
        .eq("id", selectedEvent.id);

      const { data, error } = effectiveClinicId
        ? await updateQuery.eq("clinic_id", effectiveClinicId).select("id, event_type, patient_id, status, title, scheduled_for").single()
        : await updateQuery.select("id, event_type, patient_id, status, title, scheduled_for").single();

      if (error) {
        if (isNetworkOrOfflineError(error)) {
          await offlineStatusUpdate();
          return;
        }
        throw error;
      }

      const rawUpdated = data as AgendaEventQueryResult;
      const updatedEvent = mapRawEventToItem(rawUpdated);

      await optimisticUpsertEvent(rawUpdated);
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
            clinic_id: effectiveClinicId,
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
      const message = formatSupabaseErrorMessage(error, "Não foi possível atualizar o agendamento.");
      toast({ title: "Erro ao atualizar agendamento", description: message, variant: "destructive" });
    } finally {
      setSavingSelectedEvent(false);
    }
  };

  const handleUpdateSelectedDateTime = async () => {
    if (!selectedEvent || !user) {
      return;
    }

    try {
      setSavingSelectedEvent(true);
      const nextDate = getAgendaEventDateTime(selectedEventDate, selectedEventTime || "00:00");
      assertAgendaEventDateTimeIsFuture(nextDate, undefined, 15);
      const nextScheduledFor = nextDate.toISOString();

      const offlineDateTimeUpdate = async () => {
        const nextRaw: AgendaEventQueryResult = {
          ...toRawAgendaEvent(selectedEvent),
          scheduled_for: nextScheduledFor,
        };
        await optimisticUpsertEvent(nextRaw, {
          enqueueOffline: true,
          offlineRecord: {
            id: selectedEvent.id,
            clinic_id: effectiveClinicId,
            user_id: user.id,
            event_type: selectedEvent.eventType,
            patient_id: selectedEvent.patientId,
            scheduled_for: nextScheduledFor,
            status: selectedEvent.status,
            title: selectedEvent.title,
          },
        });
        setSelectedEvent(mapRawEventToItem(nextRaw));
        toast({ title: "Data e horário salvos offline", description: "Será sincronizado ao reconectar." });
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await offlineDateTimeUpdate();
        return;
      }

      const updateQuery = supabase
        .from("agenda_events")
        .update({ scheduled_for: nextScheduledFor })
        .eq("id", selectedEvent.id);

      const { data, error } = effectiveClinicId
        ? await updateQuery.eq("clinic_id", effectiveClinicId).select("id, event_type, patient_id, status, title, scheduled_for").single()
        : await updateQuery.select("id, event_type, patient_id, status, title, scheduled_for").single();

      if (error) {
        if (isNetworkOrOfflineError(error)) {
          await offlineDateTimeUpdate();
          return;
        }
        throw error;
      }

      const rawUpdated = data as AgendaEventQueryResult;
      const updatedEvent = mapRawEventToItem(rawUpdated);

      await optimisticUpsertEvent(rawUpdated);
      setSelectedEvent(updatedEvent);
      toast({ title: "Data e horário atualizados" });
    } catch (error) {
      const message = formatSupabaseErrorMessage(error, "Não foi possível trocar data/horário.");
      toast({ title: "Erro ao trocar data/horário", description: message, variant: "destructive" });
    } finally {
      setSavingSelectedEvent(false);
    }
  };

  const buildPatientSessionRoute = (patientId: string) => {
    const basePath = getClinicPatientPath(effectiveClinicKey, patientId, "sessao/novo");
    return isDesignLab ? `/designlab${basePath}` : basePath;
  };

  const handleStartAttendanceFromEvent = () => {
    if (!selectedEvent?.patientId) {
      return;
    }

    navigate(buildPatientSessionRoute(selectedEvent.patientId), {
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

    navigate(buildPatientSessionRoute(fixedPatientId));
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

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await optimisticDeleteEvent(id, { enqueueOffline: true });
      toast({ title: "Agendamento excluído offline" });
      return;
    }

    const deleteQuery = supabase.from("agenda_events").delete().eq("id", id);
    const { error } = effectiveClinicId ? await deleteQuery.eq("clinic_id", effectiveClinicId) : await deleteQuery;

    if (error) {
      if (isNetworkOrOfflineError(error)) {
        await optimisticDeleteEvent(id, { enqueueOffline: true });
        toast({ title: "Agendamento excluído offline" });
        return;
      }
      toast({ title: "Erro ao remover evento", description: error.message, variant: "destructive" });
      return;
    }

    await optimisticDeleteEvent(id);
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
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <Button
            data-tutorial="agenda-add-btn"
            type="button"
            variant="default"
            size="sm"
            className="h-9 rounded-xl border border-primary/20 bg-primary/90 hover:bg-primary text-primary-foreground font-medium text-xs gap-1.5 shadow-xs hover:shadow-sm px-3.5 transition-all active:scale-[0.98]"
            onClick={handleOpenAddDialog}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Agendar</span>
          </Button>
          <Button
            data-tutorial="agenda-quick-start"
            type="button"
            size="sm"
            className="h-9 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs gap-1.5 shadow-xs hover:shadow-sm px-3.5 transition-all border border-emerald-500/30 active:scale-[0.98]"
            onClick={onStartAttendance ?? handleStartAttendanceNow}
          >
            <Play className="h-3.5 w-3.5 fill-current text-white/95" />
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

  const patientDesktopView = fixedPatientId && !isModal ? (
    <Card data-tutorial="agenda-widget" className="hover:shadow-md transition-shadow duration-150">
      <CardHeader className="py-2.5 px-3 sm:px-4 border-b border-border/40">
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="relative h-8 w-8 shrink-0 rounded-lg"
              disabled={!previousEventDate}
              onClick={() => previousEventDate && setSelectedDate(previousEventDate)}
              aria-label={`Ir para o dia anterior com agendamentos. ${eventsBeforeSelectedDate.length} agendamento${eventsBeforeSelectedDate.length !== 1 ? "s" : ""} antes desta data.`}
            >
              <ChevronLeft className="h-4 w-4" />
              {eventsBeforeSelectedDate.length > 0 ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1 py-0.2 text-[9px] font-semibold leading-none text-primary-foreground">
                  {eventsBeforeSelectedDate.length}
                </span>
              ) : null}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
              className="h-8 px-2 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg"
            >
              Hoje
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button data-tutorial="agenda-date-picker-btn" variant="outline" size="sm" className="h-8 min-w-[130px] justify-start text-left font-normal rounded-lg text-xs">
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5 shrink-0 text-primary" />
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
              className="relative h-8 w-8 shrink-0 rounded-lg"
              disabled={!nextEventDate}
              onClick={() => nextEventDate && setSelectedDate(nextEventDate)}
              aria-label={`Ir para o próximo dia com agendamentos. ${eventsAfterSelectedDate.length} agendamento${eventsAfterSelectedDate.length !== 1 ? "s" : ""} depois desta data.`}
            >
              <ChevronRight className="h-4 w-4" />
              {eventsAfterSelectedDate.length > 0 ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1 py-0.2 text-[9px] font-semibold leading-none text-primary-foreground">
                  {eventsAfterSelectedDate.length}
                </span>
              ) : null}
            </Button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <AgendaViewSelector
              value={viewMode}
              onChange={setViewMode}
              className="p-0.5 border-border/50 bg-muted/40"
            />

            <Button
              type="button"
              variant={showOtherPatients ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowOtherPatients((prev) => !prev)}
              title={showOtherPatients ? "Ocultar agendamentos de outros pacientes da clínica" : "Exibir agendamentos de outros pacientes da clínica"}
              className={cn(
                "h-8 gap-1.5 text-xs rounded-xl px-2.5 transition-all font-medium",
                showOtherPatients ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {showOtherPatients ? (
                <>
                  <Eye className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden lg:inline">Outros agendamentos: Visíveis</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">Outros agendamentos: Ocultos</span>
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {headerAccessory}

            <Button
              data-tutorial="agenda-add-btn"
              type="button"
              variant="default"
              size="sm"
              className="h-8 rounded-xl border border-primary/20 bg-primary/90 hover:bg-primary text-primary-foreground font-medium text-xs gap-1.5 shadow-2xs hover:shadow-xs px-2.5 transition-all active:scale-[0.98]"
              onClick={handleOpenAddDialog}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>Agendar</span>
            </Button>

            <Button
              data-tutorial="agenda-quick-start"
              type="button"
              size="sm"
              className="h-8 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs gap-1.5 shadow-2xs hover:shadow-xs px-2.5 transition-all border border-emerald-500/30 active:scale-[0.98]"
              onClick={onStartAttendance ?? handleStartAttendanceNow}
            >
              <Play className="h-3 w-3 fill-current text-white/95" />
              <span>{startAttendanceLabel ?? "Iniciar Atendimento Agora"}</span>
            </Button>

            {canExpand && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs text-primary border-primary/20 hover:bg-primary/5 hover:text-primary rounded-xl px-2.5 shrink-0"
                onClick={() => navigate(fullAgendaPath)}
                title="Ver agenda completa da clínica"
                aria-label="Ver agenda completa"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden xl:inline font-medium">Ver agenda completa</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-4">
        <PatientInlineAgendaView
          currentDate={selectedDate}
          onSelectDate={setSelectedDate}
          viewMode={viewMode}
          events={scopedEvents}
          currentPatientId={fixedPatientId}
          patients={patients}
          onOpenEventDetails={handleOpenEventDetails}
          onOpenAddModal={() => handleOpenAddDialog()}
          onStartAttendance={handleStartAttendanceFromEvent}
          canStartAttendance={true}
        />
      </CardContent>
    </Card>
  ) : null;

  const containerContent = isModal ? (
    <div data-tutorial="agenda-widget" className="w-full min-w-0 space-y-3">
      {content}
    </div>
  ) : patientDesktopView ?? (
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
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs text-primary border-primary/20 hover:bg-primary/5 hover:text-primary rounded-xl px-2.5"
                onClick={() => navigate(fullAgendaPath)}
                title="Ver agenda completa da clínica"
                aria-label="Ver agenda completa"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline font-medium">Ver agenda completa</span>
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

        <AgendaNewEventDialog
          open={showAdd}
          onOpenChange={(open) => {
            setShowAdd(open);
            onOpenAddChange?.(open);
          }}
          onReset={resetDialog}
          eventType={eventType}
          eventTypeLabels={eventTypeLabels}
          onEventTypeChange={handleEventTypeChange}
          fixedPatientName={fixedPatientName}
          patientComboboxOpen={patientComboboxOpen}
          onPatientComboboxOpenChange={setPatientComboboxOpen}
          selectedPatient={selectedPatient}
          patientQuery={patientQuery}
          onPatientQueryChange={handlePatientQueryChange}
          filteredPatients={filteredPatients}
          onSelectPatient={handleSelectPatient}
          newTitle={newTitle}
          onTitleChange={handleTitleChange}
          newEventDate={newEventDate}
          onNewEventDateChange={setNewEventDate}
          todayDay={todayDay}
          datesWithEvents={datesWithEvents}
          newTime={newTime}
          onNewTimeChange={setNewTime}
          isNewEventDateTimePast={isNewEventDateTimePast}
          reminderSettings={reminderSettings}
          onReminderSettingsChange={setReminderSettings}
          saving={saving}
          canSave={canSave}
          onSave={handleAdd}
        />

        <AgendaEventQuickDialog
          selectedEvent={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          selectedStatusAction={selectedStatusAction}
          onStatusActionChange={setSelectedStatusAction}
          selectedEventDate={selectedEventDate}
          onDateChange={setSelectedEventDate}
          selectedEventTime={selectedEventTime}
          onTimeChange={setSelectedEventTime}
          savingSelectedEvent={savingSelectedEvent}
          isSelectedEventDateTimePast={isSelectedEventDateTimePast}
          patients={patients}
          clinicName={clinic?.name ?? undefined}
          canDeleteEvents={can("agenda.delete_events")}
          onApplyStatus={() => void handleApplyEventStatus()}
          onUpdateDateTime={() => void handleUpdateSelectedDateTime()}
          onStartAttendance={handleStartAttendanceFromEvent}
          formatDateTime={formatAgendaEventDateTime}
          agendaStatusStyles={agendaStatusStyles}
          agendaStatusLabels={agendaStatusLabels}
          agendaStatusOptions={agendaStatusOptions}
          agendaDeleteOption={agendaDeleteOption}
        />
      </>
    );
};

export default AgendaWidget;
