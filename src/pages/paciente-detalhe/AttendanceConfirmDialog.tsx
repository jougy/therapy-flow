import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AgendaEvent } from "./pacienteDetalheTypes";
import { formatAgendaEventDateTime } from "./pacienteDetalheHelpers";

export interface AttendanceConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingAttendanceAgendaEvent: AgendaEvent | null;
  onClose: () => void;
  onCancelPendingAgendaEvent: () => Promise<void> | void;
  onConfirmAttendanceWithPendingEvent: () => void;
  onStartUnscheduledAttendance?: () => void;
}

export function AttendanceConfirmDialog({
  open,
  onOpenChange,
  pendingAttendanceAgendaEvent,
  onClose,
  onCancelPendingAgendaEvent,
  onConfirmAttendanceWithPendingEvent,
  onStartUnscheduledAttendance,
}: AttendanceConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Atendimento Agendado Encontrado</DialogTitle>
          <DialogDescription>
            {pendingAttendanceAgendaEvent ? (
              <>
                Existe um atendimento agendado para{" "}
                <strong className="text-foreground">
                  {formatAgendaEventDateTime(pendingAttendanceAgendaEvent.scheduled_for)}
                </strong>
                . Como deseja prosseguir?
              </>
            ) : (
              "Existe um agendamento para este paciente."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2.5 py-2">
          <Button
            type="button"
            className="w-full justify-start text-left h-auto py-2.5 px-3"
            onClick={onConfirmAttendanceWithPendingEvent}
          >
            <div className="flex flex-col items-start gap-0.5">
              <span className="font-semibold text-xs sm:text-sm">Confirmar presença e iniciar</span>
              <span className="text-[11px] opacity-85 font-normal">Aproveita o horário agendado e inicia o atendimento agora.</span>
            </div>
          </Button>

          {onStartUnscheduledAttendance && (
            <Button
              type="button"
              variant="secondary"
              className="w-full justify-start text-left h-auto py-2.5 px-3 border border-border/60 hover:bg-muted"
              onClick={onStartUnscheduledAttendance}
            >
              <div className="flex flex-col items-start gap-0.5">
                <span className="font-semibold text-xs sm:text-sm">Iniciar como atendimento avulso</span>
                <span className="text-[11px] text-muted-foreground font-normal">Inicia um novo atendimento agora sem alterar a vaga futura na agenda.</span>
              </div>
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-left h-auto py-2.5 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void onCancelPendingAgendaEvent()}
          >
            <div className="flex flex-col items-start gap-0.5">
              <span className="font-semibold text-xs sm:text-sm">Cancelar agendamento / Paciente faltou</span>
              <span className="text-[11px] opacity-80 font-normal">Cancela o agendamento e registra falta no prontuário.</span>
            </div>
          </Button>
        </div>

        <DialogFooter className="sm:justify-end border-t pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Voltar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
