import { describe, expect, it, vi } from "vitest";
import {
  formatTimezoneCity,
  getDeviceTimezone,
  getRelativeTimezoneComparison,
  resolveCurrentGeoLocation,
} from "./geo-timezone";

describe("geo-timezone module", () => {
  describe("getDeviceTimezone", () => {
    it("returns a non-empty timezone string", () => {
      const tz = getDeviceTimezone();
      expect(typeof tz).toBe("string");
      expect(tz.length).toBeGreaterThan(0);
    });

    it("falls back to America/Sao_Paulo if Intl throws", () => {
      const originalIntl = Intl.DateTimeFormat;
      // @ts-expect-error Mocking Intl failure
      Intl.DateTimeFormat = () => {
        throw new Error("Simulated Intl failure");
      };

      try {
        expect(getDeviceTimezone()).toBe("America/Sao_Paulo");
      } finally {
        Intl.DateTimeFormat = originalIntl;
      }
    });
  });

  describe("formatTimezoneCity", () => {
    it("formats IANA timezone strings into friendly city names", () => {
      expect(formatTimezoneCity("America/Manaus")).toBe("Manaus");
      expect(formatTimezoneCity("America/Sao_Paulo")).toBe("Sao Paulo");
      expect(formatTimezoneCity("America/Rio_Branco")).toBe("Rio Branco");
      expect(formatTimezoneCity("UTC")).toBe("UTC");
      expect(formatTimezoneCity("")).toBe("");
    });
  });

  describe("getRelativeTimezoneComparison", () => {
    it("compares Manaus (UTC-4) and São Paulo (UTC-3) correctly", () => {
      // 18:00 UTC = 14:00 em Manaus (UTC-4) e 15:00 em São Paulo (UTC-3)
      const scheduledUtc = "2026-10-24T18:00:00.000Z";

      const comparison = getRelativeTimezoneComparison(
        scheduledUtc,
        "America/Manaus",
        "America/Sao_Paulo"
      );

      expect(comparison).toEqual({
        hasDifference: true,
        localTime: "15:00",
        originTime: "14:00",
        originTimezoneName: "Manaus",
        tooltip: "Agendado para 14:00 no fuso de Manaus (15:00 no seu horário local)",
      });
    });

    it("returns hasDifference: false when origin is identical to target", () => {
      const scheduledUtc = "2026-10-24T18:00:00.000Z";

      const comparison = getRelativeTimezoneComparison(
        scheduledUtc,
        "America/Sao_Paulo",
        "America/Sao_Paulo"
      );

      expect(comparison.hasDifference).toBe(false);
      expect(comparison.localTime).toBe("15:00");
      expect(comparison.originTime).toBeNull();
      expect(comparison.originTimezoneName).toBeNull();
      expect(comparison.tooltip).toBeNull();
    });

    it("returns hasDifference: false when origin timezone is not provided", () => {
      const scheduledUtc = "2026-10-24T18:00:00.000Z";

      const comparison = getRelativeTimezoneComparison(scheduledUtc, null, "America/Sao_Paulo");

      expect(comparison.hasDifference).toBe(false);
      expect(comparison.localTime).toBe("15:00");
      expect(comparison.originTime).toBeNull();
      expect(comparison.tooltip).toBeNull();
    });

    it("handles invalid timezone strings gracefully without throwing", () => {
      const comparison = getRelativeTimezoneComparison(
        "2026-10-24T18:00:00.000Z",
        "Invalid/Timezone",
        "America/Sao_Paulo"
      );

      expect(comparison.hasDifference).toBe(false);
      expect(comparison.originTime).toBeNull();
    });

    it("handles invalid date strings gracefully without throwing", () => {
      const comparison = getRelativeTimezoneComparison(
        "invalid-date",
        "America/Manaus",
        "America/Sao_Paulo"
      );

      expect(comparison.localTime).toBe("--:--");
      expect(comparison.hasDifference).toBe(false);
      expect(comparison.originTime).toBeNull();
    });
  });

  describe("resolveCurrentGeoLocation", () => {
    it("returns device timezone and lat/lng when geolocation succeeds", async () => {
      const mockGetCurrentPosition = vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: -23.5505,
            longitude: -46.6333,
          },
        });
      });

      const originalGeo = navigator.geolocation;
      Object.defineProperty(navigator, "geolocation", {
        value: { getCurrentPosition: mockGetCurrentPosition },
        configurable: true,
        writable: true,
      });

      try {
        const result = await resolveCurrentGeoLocation();
        expect(result.timezone).toBe(getDeviceTimezone());
        expect(result.lat).toBe(-23.5505);
        expect(result.lng).toBe(-46.6333);
      } finally {
        Object.defineProperty(navigator, "geolocation", {
          value: originalGeo,
          configurable: true,
          writable: true,
        });
      }
    });

    it("returns fallback with null coordinates when geolocation throws or is denied", async () => {
      const mockGetCurrentPosition = vi.fn().mockImplementation((_success, error) => {
        error(new Error("Permission denied"));
      });

      const originalGeo = navigator.geolocation;
      Object.defineProperty(navigator, "geolocation", {
        value: { getCurrentPosition: mockGetCurrentPosition },
        configurable: true,
        writable: true,
      });

      try {
        const result = await resolveCurrentGeoLocation();
        expect(result.timezone).toBe(getDeviceTimezone());
        expect(result.lat).toBeNull();
        expect(result.lng).toBeNull();
        expect(result.city).toBeNull();
      } finally {
        Object.defineProperty(navigator, "geolocation", {
          value: originalGeo,
          configurable: true,
          writable: true,
        });
      }
    });
  });
});
