import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";

export interface SessionConductNotesProps {
  notes: string;
  locked: boolean;
  onNotesChange: (value: string) => void;
}

export function SessionConductNotes({ notes, locked, onNotesChange }: SessionConductNotesProps) {
  return (
    <div data-tutorial="session-conduct-notes">
      <div className="flex items-center justify-between mb-1.5">
        <Label htmlFor="notes" className="text-sm font-medium">
          Anotações rápidas e conduta
        </Label>
        <ComponentHelpButton helpId="session-conduct-notes" size="xs" />
      </div>
      <Textarea
        id="notes"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Observações gerais sobre o atendimento..."
        className="mt-1"
        rows={2}
        disabled={locked}
      />
    </div>
  );
}
