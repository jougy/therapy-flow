import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  Loader2,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { INPUT_LIMITS, sanitizeSingleLineInput } from "@/lib/input-security";
import {
  getAgendaEventDateTime,
  isAgendaEventDateTimeInPast,
  isValidTimeString,
  type AgendaEventStatus,
  type AgendaEventType,
  type AgendaPatientOption,
} from "@/lib/agenda-events";
import { findConflictingAgendaEvents } from "@/lib/agenda-slot-condenser";
import { toast } from "@/hooks/use-toast";
import {
  AGENDA_DURATION_PRESETS,
  AgendaEventDurationAndWarnings,
} from "./AgendaEventDurationAndWarnings";
import {
  AgendaReminderSettingsBlock,
  DEFAULT_REMINDER_SETTINGS,
  type AgendaReminderSettingsValues,
} from "./AgendaReminderSettingsBlock";
import type { AgendaEventItem } from "./types";

interface AgendaEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialDate?: Date;
  initialTime?: string;
  selectedEvent?: AgendaEventItem | null;
  patients: AgendaPatientOption[];
  existingEvents?: AgendaEventItem[];
  defaultDurationMinutes?: number;
  showConflictWarning?: boolean;
  onSaveCreate: (data: {
    eventType: AgendaEventType;
    patientId: string | null;
    title: string;
    date: Date;
    time: string;
    durationMinutes: number;
    reminderSettings?: AgendaReminderSettingsValues;
  }) => Promise<void>;
  onSaveEdit: (data: {
    id: string;
    status: AgendaEventStatus;
    date: string;
    time: string;
    durationMinutes?: number;
  }) => Promise<void>;
  onDeleteEvent?: (id: string) => Promise<void>;
  canDelete?: boolean;
}

const DURATION_PRESETS: readonly number[] = AGENDA_DURATION_PRESETS;

/**
 * Modal unificado de criação, edição e exclusão de agendamentos clínicos.
 * Memoizado com React.memo para evitar re-renderizações desnecessárias.
 */
export const AgendaEventModal = React.memo<AgendaEventModalProps>(({
  open,
  onOpenChange,
  mode,
  initialDate,
  initialTime,
  selectedEvent,
  patients,
  existingEvents = [],
  defaultDurationMinutes = 50,
  showConflictWarning = true,
  onSaveCreate,
  onSaveEdit,
  onDeleteEvent,
  canDelete = false,
}) => {
  // Form State
  const [eventType, setEventType] = useState<AgendaEventType>("atendimento");
  const [patientQuery, setPatientQuery] = useState("");
  const [patientComboboxOpen, setPatientComboboxOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<AgendaPatientOption | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:50");
  const [durationMinutes, setDurationMinutes] = useState<number>(defaultDurationMinutes);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDurationInput, setCustomDurationInput] = useState(String(defaultDurationMinutes));
  const [status, setStatus] = useState<AgendaEventStatus>("aguardando_confirmacao");
  const [reminderSettings, setReminderSettings] = useState<AgendaReminderSettingsValues>(DEFAULT_REMINDER_SETTINGS);

  // Loading States
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Detecção de conflitos de horários no mesmo dia
  const conflicts = useMemo(() => {
    if (!showConflictWarning || !existingEvents || existingEvents.length === 0 || !time || !durationMinutes) {
      return [];
    }
    return findConflictingAgendaEvents({
      date,
      startTime: time,
      durationMinutes,
      existingEvents,
      excludeEventId: mode === "edit" ? selectedEvent?.id : undefined,
    });
  }, [showConflictWarning, date, time, durationMinutes, existingEvents, mode, selectedEvent?.id]);

  const isPastDateTime = useMemo(() => {
    if (mode !== "create" || !isValidTimeString(time)) return false;
    try {
      const scheduledDateTime = getAgendaEventDateTime(date, time);
      return isAgendaEventDateTimeInPast(scheduledDateTime, new Date(), 15);
    } catch {
      return false;
    }
  }, [mode, date, time, open]);

  // Helper para somar minutos ao horário HH:mm
  const computeEndTimeFromDuration = useCallback((startTimeStr: string, duration: number): string => {
    const [h, m] = startTimeStr.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return "10:00";
    const totalMinutes = h * 60 + m + (duration || 0);
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  }, []);

  // Helper para calcular duração a partir de início e término
  const computeDurationFromEnd = useCallback((startTimeStr: string, endTimeStr: string): number => {
    const [startH, startM] = startTimeStr.split(":").map(Number);
    const [endH, endM] = endTimeStr.split(":").map(Number);
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return defaultDurationMinutes;

    let diff = (endH * 60 + endM) - (startH * 60 + startM);
    // Se o término for menor ou igual ao início, assumir passagem da meia-noite (próximo dia)
    if (diff <= 0) {
      diff += 24 * 60;
    }
    return Math.min(Math.max(diff, 1), 1440);
  }, [defaultDurationMinutes]);

  // Reset or Populate form on modal open/change
  useEffect(() => {
    if (!open) return;

    if (mode === "create") {
      setEventType("atendimento");
      setSelectedPatient(null);
      setPatientQuery("");
      setTitle("");
      setDate(initialDate || new Date());
      const startTime = initialTime || "09:00";
      setTime(startTime);
      const initialDuration = defaultDurationMinutes || 50;
      setDurationMinutes(initialDuration);
      setIsCustomDuration(false);
      setCustomDurationInput(String(initialDuration));
      setEndTime(computeEndTimeFromDuration(startTime, initialDuration));
      setStatus("aguardando_confirmacao");
      setReminderSettings(DEFAULT_REMINDER_SETTINGS);
    } else if (mode === "edit" && selectedEvent) {
      setEventType(selectedEvent.eventType);
      const foundPatient = selectedEvent.patientId
        ? patients.find((p) => p.id === selectedEvent.patientId) || null
        : null;
      setSelectedPatient(foundPatient);
      setPatientQuery(foundPatient?.name || "");
      setTitle(selectedEvent.title);
      setDate(selectedEvent.date);
      setTime(selectedEvent.time);
      setStatus(selectedEvent.status);
      const dur = selectedEvent.durationMinutes || 50;
      setDurationMinutes(dur);
      setIsCustomDuration(!DURATION_PRESETS.includes(dur));
      setCustomDurationInput(String(dur));
      setEndTime(computeEndTimeFromDuration(selectedEvent.time, dur));
    }
  }, [open, mode, initialDate, initialTime, selectedEvent, patients, computeEndTimeFromDuration]);

  // Sugestão de duração média histórica quando um paciente é selecionado
  // (Padrão clínico comum: 50 minutos para atendimentos psicológicos/terapêuticos)
  const suggestedPatientDuration = useMemo(() => {
    if (eventType !== "atendimento" || !selectedPatient) return null;
    return 50; // 50 min recomendação padrão
  }, [eventType, selectedPatient]);

  // Autocomplete filtrado de pacientes
  const filteredPatients = useMemo(() => {
    const q = sanitizeSingleLineInput(patientQuery, INPUT_LIMITS.name).trim().toLowerCase();
    if (!q) return patients.slice(0, 10);
    return patients.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 10);
  }, [patientQuery, patients]);

  // Alteração do Horário de Início -> Recalcula o Horário de Término mantendo a duração
  const handleStartTimeChange = (newStartTime: string) => {
    setTime(newStartTime);
    if (isValidTimeString(newStartTime)) {
      setEndTime(computeEndTimeFromDuration(newStartTime, durationMinutes || 50));
    }
  };

  // Alteração manual do Horário de Término -> Recalcula a Duração e atualiza os presets
  const handleEndTimeChange = (newEndTime: string) => {
    setEndTime(newEndTime);
    if (isValidTimeString(newEndTime) && isValidTimeString(time)) {
      const calculatedDuration = computeDurationFromEnd(time, newEndTime);
      setDurationMinutes(calculatedDuration);
      setCustomDurationInput(String(calculatedDuration));
      setIsCustomDuration(!DURATION_PRESETS.includes(calculatedDuration));
    }
  };

  // Seleção de preset de duração -> Recalcula Horário de Término
  const handleSelectDurationPreset = (minutes: number) => {
    setDurationMinutes(minutes);
    setIsCustomDuration(false);
    setCustomDurationInput(String(minutes));
    if (isValidTimeString(time)) {
      setEndTime(computeEndTimeFromDuration(time, minutes));
    }
  };

  // Digitação manual da duração -> Recalcula Horário de Término
  const handleCustomDurationChange = (val: string) => {
    const sanitized = val.replace(/\D/g, "").slice(0, 4);
    setCustomDurationInput(sanitized);
    const num = parseInt(sanitized, 10);
    if (!isNaN(num) && num > 0 && num <= 1440) {
      setDurationMinutes(num);
      if (isValidTimeString(time)) {
        setEndTime(computeEndTimeFromDuration(time, num));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidTimeString(time)) {
      toast({
        title: "Horário inválido",
        description: "Informe um horário válido no formato HH:mm entre 00:00 e 23:59.",
        variant: "destructive",
        telemetry: "validation",
      });
      return;
    }

    if (mode === "create" && isPastDateTime) {
      return;
    }

    const finalDuration =
      typeof durationMinutes === "number" && durationMinutes > 0 && durationMinutes <= 1440
        ? Math.round(durationMinutes)
        : 50;

    if (mode === "create") {
      if (eventType === "atendimento" && (!selectedPatient || !selectedPatient.id)) {
        toast({
          title: "Paciente obrigatório",
          description: "Selecione um paciente para agendar o atendimento.",
          variant: "destructive",
          telemetry: "validation",
        });
        return;
      }

      if (eventType !== "atendimento" && !title.trim()) {
        toast({
          title: "Título obrigatório",
          description: "Informe um título para o compromisso.",
          variant: "destructive",
          telemetry: "validation",
        });
        return;
      }
    }

    setSaving(true);
    try {
      if (mode === "create") {
        await onSaveCreate({
          eventType,
          patientId: selectedPatient?.id || null,
          title: eventType === "atendimento" ? selectedPatient?.name || "" : title,
          date,
          time,
          durationMinutes: finalDuration,
          reminderSettings,
        });
      } else if (mode === "edit" && selectedEvent) {
        await onSaveEdit({
          id: selectedEvent.id,
          status,
          date: format(date, "yyyy-MM-dd"),
          time,
          durationMinutes: finalDuration,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent || !onDeleteEvent) return;
    setDeleting(true);
    try {
      await onDeleteEvent(selectedEvent.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6 rounded-2xl">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-bold">
            {mode === "create" ? "Novo Agendamento" : "Editar Agendamento"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {mode === "create"
              ? "Preencha os detalhes para agendar um novo atendimento ou evento."
              : "Atualize os horários, status ou gerencie este agendamento."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Tipo de Agendamento */}
          {mode === "create" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tipo de agendamento</Label>
              <Select
                value={eventType}
                onValueChange={(v) => {
                  setEventType(v as AgendaEventType);
                  if (v !== "atendimento") {
                    setSelectedPatient(null);
                  }
                }}
              >
                <SelectTrigger className="h-9 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
            </div>
          )}

          {/* Seleção de Paciente (se atendimento) */}
          {eventType === "atendimento" ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Paciente</Label>
              {mode === "create" ? (
                <Popover open={patientComboboxOpen} onOpenChange={setPatientComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={patientComboboxOpen}
                      className="h-9 w-full justify-between rounded-xl text-xs font-normal"
                    >
                      {selectedPatient ? (
                        <span className="flex items-center gap-1.5 font-medium text-foreground truncate">
                          <User className="h-3.5 w-3.5 text-primary" />
                          {selectedPatient.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Selecionar paciente...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Buscar paciente..."
                        value={patientQuery}
                        onValueChange={(val) =>
                          setPatientQuery(sanitizeSingleLineInput(val, INPUT_LIMITS.name))
                        }
                        className="h-9 text-xs"
                      />
                      <CommandList>
                        <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
                          Nenhum paciente encontrado.
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredPatients.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.name}
                              onSelect={() => {
                                setSelectedPatient(p);
                                setPatientComboboxOpen(false);
                              }}
                              className="text-xs cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 text-primary",
                                  selectedPatient?.id === p.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="truncate">{p.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              ) : (
                <div className="flex items-center gap-2 p-2.5 rounded-xl border bg-muted/30 text-xs">
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-foreground truncate">
                    {selectedPatient?.name || selectedEvent?.title || "Paciente"}
                  </span>
                </div>
              )}

              {/* Pílula com sugestão de duração média histórica ao selecionar paciente */}
              {suggestedPatientDuration && (
                <div className="flex items-center justify-between gap-2 mt-1.5 p-2 rounded-xl bg-primary/5 border border-primary/20 text-xs">
                  <div className="flex items-center gap-1.5 text-primary">
                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-[11px] font-medium">
                      Duração sugerida: <strong>{suggestedPatientDuration} min</strong> (padrão clínico)
                    </span>
                  </div>
                  {durationMinutes !== suggestedPatientDuration && (
                    <button
                      type="button"
                      onClick={() => handleSelectDurationPreset(suggestedPatientDuration)}
                      className="text-[11px] font-semibold text-primary underline hover:text-primary/80 shrink-0"
                    >
                      Aplicar
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Título do Evento */
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Título</Label>
              <Input
                placeholder="Ex: Reunião de equipe"
                value={title}
                onChange={(e) =>
                  setTitle(sanitizeSingleLineInput(e.target.value, INPUT_LIMITS.agendaTitle))
                }
                maxLength={INPUT_LIMITS.agendaTitle}
                disabled={mode === "edit"}
                className="h-9 rounded-xl text-xs"
              />
            </div>
          )}

          {/* Status (Modo Edição) */}
          {mode === "edit" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Status do compromisso</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AgendaEventStatus)}>
                <SelectTrigger className="h-9 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aguardando_confirmacao" className="text-xs">
                    Aguardando confirmação
                  </SelectItem>
                  <SelectItem value="confirmado" className="text-xs">
                    Confirmado
                  </SelectItem>
                  <SelectItem value="cancelado" className="text-xs">
                    Cancelado
                  </SelectItem>
                  <SelectItem value="lembrete" className="text-xs">
                    Lembrete
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Linha com Data, Horário de Início e Horário de Término */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Data */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full justify-start text-xs rounded-xl font-normal"
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    {format(date, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    disabled={
                      mode === "create"
                        ? (day) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const normalizedDay = new Date(day);
                            normalizedDay.setHours(0, 0, 0, 0);
                            return normalizedDay.getTime() < today.getTime();
                          }
                        : undefined
                    }
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Horário de Início */}
            <div className="space-y-1.5">
              <Label htmlFor="agenda-start-time" className="text-xs font-semibold">Horário de início</Label>
              <Input
                id="agenda-start-time"
                type="time"
                value={time}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="h-9 rounded-xl text-xs"
                required
              />
            </div>

            {/* Horário de Término (Editável) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="agenda-end-time" className="text-xs font-semibold">Horário de término</Label>
              </div>
              <Input
                id="agenda-end-time"
                type="time"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="h-9 rounded-xl text-xs font-medium text-primary border-primary/30 focus-visible:border-primary"
                required
              />
            </div>
          </div>

          <AgendaEventDurationAndWarnings
            time={time}
            endTime={endTime}
            durationMinutes={durationMinutes}
            isCustomDuration={isCustomDuration}
            customDurationInput={customDurationInput}
            isPastDateTime={mode === "create" && isPastDateTime}
            conflicts={conflicts}
            onSelectDurationPreset={handleSelectDurationPreset}
            onEnableCustomDuration={() => setIsCustomDuration(true)}
            onCustomDurationChange={handleCustomDurationChange}
          />

          {/* Configurações de Lembrete e Notificações */}
          <AgendaReminderSettingsBlock
            values={reminderSettings}
            onChange={setReminderSettings}
            patientName={selectedPatient?.name}
          />

          <DialogFooter className="gap-2 pt-2 sm:justify-between">
            {mode === "edit" && canDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="gap-1.5 rounded-xl text-xs"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Excluir
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={saving || deleting}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving || deleting || (mode === "create" && isPastDateTime)}
                className="gap-1.5 rounded-xl text-xs font-semibold"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {mode === "create" ? "Agendar" : "Salvar alterações"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

AgendaEventModal.displayName = "AgendaEventModal";

