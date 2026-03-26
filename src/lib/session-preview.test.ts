import { describe, expect, it } from "vitest";
import { getSessionPreviewContent, getSessionPreviewIndicators, getSessionSummaryContent } from "@/lib/session-preview";
import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";

describe("getSessionPreviewContent", () => {
  it("combines complaint and treatment content from session data", () => {
    const result = getSessionPreviewContent({
      anamnesis: {
        observacoes: "Dor piora ao sentar",
        queixa: "Dor lombar",
        sintomas: "Rigidez matinal",
      },
      anamnesis_form_response: null,
      notes: "Retorno em sete dias",
      pain_score: 7,
      complexity_score: 4,
      treatment: {
        blocks: [
          {
            duration: "por 15 dias",
            frequency: "a cada 8h",
            id: "block-1",
            instructions: "Aplicar gelo depois",
            name: "Mobilizacao e alongamento",
            repetitions: "12",
            series: "3",
          },
        ],
        general_guidance: "Exercicios domiciliares",
      },
    });

    expect(result.complaint).toBe("Dor lombar\n\nRigidez matinal\n\nDor piora ao sentar");
    expect(result.treatment).toBe(
      "Mobilizacao e alongamento | a cada 8h | por 15 dias | 3 series | 12 repeticoes | Aplicar gelo depois\n\nOrientacoes gerais: Exercicios domiciliares\n\nRetorno em sete dias"
    );
  });

  it("returns empty strings when no preview fields are available", () => {
    const result = getSessionPreviewContent({
      anamnesis: null,
      anamnesis_form_response: null,
      pain_score: null,
      complexity_score: null,
      notes: null,
      treatment: null,
    });

    expect(result.complaint).toBe("");
    expect(result.treatment).toBe("");
  });

  it("keeps slider indicators out of the text summary", () => {
    const baseSchema: AnamnesisTemplateSchema = [
      { id: "queixa", label: "Queixa principal", type: "long_text", systemKey: "queixa", showInPatientList: true },
      { id: "dor", label: "Nota da dor", type: "slider", systemKey: "pain_score", showInPatientList: true },
      { id: "obs", label: "Observações", type: "long_text", systemKey: "observacoes", showInPatientList: false },
    ];

    const result = getSessionPreviewContent({
      anamnesis: {
        observacoes: "Piora ao sentar",
        queixa: "Dor lombar",
      },
      anamnesis_form_response: null,
      pain_score: 8,
      complexity_score: 2,
      notes: null,
      treatment: null,
    }, baseSchema);

    expect(result.complaint).toBe("Queixa principal: Dor lombar");
  });

  it("shows custom base fields in the patient session list when marked as visible", () => {
    const baseSchema: AnamnesisTemplateSchema = [
      { id: "custom_history", label: "Historico esportivo", type: "long_text", showInPatientList: true },
      { id: "custom_hidden", label: "Campo interno", type: "short_text", showInPatientList: false },
    ];

    const result = getSessionPreviewContent(
      {
        anamnesis: null,
        anamnesis_form_response: {
          custom_hidden: "Nao mostrar",
          custom_history: "Corredor ha 10 anos",
        },
        pain_score: null,
        complexity_score: null,
        notes: null,
        treatment: null,
      },
      baseSchema
    );

    expect(result.complaint).toBe("Historico esportivo: Corredor ha 10 anos");
  });
});

describe("getSessionPreviewIndicators", () => {
  it("returns visible slider indicators from the universal base schema", () => {
    const baseSchema: AnamnesisTemplateSchema = [
      { id: "pain_score", label: "Dor", type: "slider", systemKey: "pain_score", showInPatientList: true, min: 0, max: 10 },
      { id: "fatigue", label: "Fadiga", type: "slider", showInPatientList: true, min: 0, max: 5 },
      { id: "hidden", label: "Oculto", type: "slider", showInPatientList: false, min: 0, max: 10 },
    ];

    expect(
      getSessionPreviewIndicators(
        {
          anamnesis_form_response: { fatigue: 3, hidden: 9 },
          complexity_score: 1,
          pain_score: 7,
        },
        baseSchema
      )
    ).toEqual([
      { id: "pain_score", label: "Dor", score: 7, min: 0, max: 10 },
      { id: "fatigue", label: "Fadiga", score: 3, min: 0, max: 5 },
    ]);
  });
});

describe("getSessionSummaryContent", () => {
  it("includes answers from the selected complementary anamnesis form in the saved session summary", () => {
    const baseSchema: AnamnesisTemplateSchema = [
      { id: "queixa", label: "Queixa principal", type: "long_text", systemKey: "queixa", showInPatientList: true },
    ];
    const extraSchema: AnamnesisTemplateSchema = [
      { id: "sec_1", label: "Avaliação complementar", type: "section" },
      { id: "history", label: "Histórico funcional", type: "long_text", groupKey: "sec_1" },
      {
        id: "progress",
        label: "Evolução percebida",
        type: "select",
        options: [
          { id: "stable", label: "Estável" },
          { id: "improving", label: "Melhorando" },
        ],
      },
    ];

    const result = getSessionSummaryContent(
      {
        anamnesis: {
          queixa: "Dor lombar",
        },
        anamnesis_form_response: {
          history: "Paciente relata piora ao levantar cedo",
          progress: "improving",
        },
      },
      baseSchema,
      extraSchema
    );

    expect(result).toBe(
      "Queixa principal: Dor lombar\n\nHistórico funcional: Paciente relata piora ao levantar cedo\n\nEvolução percebida: Melhorando"
    );
  });
});
