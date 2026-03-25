export type AnamnesisFieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "checklist"
  | "multiple_choice"
  | "select"
  | "slider"
  | "section"
  | "section_selector";

export interface AnamnesisFieldOption {
  id: string;
  label: string;
  description?: string;
}

export interface AnamnesisField {
  id: string;
  label: string;
  type: AnamnesisFieldType;
  groupKey?: string | null;
  helpText?: string;
  placeholder?: string;
  required?: boolean;
  showInPatientList?: boolean;
  options?: AnamnesisFieldOption[];
  min?: number;
  max?: number;
  sectionKey?: string | null;
  systemKey?: "queixa" | "sintomas" | "pain_score" | "complexity_score" | "observacoes";
}

export type AnamnesisTemplateSchema = AnamnesisField[];
export type AnamnesisFormResponse = Record<string, string | number | string[] | boolean | null>;

export const DEFAULT_ANAMNESIS_TEMPLATE_SCHEMA: AnamnesisTemplateSchema = [
  {
    id: "section_main",
    label: "Anamnese inicial",
    type: "section",
    helpText: "Campos obrigatórios da primeira parte da anamnese.",
  },
  {
    groupKey: "section_main",
    id: "queixa",
    label: "Queixa principal",
    type: "long_text",
    required: true,
    showInPatientList: true,
    systemKey: "queixa",
  },
  {
    groupKey: "section_main",
    id: "sintomas",
    label: "Sintomas",
    type: "long_text",
    showInPatientList: true,
    systemKey: "sintomas",
  },
  {
    groupKey: "section_main",
    id: "pain_score",
    label: "Nota da dor",
    type: "slider",
    min: 0,
    max: 10,
    showInPatientList: false,
    systemKey: "pain_score",
  },
  {
    groupKey: "section_main",
    id: "complexity_score",
    label: "Nota de complexidade",
    type: "slider",
    min: 0,
    max: 10,
    showInPatientList: false,
    systemKey: "complexity_score",
  },
  {
    groupKey: "section_main",
    id: "observacoes",
    label: "Observações",
    type: "long_text",
    showInPatientList: true,
    systemKey: "observacoes",
  },
];

export const ANAMNESIS_FIELD_LIBRARY: Array<{ type: AnamnesisFieldType; label: string }> = [
  { type: "short_text", label: "Texto curto" },
  { type: "long_text", label: "Texto longo" },
  { type: "number", label: "Apenas números" },
  { type: "checklist", label: "Checklist" },
  { type: "multiple_choice", label: "Múltipla escolha" },
  { type: "select", label: "Droplist" },
  { type: "slider", label: "Slidebar" },
  { type: "section", label: "Seção" },
  { type: "section_selector", label: "Seletor de seções" },
];

export const createFieldOption = (label: string, index: number): AnamnesisFieldOption => ({
  id: `option_${index + 1}`,
  label,
});

export const createDefaultTemplateSchema = () =>
  DEFAULT_ANAMNESIS_TEMPLATE_SCHEMA.map((field, index) => ({
    ...field,
    id: `${field.id}_${index}`,
  }));

export const createAnamnesisField = (type: AnamnesisFieldType, index: number): AnamnesisField => {
  const baseField: AnamnesisField = {
    id: `field_${Date.now()}_${index}`,
    label: `Novo campo ${index + 1}`,
    type,
    required: false,
    groupKey: null,
    sectionKey: null,
  };

  if (type === "checklist" || type === "multiple_choice" || type === "select") {
    return {
      ...baseField,
      options: [createFieldOption("Opção 1", 0), createFieldOption("Opção 2", 1)],
    };
  }

  if (type === "slider") {
    return {
      ...baseField,
      min: 0,
      max: 10,
    };
  }

  if (type === "section_selector") {
    return {
      ...baseField,
      label: "Assuntos do atendimento",
      options: [createFieldOption("Tema 1", 0), createFieldOption("Tema 2", 1)],
    };
  }

  if (type === "section") {
    return {
      ...baseField,
      label: "Nova seção",
      helpText: "Texto introdutório da seção.",
    };
  }

  return baseField;
};

export const normalizeOptions = (raw: string) =>
  raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label, index) => createFieldOption(label, index));

export const getSectionSelectorOptions = (fields: AnamnesisTemplateSchema) =>
  fields
    .filter((field) => field.type === "section_selector")
    .flatMap((field) => field.options ?? []);

export const getVisibleTemplateFields = (
  fields: AnamnesisTemplateSchema,
  response: AnamnesisFormResponse
) => {
  const activeSections = new Set(
    fields
      .filter((field) => field.type === "section_selector")
      .flatMap((field) => {
        const value = response[field.id];
        return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
      })
  );

  return fields.filter((field) => !field.sectionKey || activeSections.has(field.sectionKey));
};

export const countTemplateQuestionFields = (fields: AnamnesisTemplateSchema) =>
  fields.filter((field) => field.type !== "section").length;

export const countTemplateSections = (fields: AnamnesisTemplateSchema) =>
  fields.filter((field) => field.type === "section").length;

export const isAnamnesisTemplateSchema = (value: unknown): value is AnamnesisTemplateSchema =>
  Array.isArray(value);

export interface TemplateLayoutSection {
  field: AnamnesisField;
  items: AnamnesisField[];
  type: "section";
}

export interface TemplateLayoutField {
  field: AnamnesisField;
  type: "field";
}

export type TemplateLayoutItem = TemplateLayoutField | TemplateLayoutSection;

export const buildTemplateLayout = (fields: AnamnesisTemplateSchema): TemplateLayoutItem[] => {
  const sectionIds = new Set(fields.filter((field) => field.type === "section").map((field) => field.id));

  return fields.flatMap((field) => {
    if (field.type === "section") {
      return [{
        field,
        items: fields.filter((item) => item.groupKey === field.id),
        type: "section" as const,
      }];
    }

    if (field.groupKey && sectionIds.has(field.groupKey)) {
      return [];
    }

    return [{
      field,
      type: "field" as const,
    }];
  });
};
