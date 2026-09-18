import { useMemo } from "react";
import { CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrashItemRow } from "./TrashItemRow";
import type { TrashItem } from "@/lib/trashUtils";

interface TrashTableProps {
  canManageTrash: boolean;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  items: TrashItem[];
  onRestoreSingle: (item: TrashItem) => void;
  onToggleSelectAll: () => void;
  onToggleSelectOne: (id: string) => void;
  restoringIds?: string[];
  selectedIds?: string[];
  selectedSet?: Set<string>;
  restoringSet?: Set<string>;
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
}

export const TrashTable = ({
  canManageTrash,
  isAllSelected,
  isSomeSelected,
  items,
  onRestoreSingle,
  onToggleSelectAll,
  onToggleSelectOne,
  restoringIds = [],
  selectedIds = [],
  selectedSet: externalSelectedSet,
  restoringSet: externalRestoringSet,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}: TrashTableProps) => {
  // Garante busca O(1) por item mesmo se o chamador passar apenas arrays
  const activeSelectedSet = useMemo(
    () => externalSelectedSet ?? new Set(selectedIds),
    [externalSelectedSet, selectedIds]
  );
  const activeRestoringSet = useMemo(
    () => externalRestoringSet ?? new Set(restoringIds),
    [externalRestoringSet, restoringIds]
  );

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Cabeçalho da Lista com Selecionar Todos */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b text-xs font-semibold text-muted-foreground">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSelectAll}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            aria-label={isAllSelected ? "Desmarcar todos" : "Selecionar todos"}
          >
            {isAllSelected ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : isSomeSelected ? (
              <div className="h-4 w-4 rounded border bg-primary/20 border-primary" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
          <span>Item / Descrição</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="hidden md:inline">Excluído em</span>
          <span className="hidden sm:inline">Excluído por</span>
          <span className="w-20 text-right">Ação</span>
        </div>
      </div>

      {/* Linhas de Itens */}
      <div className="divide-y">
        {items.map((item) => (
          <TrashItemRow
            key={item.id}
            item={item}
            isSelected={activeSelectedSet.has(item.id)}
            isRestoring={activeRestoringSet.has(item.id)}
            canManageTrash={canManageTrash}
            onToggleSelect={onToggleSelectOne}
            onRestore={onRestoreSingle}
          />
        ))}
      </div>

      {/* Rodapé de Paginação */}
      {totalPages && totalPages > 1 && onPageChange && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-muted/20 border-t text-xs text-muted-foreground">
          <div>
            {typeof totalCount === "number" && typeof currentPage === "number" && typeof pageSize === "number" ? (
              <span>
                Mostrando{" "}
                <span className="font-medium text-foreground">
                  {(currentPage - 1) * pageSize + 1}
                </span>{" "}
                a{" "}
                <span className="font-medium text-foreground">
                  {Math.min(currentPage * pageSize, totalCount)}
                </span>{" "}
                de{" "}
                <span className="font-medium text-foreground">{totalCount}</span> itens
              </span>
            ) : (
              <span>
                Página {currentPage || 1} de {totalPages}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(Math.max(1, (currentPage || 1) - 1))}
              disabled={(currentPage || 1) <= 1}
              className="h-7 px-2.5 text-xs"
            >
              Anterior
            </Button>
            <span className="px-2 font-medium text-foreground">
              {currentPage || 1} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(Math.min(totalPages, (currentPage || 1) + 1))}
              disabled={(currentPage || 1) >= totalPages}
              className="h-7 px-2.5 text-xs"
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
