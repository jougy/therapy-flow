import { describe, expect, it } from "vitest";
import {
  DEFAULT_PATIENT_RECURRENCE_TIME,
  getNextPatientRecurrenceDateTime,
  normalizePatientRecurringTime,
  normalizePatientRecurringWeekdays,
} from "@/lib/patient-recurrence";

describe("patient recurrence helpers", () => {
  it("normalizes weekdays and removes invalid values", () => {
    expect(normalizePatientRecurringWeekdays([1, "2", 2, 7, -1, 0])).toEqual([0, 1, 2]);
  });

  it("falls back to the default time for invalid values", () => {
    expect(normalizePatientRecurringTime("25:90")).toBe(DEFAULT_PATIENT_RECURRENCE_TIME);
    expect(normalizePatientRecurringTime("14:30")).toBe("14:30");
  });

  it("returns the next future date for the configured weekday and time", () => {
    const next = getNextPatientRecurrenceDateTime({
      now: new Date("2026-05-25T10:00:00"),
      time: "09:00",
      weekdays: [1],
    });

    expect(next?.toISOString()).toBe(new Date("2026-06-01T09:00:00").toISOString());
  });
});
