import { describe, expect, it } from "vitest";
import {
  getSecurityEventMeta,
  getSecurityPostureMeta,
  parseSecurityUserAgent,
  shouldShowAdminSecuritySection,
} from "@/lib/security-settings";

describe("security settings helpers", () => {
  it("shows the admin security section only for clinic admins", () => {
    expect(shouldShowAdminSecuritySection("clinic", true)).toBe(true);
    expect(shouldShowAdminSecuritySection("clinic", false)).toBe(false);
    expect(shouldShowAdminSecuritySection("solo", true)).toBe(false);
    expect(shouldShowAdminSecuritySection(null, true)).toBe(false);
  });

  it("maps known security events to readable labels", () => {
    expect(getSecurityEventMeta("password_changed")).toMatchObject({
      label: "Senha alterada",
      tone: "default",
    });

    expect(getSecurityEventMeta("subaccount_role_changed")).toMatchObject({
      label: "Hierarquia alterada",
      tone: "admin",
    });
  });

  it("provides a safe fallback for unknown events", () => {
    expect(getSecurityEventMeta("unexpected_event")).toEqual({
      description: "Evento de seguranca registrado.",
      label: "Evento de seguranca",
      tone: "muted",
    });
  });

  it("flags temporary passwords before stale access", () => {
    expect(
      getSecurityPostureMeta({
        lastPasswordChangedAt: null,
        lastSeenAt: "2026-03-28T10:00:00.000Z",
        passwordTemporary: true,
      })
    ).toEqual({
      description: "A senha atual ainda e provisoria e deve ser trocada.",
      label: "Senha provisoria",
      tone: "warning",
    });

    expect(
      getSecurityPostureMeta({
        lastPasswordChangedAt: "2026-03-01T10:00:00.000Z",
        lastSeenAt: "2026-02-01T10:00:00.000Z",
        passwordTemporary: false,
      })
    ).toEqual({
      description: "A conta nao acessa a plataforma ha bastante tempo.",
      label: "Acesso desatualizado",
      tone: "muted",
    });
  });

  it("extracts a readable browser and platform from the user agent", () => {
    expect(
      parseSecurityUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
      )
    ).toEqual({
      browser: "Chrome",
      platform: "macOS",
    });
  });
});
