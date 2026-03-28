import { describe, expect, it } from "vitest";
import {
  buildSessionEditHistoryView,
  formatSessionAuditDateTime,
  getSessionPersonLabel,
} from "@/lib/session-people";

describe("getSessionPersonLabel", () => {
  it("prefers the full name before the email", () => {
    expect(getSessionPersonLabel({ full_name: "Jougy", email: "jougy@example.com" })).toBe("Jougy");
  });

  it("falls back to email or a generic label", () => {
    expect(getSessionPersonLabel({ full_name: null, email: "jougy@example.com" })).toBe("jougy@example.com");
    expect(getSessionPersonLabel({ full_name: null, email: null })).toBe("Colaborador");
  });
});

describe("formatSessionAuditDateTime", () => {
  it("formats timestamps in pt-BR", () => {
    expect(formatSessionAuditDateTime("2026-03-27T14:35:00.000Z")).toMatch(/27\/03\/2026/);
  });
});

describe("buildSessionEditHistoryView", () => {
  it("orders edits from most recent to oldest and resolves names from the profile map", () => {
    const entries = buildSessionEditHistoryView(
      [
        { id: "1", edited_at: "2026-03-27T13:00:00.000Z", editor_user_id: "user-b" },
        { id: "2", edited_at: "2026-03-27T15:00:00.000Z", editor_user_id: "user-a" },
      ],
      new Map([
        ["user-a", { full_name: "Ana", email: "ana@example.com" }],
        ["user-b", { full_name: "Bruno", email: "bruno@example.com" }],
      ])
    );

    expect(entries.map((entry) => entry.editorName)).toEqual(["Ana", "Bruno"]);
    expect(entries[0].editedAtLabel).toMatch(/27\/03\/2026/);
  });
});
