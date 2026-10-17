import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { AGENDA_PAST_EVENT_ERROR_MESSAGE } from "@/lib/agenda-events";

export interface PatientScheduleAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  agendaDate: string;
  onAgendaDateChange: (date: string) => void;
  agendaTime: string;
  onAgendaTimeChange: (time: string) => void;
  isAgendaDialogDateTimePast: boolean;
  savingAgendaEvent: boolean;
  onConfirmSchedule: () => Promise<void> | void;
}

export function PatientScheduleAttendanceDialog({
  open,
  onOpenChange,
  patientName,
  agendaDate,
  onAgendaDateChange,
  agendaTime,
  onAgendaTimeChange,
  isAgendaDialogDateTimePast,
  savingAgendaEvent,
  onConfirmSchedule,
}: PatientScheduleAttendanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-sm sm:p-6">
        <DialogHeader>
          <DialogTitle>Agendar atendimento</DialogTitle>
          <DialogDescription>
            Crie um horário para este paciente usando a mesma agenda da homepage.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-xl border bg-muted/20 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paciente</p>
            <p className="mt-1 font-semibold">{patientName}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="patient-agenda-date">Data</Label>
              <Input
                id="patient-agenda-date"
                type="date"
                value={agendaDate}
                onChange={(event) => onAgendaDateChange(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-agenda-time">Horário</Label>
              <Input
                id="patient-agenda-time"
                type="time"
                value={agendaTime}
                onChange={(event) => onAgendaTimeChange(event.target.value)}
              />
            </div>
          </div>
          {isAgendaDialogDateTimePast ? (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              {AGENDA_PAST_EVENT_ERROR_MESSAGE}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Este agendamento usa a mesma agenda da homepage e aparecerá nos dois lugares.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={savingAgendaEvent}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            onClick={() => void onConfirmSchedule()}
            disabled={savingAgendaEvent || !agendaDate || !agendaTime || isAgendaDialogDateTimePast}
          >
            {savingAgendaEvent ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
