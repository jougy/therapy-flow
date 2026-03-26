import { describe, expect, it } from "vitest";
import { canHaveSubaccounts, hasCapability, type AccessCapability, type MembershipContext } from "@/lib/rbac";

const ownerContext: MembershipContext = {
  accountRole: "account_owner",
  isActive: true,
  membershipStatus: "active",
  operationalRole: "owner",
  subscriptionPlan: "clinic",
};

const adminContext: MembershipContext = {
  accountRole: null,
  isActive: true,
  membershipStatus: "active",
  operationalRole: "admin",
  subscriptionPlan: "clinic",
};

const professionalContext: MembershipContext = {
  accountRole: null,
  isActive: true,
  membershipStatus: "active",
  operationalRole: "professional",
  subscriptionPlan: "clinic",
};

const assistantContext: MembershipContext = {
  accountRole: null,
  isActive: true,
  membershipStatus: "active",
  operationalRole: "assistant",
  subscriptionPlan: "clinic",
};

describe("canHaveSubaccounts", () => {
  it("only allows subaccounts for clinic plans", () => {
    expect(canHaveSubaccounts("clinic")).toBe(true);
    expect(canHaveSubaccounts("solo")).toBe(false);
  });
});

describe("hasCapability", () => {
  it.each<AccessCapability>([
    "clinic_profile.manage",
    "forms.manage",
    "subaccounts.manage",
    "subaccounts_roles.manage",
    "subscription_billing.manage",
    "treasury.manage",
    "agenda.delete_events",
    "subaccounts_analytics.read",
    "patients.read",
    "patients.write",
    "schedule.read",
    "schedule.write",
    "sessions.read",
    "sessions.write",
    "session.delete_draft",
  ])("grants every capability to account owner", (capability) => {
    expect(hasCapability(ownerContext, capability)).toBe(true);
  });

  it("grants admin operational management but not billing ownership", () => {
    expect(hasCapability(adminContext, "forms.manage")).toBe(true);
    expect(hasCapability(adminContext, "treasury.manage")).toBe(true);
    expect(hasCapability(adminContext, "subscription_billing.manage")).toBe(false);
    expect(hasCapability(adminContext, "subaccounts_roles.manage")).toBe(true);
  });

  it("keeps professional focused on clinical work", () => {
    expect(hasCapability(professionalContext, "sessions.write")).toBe(true);
    expect(hasCapability(professionalContext, "patients.write")).toBe(true);
    expect(hasCapability(professionalContext, "forms.manage")).toBe(false);
    expect(hasCapability(professionalContext, "treasury.manage")).toBe(false);
  });

  it("keeps assistant out of clinical and financial sensitive areas", () => {
    expect(hasCapability(assistantContext, "schedule.write")).toBe(true);
    expect(hasCapability(assistantContext, "patients.write")).toBe(true);
    expect(hasCapability(assistantContext, "sessions.write")).toBe(false);
    expect(hasCapability(assistantContext, "forms.manage")).toBe(false);
  });

  it("blocks inactive memberships", () => {
    expect(
      hasCapability({ ...ownerContext, isActive: false }, "patients.read")
    ).toBe(false);
    expect(
      hasCapability({ ...adminContext, membershipStatus: "suspended" }, "schedule.read")
    ).toBe(false);
  });
});
