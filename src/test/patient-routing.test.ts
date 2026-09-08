import { describe, it, expect } from "vitest";
import { isUuid, getPatientRouteKey, getPatientPath, getClinicPatientPath } from "@/lib/patient-routing";

describe("patient-routing utilities", () => {
  it("correctly identifies UUIDs", () => {
    expect(isUuid("8e68b809-4750-4082-ba53-1fb39ddc1e0f")).toBe(true);
    expect(isUuid("PAC-001")).toBe(false);
    expect(isUuid("101")).toBe(false);
    expect(isUuid("patient-123")).toBe(false);
    expect(isUuid("test-uuid-456")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });

  it("prioritizes patient_code over id for route keys", () => {
    expect(getPatientRouteKey({ id: "8e68b809-4750-4082-ba53-1fb39ddc1e0f", patient_code: "PAC-001" })).toBe("PAC-001");
    expect(getPatientRouteKey({ id: "8e68b809-4750-4082-ba53-1fb39ddc1e0f", patient_code: null })).toBe("8e68b809-4750-4082-ba53-1fb39ddc1e0f");
    expect(getPatientRouteKey({ id: "8e68b809-4750-4082-ba53-1fb39ddc1e0f", patient_code: "" })).toBe("8e68b809-4750-4082-ba53-1fb39ddc1e0f");
  });

  it("generates correct patient paths", () => {
    const patient = { id: "uuid-123", patient_code: "PAC-042" };
    expect(getPatientPath(patient)).toBe("/pacientes/PAC-042");
    expect(getPatientPath(patient, "cadastro")).toBe("/pacientes/PAC-042/cadastro");
    expect(getPatientPath(patient, "/resumo")).toBe("/pacientes/PAC-042/resumo");
    expect(getPatientPath("PAC-099", "dashboard")).toBe("/pacientes/PAC-099/dashboard");
  });

  it("generates correct clinic patient paths", () => {
    const patient = { id: "8e68b809-4750-4082-ba53-1fb39ddc1e0f", patient_code: "PAC-001" };
    expect(getClinicPatientPath("7ee14ddb62ed1b47915f1194", patient)).toBe("/clinica/7ee14ddb62ed1b47915f1194/pacientes/PAC-001");
    expect(getClinicPatientPath("7ee14ddb62ed1b47915f1194", patient, "cadastro")).toBe("/clinica/7ee14ddb62ed1b47915f1194/pacientes/PAC-001/cadastro");
    expect(getClinicPatientPath(null, patient)).toBe("/pacientes/PAC-001");
  });

  it("handles canonicalization logic when route id is UUID vs clean patient code", () => {
    const patient = { id: "8e68b809-4750-4082-ba53-1fb39ddc1e0f", patient_code: "PAC-001" };
    const routeIdInput = "8e68b809-4750-4082-ba53-1fb39ddc1e0f";
    const canonicalKey = getPatientRouteKey(patient);

    expect(canonicalKey).toBe("PAC-001");
    expect(routeIdInput !== canonicalKey).toBe(true);
    expect(getClinicPatientPath("7ee14ddb62ed1b47915f1194", patient)).toBe("/clinica/7ee14ddb62ed1b47915f1194/pacientes/PAC-001");
  });

  it("fetchPatientByRef never queries id column when ref is not a UUID", async () => {
    const { fetchPatientByRef } = await import("@/lib/patient-routing");
    const { supabase } = await import("@/integrations/supabase/client");

    const eqSpy = vi.fn().mockImplementation((col: string, val: string) => {
      if (col === "id" && !isUuid(val)) {
        throw new Error("PostgreSQL 22P02: invalid input syntax for type uuid: " + val);
      }
      return {
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        eq: eqSpy,
      };
    });

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "patients") {
        return {
          select: vi.fn().mockReturnValue({
            eq: eqSpy,
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        } as any;
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      } as any;
    });

    // Should not throw 22P02 error when querying by patient code
    const result = await fetchPatientByRef("PAC-099", "clinic-1");
    expect(result.data).toBeNull();
    // Verify eq was never called with ("id", "PAC-099")
    expect(eqSpy).not.toHaveBeenCalledWith("id", "PAC-099");
  });
});
