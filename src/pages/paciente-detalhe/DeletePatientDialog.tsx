import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

export interface DeletePatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deletingPatient: boolean;
  onConfirmDelete: () => Promise<void> | void;
}

export function DeletePatientDialog({
  open,
  onOpenChange,
  deletingPatient,
  onConfirmDelete,
}: DeletePatientDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover paciente para a lixeira?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          O paciente e seus atendimentos serão movidos para a lixeira da clínica e podem ser restaurados até o próximo domingo às 23:59. Após essa data, o expurgo definitivo é executado automaticamente.
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={deletingPatient}>
              Cancelar
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={() => void onConfirmDelete()} disabled={deletingPatient}>
            {deletingPatient ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
