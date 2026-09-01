import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TagFieldInput } from "@/components/anamnesis/TagFieldInput";
import type { AnamnesisField } from "@/lib/anamnesis-forms";

describe("TagFieldInput", () => {
  const sampleField: AnamnesisField = {
    id: "field_tags",
    label: "Regiões Afetadas",
    type: "tags",
    tagMode: "multiple",
    allowCustomTags: true,
    options: [
      { id: "opt_1", label: "Cervical", color: "#C4B5FD", row: 0 },
      { id: "opt_2", label: "Lombar", color: "#FDE047", row: 1 },
    ],
  };

  it("renders selected tags and allows toggling predefined options", () => {
    const onChange = vi.fn();

    render(
      <TagFieldInput
        field={sampleField}
        value={[{ id: "tag_1", label: "Cervical", color: "#C4B5FD" }]}
        onChange={onChange}
      />
    );

    // Selected tag badge is visible
    expect(screen.getByText("Cervical")).toBeInTheDocument();

    // Predefined option not yet selected is visible as button "+ Lombar"
    const addLombarBtn = screen.getByRole("button", { name: /\+ Lombar/i });
    expect(addLombarBtn).toBeInTheDocument();

    fireEvent.click(addLombarBtn);
    expect(onChange).toHaveBeenCalledWith([
      { id: "tag_1", label: "Cervical", color: "#C4B5FD", colorSlotId: null },
      { id: "opt_2", label: "Lombar", color: "#FDE047", colorSlotId: undefined },
    ]);
  });

  it("handles tag removal", () => {
    const onChange = vi.fn();

    render(
      <TagFieldInput
        field={sampleField}
        value={[{ id: "tag_1", label: "Cervical", color: "#C4B5FD" }]}
        onChange={onChange}
      />
    );

    const removeBtn = screen.getByRole("button", { name: /remover tag cervical/i });
    fireEvent.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("opens create custom tag dialog and renders palette", () => {
    const onChange = vi.fn();

    render(
      <TagFieldInput
        field={sampleField}
        value={[]}
        onChange={onChange}
      />
    );

    const createBtn = screen.getByRole("button", { name: /criar tag/i });
    fireEvent.click(createBtn);

    expect(screen.getByText("Nova Tag Personalizada")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ex: Coluna Lombar/i)).toBeInTheDocument();
  });
});
