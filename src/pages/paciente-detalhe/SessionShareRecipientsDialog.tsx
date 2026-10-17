import React from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { getShareRecipientLabel, type SessionShareSummary } from "@/lib/session-sharing";
import type { Session } from "./pacienteDetalheTypes";

export interface SessionShareRecipientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session | null | undefined;
  shareRecipientsSummary: SessionShareSummary | null | undefined;
}

export const SessionShareRecipientsDialog: React.FC<SessionShareRecipientsDialogProps> = ({
  open,
  onOpenChange,
  session,
  shareRecipientsSummary,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Acesso compartilhado
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {session
              ? `Atendimento de ${new Date(session.session_date).toLocaleDateString("pt-BR")}`
              : "Atendimento selecionado"}
          </p>
          {(shareRecipientsSummary?.recipients ?? []).length > 0 ? (
            <div className="divide-y rounded-lg border">
              {shareRecipientsSummary?.recipients.map((recipient) => (
                <div key={recipient.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{getShareRecipientLabel(recipient)}</p>
                    <p className="truncate text-xs text-muted-foreground">{recipient.email || "Sem email"}</p>
                  </div>
                  {recipient.created_at ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(recipient.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
              Nenhum colaborador com acesso compartilhado.
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
