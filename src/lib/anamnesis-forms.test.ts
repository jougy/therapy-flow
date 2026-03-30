import { describe, expect, it } from "vitest";
import {
  addOptionMatrixRow,
  addOptionToMatrixRow,
  addOptionToVerticalList,
  buildTemplateLayout,
  countTemplateQuestionFields,
  countTemplateSections,
  createDefaultTemplateSchema,
  getOptionMatrixRows,
  getVerticalOptionList,
  getAssignableContainerFields,
  hasScrollableOptionEditor,
  hasVerticalOptionEditor,
  getVisibleTemplateFields,
  isAnamnesisTemplateSchema,
  normalizeOptions,
  removeOptionFromMatrix,
  removeOptionFromVerticalList,
  updateOptionMatrixLabel,
  updateVerticalOptionLabel,
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
});
