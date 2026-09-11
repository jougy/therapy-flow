import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanCepDigits,
  formatCepString,
  lookupCep,
  raceFirstSuccess,
  CepLookupError,
} from "./cep-service";

describe("cep-service multi-tier", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cleans non-digits and restricts to 8 chars", () => {
    expect(cleanCepDigits("04562-050")).toBe("04562050");
    expect(cleanCepDigits("04562 050 extra")).toBe("04562050");
    expect(cleanCepDigits("abc")).toBe("");
  });

  it("formats cep properly", () => {
    expect(formatCepString("04562050")).toBe("04562-050");
    expect(formatCepString("04562")).toBe("04562");
    expect(formatCepString("0456205")).toBe("04562-05");
  });

  it("raceFirstSuccess returns first non-null resolution", async () => {
    const p1 = new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 10));
    const p2 = new Promise<string | null>((resolve) => setTimeout(() => resolve("first"), 20));
    const p3 = new Promise<string | null>((resolve) => setTimeout(() => resolve("second"), 50));

    const result = await raceFirstSuccess([p1, p2, p3]);
    expect(result).toBe("first");
  });

  it("raceFirstSuccess returns null when all resolve to null or reject", async () => {
    const p1 = Promise.resolve(null);
    const p2 = Promise.reject(new Error("network"));
    const p3 = Promise.resolve(null);

    const result = await raceFirstSuccess([p1, p2, p3]);
    expect(result).toBeNull();
  });

  it("throws INVALID_LENGTH when clean CEP has fewer than 8 digits", async () => {
    await expect(lookupCep("04562")).rejects.toThrow(CepLookupError);
    await expect(lookupCep("04562")).rejects.toMatchObject({
      reason: "INVALID_LENGTH",
    });
  });

  it("resolves via local proxy when available", async () => {
    const mockProxyData = {
      cep: "04562050",
      street: "Rua Furnas",
      neighborhood: "Brooklin Paulista",
      city: "São Paulo",
      state: "SP",
      source: "dev-server-proxy",
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/cep/")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockProxyData,
        } as Response);
      }
      return Promise.reject(new Error("other"));
    });

    const result = await lookupCep("04562-050");
    expect(result.city).toBe("São Paulo");
    expect(result.street).toBe("Rua Furnas");
    expect(result.source).toBe("dev-server-proxy");
  });

  it("resolves via public APIs in parallel when proxy is unavailable", async () => {
    const mockBrasilApiData = {
      cep: "04562050",
      street: "Rua Furnas",
      neighborhood: "Brooklin Paulista",
      city: "São Paulo",
      state: "SP",
    };

    global.fetch = vi.fn().mockImplementation((input: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.startsWith("/api/cep/")) {
        return Promise.resolve({ ok: false, status: 404 } as Response);
      }
      if (url.includes("brasilapi.com.br")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockBrasilApiData,
        } as Response);
      }
      return Promise.reject(new Error("network error"));
    });

    const result = await lookupCep("04562-050");
    expect(result.city).toBe("São Paulo");
    expect(result.street).toBe("Rua Furnas");
    expect(result.source).toBe("brasilapi");
  });

  it("throws NOT_FOUND when all strategies fail", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Offline"));

    await expect(lookupCep("00000000")).rejects.toThrow(CepLookupError);
    await expect(lookupCep("00000000")).rejects.toMatchObject({
      reason: "NOT_FOUND",
    });
  });
});
