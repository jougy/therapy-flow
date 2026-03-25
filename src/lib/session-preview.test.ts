import { describe, expect, it } from "vitest";
import { getSessionPreviewContent } from "@/lib/session-preview";
import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";

describe("getSessionPreviewContent", () => {
  it("combines complaint and treatment content from session data", () => {
    const result = getSessionPreviewContent({
      anamnesis: {
        observacoes: "Dor piora ao sentar",
        queixa: "Dor lombar",
        sintomas: "Rigidez matinal",
      },
      notes: "Retorno em sete dias",
      pain_score: 7,
      complexity_score: 4,
      treatment: {
        descricao: "Mobilizacao e alongamento",
        orientacoes: "Exercicios domiciliares",
      },
    });

    expect(result.complaint).toBe("Dor lombar\n\nRigidez matinal\n\nDor piora ao sentar");
    expect(result.treatment).toBe("Mobilizacao e alongamento\n\nExercicios domiciliares\n\nRetorno em sete dias");
  });

  it("returns empty strings when no preview fields are available", () => {
    const result = getSessionPreviewContent({
      anamnesis: null,
      pain_score: null,
      complexity_score: null,
      notes: null,
      treatment: null,
    });

    expect(result.complaint).toBe("");
    expect(result.treatment).toBe("");
  });

  it("respects the selected universal fields for the patient session list", () => {
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
      pain_score: 8,
      complexity_score: 2,
      notes: null,
      treatment: null,
    }, baseSchema);

    expect(result.complaint).toBe("Queixa principal: Dor lombar\n\nNota da dor: 8/10");
  });
});
