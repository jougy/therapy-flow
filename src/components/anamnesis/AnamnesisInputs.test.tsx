import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateFieldInput } from "@/components/anamnesis/DateFieldInput";
import { FieldLabelWithHelp } from "@/components/anamnesis/FieldLabelWithHelp";
import { OptionListEditor } from "@/components/anamnesis/OptionListEditor";
import { OptionMatrixEditor } from "@/components/anamnesis/OptionMatrixEditor";
import { TagOptionListEditor } from "@/components/anamnesis/TagOptionListEditor";
import { ANAMNESIS_OPTION_LIMIT, type AnamnesisFieldOption } from "@/lib/anamnesis-forms";
import { INPUT_LIMITS } from "@/lib/input-security";

describe("Anamnesis Inputs Suite (Consolidated QA)", () => {
  describe("DateFieldInput", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-14T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("formats direct typing as dd/mm/yyyy", () => {
      const handleChange = vi.fn();
      render(<DateFieldInput value="" onChange={handleChange} />);
      fireEvent.change(screen.getByPlaceholderText("DD/MM/YYYY"), { target: { value: "01012026" } });
      expect(handleChange).toHaveBeenLastCalledWith("01/01/2026");
    });

    it("opens the calendar popover and shows active month", () => {
      render(<DateFieldInput value="" onChange={() => undefined} />);
      fireEvent.click(screen.getByRole("button", { name: /abrir calendário/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/março 2026/i)).toBeInTheDocument();
    });
  });

  describe("FieldLabelWithHelp", () => {
    it("does not render the help trigger when there is no help text", () => {
      render(<FieldLabelWithHelp label="Queixa principal" />);
      expect(screen.getByText("Queixa principal")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /ajuda/i })).not.toBeInTheDocument();
    });

    it("shows and hides help content on interaction", () => {
      render(<FieldLabelWithHelp label="Queixa principal" helpText="Explique o motivo principal do atendimento." />);
      fireEvent.click(screen.getByRole("button", { name: /ajuda para queixa principal/i }));
      expect(screen.getByText("Explique o motivo principal do atendimento.")).toBeInTheDocument();

      fireEvent.pointerDown(document.body);
      expect(screen.queryByText("Explique o motivo principal do atendimento.")).not.toBeInTheDocument();
    });
  });

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

    it("caps option editing controls at the configured safety limits", () => {
      const onChange = vi.fn();
      const options: AnamnesisFieldOption[] = Array.from({ length: ANAMNESIS_OPTION_LIMIT }, (_, index) => ({
        id: `option_${index}`,
        label: `Opção ${index}`,
        row: index,
      }));
      render(<OptionListEditor options={options} onChange={onChange} />);

      expect(screen.getAllByRole("textbox")[0]).toHaveAttribute("maxLength", String(INPUT_LIMITS.formOptionLabel));
      expect(screen.getByRole("button", { name: /adicionar opção/i })).toBeDisabled();
    });
  });

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
});
