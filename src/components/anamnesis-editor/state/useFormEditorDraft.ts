import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { DesignLabTemplateSchema } from "../types";
import { createSafeStorage, getDraftStorageKey, parseRecoverableDraft } from "./editorDraftStorage";
import type { RecoverableDraft } from "./types";

export interface UseFormEditorDraftParams {
  clinicId: string | null | undefined;
  isPlatformMode: boolean;
  templateId: string | undefined;
  isDirty: boolean;
  saving: boolean;
  templateName: string;
  templateDescription: string;
  templateFields: DesignLabTemplateSchema;
  onRestore: (draft: RecoverableDraft) => void;
}

export function useFormEditorDraft({
  clinicId,
  isPlatformMode,
  templateId,
  isDirty,
  saving,
  templateName,
  templateDescription,
  templateFields,
  onRestore,
}: UseFormEditorDraftParams) {
  const safeStorage = useMemo(() => createSafeStorage(), []);

  const draftStorageKey = useMemo(() => {
    return getDraftStorageKey(clinicId, isPlatformMode, templateId);
  }, [clinicId, isPlatformMode, templateId]);

  const [recoverableDraft, setRecoverableDraft] = useState<RecoverableDraft | null>(null);

  const checkRecoverableDraft = useCallback(
    (loadedFields: DesignLabTemplateSchema, loadedName: string, loadedDesc: string) => {
      if (!draftStorageKey) return;
      const rawDraft = safeStorage.getItem(draftStorageKey);
      const { draft, shouldPurge } = parseRecoverableDraft(rawDraft, loadedFields, loadedName, loadedDesc);
      if (draft) {
        setRecoverableDraft(draft);
      } else if (shouldPurge) {
        safeStorage.removeItem(draftStorageKey);
      }
    },
    [draftStorageKey, safeStorage]
  );

  useEffect(() => {
    if (!draftStorageKey || !isDirty || saving) return;

    const timer = window.setTimeout(() => {
      try {
        const payload = {
          name: templateName,
          description: templateDescription,
          fields: templateFields,
          savedAt: new Date().toISOString(),
        };
        safeStorage.setItem(draftStorageKey, JSON.stringify(payload));
      } catch (err) {
        console.warn("Falha ao salvar rascunho local:", err);
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [draftStorageKey, isDirty, safeStorage, saving, templateName, templateDescription, templateFields]);

  const handleRestoreDraft = useCallback(() => {
    if (!recoverableDraft) return;
    onRestore(recoverableDraft);
    setRecoverableDraft(null);
    toast({
      title: "Rascunho restaurado",
      description: "As alterações locais foram carregadas no editor com sucesso.",
    });
  }, [onRestore, recoverableDraft]);

  const handleDiscardDraft = useCallback(() => {
    if (draftStorageKey) {
      safeStorage.removeItem(draftStorageKey);
    }
    setRecoverableDraft(null);
    toast({
      title: "Rascunho descartado",
      description: "As alterações locais não salvas foram descartadas.",
    });
  }, [draftStorageKey, safeStorage]);

  const clearDraft = useCallback(() => {
    if (draftStorageKey) {
      safeStorage.removeItem(draftStorageKey);
    }
    setRecoverableDraft(null);
  }, [draftStorageKey, safeStorage]);

  return {
    safeStorage,
    draftStorageKey,
    recoverableDraft,
    setRecoverableDraft,
    checkRecoverableDraft,
    handleRestoreDraft,
    handleDiscardDraft,
    clearDraft,
  };
}
