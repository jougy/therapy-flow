import React, { type ReactNode } from "react";
import { Check, ToggleLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

export interface CanvasSectionSelectorItemProps {
  item: DesignLabTemplateLayoutItem;
  selectedFieldIds: string[];
  isMultiSelecting: boolean;
  dragOverFieldId: string | null;
  dragOverPosition: "before" | "inside" | "after" | null;
  draggedFieldId: string | null;
  canvasMode: "edit" | "test";
  testAnswers: Record<string, unknown>;
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
  setFieldTestAnswer: (fieldId: string, value: unknown) => void;
  renderChildren: (items: DesignLabTemplateLayoutItem[]) => ReactNode;
}

export const CanvasSectionSelectorItem: React.FC<CanvasSectionSelectorItemProps> = ({
  item,
  selectedFieldIds,
  isMultiSelecting,
  dragOverFieldId,
  dragOverPosition,
  draggedFieldId,
  canvasMode,
  testAnswers,
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
  setFieldTestAnswer,
  renderChildren,
}) => {
  const accentColor = getFieldAccentColor(item.field);
  const accentAlpha = getFieldAccentAlpha(item.field);
  const isSelected = selectedFieldIds.includes(item.field.id);
  const isDragOver = dragOverFieldId === item.field.id;
  const isDraggingThis = draggedFieldId === item.field.id;
  const isContainerDragOver = isDragOver && dragOverPosition === "inside";

  const childSections = item.items.filter(
    (child) => child.type === "section" || child.type === "horizontal_section"
  );
  const currentSwitches = (testAnswers[item.field.id] as Record<string, boolean>) ?? {};

  const toggleSectionSwitch = (sectionId: string) => {
    selectFieldAndOpenMobileInspector(item.field.id);
    const next = { ...currentSwitches, [sectionId]: !currentSwitches[sectionId] };
    setFieldTestAnswer(item.field.id, next);
  };

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

      <Card
        ref={(node) => setEditorCardRef(item.field.id, node)}
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
        className={`group overflow-hidden border-2 transition-all ${
          isSelected ? "ring-2 ring-primary ring-offset-2 shadow-sm" : ""
        } ${isContainerDragOver ? "ring-2 ring-primary bg-primary/[0.04]" : ""} ${
          isDraggingThis ? "opacity-40" : ""
        }`}
        style={{ borderColor: toRgbaString(accentColor, Math.max(accentAlpha * 0.75, 30)) }}
      >
        <CardContent className="space-y-4 p-0">
          <div
            className="cursor-pointer border-b px-5 py-4 transition-colors hover:bg-primary/5"
            style={{
              background: getSoftAccentBackground(accentColor, accentAlpha),
              borderColor: toRgbaString(accentColor, Math.max(accentAlpha * 0.35, 16)),
            }}
            onClick={(e) => {
              e.stopPropagation();
              selectFieldAndOpenMobileInspector(item.field.id, e);
            }}
            onTouchStart={() => handleCardTouchStart(item.field.id)}
            onTouchEnd={handleCardTouchEnd}
            onTouchCancel={handleCardTouchEnd}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
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
                <ToggleLeft className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-sm">{item.field.label}</p>
                  {item.field.helpText && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.field.helpText}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-medium border-primary/40 text-primary">
                  Seletor Modular ({childSections.length}{" "}
                  {childSections.length === 1 ? "módulo" : "módulos"})
                </Badge>
                <CanvasFieldQuickActions
                  field={item.field}
                  canvasMode={canvasMode}
                  duplicateField={duplicateField}
                  removeField={removeField}
                  setDraggedFieldId={setDraggedFieldId}
                />
              </div>
            </div>

            {childSections.length === 0 ? (
              <div className="rounded-md border border-dashed border-primary/30 bg-background/60 p-3 text-center text-xs text-muted-foreground">
                Nenhuma seção modular adicionada ainda. Arraste uma{" "}
                <strong className="text-foreground">Seção</strong> para dentro deste Seletor para gerar um
                módulo com switch automático.
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {childSections.map((childSec) => {
                  const isChecked = currentSwitches[childSec.field.id] ?? true;
                  return (
                    <div
                      key={childSec.field.id}
                      className={cn(
                        "inline-flex items-center gap-2.5 rounded-lg border px-3 py-1.5 transition-all cursor-pointer",
                        isChecked
                          ? "border-primary/50 bg-background shadow-xs ring-1 ring-primary/20"
                          : "border-border/60 bg-background/50 opacity-60 hover:opacity-100"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSectionSwitch(childSec.field.id);
                      }}
                    >
                      <span className="text-xs font-semibold text-foreground select-none">
                        {childSec.field.label}
                      </span>
                      <Switch
                        checked={isChecked}
                        onCheckedChange={() => toggleSectionSwitch(childSec.field.id)}
                        className="scale-90"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-4 space-y-4">
            {item.items.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground border-2 border-dashed border-primary/20 rounded-lg bg-background/50 m-2">
                Arraste seções para dentro deste Seletor Modular
              </div>
            ) : (
              renderChildren(
                item.items.filter((child) => {
                  if (canvasMode === "edit") return true;
                  if (child.type === "section" || child.type === "horizontal_section") {
                    const isChecked = currentSwitches[child.field.id] ?? true;
                    return isChecked;
                  }
                  return true;
                })
              )
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
