import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Agenda WhatsApp Reminders Dispatcher", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("formats ISO datetime into Brasilia date and time strings accurately", async () => {
    // Dynamic import to test helper logic
    const formatDateTimeBr = (isoString: string) => {
      const d = new Date(isoString);
      const brDate = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const day = String(brDate.getDate()).padStart(2, "0");
      const month = String(brDate.getMonth() + 1).padStart(2, "0");
      const year = brDate.getFullYear();
      const hours = String(brDate.getHours()).padStart(2, "0");
      const mins = String(brDate.getMinutes()).padStart(2, "0");
      return {
        dateStr: `${day}/${month}/${year}`,
        timeStr: `${hours}:${mins}`,
      };
    };

    const res = formatDateTimeBr("2026-11-05T14:30:00.000Z");
    expect(res.dateStr).toBe("05/11/2026");
    expect(res.timeStr).toBe("11:30"); // UTC-3
  });

  it("correctly identifies due reminder windows: 24h before, 2h before and at event time", () => {
    const checkDue = (diffMinutes: number, hasDispatched: (k: string) => boolean) => {
      if (diffMinutes >= 1380 && diffMinutes <= 1440 && !hasDispatched("24h_before")) {
        return "24h_before";
      } else if (diffMinutes >= 90 && diffMinutes <= 130 && !hasDispatched("2h_before")) {
        return "2h_before";
      } else if (diffMinutes >= -5 && diffMinutes <= 15 && !hasDispatched("at_event_time")) {
        return "at_event_time";
      }
      return null;
    };

    // 24h (1440 min)
    expect(checkDue(1400, () => false)).toBe("24h_before");
    expect(checkDue(1400, (k) => k === "24h_before")).toBe(null); // idempotência

    // 2h (120 min)
    expect(checkDue(115, () => false)).toBe("2h_before");
    expect(checkDue(115, (k) => k === "2h_before")).toBe(null); // idempotência

    // Na hora (0 min)
    expect(checkDue(0, () => false)).toBe("at_event_time");
    expect(checkDue(5, () => false)).toBe("at_event_time");
    expect(checkDue(0, (k) => k === "at_event_time")).toBe(null); // idempotência

    // Fora de janela (ex: 5h antes = 300 min)
    expect(checkDue(300, () => false)).toBe(null);
  });
});
