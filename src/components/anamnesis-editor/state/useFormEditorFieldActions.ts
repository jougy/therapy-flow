import { useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import {
  isContainerField,
  type AnamnesisField,
} from "@/lib/anamnesis-forms";
import {
  castDesignLabSchema,
  sanitizeFieldChanges,
  type DesignLabAnamnesisField,
  type DesignLabTemplateLayoutItem,
  type DesignLabTemplateSchema,
} from "../types";
import {
  createAndInsertFieldLogic,
  deleteSectionAndFieldsLogic,
  deleteSelectedFieldsLogic,
  duplicateFieldLogic,
  duplicateSelectedFieldsLogic,
  encapsulateSelectedFieldsLogic,
  handleFluxoDrop,
  insertNewFieldAtTargetLogic,
  moveFieldInTree as moveFieldInTreeLogic,
  moveFieldsAndDeleteSectionLogic,
  type EncapsulateContainerType,
} from "./editorFieldTreeOperations";

export interface UseFormEditorFieldActionsParams {
  templateFields: DesignLabTemplateSchema;
  setTemplateFields: (
    updater: DesignLabTemplateSchema | ((prev: DesignLabTemplateSchema) => DesignLabTemplateSchema),
    skipHistory?: boolean
  ) => void;
  selectedFieldId: string | null;
  setSelectedFieldId: (id: string | null) => void;
  selectedFieldIds: string[];
  setSelectedFieldIds: (ids: string[]) => void;
  setRightSidebarTab: (tab: "flow" | "properties") => void;
  setMobileInspectorOpen: (open: boolean) => void;
  groupedLayout: DesignLabTemplateLayoutItem[];
  draggedFieldId: string | null;
  setDraggedFieldId: (id: string | null) => void;
  setDragOverFieldId: (id: string | null) => void;
  setDragOverPosition: (pos: "before" | "inside" | "after" | null) => void;
  setDeleteSectionDialogOpen: (open: boolean) => void;
  setSectionToDelete: (section: DesignLabAnamnesisField | null) => void;
  setDeleteMoveTargetSectionId: (id: string) => void;
}

export function useFormEditorFieldActions({
  templateFields,
  setTemplateFields,
  selectedFieldId,
  setSelectedFieldId,
  selectedFieldIds,
  setSelectedFieldIds,
  setRightSidebarTab,
  setMobileInspectorOpen,
  groupedLayout,
  draggedFieldId,
  setDraggedFieldId,
  setDragOverFieldId,
  setDragOverPosition,
  setDeleteSectionDialogOpen,
  setSectionToDelete,
  setDeleteMoveTargetSectionId,
}: UseFormEditorFieldActionsParams) {
  const updateField = useCallback(
    (fieldId: string, changes: Partial<AnamnesisField>) => {
      const sanitized = sanitizeFieldChanges(changes);
      setTemplateFields((prev) => {
        const next = prev.map((field) => {
          if (field.id !== fieldId) return field;
          return {
            ...field,
            ...sanitized,
          };
        });
        return castDesignLabSchema(next);
      });
    },
    [setTemplateFields]
  );

  const moveFieldInTree = useCallback(
    (fieldId: string, direction: -1 | 1) => {
      setTemplateFields((prev) => moveFieldInTreeLogic(prev, groupedLayout, fieldId, direction));
    },
    [groupedLayout, setTemplateFields]
  );

  const assignFieldToSection = useCallback(
    (fieldId: string, targetSectionId: string | null) => {
      setTemplateFields((prev) =>
        castDesignLabSchema(
          prev.map((field) => (field.id === fieldId ? { ...field, groupKey: targetSectionId } : field))
        )
      );
    },
    [setTemplateFields]
  );

  const handleAddField = useCallback(
    (type: AnamnesisField["type"], customTargetGroupKey?: string | null) => {
      const result = createAndInsertFieldLogic(templateFields, type, selectedFieldId, customTargetGroupKey);
      if (!result.success) {
        toast({ title: "Limite atingido", description: result.error });
        return;
      }

      setTemplateFields(result.nextFields);
      setSelectedFieldId(result.createdField.id);
      setRightSidebarTab("properties");
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setMobileInspectorOpen(true);
      }
    },
    [selectedFieldId, setMobileInspectorOpen, setRightSidebarTab, setSelectedFieldId, setTemplateFields, templateFields]
  );

  const executeDeleteAllSectionAndFields = useCallback(
    (sectionId: string) => {
      setTemplateFields((prev) => deleteSectionAndFieldsLogic(prev, sectionId));
      if (selectedFieldId === sectionId) {
        setSelectedFieldId(null);
      }
      setDeleteSectionDialogOpen(false);
      setSectionToDelete(null);
    },
    [selectedFieldId, setDeleteSectionDialogOpen, setSectionToDelete, setSelectedFieldId, setTemplateFields]
  );

  const executeMoveFieldsAndDeleteSection = useCallback(
    (sectionId: string, targetSectionId: string | null) => {
      setTemplateFields((prev) => moveFieldsAndDeleteSectionLogic(prev, sectionId, targetSectionId));
      if (selectedFieldId === sectionId) {
        setSelectedFieldId(null);
      }
      setDeleteSectionDialogOpen(false);
      setSectionToDelete(null);
    },
    [selectedFieldId, setDeleteSectionDialogOpen, setSectionToDelete, setSelectedFieldId, setTemplateFields]
  );

  const attemptDeleteField = useCallback(
    (fieldId: string) => {
      const targetField = templateFields.find((f) => f.id === fieldId);
      if (!targetField) return;

      if (isContainerField(targetField)) {
        const children = templateFields.filter((f) => f.groupKey === targetField.id);
        if (children.length > 0) {
          setSectionToDelete(targetField);
          setDeleteMoveTargetSectionId("none");
          setDeleteSectionDialogOpen(true);
          return;
        }
      }

      executeDeleteAllSectionAndFields(fieldId);
    },
    [executeDeleteAllSectionAndFields, setDeleteMoveTargetSectionId, setDeleteSectionDialogOpen, setSectionToDelete, templateFields]
  );

  const removeField = useCallback(
    (fieldId: string) => {
      attemptDeleteField(fieldId);
    },
    [attemptDeleteField]
  );

  const duplicateField = useCallback(
    (field: DesignLabAnamnesisField) => {
      const result = duplicateFieldLogic(templateFields, field);
      if (!result.success) {
        toast({ title: "Limite atingido", description: result.error });
        return;
      }

      const { nextFields, duplicatedParent, childrenCount } = result.result;
      const isContainer = isContainerField(field);

      setTemplateFields(nextFields);
      setSelectedFieldId(duplicatedParent.id);
      setRightSidebarTab("properties");
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setMobileInspectorOpen(true);
      }

      toast({
        title: isContainer ? "Seção duplicada" : "Campo duplicado",
        description:
          isContainer && childrenCount > 0
            ? `A seção e ${childrenCount} campo(s) interno(s) foram duplicados com sucesso.`
            : `O campo "${field.label}" foi duplicado.`,
      });
    },
    [setMobileInspectorOpen, setRightSidebarTab, setSelectedFieldId, setTemplateFields, templateFields]
  );

  const duplicateSelectedFields = useCallback(() => {
    const result = duplicateSelectedFieldsLogic(templateFields, selectedFieldIds);
    if (!result) return;
    if (!result.success) {
      toast({
        title: "Limite atingido",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    setTemplateFields(result.nextFields);
    setSelectedFieldIds(result.newFieldIds);

    toast({
      title: "Campos duplicados",
      description: `${result.topLevelCount} item(ns) duplicados com sucesso.`,
    });
  }, [selectedFieldIds, setSelectedFieldIds, setTemplateFields, templateFields]);

  const encapsulateSelectedFields = useCallback(
    (containerType: EncapsulateContainerType) => {
      const result = encapsulateSelectedFieldsLogic(templateFields, selectedFieldIds, containerType);
      if (!result) return;
      if (!result.success) {
        toast({
          title: "Limite atingido",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      setTemplateFields(result.nextFields);
      setSelectedFieldIds([result.newContainer.id]);
      setRightSidebarTab("properties");
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setMobileInspectorOpen(true);
      }

      toast({
        title:
          containerType === "radar_section"
            ? "Encapsulado em Polígono de Status"
            : containerType === "section"
              ? "Encapsulado em Seção Sanfona"
              : "Encapsulado em Seção Horizontal",
        description: `${selectedFieldIds.length} item(ns) foram agrupados na nova seção.`,
      });
    },
    [selectedFieldIds, setMobileInspectorOpen, setRightSidebarTab, setSelectedFieldIds, setTemplateFields, templateFields]
  );

  const deleteSelectedFields = useCallback(() => {
    const { nextFields, count } = deleteSelectedFieldsLogic(templateFields, selectedFieldIds);
    if (count === 0) return;

    setTemplateFields(nextFields);
    setSelectedFieldIds([]);
    toast({
      title: "Campos excluídos",
      description: `${count} campo(s) foram removidos da ficha.`,
    });
  }, [selectedFieldIds, setSelectedFieldIds, setTemplateFields, templateFields]);

  const updateSectionColor = useCallback(
    (fieldId: string, colorHex: string, alpha = 100) => {
      setTemplateFields((prev) => {
        const next = prev.map((field) => {
          if (field.id !== fieldId) return field;
          return {
            ...field,
            accentColor: colorHex,
            accentAlpha: alpha,
          };
        });
        return castDesignLabSchema(next);
      });
    },
    [setTemplateFields]
  );

  const handleFluxoDropCallback = useCallback(
    (draggedId: string, targetId: string, position: "before" | "inside" | "after") => {
      setTemplateFields((prev) => handleFluxoDrop(prev, selectedFieldIds, draggedId, targetId, position));
    },
    [selectedFieldIds, setTemplateFields]
  );

  const handleDropOnTarget = useCallback(
    (targetId: string, position: "before" | "inside" | "after", event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const newFieldType = event.dataTransfer.getData("application/x-form-new-field-type") as AnamnesisField["type"] | "";
      const existingFieldId = draggedFieldId || event.dataTransfer.getData("text/plain");

      if (newFieldType) {
        const result = insertNewFieldAtTargetLogic(templateFields, newFieldType, targetId, position);
        if (!result.success) {
          toast({
            title: "Limite atingido",
            description: result.error,
          });
          setDraggedFieldId(null);
          setDragOverFieldId(null);
          setDragOverPosition(null);
          return;
        }

        setTemplateFields(result.nextFields);
        setSelectedFieldId(result.createdField.id);
        setRightSidebarTab("properties");
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
          setMobileInspectorOpen(true);
        }
      } else if (existingFieldId && existingFieldId !== targetId) {
        handleFluxoDropCallback(existingFieldId, targetId, position);
      }

      setDraggedFieldId(null);
      setDragOverFieldId(null);
      setDragOverPosition(null);
    },
    [draggedFieldId, handleFluxoDropCallback, setDragOverFieldId, setDragOverPosition, setDraggedFieldId, setMobileInspectorOpen, setRightSidebarTab, setSelectedFieldId, setTemplateFields, templateFields]
  );

  return {
    updateField,
    moveFieldInTree,
    assignFieldToSection,
    handleAddField,
    executeDeleteAllSectionAndFields,
    executeMoveFieldsAndDeleteSection,
    attemptDeleteField,
    removeField,
    duplicateField,
    duplicateSelectedFields,
    encapsulateSelectedFields,
    deleteSelectedFields,
    updateSectionColor,
    handleFluxoDrop: handleFluxoDropCallback,
    handleDropOnTarget,
  };
}
