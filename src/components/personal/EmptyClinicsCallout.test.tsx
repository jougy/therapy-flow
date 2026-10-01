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

describe("EmptyClinicsCallout (Security & Big-O Hardening)", () => {
  it("renders with sanitized email and prevents control characters injection", () => {
    const dirtyEmail = "\u0000\u001Duser@clinic.com";
    render(
      <MemoryRouter>
        <EmptyClinicsCallout userEmail={dirtyEmail} />
      </MemoryRouter>
    );

    expect(screen.getByTestId("empty-clinics-callout")).toBeInTheDocument();
    expect(screen.getByText("user@clinic.com", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Nenhuma clínica ativa no momento")).toBeInTheDocument();
  });

  it("limits email display length to 100 characters to prevent DOM layout abuse", () => {
    const excessiveEmail = "a".repeat(120) + "@clinic.com";
    render(
      <MemoryRouter>
        <EmptyClinicsCallout userEmail={excessiveEmail} />
      </MemoryRouter>
    );

    const emailStrong = screen.getByText((content, element) => {
      return element?.tagName === "STRONG" && content.includes("a".repeat(50));
    });
    expect(emailStrong.textContent?.length).toBeLessThanOrEqual(104); // "(...)" wrapped
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
