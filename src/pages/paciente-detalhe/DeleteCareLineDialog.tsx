import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

export interface DeleteCareLineDialogProps {
  deleteConfirmId: string | null;
  onClose: () => void;
  onConfirmDelete: (id: string) => void;
}

export function DeleteCareLineDialog({
  deleteConfirmId,
  onClose,
  onConfirmDelete,
}: DeleteCareLineDialogProps) {
  return (
    <Dialog open={Boolean(deleteConfirmId)} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir Linha de Cuidado?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Os atendimentos desta linha de cuidado serão mantidos como atendimentos gerais.
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" onClick={() => deleteConfirmId && onConfirmDelete(deleteConfirmId)}>
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
