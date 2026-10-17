import React, { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Check, Columns } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toRgbaString } from "@/lib/group-colors";
import {
  estimateFieldPreferredWidth,
  estimateHorizontalSectionRowHeight,
  estimateLayoutWeight,
  getFieldAccentAlpha,
  getFieldAccentColor,
  getFieldMaxWidth,
  getFieldTypeLabel,
  getSoftAccentBackground,
  type DesignLabAnamnesisField,
  type DesignLabTemplateLayoutItem,
} from "../types";
import { HorizontalScrollNavigator } from "../HorizontalScrollNavigator";
import { HorizontalStepperNavigator, safeStepIndex } from "../HorizontalStepperNavigator";
import { FormEditorLivePreview } from "../FormEditorLivePreview";
import { hasMeaningfulFormValue, type AnamnesisField } from "@/lib/anamnesis-forms";
import { CanvasFieldQuickActions } from "./CanvasFieldQuickActions";

export interface CanvasHorizontalSectionItemProps {
  item: DesignLabTemplateLayoutItem;
  selectedFieldIds: string[];
  isMultiSelecting: boolean;
  dragOverFieldId: string | null;
  dragOverPosition: "before" | "inside" | "after" | null;
  draggedFieldId: string | null;
  canvasMode: "edit" | "test";
  testAnswers: Record<string, unknown>;
  horizontalScrollState: Record<string, { clientWidth: number; scrollLeft: number; scrollWidth: number }>;
  canvasActiveSteps: Record<string, number>;
  setCanvasActiveSteps: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  isFieldConditionallyVisible: (field: AnamnesisField) => boolean;
  setEditorCardRef: (fieldId: string, node: HTMLDivElement | null) => void;
  setHorizontalScrollRef: (fieldId: string, node: HTMLDivElement | null) => void;
  scheduleHorizontalScrollSync: () => void;
  scrollHorizontalSectionToSibling: (key: string, direction: "left" | "right") => void;
  beginHorizontalDrag: (key: string, event: ReactPointerEvent<HTMLDivElement>) => void;
  updateHorizontalDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  endHorizontalDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
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
  renderChildItem: (child: DesignLabTemplateLayoutItem) => ReactNode;
}

export const CanvasHorizontalSectionItem: React.FC<CanvasHorizontalSectionItemProps> = ({
  item,
  selectedFieldIds,
  isMultiSelecting,
  dragOverFieldId,
  dragOverPosition,
  draggedFieldId,
  canvasMode,
  testAnswers,
  horizontalScrollState,
  canvasActiveSteps,
  setCanvasActiveSteps,
  isFieldConditionallyVisible,
  setEditorCardRef,
  setHorizontalScrollRef,
  scheduleHorizontalScrollSync,
  scrollHorizontalSectionToSibling,
  beginHorizontalDrag,
  updateHorizontalDrag,
  endHorizontalDrag,
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
  renderChildItem,
}) => {
  const scrollContainerId = item.field.id;
  const accentColor = getFieldAccentColor(item.field);
  const accentAlpha = getFieldAccentAlpha(item.field);
  const isSelected = selectedFieldIds.includes(item.field.id);
  const isDragOver = dragOverFieldId === item.field.id;
  const isDraggingThis = draggedFieldId === item.field.id;
  const isContainerDragOver = isDragOver && dragOverPosition === "inside";
  const isVisibleInTest = isFieldConditionallyVisible(item.field);
  const horizontalRowMinHeight = estimateHorizontalSectionRowHeight(item.items);
  const horizontalScrollSnapshot = horizontalScrollState[scrollContainerId];
  const totalWidth = Math.max(
    1,
    item.items.reduce((sum, sibling) => sum + estimateFieldPreferredWidth(sibling.field), 0)
  );

  const horizontalMarkerStyles = item.items.map((child, index, array) => {
    const left = array
      .slice(0, index)
      .reduce((sum, sibling) => sum + estimateFieldPreferredWidth(sibling.field), 0);
    const width = estimateFieldPreferredWidth(child.field);
    const isVisible =
      horizontalScrollSnapshot &&
      left + width > horizontalScrollSnapshot.scrollLeft &&
      left < horizontalScrollSnapshot.scrollLeft + horizontalScrollSnapshot.clientWidth;

    return {
      backgroundColor: toRgbaString(getFieldAccentColor(child.field), getFieldAccentAlpha(child.field)),
      left: `${(left / totalWidth) * 100}%`,
      opacity: isVisible ? 1 : 0.6,
      width: `${(width / totalWidth) * 100}%`,
    } satisfies CSSProperties;
  });

  const isStepperMode =
    item.field.horizontalDisplayMode === "stepper_always" ||
    item.field.horizontalDisplayMode === "stepper_mobile";
  const visibleStepperItems =
    canvasMode === "test"
      ? item.items.filter((child) => isFieldConditionallyVisible(child.field))
      : item.items;
  const totalStepperSteps = visibleStepperItems.length;
  const rawStepperStep = canvasActiveSteps[item.field.id] ?? 0;
  const selectedStepperIndex = visibleStepperItems.findIndex((c) =>
    selectedFieldIds.includes(c.field.id)
  );
  const currentStepperStep =
    selectedStepperIndex >= 0
      ? selectedStepperIndex
      : safeStepIndex(rawStepperStep, totalStepperSteps);
  const completedStepperSteps = visibleStepperItems.filter((c) =>
    hasMeaningfulFormValue(testAnswers[c.field.id])
  ).length;
  const activeStepperChild = visibleStepperItems[currentStepperStep];

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
        className={`group overflow-hidden border-dashed transition-all ${
          isSelected ? "ring-2 ring-primary ring-offset-2 shadow-sm" : ""
        } ${isContainerDragOver ? "ring-2 ring-primary bg-primary/[0.04]" : ""} ${
          isDraggingThis ? "opacity-40" : ""
        } ${!isVisibleInTest && canvasMode === "edit" ? "opacity-60" : ""}`}
        style={{ borderColor: toRgbaString(accentColor, Math.max(accentAlpha * 0.65, 22)) }}
      >
        <CardContent className="space-y-4 p-0">
          <div
            className="relative cursor-pointer border-b px-4 py-3 transition-colors hover:bg-primary/5"
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
            <div className="flex items-center justify-between gap-2">
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
                <Columns className="h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium">{item.field.label}</p>
                  {item.field.helpText && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.field.helpText}</p>
                  )}
                </div>
              </div>
              <CanvasFieldQuickActions
                field={item.field}
                canvasMode={canvasMode}
                duplicateField={duplicateField}
                removeField={removeField}
                setDraggedFieldId={setDraggedFieldId}
              />
            </div>
          </div>
          {isStepperMode ? (
            item.items.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg bg-background/50 m-2">
                Arraste ou clique em componentes para adicionar a estas etapas horizontais
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <HorizontalStepperNavigator
                  currentStep={currentStepperStep}
                  totalSteps={totalStepperSteps}
                  completedSteps={completedStepperSteps}
                  onPrev={() =>
                    setCanvasActiveSteps((prev) => {
                      const nextIdx = safeStepIndex(currentStepperStep - 1, totalStepperSteps);
                      if (canvasMode === "edit" && visibleStepperItems[nextIdx]) {
                        selectFieldAndOpenMobileInspector(visibleStepperItems[nextIdx].field.id);
                      }
                      return { ...prev, [item.field.id]: nextIdx };
                    })
                  }
                  onNext={() =>
                    setCanvasActiveSteps((prev) => {
                      const nextIdx = safeStepIndex(currentStepperStep + 1, totalStepperSteps);
                      if (canvasMode === "edit" && visibleStepperItems[nextIdx]) {
                        selectFieldAndOpenMobileInspector(visibleStepperItems[nextIdx].field.id);
                      }
                      return { ...prev, [item.field.id]: nextIdx };
                    })
                  }
                />

                {activeStepperChild && (() => {
                  const child = activeStepperChild;
                  const isChildSelected = selectedFieldIds.includes(child.field.id);
                  const isChildVisible = isFieldConditionallyVisible(child.field);
                  const isChildDragOver = dragOverFieldId === child.field.id;
                  const isChildDragging = draggedFieldId === child.field.id;
                  const span = child.field.columnSpan;

                  return (
                    <div key={child.field.id} className="relative min-w-0 w-full">
                      {isChildDragOver && dragOverPosition === "before" && (
                        <div className="absolute -left-2 top-0 bottom-0 z-30 flex flex-col items-center pointer-events-none">
                          <div className="h-2 w-2 rounded-full bg-primary ring-2 ring-background shadow-md -mt-1" />
                          <div className="w-1 flex-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
                          <div className="h-2 w-2 rounded-full bg-primary ring-2 ring-background shadow-md -mb-1" />
                        </div>
                      )}
                      {isChildDragOver && dragOverPosition === "after" && (
                        <div className="absolute -right-2 top-0 bottom-0 z-30 flex flex-col items-center pointer-events-none">
                          <div className="h-2 w-2 rounded-full bg-primary ring-2 ring-background shadow-md -mt-1" />
                          <div className="w-1 flex-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
                          <div className="h-2 w-2 rounded-full bg-primary ring-2 ring-background shadow-md -mb-1" />
                        </div>
                      )}

                      <div
                        ref={(node) => setEditorCardRef(child.field.id, node)}
                        draggable={canvasMode === "edit"}
                        onDragStart={(e) => {
                          if (canvasMode !== "edit") return;
                          e.stopPropagation();
                          setDraggedFieldId(child.field.id);
                          e.dataTransfer.setData("text/plain", child.field.id);
                        }}
                        onDragOver={(e) => {
                          if (canvasMode !== "edit") return;
                          e.preventDefault();
                          e.stopPropagation();
                          if (draggedFieldId === child.field.id) return;

                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const relativeX = e.clientX - rect.left;
                          const pos: "before" | "after" = relativeX < rect.width * 0.5 ? "before" : "after";

                          if (dragOverFieldId !== child.field.id || dragOverPosition !== pos) {
                            setDragOverFieldId(child.field.id);
                            setDragOverPosition(pos);
                          }
                        }}
                        onDragLeave={(e) => {
                          if (canvasMode !== "edit") return;
                          e.stopPropagation();
                          if (dragOverFieldId === child.field.id) {
                            setDragOverFieldId(null);
                            setDragOverPosition(null);
                          }
                        }}
                        onDrop={(e) => handleDropOnTarget(child.field.id, dragOverPosition ?? "after", e)}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectFieldAndOpenMobileInspector(child.field.id, e);
                        }}
                        onTouchStart={() => handleCardTouchStart(child.field.id)}
                        onTouchEnd={handleCardTouchEnd}
                        onTouchCancel={handleCardTouchEnd}
                        className={`group relative w-full cursor-pointer rounded-lg border p-4 transition-all ${
                          isChildSelected
                            ? "border-primary bg-primary/[0.05] ring-2 ring-primary ring-offset-1 shadow-sm"
                            : "border-border/60 hover:border-primary/50 hover:bg-muted/20"
                        } ${isChildDragging ? "opacity-40" : ""} ${
                          !isChildVisible && canvasMode === "edit" ? "opacity-60 border-dashed" : ""
                        }`}
                      >
                        <div className="flex h-full min-h-0 flex-col">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {(isMultiSelecting || isChildSelected) && (
                                <div
                                  className={cn(
                                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                                    isChildSelected
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-muted-foreground/40 bg-background"
                                  )}
                                >
                                  {isChildSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                                </div>
                              )}
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 font-normal text-muted-foreground"
                              >
                                {getFieldTypeLabel(child.field.type)}
                              </Badge>
                              {span && span !== "auto" && (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] px-1 py-0 text-muted-foreground"
                                >
                                  {span}
                                </Badge>
                              )}
                            </div>
                            <CanvasFieldQuickActions
                              field={child.field}
                              canvasMode={canvasMode}
                              duplicateField={duplicateField}
                              removeField={removeField}
                              setDraggedFieldId={setDraggedFieldId}
                            />
                          </div>
                          {child.type === "field" ? (
                            <FormEditorLivePreview
                              field={child.field}
                              testAnswers={testAnswers}
                              setFieldTestAnswer={setFieldTestAnswer}
                              onFieldFocus={(id) => selectFieldAndOpenMobileInspector(id)}
                              isEditorMode={canvasMode === "edit"}
                              onUpdateField={updateField}
                            />
                          ) : (
                            renderChildItem(child)
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )
          ) : (
            <>
              <div
                ref={(node) => setHorizontalScrollRef(scrollContainerId, node)}
                className={`w-full min-w-0 ${
                  canvasMode === "test" ? "" : "overflow-x-auto"
                } [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
                onScroll={scheduleHorizontalScrollSync}
              >
                {item.items.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg bg-background/50 m-2">
                    Arraste ou clique em componentes para adicionar a estas etapas horizontais
                  </div>
                ) : (
                  <div
                    className={`flex ${
                      canvasMode === "test" ? "flex-col sm:flex-row items-stretch" : "items-stretch"
                    } gap-4 pb-4`}
                  >
                    {item.items.map((child) => {
                      const preferredWidth = estimateFieldPreferredWidth(child.field);
                      const maxWidth = getFieldMaxWidth(child.field);
                      const isChildSelected = selectedFieldIds.includes(child.field.id);
                      const isChildVisible = isFieldConditionallyVisible(child.field);
                      const isChildDragOver = dragOverFieldId === child.field.id;
                      const isChildDragging = draggedFieldId === child.field.id;

                      if (canvasMode === "test" && !isChildVisible) return null;

                      const span = child.field.columnSpan;
                      let childFlex = `${estimateLayoutWeight(child.field)} 1 ${preferredWidth}px`;
                      let childMinWidth: string | number = Math.min(
                        preferredWidth,
                        maxWidth ?? preferredWidth
                      );
                      let childMaxWidth: string | number | undefined = maxWidth ?? undefined;

                      if (span === "1/4") {
                        childFlex = "0 0 calc(25% - 12px)";
                        childMinWidth = 160;
                      } else if (span === "1/3") {
                        childFlex = "0 0 calc(33.333% - 12px)";
                        childMinWidth = 180;
                      } else if (span === "1/2") {
                        childFlex = "0 0 calc(50% - 12px)";
                        childMinWidth = 220;
                      } else if (span === "2/3") {
                        childFlex = "0 0 calc(66.666% - 12px)";
                        childMinWidth = 260;
                      } else if (span === "full") {
                        childFlex = "0 0 100%";
                        childMinWidth = "100%";
                        childMaxWidth = "100%";
                      }

                      return (
                        <div
                          key={child.field.id}
                          className="relative min-w-0 flex items-stretch shrink-0"
                          style={{
                            flex: childFlex,
                            maxWidth: childMaxWidth,
                            minHeight: horizontalRowMinHeight,
                            minWidth: childMinWidth,
                          }}
                        >
                          {/* Horizontal Drop Line Indicators */}
                          {isChildDragOver && dragOverPosition === "before" && (
                            <div className="absolute -left-2 top-0 bottom-0 z-30 flex flex-col items-center pointer-events-none">
                              <div className="h-2 w-2 rounded-full bg-primary ring-2 ring-background shadow-md -mt-1" />
                              <div className="w-1 flex-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
                              <div className="h-2 w-2 rounded-full bg-primary ring-2 ring-background shadow-md -mb-1" />
                            </div>
                          )}
                          {isChildDragOver && dragOverPosition === "after" && (
                            <div className="absolute -right-2 top-0 bottom-0 z-30 flex flex-col items-center pointer-events-none">
                              <div className="h-2 w-2 rounded-full bg-primary ring-2 ring-background shadow-md -mt-1" />
                              <div className="w-1 flex-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
                              <div className="h-2 w-2 rounded-full bg-primary ring-2 ring-background shadow-md -mb-1" />
                            </div>
                          )}

                          <div
                            ref={(node) => setEditorCardRef(child.field.id, node)}
                            draggable={canvasMode === "edit"}
                            onDragStart={(e) => {
                              if (canvasMode !== "edit") return;
                              e.stopPropagation();
                              setDraggedFieldId(child.field.id);
                              e.dataTransfer.setData("text/plain", child.field.id);
                            }}
                            onDragOver={(e) => {
                              if (canvasMode !== "edit") return;
                              e.preventDefault();
                              e.stopPropagation();
                              if (draggedFieldId === child.field.id) return;

                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              const relativeX = e.clientX - rect.left;
                              const pos: "before" | "after" = relativeX < rect.width * 0.5 ? "before" : "after";

                              if (dragOverFieldId !== child.field.id || dragOverPosition !== pos) {
                                setDragOverFieldId(child.field.id);
                                setDragOverPosition(pos);
                              }
                            }}
                            onDragLeave={(e) => {
                              if (canvasMode !== "edit") return;
                              e.stopPropagation();
                              if (dragOverFieldId === child.field.id) {
                                setDragOverFieldId(null);
                                setDragOverPosition(null);
                              }
                            }}
                            onDrop={(e) => handleDropOnTarget(child.field.id, dragOverPosition ?? "after", e)}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectFieldAndOpenMobileInspector(child.field.id, e);
                            }}
                            onTouchStart={() => handleCardTouchStart(child.field.id)}
                            onTouchEnd={handleCardTouchEnd}
                            onTouchCancel={handleCardTouchEnd}
                            className={`group relative w-full flex-1 cursor-pointer rounded-lg border p-3 transition-all ${
                              isChildSelected
                                ? "border-primary bg-primary/[0.05] ring-2 ring-primary ring-offset-1 shadow-sm"
                                : "border-border/60 hover:border-primary/50 hover:bg-muted/20"
                            } ${isChildDragging ? "opacity-40" : ""} ${
                              !isChildVisible && canvasMode === "edit" ? "opacity-60 border-dashed" : ""
                            }`}
                          >
                            <div className="flex h-full min-h-0 flex-col">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {(isMultiSelecting || isChildSelected) && (
                                    <div
                                      className={cn(
                                        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                                        isChildSelected
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-muted-foreground/40 bg-background"
                                      )}
                                    >
                                      {isChildSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                                    </div>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 font-normal text-muted-foreground"
                                  >
                                    {getFieldTypeLabel(child.field.type)}
                                  </Badge>
                                  {span && span !== "auto" && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[9px] px-1 py-0 text-muted-foreground"
                                    >
                                      {span}
                                    </Badge>
                                  )}
                                </div>
                                <CanvasFieldQuickActions
                                  field={child.field}
                                  canvasMode={canvasMode}
                                  duplicateField={duplicateField}
                                  removeField={removeField}
                                  setDraggedFieldId={setDraggedFieldId}
                                />
                              </div>
                              {child.type === "field" ? (
                                <FormEditorLivePreview
                                  field={child.field}
                                  testAnswers={testAnswers}
                                  setFieldTestAnswer={setFieldTestAnswer}
                                  onFieldFocus={(id) => selectFieldAndOpenMobileInspector(id)}
                                  isEditorMode={canvasMode === "edit"}
                                  onUpdateField={updateField}
                                />
                              ) : (
                                renderChildItem(child)
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {item.items.length > 0 && (
                <div className="px-3 pb-3 hidden sm:block">
                  <HorizontalScrollNavigator
                    clientWidth={horizontalScrollSnapshot?.clientWidth ?? 0}
                    markerStyles={horizontalMarkerStyles}
                    onScrollLeft={() => scrollHorizontalSectionToSibling(scrollContainerId, "left")}
                    onScrollRight={() => scrollHorizontalSectionToSibling(scrollContainerId, "right")}
                    onTrackPointerDown={(event) => beginHorizontalDrag(scrollContainerId, event)}
                    onTrackPointerMove={updateHorizontalDrag}
                    onTrackPointerUp={endHorizontalDrag}
                    scrollLeft={horizontalScrollSnapshot?.scrollLeft ?? 0}
                    scrollWidth={horizontalScrollSnapshot?.scrollWidth ?? 0}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
