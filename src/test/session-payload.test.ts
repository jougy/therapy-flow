import { describe, expect, it } from "vitest";

import { buildSessionPayload, isCompletedSessionLocked, type SessionFormValues } from "@/lib/session-payload";

const formValues: SessionFormValues = {
  complexityScore: 6,
  descricaoTratamento: "Mobilizacao e orientacoes",
  groupId: "group-1",
  notes: "Paciente respondeu bem",
  observacoes: "Sem edema",
  orientacoes: "Alongar 2x ao dia",
  painScore: 4,
  queixa: "Dor lombar",
  selectedTechniques: ["Mobilização articular", "Alongamento"],
  sintomas: "Rigidez matinal",
  status: "concluído",
};

describe("session payload helpers", () => {
  it("builds the regular save payload from the current form values", () => {
    const payload = buildSessionPayload({
      clinicId: "clinic-1",
      patientId: "patient-1",
      userId: "user-1",
      values: formValues,
    });

    expect(payload).toMatchObject({
      clinic_id: "clinic-1",
      complexity_score: 6,
      group_id: "group-1",
      notes: "Paciente respondeu bem",
      pain_score: 4,
      patient_id: "patient-1",
      status: "concluído",
      user_id: "user-1",
    });
    expect(payload.anamnesis).toEqual({
      observacoes: "Sem edema",
      queixa: "Dor lombar",
      sintomas: "Rigidez matinal",
    });
    expect(payload.treatment).toEqual({
      descricao: "Mobilizacao e orientacoes",
      orientacoes: "Alongar 2x ao dia",
      techniques: ["Mobilização articular", "Alongamento"],
    });
  });

  it("can force a duplicated session to start as rascunho", () => {
    const payload = buildSessionPayload({
      clinicId: "clinic-1",
      patientId: "patient-1",
      userId: "user-1",
      values: formValues,
      statusOverride: "rascunho",
    });

    expect(payload.status).toBe("rascunho");
    expect(payload.treatment).not.toBeNull();
    if (payload.treatment && typeof payload.treatment === "object" && !Array.isArray(payload.treatment)) {
      expect(payload.treatment.techniques).toEqual(["Mobilização articular", "Alongamento"]);
      expect(payload.treatment.techniques).not.toBe(formValues.selectedTechniques);
    }
  });

  it("locks only concluded sessions that already exist", () => {
    expect(isCompletedSessionLocked(false, "concluído")).toBe(true);
    expect(isCompletedSessionLocked(false, "rascunho")).toBe(false);
    expect(isCompletedSessionLocked(true, "concluído")).toBe(false);
  });
});
