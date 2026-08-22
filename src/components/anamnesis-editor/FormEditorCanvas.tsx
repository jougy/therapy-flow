import React, { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  Check,
  Columns,
  Copy,
  Folder,
  GripVertical,
  HelpCircle,
  Plus,
  Sparkles,
  ToggleLeft,
  Trash2,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
} from "./types";
import { HorizontalScrollNavigator } from "./HorizontalScrollNavigator";
import { FormEditorLivePreview } from "./FormEditorLivePreview";
import type { useFormEditorState } from "./useFormEditorState";

export interface FormEditorCanvasProps {
  state: ReturnType<typeof useFormEditorState>;
}

export const FormEditorCanvas: React.FC<FormEditorCanvasProps> = ({ state }) => {
  const {
    templateFields,
    groupedLayout,
    canvasMode,
    selectedFieldIds,
    isMultiSelecting,
    dragOverFieldId,
    dragOverPosition,
    draggedFieldId,
    testAnswers,
    setFieldTestAnswer,
    isFieldConditionallyVisible,
    selectFieldAndOpenMobileInspector,
    handleCardTouchStart,
    handleCardTouchEnd,
    setDraggedFieldId,
    setDragOverFieldId,
    setDragOverPosition,
    handleDropOnTarget,
    duplicateField,
    removeField,
    handleAddField,
    assignFieldToSection,
    setGuideModalOpen,
    flowSidebarCollapsed,
  } = state;

  const editorCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const horizontalScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const horizontalScrollRaf = useRef<number | null>(null);
  const horizontalDragRef = useRef<{
    key: string | null;
    pointerId: number | null;
    trackLeft: number;
    trackWidth: number;
  } | null>(null);
  const [horizontalScrollState, setHorizontalScrollState] = useState<
    Record<string, { clientWidth: number; scrollLeft: number; scrollWidth: number }>
  >({});

  const syncHorizontalScrollState = useCallback(() => {
    const nextState: Record<string, { clientWidth: number; scrollLeft: number; scrollWidth: number }> = {};

    Object.entries(horizontalScrollRefs.current).forEach(([key, node]) => {
      if (!node) return;

      nextState[key] = {
        clientWidth: node.clientWidth,
        scrollLeft: node.scrollLeft,
        scrollWidth: node.scrollWidth,
      };
    });

    setHorizontalScrollState(nextState);
  }, []);

  const scheduleHorizontalScrollSync = useCallback(() => {
    if (horizontalScrollRaf.current !== null) {
      window.cancelAnimationFrame(horizontalScrollRaf.current);
    }

    horizontalScrollRaf.current = window.requestAnimationFrame(syncHorizontalScrollState);
  }, [syncHorizontalScrollState]);

  useEffect(() => {
    scheduleHorizontalScrollSync();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => scheduleHorizontalScrollSync()) : null;
    Object.values(horizontalScrollRefs.current).forEach((node) => {
      if (node) {
        resizeObserver?.observe(node);
      }
    });

    window.addEventListener("resize", scheduleHorizontalScrollSync);

    return () => {
      if (horizontalScrollRaf.current !== null) {
        window.cancelAnimationFrame(horizontalScrollRaf.current);
        horizontalScrollRaf.current = null;
      }

      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleHorizontalScrollSync);
    };
  }, [groupedLayout, scheduleHorizontalScrollSync]);

  const scrollHorizontalSectionToRatio = useCallback(
    (key: string, ratio: number, behavior: ScrollBehavior = "auto") => {
      const node = horizontalScrollRefs.current[key];
      if (!node) return;

      const maxScrollLeft = Math.max(node.scrollWidth - node.clientWidth, 1);
      node.scrollTo({ left: Math.max(0, Math.min(1, ratio)) * maxScrollLeft, behavior });
    },
    []
  );

  const scrollHorizontalSectionToSibling = useCallback((key: string, direction: "left" | "right") => {
    const node = horizontalScrollRefs.current[key];
    const content = node?.firstElementChild;
    if (!node || !content) return;

    const maxScrollLeft = Math.max(node.scrollWidth - node.clientWidth, 0);
    const currentLeft = node.scrollLeft;
    const itemStarts = Array.from(content.children)
      .map((child) => Math.max(0, Math.min(maxScrollLeft, (child as HTMLElement).offsetLeft)))
      .filter((start, index, starts) => starts.indexOf(start) === index)
      .sort((a, b) => a - b);

    if (itemStarts.length === 0) {
      node.scrollBy({
        left: direction === "right" ? node.clientWidth * 0.75 : -node.clientWidth * 0.75,
        behavior: "smooth",
      });
      return;
    }

    const edgeTolerance = 2;
    const target =
      direction === "right"
        ? itemStarts.find((start) => start > currentLeft + edgeTolerance) ?? maxScrollLeft
        : [...itemStarts].reverse().find((start) => start < currentLeft - edgeTolerance) ?? 0;

    node.scrollTo({ left: target, behavior: "smooth" });
  }, []);

  const beginHorizontalDrag = useCallback(
    (key: string, event: ReactPointerEvent<HTMLDivElement>) => {
      const node = horizontalScrollRefs.current[key];
      if (!node) return;

      const rect = event.currentTarget.getBoundingClientRect();
      horizontalDragRef.current = {
        key,
        pointerId: event.pointerId,
        trackLeft: rect.left,
        trackWidth: rect.width,
      };

      event.currentTarget.setPointerCapture(event.pointerId);
      scrollHorizontalSectionToRatio(key, (event.clientX - rect.left) / Math.max(rect.width, 1), "auto");
    },
    [scrollHorizontalSectionToRatio]
  );

  const updateHorizontalDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = horizontalDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId || !drag.key) return;

      scrollHorizontalSectionToRatio(
        drag.key,
        (event.clientX - drag.trackLeft) / Math.max(drag.trackWidth, 1),
        "auto"
      );
    },
    [scrollHorizontalSectionToRatio]
  );

  const endHorizontalDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = horizontalDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    horizontalDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const renderFieldQuickActions = (field: DesignLabAnamnesisField) => {
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

  const renderPreviewLayout = (layout: DesignLabTemplateLayoutItem[]): ReactNode => (
    <div className="space-y-4">
      {layout.map((item) => {
        const isVisibleInTest = isFieldConditionallyVisible(item.field);

        if (canvasMode === "test" && !isVisibleInTest) {
          return null;
        }

        const isDragOver = dragOverFieldId === item.field.id;
        const isDraggingThis = draggedFieldId === item.field.id;

        if (item.type === "field") {
          const isSelected = selectedFieldIds.includes(item.field.id);
          return (
            <div
              key={item.field.id}
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
                ref={(node) => {
                  editorCardRefs.current[item.field.id] = node;
                }}
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
                  const pos: "before" | "after" = relativeY < rect.height * 0.5 ? "before" : "after";

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
                onDrop={(e) => handleDropOnTarget(item.field.id, dragOverPosition ?? "after", e)}
                onClick={(e) => {
                  e.stopPropagation();
                  selectFieldAndOpenMobileInspector(item.field.id, e);
                }}
                onTouchStart={() => handleCardTouchStart(item.field.id)}
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
                      {getFieldTypeLabel(item.field.type)}
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
                  {renderFieldQuickActions(item.field)}
                </div>
                <div>
                  <FormEditorLivePreview
                    field={item.field}
                    testAnswers={testAnswers}
                    setFieldTestAnswer={setFieldTestAnswer}
                    onFieldFocus={(id) => selectFieldAndOpenMobileInspector(id)}
                  />
                </div>
              </div>
            </div>
          );
        }

        if (item.type === "horizontal_section") {
          const scrollContainerId = item.field.id;
          const accentColor = getFieldAccentColor(item.field);
          const accentAlpha = getFieldAccentAlpha(item.field);
          const isSelected = selectedFieldIds.includes(item.field.id);
          const isContainerDragOver = dragOverFieldId === item.field.id && dragOverPosition === "inside";
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
                ref={(node) => {
                  editorCardRefs.current[item.field.id] = node;
                }}
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
                      {renderFieldQuickActions(item.field)}
                    </div>
                  </div>
                  <div
                    ref={(node) => {
                      horizontalScrollRefs.current[scrollContainerId] = node;
                    }}
                    className={`w-full min-w-0 ${
                      canvasMode === "test" ? "" : "overflow-x-auto"
                    } [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
                    onScroll={scheduleHorizontalScrollSync}
                  >
                    {item.items.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg bg-background/50 m-2">
                        Arraste ou clique em componentes para adicionar a esta seção horizontal
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

                          return (
                            <div key={child.field.id} className="relative min-w-0 flex items-stretch">
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

                              {(() => {
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
                                    ref={(node) => {
                                      editorCardRefs.current[child.field.id] = node;
                                    }}
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
                                    className={`group relative flex-1 cursor-pointer rounded-lg border p-3 transition-all ${
                                      isChildSelected
                                        ? "border-primary bg-primary/[0.05] ring-2 ring-primary ring-offset-1 shadow-sm"
                                        : "border-border/60 hover:border-primary/50 hover:bg-muted/20"
                                    } ${isChildDragging ? "opacity-40" : ""} ${
                                      !isChildVisible && canvasMode === "edit" ? "opacity-60 border-dashed" : ""
                                    }`}
                                    style={{
                                      flex: childFlex,
                                      maxWidth: childMaxWidth,
                                      minHeight: horizontalRowMinHeight,
                                      minWidth: childMinWidth,
                                    }}
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
                                        {renderFieldQuickActions(child.field)}
                                      </div>
                                      {child.type === "field" ? (
                                        <FormEditorLivePreview
                                          field={child.field}
                                          testAnswers={testAnswers}
                                          setFieldTestAnswer={setFieldTestAnswer}
                                          onFieldFocus={(id) => selectFieldAndOpenMobileInspector(id)}
                                        />
                                      ) : (
                                        renderPreviewLayout([child])
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
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
                </CardContent>
              </Card>
            </div>
          );
        }

        if (item.type === "section_selector") {
          const accentColor = getFieldAccentColor(item.field);
          const accentAlpha = getFieldAccentAlpha(item.field);
          const isSelected = selectedFieldIds.includes(item.field.id);
          const isContainerDragOver = dragOverFieldId === item.field.id && dragOverPosition === "inside";

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
                ref={(node) => {
                  editorCardRefs.current[item.field.id] = node;
                }}
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
                        {renderFieldQuickActions(item.field)}
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
                      renderPreviewLayout(
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
        }

        const accentColor = getFieldAccentColor(item.field);
        const accentAlpha = getFieldAccentAlpha(item.field);
        const isSelected = selectedFieldIds.includes(item.field.id);
        const isSectionDragOver = dragOverFieldId === item.field.id && dragOverPosition === "inside";

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
              ref={(node) => {
                editorCardRefs.current[item.field.id] = node as unknown as HTMLDivElement | null;
              }}
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
                  <div className="absolute right-8 top-3 z-20">{renderFieldQuickActions(item.field)}</div>
                </div>
                <AccordionContent className="space-y-4 pt-2">
                  {item.items.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg bg-background/50">
                      Arraste componentes para dentro desta seção
                    </div>
                  ) : (
                    renderPreviewLayout(item.items)
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className={`space-y-4 min-h-0 max-w-full transition-all ${
        flowSidebarCollapsed ? "lg:pl-[80px]" : "lg:pl-[308px]"
      } lg:pr-[356px]`}
    >
      <Card data-tutorial="form-editor-canvas" className="max-w-full overflow-hidden border-border/80 bg-background shadow-xs">
        <CardContent className="p-6 overflow-x-auto max-w-full min-h-[360px]">
          {templateFields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4 max-w-lg mx-auto">
              <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 text-primary shadow-xs">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-base text-foreground">Sua ficha está pronta para ser montada!</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Clique nos componentes da biblioteca à esquerda para adicionar perguntas, ou comece com um dos
                  atalhos rápidos abaixo.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 hover:border-primary/50 hover:bg-primary/5"
                  onClick={() => handleAddField("short_text", null)}
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  + Pergunta de Texto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 hover:border-primary/50 hover:bg-primary/5"
                  onClick={() => handleAddField("section", null)}
                >
                  <Folder className="h-3.5 w-3.5 text-primary" />
                  + Nova Seção
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5 text-primary hover:bg-primary/10"
                  onClick={() => setGuideModalOpen(true)}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Como Funciona?
                </Button>
              </div>
            </div>
          ) : (
            <>
              {renderPreviewLayout(groupedLayout)}
              {canvasMode === "edit" && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragOverFieldId !== "canvas_bottom_dropzone") setDragOverFieldId("canvas_bottom_dropzone");
                  }}
                  onDragLeave={(e) => {
                    e.stopPropagation();
                    if (dragOverFieldId === "canvas_bottom_dropzone") setDragOverFieldId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newFieldType = e.dataTransfer.getData(
                      "application/x-form-new-field-type"
                    ) as AnamnesisField["type"] | "";
                    if (newFieldType) {
                      handleAddField(newFieldType, null);
                    } else if (draggedFieldId) {
                      assignFieldToSection(draggedFieldId, null);
                    }
                    setDraggedFieldId(null);
                    setDragOverFieldId(null);
                  }}
                  className={`mt-4 rounded-lg border border-dashed py-3 text-center text-xs transition-all ${
                    dragOverFieldId === "canvas_bottom_dropzone"
                      ? "border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary"
                      : "border-border/60 text-muted-foreground/70 hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
                  }`}
                >
                  Arraste componentes aqui para adicionar ao final do formulário
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
