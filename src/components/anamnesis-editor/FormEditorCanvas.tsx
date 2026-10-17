import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { AnamnesisField } from "@/lib/anamnesis-forms";
import type { useFormEditorState } from "./useFormEditorState";
import {
  CanvasEmptyState,
  CanvasLayoutRenderer,
  useCanvasHorizontalScroll,
} from "./canvas";

export * from "./canvas";

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
    updateField,
    handleAddField,
    assignFieldToSection,
    setGuideModalOpen,
    flowSidebarCollapsed,
  } = state;

  const {
    editorCardRefs,
    horizontalScrollRefs,
    horizontalScrollState,
    canvasActiveSteps,
    setCanvasActiveSteps,
    scheduleHorizontalScrollSync,
    scrollHorizontalSectionToSibling,
    beginHorizontalDrag,
    updateHorizontalDrag,
    endHorizontalDrag,
  } = useCanvasHorizontalScroll(groupedLayout);

  const setEditorCardRef = (fieldId: string, node: HTMLDivElement | null) => {
    editorCardRefs.current[fieldId] = node;
  };

  const setHorizontalScrollRef = (fieldId: string, node: HTMLDivElement | null) => {
    horizontalScrollRefs.current[fieldId] = node;
  };

  return (
    <div
      className={`space-y-4 min-h-0 max-w-full transition-all ${
        flowSidebarCollapsed ? "lg:pl-[80px]" : "lg:pl-[308px]"
      } lg:pr-[356px]`}
    >
      <Card data-tutorial="form-editor-canvas" className="max-w-full overflow-hidden border-border/80 bg-background shadow-xs">
        <CardContent className="p-6 overflow-x-auto max-w-full min-h-[360px]">
          {templateFields.length === 0 ? (
            <CanvasEmptyState
              handleAddField={handleAddField}
              setGuideModalOpen={setGuideModalOpen}
            />
          ) : (
            <>
              <CanvasLayoutRenderer
                layout={groupedLayout}
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
              />
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
