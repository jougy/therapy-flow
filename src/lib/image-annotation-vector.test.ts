import { describe, expect, it } from "vitest";
import {
  denormalizeCoordinate,
  getPinColorFromSeverityScore,
  getPinSeverityInfoFromScore,
  getRecentAnnotationBaseImages,
  hitTestAnnotationShape,
  normalizeCoordinate,
  saveRecentAnnotationBaseImage,
  translateAnnotationShape,
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

  it("interpola gradualmente as cores do slider de severidade: Verde (0) -> Amarelo (35) -> Vermelho (82) -> Roxo (100)", () => {
    expect(getPinColorFromSeverityScore(0)).toBe("#22C55E");
    expect(getPinColorFromSeverityScore(35)).toBe("#EAB308");
    expect(getPinColorFromSeverityScore(82)).toBe("#EF4444");
    expect(getPinColorFromSeverityScore(100)).toBe("#8B5CF6");

    expect(getPinSeverityInfoFromScore(10).severity).toBe("low");
    expect(getPinSeverityInfoFromScore(40).severity).toBe("medium");
    expect(getPinSeverityInfoFromScore(75).severity).toBe("high");
    expect(getPinSeverityInfoFromScore(95).severity).toBe("critical");
  });

  it("detecta seleção (hit-test) e move (translate) traços livres, formas e pins", () => {
    const freehand: ClinicalAnnotationShape = {
      id: "fh_1",
      type: "freehand",
      x: 100,
      y: 100,
      points: [
        [100, 100],
        [200, 200],
      ],
      strokeColor: "#EF4444",
      strokeWidth: 4,
    };

    expect(hitTestAnnotationShape(freehand, 150, 150)).toBe(true);
    expect(hitTestAnnotationShape(freehand, 600, 600)).toBe(false);

    const moved = translateAnnotationShape(freehand, 50, -20);
    expect(moved.x).toBe(150);
    expect(moved.y).toBe(80);
    expect(moved.points).toEqual([
      [150, 80],
      [250, 180],
    ]);

    const rect: ClinicalAnnotationShape = {
      id: "r_1",
      type: "rect",
      x: 300,
      y: 300,
      width: 100,
      height: 80,
      strokeColor: "#3B82F6",
      strokeWidth: 4,
    };

    expect(hitTestAnnotationShape(rect, 350, 340)).toBe(true);
    expect(hitTestAnnotationShape(rect, 100, 100)).toBe(false);
  });

  it("salva e recupera imagens base na biblioteca rápida por clínica", () => {
    const saved = saveRecentAnnotationBaseImage(
      {
        id: "img_test_1",
        url: "https://b2.example.com/mapa_ombro.webp",
        filename: "mapa_ombro.webp",
        width: 1200,
        height: 900,
      },
      "clinic_test_123"
    );

    expect(saved.length).toBeGreaterThanOrEqual(1);
    expect(saved[0].filename).toBe("mapa_ombro.webp");

    const loaded = getRecentAnnotationBaseImages("clinic_test_123");
    expect(loaded[0].url).toBe("https://b2.example.com/mapa_ombro.webp");
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
