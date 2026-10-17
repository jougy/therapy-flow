import React from "react";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DesignLabAnamnesisField } from "../types";

export interface CanvasFieldQuickActionsProps {
  field: DesignLabAnamnesisField;
  canvasMode: "edit" | "test";
  duplicateField: (field: DesignLabAnamnesisField) => void;
  removeField: (fieldId: string) => void;
  setDraggedFieldId: (fieldId: string | null) => void;
}

export const CanvasFieldQuickActions: React.FC<CanvasFieldQuickActionsProps> = ({
  field,
  canvasMode,
  duplicateField,
  removeField,
  setDraggedFieldId,
}) => {
  if (canvasMode !== "edit") return null;

  return (
    <div className="flex items-center gap-1 rounded-md border bg-background/95 p-0.5 shadow-xs opacity-0 group-hover:opacity-100 transition-opacity">
      <div
        draggable={true}
        onDragStart={(e) => {
          e.stopPropagation();
          setDraggedFieldId(field.id);
          e.dataTransfer.setData("text/plain", field.id);
        }}
        className="flex h-6 w-6 items-center justify-center rounded-xs text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing"
        title="Arraste para mover"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        title="Duplicar campo"
        onClick={(e) => {
          e.stopPropagation();
          duplicateField(field);
        }}
      >
        <Copy className="h-3 w-3" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
        title="Excluir campo"
        onClick={(e) => {
          e.stopPropagation();
          removeField(field.id);
        }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
};
