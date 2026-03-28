import { describe, expect, it } from "vitest";
import { buildSessionPayload } from "@/lib/session-payload";

describe("buildSessionPayload", () => {
  it("uses the creator user id for both author and provider fields", () => {
    const payload = buildSessionPayload({
      clinicId: "clinic-1",
      patientId: "patient-1",
      creatorUserId: "creator-123",
      values: {
        anamnesisFormResponse: {},
        anamnesisTemplateId: null,
        complexityScore: 4,
        groupId: "group-1",
        notes: "Observacao livre",
        observacoes: "Observacao clinica",
        painScore: 7,
        queixa: "Dor lombar",
        sintomas: "Rigidez matinal",
        status: "rascunho",
        treatmentBlocks: [],
        treatmentGeneralGuidance: "",
      },
    });

    expect(payload.user_id).toBe("creator-123");
    expect(payload.provider_id).toBe("creator-123");
  });
});
