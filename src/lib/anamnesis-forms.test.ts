import { describe, expect, it } from "vitest";
import {
  buildTemplateLayout,
  countTemplateQuestionFields,
  countTemplateSections,
  createDefaultTemplateSchema,
  getVisibleTemplateFields,
  isAnamnesisTemplateSchema,
  normalizeOptions,
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
      { id: "field_1", label: "Queixa", type: "long_text" },
      { id: "field_2", label: "Dor", type: "slider" },
    ];

    expect(countTemplateSections(schema)).toBe(1);
    expect(countTemplateQuestionFields(schema)).toBe(2);
  });

  it("normalizes line-based options", () => {
    expect(normalizeOptions("Uma\n\nDuas\n Três ")).toEqual([
      { id: "option_1", label: "Uma" },
      { id: "option_2", label: "Duas" },
      { id: "option_3", label: "Três" },
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
        items: [schema[1]],
        type: "section",
      },
      {
        field: schema[2],
        type: "field",
      },
    ]);
  });
});
