import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HorizontalStepperNavigator, safeStepIndex } from "./HorizontalStepperNavigator";

describe("HorizontalStepperNavigator", () => {
  it("renders step counter and completed steps", () => {
    render(
      <HorizontalStepperNavigator
        currentStep={0}
        totalSteps={4}
        completedSteps={2}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

    expect(screen.getByText("1 de 4 • 2 preenchidas")).toBeInTheDocument();
  });

  it("disables previous button on first step and enables next", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    render(
      <HorizontalStepperNavigator
        currentStep={0}
        totalSteps={3}
        completedSteps={0}
        onPrev={onPrev}
        onNext={onNext}
      />
    );

    const prevBtn = screen.getByLabelText("Etapa anterior");
    const nextBtn = screen.getByLabelText("Próxima etapa");

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    fireEvent.click(nextBtn);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it("disables next button on last step and enables previous", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    render(
      <HorizontalStepperNavigator
        currentStep={2}
        totalSteps={3}
        completedSteps={3}
        onPrev={onPrev}
        onNext={onNext}
      />
    );

    const prevBtn = screen.getByLabelText("Etapa anterior");
    const nextBtn = screen.getByLabelText("Próxima etapa");

    expect(prevBtn).toBeEnabled();
    expect(nextBtn).toBeDisabled();

    fireEvent.click(prevBtn);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("has accessible roles and touch targets >= 44px", () => {
    render(
      <HorizontalStepperNavigator
        currentStep={1}
        totalSteps={3}
        completedSteps={1}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAttribute("aria-label", "Navegação de etapas");

    const prevBtn = screen.getByLabelText("Etapa anterior");
    const nextBtn = screen.getByLabelText("Próxima etapa");

    expect(prevBtn.className).toContain("min-h-[44px]");
    expect(prevBtn.className).toContain("min-w-[44px]");
    expect(nextBtn.className).toContain("min-h-[44px]");
    expect(nextBtn.className).toContain("min-w-[44px]");
  });

  it("returns null when totalSteps is 0", () => {
    const { container } = render(
      <HorizontalStepperNavigator
        currentStep={0}
        totalSteps={0}
        completedSteps={0}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  describe("safeStepIndex helper", () => {
    it("clamps index within bounds", () => {
      expect(safeStepIndex(-1, 5)).toBe(0);
      expect(safeStepIndex(0, 5)).toBe(0);
      expect(safeStepIndex(2, 5)).toBe(2);
      expect(safeStepIndex(4, 5)).toBe(4);
      expect(safeStepIndex(10, 5)).toBe(4);
    });

    it("handles totalSteps <= 0 safely", () => {
      expect(safeStepIndex(0, 0)).toBe(0);
      expect(safeStepIndex(2, -1)).toBe(0);
    });
  });
});
