import { INPUT_LIMITS, sanitizeMultilineInput, sanitizeSingleLineInput } from "@/lib/input-security";
import {
  type AddressBlockValue,
  type AnamnesisField,
  type AnamnesisFieldOption,
  type AnamnesisFieldType,
  type AnamnesisFormResponse,
  type AnamnesisFormValue,
  type AnamnesisTagItem,
  type AnamnesisTemplateSchema,
  type CalculatedFieldConfig,
  type CalculatedFieldOutput,
  type CalculatedFieldRange,
  type CalculatedFieldResponseValue,
  type CalculatedFieldVariable,
  type HorizontalDisplayMode,
  type HorizontalSectionDisplayMode,
  HORIZONTAL_DISPLAY_MODES,
  ANAMNESIS_OPTION_LIMIT,
  ANAMNESIS_SCHEMA_FIELD_LIMIT,
  ANAMNESIS_SLIDER_MAX,
  ANAMNESIS_SLIDER_MIN,
  ANAMNESIS_RESPONSE_ENTRY_LIMIT,
  ANAMNESIS_TABLE_ROW_LIMIT,
  ANAMNESIS_RESPONSE_TEXT_LIMIT,
  ANAMNESIS_FIELD_TYPES,
  hasMeaningfulFormValue,
  isContainerField,
  isContainerFieldType,
  isPlainRecord,
  getFieldById,
  canContainerAcceptChild,
  isDescendantOf,
} from "./types";

const ANAMNESIS_SYSTEM_KEYS = new Set<NonNullable<AnamnesisField["systemKey"]>>([
  "complexity_score",
  "observacoes",
  "pain_score",
  "queixa",
  "sintomas",
]);

const sanitizeId = (value: string, fallback: string) =>
  sanitizeSingleLineInput(value || fallback, INPUT_LIMITS.id).trim() || fallback;


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
  const description = typeof source.description === "string" ? source.description : undefined;
  const rawLabel = typeof source.label === "string" ? source.label : undefined;
  const sanitizedLabel = rawLabel !== undefined ? sanitizeSingleLineInput(rawLabel, INPUT_LIMITS.formOptionLabel).trim() : undefined;
  const label = sanitizedLabel !== undefined
    ? (sanitizedLabel === "" && rawLabel === "" ? "" : (sanitizedLabel || `Opção ${index + 1}`))
    : `Opção ${index + 1}`;
  const rawColor = typeof source.color === "string" && source.color.trim() ? sanitizeSingleLineInput(source.color, 20).trim() : undefined;
  const rawColorSlotId = typeof source.colorSlotId === "string" && source.colorSlotId.trim() ? sanitizeId(source.colorSlotId, "") : undefined;

  return {
    id: makeUniqueId(getStringValue(source.id), usedIds, `option_${index + 1}`),
    label,
    ...(description !== undefined ? { description: sanitizeMultilineInput(description, INPUT_LIMITS.formHelpText) } : {}),
    row: Number.isFinite(source.row) ? clamp(Math.round(Number(source.row)), 0, 99) : 0,
    ...(rawColor ? { color: rawColor } : {}),
    ...(rawColorSlotId ? { colorSlotId: rawColorSlotId } : {}),
  };
};

export const sanitizeCalculatedFieldConfig = (raw: unknown): CalculatedFieldConfig | undefined => {
  if (!isPlainRecord(raw)) return undefined;

  const rawVars = Array.isArray(raw.variables) ? raw.variables : [];
  const variables: CalculatedFieldVariable[] = rawVars
    .slice(0, 20)
    .map((v, i) => {
      const src = isPlainRecord(v) ? v : {};
      const rawName = typeof src.name === "string" ? src.name : String.fromCharCode(65 + i);
      // Mantém apenas letras alfanuméricas e underscore para o nome da variável
      const name = sanitizeSingleLineInput(rawName, 10).replace(/[^a-zA-Z0-9_]/g, "").trim().toUpperCase() || String.fromCharCode(65 + i);
      const label = sanitizeSingleLineInput(typeof src.label === "string" ? src.label : `Entrada ${name}`, INPUT_LIMITS.formFieldLabel).trim() || `Entrada ${name}`;
      const unit = typeof src.unit === "string" && src.unit.trim() ? sanitizeSingleLineInput(src.unit, 20).trim() : undefined;
      const sourceFieldId = typeof src.sourceFieldId === "string" && src.sourceFieldId.trim() ? sanitizeId(src.sourceFieldId, "") : undefined;
      return {
        id: typeof src.id === "string" && src.id.trim() ? sanitizeId(src.id, `var_${i}`) : `var_${i + 1}`,
        name,
        label,
        ...(unit ? { unit } : {}),
        ...(sourceFieldId ? { sourceFieldId } : {}),
      };
    });

  const rawOutputs = Array.isArray(raw.outputs) ? raw.outputs : [];
  const outputs: CalculatedFieldOutput[] = rawOutputs
    .slice(0, 10)
    .map((o, i) => {
      const src = isPlainRecord(o) ? o : {};
      const name = sanitizeSingleLineInput(typeof src.name === "string" ? src.name : `Resultado ${i + 1}`, INPUT_LIMITS.formFieldLabel).trim() || `Resultado ${i + 1}`;
      // Sanitiza fórmula removendo caracteres de injeção e tags
      const formula = sanitizeSingleLineInput(typeof src.formula === "string" ? src.formula : "0", 300).trim() || "0";
      const unit = typeof src.unit === "string" && src.unit.trim() ? sanitizeSingleLineInput(src.unit, 20).trim() : undefined;
      const precision = typeof src.precision === "number" && Number.isFinite(src.precision) ? clamp(Math.round(src.precision), 0, 4) : 2;
      return {
        id: typeof src.id === "string" && src.id.trim() ? sanitizeId(src.id, `out_${i}`) : `out_${i + 1}`,
        name,
        formula,
        ...(unit ? { unit } : {}),
        precision,
      };
    });

  let ranges: CalculatedFieldRange[] | undefined;
  if (Array.isArray(raw.ranges)) {
    ranges = raw.ranges.slice(0, 20).map((r, i) => {
      const src = isPlainRecord(r) ? r : {};
      const min = typeof src.min === "number" && Number.isFinite(src.min) ? src.min : undefined;
      const max = typeof src.max === "number" && Number.isFinite(src.max) ? src.max : undefined;
      const label = sanitizeSingleLineInput(typeof src.label === "string" ? src.label : `Faixa ${i + 1}`, INPUT_LIMITS.formFieldLabel).trim() || `Faixa ${i + 1}`;
      const color = typeof src.color === "string" && src.color.trim() ? sanitizeSingleLineInput(src.color, 30).trim() : "blue";
      return {
        id: typeof src.id === "string" && src.id.trim() ? sanitizeId(src.id, `range_${i}`) : `range_${i + 1}`,
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
        label,
        color,
      };
    });
  }

  return {
    variables,
    outputs,
    ...(ranges && ranges.length > 0 ? { ranges } : {}),
  };
};


const fieldNeedsOptions = (type: AnamnesisFieldType) =>
  type === "checklist" ||
  type === "multiple_choice" ||
  type === "select" ||
  type === "table" ||
  type === "tags" ||
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

      const rawLabel = typeof source.label === "string" ? source.label : undefined;
      const sanitizedLabel = rawLabel !== undefined ? sanitizeSingleLineInput(rawLabel, INPUT_LIMITS.formFieldLabel).trim() : undefined;
      const label = sanitizedLabel !== undefined
        ? (sanitizedLabel === "" && rawLabel === "" ? "" : (sanitizedLabel || systemKey || "Campo"))
        : (systemKey || "Campo");

      const rawHelpText = typeof source.helpText === "string" ? source.helpText : undefined;
      const helpText = rawHelpText !== undefined
        ? sanitizeMultilineInput(rawHelpText, INPUT_LIMITS.formHelpText)
        : undefined;

      const rawPlaceholder = typeof source.placeholder === "string" ? source.placeholder : undefined;
      const placeholder = rawPlaceholder !== undefined
        ? sanitizeSingleLineInput(rawPlaceholder, INPUT_LIMITS.formPlaceholder)
        : undefined;

      const rawAccentColor = typeof source.accentColor === "string" ? source.accentColor.trim() : undefined;
      const rawAccentAlpha = typeof source.accentAlpha === "number" && Number.isFinite(source.accentAlpha)
        ? Math.min(Math.max(Math.round(source.accentAlpha), 0), 100)
        : undefined;

      const rawSliderStep = typeof source.sliderStep === "number" && Number.isFinite(source.sliderStep) && source.sliderStep > 0
        ? Math.min(Math.max(source.sliderStep, 0.1), 100)
        : undefined;

      const rawSliderMinLabel = typeof source.sliderMinLabel === "string"
        ? sanitizeSingleLineInput(source.sliderMinLabel, 40).trim()
        : undefined;

      const rawSliderMaxLabel = typeof source.sliderMaxLabel === "string"
        ? sanitizeSingleLineInput(source.sliderMaxLabel, 40).trim()
        : undefined;

      const validColumnSpans = new Set(["auto", "1/4", "1/3", "1/2", "2/3", "full"]);
      const rawColumnSpan = typeof source.columnSpan === "string" && validColumnSpans.has(source.columnSpan)
        ? (source.columnSpan as AnamnesisField["columnSpan"])
        : undefined;

      const tagMode =
        source.tagMode === "single" ? "single" : type === "tags" ? "multiple" : undefined;
      const allowCustomTags =
        type === "tags" ? source.allowCustomTags !== false : typeof source.allowCustomTags === "boolean" ? source.allowCustomTags : undefined;

      const rawAddButtonLabel = typeof source.addButtonLabel === "string" ? source.addButtonLabel : undefined;
      const addButtonLabel = rawAddButtonLabel !== undefined
        ? sanitizeSingleLineInput(rawAddButtonLabel, INPUT_LIMITS.formFieldLabel).trim()
        : undefined;

      const rawHorizontalDisplayMode =
        typeof source.horizontalDisplayMode === "string" &&
        HORIZONTAL_DISPLAY_MODES.has(source.horizontalDisplayMode as HorizontalDisplayMode)
          ? (source.horizontalDisplayMode as HorizontalDisplayMode)
          : undefined;
      const horizontalDisplayMode =
        type === "horizontal_section" && rawHorizontalDisplayMode
          ? rawHorizontalDisplayMode
          : undefined;

      return {
        id: fieldId,
        label,
        type,
        groupKey: getOptionalStringValue(source.groupKey) ? sanitizeId(getStringValue(source.groupKey), "") || null : null,
        ...(helpText !== undefined ? { helpText } : {}),
        ...(placeholder !== undefined ? { placeholder } : {}),
        ...(addButtonLabel !== undefined ? { addButtonLabel } : {}),
        ...(source.includeInGlobalDashboard === true ? { includeInGlobalDashboard: true } : {}),
        ...(source.enableFilter === true ? { enableFilter: true } : {}),
        ...(source.enableGrouping === true ? { enableGrouping: true } : {}),
        required: source.required === true,
        showInPatientList: source.showInPatientList === true,
        ...(options ? { options } : {}),
        ...sliderRange,
        ...(rawSliderStep !== undefined ? { sliderStep: rawSliderStep } : {}),
        ...(rawSliderMinLabel !== undefined ? { sliderMinLabel: rawSliderMinLabel } : {}),
        ...(rawSliderMaxLabel !== undefined ? { sliderMaxLabel: rawSliderMaxLabel } : {}),
        ...(rawColumnSpan !== undefined ? { columnSpan: rawColumnSpan } : {}),
        sectionKey: getOptionalStringValue(source.sectionKey) ? sanitizeId(getStringValue(source.sectionKey), "") || null : null,
        ...(systemKey ? { systemKey } : {}),
        ...(rawAccentColor ? { accentColor: rawAccentColor } : {}),
        ...(rawAccentAlpha !== undefined ? { accentAlpha: rawAccentAlpha } : {}),
        ...(tagMode !== undefined ? { tagMode } : {}),
        ...(allowCustomTags !== undefined ? { allowCustomTags } : {}),
        ...(type === "calculated" && source.calculatedConfig ? { calculatedConfig: sanitizeCalculatedFieldConfig(source.calculatedConfig) } : {}),
        ...(horizontalDisplayMode ? { horizontalDisplayMode } : {}),
      };
    });

  const fieldMap = new Map<string, AnamnesisField>(fields.map((field) => [field.id, field]));
  const selectorOptionIds = new Set(
    fields
      .filter((field) => field.type === "section_selector")
      .flatMap((field) => field.options ?? [])
      .map((option) => option.id)
  );

  return fields.map((field) => {
    const groupTarget = field.groupKey && fieldMap.has(field.groupKey) ? field.groupKey : null;
    const groupField = groupTarget ? fieldMap.get(groupTarget) ?? null : null;
    const safeGroupKey =
      groupField && canContainerAcceptChild(groupField, field) && !isDescendantOf(fields, groupField.id, field.id, fieldMap)
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

export const compactAnamnesisTemplateSchema = (schema: AnamnesisTemplateSchema): Record<string, unknown>[] => {
  return schema.map((field) => {
    const compact: Record<string, unknown> = {
      id: field.id,
      label: field.label,
      type: field.type,
    };

    if (field.groupKey) compact.groupKey = field.groupKey;
    if (field.sectionKey) compact.sectionKey = field.sectionKey;
    if (field.required) compact.required = true;
    if (field.showInPatientList) compact.showInPatientList = true;
    if (field.helpText) compact.helpText = field.helpText;
    if (field.placeholder) compact.placeholder = field.placeholder;
    if (field.options && field.options.length > 0) compact.options = field.options;
    if (field.systemKey) compact.systemKey = field.systemKey;
    if (field.accentColor) compact.accentColor = field.accentColor;
    if (field.accentAlpha !== undefined && field.accentAlpha !== 100) compact.accentAlpha = field.accentAlpha;
    if (field.min !== undefined && field.min !== 0) compact.min = field.min;
    if (field.max !== undefined && field.max !== 10) compact.max = field.max;
    if (field.sliderStep !== undefined && field.sliderStep !== 1) compact.sliderStep = field.sliderStep;
    if (field.sliderMinLabel) compact.sliderMinLabel = field.sliderMinLabel;
    if (field.sliderMaxLabel) compact.sliderMaxLabel = field.sliderMaxLabel;
    if (field.columnSpan && field.columnSpan !== "auto") compact.columnSpan = field.columnSpan;
    if (field.tagMode && field.tagMode !== "multiple") compact.tagMode = field.tagMode;
    if (field.allowCustomTags !== undefined && field.allowCustomTags !== true) compact.allowCustomTags = field.allowCustomTags;
    if (field.addButtonLabel) compact.addButtonLabel = field.addButtonLabel;
    if (field.includeInGlobalDashboard) compact.includeInGlobalDashboard = true;
    if (field.enableFilter) compact.enableFilter = true;
    if (field.enableGrouping) compact.enableGrouping = true;
    if (field.calculatedConfig) compact.calculatedConfig = field.calculatedConfig;
    if (field.horizontalDisplayMode && field.horizontalDisplayMode !== "scroll") {
      compact.horizontalDisplayMode = field.horizontalDisplayMode;
    }

    return compact;
  });
};

/**
 * Remove campos nulos/padrões vazios para otimização de armazenamento no Postgres e no arquivo binário.
 */
export const pruneAnamnesisTemplateSchema = compactAnamnesisTemplateSchema;

/**
 * Reidrata um schema compacto recuperando todos os campos normalizados e valores padrão.
 */
export const hydrateAnamnesisTemplateSchema = (compactSchema: unknown): AnamnesisTemplateSchema => {
  return sanitizeAnamnesisTemplateSchema(compactSchema);
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
          const normalized = value
            .slice(0, ANAMNESIS_TABLE_ROW_LIMIT)
            .map((item) => {
              if (typeof item === "string") {
                const sanitized = sanitizeSingleLineInput(item, INPUT_LIMITS.formOptionLabel).trim();
                return sanitized.length > 0 ? sanitized : null;
              }

              if (item && typeof item === "object" && !Array.isArray(item)) {
                const rec = item as Record<string, unknown>;

                // Handle tag item object ({ id, label, color, colorSlotId })
                if ("label" in rec || "name" in rec) {
                  const rawLabel = typeof rec.label === "string" ? rec.label : typeof rec.name === "string" ? rec.name : "";
                  const rawId = typeof rec.id === "string" ? rec.id : "";
                  const rawColor = typeof rec.color === "string" ? sanitizeSingleLineInput(rec.color, 20).trim() : undefined;
                  const rawSlotId = typeof rec.colorSlotId === "string" && rec.colorSlotId.trim() ? sanitizeId(rec.colorSlotId, "") : undefined;
                  const sanitizedLabel = sanitizeSingleLineInput(rawLabel, INPUT_LIMITS.formOptionLabel).trim();

                  if (!sanitizedLabel) return null;

                  return {
                    id: sanitizeId(rawId, "tag"),
                    label: sanitizedLabel,
                    ...(rawColor ? { color: rawColor } : {}),
                    ...(rawSlotId ? { colorSlotId: rawSlotId } : {}),
                  } as AnamnesisTagItem;
                }

                // Handle table row object
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
            })
            .filter((item): item is string | AnamnesisTableRow | AnamnesisTagItem => item !== null);

          return [safeFieldId, normalized];
        }

        if (value && typeof value === "object" && !Array.isArray(value)) {
          const rec = value as Record<string, unknown>;

          // Calculated field response ({ inputs, outputs })
          if ("inputs" in rec || "outputs" in rec) {
            const rawInputs = isPlainRecord(rec.inputs) ? rec.inputs : {};
            const rawOutputs = isPlainRecord(rec.outputs) ? rec.outputs : {};

            const sanitizedInputs: Record<string, number | null> = {};
            for (const [k, v] of Object.entries(rawInputs)) {
              sanitizedInputs[sanitizeSingleLineInput(k, 10).toUpperCase()] =
                typeof v === "number" && Number.isFinite(v) ? v : null;
            }

            const sanitizedOutputs: Record<string, number | null> = {};
            for (const [k, v] of Object.entries(rawOutputs)) {
              sanitizedOutputs[sanitizeSingleLineInput(k, 50)] =
                typeof v === "number" && Number.isFinite(v) ? v : null;
            }

            return [safeFieldId, { inputs: sanitizedInputs, outputs: sanitizedOutputs }];
          }

          // Image annotation field response ({ baseImageUrl, annotations, ... })
          if ("baseImageUrl" in rec || "annotations" in rec) {
            const rawBaseImageUrl = typeof rec.baseImageUrl === "string" ? rec.baseImageUrl.trim() : "";
            const rawAnnotations = Array.isArray(rec.annotations) ? rec.annotations : [];

            const sanitizedAnnotations: ClinicalAnnotationShape[] = rawAnnotations
              .slice(0, 100)
              .map((shapeItem, shapeIdx): ClinicalAnnotationShape | null => {
                if (!shapeItem || typeof shapeItem !== "object") return null;
                const s = shapeItem as Record<string, unknown>;
                const rawType = String(s.type || "pin");
                const normalizedType = rawType === "pen" ? "freehand" : rawType;
                const validTypes = new Set([
                  "freehand",
                  "highlighter",
                  "arrow",
                  "line",
                  "rect",
                  "circle",
                  "triangle",
                  "cross",
                  "text",
                  "pin",
                ]);
                const type = (validTypes.has(normalizedType) ? normalizedType : "pin") as ClinicalAnnotationShape["type"];

                const rawPoints = Array.isArray(s.points) ? s.points : undefined;
                const sanitizedPoints: [number, number][] | undefined = rawPoints
                  ? rawPoints
                      .slice(0, 500)
                      .map((pt): [number, number] | null =>
                        Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === "number" && typeof pt[1] === "number"
                          ? [Math.max(0, Math.min(1000, Math.round(pt[0]))), Math.max(0, Math.min(1000, Math.round(pt[1])))]
                          : null
                      )
                      .filter((pt): pt is [number, number] => pt !== null)
                  : undefined;

                return {
                  id: sanitizeId(String(s.id || `shape_${shapeIdx + 1}`), `shape_${shapeIdx + 1}`),
                  type,
                  x: typeof s.x === "number" && Number.isFinite(s.x) ? Math.max(0, Math.min(1000, Math.round(s.x))) : 0,
                  y: typeof s.y === "number" && Number.isFinite(s.y) ? Math.max(0, Math.min(1000, Math.round(s.y))) : 0,
                  width: typeof s.width === "number" && Number.isFinite(s.width) ? Math.max(-1000, Math.min(1000, Math.round(s.width))) : undefined,
                  height: typeof s.height === "number" && Number.isFinite(s.height) ? Math.max(-1000, Math.min(1000, Math.round(s.height))) : undefined,
                  points: sanitizedPoints,
                  strokeColor: typeof s.strokeColor === "string" ? sanitizeSingleLineInput(s.strokeColor, 25).trim() : "#EF4444",
                  fillColor: typeof s.fillColor === "string" ? sanitizeSingleLineInput(s.fillColor, 25).trim() : undefined,
                  strokeWidth: typeof s.strokeWidth === "number" && Number.isFinite(s.strokeWidth) ? Math.max(1, Math.min(100, Math.round(s.strokeWidth))) : 4,
                  strokeStyle: s.strokeStyle === "dashed" || s.strokeStyle === "dotted" ? s.strokeStyle : "solid",
                  text: typeof s.text === "string" ? sanitizeSingleLineInput(s.text, 200).trim() : undefined,
                  pinNumber: typeof s.pinNumber === "number" && Number.isFinite(s.pinNumber) ? Math.max(1, Math.round(s.pinNumber)) : undefined,
                  label: typeof s.label === "string" ? sanitizeSingleLineInput(s.label, 120).trim() : undefined,
                  comment: typeof s.comment === "string" ? sanitizeMultilineInput(s.comment, 500).trim() : undefined,
                  severity:
                    s.severity === "low" || s.severity === "medium" || s.severity === "high" || s.severity === "critical"
                      ? s.severity
                      : undefined,
                  severityScore:
                    typeof s.severityScore === "number" && Number.isFinite(s.severityScore)
                      ? Math.max(0, Math.min(100, Math.round(s.severityScore)))
                      : undefined,
                };
              })
              .filter((shape): shape is ClinicalAnnotationShape => shape !== null);

            const sanitizedAnnotationValue: ClinicalImageAnnotationValue = {
              baseImageId: typeof rec.baseImageId === "string" ? sanitizeId(rec.baseImageId, "") : undefined,
              baseImageUrl: rawBaseImageUrl,
              baseImageWidth: typeof rec.baseImageWidth === "number" && Number.isFinite(rec.baseImageWidth) ? rec.baseImageWidth : 1920,
              baseImageHeight: typeof rec.baseImageHeight === "number" && Number.isFinite(rec.baseImageHeight) ? rec.baseImageHeight : 1080,
              annotations: sanitizedAnnotations,
              updatedAt: typeof rec.updatedAt === "string" ? sanitizeSingleLineInput(rec.updatedAt, 50).trim() : undefined,
              sourceSessionId: typeof rec.sourceSessionId === "string" ? sanitizeId(rec.sourceSessionId, "") : undefined,
            };

            return [safeFieldId, sanitizedAnnotationValue];
          }

          const addrRec = value as AddressBlockValue;
          const sanitizedAddress: AddressBlockValue = {
            cep: addrRec.cep ? sanitizeSingleLineInput(String(addrRec.cep), 20).trim() : "",
            state: addrRec.state ? sanitizeSingleLineInput(String(addrRec.state), 10).trim().toUpperCase() : "",
            city: addrRec.city ? sanitizeSingleLineInput(String(addrRec.city), 100).trim() : "",
            neighborhood: addrRec.neighborhood ? sanitizeSingleLineInput(String(addrRec.neighborhood), 100).trim() : "",
            street: addrRec.street ? sanitizeSingleLineInput(String(addrRec.street), 200).trim() : "",
            number: addrRec.number ? sanitizeSingleLineInput(String(addrRec.number), 50).trim() : "",
            complement: addrRec.complement ? sanitizeSingleLineInput(String(addrRec.complement), 100).trim() : "",
            locationType: addrRec.locationType === "clinic" || addrRec.locationType === "home_visit" ? addrRec.locationType : "custom",
            clinicId: addrRec.clinicId ? sanitizeId(String(addrRec.clinicId), "clinic") : null,
            clinicName: addrRec.clinicName ? sanitizeSingleLineInput(String(addrRec.clinicName), 100).trim() : undefined,
            latitude: typeof addrRec.latitude === "number" && Number.isFinite(addrRec.latitude) ? addrRec.latitude : null,
            longitude: typeof addrRec.longitude === "number" && Number.isFinite(addrRec.longitude) ? addrRec.longitude : null,
            accuracy: typeof addrRec.accuracy === "number" && Number.isFinite(addrRec.accuracy) ? addrRec.accuracy : null,
            capturedAt: addrRec.capturedAt ? sanitizeSingleLineInput(String(addrRec.capturedAt), 50).trim() : null,
          };
          return [safeFieldId, sanitizedAddress];
        }

        return [safeFieldId, null];
      })
  );


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
      (!field.horizontalDisplayMode ||
        (typeof field.horizontalDisplayMode === "string" &&
          HORIZONTAL_DISPLAY_MODES.has(field.horizontalDisplayMode as HorizontalDisplayMode))) &&
      (!field.options ||
        (Array.isArray(field.options) &&
          field.options.length <= ANAMNESIS_OPTION_LIMIT &&
          field.options.every((option) => isPlainRecord(option) && typeof option.id === "string" && typeof option.label === "string")))
    );
  });
};

