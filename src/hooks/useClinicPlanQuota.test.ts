import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClinicPlanQuota } from "./useClinicPlanQuota";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseMocks.from,
  },
}));

describe("useClinicPlanQuota", () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset();
  });

  const setupMocks = (subData: any, counts = { sessions: 10, patients: 3, forms: 1 }) => {
    const mockSelectSub = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: subData,
          error: null,
        }),
      }),
    });

    const mockSelectSessions = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          neq: vi.fn().mockResolvedValue({
            count: counts.sessions,
            error: null,
          }),
        }),
      }),
    });

    const mockSelectPatients = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          count: counts.patients,
          error: null,
        }),
      }),
    });

    const mockSelectForms = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: counts.forms,
            error: null,
          }),
        }),
      }),
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinic_subscriptions") return { select: mockSelectSub };
      if (table === "sessions") return { select: mockSelectSessions };
      if (table === "patients") return { select: mockSelectPatients };
      if (table === "anamnesis_form_templates") return { select: mockSelectForms };
      return { select: vi.fn() };
    });
  };

  it("identifies TRIAL subscription as free trial with limits", async () => {
    setupMocks({
      id: "sub-1",
      clinic_id: "clinic-1",
      status: "TRIAL",
      trial_max_attendances: 20,
      trial_max_patients: 5,
      trial_max_custom_forms: 1,
    });

    const { result } = renderHook(() => useClinicPlanQuota("clinic-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isFreeTrial).toBe(true);
    expect(result.current.attendances.max).toBe(20);
    expect(result.current.attendances.current).toBe(10);
    expect(result.current.attendances.remaining).toBe(10);
    expect(result.current.attendances.isLimitReached).toBe(false);
  });

  it("does NOT identify BETA subscription as trial, giving unlimited quota (-1)", async () => {
    setupMocks({
      id: "sub-2",
      clinic_id: "clinic-2",
      status: "BETA",
    });

    const { result } = renderHook(() => useClinicPlanQuota("clinic-2"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isFreeTrial).toBe(false);
    expect(result.current.attendances.max).toBe(-1);
    expect(result.current.patients.max).toBe(-1);
    expect(result.current.forms.max).toBe(-1);
    expect(result.current.attendances.isLimitReached).toBe(false);
  });

  it("does NOT identify ACTIVE subscription as trial, giving unlimited quota (-1)", async () => {
    setupMocks({
      id: "sub-3",
      clinic_id: "clinic-3",
      status: "ACTIVE",
    });

    const { result } = renderHook(() => useClinicPlanQuota("clinic-3"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isFreeTrial).toBe(false);
    expect(result.current.attendances.max).toBe(-1);
    expect(result.current.patients.max).toBe(-1);
    expect(result.current.forms.max).toBe(-1);
  });

  it("limits custom forms to 1 for prof_basico active subscription, keeping patients and attendances unlimited", async () => {
    setupMocks({
      id: "sub-prof-basico",
      clinic_id: "clinic-pb",
      status: "ACTIVE",
      plan_type: "prof_basico",
    });

    const { result } = renderHook(() => useClinicPlanQuota("clinic-pb"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isFreeTrial).toBe(false);
    expect(result.current.attendances.max).toBe(-1);
    expect(result.current.patients.max).toBe(-1);
    expect(result.current.forms.max).toBe(1);
    expect(result.current.forms.current).toBe(1);
    expect(result.current.forms.isLimitReached).toBe(true);
  });

  it("handles null clinicId gracefully", async () => {
    const { result } = renderHook(() => useClinicPlanQuota(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isFreeTrial).toBe(false);
  });
});
