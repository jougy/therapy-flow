import { format } from "date-fns";
import { CalendarDays, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DismissibleInfoTip } from "@/components/ui/dismissible-info-tip";
import { cn } from "@/lib/utils";
import { INPUT_LIMITS } from "@/lib/input-security";
import { AGENDA_PAST_EVENT_ERROR_MESSAGE } from "@/lib/agenda-events";

const getLocalDayTimestamp = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
import { AgendaReminderSettingsBlock, type AgendaReminderSettingsValues } from "./AgendaReminderSettingsBlock";
import type { AgendaEventType, AgendaPatientOption } from "./types";

export interface AgendaNewEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
  eventType: AgendaEventType;
  eventTypeLabels: Record<AgendaEventType, string>;
  onEventTypeChange: (value: AgendaEventType) => void;
  fixedPatientName?: string;
  patientComboboxOpen: boolean;
  onPatientComboboxOpenChange: (open: boolean) => void;
  selectedPatient: AgendaPatientOption | null;
  patientQuery: string;
  onPatientQueryChange: (query: string) => void;
  filteredPatients: AgendaPatientOption[];
  onSelectPatient: (patient: AgendaPatientOption) => void;
  newTitle: string;
  onTitleChange: (title: string) => void;
  newEventDate: Date | null;
  onNewEventDateChange: (date: Date) => void;
  todayDay: Date;
  datesWithEvents: Date[];
  newTime: string;
  onNewTimeChange: (time: string) => void;
  isNewEventDateTimePast: boolean;
  reminderSettings: AgendaReminderSettingsValues;
  onReminderSettingsChange: (values: AgendaReminderSettingsValues) => void;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
}

export function AgendaNewEventDialog({
  open,
  onOpenChange,
  onReset,
  eventType,
  eventTypeLabels,
  onEventTypeChange,
  fixedPatientName,
  patientComboboxOpen,
  onPatientComboboxOpenChange,
  selectedPatient,
  patientQuery,
  onPatientQueryChange,
  filteredPatients,
  onSelectPatient,
  newTitle,
  onTitleChange,
  newEventDate,
  onNewEventDateChange,
  todayDay,
  datesWithEvents,
  newTime,
  onNewTimeChange,
  isNewEventDateTimePast,
  reminderSettings,
  onReminderSettingsChange,
  saving,
  canSave,
  onSave,
}: AgendaNewEventDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          onReset();
        }
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-md sm:p-6">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-base font-semibold">Novo agendamento</DialogTitle>
          <DialogDescription className="sr-only">
            Formulário para criação de agendamento na agenda da clínica.
          </DialogDescription>
          <DismissibleInfoTip id="agenda-new-event-helper" className="mt-1">
            Crie um novo agendamento usando a mesma agenda compartilhada da clínica.
          </DismissibleInfoTip>
        </DialogHeader>
        <div className="space-y-3.5 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tipo</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(eventTypeLabels) as Array<[AgendaEventType, string]>).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={eventType === value ? "default" : "outline"}
                  onClick={() => onEventTypeChange(value)}
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
              <Popover open={patientComboboxOpen} onOpenChange={onPatientComboboxOpenChange}>
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
                      onValueChange={onPatientQueryChange}
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
                              onSelect={() => onSelectPatient(patient)}
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
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="Digite o título do evento"
                maxLength={INPUT_LIMITS.agendaTitle}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-10 w-full justify-start text-xs rounded-xl font-normal",
                      !newEventDate && "text-muted-foreground"
                    )}
                    title="Selecione a data do agendamento"
                  >
                    <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                    {newEventDate ? format(newEventDate, "dd/MM/yyyy") : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newEventDate ?? undefined}
                    onSelect={(date) => {
                      if (date && getLocalDayTimestamp(date) >= todayDay.getTime()) {
                        onNewEventDateChange(date);
                      }
                    }}
                    disabled={(date) => getLocalDayTimestamp(date) < todayDay.getTime()}
                    className={cn("p-3 pointer-events-auto")}
                    modifiers={{ hasEvent: datesWithEvents }}
                    modifiersClassNames={{ hasEvent: "bg-primary/20 font-bold" }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agenda-new-time" className="text-xs font-semibold">Horário</Label>
              <Input
                id="agenda-new-time"
                type="time"
                value={newTime}
                onChange={(event) => onNewTimeChange(event.target.value)}
                className="h-10 rounded-xl text-xs"
                required
              />
            </div>
          </div>

          {isNewEventDateTimePast ? (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              {AGENDA_PAST_EVENT_ERROR_MESSAGE}
            </div>
          ) : null}

          <AgendaReminderSettingsBlock
            values={reminderSettings}
            onChange={onReminderSettingsChange}
            patientName={selectedPatient?.name || fixedPatientName || undefined}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" onClick={onReset}>Cancelar</Button>
          </DialogClose>
          <Button size="sm" onClick={onSave} disabled={!canSave}>
            {saving ? "Salvando..." : "Confirmar agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
