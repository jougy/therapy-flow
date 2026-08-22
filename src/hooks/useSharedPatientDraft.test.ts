import { describe, it, expect, beforeEach } from "vitest";
import {
  getSharedPatientDraft,
  saveSharedPatientDraft,
  clearSharedPatientDraft,
  getDraftStorageKey,
  type SharedPatientDraftValues,
} from "./useSharedPatientDraft";
import { EMPTY_CLINICAL_PROFILE, EMPTY_EMERGENCY_CONTACT } from "@/lib/patient-clinical-profile";

const mockDraftValues: SharedPatientDraftValues = {
  name: "Maria Silva",
  dateOfBirth: "1990-05-15",
  gender: "feminino",
  pronoun: "ela/dela",
  rg: "12.345.678-9",
  profession: "Engenheira",
  originType: "indicacao",
  originReferrerName: "Dr. João",
  originInsuranceProvider: "",
  originInsurancePlan: "",
  originInsuranceMemberId: "",
  originOtherName: "",
  originOtherDescription: "",
  cep: "01001-000",
  country: "Brasil",
  state: "SP",
  city: "São Paulo",
  neighborhood: "Sé",
  street: "Praça da Sé",
  addressNumber: "100",
  addressComplement: "Apto 12",
  bloodType: "O+",
  chronicConditions: "Hipertensão",
  surgeries: "Apendicectomia em 2010",
  continuousMedications: "Losartana 50mg",
  allergies: "Dipirona",
  clinicalNotes: "Sem queixas agudas",
  clinicalProfile: EMPTY_CLINICAL_PROFILE,
  emergencyContact: {
    ...EMPTY_EMERGENCY_CONTACT,
    name: "Carlos Silva",
    phone: "11988887777",
    relationship: "Esposo",
  },
  phone: "(11) 98888-7777",
  email: "maria.silva@example.com",
};

const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

const localStorageMock = createStorageMock();
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("useSharedPatientDraft", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("returns null when no draft exists for token", () => {
    expect(getSharedPatientDraft("non-existent-token")).toBeNull();
  });

  it("saves and retrieves draft correctly for given token", () => {
    const token = "token-abc-123";
    saveSharedPatientDraft(token, mockDraftValues);

    const saved = getSharedPatientDraft(token);
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe("Maria Silva");
    expect(saved?.city).toBe("São Paulo");
    expect(saved?.emergencyContact.name).toBe("Carlos Silva");
    expect(saved?.allergies).toBe("Dipirona");
  });

  it("does not retrieve draft when token does not match", () => {
    saveSharedPatientDraft("token-1", mockDraftValues);
    expect(getSharedPatientDraft("token-2")).toBeNull();
  });

  it("clears draft from localStorage when clearSharedPatientDraft is called", () => {
    const token = "token-to-clear";
    saveSharedPatientDraft(token, mockDraftValues);
    expect(getSharedPatientDraft(token)).not.toBeNull();

    clearSharedPatientDraft(token);
    expect(getSharedPatientDraft(token)).toBeNull();
    expect(window.localStorage.getItem(getDraftStorageKey(token))).toBeNull();
  });
});
