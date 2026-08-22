import { describe, it, expect } from "vitest";
import { detectSuggestedCareLine, CARE_LINE_PRESETS } from "@/lib/care-lines-classifier";

describe("care-lines-classifier", () => {
  it("detects Coluna / Lombalgia when input contains 'lombar' or 'hérnia'", () => {
    const suggestion1 = detectSuggestedCareLine("Paciente relata dor intensa na região lombar ao se inclinar", null, []);
    expect(suggestion1).not.toBeNull();
    expect(suggestion1?.preset.id).toBe("coluna");

    const suggestion2 = detectSuggestedCareLine("Diagnóstico prévio de hérnia de disco L4-L5", null, []);
    expect(suggestion2?.preset.id).toBe("coluna");
  });

  it("detects Reabilitação Ortopédica when input contains 'ombro', 'manguito' or 'pós-operatório'", () => {
    const suggestion = detectSuggestedCareLine("Pós-operatório de reconstrução de manguito rotador do ombro", null, []);
    expect(suggestion).not.toBeNull();
    expect(suggestion?.preset.id).toBe("ortopedia");
  });

  it("detects Fisioterapia Pélvica when input mentions 'incontinência' or 'pós-parto'", () => {
    const suggestion = detectSuggestedCareLine("Paciente com queixa de incontinência urinária após o parto", null, []);
    expect(suggestion).not.toBeNull();
    expect(suggestion?.preset.id).toBe("pelvica");
  });

  it("returns null if the care line is already selected", () => {
    const existingGroups = [
      { id: "grp-coluna", name: "Coluna / Lombalgia", color: "blue", patient_id: "p1", created_at: "", clinic_id: "c1", description: null, is_active: true, status: "active", updated_at: "" },
    ];
    const suggestion = detectSuggestedCareLine("Dor lombar crônica", "grp-coluna", existingGroups);
    expect(suggestion).toBeNull();
  });

  it("prioritizes an existing patient group when matched directly", () => {
    const existingGroups = [
      { id: "grp-custom", name: "Recuperação de Joelho", color: "purple", patient_id: "p1", created_at: "", clinic_id: "c1", description: null, is_active: true, status: "active", updated_at: "" },
    ];
    const suggestion = detectSuggestedCareLine("Paciente segue em recuperação de joelho após trauma", null, existingGroups);
    expect(suggestion).not.toBeNull();
    expect(suggestion?.matchedExistingGroup?.id).toBe("grp-custom");
  });
});
