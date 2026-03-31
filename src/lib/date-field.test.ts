import { describe, expect, it } from "vitest";
import { formatDateValue, normalizeDateInput, parseDateInput } from "@/lib/date-field";

describe("date field helpers", () => {
  it("formats typed digits as dd/mm/yyyy", () => {
    expect(normalizeDateInput("01012026")).toBe("01/01/2026");
    expect(normalizeDateInput("0101")).toBe("01/01");
    expect(normalizeDateInput("01a01b2026c")).toBe("01/01/2026");
  });

  it("parses only valid complete dates", () => {
    expect(formatDateValue(parseDateInput("29/02/2024")!)).toBe("29/02/2024");
    expect(parseDateInput("31/02/2026")).toBeNull();
    expect(parseDateInput("01/01/20")).toBeNull();
  });
});
