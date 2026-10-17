import { useCallback, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { castDesignLabSchema, type DesignLabAnamnesisField, type DesignLabTemplateSchema } from "../types";

export function useFormEditorHistory() {
  const [templateFields, _setTemplateFields] = useState<DesignLabTemplateSchema>(() => []);
  const [historyStack, setHistoryStack] = useState<DesignLabAnamnesisField[][]>(() => [[]]);
  const [historyPointer, setHistoryPointer] = useState<number>(0);
  const isHistoryNavigatingRef = useRef(false);

  const canUndo = historyPointer > 0;
  const canRedo = historyPointer < historyStack.length - 1;

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
    (
      fields: DesignLabTemplateSchema,
      initialName?: string,
      initialDesc?: string,
      onCleanState?: (name: string, description: string, fields: DesignLabTemplateSchema) => void
    ) => {
      const sanitized = castDesignLabSchema(fields);
      isHistoryNavigatingRef.current = true;
      _setTemplateFields(sanitized);
      setHistoryStack([JSON.parse(JSON.stringify(sanitized))]);
      setHistoryPointer(0);
      if (initialName !== undefined && initialDesc !== undefined && onCleanState) {
        onCleanState(initialName, initialDesc, sanitized);
      }
      setTimeout(() => {
        isHistoryNavigatingRef.current = false;
      }, 50);
    },
    []
  );

  const resetHistoryTo = useCallback((fields: DesignLabTemplateSchema) => {
    const sanitized = castDesignLabSchema(fields);
    _setTemplateFields(sanitized);
    setHistoryStack([JSON.parse(JSON.stringify(sanitized))]);
    setHistoryPointer(0);
  }, []);

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

  return {
    templateFields,
    setTemplateFields,
    setInitialTemplateFields,
    resetHistoryTo,
    historyStack,
    historyPointer,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    isHistoryNavigatingRef,
  };
}
