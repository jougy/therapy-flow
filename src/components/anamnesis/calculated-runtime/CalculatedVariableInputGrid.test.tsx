import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalculatedVariableInputGrid } from "./CalculatedVariableInputGrid";
import type { CalculatedFieldConfig, AnamnesisField } from "@/lib/anamnesis-forms";

describe("CalculatedVariableInputGrid", () => {
  const config: CalculatedFieldConfig = {
    variables: [
      { id: "var_1", name: "A", label: "Peso", unit: "kg" },
      { id: "var_2", name: "B", label: "Altura", unit: "cm" },
      { id: "var_3", name: "C", label: "Cálculo Anterior", sourceFieldId: "field_prev" },
    ],
    outputs: [],
  };

  const otherFields: AnamnesisField[] = [
    {
      id: "field_prev",
      label: "Score Inicial",
      type: "calculated",
    },
  ];

  it("renders manual input variables and handles typing", () => {
    const onInputChange = vi.fn();
    render(
      <CalculatedVariableInputGrid
        config={config}
        allFields={otherFields}
        resolvedVariables={{ A: 75, B: null, C: 22.5 }}
        onInputChange={onInputChange}
      />
    );

    // Labels e unidades
    expect(screen.getByText("Peso")).toBeInTheDocument();
    expect(screen.getByText("kg")).toBeInTheDocument();
    expect(screen.getByText("Altura")).toBeInTheDocument();
    expect(screen.getByText("cm")).toBeInTheDocument();

    // Input manual de A deve ter valor 75
    const inputA = screen.getByPlaceholderText("Peso") as HTMLInputElement;
    expect(inputA.value).toBe("75");

    // Digitação manual
    fireEvent.change(inputA, { target: { value: "80" } });
    expect(onInputChange).toHaveBeenCalledWith("A", "80");
  });

  it("renders reactive/derived variable pulled from another field", () => {
    render(
      <CalculatedVariableInputGrid
        config={config}
        allFields={otherFields}
        resolvedVariables={{ A: 75, B: 180, C: 22.5 }}
        onInputChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Puxado de Score Inicial:/i)).toBeInTheDocument();
    expect(screen.getByText("22.5")).toBeInTheDocument();
  });
});
