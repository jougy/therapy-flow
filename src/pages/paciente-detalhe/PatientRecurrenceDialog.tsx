import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { PATIENT_RECURRENCE_WEEKDAY_OPTIONS } from "@/lib/patient-recurrence";

export interface PatientRecurrenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurrenceEnabled: boolean;
  onRecurrenceEnabledChange: (enabled: boolean) => void;
  recurrenceWeekdays: number[];
  onToggleRecurrenceWeekday: (weekday: number, checked: boolean | "indeterminate") => void;
  recurrenceTime: string;
  onRecurrenceTimeChange: (time: string) => void;
  savingRecurrence: boolean;
  onSaveRecurrence: () => Promise<void> | void;
}

export function PatientRecurrenceDialog({
  open,
  onOpenChange,
  recurrenceEnabled,
  onRecurrenceEnabledChange,
  recurrenceWeekdays,
  onToggleRecurrenceWeekday,
  recurrenceTime,
  onRecurrenceTimeChange,
  savingRecurrence,
  onSaveRecurrence,
}: PatientRecurrenceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>Recorrência do paciente</DialogTitle>
          <DialogDescription>
            Defina os dias programados para gerar um lembrete da próxima sessão na agenda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <label className="flex items-center gap-3 rounded-xl border bg-muted/20 px-4 py-3 text-sm cursor-pointer">
            <Checkbox
              checked={recurrenceEnabled}
              onCheckedChange={(checked) => onRecurrenceEnabledChange(checked === true)}
              aria-label="Paciente recorrente"
            />
            <span>
              <span className="block font-medium">Paciente recorrente</span>
              <span className="text-xs text-muted-foreground">Mantém um lembrete automático para a próxima sessão.</span>
            </span>
          </label>

          {recurrenceEnabled ? (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="space-y-2">
                <Label>Dias programados</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PATIENT_RECURRENCE_WEEKDAY_OPTIONS.map((weekday) => (
                    <label
                      key={weekday.value}
                      className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm cursor-pointer hover:border-primary/40 transition-colors"
                    >
                      <Checkbox
                        checked={recurrenceWeekdays.includes(weekday.value)}
                        onCheckedChange={(checked) => onToggleRecurrenceWeekday(weekday.value, checked)}
                        aria-label={weekday.label}
                      />
                      <span>{weekday.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="patient-recurrence-time">Horário padrão</Label>
                <Input
                  id="patient-recurrence-time"
                  type="time"
                  value={recurrenceTime}
                  onChange={(event) => onRecurrenceTimeChange(event.target.value)}
                />
              </div>

              <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Ao salvar, o lembrete automático anterior será substituído pelo próximo horário recorrente futuro.
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground px-1">
              Marque a opção acima para definir os dias da semana e o horário de atendimento recorrente deste paciente.
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={savingRecurrence}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            onClick={() => void onSaveRecurrence()}
            disabled={savingRecurrence || (recurrenceEnabled && recurrenceWeekdays.length === 0)}
          >
            {savingRecurrence ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar recorrência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
