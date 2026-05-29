import { describe, expect, it } from "vitest";
import {
  buildTreatmentPayload,
  createTreatmentBlock,
  formatTreatmentSummary,
  readTreatmentState,
} from "@/lib/session-treatment";

describe("createTreatmentBlock", () => {
  it("creates an empty block with stable shape", () => {
    expect(createTreatmentBlock(0)).toMatchObject({
      duration: "",
      frequency: "",
      instructions: "",
      name: "",
      repetitions: "",
      series: "",
    });
  });
});

describe("readTreatmentState", () => {
  it("reads the new block-based format", () => {
    const result = readTreatmentState({
      blocks: [
        {
          duration: "por 15 dias",
          frequency: "a cada 8h",
          id: "block-1",
          instructions: "Aplicar gelo depois",
          name: "Alongamento lombar",
          repetitions: "12",
          series: "3",
        },
      ],
      general_guidance: "Evitar carregar peso",
    });

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].name).toBe("Alongamento lombar");
    expect(result.generalGuidance).toBe("Evitar carregar peso");
  });

  it("converts legacy treatment data to one fallback block", () => {
    const result = readTreatmentState({
      descricao: "Mobilização e exercícios ativos",
      orientacoes: "Reforçar exercícios em casa",
      techniques: ["Mobilização articular", "Cinesioterapia"],
    });

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].name).toBe("Mobilização articular, Cinesioterapia");
    expect(result.blocks[0].instructions).toBe("Mobilização e exercícios ativos");
    expect(result.generalGuidance).toBe("Reforçar exercícios em casa");
  });
});

describe("buildTreatmentPayload", () => {
  it("returns null when there is no meaningful content", () => {
    expect(
      buildTreatmentPayload({
        blocks: [createTreatmentBlock(0)],
        generalGuidance: "",
      })
    ).toBeNull();
  });

  it("serializes blocks and general guidance", () => {
    expect(
      buildTreatmentPayload({
        blocks: [
          {
            duration: "por 10 dias",
            frequency: "dia sim dia não",
            id: "block-1",
            instructions: "Focar em amplitude",
            name: "Fortalecimento escapular",
            repetitions: "15",
            series: "4",
          },
        ],
        generalGuidance: "Suspender se houver piora",
      })
    ).toEqual({
      blocks: [
        {
          duration: "por 10 dias",
          frequency: "dia sim dia não",
          id: "block-1",
          instructions: "Focar em amplitude",
          name: "Fortalecimento escapular",
          repetitions: "15",
          series: "4",
        },
      ],
      general_guidance: "Suspender se houver piora",
    });
  });

  it("limits and sanitizes hostile treatment payloads", () => {
    const hostileText = ` Café\u0301 😀\u0000\u202E\n${"x".repeat(3_000)}`;
    const payload = buildTreatmentPayload({
      blocks: Array.from({ length: 25 }, (_, index) => ({
        duration: hostileText,
        frequency: hostileText,
        id: `block-${index}\u202E${"x".repeat(200)}`,
        instructions: hostileText,
        name: hostileText,
        repetitions: hostileText,
        series: hostileText,
      })),
      generalGuidance: hostileText,
    });

    expect(payload?.blocks).toHaveLength(20);
    expect(payload?.blocks[0].name.length).toBeLessThanOrEqual(160);
    expect(payload?.blocks[0].instructions.length).toBeLessThanOrEqual(1_500);
    expect(payload?.blocks[0].name).not.toContain("\u0000");
    expect(payload?.blocks[0].name).not.toContain("\u202E");
    expect(payload?.blocks[0].name).not.toContain("😀");
    expect(payload?.general_guidance.length).toBeLessThanOrEqual(2_000);
  });
});

describe("formatTreatmentSummary", () => {
  it("renders a readable summary for patient lists", () => {
    expect(
      formatTreatmentSummary({
        blocks: [
          {
            duration: "por 15 dias",
            frequency: "a cada 8h",
            id: "block-1",
            instructions: "Aplicar gelo depois",
            name: "Alongamento lombar",
            repetitions: "12",
            series: "3",
          },
        ],
        generalGuidance: "Evitar carregar peso",
      })
    ).toBe(
      "Alongamento lombar | a cada 8h | por 15 dias | 3 series | 12 repeticoes | Aplicar gelo depois\n\nOrientacoes gerais: Evitar carregar peso"
    );
  });
});
