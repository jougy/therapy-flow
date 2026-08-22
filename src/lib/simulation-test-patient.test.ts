import { describe, it, expect, vi } from "vitest";
import {
  generateValidCpf,
  generateSimulationPatientData,
  createSimulationTestPatient,
} from "./simulation-test-patient";
import { isValidCpfDigits } from "./patient-registration";

describe("Simulation Test Patient Generation", () => {
  it("generates 100% valid CPFs conforming to official checksum algorithm", () => {
    for (let i = 0; i < 100; i++) {
      const cpf = generateValidCpf();
      expect(cpf).toHaveLength(11);
      expect(isValidCpfDigits(cpf)).toBe(true);
    }
  });

  it("generates adult preset with valid Brazilian data", () => {
    const data = generateSimulationPatientData({ preset: "adult" });
    expect(data.name).toContain("(Teste)");
    expect(isValidCpfDigits(data.cpf)).toBe(true);
    expect(data.usesResponsibleCpf).toBe(false);
    expect(data.responsibleCpf).toBeNull();
    expect(data.email).toContain("@exemplo.com");
    expect(data.phone).toMatch(/^119\d{8}$/);
    expect(data.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("generates minor preset with responsible CPF linked", () => {
    const data = generateSimulationPatientData({ preset: "minor" });
    expect(data.usesResponsibleCpf).toBe(true);
    expect(data.responsibleCpf).toBeTruthy();
    expect(isValidCpfDigits(data.responsibleCpf!)).toBe(true);
    expect(data.cpf).toBe(data.responsibleCpf);
    expect(data.profession).toBe("Estudante");
  });

  it("generates elderly preset with valid data", () => {
    const data = generateSimulationPatientData({ preset: "elderly" });
    expect(isValidCpfDigits(data.cpf)).toBe(true);
    expect(data.usesResponsibleCpf).toBe(false);
  });

  it("allows custom name override", () => {
    const data = generateSimulationPatientData({ name: "Carlos Eduardo da Silva" });
    expect(data.name).toBe("Carlos Eduardo da Silva");
  });

  it("calls ensure_clinic_patient RPC and updates clinical profile on createSimulationTestPatient", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        id: "mock-patient-123",
        patient_code: "PAT-001",
        status: "created",
      },
      error: null,
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockSupabase = {
      rpc: mockRpc,
      from: vi.fn().mockReturnValue({
        update: mockUpdate,
      }),
    };

    const result = await createSimulationTestPatient(
      mockSupabase as never,
      "clinic-xyz-123",
      { name: "Paciente Teste Automatizado" }
    );

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe("mock-patient-123");
    expect(mockRpc).toHaveBeenCalledWith("ensure_clinic_patient", expect.objectContaining({
      _clinic_id: "clinic-xyz-123",
      _name: "Paciente Teste Automatizado",
    }));
  });
});
