import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalculatedFieldRuntimeInput } from "./CalculatedFieldRuntimeInput";
import type { AnamnesisField } from "@/lib/anamnesis-forms";

describe("CalculatedFieldRuntimeInput", () => {
  const mockField: AnamnesisField = {
    id: "field_imc",
    label: "Índice de Massa Corporal (IMC)",
    type: "calculated",
    calculatedConfig: {
      variables: [
        { id: "v1", name: "A", label: "Peso", unit: "kg" },
        { id: "v2", name: "B", label: "Altura", unit: "cm" },
      ],
      outputs: [
        {
          id: "o1",
          name: "IMC Calculado",
          formula: "A / ((B / 100) ^ 2)",
          unit: "kg/m²",
          precision: 2,
        },
      ],
      ranges: [
        { id: "r1", min: 0, max: 18.49, label: "Abaixo do peso", color: "blue" },
        { id: "r2", min: 18.5, max: 24.99, label: "Eutrófico / Normal", color: "emerald" },
        { id: "r3", min: 25, max: 29.99, label: "Sobrepeso", color: "amber" },
      ],
    },
  };

  it("calculates IMC and triggers onChange with sanitized structure", () => {
    const onChange = vi.fn();
    render(
      <CalculatedFieldRuntimeInput
        field={mockField}
        value={{ inputs: { A: 70, B: null } }}
        onChange={onChange}
      />
    );

    const inputB = screen.getByPlaceholderText("Altura");
    fireEvent.change(inputB, { target: { value: "175" } });

    expect(onChange).toHaveBeenCalledWith({
      inputs: { A: 70, B: 175 },
      outputs: {
        "IMC Calculado": 22.86,
      },
    });
  });

  it("renders correctly with pre-filled values and shows matched classification", () => {
    render(
      <CalculatedFieldRuntimeInput
        field={mockField}
        value={{ inputs: { A: 70, B: 175 } }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("22.86")).toBeInTheDocument();
    expect(screen.getByText("Eutrófico / Normal")).toBeInTheDocument();
  });

  it("handles DEFAULT_CALCULATED_CONFIG with ranges: [] and formula A + B cleanly in O(1)", () => {
    const defaultField: AnamnesisField = {
      id: "field_calc_default",
      label: "Cálculo Padrão",
      type: "calculated",
      // Sem calculatedConfig -> usará DEFAULT_CALCULATED_CONFIG
    };

    render(
      <CalculatedFieldRuntimeInput
        field={defaultField}
        value={{ inputs: { A: 10, B: 25 } }}
        onChange={vi.fn()}
      />
    );

    // 10 + 25 = 35.00
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(screen.getByText("Resultado")).toBeInTheDocument();
  });
});
