import { describe, expect, it } from "vitest";
import {
  countActiveConcurrentAccesses,
  formatLastSeenAt,
  getConcurrentAccessCapacity,
  getMembershipStatusMeta,
  isSecuritySessionActive,
  shouldShowTeamAnalyticsSection,
  shouldShowTeamSettingsSection,
  sortMembershipsForDisplay,
  type MembershipLike,
  type SecuritySessionLike,
} from "@/lib/subaccounts";

const membership = (overrides: Partial<MembershipLike>): MembershipLike => ({
  account_role: null,
  created_at: "2026-03-26T12:00:00.000Z",
  id: crypto.randomUUID(),
  is_active: true,
  membership_status: "active",
  operational_role: "professional",
  user_id: crypto.randomUUID(),
  ...overrides,
});

const securitySession = (overrides: Partial<SecuritySessionLike>): SecuritySessionLike => ({
  clinic_id: "clinic-1",
  ended_at: null,
  last_seen_at: "2026-03-31T12:00:00.000Z",
  session_key: crypto.randomUUID(),
  user_id: crypto.randomUUID(),
  ...overrides,
});

describe("countActiveConcurrentAccesses", () => {
  it("counts only open and recent sessions", () => {
    expect(
      countActiveConcurrentAccesses(
        [
          securitySession({ session_key: "current" }),
          securitySession({ user_id: "other-1", session_key: "other-1" }),
          securitySession({ user_id: "other-2", ended_at: "2026-03-31T12:04:00.000Z" }),
          securitySession({ user_id: "other-3", last_seen_at: "2026-03-31T11:30:00.000Z" }),
        ],
        new Date("2026-03-31T12:05:00.000Z")
      )
    ).toBe(2);
  });
});

describe("getConcurrentAccessCapacity", () => {
  it("reports availability for active accesses", () => {
    expect(
      getConcurrentAccessCapacity(
        4,
        [
          securitySession({ user_id: "user-1", session_key: "one" }),
          securitySession({ user_id: "user-2", session_key: "two" }),
        ],
        new Date("2026-03-31T12:05:00.000Z")
      )
    ).toEqual({
      available: 2,
      limit: 4,
      occupied: 2,
      reached: false,
    });
  });

  it("marks the plan as full when the concurrent access limit is reached", () => {
    expect(
      getConcurrentAccessCapacity(
        2,
        [
          securitySession({ user_id: "user-1", session_key: "one" }),
          securitySession({ user_id: "user-2", session_key: "two" }),
          securitySession({ user_id: "user-3", last_seen_at: "2026-03-31T11:20:00.000Z" }),
        ],
        new Date("2026-03-31T12:05:00.000Z")
      )
    ).toEqual({
      available: 0,
      limit: 2,
      occupied: 2,
      reached: true,
    });
  });
});

describe("isSecuritySessionActive", () => {
  it("treats stale sessions as inactive", () => {
    expect(
      isSecuritySessionActive(
        securitySession({ last_seen_at: "2026-03-31T11:00:00.000Z" }),
        new Date("2026-03-31T12:05:00.000Z")
      )
    ).toBe(false);
  });
});

describe("sortMembershipsForDisplay", () => {
  it("keeps the owner first and then sorts by role priority and creation date", () => {
    const owner = membership({
      account_role: "account_owner",
      created_at: "2026-03-20T12:00:00.000Z",
      operational_role: "owner",
      user_id: "owner",
    });
    const assistant = membership({
      created_at: "2026-03-25T12:00:00.000Z",
      operational_role: "assistant",
      user_id: "assistant",
    });
    const admin = membership({
      created_at: "2026-03-24T12:00:00.000Z",
      operational_role: "admin",
      user_id: "admin",
    });
    const professional = membership({
      created_at: "2026-03-23T12:00:00.000Z",
      operational_role: "professional",
      user_id: "professional",
    });

    expect(sortMembershipsForDisplay([assistant, professional, owner, admin]).map((row) => row.user_id)).toEqual([
      "owner",
      "admin",
      "professional",
      "assistant",
    ]);
  });
});

describe("getMembershipStatusMeta", () => {
  it("returns a readable label and color token for each status", () => {
    expect(getMembershipStatusMeta("active")).toEqual({
      className: "bg-emerald-500",
      label: "Ativo",
    });
    expect(getMembershipStatusMeta("inactive")).toEqual({
      className: "bg-slate-400",
      label: "Inativo",
    });
    expect(getMembershipStatusMeta("suspended")).toEqual({
      className: "bg-amber-500",
      label: "Suspenso",
    });
    expect(getMembershipStatusMeta("invited")).toEqual({
      className: "bg-sky-500",
      label: "Convidado",
    });
  });
});

describe("formatLastSeenAt", () => {
  it("formats the last online timestamp for display", () => {
    expect(formatLastSeenAt("2026-03-26T15:45:00.000Z")).toMatch("26/03/2026");
  });

  it("returns a fallback when the subaccount never logged in", () => {
    expect(formatLastSeenAt(null)).toBe("Nunca acessou");
  });
});

describe("team section visibility", () => {
  it("shows the team section only for clinic plans", () => {
    expect(shouldShowTeamSettingsSection("clinic")).toBe(true);
    expect(shouldShowTeamSettingsSection("solo")).toBe(false);
    expect(shouldShowTeamSettingsSection(null)).toBe(false);
  });

  it("shows team analytics only when the plan is clinic and the capability is granted", () => {
    expect(shouldShowTeamAnalyticsSection("clinic", true)).toBe(true);
    expect(shouldShowTeamAnalyticsSection("clinic", false)).toBe(false);
    expect(shouldShowTeamAnalyticsSection("solo", true)).toBe(false);
  });
});
