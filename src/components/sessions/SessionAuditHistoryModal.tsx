import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SessionEditHistoryViewEntry } from "@/lib/session-people";

export interface SessionAuditHistoryModalProps {
  editHistoryView: SessionEditHistoryViewEntry[];
  historyDialogOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SessionAuditHistoryModal = ({
  editHistoryView,
  historyDialogOpen,
  onOpenChange,
}: SessionAuditHistoryModalProps) => {
  if (editHistoryView.length === 0) return null;

  return (
    <Dialog open={historyDialogOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="link" className="mt-1 h-auto px-0 text-xs text-muted-foreground">
          Ver edições ({editHistoryView.length})
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Histórico de edições</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {editHistoryView.map((entry) => (
            <div key={entry.id} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{entry.editorName}</p>
              <p className="mt-1 text-xs text-muted-foreground">{entry.editedAtLabel}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
