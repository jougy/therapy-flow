import React, { type ReactNode } from "react";
import { Check, GripVertical, Hexagon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toRgbaString } from "@/lib/group-colors";
import {
  getFieldAccentAlpha,
  getFieldAccentColor,
  getSoftAccentBackground,
  type DesignLabAnamnesisField,
  type DesignLabTemplateLayoutItem,
} from "../types";
import { StatusPolygonRadar } from "@/components/anamnesis/StatusPolygonRadar";
import { CanvasFieldQuickActions } from "./CanvasFieldQuickActions";

export interface CanvasRadarSectionItemProps {
  item: DesignLabTemplateLayoutItem;
  selectedFieldIds: string[];
  isMultiSelecting: boolean;
  dragOverFieldId: string | null;
  dragOverPosition: "before" | "inside" | "after" | null;
  draggedFieldId: string | null;
  canvasMode: "edit" | "test";
  testAnswers: Record<string, unknown>;
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

export const CanvasRadarSectionItem: React.FC<CanvasRadarSectionItemProps> = ({
  item,
  selectedFieldIds,
  isMultiSelecting,
  dragOverFieldId,
  dragOverPosition,
  draggedFieldId,
  canvasMode,
  testAnswers,
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
  const isContainerDragOver = isDragOver && dragOverPosition === "inside";

  const radarItems = item.items.map((child) => {
    const raw = testAnswers[child.field.id];
    const val =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && !isNaN(Number(raw)) && raw.trim() !== ""
          ? Number(raw)
          : child.field.min ?? 5;
    return {
      id: child.field.id,
      label: child.field.label,
      max: child.field.max ?? 10,
      min: child.field.min ?? 0,
      value: val,
    };
  });

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

          let pos: "before" | "inside" | "after" = "inside";
          if (relativeY < 30) pos = "before";
          else if (relativeY > rect.height - 30) pos = "after";

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
        className={cn(
          "group relative overflow-hidden rounded-xl border transition-all cursor-pointer",
          isSelected
            ? "ring-2 ring-primary ring-offset-2 shadow-md"
            : "border-border/80 hover:border-primary/50 shadow-xs",
          isContainerDragOver ? "ring-2 ring-primary bg-primary/[0.04]" : "",
          isDraggingThis ? "opacity-40" : "",
          !isVisibleInTest && canvasMode === "edit" ? "opacity-60" : ""
        )}
        style={{
          background: getSoftAccentBackground(accentColor, accentAlpha),
          borderColor: toRgbaString(accentColor, Math.max(accentAlpha * 0.65, 30)),
        }}
        onClick={(e) => {
          e.stopPropagation();
          selectFieldAndOpenMobileInspector(item.field.id, e);
        }}
        onTouchStart={() => handleCardTouchStart(item.field.id)}
        onTouchEnd={handleCardTouchEnd}
        onTouchCancel={handleCardTouchEnd}
      >
        <CardContent className="p-0">
          {/* Header bar */}
          <div
            className="flex flex-col gap-2 p-4 border-b border-border/40"
            style={{
              backgroundColor: toRgbaString(accentColor, Math.max(accentAlpha * 0.45, 12)),
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {canvasMode === "edit" && (
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground opacity-50 group-hover:opacity-100" />
                )}
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
                <Hexagon className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{item.field.label}</p>
                  {item.field.helpText && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.field.helpText}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[10px] font-medium border-primary/40 text-primary">
                  Polígono ({item.items.length} {item.items.length === 1 ? "vértice" : "vértices"})
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
          </div>

          {/* Body with radar + sliders */}
          <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-5 flex flex-col items-center justify-center bg-background/50 rounded-lg p-3 border border-border/40 min-h-[260px]">
              <StatusPolygonRadar
                items={radarItems}
                accentColor={accentColor}
                height={240}
                title="Prévia do Polígono de Status"
              />
            </div>
            <div className="lg:col-span-7 space-y-4 min-w-0">
              {item.items.length === 0 ? (
                <div className="py-8 px-4 text-center text-xs text-muted-foreground border-2 border-dashed border-primary/20 rounded-lg bg-background/50">
                  <p className="font-medium text-foreground">Nenhum atributo adicionado</p>
                  <p className="mt-1">
                    Arraste Slidebars ou campos numéricos para cá para formar os vértices do polígono.
                  </p>
                </div>
              ) : (
                renderChildren(item.items)
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
