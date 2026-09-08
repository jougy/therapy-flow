import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePatientSummary } from "@/hooks/usePatientSummary";
import * as patientRouting from "@/lib/patient-routing";
import { supabase } from "@/integrations/supabase/client";

const mockPatient = {
  id: "patient-uuid-1",
  name: "Paciente Teste",
  patient_code: "PAC-123",
  clinic_id: "clinic-1",
} as any;

const mockSnapshots = [
  {
    id: "snap-1",
    patient_id: "patient-uuid-1",
    created_by: "author-uuid-1",
    created_at: "2026-03-01T10:00:00Z",
    change_note: "Ajuste de medicamentos",
    changed_fields: ["continuous_medications"],
    snapshot_data: {},
  },
  {
    id: "snap-2",
    patient_id: "patient-uuid-1",
    created_by: "author-uuid-1", // duplicate author ID to test uniqueness
    created_at: "2026-02-01T10:00:00Z",
    change_note: "Primeiro registro",
    changed_fields: ["diagnoses"],
    snapshot_data: {},
  },
  {
    id: "snap-3",
    patient_id: "patient-uuid-1",
    created_by: null, // null author to test filtering
    created_at: "2026-01-01T10:00:00Z",
    change_note: null,
    changed_fields: [],
    snapshot_data: {},
  },
];

const mockProfiles = [
  {
    id: "author-uuid-1",
    full_name: "Dra. Ana Paula",
    email: "ana@exemplo.com",
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("usePatientSummary Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches patient, snapshots and queries profiles ONLY for unique authors", async () => {
    vi.spyOn(patientRouting, "fetchPatientByRef").mockResolvedValue({
      data: mockPatient,
      error: null,
    });

    const inSpy = vi.fn().mockResolvedValue({ data: mockProfiles, error: null });

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "patient_clinical_snapshots") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: mockSnapshots, error: null }),
        } as any;
      }
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            in: inSpy,
          }),
        } as any;
      }
      return {
        select: vi.fn().mockReturnThis(),
      } as any;
    });

    const { result } = renderHook(
      () =>
        usePatientSummary({
          patientRef: "PAC-123",
          clinicId: "clinic-1",
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.patient.name).toBe("Paciente Teste");
    expect(result.current.data?.clinicalSnapshots).toHaveLength(3);

    // Verifies inSpy was called with deduplicated author IDs: ['author-uuid-1']
    expect(inSpy).toHaveBeenCalledTimes(1);
    expect(inSpy).toHaveBeenCalledWith("id", ["author-uuid-1"]);
    expect(result.current.data?.profileNameById.get("author-uuid-1")).toBe("Dra. Ana Paula");
  });

  it("does not query profiles if there are no snapshots or authors", async () => {
    vi.spyOn(patientRouting, "fetchPatientByRef").mockResolvedValue({
      data: mockPatient,
      error: null,
    });

    const profilesSpy = vi.fn();

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "patient_clinical_snapshots") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        } as any;
      }
      if (table === "profiles") {
        profilesSpy();
        return {} as any;
      }
      return {
        select: vi.fn().mockReturnThis(),
      } as any;
    });

    const { result } = renderHook(
      () =>
        usePatientSummary({
          patientRef: "PAC-123",
          clinicId: "clinic-1",
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(profilesSpy).not.toHaveBeenCalled();
    expect(result.current.data?.profiles).toHaveLength(0);
  });
});
