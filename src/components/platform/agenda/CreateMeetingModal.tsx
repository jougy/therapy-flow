import React, { useState } from "react";
import { format } from "date-fns";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarPlus, Loader2, Video, Phone, User, Building, Mail } from "lucide-react";
import type { OnboardingMeeting } from "./types";

interface CreateMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateMeeting: (payload: {
    lead_name: string;
    phone: string;
    email?: string;
    clinic_name?: string;
    scheduled_at: string;
    duration_minutes: number;
    meet_url?: string;
    notes?: string;
  }) => Promise<void>;
}

export const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({
  open,
  onOpenChange,
  onCreateMeeting,
}) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [leadName, setLeadName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dateStr, setDateStr] = useState(format(tomorrow, "yyyy-MM-dd"));
  const [timeStr, setTimeStr] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState("15");
  const [meetUrl, setMeetUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setLeadName("");
    setClinicName("");
    setPhone("");
    setEmail("");
    setDateStr(format(tomorrow, "yyyy-MM-dd"));
    setTimeStr("10:00");
    setDurationMinutes("15");
    setMeetUrl("");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName.trim() || !phone.trim() || !dateStr || !timeStr) return;

    setSaving(true);
    try {
      const scheduledAt = new Date(`${dateStr}T${timeStr}:00`).toISOString();
      await onCreateMeeting({
        lead_name: leadName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        clinic_name: clinicName.trim() || undefined,
        scheduled_at: scheduledAt,
        duration_minutes: parseInt(durationMinutes, 10) || 15,
        meet_url: meetUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      resetForm();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarPlus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">Novo Agendamento de Onboarding</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Adicione uma nova reunião de demonstração ou onboarding para acompanhamento master.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3.5 py-1">
            {/* Lead Name & Clinic */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lead-name" className="text-xs font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Nome do Lead / Profissional *
                </Label>
                <Input
                  id="lead-name"
                  required
                  placeholder="Ex: Dra. Mariana Costa"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="clinic-name" className="text-xs font-medium flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-muted-foreground" />
                  Clínica / Empresa
                </Label>
                <Input
                  id="clinic-name"
                  placeholder="Ex: Clínica FisioVida"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Phone & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lead-phone" className="text-xs font-medium flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Telefone / WhatsApp *
                </Label>
                <Input
                  id="lead-phone"
                  required
                  placeholder="Ex: (11) 98765-4321"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lead-email" className="text-xs font-medium flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  E-mail
                </Label>
                <Input
                  id="lead-email"
                  type="email"
                  placeholder="Ex: mariana@fisiovida.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Date, Time & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="meeting-date" className="text-xs font-medium">
                  Data *
                </Label>
                <Input
                  id="meeting-date"
                  type="date"
                  required
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="meeting-time" className="text-xs font-medium">
                  Horário *
                </Label>
                <Input
                  id="meeting-time"
                  type="time"
                  required
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="meeting-duration" className="text-xs font-medium">
                  Duração
                </Label>
                <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                  <SelectTrigger id="meeting-duration" className="text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutos</SelectItem>
                    <SelectItem value="30">30 minutos</SelectItem>
                    <SelectItem value="45">45 minutos</SelectItem>
                    <SelectItem value="60">60 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Google Meet Link */}
            <div className="space-y-1.5">
              <Label htmlFor="meet-url" className="text-xs font-medium flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5 text-muted-foreground" />
                Link da Reunião (Google Meet / Zoom)
              </Label>
              <Input
                id="meet-url"
                placeholder="Ex: https://meet.google.com/abc-defg-hij"
                value={meetUrl}
                onChange={(e) => setMeetUrl(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="meeting-notes" className="text-xs font-medium">
                Anotações e Contexto do Lead
              </Label>
              <Textarea
                id="meeting-notes"
                placeholder="Ex: Conheceu a plataforma pelo Instagram. Deseja migrar de software de prontuário eletrônico."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm min-h-[80px]"
              />
            </div>
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
              disabled={saving || !leadName.trim() || !phone.trim() || !dateStr || !timeStr}
              className="gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              Agendar Reunião
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
