import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OptionMatrixEditor } from "@/components/anamnesis/OptionMatrixEditor";
import type { AnamnesisFieldOption } from "@/lib/anamnesis-forms";

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
});
