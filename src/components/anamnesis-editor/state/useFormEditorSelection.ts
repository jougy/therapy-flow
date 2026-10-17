import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { DesignLabTemplateSchema } from "../types";

export function useFormEditorSelection(templateFields: DesignLabTemplateSchema) {
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

  return {
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
  };
}
