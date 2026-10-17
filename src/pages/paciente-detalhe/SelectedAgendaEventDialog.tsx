import { useState } from "react";
import { Calendar, Clock, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AGENDA_PAST_EVENT_ERROR_MESSAGE } from "@/lib/agenda-events";
import type { AgendaEvent, AgendaStatusAction } from "./pacienteDetalheTypes";
import {
  AGENDA_STATUS_OPTIONS,
  AGENDA_DELETE_OPTION,
  agendaStatusBadgeStyles,
  formatAgendaEventDateTime,
  getAgendaEventStatus,
  getAgendaStatusLabel,
} from "./pacienteDetalheHelpers";

export interface SelectedAgendaEventDialogProps {
  selectedAgendaEvent: AgendaEvent | null;
  onClose: () => void;
  patientName: string;
  patientPhone?: string | null;
  clinicName?: string | null;
  selectedAgendaStatusAction: AgendaStatusAction;
  onSelectAgendaStatusAction: (action: AgendaStatusAction) => void;
  selectedAgendaDate: string;
  onSelectAgendaDateChange: (date: string) => void;
  selectedAgendaTime: string;
  onSelectAgendaTimeChange: (time: string) => void;
  isSelectedAgendaDateTimePast: boolean;
  savingAgendaDetails: boolean;
  onUpdateAgendaDateTime: () => Promise<void> | void;
  onApplyAgendaStatus: (overrideAction?: AgendaStatusAction) => Promise<void> | void;
}

export function SelectedAgendaEventDialog({
  selectedAgendaEvent,
  onClose,
  patientName,
  patientPhone,
  clinicName,
  selectedAgendaStatusAction,
  onSelectAgendaStatusAction,
  selectedAgendaDate,
  onSelectAgendaDateChange,
  selectedAgendaTime,
  onSelectAgendaTimeChange,
  isSelectedAgendaDateTimePast,
  savingAgendaDetails,
  onUpdateAgendaDateTime,
  onApplyAgendaStatus,
}: SelectedAgendaEventDialogProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Geração do link de WhatsApp pré-programado com lembrete amigável
  const buildWhatsAppReminderUrl = () => {
    if (!patientPhone) return null;
    const digits = patientPhone.replace(/\D/g, "");
    if (!digits) return null;
    const fullDigits = digits.startsWith("55") ? digits : `55${digits}`;

    const scheduledDateStr = selectedAgendaEvent
      ? formatAgendaEventDateTime(selectedAgendaEvent.scheduled_for)
      : "";
    const greeting = patientName ? `Olá, ${patientName}!` : "Olá!";
    const clinicSignature = clinicName ? ` pela *${clinicName}*` : "";

    const message =
      `${greeting} 👋\n\n` +
      `Passando para lembrar do seu atendimento agendado${clinicSignature} para:\n` +
      `🗓️ *${scheduledDateStr}*\n\n` +
      `Poderia nos confirmar sua presença? Responda com *Sim* para confirmar ou avise se precisar reagendar. Até logo! 😊`;

    return `https://wa.me/${fullDigits}?text=${encodeURIComponent(message)}`;
  };

  const whatsAppUrl = buildWhatsAppReminderUrl();

  const handleConfirmDelete = async () => {
    setDeleteConfirmOpen(false);
    await onApplyAgendaStatus("delete");
  };

  return (
    <>
      <Dialog open={Boolean(selectedAgendaEvent)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] grid-rows-none flex-col overflow-hidden p-0 sm:max-w-2xl rounded-2xl">
          <DialogHeader className="shrink-0 border-b px-5 pb-3 pt-5 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Configurações do Agendamento</p>
            <DialogTitle className="break-words pr-7 text-xl font-bold leading-tight sm:text-2xl text-foreground">
              {patientName || "Paciente"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Gerencie a data, horário, status de confirmação e envio de lembretes deste agendamento.
            </DialogDescription>
          </DialogHeader>

          {selectedAgendaEvent ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {/* Resumo do Agendamento */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-muted/30 border p-3 flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">Horário Agendado</p>
                    <p className="mt-0.5 text-sm font-bold text-foreground">
                      {formatAgendaEventDateTime(selectedAgendaEvent.scheduled_for)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-muted/30 border p-3 flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground mt-0.5">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">Status de Confirmação</p>
                    <div className="mt-1">
                      <Badge variant="outline" className={`text-xs capitalize font-semibold ${agendaStatusBadgeStyles[getAgendaEventStatus(selectedAgendaEvent)]}`}>
                        {getAgendaStatusLabel(getAgendaEventStatus(selectedAgendaEvent))}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botão de Enviar Lembrete por WhatsApp */}
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Lembrete via WhatsApp
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {patientPhone
                        ? `Enviar confirmação pré-programada para ${patientPhone}`
                        : "Paciente sem telefone cadastrado na ficha"}
                    </p>
                  </div>

                  {whatsAppUrl ? (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-medium rounded-xl shadow-xs self-start sm:self-auto shrink-0"
                      onClick={() => window.open(whatsAppUrl, "_blank", "noopener,noreferrer")}
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
              </div>

              {/* Edição de Data e Horário */}
              <div className="rounded-xl border bg-card p-3.5 space-y-3">
                <p className="text-xs font-semibold text-foreground">Alterar Data e Horário</p>
                <div className="grid gap-3 sm:grid-cols-[1fr,1fr,auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="selected-agenda-date" className="text-xs text-muted-foreground">Nova data</Label>
                    <Input
                      id="selected-agenda-date"
                      type="date"
                      value={selectedAgendaDate}
                      onChange={(event) => onSelectAgendaDateChange(event.target.value)}
                      className="h-9 text-xs rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="selected-agenda-time" className="text-xs text-muted-foreground">Novo horário</Label>
                    <Input
                      id="selected-agenda-time"
                      type="time"
                      value={selectedAgendaTime}
                      onChange={(event) => onSelectAgendaTimeChange(event.target.value)}
                      className="h-9 text-xs rounded-lg"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void onUpdateAgendaDateTime()}
                    disabled={savingAgendaDetails || !selectedAgendaDate || !selectedAgendaTime || isSelectedAgendaDateTimePast}
                    className="h-9 text-xs rounded-lg font-medium"
                  >
                    Trocar data/horário
                  </Button>
                </div>
                {isSelectedAgendaDateTimePast ? (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                    {AGENDA_PAST_EVENT_ERROR_MESSAGE}
                  </div>
                ) : null}
              </div>

              {/* Atualização de Status de Confirmação */}
              <div className="rounded-xl border bg-card p-3.5 space-y-2">
                <Label htmlFor="agenda-status-select" className="text-xs font-semibold text-foreground">Status de Confirmação</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={selectedAgendaStatusAction} onValueChange={(value) => onSelectAgendaStatusAction(value as AgendaStatusAction)}>
                    <SelectTrigger id="agenda-status-select" className="h-9 text-xs rounded-lg flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AGENDA_STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                      <SelectItem value={AGENDA_DELETE_OPTION.value} className="text-destructive focus:text-destructive">
                        {AGENDA_DELETE_OPTION.label}
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void onApplyAgendaStatus()}
                    disabled={savingAgendaDetails}
                    variant={selectedAgendaStatusAction === "delete" ? "destructive" : "default"}
                    className="h-9 text-xs rounded-lg font-medium shrink-0"
                  >
                    {savingAgendaDetails ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    Aplicar status
                  </Button>
                </div>

                {selectedAgendaStatusAction === "cancelado" ? (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Ao aplicar Cancelado, um atendimento vazio com status cancelado será registrado no histórico do paciente.
                  </p>
                ) : selectedAgendaStatusAction === "delete" ? (
                  <p className="text-[11px] text-destructive mt-1">
                    Excluir remove apenas o agendamento da agenda. Nenhum atendimento será criado.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Rodapé com Ações de Excluir e Fechar */}
          <DialogFooter className="flex flex-row items-center justify-between border-t bg-background px-5 py-3.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={savingAgendaDetails}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs gap-1.5 h-8 px-2.5 rounded-lg font-medium"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Excluir agendamento</span>
            </Button>

            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm" className="text-xs h-8 px-4 rounded-lg" disabled={savingAgendaDetails}>
                Fechar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão Direta */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground">Excluir este agendamento?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Esta ação removerá o agendamento de <strong>{patientName}</strong> da agenda. Nenhum registro clínico será alterado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="text-xs h-8 rounded-lg">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDelete()}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs h-8 rounded-lg font-medium"
            >
              Sim, excluir agendamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
