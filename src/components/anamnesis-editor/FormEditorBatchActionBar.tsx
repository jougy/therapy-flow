import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckSquare, Columns, Copy, Folder, Hexagon, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FormEditorBatchActionBarProps {
  isMultiSelecting: boolean;
  selectedFieldIds: string[];
  isAllSelected: boolean;
  handleToggleSelectAll: () => void;
  encapsulateSelectedFields: (type: "section" | "horizontal_section" | "radar_section") => void;
  duplicateSelectedFields: () => void;
  deleteSelectedFields: () => void;
  setSelectedFieldIds: (ids: string[]) => void;
}

export const FormEditorBatchActionBar: React.FC<FormEditorBatchActionBarProps> = ({
  isMultiSelecting,
  selectedFieldIds,
  isAllSelected,
  handleToggleSelectAll,
  encapsulateSelectedFields,
  duplicateSelectedFields,
  deleteSelectedFields,
  setSelectedFieldIds,
}) => {
  return (
    <AnimatePresence>
      {isMultiSelecting && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="designlab-batch-actions-bar fixed bottom-20 lg:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 sm:gap-2 rounded-full border bg-background/95 px-3 sm:px-4 py-2 shadow-2xl backdrop-blur-md border-primary/40"
        >
          <div className="flex items-center gap-1.5 pr-2 border-r border-border text-xs font-medium text-foreground">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
              {selectedFieldIds.length}
            </span>
            <span className="hidden sm:inline">selecionados</span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary rounded-full px-2.5 sm:px-3"
            onClick={handleToggleSelectAll}
            title={isAllSelected ? "Desmarcar todos os campos" : "Selecionar todos os campos (Ctrl+A / Cmd+A)"}
          >
            <CheckSquare className="h-3.5 w-3.5 text-primary" />
            <span className="hidden md:inline">{isAllSelected ? "Desmarcar Todos" : "Selecionar Todos"}</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary rounded-full px-2.5 sm:px-3"
            onClick={() => encapsulateSelectedFields("section")}
            title="Encapsular em Seção Sanfona"
          >
            <Folder className="h-3.5 w-3.5 text-primary" />
            <span className="hidden md:inline">Seção Sanfona</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary rounded-full px-2.5 sm:px-3"
            onClick={() => encapsulateSelectedFields("horizontal_section")}
            title="Encapsular em Seção Horizontal"
          >
            <Columns className="h-3.5 w-3.5 text-primary" />
            <span className="hidden md:inline">Seção Horizontal</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary rounded-full px-2.5 sm:px-3"
            onClick={() => encapsulateSelectedFields("radar_section")}
            title="Encapsular em Polígono de Status"
          >
            <Hexagon className="h-3.5 w-3.5 text-primary" />
            <span className="hidden md:inline">Polígono</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary rounded-full px-2.5 sm:px-3"
            onClick={duplicateSelectedFields}
            title="Duplicar selecionados"
          >
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Duplicar</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive rounded-full px-2.5 sm:px-3"
            onClick={deleteSelectedFields}
            title="Excluir selecionados"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Excluir</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-full ml-1"
            title="Limpar seleção"
            onClick={() => setSelectedFieldIds([])}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
