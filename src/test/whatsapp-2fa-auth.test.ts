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

  it("reconhece comandos de escape e cancelamento para destravar usuários", async () => {
    const { isGlobalCancelCommand, isGlobalBackCommand } = await import(
      "../../supabase/functions/whatsapp-webhook/owner-copilot.ts"
    );

    expect(isGlobalCancelCommand("cancelar")).toBe(true);
    expect(isGlobalCancelCommand("sair")).toBe(true);
    expect(isGlobalCancelCommand("menu")).toBe(true);
    expect(isGlobalCancelCommand("desistir")).toBe(true);
    expect(isGlobalCancelCommand("começar")).toBe(true);

    expect(isGlobalBackCommand("voltar")).toBe(true);
    expect(isGlobalBackCommand("retornar")).toBe(true);
    expect(isGlobalBackCommand("anterior")).toBe(true);
  });

  it("verifica regras de texto do fluxo de login e sessão ativa", () => {
    const promptLogin = "entre no seu app de autenticação, copie e cole aqui o código token da pluri para realizar o seu login";
    expect(promptLogin).toContain("entre no seu app de autenticação");
    expect(promptLogin).toContain("token da pluri");

    const alreadyAuthMessage = "Você já está conectado ao Pluri-Health! Caso queira sair ou trocar de conta, basta digitar sair.";
    expect(alreadyAuthMessage).toContain("já está conectado");
    expect(alreadyAuthMessage).toContain("sair");
  });

  it("extrai corretamente o comando de login com token inline ou em mensagens separadas", () => {
    const parseLogin = (text: string) => {
      const match = text.match(/^\s*(?:login|entrar)(?:[\s:-]+(\d{6}))?\s*$/i);
      return {
        isLogin: Boolean(match),
        token: match?.[1] || null,
      };
    };

    expect(parseLogin("login")).toEqual({ isLogin: true, token: null });
    expect(parseLogin("entrar")).toEqual({ isLogin: true, token: null });
    expect(parseLogin("LOGIN")).toEqual({ isLogin: true, token: null });
    expect(parseLogin("ENTRAR")).toEqual({ isLogin: true, token: null });

    // Inline com espaço
    expect(parseLogin("login 167611")).toEqual({ isLogin: true, token: "167611" });
    expect(parseLogin("entrar 167611")).toEqual({ isLogin: true, token: "167611" });

    // Inline com quebra de linha
    expect(parseLogin("login\n167611")).toEqual({ isLogin: true, token: "167611" });
    expect(parseLogin("entrar\n167611")).toEqual({ isLogin: true, token: "167611" });

    // Inline com hífen ou dois pontos
    expect(parseLogin("login - 167611")).toEqual({ isLogin: true, token: "167611" });
    expect(parseLogin("login: 167611")).toEqual({ isLogin: true, token: "167611" });

    // Mensagens não relacionadas
    expect(parseLogin("bom dia login").isLogin).toBe(false);
    expect(parseLogin("quero login agora").isLogin).toBe(false);
  });

  it("reconhece tokens de 6 dígitos soltos para validação direta e comandos de reset", () => {
    const isStandaloneToken = (text: string) => /^\d{6}$/.test(text.trim());
    expect(isStandaloneToken("933717")).toBe(true);
    expect(isStandaloneToken(" 167611 ")).toBe(true);
    expect(isStandaloneToken("12345")).toBe(false);
    expect(isStandaloneToken("1234567")).toBe(false);
    expect(isStandaloneToken("abc123")).toBe(false);

    const isReset = (text: string) => {
      const lower = text.trim().toLowerCase();
      return lower === "reset" || lower === "reiniciar" || lower === "destravar" || lower === "limpar";
    };
    expect(isReset("reset")).toBe(true);
    expect(isReset("REINICIAR")).toBe(true);
    expect(isReset("destravar")).toBe(true);
    expect(isReset("limpar")).toBe(true);
    expect(isReset("sair")).toBe(false);
  });
});

describe("WhatsApp Bot Website Lead -> Customer Support Flow (Unregistered Numbers)", () => {
  it("detects exact website link message and variations with/without accents", async () => {
    const { isWebsiteLeadTriggerMessage } = await import(
      "../../supabase/functions/whatsapp-webhook/owner-copilot.ts"
    );

    // Exact URL decoded message from WhatsAppFloatingButton.astro
    expect(
      isWebsiteLeadTriggerMessage("vim do site, gostaria de conversar com alguem sobre mais informações.")
    ).toBe(true);
    expect(
      isWebsiteLeadTriggerMessage("Vim do site, gostaria de conversar com alguém sobre mais informações!")
    ).toBe(true);
    expect(isWebsiteLeadTriggerMessage("Olá, vim do site!")).toBe(true);
    expect(
      isWebsiteLeadTriggerMessage("gostaria de conversar com alguem sobre mais informacoes")
    ).toBe(true);

    // Patient or unrelated messages must NOT trigger website lead flow
    expect(isWebsiteLeadTriggerMessage("quero remarcar minha consulta")).toBe(false);
    expect(isWebsiteLeadTriggerMessage("oi, tudo bem?")).toBe(false);
    expect(isWebsiteLeadTriggerMessage("Confirmado para amanhã")).toBe(false);
    expect(isWebsiteLeadTriggerMessage("")).toBe(false);
    expect(isWebsiteLeadTriggerMessage(null)).toBe(false);
  });

  it("allows unregistered numbers coming from website to enter and navigate support/onboarding trail", async () => {
    const { isAllowedUnregisteredSupportAction } = await import(
      "../../supabase/functions/whatsapp-webhook/owner-copilot.ts"
    );

    // 1. Always activates when coming from website link
    expect(
      isAllowedUnregisteredSupportAction({
        isSiteLeadSession: false,
        currentStep: "initial",
        selectedButtonId: "",
        userText: "vim do site, gostaria de conversar com alguem sobre mais informações.",
      })
    ).toBe(true);

    // Even if previously in another step, re-clicking website link activates it
    expect(
      isAllowedUnregisteredSupportAction({
        isSiteLeadSession: false,
        currentStep: "completed_self",
        selectedButtonId: "",
        userText: "vim do site, gostaria de conversar com alguem sobre mais informações.",
      })
    ).toBe(true);

    // 2. Allows navigating support and scheduling options inside site lead session
    const allowedButtons = [
      "support_faq",
      "support_human",
      "support_report_bug",
      "btn_schedule_intro",
      "btn_self_explore",
      "btn_owner_menu",
      "btn_menu_support",
      "menu",
      "day_2026-11-20",
      "onboarding_start",
      "slot_1",
      "time_10_00",
    ];
    for (const btn of allowedButtons) {
      expect(
        isAllowedUnregisteredSupportAction({
          isSiteLeadSession: true,
          currentStep: "owner_support_menu",
          selectedButtonId: btn,
          userText: btn,
        })
      ).toBe(true);
    }

    // 3. Allows free-text steps inside support/scheduling trail
    const allowedSteps = [
      "owner_support_menu",
      "waiting_bug_report",
      "waiting_day",
      "waiting_time",
      "completed_scheduled",
      "completed_self",
    ];
    for (const step of allowedSteps) {
      expect(
        isAllowedUnregisteredSupportAction({
          isSiteLeadSession: true,
          currentStep: step,
          selectedButtonId: "",
          userText: "14:30",
        })
      ).toBe(true);
    }
  });

  it("blocks unregistered non-site numbers (patients) and blocks clinical/financial owner menus", async () => {
    const { isAllowedUnregisteredSupportAction } = await import(
      "../../supabase/functions/whatsapp-webhook/owner-copilot.ts"
    );

    // Non-site unregistered numbers (e.g., clinic patients) must remain blocked from prospective-client support flow
    expect(
      isAllowedUnregisteredSupportAction({
        isSiteLeadSession: false,
        currentStep: "initial",
        selectedButtonId: "",
        userText: "quero remarcar minha consulta",
      })
    ).toBe(false);

    expect(
      isAllowedUnregisteredSupportAction({
        isSiteLeadSession: false,
        currentStep: "initial",
        selectedButtonId: "",
        userText: "oi",
      })
    ).toBe(false);

    // Clinical and financial owner actions must be strictly blocked even inside is_site_lead session
    const blockedOwnerButtons = [
      "btn_menu_records",
      "btn_menu_agenda",
      "btn_menu_finance",
      "records_quick_patient",
      "records_terms",
      "terms_adult",
      "finance_pix_invoice",
      "finance_nfse",
      "finance_upgrade",
      "finance_human",
      "agenda_new_patient",
      "appt_edit_date_123",
      "btn_flow_fallback_chat",
    ];
    for (const btn of blockedOwnerButtons) {
      expect(
        isAllowedUnregisteredSupportAction({
          isSiteLeadSession: true,
          currentStep: "owner_support_menu",
          selectedButtonId: btn,
          userText: btn,
        })
      ).toBe(false);
    }
  });
});
