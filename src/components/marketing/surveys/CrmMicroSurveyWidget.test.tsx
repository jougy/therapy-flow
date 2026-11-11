import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CrmMicroSurveyWidget } from "./CrmMicroSurveyWidget";

describe("CrmMicroSurveyWidget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders with clinical_record_saved trigger question and 3 emoji options", () => {
    render(
      <CrmMicroSurveyWidget
        triggerEvent="clinical_record_saved"
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByText("O preenchimento do prontuário foi rápido o suficiente?")
    ).toBeInTheDocument();
    expect(screen.getByText("Super rápido")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.getByText("Achei demorado")).toBeInTheDocument();
  });

  it("renders report_generated question appropriately", () => {
    render(
      <CrmMicroSurveyWidget
        triggerEvent="report_generated"
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByText("A geração do relatório foi rápida o suficiente?")
    ).toBeInTheDocument();
  });

  it("submits immediately when user selects 'Super rápido'", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();

    render(
      <CrmMicroSurveyWidget
        triggerEvent="clinical_record_saved"
        onClose={onClose}
        onSubmit={onSubmit}
        autoDismissDelayMs={1000}
      />
    );

    fireEvent.click(screen.getByText("Super rápido"));

    expect(onSubmit).toHaveBeenCalledWith({
      score: "fast",
      comment: undefined,
    });
    expect(screen.getByText("Obrigado pelo feedback!")).toBeInTheDocument();

    // Fast-forward auto-dismiss timer
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("submits immediately when user selects 'Normal'", () => {
    const onSubmit = vi.fn();

    render(
      <CrmMicroSurveyWidget
        triggerEvent="first_affiliate_click"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByText("Normal"));

    expect(onSubmit).toHaveBeenCalledWith({
      score: "normal",
      comment: undefined,
    });
  });

  it("expands feedback input when user selects 'Achei demorado' and submits comment", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();

    render(
      <CrmMicroSurveyWidget
        triggerEvent="clinical_record_saved"
        onClose={onClose}
        onSubmit={onSubmit}
        autoDismissDelayMs={500}
      />
    );

    fireEvent.click(screen.getByText("Achei demorado"));

    expect(
      screen.getByLabelText("O que mais travou seu fluxo?")
    ).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Ex: Muitos campos, lentidão...");
    fireEvent.change(input, {
      target: { value: "Muitos campos para preencher no celular" },
    });

    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      score: "slow",
      comment: "Muitos campos para preencher no celular",
    });

    expect(screen.getByText("Obrigado pelo feedback!")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("allows skipping comment when 'Achei demorado' was selected", () => {
    const onSubmit = vi.fn();

    render(
      <CrmMicroSurveyWidget
        triggerEvent="clinical_record_saved"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByText("Achei demorado"));
    fireEvent.click(screen.getByRole("button", { name: /pular/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      score: "slow",
      comment: undefined,
    });
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();

    render(
      <CrmMicroSurveyWidget
        triggerEvent="clinical_record_saved"
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByLabelText("Fechar pesquisa"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
