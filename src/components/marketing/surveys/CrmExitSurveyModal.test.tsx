import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CrmExitSurveyModal } from "./CrmExitSurveyModal";

describe("CrmExitSurveyModal", () => {
  it("renders humanized exit question without doctorName", () => {
    render(<CrmExitSurveyModal isOpen={true} onClose={vi.fn()} />);

    expect(
      screen.getByText(
        "Para não sermos chatos e não incomodar mais: o que mais pesou para você não continuar agora?"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("Preço / Momento financeiro apertado")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Não tive tempo de testar com calma")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Faltou um recurso essencial para a minha especialidade")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Já uso outro sistema e deu preguiça de migrar")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Outro motivo (campo aberto)")
    ).toBeInTheDocument();
  });

  it("customizes title with doctorName when provided", () => {
    render(
      <CrmExitSurveyModal
        isOpen={true}
        onClose={vi.fn()}
        doctorName="Fernanda"
      />
    );

    expect(
      screen.getByText(
        "Dr(a). Fernanda, para não sermos chatos e não incomodar mais: o que mais pesou para você não continuar agora?"
      )
    ).toBeInTheDocument();
  });

  it("calls onClose when 'Agora não' is clicked", () => {
    const onClose = vi.fn();
    render(<CrmExitSurveyModal isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("enables submit when selecting reasons and sends selected reasons", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CrmExitSurveyModal
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    const submitBtn = screen.getByRole("button", { name: /enviar resposta/i });
    expect(submitBtn).toBeDisabled();

    // Select two reasons
    fireEvent.click(screen.getByText("Preço / Momento financeiro apertado"));
    fireEvent.click(screen.getByText("Não tive tempo de testar com calma"));

    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        reasons: [
          "Preço / Momento financeiro apertado",
          "Não tive tempo de testar com calma",
        ],
        otherReason: undefined,
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("shows text input when 'Outro motivo' is selected and sends otherReason", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CrmExitSurveyModal
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByText("Outro motivo (campo aberto)"));

    const input = screen.getByPlaceholderText(
      "Ex: Faltou prescrição digital para fisioterapia..."
    );
    expect(input).toBeInTheDocument();

    fireEvent.change(input, {
      target: { value: "Minha secretária não se adaptou à agenda" },
    });

    const submitBtn = screen.getByRole("button", { name: /enviar resposta/i });
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        reasons: ["Outro motivo (campo aberto)"],
        otherReason: "Minha secretária não se adaptou à agenda",
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
