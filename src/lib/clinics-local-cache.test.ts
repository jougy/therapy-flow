import { describe, it, expect, beforeEach } from "vitest";
import {
  saveUserClinicsToLocalCache,
  getUserClinicsFromLocalCache,
  clearUserClinicsLocalCache,
} from "./clinics-local-cache";
import type { AccessibleClinic } from "@/hooks/useAuth";

describe("clinics-local-cache", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const mockClinics: AccessibleClinic[] = [
    {
      clinic: {
        id: "clinic-1",
        name: "Clínica Vida",
        route_key: "clinica-vida",
        subscription_plan: "solo",
        subaccount_limit: 1,
        concurrent_access_limit: 1,
        account_owner_user_id: "user-123",
      },
      activeAccessCount: 1,
      activeAccessUsers: [],
      membership: {
        id: "mem-1",
        clinic_id: "clinic-1",
        user_id: "user-123",
        account_role: "account_owner",
        operational_role: "owner",
        membership_status: "active",
        is_active: true,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        joined_at: "2026-01-01",
        ended_at: null,
        invited_by: null,
      },
    },
  ];

  it("saves and retrieves clinics in O(1) from local cache", async () => {
    await saveUserClinicsToLocalCache("user-123", mockClinics);

    const retrieved = await getUserClinicsFromLocalCache("user-123");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.length).toBe(1);
    expect(retrieved?.[0].clinic.name).toBe("Clínica Vida");
  });

  it("returns null when no cache exists for user", async () => {
    const retrieved = await getUserClinicsFromLocalCache("user-unknown");
    expect(retrieved).toBeNull();
  });

  it("clears cache successfully upon logout", async () => {
    await saveUserClinicsToLocalCache("user-123", mockClinics);
    await clearUserClinicsLocalCache("user-123");

    const retrieved = await getUserClinicsFromLocalCache("user-123");
    expect(retrieved).toBeNull();
  });
});
