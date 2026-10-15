import { describe, expect, it } from "vitest";
import {
  denormalizeCoordinate,
  normalizeCoordinate,
  type ClinicalAnnotationShape,
  type ClinicalImageAnnotationValue,
} from "./image-annotation-vector";

describe("Clinical Vector Image Annotation", () => {
  it("normaliza e desnormaliza coordenadas perfeitamente", () => {
    const totalWidth = 800;
    const pixelX = 400; // Meio da tela

    const normalized = normalizeCoordinate(pixelX, totalWidth);
    expect(normalized).toBe(500);

    const denormalized = denormalizeCoordinate(normalized, totalWidth);
    expect(denormalized).toBe(400);
  });

  it("garante limites seguros de 0 a 1000", () => {
    expect(normalizeCoordinate(-50, 1000)).toBe(0);
    expect(normalizeCoordinate(1500, 1000)).toBe(1000);
  });

  it("produz payload JSON ultraleve (< 1KB) para conjunto médico de formas e pins", () => {
    const shapes: ClinicalAnnotationShape[] = [
      {
        id: "shape_1",
        type: "pin",
        x: 450,
        y: 620,
        pinNumber: 1,
        label: "Dor aguda na palpação",
        comment: "Irradiação para L5-S1",
        strokeColor: "#EF4444",
        strokeWidth: 4,
      },
      {
        id: "shape_2",
        type: "arrow",
        x: 200,
        y: 200,
        width: 150,
        height: 100,
        strokeColor: "#3B82F6",
        strokeWidth: 4,
        strokeStyle: "dashed",
      },
      {
        id: "shape_3",
        type: "highlighter",
        x: 300,
        y: 300,
        points: [
          [300, 300],
          [310, 320],
          [330, 340],
          [350, 360],
        ],
        strokeColor: "#EAB308",
        strokeWidth: 12,
      },
      {
        id: "shape_4",
        type: "circle",
        x: 500,
        y: 400,
        width: 80,
        height: 80,
        strokeColor: "#22C55E",
        strokeWidth: 2,
      },
    ];

    const value: ClinicalImageAnnotationValue = {
      baseImageUrl: "https://storage.plurihealth.com/clinics/cli_1/patients/pat_1/postura_base.webp",
      baseImageWidth: 1920,
      baseImageHeight: 1080,
      annotations: shapes,
      updatedAt: "2026-10-14T22:00:00.000Z",
    };

    const serialized = JSON.stringify(value);
    // Garantir que o payload inteiro com 4 ferramentas complexas ocupe menos de 1000 bytes
    expect(serialized.length).toBeLessThan(1000);
  });
});
