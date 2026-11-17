import { describe, expect, it, vi } from "vitest";
import { isTransientSupabaseError, withTransientRetry } from "./supabase-resilience";

describe("supabase-resilience", () => {
  it("identifica erros transientes (503, 502, 504, 429 e rede)", () => {
    expect(isTransientSupabaseError({ status: 503, message: "Service Unavailable" })).toBe(true);
    expect(isTransientSupabaseError({ status: 502 })).toBe(true);
    expect(isTransientSupabaseError({ status: 504 })).toBe(true);
    expect(isTransientSupabaseError({ status: 429 })).toBe(true);
    expect(isTransientSupabaseError(new Error("Failed to fetch"))).toBe(true);
  });

  it("não trata erros permanentes (400, 401, 403, 404) como transientes", () => {
    expect(isTransientSupabaseError({ status: 400, message: "Bad Request" })).toBe(false);
    expect(isTransientSupabaseError({ status: 401, message: "Unauthorized" })).toBe(false);
    expect(isTransientSupabaseError({ status: 403, message: "Forbidden" })).toBe(false);
    expect(isTransientSupabaseError({ status: 404, message: "Not Found" })).toBe(false);
    expect(isTransientSupabaseError(null)).toBe(false);
  });

  it("faz retry em 503 e recupera quando a chamada seguinte tem sucesso", async () => {
    const op = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { status: 503, message: "Service Unavailable" } })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });

    const res = await withTransientRetry(op, { maxRetries: 2, baseDelayMs: 5 });

    expect(op).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ data: { ok: true }, error: null });
  });

  it("não faz retry em erro 403", async () => {
    const op = vi.fn().mockResolvedValue({ data: null, error: { status: 403, message: "Forbidden" } });

    const res = await withTransientRetry(op, { maxRetries: 2, baseDelayMs: 5 });

    expect(op).toHaveBeenCalledTimes(1);
    expect(res.error).toEqual({ status: 403, message: "Forbidden" });
  });

  it("respeita maxRetries quando 503 persiste", async () => {
    const op = vi.fn().mockResolvedValue({ data: null, error: { status: 503, message: "Service Unavailable" } });

    const res = await withTransientRetry(op, { maxRetries: 2, baseDelayMs: 5 });

    expect(op).toHaveBeenCalledTimes(3);
    expect(res.error).toEqual({ status: 503, message: "Service Unavailable" });
  });
});
