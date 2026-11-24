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

    // Pass 8 seconds total -> stage 3 (finalizing data loading, no slow network blame)
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText("Finalizando carregamento dos dados...")).toBeInTheDocument();
    expect(screen.queryByText("A conexão parece um pouco lenta")).not.toBeInTheDocument();

    // Pass 16 seconds total -> stage 4 (delayed notice with retry button)
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByText("O carregamento está demorando mais do que o esperado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it("calls onRetry callback when clicking retry button", () => {
    const onRetry = vi.fn();
    render(<LoadingFeedback onRetry={onRetry} />);

    act(() => {
      vi.advanceTimersByTime(16000);
    });

    const button = screen.getByRole("button", { name: /tentar novamente/i });
    act(() => {
      button.click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows offline notice only when navigator is offline", () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    try {
      render(<LoadingFeedback />);
      expect(screen.getByText("Sem conexão com a internet")).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, "onLine", { value: originalOnLine, configurable: true });
    }
  });
});
