import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { getCurrentDateTimeInputValue } from "@/lib/session-payload";

export interface SessionPresenceCardProps {
  scheduledStartAt: string;
  patientArrivedAt: string;
  sessionDate: string;
  arrivalDeltaLabel?: string | null;
  arrivalDelayMinutes?: number | null;
  locked: boolean;
  onScheduledStartAtChange: (value: string) => void;
  onPatientArrivedAtChange: (value: string) => void;
  onSessionDateChange: (value: string) => void;
}

export function SessionPresenceCard({
  scheduledStartAt,
  patientArrivedAt,
  sessionDate,
  arrivalDeltaLabel,
  arrivalDelayMinutes,
  locked,
  onScheduledStartAtChange,
  onPatientArrivedAtChange,
  onSessionDateChange,
}: SessionPresenceCardProps) {
  return (
    <div data-tutorial="session-timer">
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Presença</h2>
              <p className="text-sm text-muted-foreground">Registre o horário combinado e a chegada do paciente.</p>
            </div>
            <ComponentHelpButton helpId="session-timer" size="xs" />
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1.2fr)_minmax(280px,1.2fr)]">
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="scheduled-start">Horário agendado</Label>
              <Input
                id="scheduled-start"
                className="w-full min-w-0"
                max="2100-12-31T23:59"
                min="2000-01-01T00:00"
                type="datetime-local"
                value={scheduledStartAt}
                onChange={(event) => onScheduledStartAtChange(event.target.value)}
                disabled={locked}
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label htmlFor="patient-arrived">Horário de chegada</Label>
                <div className="flex items-center gap-1.5">
                  {arrivalDeltaLabel ? (
                    <span className={`text-xs font-semibold ${arrivalDelayMinutes && arrivalDelayMinutes > 0 ? "text-destructive" : "text-success"}`}>
                      {arrivalDeltaLabel}
                    </span>
                  ) : null}
                  {!locked && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="h-6 px-2 text-[11px] font-medium"
                      onClick={() => onPatientArrivedAtChange(getCurrentDateTimeInputValue())}
                    >
                      Agora
                    </Button>
                  )}
                </div>
              </div>
              <Input
                id="patient-arrived"
                className="w-full min-w-0"
                max="2100-12-31T23:59"
                min="2000-01-01T00:00"
                type="datetime-local"
                value={patientArrivedAt}
                onChange={(event) => onPatientArrivedAtChange(event.target.value)}
                disabled={locked}
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label htmlFor="session-date">Data e hora do início do atendimento</Label>
                {!locked && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="h-6 px-2 text-[11px] font-medium"
                    onClick={() => onSessionDateChange(getCurrentDateTimeInputValue())}
                  >
                    Agora
                  </Button>
                )}
              </div>
              <Input
                id="session-date"
                className="w-full min-w-0"
                max="2100-12-31T23:59"
                min="2000-01-01T00:00"
                type="datetime-local"
                value={sessionDate}
                onChange={(event) => onSessionDateChange(event.target.value)}
                disabled={locked}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
