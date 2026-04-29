import { describe, expect, it } from "vitest";
import {
  addOptionMatrixRow,
  addOptionToMatrixRow,
  addOptionToVerticalList,
  addTableRow,
  ANAMNESIS_FIELD_LIBRARY,
  buildAnamnesisTemplateExchangeFileName,
  buildAnamnesisTemplateExchangePayload,
  buildTemplateLayout,
  countTemplateQuestionFields,
  countTemplateSections,
  createDefaultTemplateSchema,
  createAnamnesisField,
  getOptionMatrixRows,
  getTableRows,
  getVerticalOptionList,
  getAssignableContainerFields,
  hasScrollableOptionEditor,
  hasVerticalOptionEditor,
  getVisibleTemplateFields,
  isAnamnesisTemplateSchema,
  isSelectionChoiceFieldType,
  parseAnamnesisTemplateExchangePayload,
  normalizeOptions,
  removeOptionFromMatrix,
  removeOptionFromVerticalList,
  removeTableRow,
  updateTableCellValue,
  updateOptionMatrixLabel,
  updateVerticalOptionLabel,
  toggleSelectionChoiceFieldType,
  type AnamnesisTemplateSchema,
} from "@/lib/anamnesis-forms";

describe("anamnesis forms helpers", () => {
  it("shows section-bound fields only when their selector toggle is active", () => {
    const schema: AnamnesisTemplateSchema = [
      {
        id: "selector",
        label: "Assuntos",
        type: "section_selector",
        options: [
          { id: "respiratorio", label: "Respiratório" },
          { id: "postural", label: "Postural" },
        ],
      },
      {
        id: "general",
        label: "Resumo",
        type: "long_text",
      },
      {
        id: "posture_details",
        label: "Avaliação postural",
        type: "long_text",
        sectionKey: "postural",
      },
    ];

    expect(getVisibleTemplateFields(schema, { selector: ["postural"] }).map((field) => field.id)).toEqual([
      "selector",
      "general",
      "posture_details",
    ]);

    expect(getVisibleTemplateFields(schema, { selector: ["respiratorio"] }).map((field) => field.id)).toEqual([
      "selector",
      "general",
    ]);
  });

  it("counts question fields and sections separately", () => {
    const schema: AnamnesisTemplateSchema = [
      { id: "section_1", label: "Contexto", type: "section" },
      { id: "section_2", label: "Linha do tempo", type: "horizontal_section" },
      { id: "field_1", label: "Queixa", type: "long_text" },
      { id: "field_2", label: "Dor", type: "slider" },
    ];

    expect(countTemplateSections(schema)).toBe(2);
    expect(countTemplateQuestionFields(schema)).toBe(2);
  });

  it("normalizes semicolon and line-based options", () => {
    expect(normalizeOptions("Uma; Duas\n\n Três ;Quatro")).toEqual([
      { id: "option_1", label: "Uma", row: 0 },
      { id: "option_2", label: "Duas", row: 0 },
      { id: "option_3", label: "Três", row: 2 },
      { id: "option_4", label: "Quatro", row: 2 },
    ]);
  });

  it("builds a default template schema for new forms", () => {
    const schema = createDefaultTemplateSchema();

    expect(isAnamnesisTemplateSchema(schema)).toBe(true);
    expect(schema).toHaveLength(6);
    expect(schema[0]?.type).toBe("section");
    expect(schema[1]?.label).toBe("Queixa principal");
  });

  it("creates table fields with default columns", () => {
    expect(createAnamnesisField("table", 0)).toMatchObject({
      type: "table",
      label: "Nova tabela",
      options: [
        { label: "Coluna 1" },
        { label: "Coluna 2" },
      ],
    });
  });

  it("creates date fields", () => {
    expect(createAnamnesisField("date", 0)).toMatchObject({
      type: "date",
      label: "Novo campo 1",
    });
  });

  it("exposes date in the field library", () => {
    expect(ANAMNESIS_FIELD_LIBRARY.some((field) => field.type === "date" && field.label === "Data")).toBe(true);
  });

  it("exports and re-imports a template model without changing its schema", () => {
    const schema = createDefaultTemplateSchema();
    const payload = buildAnamnesisTemplateExchangePayload({
      description: "Triagem inicial",
      kind: "template",
      name: "Ficha ortopédica",
      schema,
    });

    expect(parseAnamnesisTemplateExchangePayload(JSON.stringify(payload))).toEqual(payload);
  });

  it("rejects invalid imported template models", () => {
    expect(() => parseAnamnesisTemplateExchangePayload(JSON.stringify({ foo: "bar" }))).toThrow(
      "Arquivo de modelo inválido"
    );
  });

  it("builds a predictable export file name", () => {
    expect(buildAnamnesisTemplateExchangeFileName("template", "Ficha ortopédica inicial")).toBe(
      "pronto-health-fisio-modelo-ficha-ortopedica-inicial.json"
    );
    expect(buildAnamnesisTemplateExchangeFileName("base", "Bloco padrão universal")).toBe(
      "pronto-health-fisio-modelo-bloco-padrao-universal.json"
    );
  });

  it("groups fields inside sections in layout order", () => {
    const schema: AnamnesisTemplateSchema = [
      { id: "section_1", label: "Contexto", type: "section" },
      { groupKey: "section_1", id: "field_1", label: "Queixa", type: "long_text" },
      { id: "field_2", label: "Resumo livre", type: "long_text" },
    ];

    expect(buildTemplateLayout(schema)).toEqual([
      {
        field: schema[0],
        items: [
          {
            field: schema[1],
            type: "field",
          },
        ],
        type: "section",
      },
      {
        field: schema[2],
        type: "field",
      },
    ]);
  });

  it("builds nested sections and horizontal sections recursively", () => {
    const schema: AnamnesisTemplateSchema = [
      { id: "section_1", label: "Contexto", type: "section" },
      { id: "section_2", groupKey: "section_1", label: "Histórico", type: "section" },
      { id: "field_1", groupKey: "section_2", label: "Queixa", type: "long_text" },
      { id: "section_3", groupKey: "section_1", label: "Linha do tempo", type: "horizontal_section" },
      { id: "field_2", groupKey: "section_3", label: "Início", type: "short_text" },
      { id: "field_3", groupKey: "section_3", label: "Piora", type: "short_text" },
    ];

    expect(buildTemplateLayout(schema)).toEqual([
      {
        field: schema[0],
        items: [
          {
            field: schema[1],
            items: [{ field: schema[2], type: "field" }],
            type: "section",
          },
          {
            field: schema[3],
            items: [
              { field: schema[4], type: "field" },
              { field: schema[5], type: "field" },
            ],
            type: "horizontal_section",
          },
        ],
        type: "section",
      },
    ]);
  });

  it("does not allow nesting sections inside horizontal sections", () => {
    const schema: AnamnesisTemplateSchema = [
      { id: "section_1", label: "Contexto", type: "section" },
      { id: "section_2", label: "Linha do tempo", type: "horizontal_section" },
      { id: "section_3", label: "Subseção", type: "section" },
      { id: "field_1", label: "Sintoma", type: "short_text" },
    ];

    expect(getAssignableContainerFields(schema, "section_3").map((field) => field.id)).toEqual(["section_1"]);
    expect(getAssignableContainerFields(schema, "field_1").map((field) => field.id)).toEqual(["section_1", "section_2", "section_3"]);
  });

  it("uses the scrollable matrix editor only for checklist and multiple choice options", () => {
    expect(hasScrollableOptionEditor("checklist")).toBe(true);
    expect(hasScrollableOptionEditor("multiple_choice")).toBe(true);
    expect(hasScrollableOptionEditor("select")).toBe(false);
    expect(hasScrollableOptionEditor("section_selector")).toBe(false);
  });

  it("uses the vertical option editor only for droplists", () => {
    expect(hasVerticalOptionEditor("select")).toBe(true);
    expect(hasVerticalOptionEditor("checklist")).toBe(false);
    expect(hasVerticalOptionEditor("multiple_choice")).toBe(false);
    expect(hasVerticalOptionEditor("section_selector")).toBe(false);
  });

  it("identifies and toggles selection-only choice field types", () => {
    expect(isSelectionChoiceFieldType("checklist")).toBe(true);
    expect(isSelectionChoiceFieldType("multiple_choice")).toBe(true);
    expect(isSelectionChoiceFieldType("select")).toBe(false);

    expect(toggleSelectionChoiceFieldType("checklist")).toBe("multiple_choice");
    expect(toggleSelectionChoiceFieldType("multiple_choice")).toBe("checklist");
    expect(toggleSelectionChoiceFieldType("select")).toBe("select");
  });

  it("builds and updates option matrices by row", () => {
    const parsed = normalizeOptions("Dor; Rigidez\nFormigamento");

    expect(getOptionMatrixRows(parsed)).toEqual([
      {
        rowIndex: 0,
        items: [
          { id: "option_1", label: "Dor", row: 0 },
          { id: "option_2", label: "Rigidez", row: 0 },
        ],
      },
      {
        rowIndex: 1,
        items: [{ id: "option_3", label: "Formigamento", row: 1 }],
      },
    ]);

    const withExtraColumn = addOptionToMatrixRow(parsed, 1);
    const withExtraRow = addOptionMatrixRow(withExtraColumn);
    const updated = updateOptionMatrixLabel(withExtraRow, withExtraRow[3]!.id, "Dormência");

    expect(getOptionMatrixRows(updated)[1]?.items).toHaveLength(2);
    expect(getOptionMatrixRows(updated)[2]?.items).toHaveLength(1);
    expect(updated.some((option) => option.label === "Dormência")).toBe(true);
  });

  it("keeps at least one matrix option when removing items", () => {
    expect(removeOptionFromMatrix([{ id: "option_1", label: "Dor", row: 0 }], "option_1")).toEqual([
      { id: "option_1", label: "Opção 1", row: 0 },
    ]);
  });

  it("builds and updates a vertical option list", () => {
    const base = getVerticalOptionList([{ id: "option_1", label: "Manhã" }]);
    const extended = addOptionToVerticalList(base);
    const relabeled = updateVerticalOptionLabel(extended, extended[1]!.id, "Noite");

    expect(base).toEqual([{ id: "option_1", label: "Manhã", row: 0 }]);
    expect(relabeled).toHaveLength(2);
    expect(relabeled[1]?.label).toBe("Noite");
  });

  it("keeps at least one vertical option when removing items", () => {
    expect(removeOptionFromVerticalList([{ id: "option_1", label: "Única", row: 0 }], "option_1")).toEqual([
      { id: "option_1", label: "Opção 1", row: 0 },
    ]);
  });

  it("builds and updates table rows using the fixed columns", () => {
    const field = createAnamnesisField("table", 0);
    const baseRows = getTableRows(field);
    const updatedRows = updateTableCellValue(baseRows, 0, field.options?.[0]?.id ?? "", "Agachamento");
    const withSecondRow = addTableRow(updatedRows, field);

    expect(baseRows).toEqual([{ [field.options?.[0]?.id ?? ""]: "", [field.options?.[1]?.id ?? ""]: "" }]);
    expect(updatedRows[0]?.[field.options?.[0]?.id ?? ""]).toBe("Agachamento");
    expect(withSecondRow).toHaveLength(2);
  });

  it("keeps at least one table row when removing rows", () => {
    const field = createAnamnesisField("table", 0);
    const rows = getTableRows(field);

    expect(removeTableRow(rows, 0, field)).toEqual(rows);
  });
});
