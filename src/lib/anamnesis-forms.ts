import { INPUT_LIMITS, sanitizeMultilineInput, sanitizeSingleLineInput } from "@/lib/input-security";

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
  | "section"
  | "horizontal_section"
  | "section_selector";

export interface AnamnesisFieldOption {
  id: string;
  label: string;
  description?: string;
  row?: number;
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
export type AnamnesisTableRow = Record<string, string>;
export type AnamnesisFormValue = string | number | string[] | boolean | AnamnesisTableRow[] | null;
export type AnamnesisFormResponse = Record<string, AnamnesisFormValue>;
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
const ANAMNESIS_RESPONSE_ENTRY_LIMIT = 200;
const ANAMNESIS_TABLE_ROW_LIMIT = 50;
const ANAMNESIS_RESPONSE_TEXT_LIMIT = INPUT_LIMITS.clinicalLongText;
const ANAMNESIS_SYSTEM_KEYS = new Set<NonNullable<AnamnesisField["systemKey"]>>([
  "complexity_score",
  "observacoes",
  "pain_score",
  "queixa",
  "sintomas",
]);

const sanitizeId = (value: string, fallback: string) =>
  sanitizeSingleLineInput(value || fallback, INPUT_LIMITS.id).trim() || fallback;

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const getStringValue = (value: unknown) => (typeof value === "string" ? value : "");
const getOptionalStringValue = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);
const makeUniqueId = (baseId: string, usedIds: Set<string>, fallback: string) => {
  const sanitizedBase = sanitizeId(baseId, fallback);
  let candidate = sanitizedBase;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = sanitizeId(`${sanitizedBase}_${suffix}`, `${fallback}_${suffix}`);
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const normalizeAnamnesisSliderRange = (
  min: unknown,
  max: unknown
): Pick<AnamnesisField, "max" | "min"> => {
  const rawMin = typeof min === "number" && Number.isFinite(min) ? min : ANAMNESIS_SLIDER_MIN;
  const rawMax = typeof max === "number" && Number.isFinite(max) ? max : 10;
  const normalizedMin = clamp(Math.round(rawMin), ANAMNESIS_SLIDER_MIN, ANAMNESIS_SLIDER_MAX - 1);
  const normalizedMax = clamp(Math.round(rawMax), normalizedMin + 1, ANAMNESIS_SLIDER_MAX);

  return { min: normalizedMin, max: normalizedMax };
};

const sanitizeOption = (option: unknown, index: number, usedIds: Set<string>): AnamnesisFieldOption => {
  const source = isPlainRecord(option) ? option : {};
  const description = getOptionalStringValue(source.description);

  return {
    id: makeUniqueId(getStringValue(source.id), usedIds, `option_${index + 1}`),
    label: sanitizeSingleLineInput(getStringValue(source.label), INPUT_LIMITS.formOptionLabel).trim() || `Opção ${index + 1}`,
    ...(description ? { description: sanitizeMultilineInput(description, INPUT_LIMITS.formHelpText).trim() } : {}),
    row: Number.isFinite(source.row) ? clamp(Math.round(Number(source.row)), 0, 99) : 0,
  };
};

const fieldNeedsOptions = (type: AnamnesisFieldType) =>
  type === "checklist" ||
  type === "multiple_choice" ||
  type === "select" ||
  type === "table" ||
  type === "section_selector";

export const sanitizeAnamnesisTemplateSchema = (schema: unknown): AnamnesisTemplateSchema => {
  if (!Array.isArray(schema)) {
    return [];
  }

  const usedFieldIds = new Set<string>();
  const fields = schema
    .slice(0, ANAMNESIS_SCHEMA_FIELD_LIMIT)
    .map((rawField, index): AnamnesisField => {
      const source = isPlainRecord(rawField) ? rawField : {};
      const rawType = getStringValue(source.type);
      const type = ANAMNESIS_FIELD_TYPES.has(rawType as AnamnesisFieldType)
        ? (rawType as AnamnesisFieldType)
        : "short_text";
      const fieldId = makeUniqueId(getStringValue(source.id), usedFieldIds, `field_${index + 1}`);
      const rawOptions = Array.isArray(source.options) ? source.options : [];
      const optionIds = new Set<string>();
      const options = fieldNeedsOptions(type)
        ? (rawOptions.length > 0 ? rawOptions : [createFieldOption("Opção 1", 0)])
            .slice(0, ANAMNESIS_OPTION_LIMIT)
            .map((option, optionIndex) => sanitizeOption(option, optionIndex, optionIds))
        : undefined;
      const sliderRange = type === "slider" ? normalizeAnamnesisSliderRange(source.min, source.max) : {};
      const systemKey =
        typeof source.systemKey === "string" && ANAMNESIS_SYSTEM_KEYS.has(source.systemKey as NonNullable<AnamnesisField["systemKey"]>)
          ? (source.systemKey as NonNullable<AnamnesisField["systemKey"]>)
          : undefined;

      return {
        id: fieldId,
        label: sanitizeSingleLineInput(getStringValue(source.label), INPUT_LIMITS.formFieldLabel).trim() || `Campo ${index + 1}`,
        type,
        groupKey: getOptionalStringValue(source.groupKey) ? sanitizeId(getStringValue(source.groupKey), "") || null : null,
        helpText: getOptionalStringValue(source.helpText)
          ? sanitizeMultilineInput(getStringValue(source.helpText), INPUT_LIMITS.formHelpText).trim()
          : undefined,
        placeholder: getOptionalStringValue(source.placeholder)
          ? sanitizeSingleLineInput(getStringValue(source.placeholder), INPUT_LIMITS.formPlaceholder).trim()
          : undefined,
        required: source.required === true,
        showInPatientList: source.showInPatientList === true,
        ...(options ? { options } : {}),
        ...sliderRange,
        sectionKey: getOptionalStringValue(source.sectionKey) ? sanitizeId(getStringValue(source.sectionKey), "") || null : null,
        ...(systemKey ? { systemKey } : {}),
      };
    });

  const fieldIds = new Set(fields.map((field) => field.id));
  const selectorOptionIds = new Set(
    fields
      .filter((field) => field.type === "section_selector")
      .flatMap((field) => field.options ?? [])
      .map((option) => option.id)
  );

  return fields.map((field) => {
    const groupTarget = field.groupKey && fieldIds.has(field.groupKey) ? field.groupKey : null;
    const groupField = groupTarget ? fields.find((candidate) => candidate.id === groupTarget) : null;
    const safeGroupKey =
      groupField && canContainerAcceptChild(groupField, field) && !isDescendantOf(fields, groupField.id, field.id)
        ? groupTarget
        : null;
    const safeSectionKey = field.sectionKey && selectorOptionIds.has(field.sectionKey) ? field.sectionKey : null;

    return {
      ...field,
      groupKey: safeGroupKey,
      sectionKey: safeSectionKey,
    };
  });
};

export const sanitizeAnamnesisFormResponse = (response: AnamnesisFormResponse): AnamnesisFormResponse =>
  Object.fromEntries(
    Object.entries(response)
      .slice(0, ANAMNESIS_RESPONSE_ENTRY_LIMIT)
      .map(([fieldId, value]) => {
        const safeFieldId = sanitizeId(fieldId, "field");

        if (typeof value === "string") {
          return [safeFieldId, sanitizeMultilineInput(value, ANAMNESIS_RESPONSE_TEXT_LIMIT)];
        }

        if (typeof value === "number") {
          return [safeFieldId, Number.isFinite(value) ? value : null];
        }

        if (typeof value === "boolean" || value === null) {
          return [safeFieldId, value];
        }

        if (Array.isArray(value)) {
          const normalized = value.slice(0, ANAMNESIS_TABLE_ROW_LIMIT).map((item) => {
            if (typeof item === "string") {
              return sanitizeSingleLineInput(item, INPUT_LIMITS.formOptionLabel).trim();
            }

            if (item && typeof item === "object" && !Array.isArray(item)) {
              return Object.fromEntries(
                Object.entries(item as AnamnesisTableRow)
                  .slice(0, ANAMNESIS_OPTION_LIMIT)
                  .map(([columnId, cellValue]) => [
                    sanitizeId(columnId, "column"),
                    sanitizeMultilineInput(String(cellValue ?? ""), ANAMNESIS_RESPONSE_TEXT_LIMIT),
                  ])
              );
            }

            return null;
          }).filter((item): item is string | AnamnesisTableRow => item !== null);

          return [safeFieldId, normalized];
        }

        return [safeFieldId, null];
      })
  );

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
  { type: "date", label: "Data" },
  { type: "number", label: "Apenas números" },
  { type: "checklist", label: "Checklist" },
  { type: "multiple_choice", label: "Múltipla escolha" },
  { type: "select", label: "Droplist" },
  { type: "table", label: "Tabela" },
  { type: "slider", label: "Slidebar" },
  { type: "section", label: "Seção" },
  { type: "horizontal_section", label: "Seção horizontal" },
  { type: "section_selector", label: "Seletor de seções" },
];

const ANAMNESIS_FIELD_TYPES = new Set<AnamnesisFieldType>(ANAMNESIS_FIELD_LIBRARY.map((field) => field.type));

export const isContainerFieldType = (type: AnamnesisFieldType) => type === "section" || type === "horizontal_section";
export const isContainerField = (field: AnamnesisField) => isContainerFieldType(field.type);
export const hasScrollableOptionEditor = (type: AnamnesisFieldType) =>
  type === "checklist" || type === "multiple_choice";
export const hasVerticalOptionEditor = (type: AnamnesisFieldType) => type === "select";
export const hasTableColumnEditor = (type: AnamnesisFieldType) => type === "table";
export const isSelectionChoiceFieldType = (type: AnamnesisFieldType) =>
  type === "checklist" || type === "multiple_choice";

export const toggleSelectionChoiceFieldType = (type: AnamnesisFieldType): AnamnesisFieldType => {
  if (type === "checklist") return "multiple_choice";
  if (type === "multiple_choice") return "checklist";
  return type;
};

export const createFieldOption = (label: string, index: number, row = 0): AnamnesisFieldOption => ({
  id: `option_${index + 1}`,
  label,
  row,
});

export const createDefaultTemplateSchema = () =>
  DEFAULT_ANAMNESIS_TEMPLATE_SCHEMA.map((field, index) => ({
    ...field,
    id: `${field.id}_${index}`,
  }));

const slugifyTemplateExchangeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

export const buildAnamnesisTemplateExchangeFileName = (
  kind: AnamnesisTemplateExchangeKind,
  name: string,
) => {
  const slug = slugifyTemplateExchangeName(name) || (kind === "base" ? "bloco-padrao" : "ficha");
  return `pronto-health-fisio-modelo-${slug}.json`;
};

export const buildAnamnesisTemplateExchangePayload = ({
  description,
  exportedAt = new Date().toISOString(),
  kind,
  name,
  schema,
}: {
  description?: string | null;
  exportedAt?: string;
  kind: AnamnesisTemplateExchangeKind;
  name: string;
  schema: AnamnesisTemplateSchema;
}): AnamnesisTemplateExchangePayload => ({
  exportedAt,
  format: "pronto-health-fisio.anamnesis-template",
  kind,
  template: {
    description: sanitizeMultilineInput(description ?? "", INPUT_LIMITS.formDescription).trim(),
    name: sanitizeSingleLineInput(name, INPUT_LIMITS.formTemplateName).trim(),
    schema: sanitizeAnamnesisTemplateSchema(schema),
  },
  version: 1,
});

const isAnamnesisTemplateExchangePayload = (value: unknown): value is AnamnesisTemplateExchangePayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AnamnesisTemplateExchangePayload>;

  return (
    candidate.format === "pronto-health-fisio.anamnesis-template" &&
    candidate.version === 1 &&
    (candidate.kind === "base" || candidate.kind === "template") &&
    typeof candidate.exportedAt === "string" &&
    !!candidate.template &&
    typeof candidate.template === "object" &&
    typeof candidate.template.name === "string" &&
    typeof candidate.template.description === "string" &&
    isAnamnesisTemplateSchema(candidate.template.schema)
  );
};

export const parseAnamnesisTemplateExchangePayload = (raw: string) => {
  if (raw.length > ANAMNESIS_TEMPLATE_IMPORT_MAX_BYTES) {
    throw new Error("Arquivo de modelo muito grande");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Arquivo de modelo inválido");
  }

  if (!isAnamnesisTemplateExchangePayload(parsed)) {
    throw new Error("Arquivo de modelo inválido");
  }

  return {
    ...parsed,
    template: {
      ...parsed.template,
      description: sanitizeMultilineInput(parsed.template.description, INPUT_LIMITS.formDescription).trim(),
      name: sanitizeSingleLineInput(parsed.template.name, INPUT_LIMITS.formTemplateName).trim(),
      schema: sanitizeAnamnesisTemplateSchema(parsed.template.schema),
    },
  };
};

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

  if (type === "table") {
    return {
      ...baseField,
      label: "Nova tabela",
      options: [createFieldOption("Coluna 1", 0), createFieldOption("Coluna 2", 1)],
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
  sanitizeMultilineInput(raw, ANAMNESIS_RAW_OPTIONS_INPUT_LIMIT)
    .split("\n")
    .flatMap((line, rowIndex) =>
      line
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((label) => ({ label, row: rowIndex }))
    )
    .filter(Boolean)
    .slice(0, ANAMNESIS_OPTION_LIMIT)
    .map(({ label, row }) => ({ label: sanitizeSingleLineInput(label, INPUT_LIMITS.formOptionLabel).trim(), row }))
    .filter(({ label }) => label.length > 0)
    .map(({ label, row }, index) => createFieldOption(label, index, row));

const sortOptionsByMatrix = (options: AnamnesisFieldOption[]) =>
  [...options].sort((left, right) => {
    const leftRow = left.row ?? 0;
    const rightRow = right.row ?? 0;

    if (leftRow !== rightRow) {
      return leftRow - rightRow;
    }

    return left.id.localeCompare(right.id);
  });

export const getOptionMatrixRows = (options: AnamnesisFieldOption[] = []) => {
  const source = options.length > 0 ? sortOptionsByMatrix(options) : [createFieldOption("Opção 1", 0, 0)];
  const rows = new Map<number, AnamnesisFieldOption[]>();

  source.forEach((option) => {
    const rowIndex = option.row ?? 0;
    rows.set(rowIndex, [...(rows.get(rowIndex) ?? []), option]);
  });

  return [...rows.entries()]
    .sort(([left], [right]) => left - right)
    .map(([rowIndex, items]) => ({ rowIndex, items }));
};

const createMatrixOptionId = () => `option_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const getVerticalOptionList = (options: AnamnesisFieldOption[] = []) => {
  const source = options.length > 0 ? [...options] : [createFieldOption("Opção 1", 0, 0)];

  return source.map((option, index) => ({
    ...option,
    row: index,
  }));
};

export const addOptionToMatrixRow = (options: AnamnesisFieldOption[] = [], rowIndex: number) => {
  const next = options.length > 0 ? [...options] : [createFieldOption("Opção 1", 0, 0)];

  if (next.length >= ANAMNESIS_OPTION_LIMIT) {
    return next;
  }

  next.push({
    id: createMatrixOptionId(),
    label: "",
    row: rowIndex,
  });

  return next;
};

export const addOptionMatrixRow = (options: AnamnesisFieldOption[] = []) => {
  const source = options.length > 0 ? [...options] : [createFieldOption("Opção 1", 0, 0)];

  if (source.length >= ANAMNESIS_OPTION_LIMIT) {
    return source;
  }

  const nextRowIndex = Math.max(...source.map((option) => option.row ?? 0), 0) + 1;

  source.push({
    id: createMatrixOptionId(),
    label: "",
    row: nextRowIndex,
  });

  return source;
};

export const updateOptionMatrixLabel = (options: AnamnesisFieldOption[], optionId: string, label: string) =>
  options.map((option) => (option.id === optionId ? { ...option, label: sanitizeSingleLineInput(label, INPUT_LIMITS.formOptionLabel) } : option));

export const removeOptionFromMatrix = (options: AnamnesisFieldOption[], optionId: string) => {
  const next = options.filter((option) => option.id !== optionId);
  return next.length > 0 ? next : [createFieldOption("Opção 1", 0, 0)];
};

export const addOptionToVerticalList = (options: AnamnesisFieldOption[] = []) => {
  const source = getVerticalOptionList(options);

  if (source.length >= ANAMNESIS_OPTION_LIMIT) {
    return source;
  }

  source.push({
    id: createMatrixOptionId(),
    label: "",
    row: source.length,
  });

  return source;
};

export const updateVerticalOptionLabel = (options: AnamnesisFieldOption[], optionId: string, label: string) =>
  getVerticalOptionList(options).map((option) => (option.id === optionId ? { ...option, label: sanitizeSingleLineInput(label, INPUT_LIMITS.formOptionLabel) } : option));

export const removeOptionFromVerticalList = (options: AnamnesisFieldOption[], optionId: string) => {
  const next = getVerticalOptionList(options).filter((option) => option.id !== optionId);
  return next.length > 0 ? getVerticalOptionList(next) : [createFieldOption("Opção 1", 0, 0)];
};

const createEmptyTableRow = (field: Pick<AnamnesisField, "options">): AnamnesisTableRow =>
  Object.fromEntries((field.options ?? []).map((option) => [option.id, ""]));

export const getTableRows = (
  field: Pick<AnamnesisField, "options">,
  value?: AnamnesisFormValue,
) => {
  if (Array.isArray(value) && value.every((row) => typeof row === "object" && row !== null && !Array.isArray(row))) {
    const rows = value as AnamnesisTableRow[];
    return rows.length > 0 ? rows : [createEmptyTableRow(field)];
  }

  return [createEmptyTableRow(field)];
};

export const addTableRow = (rows: AnamnesisTableRow[], field: Pick<AnamnesisField, "options">) => [
  ...rows,
  createEmptyTableRow(field),
];

export const updateTableCellValue = (
  rows: AnamnesisTableRow[],
  rowIndex: number,
  columnId: string,
  value: string,
) => rows.map((row, index) => (index === rowIndex ? { ...row, [columnId]: sanitizeMultilineInput(value, ANAMNESIS_RESPONSE_TEXT_LIMIT) } : row));

export const removeTableRow = (
  rows: AnamnesisTableRow[],
  rowIndex: number,
  field: Pick<AnamnesisField, "options">,
) => {
  const next = rows.filter((_, index) => index !== rowIndex);
  return next.length > 0 ? next : [createEmptyTableRow(field)];
};

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

export const isAnamnesisTemplateSchema = (value: unknown): value is AnamnesisTemplateSchema => {
  if (!Array.isArray(value) || value.length > ANAMNESIS_SCHEMA_FIELD_LIMIT) {
    return false;
  }

  return value.every((field) => {
    if (!isPlainRecord(field)) {
      return false;
    }

    return (
      typeof field.id === "string" &&
      typeof field.label === "string" &&
      typeof field.type === "string" &&
      ANAMNESIS_FIELD_TYPES.has(field.type as AnamnesisFieldType) &&
      (!field.options ||
        (Array.isArray(field.options) &&
          field.options.length <= ANAMNESIS_OPTION_LIMIT &&
          field.options.every((option) => isPlainRecord(option) && typeof option.id === "string" && typeof option.label === "string")))
    );
  });
};

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
