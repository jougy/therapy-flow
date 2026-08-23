import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ANAMNESIS_SCHEMA_FIELD_LIMIT,
  ANAMNESIS_TEMPLATE_IMPORT_MAX_BYTES,
  buildTemplateLayout,
  compactAnamnesisTemplateSchema,
  createAnamnesisField,
  createDefaultTemplateSchema,
  getAssignableContainerFields,
  getSectionSelectorOptions,
  isAnamnesisTemplateSchema,
  isContainerField,
  parseAnamnesisTemplateExchangePayload,
  sanitizeAnamnesisTemplateSchema,
  type AnamnesisField,
} from "@/lib/anamnesis-forms";
import { INPUT_LIMITS, sanitizeMultilineInput, sanitizeSingleLineInput } from "@/lib/input-security";
import {
  castDesignLabLayout,
  castDesignLabSchema,
  cloneFieldWithNewIds,
  flattenLayoutItems,
  sanitizeFieldChanges,
  type DesignLabAnamnesisField,
  type DesignLabTemplateLayoutItem,
  type DesignLabTemplateSchema,
  type TemplateRow,
} from "./types";

export function useFormEditorState() {
  const { clinicKey, templateId } = useParams();
  const navigate = useNavigate();
  const { can, clinic, clinicId, user } = useAuth();
  const routeClinicKey = clinicKey ?? clinic?.route_key;
  const clinicSettingsPath = routeClinicKey ? `/clinica/${routeClinicKey}/configuracoes` : "/configuracoes";
  const clinicFormsManagerPath = `${clinicSettingsPath}?secao=forms`;
  const isNew = templateId === "novo";
  const isBase = templateId === "base" || templateId === "universal";
  const canManageForms = can("forms.manage");

  const [loading, setLoading] = useState(!isNew && !isBase);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [template, setTemplate] = useState<TemplateRow | null>(null);

  const [templateFields, _setTemplateFields] = useState<DesignLabTemplateSchema>(() => []);
  const [historyStack, setHistoryStack] = useState<DesignLabAnamnesisField[][]>(() => [[]]);
  const [historyPointer, setHistoryPointer] = useState<number>(0);
  const isHistoryNavigatingRef = useRef(false);
  const isSavingRef = useRef(false);
  const initialSnapshotRef = useRef<{ name: string; description: string; fieldsJson: string } | null>(null);

  const headerRef = useRef<HTMLDivElement | null>(null);
  const topContainerRef = useRef<HTMLDivElement | null>(null);
  const templateImportInputRef = useRef<HTMLInputElement | null>(null);

  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [desktopMenuTop, setDesktopMenuTop] = useState(140);
  const [desktopMenuMaxHeight, setDesktopMenuMaxHeight] = useState(560);
  const [showFloatingSave, setShowFloatingSave] = useState(false);
  const [deleteTemplateDialogOpen, setDeleteTemplateDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [unsavedChangesDialogOpen, setUnsavedChangesDialogOpen] = useState(false);

  const canUndo = historyPointer > 0;
  const canRedo = historyPointer < historyStack.length - 1;

  const markCleanState = useCallback((name: string, description: string, fields: DesignLabTemplateSchema) => {
    initialSnapshotRef.current = {
      name: name.trim(),
      description: description.trim(),
      fieldsJson: JSON.stringify(sanitizeAnamnesisTemplateSchema(fields)),
    };
  }, []);

  const isDirty = useMemo(() => {
    if (!initialSnapshotRef.current) return isNew;
    const currentName = templateName.trim();
    const currentDesc = templateDescription.trim();
    const currentFieldsJson = JSON.stringify(sanitizeAnamnesisTemplateSchema(templateFields));

    return (
      currentName !== initialSnapshotRef.current.name ||
      currentDesc !== initialSnapshotRef.current.description ||
      currentFieldsJson !== initialSnapshotRef.current.fieldsJson
    );
  }, [isNew, templateName, templateDescription, templateFields]);

  const draftStorageKey = useMemo(() => {
    if (!clinicId) return null;
    return `pluri_anamnesis_draft_${clinicId}_${templateId || "novo"}`;
  }, [clinicId, templateId]);

  const [recoverableDraft, setRecoverableDraft] = useState<{
    name: string;
    description: string;
    fields: DesignLabTemplateSchema;
    savedAt: string;
  } | null>(null);

  const checkRecoverableDraft = useCallback(
    (loadedFields: DesignLabTemplateSchema, loadedName: string, loadedDesc: string) => {
      if (!draftStorageKey || typeof window === "undefined") return;
      try {
        const rawDraft = localStorage.getItem(draftStorageKey);
        if (!rawDraft) return;
        const parsed = JSON.parse(rawDraft);
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.fields) &&
          isAnamnesisTemplateSchema(parsed.fields)
        ) {
          const draftFieldsJson = JSON.stringify(sanitizeAnamnesisTemplateSchema(parsed.fields));
          const loadedFieldsJson = JSON.stringify(sanitizeAnamnesisTemplateSchema(loadedFields));
          const draftName = String(parsed.name || "").trim();
          const draftDesc = String(parsed.description || "").trim();

          if (
            draftFieldsJson !== loadedFieldsJson ||
            draftName !== loadedName.trim() ||
            draftDesc !== loadedDesc.trim()
          ) {
            setRecoverableDraft({
              name: draftName || loadedName,
              description: draftDesc || loadedDesc,
              fields: castDesignLabSchema(parsed.fields),
              savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
            });
          } else {
            localStorage.removeItem(draftStorageKey);
          }
        }
      } catch (err) {
        console.warn("Falha ao recuperar rascunho do formulário:", err);
      }
    },
    [draftStorageKey]
  );

  useEffect(() => {
    if (!draftStorageKey || !isDirty || saving || typeof window === "undefined") return;

    const timer = window.setTimeout(() => {
      try {
        const payload = {
          name: templateName,
          description: templateDescription,
          fields: templateFields,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(draftStorageKey, JSON.stringify(payload));
      } catch (err) {
        console.warn("Falha ao salvar rascunho local:", err);
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [draftStorageKey, isDirty, saving, templateName, templateDescription, templateFields]);

  const setTemplateFields = useCallback(
    (
      updater: DesignLabTemplateSchema | ((prev: DesignLabTemplateSchema) => DesignLabTemplateSchema),
      skipHistory = false
    ) => {
      _setTemplateFields((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        const sanitized = castDesignLabSchema(next);
        if (!isHistoryNavigatingRef.current && !skipHistory) {
          setHistoryStack((prevHistory) => {
            const branch = prevHistory.slice(0, historyPointer + 1);
            if (branch.length > 0 && JSON.stringify(branch[branch.length - 1]) === JSON.stringify(sanitized)) {
              return prevHistory;
            }
            const nextStack = [...branch, JSON.parse(JSON.stringify(sanitized))];
            if (nextStack.length > 50) nextStack.shift();
            return nextStack;
          });
          setHistoryPointer((prevIdx) => Math.min(prevIdx + 1, 49));
        }
        return sanitized;
      });
    },
    [historyPointer]
  );

  const setInitialTemplateFields = useCallback(
    (fields: DesignLabTemplateSchema, initialName?: string, initialDesc?: string) => {
      const sanitized = castDesignLabSchema(fields);
      isHistoryNavigatingRef.current = true;
      _setTemplateFields(sanitized);
      setHistoryStack([JSON.parse(JSON.stringify(sanitized))]);
      setHistoryPointer(0);
      if (initialName !== undefined && initialDesc !== undefined) {
        markCleanState(initialName, initialDesc, sanitized);
      }
      setTimeout(() => {
        isHistoryNavigatingRef.current = false;
      }, 50);
    },
    [markCleanState]
  );

  const handleRestoreDraft = useCallback(() => {
    if (!recoverableDraft) return;
    setTemplateName(recoverableDraft.name);
    setTemplateDescription(recoverableDraft.description);
    _setTemplateFields(recoverableDraft.fields);
    setHistoryStack([JSON.parse(JSON.stringify(recoverableDraft.fields))]);
    setHistoryPointer(0);
    setRecoverableDraft(null);
    toast({
      title: "Rascunho restaurado",
      description: "As alterações locais foram carregadas no editor com sucesso.",
    });
  }, [recoverableDraft]);

  const handleDiscardDraft = useCallback(() => {
    if (draftStorageKey && typeof window !== "undefined") {
      try {
        localStorage.removeItem(draftStorageKey);
      } catch (err) {
        console.warn("Falha ao remover rascunho:", err);
      }
    }
    setRecoverableDraft(null);
    toast({
      title: "Rascunho descartado",
      description: "As alterações locais não salvas foram descartadas.",
    });
  }, [draftStorageKey]);

  const handleUndo = useCallback(() => {
    if (historyPointer <= 0) return;
    const targetIdx = historyPointer - 1;
    const targetSnapshot = historyStack[targetIdx];
    if (targetSnapshot) {
      isHistoryNavigatingRef.current = true;
      _setTemplateFields(JSON.parse(JSON.stringify(targetSnapshot)));
      setHistoryPointer(targetIdx);
      toast({ title: "Desfeito (Undo)", description: "Ação anterior revertida com sucesso." });
      setTimeout(() => {
        isHistoryNavigatingRef.current = false;
      }, 50);
    }
  }, [historyPointer, historyStack]);

  const handleRedo = useCallback(() => {
    if (historyPointer >= historyStack.length - 1) return;
    const targetIdx = historyPointer + 1;
    const targetSnapshot = historyStack[targetIdx];
    if (targetSnapshot) {
      isHistoryNavigatingRef.current = true;
      _setTemplateFields(JSON.parse(JSON.stringify(targetSnapshot)));
      setHistoryPointer(targetIdx);
      toast({ title: "Refeito (Redo)", description: "Ação reaplicada com sucesso." });
      setTimeout(() => {
        isHistoryNavigatingRef.current = false;
      }, 50);
    }
  }, [historyPointer, historyStack]);

  // Drag & Drop
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [draggedNewFieldType, setDraggedNewFieldType] = useState<AnamnesisField["type"] | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "inside" | "after" | null>(null);

  // Selection
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const isMultiSelecting = selectedFieldIds.length > 1;
  const selectedFieldId = selectedFieldIds.length > 0 ? selectedFieldIds[selectedFieldIds.length - 1] : null;

  const setSelectedFieldId = useCallback((id: string | null) => {
    if (id === null) {
      setSelectedFieldIds([]);
    } else {
      setSelectedFieldIds([id]);
    }
  }, []);

  const toggleFieldSelection = useCallback((fieldId: string) => {
    setSelectedFieldIds((prev) => {
      if (prev.includes(fieldId)) {
        return prev.filter((id) => id !== fieldId);
      }
      return [...prev, fieldId];
    });
  }, []);

  const isAllSelected = useMemo(
    () => templateFields.length > 0 && selectedFieldIds.length === templateFields.length,
    [templateFields.length, selectedFieldIds.length]
  );

  const handleSelectAllFields = useCallback(() => {
    if (templateFields.length === 0) return;
    const allIds = templateFields.map((f) => f.id);
    setSelectedFieldIds(allIds);
    toast({
      title: "Todos os campos selecionados",
      description: `${allIds.length} ${allIds.length === 1 ? "campo selecionado" : "campos selecionados"} no formulário.`,
    });
  }, [templateFields]);

  const handleToggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedFieldIds([]);
      toast({ title: "Seleção limpa", description: "Todos os campos foram desmarcados." });
    } else {
      handleSelectAllFields();
    }
  }, [isAllSelected, handleSelectAllFields]);

  // Touch and Long Press
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActiveRef = useRef(false);

  const handleCardTouchStart = useCallback(
    (fieldId: string) => {
      isLongPressActiveRef.current = false;
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
        isLongPressActiveRef.current = true;
        toggleFieldSelection(fieldId);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(50);
          } catch (err) {
            console.debug("Vibrate not supported or permitted:", err);
          }
        }
        toast({
          title: "Modo multiseleção ativado",
          description: "Toque em outros campos para adicionar ou remover da seleção.",
        });
      }, 450);
    },
    [toggleFieldSelection]
  );

  const handleCardTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // UI state
  const [rightSidebarTab, setRightSidebarTab] = useState<"flow" | "properties">("flow");
  const [inspectorTab, setInspectorTab] = useState<"settings" | "design" | "logic">("settings");
  const [canvasMode, setCanvasMode] = useState<"edit" | "test">("edit");
  const [flowSidebarCollapsed, setFlowSidebarCollapsed] = useState(false);
  const [collapsedFlowNodeIds, setCollapsedFlowNodeIds] = useState<Set<string>>(() => new Set());
  const [deleteSectionDialogOpen, setDeleteSectionDialogOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<DesignLabAnamnesisField | null>(null);
  const [deleteMoveTargetSectionId, setDeleteMoveTargetSectionId] = useState<string>("none");

  // Test Answers
  const [testAnswers, setTestAnswers] = useState<Record<string, unknown>>({});
  const hasTestAnswers = useMemo(() => Object.keys(testAnswers).length > 0, [testAnswers]);

  const setFieldTestAnswer = useCallback((fieldId: string, value: unknown) => {
    setTestAnswers((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const handleClearTestAnswers = useCallback(() => {
    setTestAnswers({});
    toast({ title: "Respostas de teste limpas", description: "Todos os campos do preview foram redefinidos para o padrão." });
  }, []);

  // Computed layout & collections
  const sectionOptions = useMemo(() => getSectionSelectorOptions(templateFields), [templateFields]);
  const groupedLayout = useMemo(() => castDesignLabLayout(buildTemplateLayout(templateFields)), [templateFields]);
  const visualOrderedFields = useMemo(() => flattenLayoutItems(groupedLayout), [groupedLayout]);
  const fieldLimitReached = templateFields.length >= ANAMNESIS_SCHEMA_FIELD_LIMIT;

  const selectedField = useMemo(
    () => (selectedFieldId ? templateFields.find((field) => field.id === selectedFieldId) ?? null : null),
    [selectedFieldId, templateFields]
  );

  const selectedFieldAssignableContainers = useMemo(
    () => (selectedField ? getAssignableContainerFields(templateFields, selectedField.id) : []),
    [selectedField, templateFields]
  );

  const flowIndexById = useMemo(
    () => new Map(visualOrderedFields.map((field, index) => [field.id, index + 1])),
    [visualOrderedFields]
  );

  useEffect(() => {
    if (selectedFieldId && !templateFields.some((field) => field.id === selectedFieldId)) {
      setSelectedFieldId(null);
    }
  }, [selectedFieldId, templateFields, setSelectedFieldId]);

  const toggleFlowNode = useCallback((fieldId: string) => {
    setCollapsedFlowNodeIds((current) => {
      const next = new Set(current);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  }, []);

  const selectFieldAndOpenMobileInspector = useCallback(
    (fieldId: string, event?: React.MouseEvent) => {
      if (isLongPressActiveRef.current) {
        isLongPressActiveRef.current = false;
        return;
      }

      const isShift = !!event?.shiftKey;
      if (isShift) {
        toggleFieldSelection(fieldId);
        return;
      }

      if (selectedFieldIds.length > 1 && selectedFieldIds.includes(fieldId)) {
        toggleFieldSelection(fieldId);
        return;
      }

      setSelectedFieldId(fieldId);
      setRightSidebarTab("properties");
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setMobileInspectorOpen(true);
      }
    },
    [selectedFieldIds, toggleFieldSelection, setSelectedFieldId]
  );

  // Field manipulation functions
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
      const visualFields = flattenLayoutItems(groupedLayout);
      const currIdx = visualFields.findIndex((f) => f.id === fieldId);
      if (currIdx === -1) return;

      const targetIdx = currIdx + direction;
      if (targetIdx < 0 || targetIdx >= visualFields.length) return;

      const adjacentField = visualFields[targetIdx];

      setTemplateFields((prev) => {
        const next = [...prev];
        const fieldIndex = next.findIndex((f) => f.id === fieldId);
        if (fieldIndex === -1) return prev;

        const fieldToMove = next[fieldIndex];
        const isContainer = isContainerField(fieldToMove);

        if (isContainer) {
          const blockIds = new Set<string>();
          blockIds.add(fieldId);
          next.forEach((f) => {
            if (f.groupKey === fieldId) blockIds.add(f.id);
          });

          let nextAdjacentIdx = targetIdx;
          while (
            nextAdjacentIdx >= 0 &&
            nextAdjacentIdx < visualFields.length &&
            blockIds.has(visualFields[nextAdjacentIdx].id)
          ) {
            nextAdjacentIdx += direction;
          }

          if (nextAdjacentIdx < 0 || nextAdjacentIdx >= visualFields.length) return prev;
          const targetRefField = visualFields[nextAdjacentIdx];

          const blockItems = next.filter((f) => blockIds.has(f.id));
          const remainingItems = next.filter((f) => !blockIds.has(f.id));

          const refIndexInRemaining = remainingItems.findIndex((f) => f.id === targetRefField.id);
          if (refIndexInRemaining === -1) return prev;

          const insertAt = direction === -1 ? refIndexInRemaining : refIndexInRemaining + 1;
          remainingItems.splice(insertAt, 0, ...blockItems);
          return castDesignLabSchema(remainingItems);
        } else {
          let newGroupKey: string | null = fieldToMove.groupKey ?? null;

          if (direction === -1) {
            if (fieldToMove.groupKey) {
              const parentSection = prev.find((f) => f.id === fieldToMove.groupKey);
              const sectionChildren = visualFields.filter((f) => f.groupKey === fieldToMove.groupKey);
              const isFirstChild = sectionChildren[0]?.id === fieldId;

              if (isFirstChild && parentSection) {
                newGroupKey = parentSection.groupKey ?? null;
              } else if (adjacentField) {
                newGroupKey = adjacentField.groupKey ?? fieldToMove.groupKey;
              }
            } else {
              if (isContainerField(adjacentField)) {
                newGroupKey = adjacentField.id;
              } else {
                newGroupKey = adjacentField.groupKey ?? null;
              }
            }
          } else {
            if (fieldToMove.groupKey) {
              const sectionChildren = visualFields.filter((f) => f.groupKey === fieldToMove.groupKey);
              const isLastChild = sectionChildren[sectionChildren.length - 1]?.id === fieldId;

              if (isLastChild) {
                const parentSection = prev.find((f) => f.id === fieldToMove.groupKey);
                newGroupKey = parentSection?.groupKey ?? null;
              } else if (adjacentField) {
                newGroupKey = isContainerField(adjacentField)
                  ? adjacentField.id
                  : (adjacentField.groupKey ?? fieldToMove.groupKey);
              }
            } else {
              if (isContainerField(adjacentField)) {
                newGroupKey = adjacentField.id;
              } else {
                newGroupKey = adjacentField.groupKey ?? null;
              }
            }
          }

          const updatedField = { ...fieldToMove, groupKey: newGroupKey };
          const remaining = next.filter((f) => f.id !== fieldId);
          const refIndex = remaining.findIndex((f) => f.id === adjacentField.id);

          if (refIndex === -1) {
            remaining.push(updatedField);
          } else {
            const insertAt = direction === -1 ? refIndex : refIndex + 1;
            remaining.splice(insertAt, 0, updatedField);
          }

          return castDesignLabSchema(remaining);
        }
      });
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
      if (fieldLimitReached) {
        toast({
          title: "Limite atingido",
          description: `Uma ficha pode ter no máximo ${ANAMNESIS_SCHEMA_FIELD_LIMIT} campos.`,
        });
        return;
      }

      const newField = createAnamnesisField(type, templateFields.length + 1) as DesignLabAnamnesisField;

      let targetGroupKey: string | null = customTargetGroupKey !== undefined ? customTargetGroupKey : null;
      let insertIndex = templateFields.length;

      if (customTargetGroupKey === undefined && selectedFieldId) {
        const selectedIndex = templateFields.findIndex((f) => f.id === selectedFieldId);
        if (selectedIndex !== -1) {
          const selField = templateFields[selectedIndex];
          const isSelectedContainer = isContainerField(selField);

          if (isSelectedContainer) {
            targetGroupKey = selField.id;
            insertIndex = selectedIndex + 1;
          } else {
            targetGroupKey = selField.groupKey ?? null;
            insertIndex = selectedIndex + 1;
          }
        }
      }

      const fieldToInsert = { ...newField, groupKey: targetGroupKey };

      setTemplateFields((prev) => {
        const next = [...prev];
        next.splice(insertIndex, 0, fieldToInsert);
        return castDesignLabSchema(next);
      });

      setSelectedFieldId(fieldToInsert.id);
      setRightSidebarTab("properties");
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setMobileInspectorOpen(true);
      }
    },
    [fieldLimitReached, selectedFieldId, setSelectedFieldId, setTemplateFields, templateFields]
  );

  const executeDeleteAllSectionAndFields = useCallback(
    (sectionId: string) => {
      setTemplateFields((prev) => {
        const next = prev.filter((f) => f.id !== sectionId && f.groupKey !== sectionId);
        return castDesignLabSchema(next);
      });
      if (selectedFieldId === sectionId) {
        setSelectedFieldId(null);
      }
      setDeleteSectionDialogOpen(false);
      setSectionToDelete(null);
    },
    [selectedFieldId, setSelectedFieldId, setTemplateFields]
  );

  const executeMoveFieldsAndDeleteSection = useCallback(
    (sectionId: string, targetSectionId: string | null) => {
      setTemplateFields((prev) => {
        const next = prev
          .filter((f) => f.id !== sectionId)
          .map((f) => {
            if (f.groupKey !== sectionId) return f;
            return { ...f, groupKey: targetSectionId };
          });
        return castDesignLabSchema(next);
      });
      if (selectedFieldId === sectionId) {
        setSelectedFieldId(null);
      }
      setDeleteSectionDialogOpen(false);
      setSectionToDelete(null);
    },
    [selectedFieldId, setSelectedFieldId, setTemplateFields]
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
    [executeDeleteAllSectionAndFields, templateFields]
  );

  const removeField = useCallback(
    (fieldId: string) => {
      attemptDeleteField(fieldId);
    },
    [attemptDeleteField]
  );

  const duplicateField = useCallback(
    (field: DesignLabAnamnesisField) => {
      const isContainer = isContainerField(field);
      const children = isContainer ? templateFields.filter((f) => f.groupKey === field.id) : [];
      const fieldsToAddCount = 1 + children.length;

      if (templateFields.length + fieldsToAddCount > ANAMNESIS_SCHEMA_FIELD_LIMIT) {
        toast({
          title: "Limite atingido",
          description: `Esta duplicação ultrapassaria o limite máximo de ${ANAMNESIS_SCHEMA_FIELD_LIMIT} campos por ficha.`,
        });
        return;
      }

      const duplicatedParent = cloneFieldWithNewIds(field, field.groupKey ?? null, templateFields.length + 1);

      const duplicatedChildren = children.map((child, childIdx) =>
        cloneFieldWithNewIds(child, duplicatedParent.id, templateFields.length + 2 + childIdx)
      );

      setTemplateFields((prev) => {
        const parentIndex = prev.findIndex((f) => f.id === field.id);
        if (parentIndex === -1) return castDesignLabSchema([...prev, duplicatedParent, ...duplicatedChildren]);

        const next = [...prev];
        let insertIndex = parentIndex + 1;
        if (isContainer) {
          for (let i = parentIndex + 1; i < next.length; i++) {
            if (next[i].groupKey === field.id) {
              insertIndex = i + 1;
            }
          }
        }

        next.splice(insertIndex, 0, duplicatedParent, ...duplicatedChildren);
        return castDesignLabSchema(next);
      });

      setSelectedFieldId(duplicatedParent.id);
      setRightSidebarTab("properties");
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setMobileInspectorOpen(true);
      }

      toast({
        title: isContainer ? "Seção duplicada" : "Campo duplicado",
        description:
          isContainer && children.length > 0
            ? `A seção e ${children.length} campo(s) interno(s) foram duplicados com sucesso.`
            : `O campo "${field.label}" foi duplicado.`,
      });
    },
    [setSelectedFieldId, setTemplateFields, templateFields]
  );

  const duplicateSelectedFields = useCallback(() => {
    if (selectedFieldIds.length === 0) return;

    const topLevelSelected = templateFields.filter((f) => selectedFieldIds.includes(f.id));
    if (topLevelSelected.length === 0) return;

    let totalAdded = 0;
    topLevelSelected.forEach((f) => {
      totalAdded += 1;
      if (isContainerField(f)) {
        totalAdded += templateFields.filter((c) => c.groupKey === f.id).length;
      }
    });

    if (templateFields.length + totalAdded > ANAMNESIS_SCHEMA_FIELD_LIMIT) {
      toast({
        title: "Limite atingido",
        description: `Esta duplicação em massa ultrapassaria o limite de ${ANAMNESIS_SCHEMA_FIELD_LIMIT} campos.`,
        variant: "destructive",
      });
      return;
    }

    const newFieldIds: string[] = [];
    const fieldsToInsert: DesignLabAnamnesisField[] = [];

    topLevelSelected.forEach((field, idx) => {
      const isContainer = isContainerField(field);
      const children = isContainer ? templateFields.filter((f) => f.groupKey === field.id) : [];
      const duplicatedParent = cloneFieldWithNewIds(field, field.groupKey ?? null, templateFields.length + idx * 10 + 1);
      newFieldIds.push(duplicatedParent.id);
      fieldsToInsert.push(duplicatedParent);

      children.forEach((child, cIdx) => {
        const duplicatedChild = cloneFieldWithNewIds(
          child,
          duplicatedParent.id,
          templateFields.length + idx * 10 + cIdx + 2
        );
        fieldsToInsert.push(duplicatedChild);
      });
    });

    setTemplateFields((prev) => castDesignLabSchema([...prev, ...fieldsToInsert]));
    setSelectedFieldIds(newFieldIds);

    toast({
      title: "Campos duplicados",
      description: `${topLevelSelected.length} item(ns) duplicados com sucesso.`,
    });
  }, [selectedFieldIds, setTemplateFields, templateFields]);

  const encapsulateSelectedFields = useCallback(
    (containerType: "section" | "horizontal_section") => {
      if (selectedFieldIds.length === 0) return;

      if (templateFields.length + 1 > ANAMNESIS_SCHEMA_FIELD_LIMIT) {
        toast({
          title: "Limite atingido",
          description: `Não é possível adicionar uma nova seção pois o limite de ${ANAMNESIS_SCHEMA_FIELD_LIMIT} campos foi atingido.`,
          variant: "destructive",
        });
        return;
      }

      const newContainer = createAnamnesisField(containerType, templateFields.length + 1) as DesignLabAnamnesisField;
      newContainer.label = containerType === "section" ? "Nova Seção Agrupada" : "Nova Seção Horizontal";

      const firstSelectedIndex = templateFields.findIndex((f) => selectedFieldIds.includes(f.id));
      const targetGroupKey = firstSelectedIndex >= 0 ? templateFields[firstSelectedIndex].groupKey : null;
      newContainer.groupKey = targetGroupKey;

      setTemplateFields((prev) => {
        const next = prev.map((f) => {
          if (selectedFieldIds.includes(f.id)) {
            return { ...f, groupKey: newContainer.id };
          }
          return f;
        });

        const insertPos = firstSelectedIndex >= 0 ? firstSelectedIndex : next.length;
        next.splice(insertPos, 0, newContainer);
        return castDesignLabSchema(next);
      });

      setSelectedFieldIds([newContainer.id]);
      setRightSidebarTab("properties");
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setMobileInspectorOpen(true);
      }

      toast({
        title: containerType === "section" ? "Encapsulado em Seção Sanfona" : "Encapsulado em Seção Horizontal",
        description: `${selectedFieldIds.length} item(ns) foram agrupados na nova seção.`,
      });
    },
    [selectedFieldIds, setTemplateFields, templateFields]
  );

  const deleteSelectedFields = useCallback(() => {
    if (selectedFieldIds.length === 0) return;

    const count = selectedFieldIds.length;
    setTemplateFields((prev) => {
      const idsToDelete = new Set<string>(selectedFieldIds);
      prev.forEach((f) => {
        if (f.groupKey && idsToDelete.has(f.groupKey)) {
          idsToDelete.add(f.id);
        }
      });
      return castDesignLabSchema(prev.filter((f) => !idsToDelete.has(f.id)));
    });

    setSelectedFieldIds([]);
    toast({
      title: "Campos excluídos",
      description: `${count} campo(s) foram removidos da ficha.`,
    });
  }, [selectedFieldIds, setTemplateFields]);

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

  const handleFluxoDrop = useCallback(
    (draggedId: string, targetId: string, position: "before" | "inside" | "after") => {
      if (draggedId === targetId) return;
      const targetField = templateFields.find((f) => f.id === targetId);
      if (!targetField) return;

      setTemplateFields((prev) => {
        const isMultiDrag = selectedFieldIds.length > 1 && selectedFieldIds.includes(draggedId);
        const rootDraggedIds = isMultiDrag ? selectedFieldIds : [draggedId];

        const blockIds = new Set<string>();
        
        const collectDescendants = (parentId: string) => {
          prev.forEach((child) => {
            if (child.groupKey === parentId) {
              if (!blockIds.has(child.id)) {
                blockIds.add(child.id);
                if (isContainerField(child)) {
                  collectDescendants(child.id);
                }
              }
            }
          });
        };

        rootDraggedIds.forEach((id) => {
          blockIds.add(id);
          const f = prev.find((item) => item.id === id);
          if (f && isContainerField(f)) {
            collectDescendants(id);
          }
        });

        if (blockIds.has(targetId)) return prev;

        let newGroupKey: string | null = targetField.groupKey ?? null;
        if (position === "inside" && isContainerField(targetField)) {
          newGroupKey = targetField.id;
        }

        const itemsToMove = prev
          .filter((f) => blockIds.has(f.id))
          .map((f) => (rootDraggedIds.includes(f.id) ? { ...f, groupKey: newGroupKey } : f));
        const remaining = prev.filter((f) => !blockIds.has(f.id));

        const refIndex = remaining.findIndex((f) => f.id === targetId);
        if (refIndex === -1) {
          remaining.push(...itemsToMove);
        } else {
          let insertIndex = refIndex;
          if (position === "before") {
            insertIndex = refIndex;
          } else if (position === "inside" && isContainerField(targetField)) {
            insertIndex = refIndex + 1;
          } else {
            if (isContainerField(targetField)) {
              let lastChildIdx = refIndex;
              for (let i = refIndex + 1; i < remaining.length; i++) {
                if (remaining[i].groupKey === targetField.id) {
                  lastChildIdx = i;
                }
              }
              insertIndex = lastChildIdx + 1;
            } else {
              insertIndex = refIndex + 1;
            }
          }
          remaining.splice(insertIndex, 0, ...itemsToMove);
        }

        return castDesignLabSchema(remaining);
      });
    },
    [selectedFieldIds, setTemplateFields, templateFields]
  );

  const handleDropOnTarget = useCallback(
    (targetId: string, position: "before" | "inside" | "after", event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const newFieldType = event.dataTransfer.getData("application/x-form-new-field-type") as AnamnesisField["type"] | "";
      const existingFieldId = draggedFieldId || event.dataTransfer.getData("text/plain");

      if (newFieldType) {
        if (fieldLimitReached) {
          toast({
            title: "Limite atingido",
            description: `Uma ficha pode ter no máximo ${ANAMNESIS_SCHEMA_FIELD_LIMIT} campos.`,
          });
          setDraggedFieldId(null);
          setDragOverFieldId(null);
          setDragOverPosition(null);
          return;
        }

        const newField = createAnamnesisField(newFieldType, templateFields.length + 1) as DesignLabAnamnesisField;
        const targetField = templateFields.find((f) => f.id === targetId);

        if (!targetField) {
          setTemplateFields((prev) => castDesignLabSchema([...prev, newField]));
          setSelectedFieldId(newField.id);
          setRightSidebarTab("properties");
          setDraggedFieldId(null);
          setDragOverFieldId(null);
          setDragOverPosition(null);
          return;
        }

        setTemplateFields((prev) => {
          const next = [...prev];
          const targetIdx = next.findIndex((f) => f.id === targetId);
          if (targetIdx === -1) return castDesignLabSchema([...next, newField]);

          if (position === "inside" && isContainerField(targetField)) {
            newField.groupKey = targetField.id;
            next.splice(targetIdx + 1, 0, newField);
          } else if (position === "before") {
            newField.groupKey = targetField.groupKey ?? null;
            next.splice(targetIdx, 0, newField);
          } else {
            newField.groupKey = targetField.groupKey ?? null;
            if (isContainerField(targetField)) {
              let lastChildIdx = targetIdx;
              for (let i = targetIdx + 1; i < next.length; i++) {
                if (next[i].groupKey === targetField.id) {
                  lastChildIdx = i;
                }
              }
              next.splice(lastChildIdx + 1, 0, newField);
            } else {
              next.splice(targetIdx + 1, 0, newField);
            }
          }

          return castDesignLabSchema(next);
        });

        setSelectedFieldId(newField.id);
        setRightSidebarTab("properties");
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
          setMobileInspectorOpen(true);
        }
      } else if (existingFieldId && existingFieldId !== targetId) {
        handleFluxoDrop(existingFieldId, targetId, position);
      }

      setDraggedFieldId(null);
      setDragOverFieldId(null);
      setDragOverPosition(null);
    },
    [draggedFieldId, fieldLimitReached, handleFluxoDrop, setSelectedFieldId, setTemplateFields, templateFields]
  );

  const isFieldConditionallyVisible = useCallback(
    (field: AnamnesisField) => {
      if (field.groupKey) {
        const parent = templateFields.find((f) => f.id === field.groupKey);
        if (parent && parent.type === "section_selector") {
          const switchStates = (testAnswers[parent.id] as Record<string, boolean>) ?? {};
          return switchStates[field.id] ?? true;
        }
        if (parent && parent.groupKey) {
          const grandParent = templateFields.find((f) => f.id === parent.groupKey);
          if (grandParent && grandParent.type === "section_selector") {
            const switchStates = (testAnswers[grandParent.id] as Record<string, boolean>) ?? {};
            return switchStates[parent.id] ?? true;
          }
        }
      }

      if (field.sectionKey) {
        const selectorField = templateFields.find((f) => f.type === "section_selector");
        if (selectorField) {
          const switchStates = (testAnswers[selectorField.id] as Record<string, boolean>) ?? {};
          return !!switchStates[field.sectionKey];
        }
      }

      return true;
    },
    [templateFields, testAnswers]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)
      ) {
        return;
      }

      const isMac = typeof navigator !== "undefined" && /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey) {
        if (e.key === "a" || e.key === "A") {
          e.preventDefault();
          handleSelectAllFields();
        } else if (e.key === "z" || e.key === "Z") {
          if (e.shiftKey) {
            e.preventDefault();
            handleRedo();
          } else {
            e.preventDefault();
            handleUndo();
          }
        } else if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          handleRedo();
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedFieldId) {
          e.preventDefault();
          attemptDeleteField(selectedFieldId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [attemptDeleteField, handleRedo, handleSelectAllFields, handleUndo, selectedFieldId]);

  // Load clinic & template data
  useEffect(() => {
    if (!canManageForms) {
      toast({ title: "Acesso restrito", description: "Seu perfil não pode gerenciar formulários.", variant: "destructive" });
      navigate(clinicFormsManagerPath);
      return;
    }

    if (isBase) {
      const fetchClinic = async () => {
        if (!clinicId) return;

        const { data, error } = await supabase.from("clinics").select("*").eq("id", clinicId).single();

        if (error || !data) {
          toast({ title: "Clínica não encontrada", description: error?.message, variant: "destructive" });
          navigate(clinicFormsManagerPath);
          return;
        }

        const baseName = "Bloco padrão universal";
        const baseDesc = "Primeira parte obrigatória aplicada em todas as fichas da clínica.";
        const baseFields = castDesignLabSchema(
          isAnamnesisTemplateSchema(data.anamnesis_base_schema)
            ? sanitizeAnamnesisTemplateSchema(data.anamnesis_base_schema)
            : createDefaultTemplateSchema()
        );
        setTemplateName(baseName);
        setTemplateDescription(baseDesc);
        setInitialTemplateFields(baseFields, baseName, baseDesc);
        checkRecoverableDraft(baseFields, baseName, baseDesc);
        setLoading(false);
      };

      void fetchClinic();
      return;
    }

    if (isNew) {
      const fetchCount = async () => {
        const emptyFields: DesignLabTemplateSchema = [];
        if (!clinicId) {
          const newName = "Novo formulário 1";
          const newDesc = "Adicione uma descrição";
          setTemplateName(newName);
          setTemplateDescription(newDesc);
          setInitialTemplateFields(emptyFields, newName, newDesc);
          checkRecoverableDraft(emptyFields, newName, newDesc);
          setLoading(false);
          return;
        }

        const { count } = await supabase
          .from("anamnesis_form_templates")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId);

        const formNum = (count ?? 0) + 1;
        const newName = `Novo formulário ${formNum}`;
        const newDesc = "Adicione uma descrição";
        setTemplateName(newName);
        setTemplateDescription(newDesc);
        setInitialTemplateFields(emptyFields, newName, newDesc);
        checkRecoverableDraft(emptyFields, newName, newDesc);
        setLoading(false);
      };

      void fetchCount();
      return;
    }

    const fetchTemplate = async () => {
      if (!templateId) return;

      const { data, error } = await supabase.from("anamnesis_form_templates").select("*").eq("id", templateId).single();

      if (error || !data) {
        toast({ title: "Formulário não encontrado", description: error?.message, variant: "destructive" });
        navigate(clinicFormsManagerPath);
        return;
      }

      const tName = sanitizeSingleLineInput(data.name, INPUT_LIMITS.formTemplateName).trim();
      const tDesc = sanitizeMultilineInput(data.description ?? "", INPUT_LIMITS.formDescription).trim();
      const tFields = castDesignLabSchema(
        isAnamnesisTemplateSchema(data.schema)
          ? sanitizeAnamnesisTemplateSchema(data.schema)
          : createDefaultTemplateSchema()
      );
      setTemplate(data);
      setTemplateName(tName);
      setTemplateDescription(tDesc);
      setInitialTemplateFields(tFields, tName, tDesc);
      checkRecoverableDraft(tFields, tName, tDesc);
      setLoading(false);
    };

    void fetchTemplate();
  }, [canManageForms, checkRecoverableDraft, clinicFormsManagerPath, clinicId, isBase, isNew, navigate, setInitialTemplateFields, templateId]);

  // Window bounds and scrolling tracking
  useEffect(() => {
    const updateDesktopMenuBounds = () => {
      if (typeof window === "undefined") return;

      const containerBottom =
        topContainerRef.current?.getBoundingClientRect().bottom ??
        headerRef.current?.getBoundingClientRect().bottom ??
        100;
      const topOffset = Math.max(Math.round(containerBottom + 12), 76);
      const maxHeight = Math.max(window.innerHeight - topOffset - 24, 240);

      setDesktopMenuTop(topOffset);
      setDesktopMenuMaxHeight(maxHeight);
      setShowFloatingSave(window.scrollY > 140);
    };

    updateDesktopMenuBounds();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && (topContainerRef.current || headerRef.current)
        ? new ResizeObserver(() => updateDesktopMenuBounds())
        : null;

    const targetNode = topContainerRef.current || headerRef.current;
    if (targetNode && resizeObserver) {
      resizeObserver.observe(targetNode);
    }

    window.addEventListener("resize", updateDesktopMenuBounds);
    window.addEventListener("scroll", updateDesktopMenuBounds, { passive: true });

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateDesktopMenuBounds);
      window.removeEventListener("scroll", updateDesktopMenuBounds);
    };
  }, []);

  // Save template
  const handleSave = async () => {
    if (isSavingRef.current) return;

    const safeTemplateName = sanitizeSingleLineInput(templateName, INPUT_LIMITS.formTemplateName).trim();
    const safeTemplateDescription = sanitizeMultilineInput(templateDescription, INPUT_LIMITS.formDescription).trim();
    const safeTemplateFields = sanitizeAnamnesisTemplateSchema(templateFields);

    if (!clinicId || !user || !safeTemplateName || safeTemplateFields.length === 0) {
      toast({
        title: "Dados incompletos",
        description: "O formulário deve ter um nome válido e conter ao menos um campo.",
        variant: "destructive",
      });
      return;
    }

    if (!isDirty && !isNew) {
      toast({
        title: "Nenhuma alteração pendente",
        description: "O formulário já está salvo na versão mais recente.",
      });
      return;
    }

    isSavingRef.current = true;
    setSaving(true);

    try {
      const compactedFields = compactAnamnesisTemplateSchema(safeTemplateFields);

      if (isBase) {
        const { error } = await supabase
          .from("clinics")
          .update({ anamnesis_base_schema: compactedFields })
          .eq("id", clinicId);

        if (error) {
          toast({ title: "Erro ao salvar bloco universal", description: error.message, variant: "destructive" });
          return;
        }

        markCleanState(safeTemplateName, safeTemplateDescription, safeTemplateFields);
        if (draftStorageKey && typeof window !== "undefined") {
          try {
            localStorage.removeItem(draftStorageKey);
          } catch (err) {
            console.warn("Falha ao limpar rascunho após salvar bloco:", err);
          }
        }
        setRecoverableDraft(null);
        toast({ title: "Bloco padrão universal salvo com sucesso!" });
        navigate(clinicFormsManagerPath);
        return;
      }

      const payload = {
        clinic_id: clinicId,
        description: safeTemplateDescription || null,
        is_active: true,
        is_system_default: false,
        name: safeTemplateName,
        schema: compactedFields,
        user_id: user.id,
      };

      const query = isNew
        ? supabase.from("anamnesis_form_templates").insert(payload).select("id").single()
        : supabase
            .from("anamnesis_form_templates")
            .update(payload)
            .eq("id", templateId!)
            .eq("clinic_id", clinicId)
            .select("id")
            .single();

      const { data, error } = await query;

      if (error) {
        toast({ title: "Erro ao salvar formulário", description: error.message, variant: "destructive" });
        return;
      }

      markCleanState(safeTemplateName, safeTemplateDescription, safeTemplateFields);
      if (draftStorageKey && typeof window !== "undefined") {
        try {
          localStorage.removeItem(draftStorageKey);
        } catch (err) {
          console.warn("Falha ao limpar rascunho após salvar formulário:", err);
        }
      }
      setRecoverableDraft(null);
      toast({ title: isNew ? "Formulário criado com sucesso!" : "Formulário atualizado com sucesso!" });
      navigate(`${clinicSettingsPath}/formularios/${data.id}`);
    } finally {
      isSavingRef.current = false;
      setSaving(false);
    }
  };

  // Import JSON template
  const handleImportDraftModel = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      if (file.size > ANAMNESIS_TEMPLATE_IMPORT_MAX_BYTES) {
        throw new Error("O arquivo excede o limite de tamanho permitido de 256KB.");
      }

      const raw = await file.text();
      const imported = parseAnamnesisTemplateExchangePayload(raw);

      if (!isBase) {
        setTemplateName(sanitizeSingleLineInput(imported.template.name, INPUT_LIMITS.formTemplateName));
        setTemplateDescription(sanitizeMultilineInput(imported.template.description, INPUT_LIMITS.formDescription));
      }

      setTemplateFields(castDesignLabSchema(imported.template.schema));

      toast({
        title: "Modelo importado no editor",
        description: isBase
          ? "A estrutura do bloco universal foi substituída no rascunho. Salve para aplicar."
          : "A ficha aberta foi substituída pelo modelo importado. Salve quando quiser aplicar.",
      });
    } catch (error) {
      toast({
        title: "Erro ao importar modelo",
        description: error instanceof Error ? error.message : "Não foi possível ler este arquivo.",
        variant: "destructive",
      });
    }
  };

  // Delete entire template
  const handleDeleteTemplate = async () => {
    if (isBase || isNew || !templateId || !clinicId) return;
    setDeletingTemplate(true);
    try {
      const { error } = await supabase
        .from("anamnesis_form_templates")
        .delete()
        .eq("id", templateId)
        .eq("clinic_id", clinicId);

      if (error) {
        toast({
          title: "Erro ao excluir formulário",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (draftStorageKey && typeof window !== "undefined") {
        try {
          localStorage.removeItem(draftStorageKey);
        } catch (err) {
          console.warn("Falha ao limpar rascunho após exclusão:", err);
        }
      }

      toast({
        title: "Formulário excluído",
        description: "O modelo foi removido com sucesso da clínica.",
      });
      navigate(clinicFormsManagerPath);
    } catch (error) {
      toast({
        title: "Erro ao excluir formulário",
        description: error instanceof Error ? error.message : "Erro inesperado ao excluir o modelo.",
        variant: "destructive",
      });
    } finally {
      setDeletingTemplate(false);
      setDeleteTemplateDialogOpen(false);
    }
  };

  // Navigation and unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty && !isSavingRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleBack = useCallback(() => {
    if (isDirty) {
      setUnsavedChangesDialogOpen(true);
    } else {
      navigate(clinicFormsManagerPath);
    }
  }, [isDirty, navigate, clinicFormsManagerPath]);

  const handleCanvasBackgroundClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target || !document.body.contains(target)) return;

    if (
      mobileInspectorOpen ||
      target.closest("[role='dialog']") ||
      target.closest("[role='listbox']") ||
      target.closest("[role='combobox']") ||
      target.closest("[data-radix-popper-content-wrapper]") ||
      target.closest("[data-radix-portal]") ||
      target.closest(".designlab-settings-mobile-nav") ||
      target.closest(".designlab-batch-actions-bar") ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("textarea")
    ) {
      return;
    }

    setSelectedFieldId(null);
  };

  return {
    isNew,
    isBase,
    loading,
    saving,
    template,
    templateName,
    setTemplateName,
    templateDescription,
    setTemplateDescription,
    templateFields,
    setTemplateFields,
    setInitialTemplateFields,
    markCleanState,
    isDirty,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    historyStack,
    historyPointer,
    draftStorageKey,
    recoverableDraft,
    setRecoverableDraft,
    checkRecoverableDraft,
    handleRestoreDraft,
    handleDiscardDraft,
    draggedFieldId,
    setDraggedFieldId,
    draggedNewFieldType,
    setDraggedNewFieldType,
    dragOverFieldId,
    setDragOverFieldId,
    dragOverPosition,
    setDragOverPosition,
    selectedFieldIds,
    setSelectedFieldIds,
    selectedFieldId,
    setSelectedFieldId,
    toggleFieldSelection,
    isAllSelected,
    isMultiSelecting,
    handleSelectAllFields,
    handleToggleSelectAll,
    handleCardTouchStart,
    handleCardTouchEnd,
    rightSidebarTab,
    setRightSidebarTab,
    inspectorTab,
    setInspectorTab,
    canvasMode,
    setCanvasMode,
    flowSidebarCollapsed,
    setFlowSidebarCollapsed,
    collapsedFlowNodeIds,
    toggleFlowNode,
    deleteSectionDialogOpen,
    setDeleteSectionDialogOpen,
    sectionToDelete,
    setSectionToDelete,
    deleteMoveTargetSectionId,
    setDeleteMoveTargetSectionId,
    testAnswers,
    setTestAnswers,
    hasTestAnswers,
    setFieldTestAnswer,
    handleClearTestAnswers,
    sectionOptions,
    groupedLayout,
    visualOrderedFields,
    fieldLimitReached,
    selectedField,
    selectedFieldAssignableContainers,
    flowIndexById,
    selectFieldAndOpenMobileInspector,
    updateField,
    moveFieldInTree,
    assignFieldToSection,
    handleAddField,
    attemptDeleteField,
    removeField,
    duplicateField,
    duplicateSelectedFields,
    encapsulateSelectedFields,
    deleteSelectedFields,
    updateSectionColor,
    handleFluxoDrop,
    handleDropOnTarget,
    executeDeleteAllSectionAndFields,
    executeMoveFieldsAndDeleteSection,
    isFieldConditionallyVisible,
    headerRef,
    topContainerRef,
    templateImportInputRef,
    guideModalOpen,
    setGuideModalOpen,
    mobileMenuOpen,
    setMobileMenuOpen,
    mobileInspectorOpen,
    setMobileInspectorOpen,
    desktopMenuTop,
    desktopMenuMaxHeight,
    showFloatingSave,
    deleteTemplateDialogOpen,
    setDeleteTemplateDialogOpen,
    deletingTemplate,
    unsavedChangesDialogOpen,
    setUnsavedChangesDialogOpen,
    handleSave,
    handleImportDraftModel,
    handleDeleteTemplate,
    handleBack,
    handleCanvasBackgroundClick,
    clinicFormsManagerPath,
  };
}
