import React from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AGENDA_PAST_EVENT_ERROR_MESSAGE } from "@/lib/agenda-events";
import type { ConflictingAgendaEvent } from "@/lib/agenda-slot-condenser";

export const AGENDA_DURATION_PRESETS = [30, 45, 50, 60, 90] as const;

interface AgendaEventDurationAndWarningsProps {
  time: string;
  endTime: string;
  durationMinutes: number;
  isCustomDuration: boolean;
  customDurationInput: string;
  isPastDateTime: boolean;
  conflicts: ConflictingAgendaEvent[];
  onSelectDurationPreset: (minutes: number) => void;
  onEnableCustomDuration: () => void;
  onCustomDurationChange: (val: string) => void;
}

export const AgendaEventDurationAndWarnings: React.FC<AgendaEventDurationAndWarningsProps> = ({
  time,
  endTime,
  durationMinutes,
  isCustomDuration,
  customDurationInput,
  isPastDateTime,
  conflicts,
  onSelectDurationPreset,
  onEnableCustomDuration,
  onCustomDurationChange,
}) => {
  return (
    <>
      {isPastDateTime && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200 min-w-0 break-words"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{AGENDA_PAST_EVENT_ERROR_MESSAGE}</span>
        </div>
      )}

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

        <div className="flex flex-wrap items-center gap-1.5">
          {AGENDA_DURATION_PRESETS.map((minutes) => {
            const isSelected = !isCustomDuration && durationMinutes === minutes;
            return (
              <button
                key={minutes}
                type="button"
                onClick={() => onSelectDurationPreset(minutes)}
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
            onClick={onEnableCustomDuration}
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

        {isCustomDuration && (
          <div className="flex items-center gap-2 pt-1">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Minutos"
              value={customDurationInput}
              onChange={(e) => onCustomDurationChange(e.target.value)}
              className="h-8 w-24 text-xs rounded-xl"
              maxLength={3}
            />
            <span className="text-xs text-muted-foreground">minutos personalizados</span>
          </div>
        )}
      </div>

      {conflicts.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200 min-w-0 break-words">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1 min-w-0">
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
    </>
  );
};
