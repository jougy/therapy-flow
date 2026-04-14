import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateFieldInput } from "@/components/anamnesis/DateFieldInput";

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

  it("opens the calendar popover", () => {
    render(<DateFieldInput value="" onChange={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: /abrir calendário/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/março 2026/i)).toBeInTheDocument();
  });
});
