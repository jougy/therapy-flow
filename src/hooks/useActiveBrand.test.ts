import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getActiveBrand } from "@/hooks/useActiveBrand";

describe("Dynamic Branding - useActiveBrand & getActiveBrand", () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("resolves to Pluri Health when hostname is pluri.health", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        hostname: "pluri.health",
        search: "",
      },
    });

    const brand = getActiveBrand();
    expect(brand.name).toBe("Pluri Health");
    expect(brand.brandSuffix).toBe("Health");
    expect(brand.isHealth).toBe(true);
    expect(brand.isFisio).toBe(false);
  });

  it("resolves to Pluri Fisio when hostname is app.plurifisio.com.br", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        hostname: "app.plurifisio.com.br",
        search: "",
      },
    });

    const brand = getActiveBrand();
    expect(brand.name).toBe("Pluri Fisio");
    expect(brand.brandSuffix).toBe("Fisio");
    expect(brand.isFisio).toBe(true);
    expect(brand.isHealth).toBe(false);
  });

  it("allows overriding brand via ?brand=fisio query parameter in dev/test", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        hostname: "localhost",
        search: "?brand=fisio",
      },
    });

    const brand = getActiveBrand();
    expect(brand.name).toBe("Pluri Fisio");
    expect(brand.brandSuffix).toBe("Fisio");
  });

  it("defaults to Pluri Health for localhost or unmatched domains", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        hostname: "localhost",
        search: "",
      },
    });

    const brand = getActiveBrand();
    expect(brand.name).toBe("Pluri Health");
    expect(brand.brandSuffix).toBe("Health");
  });
});
