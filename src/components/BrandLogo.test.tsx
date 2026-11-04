import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { BrandLogo } from "@/components/BrandLogo";

describe("BrandLogo Component with Dynamic Branding", () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renders 'Pluri Health' when on pluri.health domain", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        hostname: "pluri.health",
        search: "",
      },
    });

    render(<BrandLogo type="horizontal" showText={true} />);
    expect(screen.getByText(/Health/i)).toBeInTheDocument();
  });

  it("renders 'Pluri Fisio' when on app.plurifisio.com.br domain", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        hostname: "app.plurifisio.com.br",
        search: "",
      },
    });

    render(<BrandLogo type="horizontal" showText={true} />);
    expect(screen.getByText(/Fisio/i)).toBeInTheDocument();
  });
});
