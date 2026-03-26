import { describe, expect, it } from "vitest";
import {
  buildSessionDocument,
  buildSessionDocumentFileName,
  buildSessionDocumentModel,
  isSessionImmutable,
  renderSessionDocumentHtml,
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

  it("builds a structured model with the expected sections", () => {
    const result = buildSessionDocumentModel("combined", baseData);

    expect(result.title).toBe("Atendimento - Maria Souza - 25/03/2026");
    expect(result.subtitle).toBe("Atendimento em 25/03/2026");
    expect(result.sections).toEqual([
      { title: "Anamnese", content: "Queixa principal: Dor lombar\nSintomas: Rigidez matinal" },
      { title: "Tratamento", content: "Alongamento lombar | a cada 8h | por 15 dias" },
      { title: "Observações rápidas", content: "Paciente relata melhora parcial." },
    ]);
  });

  it("creates a predictable pdf filename", () => {
    expect(buildSessionDocumentFileName("combined", baseData)).toBe("atendimento-maria-souza-25-03-2026.pdf");
    expect(buildSessionDocumentFileName("anamnesis", baseData)).toBe("anamnese-maria-souza-25-03-2026.pdf");
    expect(buildSessionDocumentFileName("treatment", baseData)).toBe("tratamento-maria-souza-25-03-2026.pdf");
  });

  it("renders empty sections with fallback content", () => {
    const model = buildSessionDocumentModel("anamnesis", {
      ...baseData,
      anamnesisSummary: "",
      quickNotes: "",
    });

    const html = renderSessionDocumentHtml(model);

    expect(html).toContain("Nenhum conteúdo registrado.");
    expect(html).toContain("<!doctype html>");
  });
});
