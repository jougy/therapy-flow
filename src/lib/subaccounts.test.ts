import { describe, expect, it } from "vitest";
import {
  buildVisibleTeamMembershipRows,
  countActiveConcurrentAccesses,
  formatLastSeenAt,
  getCollaboratorActivityStatusMeta,
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

  it("places estagiario after assistant in the operational priority ladder", () => {
    const assistant = membership({
      created_at: "2026-03-25T12:00:00.000Z",
      operational_role: "assistant",
      user_id: "assistant",
    });
    const intern = membership({
      created_at: "2026-03-24T12:00:00.000Z",
      operational_role: "estagiario",
      user_id: "intern",
    });

    expect(sortMembershipsForDisplay([intern, assistant]).map((row) => row.user_id)).toEqual([
      "assistant",
      "intern",
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

  it("returns a safe fallback for unknown membership statuses", () => {
    expect(getMembershipStatusMeta("legacy_status")).toEqual({
      className: "bg-slate-400",
      label: "Status desconhecido",
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

describe("getCollaboratorActivityStatusMeta", () => {
  it("prioritizes online status when there is an active session", () => {
    expect(getCollaboratorActivityStatusMeta("active", true)).toEqual({
      className: "bg-sky-500",
      label: "Online",
    });
  });

  it("falls back to the membership status when the collaborator is offline", () => {
    expect(getCollaboratorActivityStatusMeta("inactive", false)).toEqual({
      className: "bg-slate-400",
      label: "Inativo",
    });
  });

  it("keeps a readable fallback when an unexpected status comes from the backend", () => {
    expect(getCollaboratorActivityStatusMeta("legacy_status", false)).toEqual({
      className: "bg-slate-400",
      label: "Status desconhecido",
    });
  });
});

describe("buildVisibleTeamMembershipRows", () => {
  it("supports search, filters and sort options for the collaborator list", () => {
    const rows = buildVisibleTeamMembershipRows({
      memberships: [
        membership({
          account_role: "account_owner",
          created_at: "2026-03-20T12:00:00.000Z",
          operational_role: "owner",
          user_id: "owner-1",
        }),
        membership({
          created_at: "2026-03-24T12:00:00.000Z",
          membership_status: "inactive",
          operational_role: "assistant",
          user_id: "assistant-1",
        }),
        membership({
          created_at: "2026-03-23T12:00:00.000Z",
          operational_role: "estagiario",
          user_id: "intern-1",
        }),
      ],
      onlineUserIds: new Set(["assistant-1"]),
      profileMap: new Map([
        [
          "owner-1",
          { email: "owner@test.com", full_name: "Ana Owner", job_title: "Diretora", last_seen_at: "2026-03-31T12:00:00.000Z" },
        ],
        [
          "assistant-1",
          { email: "assistente@test.com", full_name: "Bruno Assistente", job_title: "Recepção", last_seen_at: "2026-03-31T12:04:00.000Z" },
        ],
        [
          "intern-1",
          { email: "estagio@test.com", full_name: "Caio Estágio", job_title: "Estagiário", last_seen_at: null },
        ],
      ]),
      roleFilter: "all",
      searchTerm: "bruno",
      sortKey: "name_asc",
      statusFilter: "online",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.membership.user_id).toBe("assistant-1");
  });

  it("does not crash when the backend returns unexpected team status or role values", () => {
    const rows = buildVisibleTeamMembershipRows({
      memberships: [
        membership({
          membership_status: "legacy_status" as MembershipLike["membership_status"],
          operational_role: "legacy_role" as MembershipLike["operational_role"],
          user_id: "legacy-user",
        }),
        membership({
          operational_role: "assistant",
          user_id: "assistant-user",
        }),
      ],
      onlineUserIds: new Set(),
      profileMap: new Map([
        ["legacy-user", { email: "legacy@clinic.test", full_name: "Legado" }],
        ["assistant-user", { email: "assistant@clinic.test", full_name: "Assistente" }],
      ]),
      roleFilter: "all",
      searchTerm: "",
      sortKey: "role_priority",
      statusFilter: "all",
    });

    expect(rows).toHaveLength(2);
    expect(rows[1]?.activityStatus).toEqual({
      className: "bg-slate-400",
      label: "Status desconhecido",
    });
  });
});
