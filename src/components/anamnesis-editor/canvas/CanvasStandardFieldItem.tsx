import React, { type CSSProperties } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getFieldTypeLabel, type DesignLabAnamnesisField } from "../types";
import { FormEditorLivePreview } from "../FormEditorLivePreview";
import { CanvasFieldQuickActions } from "./CanvasFieldQuickActions";
import type { AnamnesisField } from "@/lib/anamnesis-forms";

export interface CanvasStandardFieldItemProps {
  field: DesignLabAnamnesisField;
  isSelected: boolean;
  isMultiSelecting: boolean;
  isDragOver: boolean;
  isDraggingThis: boolean;
  dragOverPosition: "before" | "inside" | "after" | null;
  draggedFieldId: string | null;
  dragOverFieldId: string | null;
  isVisibleInTest: boolean;
  canvasMode: "edit" | "test";
  testAnswers: Record<string, unknown>;
  setCardRef: (node: HTMLDivElement | null) => void;
  setDraggedFieldId: (id: string | null) => void;
  setDragOverFieldId: (id: string | null) => void;
  setDragOverPosition: (pos: "before" | "inside" | "after" | null) => void;
  handleDropOnTarget: (targetId: string, position: "before" | "inside" | "after", event: React.DragEvent) => void;
  selectFieldAndOpenMobileInspector: (fieldId: string, event?: React.MouseEvent) => void;
  handleCardTouchStart: (fieldId: string) => void;
  handleCardTouchEnd: () => void;
  duplicateField: (field: DesignLabAnamnesisField) => void;
  removeField: (fieldId: string) => void;
  setFieldTestAnswer: (fieldId: string, value: unknown) => void;
  updateField: (fieldId: string, changes: Partial<AnamnesisField>) => void;
}

export const CanvasStandardFieldItem: React.FC<CanvasStandardFieldItemProps> = ({
  field,
  isSelected,
  isMultiSelecting,
  isDragOver,
  isDraggingThis,
  dragOverPosition,
  draggedFieldId,
  dragOverFieldId,
  isVisibleInTest,
  canvasMode,
  testAnswers,
  setCardRef,
  setDraggedFieldId,
  setDragOverFieldId,
  setDragOverPosition,
  handleDropOnTarget,
  selectFieldAndOpenMobileInspector,
  handleCardTouchStart,
  handleCardTouchEnd,
  duplicateField,
  removeField,
  setFieldTestAnswer,
  updateField,
}) => {
  return (
    <div
      key={field.id}
      className="relative"
      style={
        {
          contentVisibility: isSelected ? "visible" : "auto",
          containIntrinsicSize: "0 100px",
        } as CSSProperties
      }
    >
      {/* Visual Drop Line Indicator (Top) */}
      {isDragOver && dragOverPosition === "before" && (
        <div className="absolute -top-2 left-0 right-0 z-30 flex items-center pointer-events-none">
          <div className="h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background shadow-md -ml-1" />
          <div className="h-1 flex-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
          <div className="h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background shadow-md -mr-1" />
        </div>
      )}

      {/* Visual Drop Line Indicator (Bottom) */}
      {isDragOver && dragOverPosition === "after" && (
        <div className="absolute -bottom-2 left-0 right-0 z-30 flex items-center pointer-events-none">
          <div className="h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background shadow-md -ml-1" />
          <div className="h-1 flex-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
          <div className="h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background shadow-md -mr-1" />
        </div>
      )}

      <div
        ref={setCardRef}
        draggable={canvasMode === "edit"}
        onDragStart={(e) => {
          if (canvasMode !== "edit") return;
          e.stopPropagation();
          setDraggedFieldId(field.id);
          e.dataTransfer.setData("text/plain", field.id);
        }}
        onDragOver={(e) => {
          if (canvasMode !== "edit") return;
          e.preventDefault();
          e.stopPropagation();
          if (draggedFieldId === field.id) return;

          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const relativeY = e.clientY - rect.top;
          const pos: "before" | "after" = relativeY < rect.height * 0.5 ? "before" : "after";

          if (dragOverFieldId !== field.id || dragOverPosition !== pos) {
            setDragOverFieldId(field.id);
            setDragOverPosition(pos);
          }
        }}
        onDragLeave={(e) => {
          if (canvasMode !== "edit") return;
          e.stopPropagation();
          if (dragOverFieldId === field.id) {
            setDragOverFieldId(null);
            setDragOverPosition(null);
          }
        }}
        onDrop={(e) => handleDropOnTarget(field.id, dragOverPosition ?? "after", e)}
        onClick={(e) => {
          e.stopPropagation();
          selectFieldAndOpenMobileInspector(field.id, e);
        }}
        onTouchStart={() => handleCardTouchStart(field.id)}
        onTouchEnd={handleCardTouchEnd}
        onTouchCancel={handleCardTouchEnd}
        className={`group relative cursor-pointer rounded-lg border p-4 transition-all ${
          isSelected
            ? "border-primary bg-primary/[0.05] ring-2 ring-primary ring-offset-2 shadow-sm"
            : "border-border/60 hover:border-primary/50 hover:bg-muted/20"
        } ${isDraggingThis ? "opacity-40" : ""} ${
          !isVisibleInTest && canvasMode === "edit" ? "opacity-60 border-dashed" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {(isMultiSelecting || isSelected) && (
              <div
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40 bg-background"
                )}
              >
                {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
            )}
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              {getFieldTypeLabel(field.type)}
            </Badge>
            {!isVisibleInTest && canvasMode === "edit" && (
              <Badge
                variant="secondary"
                className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40"
              >
                Condicional (Oculto no teste)
              </Badge>
            )}
          </div>
          <CanvasFieldQuickActions
            field={field}
            canvasMode={canvasMode}
            duplicateField={duplicateField}
            removeField={removeField}
            setDraggedFieldId={setDraggedFieldId}
          />
        </div>
        <div>
          <FormEditorLivePreview
            field={field}
            testAnswers={testAnswers}
            setFieldTestAnswer={setFieldTestAnswer}
            onFieldFocus={(id) => selectFieldAndOpenMobileInspector(id)}
            isEditorMode={canvasMode === "edit"}
            onUpdateField={updateField}
          />
        </div>
      </div>
    </div>
  );
};
