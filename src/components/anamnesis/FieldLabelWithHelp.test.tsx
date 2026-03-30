import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldLabelWithHelp } from "@/components/anamnesis/FieldLabelWithHelp";

describe("FieldLabelWithHelp", () => {
  it("does not render the help trigger when there is no help text", () => {
    render(<FieldLabelWithHelp label="Queixa principal" />);

    expect(screen.getByText("Queixa principal")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ajuda/i })).not.toBeInTheDocument();
  });

  it("shows and hides help content on interaction", async () => {
    render(<FieldLabelWithHelp label="Queixa principal" helpText="Explique o motivo principal do atendimento." />);

    fireEvent.click(screen.getByRole("button", { name: /ajuda para queixa principal/i }));

    expect(screen.getByText("Explique o motivo principal do atendimento.")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByText("Explique o motivo principal do atendimento.")).not.toBeInTheDocument();
  });
});
