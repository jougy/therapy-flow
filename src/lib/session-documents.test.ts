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
  appName: "TherapyFlow",
  patientName: "Maria Souza",
  sessionDate: "25/03/2026",
  generatedAt: "26/03/2026 16:10",
  anamnesisSummary: "Queixa principal: Dor lombar\nSintomas: Rigidez matinal",
  anamnesisIndicators: [
    { label: "Dor", score: 7, min: 0, max: 10 },
    { label: "Complexidade", score: 4, min: 0, max: 10 },
  ],
  treatmentSummary: "Alongamento lombar | a cada 8h | por 15 dias",
  treatmentDetails: {
    blocks: [
      {
        duration: "15 dias",
        frequency: "12h",
        id: "block-1",
        instructions: "Respirar de forma cadenciada",
        name: "Agachamento",
        repetitions: "20",
        series: "3",
      },
    ],
    generalGuidance: "Executar com supervisão e respeitar a dor.",
  },
  quickNotes: "Paciente relata melhora parcial.",
  clinic: {
    address: "Rua das Flores, 123, Centro, Manaus - AM, 69000-000",
    businessHours: "Seg-sex 08h-18h",
    cnpj: "12.345.678/0001-90",
    email: "contato@guardians.com",
    legalName: "Instituto Guardians of the Amazon",
    logoUrl: "https://example.com/logo.png",
    name: "Ins. Guardians of the Amazon",
    phone: "(92) 3333-4444",
  },
  provider: {
    email: "jougy@guardians.com",
    fullName: "Jougy",
    jobTitle: "Sênior",
    phone: "(92) 99999-0000",
    professionalLicense: "CREFITO 12345",
    specialty: "Fisioterapeuta",
  },
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
    expect(result.brandTitle).toBe("Ins. Guardians of the Amazon");
    expect(result.patientLabel).toBe("Maria Souza");
    expect(result.sections).toEqual([
      {
        title: "Anamnese",
        content: "Queixa principal: Dor lombar\nSintomas: Rigidez matinal",
        indicators: [
          { label: "Dor", score: 7, min: 0, max: 10 },
          { label: "Complexidade", score: 4, min: 0, max: 10 },
        ],
        kind: "anamnesis",
      },
      {
        title: "Tratamento",
        content:
          "1)\nTratamento: Agachamento\nDe quanto em quanto tempo: 12h\nPor quanto tempo: 15 dias\nSéries: 3\nRepetições: 20\nInstruções adicionais: Respirar de forma cadenciada\n\nOrientações gerais e observações: Executar com supervisão e respeitar a dor.",
        indicators: [],
        kind: "treatment",
        treatmentDetails: {
          blocks: [
            {
              duration: "15 dias",
              frequency: "12h",
              id: "block-1",
              instructions: "Respirar de forma cadenciada",
              name: "Agachamento",
              repetitions: "20",
              series: "3",
            },
          ],
          generalGuidance: "Executar com supervisão e respeitar a dor.",
        },
      },
      { title: "Observações rápidas", content: "Paciente relata melhora parcial.", indicators: [], kind: "notes" },
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

  it("renders clinic, professional, patient and footer information in the html document", () => {
    const html = renderSessionDocumentHtml(buildSessionDocumentModel("combined", baseData));
    const anamnesisTitleIndex = html.indexOf('class="section-title">Anamnese');
    const firstIndicatorIndex = html.indexOf('class="indicator-grid"');

    expect(html).toContain("Ins. Guardians of the Amazon");
    expect(html).toContain("TherapyFlow");
    expect(html).toContain("Instituto Guardians of the Amazon");
    expect(html).toContain("CREFITO 12345");
    expect(html).toContain("Maria Souza");
    expect(html).toContain("26/03/2026 16:10");
    expect(html).toContain("Rua das Flores, 123, Centro, Manaus - AM, 69000-000");
    expect(html).toContain("Seg-sex 08h-18h");
    expect(html).toContain("Dor");
    expect(html).toContain("7/10");
    expect(html).toContain("Figtree");
    expect(html).toContain("De quanto em quanto tempo");
    expect(html).toContain("Respirar de forma cadenciada");
    expect(html).toContain('class="facts-grid facts-grid--clinic"');
    expect(html).toContain('class="document-section document-section--treatment"');
    expect(html).toContain(">1)</h3>");
    expect(anamnesisTitleIndex).toBeGreaterThan(-1);
    expect(firstIndicatorIndex).toBeGreaterThan(anamnesisTitleIndex);
  });
});
