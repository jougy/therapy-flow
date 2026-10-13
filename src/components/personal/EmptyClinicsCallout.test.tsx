import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { EmptyClinicsCallout } from "./EmptyClinicsCallout";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("EmptyClinicsCallout (Enterprise Flow)", () => {
  it("renders enterprise empty callout heading and action", () => {
    render(
      <MemoryRouter>
        <EmptyClinicsCallout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("empty-clinics-callout")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma clínica vinculada")).toBeInTheDocument();
    expect(screen.getByText("Criar novo espaço")).toBeInTheDocument();
    expect(screen.queryByText(/Aguardando convite de uma clínica/i)).not.toBeInTheDocument();
  });

  it("triggers custom onCreateClinic callback when provided", () => {
    const handleCreate = vi.fn();
    render(
      <MemoryRouter>
        <EmptyClinicsCallout onCreateClinic={handleCreate} />
      </MemoryRouter>
    );

    const createBtn = screen.getByTestId("empty-clinics-create-btn");
    fireEvent.click(createBtn);

    expect(handleCreate).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("navigates to /onboarding-clinica?mode=create by default when no onCreateClinic callback is provided", () => {
    navigateMock.mockReset();
    render(
      <MemoryRouter>
        <EmptyClinicsCallout />
      </MemoryRouter>
    );

    const createBtn = screen.getByTestId("empty-clinics-create-btn");
    fireEvent.click(createBtn);

    expect(navigateMock).toHaveBeenCalledWith("/onboarding-clinica?mode=create");
  });
});
