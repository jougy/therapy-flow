import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ErrorDetails } from "@/components/sessions";

export interface SessionErrorDialogProps {
  errorDetails: ErrorDetails | null;
  onClose: () => void;
}

export function SessionErrorDialog({ errorDetails, onClose }: SessionErrorDialogProps) {
  return (
    <Dialog open={Boolean(errorDetails)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{errorDetails?.title ?? "Detalhes do erro"}</DialogTitle>
          <DialogDescription>{errorDetails?.context}</DialogDescription>
        </DialogHeader>
        {errorDetails ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mensagem técnica</p>
              <p className="mt-2 break-words text-sm">{errorDetails.message}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Código</p>
                <p className="mt-1 break-words text-sm">{errorDetails.code ?? "Não informado"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sugestão do banco</p>
                <p className="mt-1 break-words text-sm">{errorDetails.hint ?? "Não informado"}</p>
              </div>
            </div>
            {errorDetails.details ? (
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalhes</p>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">
                  {errorDetails.details}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
