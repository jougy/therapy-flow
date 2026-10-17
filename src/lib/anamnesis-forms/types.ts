import { INPUT_LIMITS } from "@/lib/input-security";
import type {
  ClinicalAnnotationShape,
  ClinicalImageAnnotationValue,
} from "@/lib/image-annotation-vector";

export type AnamnesisFieldType =
  | "short_text"
  | "long_text"
  | "date"
  | "number"
  | "checklist"
  | "multiple_choice"
  | "select"
  | "table"
  | "slider"
  | "tags"
  | "simple_list"
  | "section"
  | "horizontal_section"
  | "section_selector"
  | "radar_section"
  | "address_block"
  | "calculated"
  | "image_annotation";

export interface CalculatedFieldVariable {
  id: string;
  name: string; // Ex: "A", "B"
  label: string; // Ex: "Peso", "Altura"
  unit?: string; // Ex: "kg", "cm"
  sourceFieldId?: string; // Se preenchido, puxa o valor calculado de outro campo 'calculated'
}

export interface CalculatedFieldRange {
  id: string;
  min?: number;
  max?: number;
  label: string; // Ex: "Normal", "Sobrepeso"
  color: string; // Hex ou nome: "blue", "green", "orange", "red", "purple"
}

export interface CalculatedFieldOutput {
  id: string;
  name: string; // Ex: "IMC", "Taxa Metabólica"
  formula: string; // Ex: "A / ((B / 100) ^ 2)"
  unit?: string; // Ex: "kg/m²"
  precision?: number; // 0 a 4 casas decimais
}

export interface CalculatedFieldConfig {
  variables: CalculatedFieldVariable[];
  outputs: CalculatedFieldOutput[];
  ranges?: CalculatedFieldRange[];
}

export interface AnamnesisFieldOption {
  id: string;
  label: string;
  description?: string;
  row?: number;
  color?: string;
  colorSlotId?: string | null;
}

export interface AddressBlockValue {
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  number?: string;
  complement?: string;
  locationType?: "clinic" | "home_visit" | "custom";
  clinicId?: string | null;
  clinicName?: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  capturedAt?: string | null;
}

export interface AnamnesisTagItem {
  id: string;
  label: string;
  color?: string;
  colorSlotId?: string | null;
}

export type HorizontalSectionDisplayMode = "scroll" | "stepper_mobile" | "stepper_always";
export type HorizontalDisplayMode = HorizontalSectionDisplayMode;
export const HORIZONTAL_DISPLAY_MODES = new Set<HorizontalSectionDisplayMode>([
  "scroll",
  "stepper_mobile",
  "stepper_always",
]);

export interface AnamnesisField {
  id: string;
  label: string;
  type: AnamnesisFieldType;
  groupKey?: string | null;
  helpText?: string;
  placeholder?: string;
  addButtonLabel?: string;
  includeInGlobalDashboard?: boolean;
  enableFilter?: boolean;
  enableGrouping?: boolean;
  required?: boolean;
  showInPatientList?: boolean;
  options?: AnamnesisFieldOption[];
  min?: number;
  max?: number;
  sectionKey?: string | null;
  systemKey?: "queixa" | "sintomas" | "pain_score" | "complexity_score" | "observacoes";
  sliderStep?: number;
  sliderMinLabel?: string;
  sliderMaxLabel?: string;
  columnSpan?: "auto" | "1/4" | "1/3" | "1/2" | "2/3" | "full";
  accentColor?: string;
  accentAlpha?: number;
  tagMode?: "multiple" | "single";
  allowCustomTags?: boolean;
  calculatedConfig?: CalculatedFieldConfig;
  horizontalDisplayMode?: HorizontalSectionDisplayMode;
}

export interface CalculatedFieldResponseValue {
  inputs?: Record<string, number | null>;
  outputs?: Record<string, number | null>;
}

export type AnamnesisTemplateSchema = AnamnesisField[];
export type AnamnesisTableRow = Record<string, string>;
export type AnamnesisFormValue =
  | string
  | number
  | string[]
  | boolean
  | AnamnesisTableRow[]
  | AddressBlockValue
  | AnamnesisTagItem[]
  | CalculatedFieldResponseValue
  | ClinicalImageAnnotationValue
  | null;
export type AnamnesisFormResponse = Record<string, AnamnesisFormValue>;

export const hasMeaningfulFormValue = (value: AnamnesisFormValue | undefined): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return true;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "object") {
    return Object.values(value).some((item) => hasMeaningfulFormValue(item as AnamnesisFormValue));
  }

  return false;
};

export type AnamnesisTemplateExchangeKind = "base" | "template";

export interface AnamnesisTemplateExchangePayload {
  exportedAt: string;
  format: "pronto-health-fisio.anamnesis-template";
  kind: AnamnesisTemplateExchangeKind;
  template: {
    description: string;
    name: string;
    schema: AnamnesisTemplateSchema;
  };
  version: 1;
}

export const ANAMNESIS_SCHEMA_FIELD_LIMIT = 200;
export const ANAMNESIS_OPTION_LIMIT = 100;
export const ANAMNESIS_TEMPLATE_IMPORT_MAX_BYTES = 256 * 1024;
export const ANAMNESIS_RAW_OPTIONS_INPUT_LIMIT = 12_000;
export const ANAMNESIS_SLIDER_MIN = 0;
export const ANAMNESIS_SLIDER_MAX = 100;
export const ANAMNESIS_RESPONSE_ENTRY_LIMIT = 200;
export const ANAMNESIS_TABLE_ROW_LIMIT = 50;
export const ANAMNESIS_RESPONSE_TEXT_LIMIT = INPUT_LIMITS.clinicalLongText;

export const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);


export const ANAMNESIS_FIELD_LIBRARY: Array<{ type: AnamnesisFieldType; label: string }> = [
  { type: "short_text", label: "Texto curto" },
  { type: "long_text", label: "Texto longo" },
  { type: "simple_list", label: "Lista de itens" },
  { type: "date", label: "Data" },
  { type: "number", label: "Apenas números" },
  { type: "checklist", label: "Checklist" },
  { type: "multiple_choice", label: "Múltipla escolha" },
  { type: "select", label: "Droplist" },
  { type: "tags", label: "Campo de tags" },
  { type: "table", label: "Tabela" },
  { type: "slider", label: "Slidebar" },
  { type: "address_block", label: "Bloco de Endereço" },
  { type: "section", label: "Seção" },
  { type: "horizontal_section", label: "Etapas Horizontais" },
  { type: "section_selector", label: "Seletor de seções" },
  { type: "radar_section", label: "Polígono de Status" },
  { type: "calculated", label: "Campos calculados" },
  { type: "image_annotation", label: "Anotador de Imagem" },
];

export const ANAMNESIS_FIELD_TYPES = new Set<AnamnesisFieldType>(ANAMNESIS_FIELD_LIBRARY.map((field) => field.type));

export const isContainerFieldType = (type: AnamnesisFieldType) =>
  type === "section" || type === "horizontal_section" || type === "section_selector" || type === "radar_section";
export const isContainerField = (field: AnamnesisField) => isContainerFieldType(field.type);


export const getFieldById = (fields: AnamnesisTemplateSchema, fieldId: string | null | undefined) =>
  fields.find((field) => field.id === fieldId) ?? null;

export const canContainerAcceptChild = (container: AnamnesisField, child: AnamnesisField) => {
  if (!isContainerField(container)) {
    return false;
  }

  if (child.id === container.id) {
    return false;
  }

  // A section_selector can NEVER be inside anything (must always be top-level)
  if (child.type === "section_selector") {
    return false;
  }

  // A horizontal_section or radar_section cannot contain other containers
  if ((container.type === "horizontal_section" || container.type === "radar_section") && isContainerField(child)) {
    return false;
  }

  // A section_selector accepts sections, horizontal_sections, radar_sections, and standard fields
  if (container.type === "section_selector") {
    return true;
  }

  return true;
};

export const isDescendantOf = (
  fields: AnamnesisTemplateSchema,
  fieldId: string,
  potentialAncestorId: string,
  fieldMap?: Map<string, AnamnesisField>,
): boolean => {
  const getField = (id: string | null | undefined): AnamnesisField | null => {
    if (!id) return null;
    if (fieldMap) return fieldMap.get(id) ?? null;
    return getFieldById(fields, id);
  };

  let current = getField(fieldId);
  const visited = new Set<string>();

  while (current?.groupKey) {
    if (visited.has(current.id)) {
      break;
    }
    visited.add(current.id);
    if (current.groupKey === potentialAncestorId) {
      return true;
    }

    current = getField(current.groupKey);
  }

  return false;
};


export interface TemplateLayoutSection {
  field: AnamnesisField;
  items: TemplateLayoutItem[];
  type: "section" | "horizontal_section" | "section_selector" | "radar_section";
}

export interface TemplateLayoutField {
  field: AnamnesisField;
  type: "field";
}

export type TemplateLayoutItem = TemplateLayoutField | TemplateLayoutSection;

