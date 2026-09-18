import { Trash2 } from "lucide-react";
import type { TrashEntityType } from "@/lib/trashUtils";

interface TrashEmptyStateProps {
  entityType: TrashEntityType;
}

export const TrashEmptyState = ({ entityType }: TrashEmptyStateProps) => {
  const entityLabel =
    entityType === "sessions"
      ? "atendimento"
      : entityType === "patients"
      ? "paciente"
      : "formulário";

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed text-center bg-muted/20">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
        <Trash2 className="h-6 w-6 opacity-40" />
      </div>
      <h4 className="text-sm font-semibold text-foreground">A lixeira está vazia</h4>
      <p className="text-xs text-muted-foreground max-w-sm mt-1">
        Nenhum {entityLabel} aguardando exclusão definitiva. Itens excluídos durante a semana aparecerão aqui.
      </p>
    </div>
  );
};
