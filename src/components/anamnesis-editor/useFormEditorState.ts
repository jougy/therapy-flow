import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  ANAMNESIS_SCHEMA_FIELD_LIMIT,
  buildTemplateLayout,
  getAssignableContainerFields,
  getSectionSelectorOptions,
  sanitizeAnamnesisTemplateSchema,
  type AnamnesisField,
} from "@/lib/anamnesis-forms";
import {
  castDesignLabLayout,
  flattenLayoutItems,
  type DesignLabAnamnesisField,
  type DesignLabTemplateSchema,
} from "./types";
import {
  exportDraftModelAsPluriform,
  importDraftModelFromFile,
  isFieldConditionallyVisible as isFieldConditionallyVisibleLogic,
  useFormEditorDraft,
  useFormEditorFieldActions,
  useFormEditorHistory,
  useFormEditorPersistence,
  useFormEditorSelection,
} from "./state";

export * from "./state";

export function useFormEditorState() {
  const { clinicKey, templateId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { can, clinic, clinicId, isPlatformOwner, user } = useAuth();

  const isPlatformMode = location.pathname.startsWith("/platform");
  const routeClinicKey = clinicKey ?? clinic?.route_key;
  const clinicSettingsPath = routeClinicKey ? `/clinica/${routeClinicKey}/configuracoes` : "/configuracoes";
  const clinicFormsManagerPath = isPlatformMode ? "/platform/formularios" : `${clinicSettingsPath}?secao=forms`;
  const isNew = templateId === "novo";
  const isBase = templateId === "base" || templateId === "universal";
  const canManageForms = isPlatformMode ? Boolean(isPlatformOwner) : can("forms.manage");

  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
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
  const [unsavedChangesDialogOpen, setUnsavedChangesDialogOpen] = useState(false);

  const {
    templateFields,
    setTemplateFields,
    setInitialTemplateFields: rawSetInitialTemplateFields,
    resetHistoryTo,
    historyStack,
    historyPointer,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
  } = useFormEditorHistory();

  const markCleanState = useCallback((name: string, description: string, fields: DesignLabTemplateSchema) => {
    initialSnapshotRef.current = {
      name: name.trim(),
      description: description.trim(),
      fieldsJson: JSON.stringify(sanitizeAnamnesisTemplateSchema(fields)),
    };
  }, []);

  const setInitialTemplateFields = useCallback(
    (fields: DesignLabTemplateSchema, initialName?: string, initialDesc?: string) => {
      rawSetInitialTemplateFields(fields, initialName, initialDesc, markCleanState);
    },
    [markCleanState, rawSetInitialTemplateFields]
  );

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

  // Drag & Drop
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [draggedNewFieldType, setDraggedNewFieldType] = useState<AnamnesisField["type"] | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "inside" | "after" | null>(null);

  // Selection
  const {
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
    isLongPressActiveRef,
  } = useFormEditorSelection(templateFields);

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
    [isLongPressActiveRef, selectedFieldIds, toggleFieldSelection, setSelectedFieldId]
  );

  // Draft Management
  const {
    draftStorageKey,
    recoverableDraft,
    setRecoverableDraft,
    checkRecoverableDraft,
    handleRestoreDraft,
    handleDiscardDraft,
    clearDraft,
  } = useFormEditorDraft({
    clinicId,
    isPlatformMode,
    templateId,
    isDirty,
    saving: false,
    templateName,
    templateDescription,
    templateFields,
    onRestore: (draft) => {
      setTemplateName(draft.name);
      setTemplateDescription(draft.description);
      resetHistoryTo(draft.fields);
    },
  });

  // Persistence (load, save, delete)
  const {
    loading,
    saving,
    template,
    deleteTemplateDialogOpen,
    setDeleteTemplateDialogOpen,
    deletingTemplate,
    handleSave,
    handleDeleteTemplate,
    isSavingRef,
  } = useFormEditorPersistence({
    clinicId,
    clinicSettingsPath,
    clinicFormsManagerPath,
    isPlatformMode,
    isNew,
    isBase,
    templateId,
    canManageForms,
    user,
    templateName,
    setTemplateName,
    templateDescription,
    setTemplateDescription,
    templateFields,
    setInitialTemplateFields,
    checkRecoverableDraft,
    clearDraft,
    markCleanState,
    isDirty,
  });

  // Field manipulation operations
  const {
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
    handleFluxoDrop,
    handleDropOnTarget,
  } = useFormEditorFieldActions({
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
  });

  const isFieldConditionallyVisible = useCallback(
    (field: AnamnesisField) => {
      return isFieldConditionallyVisibleLogic(field, templateFields, testAnswers);
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

  // Import .pluriform / JSON template
  const handleImportDraftModel = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      const imported = await importDraftModelFromFile(file);

      if (!isBase) {
        setTemplateName(imported.name);
        setTemplateDescription(imported.description);
      }

      setTemplateFields(imported.fields);

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

  // Export current draft as .pluriform
  const handleExportDraftModel = async () => {
    try {
      await exportDraftModelAsPluriform({
        templateDescription,
        templateFields,
        templateName,
        isBase,
      });

      toast({
        title: "Modelo exportado com sucesso",
        description: "O arquivo .pluriform protegido foi gerado.",
      });
    } catch (err) {
      toast({
        title: "Erro na exportação",
        description: err instanceof Error ? err.message : "Falha ao gerar arquivo .pluriform.",
        variant: "destructive",
      });
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
  }, [isDirty, isSavingRef]);

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
    handleExportDraftModel,
    handleDeleteTemplate,
    handleBack,
    handleCanvasBackgroundClick,
    clinicFormsManagerPath,
    clinicBasePath: routeClinicKey ? `/clinica/${routeClinicKey}` : "",
    isPlatformMode,
    canManageForms,
  };
}
