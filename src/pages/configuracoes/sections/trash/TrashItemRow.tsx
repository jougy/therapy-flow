import { memo } from "react";
import { CheckSquare, Loader2, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTrashDate, type TrashItem } from "@/lib/trashUtils";
import { cn } from "@/lib/utils";

interface TrashItemRowProps {
  canManageTrash: boolean;
  isRestoring: boolean;
  isSelected: boolean;
  item: TrashItem;
  onRestore: (item: TrashItem) => void;
  onToggleSelect: (id: string) => void;
}

export const TrashItemRow = memo(({
  canManageTrash,
  isRestoring,
  isSelected,
  item,
  onRestore,
  onToggleSelect,
}: TrashItemRowProps) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3 text-xs transition-colors hover:bg-muted/30",
        isSelected && "bg-primary/5 hover:bg-primary/10"
      )}
    >
      {/* Checkbox e Título */}
      <div className="flex items-center gap-3 min-w-0 pr-4">
        <button
          type="button"
          onClick={() => onToggleSelect(item.id)}
          aria-label={isSelected ? `Desmarcar ${item.title}` : `Selecionar ${item.title}`}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          {isSelected ? (
            <CheckSquare className="h-4 w-4 text-primary" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
        <div className="min-w-0">
          <p className="font-semibold text-foreground truncate">{item.title}</p>
          {item.subtitle && (
            <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
          )}
        </div>
      </div>

      {/* Metadados e Botão Restaurar */}
      <div className="flex items-center gap-6 shrink-0">
        <span className="hidden md:inline text-muted-foreground">
          {formatTrashDate(item.deleted_at)}
        </span>
        <span className="hidden sm:inline text-muted-foreground max-w-[120px] truncate">
          {item.deleted_by_name}
        </span>
        <div className="w-20 text-right">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRestore(item)}
            disabled={isRestoring || !canManageTrash}
            title="Restaurar este item"
            className="h-8 px-2.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            {isRestoring ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                <span>Restaurar</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});

TrashItemRow.displayName = "TrashItemRow";
