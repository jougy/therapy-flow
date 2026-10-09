import { describe, it, expect, beforeEach } from "vitest";
import {
  captureSignupOrigin,
  resolveFriendlyOrigin,
  getStoredSignupOrigin,
  clearStoredSignupOrigin,
  SIGNUP_ORIGIN_STORAGE_KEY,
} from "./signup-origin";

describe("signup-origin", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("resolveFriendlyOrigin", () => {
    it("deve identificar Google Ads via gclid", () => {
      const origin = {
        gclid: "abc_123_gclid",
        timestamp: Date.now(),
      };
      expect(resolveFriendlyOrigin(origin)).toBe("Google Ads");
    });

    it("deve identificar Google Ads com nome da campanha", () => {
      const origin = {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "fisio_sp_2026",
        timestamp: Date.now(),
      };
      expect(resolveFriendlyOrigin(origin)).toBe("Google Ads (fisio_sp_2026)");
    });

    it("deve identificar Facebook Ads via fbclid", () => {
      const origin = {
        fbclid: "fb_click_xyz",
        utm_campaign: "black_friday",
        timestamp: Date.now(),
      };
      expect(resolveFriendlyOrigin(origin)).toBe("Facebook Ads (black_friday)");
    });

    it("deve identificar Instagram vindo de bio ou referrer", () => {
      expect(
        resolveFriendlyOrigin({
          utm_source: "instagram",
          utm_medium: "bio",
          timestamp: Date.now(),
        })
      ).toBe("Instagram (Bio/Perfil)");

      expect(
        resolveFriendlyOrigin({
          referrer: "https://l.instagram.com/",
          timestamp: Date.now(),
        })
      ).toBe("Instagram (Bio/Campanha)");
    });

    it("deve identificar Google Busca Orgânica", () => {
      expect(
        resolveFriendlyOrigin({
          referrer: "https://www.google.com.br/",
          timestamp: Date.now(),
        })
      ).toBe("Google (Busca Orgânica)");
    });

    it("deve identificar Landing Page Oficial", () => {
      expect(
        resolveFriendlyOrigin({
          referrer: "https://plurifisio.com.br/planos",
          timestamp: Date.now(),
        })
      ).toBe("Landing Page Oficial (plurifisio.com.br)");
    });

    it("deve identificar Convite de Clínica", () => {
      expect(
        resolveFriendlyOrigin({
          ref: "convite",
          timestamp: Date.now(),
        })
      ).toBe("Convite de Clínica");
    });

    it("deve retornar 'Acesso Direto' quando não houver tracking ou referrer", () => {
      expect(resolveFriendlyOrigin(null)).toBe("Acesso Direto");
    });
  });

  describe("captureSignupOrigin & storage", () => {
    it("deve capturar e persistir parâmetros de query string", () => {
      const qs = "?utm_source=instagram&utm_medium=bio&utm_campaign=lancamento";
      const origin = captureSignupOrigin(qs, "https://l.instagram.com/");

      expect(origin.utm_source).toBe("instagram");
      expect(origin.utm_medium).toBe("bio");
      expect(origin.utm_campaign).toBe("lancamento");
      expect(origin.referrer).toBe("https://l.instagram.com/");

      const stored = getStoredSignupOrigin();
      expect(stored?.utm_source).toBe("instagram");
    });

    it("deve limpar storage quando solicitado", () => {
      captureSignupOrigin("?utm_source=google&gclid=test1234");
      expect(getStoredSignupOrigin()).not.toBeNull();

      clearStoredSignupOrigin();
      expect(getStoredSignupOrigin()).toBeNull();
    });
  });
});
