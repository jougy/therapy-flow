import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock, Loader2 } from "lucide-react";
import type { OnboardingMeeting } from "./types";

interface RescheduleMeetingDialogProps {
  meeting: OnboardingMeeting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReschedule: (meetingId: string, newScheduledAt: string, reasonNotes?: string) => Promise<void>;
}

export const RescheduleMeetingDialog: React.FC<RescheduleMeetingDialogProps> = ({
  meeting,
  open,
  onOpenChange,
  onReschedule,
}) => {
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [reasonNotes, setReasonNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (meeting) {
      try {
        const d = parseISO(meeting.scheduled_at);
        setDateStr(format(d, "yyyy-MM-dd"));
        setTimeStr(format(d, "HH:mm"));
      } catch {
        const now = new Date();
        setDateStr(format(now, "yyyy-MM-dd"));
        setTimeStr("10:00");
      }
      setReasonNotes("");
    }
  }, [meeting, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting || !dateStr || !timeStr) return;

    setSaving(true);
    try {
      const combinedDateTime = new Date(`${dateStr}T${timeStr}:00`).toISOString();
      await onReschedule(meeting.id, combinedDateTime, reasonNotes);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">Remarcar Reunião</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {meeting?.lead_name} {meeting?.clinic_name ? `• ${meeting.clinic_name}` : ""}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-date" className="text-xs font-medium">
                Nova Data *
              </Label>
              <Input
                id="reschedule-date"
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reschedule-time" className="text-xs font-medium">
                Novo Horário *
              </Label>
              <Input
                id="reschedule-time"
                type="time"
                required
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reschedule-notes" className="text-xs font-medium">
              Motivo do Reagendamento (Opcional)
            </Label>
            <Input
              id="reschedule-notes"
              type="text"
              placeholder="Ex: Solicitado pelo cliente via WhatsApp"
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              className="text-sm"
            />
          </div>

          <DialogFooter className="flex gap-2 sm:justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !dateStr || !timeStr}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Confirmar Remarcação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
