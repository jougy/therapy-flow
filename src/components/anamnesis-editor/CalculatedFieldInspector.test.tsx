import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalculatedFieldInspector } from "./CalculatedFieldInspector";
import type { AnamnesisField } from "@/lib/anamnesis-forms";

describe("CalculatedFieldInspector", () => {
  const mockField: AnamnesisField = {
    id: "field_calc",
    label: "Score Clínico",
    type: "calculated",
    calculatedConfig: {
      variables: [
        { id: "v1", name: "A", label: "Peso", unit: "kg" },
        { id: "v2", name: "B", label: "Altura", unit: "cm" },
      ],
      outputs: [
        {
          id: "o1",
          name: "IMC",
          formula: "A / ((B / 100) ^ 2)",
          unit: "kg/m²",
          precision: 2,
        },
      ],
      ranges: [
        { id: "r1", min: 0, max: 18.49, label: "Abaixo do peso", color: "blue" },
      ],
    },
  };

  it("renders subtabs and switches between Entradas, Fórmulas and Faixas & Cores", () => {
    const onUpdateConfig = vi.fn();
    render(
      <CalculatedFieldInspector
        field={mockField}
        onUpdateConfig={onUpdateConfig}
      />
    );

    // Na aba inicial (Entradas)
    expect(screen.getByText("Variáveis de Entrada")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Peso")).toBeInTheDocument();

    // Trocar para Fórmulas
    fireEvent.click(screen.getByRole("button", { name: /Fórmulas/i }));
    expect(screen.getByText("Fórmulas & Saídas de Resultado")).toBeInTheDocument();
    expect(screen.getByDisplayValue("IMC")).toBeInTheDocument();

    // Trocar para Faixas & Cores
    fireEvent.click(screen.getByRole("button", { name: /Faixas & Cores/i }));
    expect(screen.getByText("Faixas Clínicas de Classificação")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Abaixo do peso")).toBeInTheDocument();
  });

  it("adds a new variable when clicking Adicionar Variável in variables tab", () => {
    const onUpdateConfig = vi.fn();
    render(
      <CalculatedFieldInspector
        field={mockField}
        onUpdateConfig={onUpdateConfig}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Adicionar Variável/i }));
    expect(onUpdateConfig).toHaveBeenCalled();
    const updatedArgs = onUpdateConfig.mock.calls[0][0];
    expect(updatedArgs.variables.length).toBe(3);
    expect(updatedArgs.variables[2].name).toBe("C");
  });
});
