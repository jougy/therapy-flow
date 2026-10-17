import React, { type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { DesignLabAnamnesisField, DesignLabTemplateLayoutItem } from "../types";
import type { AnamnesisField } from "@/lib/anamnesis-forms";
import { CanvasStandardFieldItem } from "./CanvasStandardFieldItem";
import { CanvasHorizontalSectionItem } from "./CanvasHorizontalSectionItem";
import { CanvasSectionSelectorItem } from "./CanvasSectionSelectorItem";
import { CanvasRadarSectionItem } from "./CanvasRadarSectionItem";
import { CanvasAccordionSectionItem } from "./CanvasAccordionSectionItem";

export interface CanvasLayoutRendererProps {
  layout: DesignLabTemplateLayoutItem[];
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
}

export const CanvasLayoutRenderer: React.FC<CanvasLayoutRendererProps> = (props) => {
  const {
    layout,
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
  } = props;

  const renderRecursive = (items: DesignLabTemplateLayoutItem[]): ReactNode => (
    <CanvasLayoutRenderer {...props} layout={items} />
  );

  return (
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
            <CanvasStandardFieldItem
              key={item.field.id}
              field={item.field}
              isSelected={isSelected}
              isMultiSelecting={isMultiSelecting}
              isDragOver={isDragOver}
              isDraggingThis={isDraggingThis}
              dragOverPosition={dragOverPosition}
              draggedFieldId={draggedFieldId}
              dragOverFieldId={dragOverFieldId}
              isVisibleInTest={isVisibleInTest}
              canvasMode={canvasMode}
              testAnswers={testAnswers}
              setCardRef={(node) => setEditorCardRef(item.field.id, node)}
              setDraggedFieldId={setDraggedFieldId}
              setDragOverFieldId={setDragOverFieldId}
              setDragOverPosition={setDragOverPosition}
              handleDropOnTarget={handleDropOnTarget}
              selectFieldAndOpenMobileInspector={selectFieldAndOpenMobileInspector}
              handleCardTouchStart={handleCardTouchStart}
              handleCardTouchEnd={handleCardTouchEnd}
              duplicateField={duplicateField}
              removeField={removeField}
              setFieldTestAnswer={setFieldTestAnswer}
              updateField={updateField}
            />
          );
        }

        if (item.type === "horizontal_section") {
          return (
            <CanvasHorizontalSectionItem
              key={item.field.id}
              item={item}
              selectedFieldIds={selectedFieldIds}
              isMultiSelecting={isMultiSelecting}
              dragOverFieldId={dragOverFieldId}
              dragOverPosition={dragOverPosition}
              draggedFieldId={draggedFieldId}
              canvasMode={canvasMode}
              testAnswers={testAnswers}
              horizontalScrollState={horizontalScrollState}
              canvasActiveSteps={canvasActiveSteps}
              setCanvasActiveSteps={setCanvasActiveSteps}
              isFieldConditionallyVisible={isFieldConditionallyVisible}
              setEditorCardRef={setEditorCardRef}
              setHorizontalScrollRef={setHorizontalScrollRef}
              scheduleHorizontalScrollSync={scheduleHorizontalScrollSync}
              scrollHorizontalSectionToSibling={scrollHorizontalSectionToSibling}
              beginHorizontalDrag={beginHorizontalDrag}
              updateHorizontalDrag={updateHorizontalDrag}
              endHorizontalDrag={endHorizontalDrag}
              setDraggedFieldId={setDraggedFieldId}
              setDragOverFieldId={setDragOverFieldId}
              setDragOverPosition={setDragOverPosition}
              handleDropOnTarget={handleDropOnTarget}
              selectFieldAndOpenMobileInspector={selectFieldAndOpenMobileInspector}
              handleCardTouchStart={handleCardTouchStart}
              handleCardTouchEnd={handleCardTouchEnd}
              duplicateField={duplicateField}
              removeField={removeField}
              setFieldTestAnswer={setFieldTestAnswer}
              updateField={updateField}
              renderChildItem={(child) => renderRecursive([child])}
            />
          );
        }

        if (item.type === "section_selector") {
          return (
            <CanvasSectionSelectorItem
              key={item.field.id}
              item={item}
              selectedFieldIds={selectedFieldIds}
              isMultiSelecting={isMultiSelecting}
              dragOverFieldId={dragOverFieldId}
              dragOverPosition={dragOverPosition}
              draggedFieldId={draggedFieldId}
              canvasMode={canvasMode}
              testAnswers={testAnswers}
              setEditorCardRef={setEditorCardRef}
              setDraggedFieldId={setDraggedFieldId}
              setDragOverFieldId={setDragOverFieldId}
              setDragOverPosition={setDragOverPosition}
              handleDropOnTarget={handleDropOnTarget}
              selectFieldAndOpenMobileInspector={selectFieldAndOpenMobileInspector}
              handleCardTouchStart={handleCardTouchStart}
              handleCardTouchEnd={handleCardTouchEnd}
              duplicateField={duplicateField}
              removeField={removeField}
              setFieldTestAnswer={setFieldTestAnswer}
              renderChildren={renderRecursive}
            />
          );
        }

        if (item.type === "radar_section") {
          return (
            <CanvasRadarSectionItem
              key={item.field.id}
              item={item}
              selectedFieldIds={selectedFieldIds}
              isMultiSelecting={isMultiSelecting}
              dragOverFieldId={dragOverFieldId}
              dragOverPosition={dragOverPosition}
              draggedFieldId={draggedFieldId}
              canvasMode={canvasMode}
              testAnswers={testAnswers}
              isVisibleInTest={isVisibleInTest}
              setEditorCardRef={setEditorCardRef}
              setDraggedFieldId={setDraggedFieldId}
              setDragOverFieldId={setDragOverFieldId}
              setDragOverPosition={setDragOverPosition}
              handleDropOnTarget={handleDropOnTarget}
              selectFieldAndOpenMobileInspector={selectFieldAndOpenMobileInspector}
              handleCardTouchStart={handleCardTouchStart}
              handleCardTouchEnd={handleCardTouchEnd}
              duplicateField={duplicateField}
              removeField={removeField}
              renderChildren={renderRecursive}
            />
          );
        }

        return (
          <CanvasAccordionSectionItem
            key={item.field.id}
            item={item}
            selectedFieldIds={selectedFieldIds}
            isMultiSelecting={isMultiSelecting}
            dragOverFieldId={dragOverFieldId}
            dragOverPosition={dragOverPosition}
            draggedFieldId={draggedFieldId}
            canvasMode={canvasMode}
            isVisibleInTest={isVisibleInTest}
            setEditorCardRef={setEditorCardRef}
            setDraggedFieldId={setDraggedFieldId}
            setDragOverFieldId={setDragOverFieldId}
            setDragOverPosition={setDragOverPosition}
            handleDropOnTarget={handleDropOnTarget}
            selectFieldAndOpenMobileInspector={selectFieldAndOpenMobileInspector}
            handleCardTouchStart={handleCardTouchStart}
            handleCardTouchEnd={handleCardTouchEnd}
            duplicateField={duplicateField}
            removeField={removeField}
            renderChildren={renderRecursive}
          />
        );
      })}
    </div>
  );
};
