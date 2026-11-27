import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeSessionMutationWithRetry,
  formatSessionErrorToastDescription,
  isTransientNetworkError,
  reportSessionActionError,
  resolveTargetSessionIdForSave,
} from "./sessionSaveResilience";
import * as patientRouting from "@/lib/patient-routing";
import { localTelemetryManager } from "@/lib/telemetry-local-store";

describe("sessionSaveResilience", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("detects transient iOS Safari / fetch network errors correctly", () => {
    expect(isTransientNetworkError(new TypeError("Load failed"))).toBe(true);
    expect(isTransientNetworkError({ message: "TypeError: Failed to fetch" })).toBe(true);
    expect(isTransientNetworkError({ code: "42501", message: "new row violates row-level security policy" })).toBe(false);
  });

  it("retries once on transient network error and succeeds on second attempt", async () => {
    const mutationFn = vi
      .fn<() => Promise<{ data: { id: string } | null; error: unknown }>>()
      .mockResolvedValueOnce({ data: null, error: new TypeError("Load failed") })
      .mockResolvedValueOnce({ data: { id: "sess-1" }, error: null });

    const res = await executeSessionMutationWithRetry(mutationFn, { retryDelayMs: 0 });

    expect(mutationFn).toHaveBeenCalledTimes(2);
    expect(res).toEqual({
      data: { id: "sess-1" },
      error: null,
      retried: true,
      networkFailed: false,
    });
  });

  it("marks networkFailed when retry also fails with network error", async () => {
    const mutationFn = vi
      .fn<() => Promise<{ data: null; error: unknown }>>()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    const res = await executeSessionMutationWithRetry(mutationFn, { retryDelayMs: 0 });

    expect(mutationFn).toHaveBeenCalledTimes(2);
    expect(res.retried).toBe(true);
    expect(res.networkFailed).toBe(true);
    expect(res.data).toBeNull();
  });

  it("does not retry non-network database/RLS errors", async () => {
    const dbError = { code: "42501", message: "new row violates row-level security policy" };
    const mutationFn = vi
      .fn<() => Promise<{ data: null; error: unknown }>>()
      .mockResolvedValue({ data: null, error: dbError });

    const res = await executeSessionMutationWithRetry(mutationFn, { retryDelayMs: 0 });

    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(res).toEqual({
      data: null,
      error: dbError,
      retried: false,
      networkFailed: false,
    });
  });

  it("resolves targetSessionId from activeSessionId or lazily via resolveSessionReference for ATD-66", async () => {
    const fromActive = await resolveTargetSessionIdForSave({
      resolvedSessionId: null,
      activeSessionId: "11111111-1111-4111-8111-111111111111",
      sessionId: "ATD-66",
      patientId: "PAC-016",
    });
    expect(fromActive).toBe("11111111-1111-4111-8111-111111111111");

    const spy = vi.spyOn(patientRouting, "resolveSessionReference").mockResolvedValue({
      data: { id: "22222222-2222-4222-8222-222222222222" } as patientRouting.SessionRow,
      error: null,
      isNew: false,
      sessionIndex: 66,
      patient: null,
      totalSessions: 66,
    });

    const fromFallback = await resolveTargetSessionIdForSave({
      resolvedSessionId: null,
      activeSessionId: null,
      sessionId: "ATD-66",
      patientId: "PAC-016",
      clinicId: "8a36d1ba-55ad-46fc-8a47-870b14c66fff",
    });
    expect(spy).toHaveBeenCalled();
    expect(fromFallback).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("formats informative error summary and sends rich telemetry to recordError", () => {
    const recordErrorSpy = vi.spyOn(localTelemetryManager, "recordError").mockImplementation(() => {});
    const details = {
      title: "Erro ao salvar atendimento",
      context: "Atualização dos dados do atendimento",
      message: "new row violates row-level security policy for table sessions",
      code: "42501",
      details: "Failing RLS check",
      hint: "Check clinic membership",
    };

    const desc = formatSessionErrorToastDescription(details);
    expect(desc).toContain("new row violates row-level security policy");
    expect(desc).toContain("Clique em (i) para detalhes.");

    reportSessionActionError("Erro ao salvar atendimento", details, {
      sessionId: "22222222-2222-4222-8222-222222222222",
      isNew: false,
      targetStatus: "rascunho",
    });

    expect(recordErrorSpy).toHaveBeenCalledWith({
      scope: "session.save_error",
      message: "Erro ao salvar atendimento: new row violates row-level security policy for table sessions [42501]",
      context: {
        actionContext: "Atualização dos dados do atendimento",
        code: "42501",
        details: "Failing RLS check",
        hint: "Check clinic membership",
        isNew: false,
        targetStatus: "rascunho",
        hasSessionId: true,
      },
    });
  });
});
