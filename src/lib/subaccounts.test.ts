import { describe, expect, it } from "vitest";
import {
  formatLastSeenAt,
  getMembershipStatusMeta,
  countOccupiedSubaccounts,
  getSubaccountCapacity,
  shouldShowTeamAnalyticsSection,
  shouldShowTeamSettingsSection,
  sortMembershipsForDisplay,
  type MembershipLike,
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

describe("countOccupiedSubaccounts", () => {
  it("counts only active non-owner seats", () => {
    expect(
      countOccupiedSubaccounts([
        membership({ account_role: "account_owner", operational_role: "owner" }),
        membership({ operational_role: "admin" }),
        membership({ membership_status: "invited" }),
        membership({ is_active: false, membership_status: "inactive" }),
        membership({ is_active: true, membership_status: "suspended" }),
      ])
    ).toBe(2);
  });
});

describe("getSubaccountCapacity", () => {
  it("reports availability for clinic plans", () => {
    expect(
      getSubaccountCapacity(4, [
        membership({ operational_role: "admin" }),
        membership({ operational_role: "assistant" }),
      ])
    ).toEqual({
      available: 2,
      limit: 4,
      occupied: 2,
      reached: false,
    });
  });

  it("marks the plan as full when the seat limit is reached", () => {
    expect(
      getSubaccountCapacity(2, [
        membership({ operational_role: "admin" }),
        membership({ operational_role: "assistant", membership_status: "invited" }),
      ])
    ).toEqual({
      available: 0,
      limit: 2,
      occupied: 2,
      reached: true,
    });
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
