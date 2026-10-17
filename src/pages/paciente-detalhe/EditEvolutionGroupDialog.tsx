import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface EditEvolutionGroupDialogProps {
  editingEvolutionGroup: { id: string; name: string } | null;
  savingEvolutionGroupName: boolean;
  onClose: () => void;
  onChangeName: (name: string) => void;
  onSave: () => void;
}

export function EditEvolutionGroupDialog({
  editingEvolutionGroup,
  savingEvolutionGroupName,
  onClose,
  onChangeName,
  onSave,
}: EditEvolutionGroupDialogProps) {
  return (
    <Dialog open={Boolean(editingEvolutionGroup)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nome do Ciclo de Evolução</DialogTitle>
          <DialogDescription>
            Defina um nome personalizado para este ciclo de atendimento e evolução contínua.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="evolution-group-name">Nome do ciclo</Label>
            <Input
              id="evolution-group-name"
              value={editingEvolutionGroup?.name || ""}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder="Ex: Pós-operatório Joelho Direito"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={savingEvolutionGroupName}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={savingEvolutionGroupName || !editingEvolutionGroup?.name.trim()}
          >
            {savingEvolutionGroupName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
