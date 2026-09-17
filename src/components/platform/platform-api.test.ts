import { beforeEach, describe, expect, it, vi } from "vitest";
import { callPlatformAccountAdmin, getErrorMessage, formatClinicAccessStatus } from "./platform-api";
import { supabase } from "@/integrations/supabase/client";
import { logRuntimeRpc, logRuntimeError } from "@/lib/runtime-debug";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: "mock-token-aal2",
          },
        },
        error: null,
      }),
    },
    functions: {
      invoke: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

vi.mock("@/lib/runtime-debug", () => ({
  logRuntimeRpc: vi.fn(),
  logRuntimeError: vi.fn(),
}));

describe("platform-api - Security & Logging Sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: "mock-token-aal2",
        } as any,
      },
      error: null,
    });
  });

  it("redacts sensitive fields like passwords, tokens, and secrets from runtime debug logs", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { data: { success: true } },
      error: null,
    });

    const payloadWithSecrets = {
      clinicId: "clinic-123",
      email: "dr@example.com",
      password: "SuperSecretPassword123!",
      confirmationCode: "654321",
      apiSecretKey: "sec_live_9999",
      safeNote: "Normal field",
    };

    await callPlatformAccountAdmin("create_subaccount", payloadWithSecrets, "Criação autorizada de subconta");

    expect(supabase.functions.invoke).toHaveBeenCalledWith("platform-account-admin", {
      body: {
        action: "create_subaccount",
        payload: payloadWithSecrets,
        reason: "Criação autorizada de subconta",
      },
      headers: {
        Authorization: "Bearer mock-token-aal2",
      },
    });

    expect(logRuntimeRpc).toHaveBeenCalledWith(
      "functions/platform-account-admin:create_subaccount",
      expect.objectContaining({
        clinicId: "clinic-123",
        email: "dr@example.com",
        password: "[REDACTED]",
        confirmationCode: "[REDACTED]",
        apiSecretKey: "[REDACTED]",
        safeNote: "Normal field",
      }),
      "success",
      expect.any(Number),
      { data: { success: true } }
    );
  });

  it("redacts sensitive fields even when the function returns an error", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: new Error("Falha na chamada"),
    });

    const payload = {
      identifier: "user-456",
      password: "NewPasswordToRedact!",
    };

    await expect(
      callPlatformAccountAdmin("update_subaccount_access", payload, "Alteração de credencial do usuário")
    ).rejects.toThrow("Falha na chamada");

    expect(logRuntimeRpc).toHaveBeenCalledWith(
      "functions/platform-account-admin:update_subaccount_access",
      expect.objectContaining({
        identifier: "user-456",
        password: "[REDACTED]",
      }),
      "error",
      expect.any(Number),
      null,
      "Falha na chamada"
    );

    expect(logRuntimeError).toHaveBeenCalledWith(
      "platform.admin",
      "Falha na ação update_subaccount_access: Falha na chamada",
      expect.objectContaining({
        payload: expect.objectContaining({
          identifier: "user-456",
          password: "[REDACTED]",
        }),
      })
    );
  });

  it("formats clinic status labels accurately", () => {
    expect(formatClinicAccessStatus("active")).toBe("Ativa");
    expect(formatClinicAccessStatus("payment_pending")).toBe("Pagamento pendente");
    expect(formatClinicAccessStatus("banned")).toBe("Bloqueada");
    expect(formatClinicAccessStatus("temporarily_paused")).toBe("Pausada temporariamente");
    expect(formatClinicAccessStatus("unknown_status")).toBe("unknown_status");
  });

  it("extracts error messages reliably", () => {
    expect(getErrorMessage(new Error("Erro de rede"))).toBe("Erro de rede");
    expect(getErrorMessage({ message: "Objeto de erro" })).toBe("Objeto de erro");
    expect(getErrorMessage(null)).toBe("Operação indisponível.");
  });
});
