import type { CSSProperties } from "react";
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDownSquare,
  CircleDot,
  Columns,
  FileText,
  Folder,
  FolderOpen,
  Hash,
  Hexagon,
  MapPin,
  Sliders,
  Table,
  ToggleLeft,
  Type,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import {
  ANAMNESIS_FIELD_LIBRARY,
  createAnamnesisField,
  getOptionMatrixRows,
  type AnamnesisField,
  type AnamnesisTemplateSchema,
  type TemplateLayoutItem,
} from "@/lib/anamnesis-forms";
import {
  DEFAULT_GROUP_COLOR_SLOT_SEEDS,
  hexToRgb,
  hsvToRgb,
  normalizeHexColor,
  rgbToHex,
  rgbToHsv,
  toRgbaString,
  type RgbColor,
} from "@/lib/group-colors";
import { INPUT_LIMITS, sanitizeMultilineInput, sanitizeSingleLineInput } from "@/lib/input-security";
import type { SectionColorSlot } from "@/components/anamnesis/SectionColorPaletteField";

export type TemplateRow = Database["public"]["Tables"]["anamnesis_form_templates"]["Row"];

export type DesignLabAnamnesisField = AnamnesisField & {
  accentAlpha?: number;
  accentColor?: string;
};

export type DesignLabTemplateSchema = DesignLabAnamnesisField[];

export type DesignLabTemplateLayoutItem = Omit<TemplateLayoutItem, "field" | "items"> & {
  field: DesignLabAnamnesisField;
  items: DesignLabTemplateLayoutItem[];
};

export const DEFAULT_SECTION_COLOR = "#2563EB";
export const DEFAULT_HORIZONTAL_SECTION_COLOR = "#8B5CF6";
export const DEFAULT_FIELD_COLOR = "#64748B";

export const DESIGNLAB_SECTION_COLOR_SLOTS: SectionColorSlot[] = DEFAULT_GROUP_COLOR_SLOT_SEEDS.map((slot) => ({
  alpha: slot.alpha,
  color_hex: slot.colorHex,
  id: `section-slot-${slot.slotIndex}`,
  slot_index: slot.slotIndex,
}));

export const COMPONENT_CATEGORIES = [
  {
    name: "Básicos",
    items: [
      { type: "short_text" as const, label: "Texto curto", icon: Type, description: "Linha única de resposta" },
      { type: "long_text" as const, label: "Texto longo", icon: AlignLeft, description: "Área de texto livre" },
      { type: "number" as const, label: "Apenas números", icon: Hash, description: "Contagens e valores numéricos" },
      { type: "date" as const, label: "Data", icon: Calendar, description: "Calendário interativo" },
    ],
  },
  {
    name: "Opções & Seleção",
    items: [
      { type: "select" as const, label: "Droplist", icon: ChevronDownSquare, description: "Menu suspenso de escolha única" },
      { type: "multiple_choice" as const, label: "Múltipla escolha", icon: CircleDot, description: "Opções exclusivas (radio)" },
      { type: "checklist" as const, label: "Checklist", icon: CheckSquare, description: "Múltiplas opções de marcação" },
      { type: "slider" as const, label: "Slidebar", icon: Sliders, description: "Escala deslizante numérica" },
    ],
  },
  {
    name: "Estrutura & Agrupamento",
    items: [
      { type: "section" as const, label: "Seção sanfona", icon: Folder, description: "Agrupador vertical retrátil" },
      { type: "horizontal_section" as const, label: "Seção horizontal", icon: Columns, description: "Colunas com rolagem lateral" },
      { type: "section_selector" as const, label: "Seletor de seções", icon: ToggleLeft, description: "Switches de visibilidade condicional" },
      { type: "radar_section" as const, label: "Polígono de Status", icon: Hexagon, description: "Radar de atributos com sliders e métricas" },
    ],
  },
  {
    name: "Especiais",
    items: [
      { type: "table" as const, label: "Tabela", icon: Table, description: "Grade de colunas personalizadas" },
      { type: "address_block" as const, label: "Bloco de Endereço", icon: MapPin, description: "CEP, logradouro e GPS" },
    ],
  },
];

export const castDesignLabSchema = (schema: AnamnesisTemplateSchema): DesignLabTemplateSchema =>
  schema as DesignLabTemplateSchema;

export const castDesignLabLayout = (layout: TemplateLayoutItem[]): DesignLabTemplateLayoutItem[] =>
  layout as DesignLabTemplateLayoutItem[];

export const flattenLayoutItems = (items: DesignLabTemplateLayoutItem[]): DesignLabAnamnesisField[] => {
  const result: DesignLabAnamnesisField[] = [];
  const walk = (list: DesignLabTemplateLayoutItem[]) => {
    for (const item of list) {
      result.push(item.field);
      if (item.items && item.items.length > 0) {
        walk(item.items);
      }
    }
  };
  walk(items);
  return result;
};

export const getFieldTypeLabel = (type: AnamnesisField["type"]) =>
  ANAMNESIS_FIELD_LIBRARY.find((entry) => entry.type === type)?.label ?? type;

export const getFieldAccentColor = (field: AnamnesisField) =>
  normalizeHexColor((field as DesignLabAnamnesisField).accentColor ?? "") ??
  (field.type === "horizontal_section"
    ? DEFAULT_HORIZONTAL_SECTION_COLOR
    : field.type === "section"
    ? DEFAULT_SECTION_COLOR
    : DEFAULT_FIELD_COLOR);

export const getFieldAccentAlpha = (field: AnamnesisField) => {
  const alpha = (field as DesignLabAnamnesisField).accentAlpha;
  return typeof alpha === "number" && Number.isFinite(alpha) ? Math.min(Math.max(Math.round(alpha), 0), 100) : 100;
};

export const getSoftAccentBackground = (color: string, alpha: number) => {
  const rgb = hexToRgb(color) as RgbColor | null;
  if (!rgb) return "hsl(var(--muted) / 0.35)";
  const mutedRgb = hsvToRgb({ ...rgbToHsv(rgb), s: 12, v: 98 });
  return `linear-gradient(90deg, ${toRgbaString(rgbToHex(mutedRgb), Math.max(alpha * 0.18, 10))}, transparent 70%)`;
};

export const estimateLayoutWeight = (field: Pick<AnamnesisField, "helpText" | "label" | "options" | "type">) => {
  if (field.type === "long_text" || field.type === "table") return 2;
  if (field.type === "checklist" || field.type === "multiple_choice") {
    const optionLength = (field.options ?? []).reduce((sum, option) => sum + option.label.length, 0);
    return optionLength > 80 ? 2 : 1.25;
  }
  return 1;
};

export const estimateFieldPreferredWidth = (field: Pick<AnamnesisField, "helpText" | "label" | "options" | "type">) => {
  if (field.type === "long_text" || field.type === "table") return 520;
  if (field.type === "checklist" || field.type === "multiple_choice") {
    const optionCount = field.options?.length ?? 0;
    const longestOption = Math.max(0, ...(field.options ?? []).map((option) => option.label.length));
    return Math.min(Math.max(320, optionCount * 90, longestOption * 12), 720);
  }
  return 360;
};

export const getFieldMaxWidth = (field: Pick<AnamnesisField, "type">) => {
  if (field.type === "checklist" || field.type === "multiple_choice") return 760;
  if (field.type === "short_text" || field.type === "number" || field.type === "date" || field.type === "select") return 560;
  return null;
};

export const estimateHorizontalSectionRowHeight = (items: DesignLabTemplateLayoutItem[]) =>
  Math.max(
    120,
    ...items.map((item) => {
      if (item.field.type === "long_text" || item.field.type === "table") return 180;
      if (item.field.type === "checklist" || item.field.type === "multiple_choice") {
        const rows = getOptionMatrixRows(item.field.options ?? []).length;
        return 84 + rows * 54;
      }
      return 120;
    })
  );

export const getFieldTypeIcon = (type: AnamnesisField["type"], isContainer: boolean, isCollapsed: boolean) => {
  if (type === "section") return isCollapsed ? Folder : FolderOpen;
  if (type === "horizontal_section") return Columns;
  if (type === "radar_section") return Hexagon;
  if (type === "short_text") return Type;
  if (type === "long_text") return AlignLeft;
  if (type === "date") return Calendar;
  if (type === "number") return Hash;
  if (type === "select") return ChevronDownSquare;
  if (type === "checklist") return CheckSquare;
  if (type === "multiple_choice") return CircleDot;
  if (type === "slider") return Sliders;
  if (type === "address_block") return MapPin;
  if (type === "table") return Table;
  if (type === "section_selector") return ToggleLeft;
  return FileText;
};

export const sanitizeFieldChanges = (changes: Partial<AnamnesisField>): Partial<AnamnesisField> => {
  const next = { ...changes };

  if (typeof next.label === "string") {
    next.label = sanitizeSingleLineInput(next.label, INPUT_LIMITS.formFieldLabel);
  }

  if (typeof next.helpText === "string") {
    next.helpText = sanitizeMultilineInput(next.helpText, INPUT_LIMITS.formHelpText);
  }

  if (typeof next.placeholder === "string") {
    next.placeholder = sanitizeSingleLineInput(next.placeholder, INPUT_LIMITS.formPlaceholder);
  }

  return next;
};

export const cloneFieldWithNewIds = (
  field: DesignLabAnamnesisField,
  newGroupKey?: string | null,
  indexSeed = 1
): DesignLabAnamnesisField => {
  const base = createAnamnesisField(field.type, indexSeed) as DesignLabAnamnesisField;
  const newFieldId = base.id;

  const clonedOptions = field.options?.map((opt, optIdx) => ({
    ...opt,
    id: `opt_${newFieldId}_${optIdx + 1}`,
  }));

  const clonedColumns = field.tableColumns?.map((col, colIdx) => ({
    ...col,
    id: `col_${newFieldId}_${colIdx + 1}`,
  }));

  const clonedRows = field.tableRows?.map((row, rowIdx) => ({
    ...row,
    id: `row_${newFieldId}_${rowIdx + 1}`,
  }));

  return {
    ...field,
    id: newFieldId,
    label: `${field.label} (Cópia)`,
    systemKey: undefined,
    groupKey: newGroupKey !== undefined ? newGroupKey : (field.groupKey ?? null),
    options: clonedOptions,
    tableColumns: clonedColumns,
    tableRows: clonedRows,
  };
};
