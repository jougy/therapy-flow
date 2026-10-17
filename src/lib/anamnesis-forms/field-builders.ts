import { INPUT_LIMITS, sanitizeMultilineInput, sanitizeSingleLineInput } from "@/lib/input-security";
import {
  type AnamnesisField,
  type AnamnesisFieldOption,
  type AnamnesisFieldType,
  type AnamnesisFormResponse,
  type AnamnesisTableRow,
  type AnamnesisTemplateSchema,
  type TemplateLayoutField,
  type TemplateLayoutItem,
  type TemplateLayoutSection,
  ANAMNESIS_OPTION_LIMIT,
  ANAMNESIS_RAW_OPTIONS_INPUT_LIMIT,
  ANAMNESIS_SLIDER_MAX,
  ANAMNESIS_SLIDER_MIN,
  ANAMNESIS_RESPONSE_TEXT_LIMIT,
  canContainerAcceptChild,
  getFieldById,
  hasMeaningfulFormValue,
  isContainerField,
  isContainerFieldType,
  isDescendantOf,
  isPlainRecord,
} from "./types";

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

  if (type === "simple_list") {
    return {
      ...baseField,
      label: "Lista de itens",
      placeholder: "Escreva um item aqui...",
      addButtonLabel: "+ Adicionar item",
    };
  }

  if (type === "tags") {
    return {
      ...baseField,
      label: "Tags / Categorias",
      tagMode: "multiple",
      allowCustomTags: true,
      placeholder: "Buscar ou adicionar tag...",
      options: [
        { id: `tag_${Date.now()}_1`, label: "Tag 1", color: "#C4B5FD", row: 0 },
        { id: `tag_${Date.now()}_2`, label: "Tag 2", color: "#FDE047", row: 0 },
        { id: `tag_${Date.now()}_3`, label: "Tag 3", color: "#93C5FD", row: 0 },
      ],
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

  if (type === "section" || type === "horizontal_section" || type === "radar_section") {
    return {
      ...baseField,
      label:
        type === "horizontal_section"
          ? "Novas Etapas Horizontais"
          : type === "radar_section"
            ? "Polígono de Status"
            : "Nova seção",
      helpText:
        type === "horizontal_section"
          ? "Agrupe campos lado a lado ou em etapas com navegação."
          : type === "radar_section"
            ? "Gráfico de radar com sliders e métricas multidimensionais."
            : "Texto introdutório da seção.",
      ...(type === "horizontal_section" ? { horizontalDisplayMode: "scroll" as const } : {}),
    };
  }

  if (type === "calculated") {
    return {
      ...baseField,
      label: "Campos calculados",
      calculatedConfig: {
        variables: [
          { id: `var_${Date.now()}_1`, name: "A", label: "Entrada A", unit: "" },
          { id: `var_${Date.now()}_2`, name: "B", label: "Entrada B", unit: "" },
        ],
        outputs: [
          {
            id: `out_${Date.now()}_1`,
            name: "Resultado",
            formula: "A + B",
            unit: "",
            precision: 2,
          },
        ],
        ranges: [],
      },
    };
  }

  if (type === "image_annotation") {
    return {
      ...baseField,
      label: "Anotação de Imagem",
      helpText: "Carregue uma imagem ou foto para desenhar, marcar setas, regiões e pontos interativos.",
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
  const activeSectionIds = new Set<string>();

  fields
    .filter((field) => field.type === "section_selector")
    .forEach((field) => {
      const value = response[field.id];
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === "string") activeSectionIds.add(item);
        });
      } else if (isPlainRecord(value)) {
        Object.entries(value).forEach(([id, isActive]) => {
          if (isActive) activeSectionIds.add(id);
        });
      } else if (value === undefined || value === null) {
        fields
          .filter((child) => child.groupKey === field.id)
          .forEach((child) => activeSectionIds.add(child.id));
        (field.options ?? []).forEach((opt) => activeSectionIds.add(opt.id));
      }
    });

  return fields.filter((field) => {
    if (field.groupKey) {
      const parent = getFieldById(fields, field.groupKey);
      if (parent && parent.type === "section_selector") {
        return activeSectionIds.has(field.id);
      }
      if (parent && parent.groupKey) {
        const grandParent = getFieldById(fields, parent.groupKey);
        if (grandParent && grandParent.type === "section_selector") {
          return activeSectionIds.has(parent.id);
        }
      }
    }

    if (field.sectionKey && !activeSectionIds.has(field.sectionKey)) {
      return false;
    }

    return true;
  });
};

export const countTemplateQuestionFields = (fields: AnamnesisTemplateSchema) =>
  fields.filter((field) => !isContainerField(field)).length;

export const countTemplateSections = (fields: AnamnesisTemplateSchema) =>
  fields.filter((field) => isContainerField(field)).length;


export const getAssignableContainerFields = (fields: AnamnesisTemplateSchema, childFieldId: string) => {
  const fieldMap = new Map(fields.map((f) => [f.id, f]));
  const child = fieldMap.get(childFieldId);

  if (!child) {
    return [];
  }

  // A section_selector cannot be assigned to any parent container
  if (child.type === "section_selector") {
    return [];
  }

  return fields.filter((field) => {
    if (!isContainerField(field) || field.id === child.id) {
      return false;
    }

    if (isDescendantOf(fields, field.id, child.id, fieldMap)) {
      return false;
    }

    if (isContainerField(child)) {
      return field.type === "section_selector" || field.type === "section";
    }

    return canContainerAcceptChild(field, child);
  });
};

const toTemplateLayoutItem = (
  field: AnamnesisField,
  fields: AnamnesisTemplateSchema,
  visited = new Set<string>(),
): TemplateLayoutItem => {
  if (!isContainerField(field) || visited.has(field.id)) {
    return {
      field,
      type: "field",
    };
  }

  const nextVisited = new Set(visited);
  nextVisited.add(field.id);

  return {
    field,
    items: fields
      .filter((child) => child.groupKey === field.id && !nextVisited.has(child.id) && canContainerAcceptChild(field, child))
      .map((child) => toTemplateLayoutItem(child, fields, nextVisited)),
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

