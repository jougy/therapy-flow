import React from "react";
import { AlertTriangle, Loader2, UserMinus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ActiveMember } from "../types";

export interface RevokeAccessModalProps {
  member: ActiveMember | null;
  onClose: () => void;
  isRevoking: boolean;
  onConfirm: () => Promise<void> | void;
}

export const RevokeAccessModal: React.FC<RevokeAccessModalProps> = ({
  member,
  onClose,
  isRevoking,
  onConfirm,
}) => {
  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>Revogar Acesso à Clínica</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-foreground">
            Tem certeza que deseja revogar o acesso de <strong>{member?.full_name}</strong> ({member?.email}) à clínica?
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive space-y-1 my-2">
          <p className="font-semibold">Atenção:</p>
          <p>
            O colaborador perderá imediatamente o acesso aos prontuários, atendimentos e agenda da clínica.
            Todas as sessões ativas serão desconectadas na hora.
          </p>
        </div>

        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
          <Button variant="outline" type="button" onClick={onClose} disabled={isRevoking}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            type="button"
            onClick={() => void onConfirm()}
            disabled={isRevoking}
          >
            {isRevoking ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <UserMinus className="h-4 w-4 mr-1.5" />
            )}
            Revogar Acesso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
