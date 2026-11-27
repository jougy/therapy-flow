import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyDestructiveToast } from "./toast-telemetry";
import { AGENDA_PAST_EVENT_ERROR_MESSAGE } from "./agenda-events";
import { toast } from "@/hooks/use-toast";
import { localTelemetryManager } from "./telemetry-local-store";

describe("classifyDestructiveToast & use-toast telemetry routing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("classifies expected user validation and business rule toasts as 'validation'", () => {
    expect(
      classifyDestructiveToast({
        title: "Horário inválido",
        description: AGENDA_PAST_EVENT_ERROR_MESSAGE,
      })
    ).toBe("validation");

    expect(classifyDestructiveToast({ title: "Paciente obrigatório" })).toBe("validation");
    expect(classifyDestructiveToast({ title: "Campos pendentes", description: "Informe um CPF válido." })).toBe("validation");
    expect(classifyDestructiveToast({ title: "Permissão negada" })).toBe("validation");
    expect(classifyDestructiveToast({ title: "Limite de Atendimentos Atingido" })).toBe("validation");
    expect(
      classifyDestructiveToast({
        title: "Erro ao entrar",
        description: "Invalid login credentials",
      })
    ).toBe("validation");
  });

  it("respects explicit telemetry overrides ('skip', 'validation', 'error')", () => {
    expect(classifyDestructiveToast({ title: "Erro ao salvar atendimento", telemetry: false })).toBe("skip");
    expect(classifyDestructiveToast({ title: "Falha qualquer", telemetry: "validation" })).toBe("validation");
    expect(classifyDestructiveToast({ title: "Horário inválido", telemetry: "error" })).toBe("error");
  });

  it("classifies real technical failures as 'error'", () => {
    expect(
      classifyDestructiveToast({
        title: "Erro ao salvar atendimento",
        description: "Clique em i para ver o erro completo.",
      })
    ).toBe("error");

    expect(
      classifyDestructiveToast({
        title: "Erro ao criar agendamento",
        description: "Falha de conexão com o servidor.",
      })
    ).toBe("error");
  });

  it("records only form_validation_error (without recordError) when validation toast fires", () => {
    const recordErrorSpy = vi.spyOn(localTelemetryManager, "recordError").mockImplementation(() => {});
    const recordActionSpy = vi.spyOn(localTelemetryManager, "recordAction").mockImplementation(() => {});

    toast({
      title: "Horário inválido",
      description: AGENDA_PAST_EVENT_ERROR_MESSAGE,
      variant: "destructive",
    });

    expect(recordErrorSpy).not.toHaveBeenCalled();
    expect(recordActionSpy).toHaveBeenCalledWith("form_validation_error");
  });

  it("skips telemetry completely when telemetry: false is passed", () => {
    const recordErrorSpy = vi.spyOn(localTelemetryManager, "recordError").mockImplementation(() => {});
    const recordActionSpy = vi.spyOn(localTelemetryManager, "recordAction").mockImplementation(() => {});

    toast({
      title: "Erro ao salvar atendimento",
      description: "Detalhes técnicos já enviados manualmente.",
      variant: "destructive",
      telemetry: false,
    });

    expect(recordErrorSpy).not.toHaveBeenCalled();
    expect(recordActionSpy).not.toHaveBeenCalled();
  });

  it("forwards real destructive toasts with custom scope and context to recordError", () => {
    const recordErrorSpy = vi.spyOn(localTelemetryManager, "recordError").mockImplementation(() => {});

    toast({
      title: "Erro ao criar agendamento",
      description: "Falha inesperada",
      variant: "destructive",
      telemetryScope: "agenda.create_error",
      telemetryContext: { step: "insert" },
    });

    expect(recordErrorSpy).toHaveBeenCalledWith({
      scope: "agenda.create_error",
      message: "Erro ao criar agendamento: Falha inesperada",
      context: {
        title: "Erro ao criar agendamento",
        description: "Falha inesperada",
        step: "insert",
      },
    });
  });
});
