import React, { type ReactNode } from "react";
import { Check, Folder } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { toRgbaString } from "@/lib/group-colors";
import {
  getFieldAccentAlpha,
  getFieldAccentColor,
  getSoftAccentBackground,
  type DesignLabAnamnesisField,
  type DesignLabTemplateLayoutItem,
} from "../types";
import { CanvasFieldQuickActions } from "./CanvasFieldQuickActions";

export interface CanvasAccordionSectionItemProps {
  item: DesignLabTemplateLayoutItem;
  selectedFieldIds: string[];
  isMultiSelecting: boolean;
  dragOverFieldId: string | null;
  dragOverPosition: "before" | "inside" | "after" | null;
  draggedFieldId: string | null;
  canvasMode: "edit" | "test";
  isVisibleInTest: boolean;
  setEditorCardRef: (fieldId: string, node: HTMLDivElement | null) => void;
  setDraggedFieldId: (id: string | null) => void;
  setDragOverFieldId: (id: string | null) => void;
  setDragOverPosition: (pos: "before" | "inside" | "after" | null) => void;
  handleDropOnTarget: (targetId: string, position: "before" | "inside" | "after", event: React.DragEvent) => void;
  selectFieldAndOpenMobileInspector: (fieldId: string, event?: React.MouseEvent) => void;
  handleCardTouchStart: (fieldId: string) => void;
  handleCardTouchEnd: () => void;
  duplicateField: (field: DesignLabAnamnesisField) => void;
  removeField: (fieldId: string) => void;
  renderChildren: (items: DesignLabTemplateLayoutItem[]) => ReactNode;
}

export const CanvasAccordionSectionItem: React.FC<CanvasAccordionSectionItemProps> = ({
  item,
  selectedFieldIds,
  isMultiSelecting,
  dragOverFieldId,
  dragOverPosition,
  draggedFieldId,
  canvasMode,
  isVisibleInTest,
  setEditorCardRef,
  setDraggedFieldId,
  setDragOverFieldId,
  setDragOverPosition,
  handleDropOnTarget,
  selectFieldAndOpenMobileInspector,
  handleCardTouchStart,
  handleCardTouchEnd,
  duplicateField,
  removeField,
  renderChildren,
}) => {
  const accentColor = getFieldAccentColor(item.field);
  const accentAlpha = getFieldAccentAlpha(item.field);
  const isSelected = selectedFieldIds.includes(item.field.id);
  const isDragOver = dragOverFieldId === item.field.id;
  const isDraggingThis = draggedFieldId === item.field.id;
  const isSectionDragOver = isDragOver && dragOverPosition === "inside";

  return (
    <div key={item.field.id} className="relative">
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

      <Accordion
        type="multiple"
        defaultValue={[item.field.id]}
        ref={(node) => setEditorCardRef(item.field.id, node as unknown as HTMLDivElement | null)}
        draggable={canvasMode === "edit"}
        onDragStart={(e) => {
          if (canvasMode !== "edit") return;
          e.stopPropagation();
          setDraggedFieldId(item.field.id);
          e.dataTransfer.setData("text/plain", item.field.id);
        }}
        onDragOver={(e) => {
          if (canvasMode !== "edit") return;
          e.preventDefault();
          e.stopPropagation();
          if (draggedFieldId === item.field.id) return;

          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const relativeY = e.clientY - rect.top;

          let pos: "before" | "inside" | "after" = "after";
          if (relativeY < rect.height * 0.25) {
            pos = "before";
          } else if (relativeY >= rect.height * 0.25 && relativeY <= rect.height * 0.75) {
            pos = "inside";
          } else {
            pos = "after";
          }

          if (dragOverFieldId !== item.field.id || dragOverPosition !== pos) {
            setDragOverFieldId(item.field.id);
            setDragOverPosition(pos);
          }
        }}
        onDragLeave={(e) => {
          if (canvasMode !== "edit") return;
          e.stopPropagation();
          if (dragOverFieldId === item.field.id) {
            setDragOverFieldId(null);
            setDragOverPosition(null);
          }
        }}
        onDrop={(e) => handleDropOnTarget(item.field.id, dragOverPosition ?? "inside", e)}
        className={`group min-w-0 rounded-lg border px-4 transition-all relative ${
          isSelected ? "ring-2 ring-primary ring-offset-2 shadow-sm" : ""
        } ${isSectionDragOver ? "ring-2 ring-primary bg-primary/[0.04]" : ""} ${
          isDraggingThis ? "opacity-40" : ""
        } ${!isVisibleInTest && canvasMode === "edit" ? "opacity-60" : ""}`}
        style={{
          background: getSoftAccentBackground(accentColor, accentAlpha),
          borderColor: toRgbaString(accentColor, Math.max(accentAlpha * 0.65, 22)),
        }}
      >
        <AccordionItem value={item.field.id} className="border-none">
          <div className="relative">
            <AccordionTrigger
              className="py-3 hover:no-underline"
              onClick={(e) => {
                e.stopPropagation();
                selectFieldAndOpenMobileInspector(item.field.id, e);
              }}
              onTouchStart={() => handleCardTouchStart(item.field.id)}
              onTouchEnd={handleCardTouchEnd}
              onTouchCancel={handleCardTouchEnd}
            >
              <div className="flex flex-1 items-center justify-between gap-2 text-left pr-16">
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
                  <Folder className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">{item.field.label}</p>
                    {item.field.helpText && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.field.helpText}</p>
                    )}
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <div className="absolute right-8 top-3 z-20">
              <CanvasFieldQuickActions
                field={item.field}
                canvasMode={canvasMode}
                duplicateField={duplicateField}
                removeField={removeField}
                setDraggedFieldId={setDraggedFieldId}
              />
            </div>
          </div>
          <AccordionContent className="space-y-4 pt-2">
            {item.items.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg bg-background/50">
                Arraste componentes para dentro desta seção
              </div>
            ) : (
              renderChildren(item.items)
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
