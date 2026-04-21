import { describe, expect, it } from "vitest";
import {
  EDITABLE_PATIENT_STATUS_VALUES,
  comparePatientStatusPriority,
  getPatientStatusMeta,
} from "@/lib/patient-statuses";

describe("patient status helpers", () => {
  it("exposes metadata for known homepage statuses", () => {
    expect(getPatientStatusMeta("ativo").label).toBe("Ativo");
    expect(getPatientStatusMeta("pagamento_pendente").label).toBe("Pagamento pendente");
  });

  it("keeps payment pending out of the editable patient detail statuses", () => {
    expect(EDITABLE_PATIENT_STATUS_VALUES).toEqual(["ativo", "pausado", "inativo", "alta"]);
  });

  it("sorts known statuses by shared priority and sends unknown values to the end", () => {
    expect(comparePatientStatusPriority("ativo", "pausado")).toBeLessThan(0);
    expect(comparePatientStatusPriority("alta", "ativo")).toBeGreaterThan(0);
    expect(comparePatientStatusPriority("desconhecido", "alta")).toBeGreaterThan(0);
  });
});
