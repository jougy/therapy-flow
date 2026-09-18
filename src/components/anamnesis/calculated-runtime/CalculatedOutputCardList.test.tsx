import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalculatedOutputCardList, type EvaluatedOutputItem } from "./CalculatedOutputCardList";

describe("CalculatedOutputCardList", () => {
  it("renders pending state when formula has not resolved successfully", () => {
    const outputs: EvaluatedOutputItem[] = [
      {
        id: "out_1",
        name: "IMC",
        formula: "A / ((B / 100) ^ 2)",
        unit: "kg/m²",
        evalResult: { success: false, error: "Variável 'A' não preenchida" },
      },
    ];

    render(<CalculatedOutputCardList outputs={outputs} />);

    expect(screen.getByText("IMC")).toBeInTheDocument();
    expect(screen.getByText("(A / ((B / 100) ^ 2))")).toBeInTheDocument();
    expect(screen.getByText(/Preencha todos os campos acima/i)).toBeInTheDocument();
  });

  it("renders evaluated number and clinical classification badge with correct color", () => {
    const outputs: EvaluatedOutputItem[] = [
      {
        id: "out_1",
        name: "IMC",
        formula: "A / ((B / 100) ^ 2)",
        unit: "kg/m²",
        evalResult: { success: true, value: 23.5 },
        matchedRange: {
          id: "r1",
          label: "Peso Saudável",
          color: "emerald",
          min: 18.5,
          max: 24.99,
        },
      },
    ];

    render(<CalculatedOutputCardList outputs={outputs} />);

    expect(screen.getByText("23.5")).toBeInTheDocument();
    expect(screen.getByText("kg/m²")).toBeInTheDocument();
    expect(screen.getByText("Peso Saudável")).toBeInTheDocument();
  });
});
