import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PatientMobileDock } from "./PatientMobileDock";

describe("PatientMobileDock", () => {
  it("renders all 10 default items when features are enabled", () => {
    const handleTabChange = vi.fn();
    render(
      <PatientMobileDock
        activeTab="inicio"
        onTabChange={handleTabChange}
        showFiles={true}
        showStats={true}
      />
    );

    expect(screen.getByText("Início")).toBeInTheDocument();
    expect(screen.getByText("Resumo")).toBeInTheDocument();
    expect(screen.getByText("Agendar")).toBeInTheDocument();
    expect(screen.getByText("Agenda")).toBeInTheDocument();
    expect(screen.getByText("Atender")).toBeInTheDocument();
    expect(screen.getByText("Histórico")).toBeInTheDocument();
    expect(screen.getByText("Arquivos")).toBeInTheDocument();
    expect(screen.getByText("Estatísticas")).toBeInTheDocument();
    expect(screen.getByText("Termos")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("calls onTabChange when a dock item is clicked", () => {
    const handleTabChange = vi.fn();
    render(
      <PatientMobileDock
        activeTab="inicio"
        onTabChange={handleTabChange}
      />
    );

    const agendaBtn = screen.getByRole("button", { name: "Agenda completa" });
    fireEvent.click(agendaBtn);

    expect(handleTabChange).toHaveBeenCalledWith("agenda_completa");
  });
});
