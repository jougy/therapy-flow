export type AnamnesisFieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "checklist"
  | "multiple_choice"
  | "select"
  | "slider"
  | "section"
  | "horizontal_section"
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
  { type: "horizontal_section", label: "Seção horizontal" },
  { type: "section_selector", label: "Seletor de seções" },
];

export const isContainerFieldType = (type: AnamnesisFieldType) => type === "section" || type === "horizontal_section";
export const isContainerField = (field: AnamnesisField) => isContainerFieldType(field.type);

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

  if (type === "section" || type === "horizontal_section") {
    return {
      ...baseField,
      label: type === "horizontal_section" ? "Nova seção horizontal" : "Nova seção",
      helpText: type === "horizontal_section" ? "Agrupe campos lado a lado com rolagem horizontal." : "Texto introdutório da seção.",
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
  fields.filter((field) => !isContainerField(field)).length;

export const countTemplateSections = (fields: AnamnesisTemplateSchema) =>
  fields.filter((field) => isContainerField(field)).length;

export const isAnamnesisTemplateSchema = (value: unknown): value is AnamnesisTemplateSchema =>
  Array.isArray(value);

export interface TemplateLayoutSection {
  field: AnamnesisField;
  items: TemplateLayoutItem[];
  type: "section" | "horizontal_section";
}

export interface TemplateLayoutField {
  field: AnamnesisField;
  type: "field";
}

export type TemplateLayoutItem = TemplateLayoutField | TemplateLayoutSection;

const getFieldById = (fields: AnamnesisTemplateSchema, fieldId: string | null | undefined) =>
  fields.find((field) => field.id === fieldId) ?? null;

const canContainerAcceptChild = (container: AnamnesisField, child: AnamnesisField) => {
  if (!isContainerField(container)) {
    return false;
  }

  if (container.type === "horizontal_section" && isContainerField(child)) {
    return false;
  }

  if (child.id === container.id) {
    return false;
  }

  return true;
};

const isDescendantOf = (
  fields: AnamnesisTemplateSchema,
  fieldId: string,
  potentialAncestorId: string,
): boolean => {
  let current = getFieldById(fields, fieldId);

  while (current?.groupKey) {
    if (current.groupKey === potentialAncestorId) {
      return true;
    }

    current = getFieldById(fields, current.groupKey);
  }

  return false;
};

export const getAssignableContainerFields = (fields: AnamnesisTemplateSchema, childFieldId: string) => {
  const child = getFieldById(fields, childFieldId);

  if (!child) {
    return [];
  }

  return fields.filter((field) => {
    if (!isContainerField(field) || field.id === child.id) {
      return false;
    }

    if (isDescendantOf(fields, field.id, child.id)) {
      return false;
    }

    if (isContainerField(child)) {
      return field.type === "section";
    }

    return canContainerAcceptChild(field, child);
  });
};

const toTemplateLayoutItem = (
  field: AnamnesisField,
  fields: AnamnesisTemplateSchema,
): TemplateLayoutItem => {
  if (!isContainerField(field)) {
    return {
      field,
      type: "field",
    };
  }

  return {
    field,
    items: fields
      .filter((child) => child.groupKey === field.id && canContainerAcceptChild(field, child))
      .map((child) => toTemplateLayoutItem(child, fields)),
    type: field.type,
  };
};

export const buildTemplateLayout = (fields: AnamnesisTemplateSchema): TemplateLayoutItem[] => {
  return fields.flatMap((field) => {
    const parent = getFieldById(fields, field.groupKey);

    if (parent && canContainerAcceptChild(parent, field)) {
      return [];
    }

    return [toTemplateLayoutItem(field, fields)];
  });
};
