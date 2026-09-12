import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanCepDigits,
  formatCepString,
  lookupCep,
  CepLookupError,
} from "./cep-service";

describe("cep-service", () => {
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

  it("throws INVALID_LENGTH when clean CEP has fewer than 8 digits", async () => {
    await expect(lookupCep("04562")).rejects.toThrow(CepLookupError);
    await expect(lookupCep("04562")).rejects.toMatchObject({
      reason: "INVALID_LENGTH",
    });
  });

  it("resolves from ViaCEP when available", async () => {
    const mockViaCepData = {
      cep: "04562-050",
      logradouro: "Rua Furnas",
      bairro: "Brooklin Paulista",
      localidade: "São Paulo",
      uf: "SP",
    };

    global.fetch = vi.fn().mockImplementation((input: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.includes("viacep.com.br")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockViaCepData,
        } as Response);
      }
      return Promise.reject(new Error("other"));
    });

    const result = await lookupCep("04562-050");
    expect(result.city).toBe("São Paulo");
    expect(result.street).toBe("Rua Furnas");
    expect(result.source).toBe("viacep");
  });

  it("falls back to BrasilAPI when ViaCEP returns erro or fails", async () => {
    const mockBrasilApiData = {
      cep: "04562050",
      street: "Rua Furnas",
      neighborhood: "Brooklin Paulista",
      city: "São Paulo",
      state: "SP",
    };

    global.fetch = vi.fn().mockImplementation((input: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.includes("viacep.com.br")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ erro: true }),
        } as Response);
      }
      if (url.includes("brasilapi.com.br")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockBrasilApiData,
        } as Response);
      }
      return Promise.reject(new Error("other"));
    });

    const result = await lookupCep("04562-050");
    expect(result.city).toBe("São Paulo");
    expect(result.street).toBe("Rua Furnas");
    expect(result.source).toBe("brasilapi");
  });

  it("falls back to AwesomeAPI when ViaCEP and BrasilAPI fail", async () => {
    const mockAwesomeApiData = {
      cep: "04562050",
      address: "Rua Furnas",
      district: "Brooklin Paulista",
      city: "São Paulo",
      state: "SP",
    };

    global.fetch = vi.fn().mockImplementation((input: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.includes("viacep.com.br") || url.includes("brasilapi.com.br")) {
        return Promise.reject(new Error("network error"));
      }
      if (url.includes("awesomeapi.com.br")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockAwesomeApiData,
        } as Response);
      }
      return Promise.reject(new Error("other"));
    });

    const result = await lookupCep("04562-050");
    expect(result.city).toBe("São Paulo");
    expect(result.street).toBe("Rua Furnas");
    expect(result.source).toBe("awesomeapi");
  });

  it("throws NOT_FOUND when all strategies fail", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Offline"));

    await expect(lookupCep("00000000")).rejects.toThrow(CepLookupError);
    await expect(lookupCep("00000000")).rejects.toMatchObject({
      reason: "NOT_FOUND",
    });
  });
});
