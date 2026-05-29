import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OptionMatrixEditor } from "@/components/anamnesis/OptionMatrixEditor";
import { ANAMNESIS_OPTION_LIMIT, type AnamnesisFieldOption } from "@/lib/anamnesis-forms";
import { INPUT_LIMITS } from "@/lib/input-security";

describe("OptionMatrixEditor", () => {
  it("renders a first non-removable option and allows adding columns and rows", () => {
    const onChange = vi.fn();
    const options: AnamnesisFieldOption[] = [{ id: "option_1", label: "Dor", row: 0 }];

    render(<OptionMatrixEditor options={options} onChange={onChange} />);

    expect(screen.getByDisplayValue("Dor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remover opção/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /adicionar à direita/i }));
    expect(onChange).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /adicionar linha/i }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("caps option editing controls at the configured safety limits", () => {
    const onChange = vi.fn();
    const options: AnamnesisFieldOption[] = Array.from({ length: ANAMNESIS_OPTION_LIMIT }, (_, index) => ({
      id: `option_${index}`,
      label: `Opção ${index}`,
      row: 0,
    }));

    render(<OptionMatrixEditor options={options} onChange={onChange} />);

    expect(screen.getAllByRole("textbox")[0]).toHaveAttribute("maxLength", String(INPUT_LIMITS.formOptionLabel));
    expect(screen.getByRole("button", { name: /adicionar à direita/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /adicionar linha/i })).toBeDisabled();
  });
});
