import React from "react";
import { format } from "date-fns";
import {
  CalendarDays,
  Loader2,
  MessageCircle,
  Play,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AGENDA_PAST_EVENT_ERROR_MESSAGE,
  type AgendaEventStatus,
  type AgendaEventType,
  type AgendaPatientOption,
} from "@/lib/agenda-events";

export interface AgendaEventDetailsData {
  id: string;
  eventType: AgendaEventType;
  patientId: string | null;
  scheduledFor: string;
  status: AgendaEventStatus;
  title: string;
  date: Date;
  time: string;
}

export type AgendaStatusAction = AgendaEventStatus | "delete";

interface AgendaEventQuickDialogProps {
  selectedEvent: AgendaEventDetailsData | null;
  onClose: () => void;
  selectedStatusAction: AgendaStatusAction;
  onStatusActionChange: (action: AgendaStatusAction) => void;
  selectedEventDate: string;
  onDateChange: (date: string) => void;
  selectedEventTime: string;
  onTimeChange: (time: string) => void;
  savingSelectedEvent: boolean;
  isSelectedEventDateTimePast: boolean;
  patients: AgendaPatientOption[];
  clinicName?: string;
  canDeleteEvents: boolean;
  onApplyStatus: () => void;
  onUpdateDateTime: () => void;
  onStartAttendance: () => void;
  formatDateTime: (isoDate: string) => string;
  agendaStatusStyles: Record<AgendaEventStatus, string>;
  agendaStatusLabels: Record<AgendaEventStatus, string>;
  agendaStatusOptions: { value: AgendaEventStatus; label: string }[];
  agendaDeleteOption: { value: "delete"; label: string };
}

export const AgendaEventQuickDialog: React.FC<AgendaEventQuickDialogProps> = React.memo(({
  selectedEvent,
  onClose,
  selectedStatusAction,
  onStatusActionChange,
  selectedEventDate,
  onDateChange,
  selectedEventTime,
  onTimeChange,
  savingSelectedEvent,
  isSelectedEventDateTimePast,
  patients,
  clinicName,
  canDeleteEvents,
  onApplyStatus,
  onUpdateDateTime,
  onStartAttendance,
  formatDateTime,
  agendaStatusStyles,
  agendaStatusLabels,
  agendaStatusOptions,
  agendaDeleteOption,
}) => {
  return (
    <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && onClose()}>
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
                <p className="mt-1 font-semibold">{formatDateTime(selectedEvent.scheduledFor)}</p>
              </div>
              <div className="rounded-xl bg-muted/25 px-4 py-3">
                <p className="text-xs text-muted-foreground">Status atual</p>
                <Badge variant="outline" className={`mt-1 ${agendaStatusStyles[selectedEvent.status]}`}>
                  {agendaStatusLabels[selectedEvent.status]}
                </Badge>
              </div>
            </div>

            {/* Lembrete via WhatsApp pré-programado */}
            {(() => {
              const matchedPatient = patients.find((p) => p.id === selectedEvent.patientId);
              const patientPhone = (matchedPatient as { phone?: string | null })?.phone;
              const digits = (patientPhone ?? "").replace(/\D/g, "");
              const fullDigits = digits ? (digits.startsWith("55") ? digits : `55${digits}`) : null;

              const scheduledDateStr = formatDateTime(selectedEvent.scheduledFor);
              const greeting = selectedEvent.title ? `Olá, ${selectedEvent.title}!` : "Olá!";
              const clinicSignature = clinicName ? ` pela *${clinicName}*` : "";

              const message =
                `${greeting} 👋\n\n` +
                `Passando para lembrar do seu atendimento agendado${clinicSignature} para:\n` +
                `🗓️ *${scheduledDateStr}*\n\n` +
                `Poderia nos confirmar sua presença? Responda com *Sim* para confirmar ou avise se precisar reagendar. Até logo! 😊`;

              const waUrl = fullDigits ? `https://wa.me/${fullDigits}?text=${encodeURIComponent(message)}` : null;

              return (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Lembrete via WhatsApp
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {patientPhone
                        ? `Enviar mensagem de confirmação para ${patientPhone}`
                        : selectedEvent.patientId
                        ? "Paciente sem telefone cadastrado"
                        : "Disponível para agendamentos de pacientes"}
                    </p>
                  </div>

                  {waUrl ? (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-medium rounded-xl shadow-xs self-start sm:self-auto shrink-0"
                      onClick={() => window.open(waUrl, "_blank", "noopener,noreferrer")}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>Enviar lembrete</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled
                      className="text-xs gap-1.5 self-start sm:self-auto shrink-0 opacity-60"
                    >
                      <span>Sem WhatsApp</span>
                    </Button>
                  )}
                </div>
              );
            })()}

            <div className="space-y-2">
              <Label>Trocar status</Label>
              <Select value={selectedStatusAction} onValueChange={(value) => onStatusActionChange(value as AgendaStatusAction)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agendaStatusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                  {canDeleteEvents && (
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
                  onChange={(event) => onDateChange(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="homepage-agenda-time">Novo horário</Label>
                <Input
                  id="homepage-agenda-time"
                  type="time"
                  value={selectedEventTime}
                  onChange={(event) => onTimeChange(event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={onUpdateDateTime}
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
            onClick={onApplyStatus}
            disabled={savingSelectedEvent}
            variant={selectedStatusAction === "delete" ? "destructive" : "default"}
          >
            {savingSelectedEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Aplicar status
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onStartAttendance}
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
  );
});

AgendaEventQuickDialog.displayName = "AgendaEventQuickDialog";
