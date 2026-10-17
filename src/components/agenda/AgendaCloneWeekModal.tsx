import React, { useMemo, useState } from "react";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, AlertCircle, Calendar as CalendarIcon, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AgendaEventItem } from "./types";
import type { AgendaPatientOption } from "@/lib/agenda-events";

export interface AgendaCloneWeekModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDate: Date;
  events: AgendaEventItem[];
  patients: AgendaPatientOption[];
  onCloneWeek: (eventsToClone: AgendaEventItem[], targetWeekStart: Date) => Promise<void>;
}

export const AgendaCloneWeekModal: React.FC<AgendaCloneWeekModalProps> = ({
  open,
  onOpenChange,
  currentDate,
  events,
  patients,
  onCloneWeek,
}) => {
  const [isCloning, setIsCloning] = useState(false);

  // Calcula intervalo da semana atual (Segunda a Domingo)
  const sourceWeekStart = useMemo(() => {
    return startOfWeek(currentDate, { weekStartsOn: 1 });
  }, [currentDate]);

  const sourceWeekEnd = useMemo(() => {
    return endOfWeek(currentDate, { weekStartsOn: 1 });
  }, [currentDate]);

  // Semana de destino: exatamente 7 dias à frente
  const targetWeekStart = useMemo(() => {
    return addDays(sourceWeekStart, 7);
  }, [sourceWeekStart]);

  const targetWeekEnd = useMemo(() => {
    return addDays(sourceWeekEnd, 7);
  }, [sourceWeekEnd]);

  // Eventos presentes na semana de origem
  const weekEvents = useMemo(() => {
    const startMs = sourceWeekStart.getTime();
    const endMs = new Date(sourceWeekEnd.getFullYear(), sourceWeekEnd.getMonth(), sourceWeekEnd.getDate(), 23, 59, 59, 999).getTime();

    return events.filter((ev) => {
      const evMs = ev.date.getTime();
      return evMs >= startMs && evMs <= endMs;
    });
  }, [events, sourceWeekStart, sourceWeekEnd]);

  const patientMap = useMemo(() => {
    const map = new Map<string, string>();
    patients.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [patients]);

  const handleConfirm = async () => {
    if (weekEvents.length === 0) return;
    try {
      setIsCloning(true);
      await onCloneWeek(weekEvents, targetWeekStart);
      onOpenChange(false);
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-6 sm:p-7">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Copy className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Clonar Semana da Agenda
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Copie todos os agendamentos desta semana diretamente para a próxima semana.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Resumo visual do De -> Para */}
        <div className="rounded-xl border bg-muted/30 p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                Semana de Origem
              </span>
              <span className="font-semibold text-foreground truncate block">
                {format(sourceWeekStart, "dd/MM")} a {format(sourceWeekEnd, "dd/MM/yyyy")}
              </span>
            </div>

            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

            <div className="flex-1 min-w-0 text-right">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                Semana de Destino
              </span>
              <span className="font-semibold text-primary truncate block">
                {format(targetWeekStart, "dd/MM")} a {format(targetWeekEnd, "dd/MM/yyyy")}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-2.5 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-xs font-semibold">
              {weekEvents.length} {weekEvents.length === 1 ? "agendamento" : "agendamentos"}
            </Badge>
            <span className="text-[11px]">
              Todos entrarão com status <strong className="text-amber-600 dark:text-amber-400">Aguardando Confirmação</strong>.
            </span>
          </div>
        </div>

        {/* Lista prévia dos itens da semana */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Prévia dos agendamentos a serem replicados:
          </label>

          {weekEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center text-xs text-muted-foreground">
              <AlertCircle className="h-6 w-6 text-amber-500 mb-1.5" />
              <p className="font-medium text-foreground">Nenhum compromisso nesta semana</p>
              <p className="text-[11px] text-muted-foreground">Não há agendamentos cadastrados para serem clonados.</p>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {weekEvents.map((ev) => {
                const patientName = ev.patientId ? patientMap.get(ev.patientId) : null;
                const displayName = patientName || ev.title;
                const weekday = format(ev.date, "EEEE", { locale: ptBR });

                return (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-primary text-[11px] capitalize w-20 shrink-0">
                        {weekday.slice(0, 3)}. {ev.time}
                      </span>
                      <span className="truncate font-medium text-foreground" title={displayName}>
                        {displayName}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0 py-0">
                      {ev.eventType}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl text-xs"
            onClick={() => onOpenChange(false)}
            disabled={isCloning}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            size="sm"
            className="rounded-xl text-xs font-semibold gap-1.5"
            onClick={handleConfirm}
            disabled={isCloning || weekEvents.length === 0}
          >
            {isCloning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Clonando semana...
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copiar {weekEvents.length} agendamentos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
