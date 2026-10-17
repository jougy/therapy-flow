import { isAnamnesisTemplateSchema, sanitizeAnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import { castDesignLabSchema, type DesignLabTemplateSchema } from "../types";
import type { RecoverableDraft, SafeStorage } from "./types";

export function createSafeStorage(): SafeStorage {
  return {
    getItem: (key: string): string | null => {
      try {
        if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.getItem === "function") {
          return window.localStorage.getItem(key);
        }
      } catch {
        // Ignore storage access errors
      }
      return null;
    },
    setItem: (key: string, value: string): void => {
      try {
        if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.setItem === "function") {
          window.localStorage.setItem(key, value);
        }
      } catch {
        // Ignore storage write errors
      }
    },
    removeItem: (key: string): void => {
      try {
        if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.removeItem === "function") {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Ignore storage removal errors
      }
    },
  };
}

export function getDraftStorageKey(
  clinicId: string | null | undefined,
  isPlatformMode: boolean,
  templateId: string | undefined
): string | null {
  if (isPlatformMode) {
    return `pluri_platform_form_draft_${templateId || "novo"}`;
  }
  if (!clinicId) return null;
  return `pluri_anamnesis_draft_${clinicId}_${templateId || "novo"}`;
}

export function parseRecoverableDraft(
  rawDraft: string | null,
  loadedFields: DesignLabTemplateSchema,
  loadedName: string,
  loadedDesc: string
): { draft: RecoverableDraft | null; shouldPurge: boolean } {
  if (!rawDraft) return { draft: null, shouldPurge: false };
  try {
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
        return {
          draft: {
            name: draftName || loadedName,
            description: draftDesc || loadedDesc,
            fields: castDesignLabSchema(parsed.fields),
            savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
          },
          shouldPurge: false,
        };
      } else {
        return { draft: null, shouldPurge: true };
      }
    }
  } catch (err) {
    console.warn("Falha ao analisar rascunho recuperável:", err);
  }
  return { draft: null, shouldPurge: false };
}
