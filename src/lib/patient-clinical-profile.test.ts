import { describe, expect, it } from "vitest";
import {
  buildClinicalProfilePayload,
  buildEmergencyContactPayload,
  getFunctionalIndependenceLabel,
  parseClinicalProfile,
  parseEmergencyContact,
} from "@/lib/patient-clinical-profile";

describe("patient clinical profile helpers", () => {
  it("parses profile and emergency contact objects safely", () => {
    expect(
      parseClinicalProfile({
        clinical_alerts: "Marcapasso",
        congenital_genetic_conditions: "Síndrome genética",
        diagnoses: "Lombalgia",
        falls_history: "Sem quedas",
        family_history: "AVC",
        functional_independence: "independente",
        implants_devices: "Prótese",
        lifestyle_notes: "Ativo",
        mobility_aids: "Nenhum",
        risk_flags: ["fall_risk", "allergy", "unknown"],
        substance_use_history: "Tabagismo passado",
      }),
    ).toMatchObject({
      clinical_alerts: "Marcapasso",
      congenital_genetic_conditions: "Síndrome genética",
      diagnoses: "Lombalgia",
      functional_independence: "independente",
      risk_flags: ["fall_risk", "allergy"],
      substance_use_history: "Tabagismo passado",
    });

    expect(
      parseEmergencyContact({
        name: "Ana",
        phone: "(11) 99999-0000",
        relationship: "Mãe",
      }),
    ).toEqual({
      name: "Ana",
      phone: "(11) 99999-0000",
      relationship: "Mãe",
    });
  });

  it("builds nullable payloads for empty or filled objects", () => {
    expect(
      buildClinicalProfilePayload({
        addiction_records: [],
        clinical_alerts: "  ",
        congenital_genetic_conditions: "",
        diagnoses: "",
        falls_history: "",
        family_history: "",
        functional_independence: "",
        has_addictions: false,
        implants_devices: "",
        lifestyle_notes: "",
        mobility_aids: "",
        risk_flags: [],
        substance_use_records: [],
        substance_use_history: "",
        uses_substances: false,
      }),
    ).toBeNull();

    expect(
      buildClinicalProfilePayload({
        addiction_records: [],
        clinical_alerts: " Restricao de carga ",
        congenital_genetic_conditions: " Condicao congenita ",
        diagnoses: " Lombalgia ",
        falls_history: "",
        family_history: "",
        functional_independence: "parcialmente_dependente",
        has_addictions: false,
        implants_devices: "",
        lifestyle_notes: "",
        mobility_aids: "",
        risk_flags: ["fall_risk", "diabetes"],
        substance_use_records: [],
        substance_use_history: "",
        uses_substances: false,
      }),
    ).toEqual({
      addiction_records: null,
      clinical_alerts: "Restricao de carga",
      congenital_genetic_conditions: "Condicao congenita",
      diagnoses: "Lombalgia",
      falls_history: null,
      family_history: null,
      functional_independence: "parcialmente_dependente",
      has_addictions: null,
      implants_devices: null,
      lifestyle_notes: null,
      mobility_aids: null,
      risk_flags: ["fall_risk", "diabetes"],
      substance_use_history: null,
      substance_use_records: null,
      uses_substances: null,
    });

    expect(
      buildEmergencyContactPayload({
        name: " ",
        phone: "",
        relationship: "",
      }),
    ).toBeNull();
  });

  it("maps functional independence labels", () => {
    expect(getFunctionalIndependenceLabel("dependente")).toBe("Dependente");
    expect(getFunctionalIndependenceLabel("")).toBe("");
  });
});
