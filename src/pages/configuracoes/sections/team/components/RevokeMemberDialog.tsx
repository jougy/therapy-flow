import React from "react";
import { AlertTriangle, Loader2, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActiveMember } from "../types";

export interface RevokeMemberDialogProps {
  revokingMember: ActiveMember | null;
  onClose: () => void;
  isRevoking: boolean;
  onConfirmRevoke: () => Promise<void>;
}

export const RevokeMemberDialog: React.FC<RevokeMemberDialogProps> = ({
  revokingMember,
  onClose,
  isRevoking,
  onConfirmRevoke,
}) => {
  return (
    <Dialog open={revokingMember !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>Revogar Acesso à Clínica</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-foreground">
            Tem certeza que deseja revogar o acesso de <strong>{revokingMember?.full_name}</strong> (
            {revokingMember?.email}) à clínica?
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
            onClick={() => void onConfirmRevoke()}
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

