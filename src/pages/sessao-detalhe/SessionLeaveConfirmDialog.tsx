import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface SessionLeaveConfirmDialogProps {
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAsDraftAndLeave: () => Promise<void> | void;
  onLeaveWithoutSaving: () => void;
  onContinueSession: () => void;
}

export function SessionLeaveConfirmDialog({
  open,
  saving,
  onOpenChange,
  onSaveAsDraftAndLeave,
  onLeaveWithoutSaving,
  onContinueSession,
}: SessionLeaveConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Atendimento em andamento</AlertDialogTitle>
          <AlertDialogDescription>
            Você possui alterações que ainda não foram salvas no prontuário. O que deseja fazer antes de sair?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            variant="default"
            className="w-full justify-center"
            onClick={onSaveAsDraftAndLeave}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sair e salvar como rascunho
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="w-full justify-center"
            onClick={onLeaveWithoutSaving}
            disabled={saving}
          >
            Sair sem salvar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center"
            onClick={onContinueSession}
            disabled={saving}
          >
            Continuar atendimento
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
