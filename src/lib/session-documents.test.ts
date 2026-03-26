import { describe, expect, it } from "vitest";
import {
  buildSessionDocument,
  isSessionImmutable,
  type SessionDocumentData,
  type SessionDocumentKind,
} from "@/lib/session-documents";

const baseData: SessionDocumentData = {
  patientName: "Maria Souza",
  sessionDate: "25/03/2026",
  anamnesisSummary: "Queixa principal: Dor lombar\nSintomas: Rigidez matinal",
  treatmentSummary: "Alongamento lombar | a cada 8h | por 15 dias",
  quickNotes: "Paciente relata melhora parcial.",
};

describe("isSessionImmutable", () => {
  it("locks any saved status that is not draft", () => {
    expect(isSessionImmutable(false, "rascunho")).toBe(false);
    expect(isSessionImmutable(false, "concluído")).toBe(true);
    expect(isSessionImmutable(false, "cancelado")).toBe(true);
  });
});

describe("buildSessionDocument", () => {
  it.each<SessionDocumentKind>(["anamnesis", "treatment", "combined"])(
    "builds printable content for %s",
    (kind) => {
      const result = buildSessionDocument(kind, baseData);

      expect(result.title).toContain("Maria Souza");
      expect(result.html).toContain("<html");
      expect(result.text).toContain("Maria Souza");
    }
  );

  it("limits the content to the selected document section", () => {
    const treatmentOnly = buildSessionDocument("treatment", baseData);

    expect(treatmentOnly.text).toContain("Tratamento");
    expect(treatmentOnly.text).not.toContain("Anamnese");
    expect(treatmentOnly.text).toContain("Paciente relata melhora parcial.");
  });
});
