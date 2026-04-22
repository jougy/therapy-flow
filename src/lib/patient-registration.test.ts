import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import {
  buildPatientRegistrationPutPayload,
  calculatePatientAge,
  extractCpfDigits,
  getPatientRegistrationPassword,
  putPatientRegistration,
} from "@/lib/patient-registration";

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];

const basePatient = (): PatientRow => ({
  address_complement: null,
  address_number: null,
  age: 25,
  allergies: null,
  blood_type: null,
  cep: null,
  chronic_conditions: null,
  city: null,
  clinic_id: "clinic-1",
  clinical_notes: null,
  continuous_medications: null,
  country: "Brasil",
  cpf: "12345678901",
  created_at: "2026-04-01T12:00:00.000Z",
  date_of_birth: "2000-04-20",
  email: "old@example.com",
  gender: null,
  id: "patient-1",
  name: "Paciente Base",
  neighborhood: null,
  phone: "11999998888",
  profession: null,
  pronoun: null,
  registration_complete: false,
  rg: null,
  state: null,
  status: "ativo",
  street: null,
  surgeries: null,
  updated_at: "2026-04-10T09:00:00.000Z",
  user_id: "user-1",
});

describe("patient registration helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("extracts cpf digits and derives the registration password", () => {
    expect(extractCpfDigits("123.456.789-01")).toBe("12345678901");
    expect(getPatientRegistrationPassword("123.456.789-01")).toBe("123456");
    expect(getPatientRegistrationPassword("123")).toBeNull();
  });

  it("calculates patient age from the birth date", () => {
    expect(calculatePatientAge("2000-04-20")).toBe(26);
    expect(calculatePatientAge("")).toBeNull();
  });

  it("builds a normalized full payload for idempotent PUT updates", () => {
    const payload = buildPatientRegistrationPutPayload(basePatient(), {
      addressComplement: "Apto 12 ",
      addressNumber: " 101 ",
      allergies: " Dipirona ",
      bloodType: "O+",
      cep: "01310-930",
      cpf: "987.654.321-00",
      chronicConditions: " Asma ",
      city: " Sao Paulo ",
      clinicalNotes: " Observacao relevante ",
      continuousMedications: " Vitamina D ",
      country: " ",
      dateOfBirth: "1990-01-15",
      email: " paciente@teste.com ",
      gender: "feminino",
      name: " Paciente Atualizado ",
      neighborhood: " Bela Vista ",
      phone: "(11) 98888-7777",
      profession: " Engenheira ",
      pronoun: "ela/dela",
      rg: "12.345.678-9",
      state: " SP ",
      street: " Av. Paulista ",
      surgeries: " Joelho ",
    });

    expect(payload).toMatchObject({
      address_complement: "Apto 12",
      address_number: "101",
      age: 36,
      allergies: "Dipirona",
      blood_type: "O+",
      cep: "01310930",
      cpf: "98765432100",
      chronic_conditions: "Asma",
      city: "Sao Paulo",
      clinical_notes: "Observacao relevante",
      continuous_medications: "Vitamina D",
      country: "Brasil",
      date_of_birth: "1990-01-15",
      email: "paciente@teste.com",
      gender: "feminino",
      id: "patient-1",
      name: "Paciente Atualizado",
      neighborhood: "Bela Vista",
      phone: "11988887777",
      profession: "Engenheira",
      pronoun: "ela/dela",
      registration_complete: true,
      rg: "12.345.678-9",
      state: "SP",
      status: "ativo",
      street: "Av. Paulista",
      surgeries: "Joelho",
      user_id: "user-1",
    });
  });

  it("uses PUT against the patient REST resource", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    await putPatientRegistration({
      accessToken: "token-123",
      apiKey: "anon-key",
      patient: basePatient(),
      supabaseUrl: "https://example.supabase.co",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/patients?id=eq.patient-1",
      expect.objectContaining({
        body: JSON.stringify(basePatient()),
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
          Prefer: "return=minimal",
          apikey: "anon-key",
        }),
        method: "PUT",
      })
    );
  });

  it("surfaces api errors from the PUT request", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ message: "violacao de regra" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(
      putPatientRegistration({
        accessToken: "token-123",
        apiKey: "anon-key",
        patient: basePatient(),
        supabaseUrl: "https://example.supabase.co",
        fetcher,
      })
    ).rejects.toThrow("violacao de regra");
  });
});
