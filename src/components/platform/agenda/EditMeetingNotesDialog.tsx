import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Loader2, Save } from "lucide-react";
import type { OnboardingMeeting } from "./types";

interface EditMeetingNotesDialogProps {
  meeting: OnboardingMeeting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (meetingId: string, notes: string) => Promise<void>;
}

export const EditMeetingNotesDialog: React.FC<EditMeetingNotesDialogProps> = ({
  meeting,
  open,
  onOpenChange,
  onSave,
}) => {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (meeting) {
      setNotes(meeting.notes || "");
    }
  }, [meeting, open]);

  const handleSave = async () => {
    if (!meeting) return;
    setSaving(true);
    try {
      await onSave(meeting.id, notes);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Anotações da Reunião</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {meeting?.lead_name} {meeting?.clinic_name ? `• ${meeting.clinic_name}` : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <label className="text-xs font-medium text-foreground">
            Anotações sobre perfil do lead, dúvidas tiradas, plano recomendado ou próximos passos:
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Lead tem interesse no plano Clínica Médio com 4 fisioterapeutas. Ficou de confirmar até sexta-feira..."
            className="min-h-[140px] resize-y text-sm leading-relaxed"
          />
        </div>

        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Anotações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
