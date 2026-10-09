import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CompleteRegistrationParams,
  InitiateCheckoutParams,
  StartTrialParams,
  generateEventId,
  hashUserDataForAdvancedMatching,
  normalizeEmailForMatching,
  normalizeNameForMatching,
  normalizePhoneForMatching,
  sha256Hex,
  trackCompleteRegistration,
  trackInitiateCheckout,
  trackStartTrial,
  trackPurchase,
  trackSubscribe,
} from "./meta-pixel";


describe("meta-pixel utils", () => {
  beforeEach(() => {
    delete (window as unknown as { fbq?: unknown }).fbq;
    vi.restoreAllMocks();
  });

  describe("normalization functions", () => {
    it("normalizes email to lowercase trimmed", () => {
      expect(normalizeEmailForMatching("  User.Test@Example.COM  ")).toBe("user.test@example.com");
      expect(normalizeEmailForMatching("")).toBe("");
    });

    it("normalizes phone with Brazil country code 55 when 10 or 11 digits", () => {
      expect(normalizePhoneForMatching("(11) 98888-7777")).toBe("5511988887777");
      expect(normalizePhoneForMatching("(11) 3333-4444")).toBe("551133334444");
      expect(normalizePhoneForMatching("+55 11 98888-7777")).toBe("5511988887777");
      expect(normalizePhoneForMatching("")).toBe("");
    });

    it("normalizes personal name with single spaces in lowercase", () => {
      expect(normalizeNameForMatching("  Dr.  Ana   Silva  ")).toBe("dr. ana silva");
    });
  });

  describe("sha256Hex hashing", () => {
    it("produces correct 64-character hex hash", async () => {
      // Known sha256 of "test" is 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
      const hash = await sha256Hex("test");
      expect(hash).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
    });

    it("returns empty string for empty input", async () => {
      expect(await sha256Hex("")).toBe("");
      expect(await sha256Hex("   ")).toBe("");
    });
  });

  describe("hashUserDataForAdvancedMatching", () => {
    it("safely generates advanced matching hash map for email, phone and name", async () => {
      const result = await hashUserDataForAdvancedMatching({
        email: "terapeuta@exemplo.com",
        phone: "(11) 99999-8888",
        name: "Carlos Eduardo Oliveira",
        externalId: "user-123",
      });

      expect(result.em).toBeDefined();
      expect(result.ph).toBeDefined();
      expect(result.fn).toBeDefined();
      expect(result.ln).toBeDefined();
      expect(result.external_id).toBeDefined();
      expect(result.em).toHaveLength(64);
      expect(result.ph).toHaveLength(64);
    });

    it("returns empty object if no userData is provided", async () => {
      const result = await hashUserDataForAdvancedMatching(undefined);
      expect(result).toEqual({});
    });
  });

  describe("generateEventId", () => {
    it("creates prefixed traceable event id", () => {
      const id = generateEventId("reg", "fisioterapeuta");
      expect(id).toMatch(/^evt_reg_fisioterapeuta_\d+_[a-z0-9]+$/);
    });
  });

  describe("trackCompleteRegistration", () => {
    it("calls window.fbq with event metadata, profession, and hashed data", async () => {
      const fbqMock = vi.fn();
      window.fbq = fbqMock;

      const params: CompleteRegistrationParams = {
        profession: "physiotherapist",
        userData: {
          email: "fisio@clinica.com",
          phone: "11987654321",
          name: "Mariana Souza",
        },
        eventId: "test-reg-event-id",
      };

      const result = await trackCompleteRegistration(params);

      expect(result.eventId).toBe("test-reg-event-id");
      expect(result.hashedUserData.em).toBeDefined();
      expect(fbqMock).toHaveBeenCalledWith(
        "track",
        "CompleteRegistration",
        expect.objectContaining({
          profession: "physiotherapist",
          status: true,
          content_name: "Cadastro de Conta",
          currency: "BRL",
          em: expect.any(String),
          ph: expect.any(String),
        }),
        { eventID: "test-reg-event-id" }
      );
    });

    it("works gracefully when window.fbq is undefined", async () => {
      const params: CompleteRegistrationParams = {
        profession: "occupational_therapist",
      };

      const result = await trackCompleteRegistration(params);
      expect(result.eventId).toBeDefined();
    });
  });

  describe("trackStartTrial", () => {
    it("calls window.fbq with StartTrial event and profession metadata", async () => {
      const fbqMock = vi.fn();
      window.fbq = fbqMock;

      const params: StartTrialParams = {
        profession: "occupational_therapist",
        userData: {
          email: "to@clinica.com",
        },
      };

      const result = await trackStartTrial(params);

      expect(result.eventId).toBeDefined();
      expect(fbqMock).toHaveBeenCalledWith(
        "track",
        "StartTrial",
        expect.objectContaining({
          profession: "occupational_therapist",
          status: true,
          content_name: "Teste Gratuito 7 dias",
          currency: "BRL",
          em: expect.any(String),
        }),
        expect.objectContaining({ eventID: expect.any(String) })
      );
    });
  });

  describe("trackInitiateCheckout", () => {
    it("calls window.fbq with InitiateCheckout, planKey, category (Solo vs Equipe), value in reais and centavos", () => {
      const fbqMock = vi.fn();
      window.fbq = fbqMock;

      const params: InitiateCheckoutParams = {
        planKey: "prof_medio",
        category: "Solo",
        value: 59.99,
        valueCents: 5999,
        eventId: "checkout-evt-123",
      };

      const result = trackInitiateCheckout(params);

      expect(result.eventId).toBe("checkout-evt-123");
      expect(fbqMock).toHaveBeenCalledWith(
        "track",
        "InitiateCheckout",
        expect.objectContaining({
          planKey: "prof_medio",
          category: "Solo",
          value: 59.99,
          value_cents: 5999,
          currency: "BRL",
          content_type: "product",
          content_ids: ["prof_medio"],
          content_name: "Plano prof_medio (Solo)",
        }),
        { eventID: "checkout-evt-123" }
      );
    });

    it("auto-calculates value_cents if valueCents is omitted", () => {
      const fbqMock = vi.fn();
      window.fbq = fbqMock;

      const params: InitiateCheckoutParams = {
        planKey: "clinica_medio",
        category: "Equipe",
        value: 139,
      };

      const result = trackInitiateCheckout(params);

      expect(fbqMock).toHaveBeenCalledWith(
        "track",
        "InitiateCheckout",
        expect.objectContaining({
          planKey: "clinica_medio",
          category: "Equipe",
          value: 139,
          value_cents: 13900,
          currency: "BRL",
        }),
        expect.any(Object)
      );
      expect(result.payload.value_cents).toBe(13900);
    });
  });

  describe("trackPurchase and trackSubscribe", () => {
    it("calls window.fbq with Purchase event payload and advanced matching", async () => {
      const fbqMock = vi.fn();
      window.fbq = fbqMock;

      const res = await trackPurchase({
        planKey: "prof_medio",
        category: "Solo",
        value: 87,
        transactionId: "pay_xyz",
        userData: { email: "fisio@clinica.com" },
      });

      expect(res.eventId).toBeDefined();
      expect(fbqMock).toHaveBeenCalledWith(
        "track",
        "Purchase",
        expect.objectContaining({
          planKey: "prof_medio",
          category: "Solo",
          value: 87,
          value_cents: 8700,
          currency: "BRL",
          order_id: "pay_xyz",
          em: expect.any(String),
        }),
        expect.any(Object)
      );
    });

    it("calls window.fbq with Subscribe event payload", async () => {
      const fbqMock = vi.fn();
      window.fbq = fbqMock;

      const res = await trackSubscribe({
        planKey: "clinica_top",
        category: "Equipe",
        value: 447,
        transactionId: "sub_123",
      });

      expect(res.eventId).toBeDefined();
      expect(fbqMock).toHaveBeenCalledWith(
        "track",
        "Subscribe",
        expect.objectContaining({
          planKey: "clinica_top",
          category: "Equipe",
          value: 447,
          value_cents: 44700,
          currency: "BRL",
        }),
        expect.any(Object)
      );
    });
  });
});

