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

  it("successfully resolves address from ViaCEP when available", async () => {
    const mockViaCepResponse = {
      cep: "04562-050",
      logradouro: "Rua Pais de Araújo",
      bairro: "Itaim Bibi",
      localidade: "São Paulo",
      uf: "SP",
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockViaCepResponse,
    } as Response);

    const result = await lookupCep("04562-050");
    expect(result).toEqual({
      cep: "04562-050",
      street: "Rua Pais de Araújo",
      neighborhood: "Itaim Bibi",
      city: "São Paulo",
      state: "SP",
      source: "viacep",
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to BrasilAPI when ViaCEP returns erro", async () => {
    const mockBrasilApiResponse = {
      cep: "04562050",
      street: "Rua Pais de Araújo",
      neighborhood: "Itaim Bibi",
      city: "São Paulo",
      state: "SP",
    };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ erro: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBrasilApiResponse,
      } as Response);

    const result = await lookupCep("04562-050");
    expect(result).toEqual({
      cep: "04562-050",
      street: "Rua Pais de Araújo",
      neighborhood: "Itaim Bibi",
      city: "São Paulo",
      state: "SP",
      source: "brasilapi",
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to AwesomeAPI when ViaCEP and BrasilAPI fail", async () => {
    const mockAwesomeApiResponse = {
      cep: "04562050",
      address: "Rua Pais de Araújo",
      district: "Itaim Bibi",
      city: "São Paulo",
      state: "SP",
    };

    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("ViaCEP network down"))
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAwesomeApiResponse,
      } as Response);

    const result = await lookupCep("04562050");
    expect(result).toEqual({
      cep: "04562-050",
      street: "Rua Pais de Araújo",
      neighborhood: "Itaim Bibi",
      city: "São Paulo",
      state: "SP",
      source: "awesomeapi",
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("throws NOT_FOUND when all providers fail", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("ViaCEP error"))
      .mockRejectedValueOnce(new Error("BrasilAPI error"))
      .mockRejectedValueOnce(new Error("AwesomeAPI error"));

    await expect(lookupCep("00000000")).rejects.toThrow(CepLookupError);
    await expect(lookupCep("00000000")).rejects.toMatchObject({
      reason: "NOT_FOUND",
    });
  });
});
