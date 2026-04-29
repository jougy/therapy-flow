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
    description: description?.trim() ?? "",
    name: name.trim(),
    schema,
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
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Arquivo de modelo inválido");
  }

  if (!isAnamnesisTemplateExchangePayload(parsed)) {
    throw new Error("Arquivo de modelo inválido");
  }

  return parsed;
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
  raw
    .split("\n")
    .flatMap((line, rowIndex) =>
      line
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((label) => ({ label, row: rowIndex }))
    )
    .filter(Boolean)
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

  next.push({
    id: createMatrixOptionId(),
    label: "",
    row: rowIndex,
  });

  return next;
};

export const addOptionMatrixRow = (options: AnamnesisFieldOption[] = []) => {
  const source = options.length > 0 ? [...options] : [createFieldOption("Opção 1", 0, 0)];
  const nextRowIndex = Math.max(...source.map((option) => option.row ?? 0), 0) + 1;

  source.push({
    id: createMatrixOptionId(),
    label: "",
    row: nextRowIndex,
  });

  return source;
};

export const updateOptionMatrixLabel = (options: AnamnesisFieldOption[], optionId: string, label: string) =>
  options.map((option) => (option.id === optionId ? { ...option, label } : option));

export const removeOptionFromMatrix = (options: AnamnesisFieldOption[], optionId: string) => {
  const next = options.filter((option) => option.id !== optionId);
  return next.length > 0 ? next : [createFieldOption("Opção 1", 0, 0)];
};

export const addOptionToVerticalList = (options: AnamnesisFieldOption[] = []) => {
  const source = getVerticalOptionList(options);

  source.push({
    id: createMatrixOptionId(),
    label: "",
    row: source.length,
  });

  return source;
};

export const updateVerticalOptionLabel = (options: AnamnesisFieldOption[], optionId: string, label: string) =>
  getVerticalOptionList(options).map((option) => (option.id === optionId ? { ...option, label } : option));

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
) => rows.map((row, index) => (index === rowIndex ? { ...row, [columnId]: value } : row));

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
