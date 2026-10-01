import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  Clock,
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
  isValidTimeString,
  type AgendaEventStatus,
  type AgendaEventType,
  type AgendaPatientOption,
} from "@/lib/agenda-events";
import { findConflictingAgendaEvents } from "@/lib/agenda-slot-condenser";
import { toast } from "@/hooks/use-toast";
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

const DURATION_PRESETS = [30, 45, 50, 60, 90];

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
      });
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
        });
        return;
      }

      if (eventType !== "atendimento" && !title.trim()) {
        toast({
          title: "Título obrigatório",
          description: "Informe um título para o compromisso.",
          variant: "destructive",
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

          {/* Seleção de Duração (Chips Rápidos + Manual) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Duração da sessão / evento
              </Label>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {time} → <span className="text-primary">{endTime}</span> ({durationMinutes} min)
              </span>
            </div>

            {/* Chips Rápidos */}
            <div className="flex flex-wrap items-center gap-1.5">
              {DURATION_PRESETS.map((minutes) => {
                const isSelected = !isCustomDuration && durationMinutes === minutes;
                return (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => handleSelectDurationPreset(minutes)}
                    className={cn(
                      "px-3 py-1 rounded-xl text-xs font-semibold transition-all duration-150 border",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/70"
                    )}
                  >
                    {minutes} min
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsCustomDuration(true)}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-semibold transition-all duration-150 border",
                  isCustomDuration
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/70"
                )}
              >
                Manual
              </button>
            </div>

            {/* Campo de Duração Manual */}
            {isCustomDuration && (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Minutos"
                  value={customDurationInput}
                  onChange={(e) => handleCustomDurationChange(e.target.value)}
                  className="h-8 w-24 text-xs rounded-xl"
                  maxLength={3}
                />
                <span className="text-xs text-muted-foreground">minutos personalizados</span>
              </div>
            )}
          </div>

          {/* Banner de Aviso de Conflito de Horário */}
          {conflicts.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-semibold leading-tight">
                    Atenção: Horário sobrepõe {conflicts.length === 1 ? "outro compromisso" : `${conflicts.length} outros compromissos`}:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-700/90 dark:text-amber-300/90">
                    {conflicts.map((c) => (
                      <li key={c.event.id}>
                        <span className="font-medium">{c.event.title}</span> ({c.event.time} – {c.endTime})
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 italic pt-0.5">
                    Você ainda pode salvar, mas certifique-se de que não haverá conflito de sala ou atendimento.
                  </p>
                </div>
              </div>
            </div>
          )}

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
                disabled={saving || deleting}
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

