import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { PlatformErrorsLogsPage } from "./PlatformErrorsLogsPage";
import {
  clearDebugEvents,
  logRuntimeError,
  logRuntimeRpc,
} from "@/lib/runtime-debug";
import { addBreadcrumb, clearBreadcrumbs } from "@/lib/telemetry-breadcrumbs";
import { generateAntigravityDiagnosticPrompt, groupEventsIntoIssues } from "./errors-logs/helpers";

describe("Sentry-style Issues & Antigravity Diagnostics", () => {
  beforeEach(() => {
    clearDebugEvents();
    clearBreadcrumbs();
    vi.clearAllMocks();
  });

  it("groups repeated errors into a single issue with occurrence count and breadcrumbs", () => {
    addBreadcrumb("navigation", "Navegou para /pacientes/123");
    addBreadcrumb("action", "Clicou no botão Salvar Prontuário");

    // Simula 3 disparos do mesmo erro
    logRuntimeError("prontuario.save", new Error("TypeError: Cannot read properties of undefined (reading 'paciente_id')"));
    logRuntimeError("prontuario.save", new Error("TypeError: Cannot read properties of undefined (reading 'paciente_id')"));
    logRuntimeError("prontuario.save", new Error("TypeError: Cannot read properties of undefined (reading 'paciente_id')"));

    render(<PlatformErrorsLogsPage />);

    // Alternar para a aba Issues Agrupadas
    const issuesTabBtn = screen.getByRole("button", { name: /Issues Agrupadas/ });
    fireEvent.click(issuesTabBtn);

    // Deve encontrar a issue única
    expect(screen.getByText("TypeError: Cannot read properties of undefined (reading 'paciente_id')")).toBeInTheDocument();
    expect(screen.getByText("3 ocorrências")).toBeInTheDocument();
    expect(screen.getByText(/breadcrumb\(s\) anexado\(s\)/)).toBeInTheDocument();
  });

  it("generates an Antigravity prompt with breadcrumbs, occurrences and stack trace", () => {
    const fakeEvents = [
      {
        id: "ev-1",
        timestamp: Date.now(),
        timeString: "11:50:00",
        type: "error" as const,
        scope: "financeiro.recibo",
        message: "Falha ao gerar recibo com valor nulo",
        errorDetails: {
          message: "Falha ao gerar recibo com valor nulo",
          stack: "Error at ReciboModal.tsx:42:15\n at handleClick (Button.tsx:12)",
        },
        context: {
          breadcrumbs: [
            {
              id: "b-1",
              timestamp: Date.now(),
              timeString: "11:49:50",
              category: "navigation" as const,
              message: "Acessou /financeiro",
            },
          ],
          environment: {
            os: "iOS",
            deviceType: "mobile",
          },
        },
      },
    ];

    const issues = groupEventsIntoIssues(fakeEvents);
    expect(issues.length).toBe(1);

    const prompt = generateAntigravityDiagnosticPrompt(issues[0]);
    expect(prompt).toContain("Relato de Investigação de Bug para Antigravity");
    expect(prompt).toContain("Falha ao gerar recibo com valor nulo");
    expect(prompt).toContain("financeiro.recibo");
    expect(prompt).toContain("Acessou /financeiro");
    expect(prompt).toContain("ReciboModal.tsx:42:15");
  });
});
