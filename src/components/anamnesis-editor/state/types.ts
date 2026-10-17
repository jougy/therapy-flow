import type { DesignLabAnamnesisField, DesignLabTemplateSchema } from "../types";

export interface RecoverableDraft {
  name: string;
  description: string;
  fields: DesignLabTemplateSchema;
  savedAt: string;
}

export interface SafeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export type EncapsulateContainerType = "section" | "horizontal_section" | "radar_section";

export interface DuplicateFieldResult {
  nextFields: DesignLabTemplateSchema;
  duplicatedParent: DesignLabAnamnesisField;
  childrenCount: number;
}
