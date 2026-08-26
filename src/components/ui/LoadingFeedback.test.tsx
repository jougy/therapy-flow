import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LoadingFeedback } from "./loading-feedback";

describe("LoadingFeedback Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders initial stage message by default", () => {
    render(<LoadingFeedback message="Carregando prontuário do paciente..." />);
    expect(screen.getByText("Carregando prontuário do paciente...")).toBeInTheDocument();
    expect(screen.getByText("Preparando tudo para você...")).toBeInTheDocument();
  });

  it("evolves message after duration exceeds thresholds", () => {
    render(<LoadingFeedback message="Carregando prontuário do paciente..." />);

    // Pass 4 seconds -> stage 2
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText("Buscando dados e histórico...")).toBeInTheDocument();

    // Pass 8 seconds total -> stage 3 (slow network notice)
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText("A conexão parece um pouco lenta")).toBeInTheDocument();

    // Pass 14 seconds total -> stage 4 (delayed notice with retry button)
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText("O carregamento está demorando mais do que o esperado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it("calls onRetry callback when clicking retry button", () => {
    const onRetry = vi.fn();
    render(<LoadingFeedback onRetry={onRetry} />);

    act(() => {
      vi.advanceTimersByTime(14000);
    });

    const button = screen.getByRole("button", { name: /tentar novamente/i });
    act(() => {
      button.click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
