import { describe, it, expect } from "vitest";
import { generateTotpCode, verifyTotpCode, base32ToUint8Array } from "../../supabase/functions/_shared/totp-utils.ts";
import {
  isSessionAuthenticated,
  getNewAuthExpiresAt,
  TUTORIAL_ACCOUNT_NOT_FOUND,
  TUTORIAL_ENTE_AUTH_NO_2FA,
  TUTORIAL_ENTE_AUTH_HOW_TO_USE,
} from "../../supabase/functions/_shared/whatsapp-auth-helper.ts";

describe("WhatsApp Bot 2FA TOTP (Ente Auth) & Auth Session Engine", () => {
  const TEST_SECRET = "JBSWY3DPEHPK3PXP";

  it("converte Base32 para bytes corretamente", () => {
    const bytes = base32ToUint8Array(TEST_SECRET);
    expect(bytes.length).toBe(10);
  });

  it("gera código TOTP de 6 dígitos numéricos", async () => {
    const code = await generateTotpCode(TEST_SECRET);
    expect(code).toMatch(/^\d{6}$/);
  });

  it("valida código TOTP exato com sucesso", async () => {
    const code = await generateTotpCode(TEST_SECRET);
    const isValid = await verifyTotpCode(TEST_SECRET, code);
    expect(isValid).toBe(true);
  });

  it("rejeita código TOTP inválido ou com tamanho diferente de 6 dígitos", async () => {
    const isValidWrong = await verifyTotpCode(TEST_SECRET, "000000");
    expect(isValidWrong).toBe(false);

    const isValidShort = await verifyTotpCode(TEST_SECRET, "123");
    expect(isValidShort).toBe(false);
  });

  it("valida sessão autenticada respeitando a janela de 5 horas", () => {
    const now = Date.now();
    const activeSession = {
      is_authenticated: true,
      auth_expires_at: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
    };
    expect(isSessionAuthenticated(activeSession)).toBe(true);

    const expiredSession = {
      is_authenticated: true,
      auth_expires_at: new Date(now - 1000).toISOString(),
    };
    expect(isSessionAuthenticated(expiredSession)).toBe(false);

    const unauthenticatedSession = {
      is_authenticated: false,
      auth_expires_at: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
    };
    expect(isSessionAuthenticated(unauthenticatedSession)).toBe(false);
  });

  it("calcula nova expiração com 5 horas a partir de agora", () => {
    const newExpiresAt = getNewAuthExpiresAt();
    const diffHours = (new Date(newExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
    expect(diffHours).toBeGreaterThan(4.99);
    expect(diffHours).toBeLessThanOrEqual(5.01);
  });

  it("contém links e instruções do Ente Auth nos tutoriais", () => {
    expect(TUTORIAL_ENTE_AUTH_NO_2FA).toContain("play.google.com");
    expect(TUTORIAL_ENTE_AUTH_NO_2FA).toContain("apps.apple.com");
    expect(TUTORIAL_ENTE_AUTH_NO_2FA).toContain("ente.io/auth");
    expect(TUTORIAL_ENTE_AUTH_HOW_TO_USE).toContain("6 dígitos");
    expect(TUTORIAL_ACCOUNT_NOT_FOUND).toContain("Configurações Pessoais");
  });
});
