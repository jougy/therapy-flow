import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

const ThrowingChild = () => {
  throw new Error("render crash");
};

describe("AppErrorBoundary", () => {
  it("shows a fallback UI instead of leaving the screen blank", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleGroupSpy = vi.spyOn(console, "groupCollapsed").mockImplementation(() => undefined);
    const consoleGroupEndSpy = vi.spyOn(console, "groupEnd").mockImplementation(() => undefined);
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <ThrowingChild />
      </AppErrorBoundary>
    );

    expect(screen.getByText("Algo deu errado nesta tela")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recarregar/i })).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
    consoleGroupSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });
});
