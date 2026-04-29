import { describe, expect, it } from "vitest";
import {
  buildSessionPayload,
  formatDateTimeForInput,
  parseDateTimeInputValue,
} from "@/lib/session-payload";

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

  it("persists a custom session date and keeps datetime-local formatting stable", () => {
    const expectedIso = new Date("2026-04-15T10:30").toISOString();
    const payload = buildSessionPayload({
      clinicId: "clinic-1",
      patientId: "patient-1",
      creatorUserId: "creator-123",
      sessionDate: "2026-04-15T10:30",
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

    expect(payload.session_date).toBe(expectedIso);
    expect(formatDateTimeForInput(expectedIso)).toBe("2026-04-15T10:30");
    expect(parseDateTimeInputValue("2026-04-15T10:30")).toBe(expectedIso);
  });
});
