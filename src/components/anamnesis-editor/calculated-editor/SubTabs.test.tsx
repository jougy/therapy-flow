import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VariablesSubTab } from "./VariablesSubTab";
import { RangesSubTab } from "./RangesSubTab";
import { FormulasSubTab } from "./FormulasSubTab";
import type { CalculatedFieldConfig } from "@/lib/anamnesis-forms";

describe("calculated-editor subcomponents", () => {
  const baseConfig: CalculatedFieldConfig = {
    variables: [
      { id: "v1", name: "A", label: "Peso", unit: "kg" },
      { id: "v2", name: "B", label: "Altura", unit: "cm" },
    ],
    outputs: [
      { id: "o1", name: "Resultado 1", formula: "A + B", unit: "pts", precision: 1 },
    ],
    ranges: [
      { id: "r1", min: 10, max: 50, label: "Moderado", color: "amber" },
    ],
  };

  it("VariablesSubTab handles editing variable label", () => {
    const onUpdate = vi.fn();
    render(
      <VariablesSubTab
        config={baseConfig}
        otherCalculatedFields={[]}
        onUpdateConfig={onUpdate}
      />
    );

    const input = screen.getByDisplayValue("Peso");
    fireEvent.change(input, { target: { value: "Massa Corporal" } });
    expect(onUpdate).toHaveBeenCalled();
    const callArg = onUpdate.mock.calls[0][0];
    expect(callArg.variables[0].label).toBe("Massa Corporal");
  });

  it("RangesSubTab handles adding a new range", () => {
    const onUpdate = vi.fn();
    render(
      <RangesSubTab
        config={baseConfig}
        onUpdateConfig={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Adicionar Faixa/i }));
    expect(onUpdate).toHaveBeenCalled();
    const callArg = onUpdate.mock.calls[0][0];
    expect(callArg.ranges.length).toBe(2);
  });

  it("FormulasSubTab handles operator button clicks to append to formula", () => {
    const onUpdate = vi.fn();
    render(
      <FormulasSubTab
        config={baseConfig}
        testInputs={{ A: 10, B: 20 }}
        onTestInputChange={vi.fn()}
        onUpdateConfig={onUpdate}
      />
    );

    // Clicar no botão do operador '*'
    fireEvent.click(screen.getByRole("button", { name: "*" }));
    expect(onUpdate).toHaveBeenCalled();
    const callArg = onUpdate.mock.calls[0][0];
    expect(callArg.outputs[0].formula).toBe("A + B *");
  });
});
