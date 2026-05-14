import { describe, expect, it } from "vitest";
import {
  buildClinicalSnapshotSummaryPayload,
  buildPatientClinicalSnapshotState,
  diffPatientClinicalSnapshotStates,
} from "@/lib/patient-clinical-snapshots";

describe("patient clinical snapshots", () => {
  it("builds normalized clinical state from a patient row shape", () => {
    const state = buildPatientClinicalSnapshotState({
      allergies: " Dipirona ",
      blood_type: "O+",
      chronic_conditions: " Asma ",
      clinical_notes: " Requer atenção ",
      clinical_profile: {
        clinical_alerts: "Marcapasso",
        congenital_genetic_conditions: "",
        diagnoses: "Lombalgia",
        falls_history: "Queda em 2025",
        family_history: "",
        functional_independence: "parcialmente_dependente",
        implants_devices: "",
        lifestyle_notes: "",
        mobility_aids: "Bengala",
        substance_use_history: "Tabagismo prévio",
      },
      continuous_medications: " Vitamina D ",
      surgeries: " Joelho ",
    });

    expect(state).toMatchObject({
      allergies: "Dipirona",
      blood_type: "O+",
      chronic_conditions: "Asma",
      continuous_medications: "Vitamina D",
      functional_independence: "Parcialmente dependente",
      mobility_aids: "Bengala",
      substance_use_history: "Tabagismo prévio",
    });
  });

  it("detects relevant changes and builds a summary payload", () => {
    const previousState = buildPatientClinicalSnapshotState({
      allergies: "Dipirona",
      blood_type: "O+",
      chronic_conditions: "Asma",
      clinical_notes: "",
      clinical_profile: {
        clinical_alerts: "",
        congenital_genetic_conditions: "",
        diagnoses: "",
        falls_history: "",
        family_history: "",
        functional_independence: "independente",
        implants_devices: "",
        lifestyle_notes: "",
        mobility_aids: "",
        substance_use_history: "",
      },
      continuous_medications: "Vitamina D",
      surgeries: "",
    });

    const nextState = buildPatientClinicalSnapshotState({
      allergies: "Dipirona",
      blood_type: "O+",
      chronic_conditions: "Asma",
      clinical_notes: "Dor piorou",
      clinical_profile: {
        clinical_alerts: "",
        congenital_genetic_conditions: "",
        diagnoses: "",
        falls_history: "",
        family_history: "",
        functional_independence: "dependente",
        implants_devices: "",
        lifestyle_notes: "",
        mobility_aids: "Andador",
        substance_use_history: "Etilismo atual",
      },
      continuous_medications: "Vitamina D 1000 UI",
      surgeries: "",
    });

    const changes = diffPatientClinicalSnapshotStates(previousState, nextState);

    expect(changes).toEqual([
      {
        field: "continuous_medications",
        label: "Medicamentos de uso contínuo",
        previous: "Vitamina D",
        next: "Vitamina D 1000 UI",
      },
      {
        field: "functional_independence",
        label: "Contexto funcional atual",
        previous: "Independente",
        next: "Dependente",
      },
      {
        field: "mobility_aids",
        label: "Dispositivos de apoio",
        previous: null,
        next: "Andador",
      },
      {
        field: "substance_use_history",
        label: "Uso de substâncias, vícios e compulsões",
        previous: null,
        next: "Etilismo atual",
      },
      {
        field: "clinical_notes",
        label: "Observações clínicas",
        previous: null,
        next: "Dor piorou",
      },
    ]);

    expect(buildClinicalSnapshotSummaryPayload(changes)).toEqual([
      {
        field: "continuous_medications",
        label: "Medicamentos de uso contínuo",
        previous: "Vitamina D",
        next: "Vitamina D 1000 UI",
      },
      {
        field: "functional_independence",
        label: "Contexto funcional atual",
        previous: "Independente",
        next: "Dependente",
      },
      {
        field: "mobility_aids",
        label: "Dispositivos de apoio",
        previous: null,
        next: "Andador",
      },
      {
        field: "substance_use_history",
        label: "Uso de substâncias, vícios e compulsões",
        previous: null,
        next: "Etilismo atual",
      },
      {
        field: "clinical_notes",
        label: "Observações clínicas",
        previous: null,
        next: "Dor piorou",
      },
    ]);
  });
});
