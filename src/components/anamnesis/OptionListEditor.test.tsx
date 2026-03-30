import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OptionListEditor } from "@/components/anamnesis/OptionListEditor";
import type { AnamnesisFieldOption } from "@/lib/anamnesis-forms";

describe("OptionListEditor", () => {
  it("renders a first non-removable option and allows adding vertical items", () => {
    const onChange = vi.fn();
    const options: AnamnesisFieldOption[] = [{ id: "option_1", label: "Manhã", row: 0 }];

    render(<OptionListEditor options={options} onChange={onChange} />);

    expect(screen.getByDisplayValue("Manhã")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remover opção/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /adicionar opção/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
