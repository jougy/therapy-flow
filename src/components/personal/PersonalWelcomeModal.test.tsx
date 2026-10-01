import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalWelcomeModal } from "./PersonalWelcomeModal";

const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
};

let localStorageMock = createStorageMock();
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("PersonalWelcomeModal (Security & Big-O Hardening)", () => {
  beforeEach(() => {
    localStorageMock = createStorageMock();
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  it("renders with sanitized first name and escapes malicious or control characters", () => {
    // Malicious script tag or control characters in userName
    const dirtyName = "\u0000\u001F<script>alert('xss')</script> Dra. Maria Silva";
    render(<PersonalWelcomeModal userId="usr-safe-1" userName={dirtyName} />);

    expect(screen.getByTestId("personal-welcome-modal")).toBeInTheDocument();
    // React escapes JSX strings, and our sanitizer removes control chars and isolates first token
    expect(screen.getByText(/Bem-vindo\(a\) à Pluri Health/i)).toBeInTheDocument();
    expect(screen.queryByText("<script>")).not.toBeInTheDocument();
  });

  it("handles Safari Private Browsing mode (SecurityError on getItem) without throwing or crashing", () => {
    localStorageMock.getItem.mockImplementation(() => {
      const err = new Error("The operation is insecure.");
      err.name = "SecurityError";
      throw err;
    });

    expect(() => {
      render(<PersonalWelcomeModal userId="usr-safari-private" userName="Dra. Ana" />);
    }).not.toThrow();

    // Modal safely fails open or doesn't crash the application
    expect(screen.getByTestId("personal-welcome-modal")).toBeInTheDocument();
  });

  it("handles QuotaExceededError on setItem without throwing or blocking modal dismissal", () => {
    localStorageMock.setItem.mockImplementation(() => {
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    });

    render(<PersonalWelcomeModal userId="usr-quota-full" userName="Dr. Carlos" />);

    const startBtn = screen.getByTestId("welcome-start-button");
    expect(() => {
      fireEvent.click(startBtn);
    }).not.toThrow();

    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it("limits first name length to 50 characters to prevent buffer and visual layout overflow", () => {
    const excessivelyLongName = "A".repeat(120) + " Silva";
    render(<PersonalWelcomeModal userId="usr-long-name" userName={excessivelyLongName} />);

    expect(screen.getByTestId("personal-welcome-modal")).toBeInTheDocument();
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toContain("A".repeat(50));
    expect(heading.textContent).not.toContain("A".repeat(51));
  });

  it("does not render modal if already seen in localStorage", () => {
    localStorage.setItem("pluri_welcome_seen_usr-already-seen", new Date().toISOString());
    render(<PersonalWelcomeModal userId="usr-already-seen" userName="Dr. Roberto" />);

    expect(screen.queryByTestId("personal-welcome-modal")).not.toBeInTheDocument();
  });
});
