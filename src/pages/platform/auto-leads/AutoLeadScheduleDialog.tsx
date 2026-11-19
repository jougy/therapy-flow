import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarPlus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUTO_LEAD_CHANNEL_LABELS,
  type AutoLeadChannel,
  type PlatformAutoLead,
} from "./types";

interface AutoLeadScheduleDialogProps {
  lead: PlatformAutoLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (
    lead: PlatformAutoLead,
    payload: {
      scheduled_at: string;
      duration_minutes: number;
      channel: AutoLeadChannel;
      booked_by_name: string;
      notes?: string;
    }
  ) => Promise<boolean>;
}

export const AutoLeadScheduleDialog: React.FC<AutoLeadScheduleDialogProps> = ({
  lead,
  open,
  onOpenChange,
  onSchedule,
}) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [dateStr, setDateStr] = useState(format(tomorrow, "yyyy-MM-dd"));
  const [timeStr, setTimeStr] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState("15");
  const [channel, setChannel] = useState<AutoLeadChannel>("whatsapp_commercial_5511980113936");
  const [bookedBy, setBookedBy] = useState("Jougy (WhatsApp Comercial +55 11 98011-3936)");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setNotes(lead.scheduling_attempt_summary || "");
    if (lead.meeting_channel) {
      setChannel(lead.meeting_channel);
    }
  }, [lead]);

  const handleChannelChange = (nextChannel: AutoLeadChannel) => {
    setChannel(nextChannel);
    if (nextChannel === "whatsapp_bot_5511960474566") {
      setBookedBy(`${lead?.full_name || "Lead"} (Bot +55 11 96047-4566)`);
    } else if (nextChannel === "whatsapp_commercial_5511980113936") {
      setBookedBy("Jougy (WhatsApp Comercial +55 11 98011-3936)");
    } else {
      setBookedBy("Jougy (Backoffice Master)");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !dateStr || !timeStr) return;
    setSaving(true);
    try {
      const ok = await onSchedule(lead, {
        scheduled_at: new Date(`${dateStr}T${timeStr}:00`).toISOString(),
        duration_minutes: parseInt(durationMinutes, 10) || 15,
        channel,
        booked_by_name: bookedBy.trim() || "Backoffice Master",
        notes: notes.trim() || undefined,
      });
      if (ok) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[88dvh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" />
              <span>Agendar Reunião & Sincronizar Agendas</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cria a reunião na Agenda Master (/platform/agenda) e marca quem realizou o agendamento na Tabela de Contatos para <strong>{lead?.full_name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="auto-lead-channel" className="text-xs font-medium">
                Agenda / Canal de Origem *
              </Label>
              <Select value={channel} onValueChange={(v) => handleChannelChange(v as AutoLeadChannel)}>
                <SelectTrigger id="auto-lead-channel" className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AUTO_LEAD_CHANNEL_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="auto-lead-booked-by" className="text-xs font-medium">
                Quem marcou a reunião? *
              </Label>
              <Input
                id="auto-lead-booked-by"
                required
                value={bookedBy}
                onChange={(e) => setBookedBy(e.target.value)}
                placeholder="Ex: Lead via Bot (+55 11 96047-4566) ou Equipe Comercial"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="auto-lead-date" className="text-xs font-medium">
                  Data *
                </Label>
                <Input
                  id="auto-lead-date"
                  type="date"
                  required
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auto-lead-time" className="text-xs font-medium">
                  Horário *
                </Label>
                <Input
                  id="auto-lead-time"
                  type="time"
                  required
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auto-lead-duration" className="text-xs font-medium">
                  Duração
                </Label>
                <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                  <SelectTrigger id="auto-lead-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="auto-lead-schedule-notes" className="text-xs font-medium">
                Observações da Reunião
              </Label>
              <Textarea
                id="auto-lead-schedule-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contexto do grupo do Facebook ou tentativa anterior no WhatsApp Bot..."
                className="min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !bookedBy.trim()} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              <span>Confirmar & Sincronizar</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
