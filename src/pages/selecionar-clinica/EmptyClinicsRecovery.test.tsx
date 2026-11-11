import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyClinicsRecovery } from "./EmptyClinicsRecovery";

describe("EmptyClinicsRecovery Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders manual trigger state when not searching and under max attempts", () => {
    const handleSearch = vi.fn();
    render(
      <EmptyClinicsRecovery
        isSearching={false}
        searchAttempt={0}
        maxAttempts={3}
        onSearchClinics={handleSearch}
      />
    );

    expect(screen.getByText("Nenhum espaço exibido no momento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /buscar minhas clínicas/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /buscar minhas clínicas/i }));
    expect(handleSearch).toHaveBeenCalledTimes(1);
  });

  it("renders searching state with attempt and custom friendly message", () => {
    render(
      <EmptyClinicsRecovery
        isSearching={true}
        searchAttempt={2}
        maxAttempts={3}
        statusMessage="Reconectando aos seus dados (tentativa 2 de 3)..."
        onSearchClinics={vi.fn()}
      />
    );

    expect(screen.getByText("Localizando seus espaços...")).toBeInTheDocument();
    expect(screen.getByText("Reconectando aos seus dados (tentativa 2 de 3)...")).toBeInTheDocument();
    expect(screen.getByText("Buscando clínicas...")).toBeInTheDocument();
    expect(screen.getByTestId("search-clinics-btn")).toBeDisabled();
  });

  it("renders unstable connection state with tips when attempts are exhausted", () => {
    const handleSearch = vi.fn();
    render(
      <EmptyClinicsRecovery
        isSearching={false}
        searchAttempt={3}
        maxAttempts={3}
        onSearchClinics={handleSearch}
      />
    );

    expect(screen.getByText("Conexão instável ou lenta")).toBeInTheDocument();
    expect(screen.getByText(/Dicas rápidas para reconectar/i)).toBeInTheDocument();
    expect(screen.getByText(/Verifique se o seu Wi-Fi ou dados móveis/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /buscar minhas clínicas/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /buscar minhas clínicas/i }));
    expect(handleSearch).toHaveBeenCalledTimes(1);
  });
});
