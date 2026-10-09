import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  initGlobalAnalytics,
  trackPageView,
  trackRegistrationEvent,
  trackTrialStartEvent,
  trackBeginCheckoutEvent,
  trackPurchaseEvent,
} from "./analytics-tracker";
import { SUBPRODUCTS_CATALOG } from "./subproduct-config";

describe("analytics-tracker", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { fbq?: unknown }).fbq;
    delete (window as unknown as { gtag?: unknown }).gtag;
    delete (window as unknown as { dataLayer?: unknown }).dataLayer;
    delete (window as unknown as { clarity?: unknown }).clarity;
  });

  it("initializes analytics with correct GA4 and Meta Pixel IDs for plurifisio", () => {
    const config = initGlobalAnalytics(SUBPRODUCTS_CATALOG.plurifisio);
    expect(config.key).toBe("plurifisio");
    expect(config.gaMeasurementId).toBe("G-HM85XTZRHT");
    expect(config.metaPixelId).toBe("1073846021935349");
    expect(typeof window.gtag).toBe("function");
    expect(typeof window.fbq).toBe("function");
  });

  it("dispatches trackPageView to fbq and gtag", () => {
    const fbqMock = vi.fn();
    const gtagMock = vi.fn();
    window.fbq = fbqMock;
    window.gtag = gtagMock;

    trackPageView("/planos", "Planos de Assinatura");

    expect(fbqMock).toHaveBeenCalledWith("track", "PageView");
    expect(gtagMock).toHaveBeenCalledWith(
      "event",
      "page_view",
      expect.objectContaining({
        page_path: "/planos",
        page_title: "Planos de Assinatura",
      })
    );
  });

  it("dispatches trackRegistrationEvent with CompleteRegistration and sign_up", async () => {
    const fbqMock = vi.fn();
    const gtagMock = vi.fn();
    window.fbq = fbqMock;
    window.gtag = gtagMock;

    const res = await trackRegistrationEvent({
      profession: "fisioterapeuta",
      userData: {
        email: "dra@clinica.com",
        name: "Dra. Juliana",
        phone: "11988887777",
      },
    });

    expect(res.eventId).toBeDefined();
    expect(fbqMock).toHaveBeenCalledWith("track", "CompleteRegistration", expect.any(Object), expect.any(Object));
    expect(gtagMock).toHaveBeenCalledWith(
      "event",
      "sign_up",
      expect.objectContaining({ method: "email", profession: "fisioterapeuta" })
    );
  });

  it("dispatches trackBeginCheckoutEvent with InitiateCheckout and begin_checkout", () => {
    const fbqMock = vi.fn();
    const gtagMock = vi.fn();
    window.fbq = fbqMock;
    window.gtag = gtagMock;

    const res = trackBeginCheckoutEvent({
      planKey: "prof_medio",
      category: "Solo",
      value: 87,
      couponCode: "BETA2026",
    });

    expect(res.eventId).toBeDefined();
    expect(fbqMock).toHaveBeenCalledWith("track", "InitiateCheckout", expect.any(Object), expect.any(Object));
    expect(gtagMock).toHaveBeenCalledWith(
      "event",
      "begin_checkout",
      expect.objectContaining({
        currency: "BRL",
        value: 87,
        coupon: "BETA2026",
      })
    );
  });

  it("dispatches trackPurchaseEvent with Purchase and GA4 purchase", async () => {
    const fbqMock = vi.fn();
    const gtagMock = vi.fn();
    window.fbq = fbqMock;
    window.gtag = gtagMock;

    const res = await trackPurchaseEvent({
      planKey: "clinica_medio",
      category: "Equipe",
      value: 267,
      transactionId: "pay_123456",
      paymentMethod: "CREDIT_CARD",
    });

    expect(res.eventId).toBeDefined();
    expect(fbqMock).toHaveBeenCalledWith("track", "Purchase", expect.any(Object), expect.any(Object));
    expect(fbqMock).toHaveBeenCalledWith("track", "Subscribe", expect.any(Object), expect.any(Object));
    expect(gtagMock).toHaveBeenCalledWith(
      "event",
      "purchase",
      expect.objectContaining({
        transaction_id: "pay_123456",
        value: 267,
        currency: "BRL",
        payment_type: "CREDIT_CARD",
      })
    );
  });
});
