import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TagOptionListEditor } from "@/components/anamnesis/TagOptionListEditor";
import { ANAMNESIS_OPTION_LIMIT, type AnamnesisFieldOption } from "@/lib/anamnesis-forms";
import { INPUT_LIMITS } from "@/lib/input-security";

describe("TagOptionListEditor", () => {
  it("renders tag options with color previews and allows adding tags", () => {
    const onChange = vi.fn();
    const options: AnamnesisFieldOption[] = [
      { id: "tag_1", label: "Cervical", color: "#C4B5FD", row: 0 },
      { id: "tag_2", label: "Lombar", color: "#FDE047", row: 1 },
    ];

    render(<TagOptionListEditor options={options} onChange={onChange} />);

    expect(screen.getByDisplayValue("Cervical")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lombar")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /adicionar tag pré-definida/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(3);
  });

  it("limits tag addition at ANAMNESIS_OPTION_LIMIT", () => {
    const onChange = vi.fn();
    const options: AnamnesisFieldOption[] = Array.from({ length: ANAMNESIS_OPTION_LIMIT }, (_, index) => ({
      id: `tag_${index}`,
      label: `Tag ${index}`,
      color: "#C4B5FD",
      row: index,
    }));

    render(<TagOptionListEditor options={options} onChange={onChange} />);

    expect(screen.getAllByRole("textbox")[0]).toHaveAttribute("maxLength", String(INPUT_LIMITS.formOptionLabel));
    expect(screen.getByRole("button", { name: /adicionar tag pré-definida/i })).toBeDisabled();
  });
});
