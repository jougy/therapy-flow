import { describe, expect, it } from "vitest";
import {
  buildBusinessHours,
  getClinicBrandName,
  readBusinessHours,
} from "@/lib/clinic-settings";

describe("clinic settings helpers", () => {
  it("reads a summary from business hours json", () => {
    expect(readBusinessHours({ summary: "seg-sex 08h-18h" })).toEqual({
      summary: "seg-sex 08h-18h",
    });
  });

  it("normalizes business hours for storage", () => {
    expect(buildBusinessHours({ summary: "  seg-sex 08h-18h  " })).toEqual({
      summary: "seg-sex 08h-18h",
    });
  });

  it("prefers clinic name over product fallback", () => {
    expect(getClinicBrandName("Clinica Aurora")).toBe("Clinica Aurora");
    expect(getClinicBrandName(null)).toBe("TherapyFlow");
  });
});
