import { describe, expect, it } from "vitest";
import { buildPatientExportData } from "./patient-export";
import { EMPTY_CLINICAL_PROFILE, EMPTY_EMERGENCY_CONTACT } from "./patient-clinical-profile";
import type { Database } from "@/integrations/supabase/types";

type Patient = Database["public"]["Tables"]["patients"]["Row"];

describe("patient-export", () => {
  it("builds a complete LGPD export payload with all patient fields and metadata", () => {
    const mockPatient: Patient = {
      address_complement: "Apto 101",
      address_number: "500",
      age: 28,
      allergies: "Penicilina",
      blood_type: "O+",
      cep: "69000-000",
      chronic_conditions: "Rinite",
      city: "Manaus",
      clinic_id: "clinic-1",
      clinical_notes: "Paciente assíduo",
      clinical_profile: null,
      continuous_medications: "Antialérgico",
      country: "Brasil",
      cpf: "123.456.789-00",
      created_at: "2026-01-10T10:00:00Z",
      date_of_birth: "1998-05-20",
      email: "paciente@exemplo.com",
      emergency_contact: null,
      gender: "Feminino",
      id: "patient-1",
      is_recurring: false,
      name: "Maria da Silva",
      neighborhood: "Adrianópolis",
      origin_insurance_member_id: null,
      origin_insurance_plan: null,
      origin_insurance_provider: null,
      origin_other_description: null,
      origin_other_name: null,
      origin_referrer_name: "Dr. João",
      origin_type: "indicacao",
      patient_code: "PAC-001",
      phone: "(92) 99999-8888",
      profession: "Engenheira",
      pronome: "ela/dela",
      recurring_time: "08:00",
      recurring_weekdays: [],
      registration_complete: true,
      responsible_cpf: null,
      rg: "1234567-8",
      state: "AM",
      status: "ativo",
      street: "Av. Paraíba",
      surgeries: "Apendicectomia em 2015",
      updated_at: "2026-02-15T14:30:00Z",
      user_id: "user-1",
      uses_responsible_cpf: false,
    };

    const clinicalProfile = {
      ...EMPTY_CLINICAL_PROFILE,
      diagnoses: "Lombalgia mecânica",
      clinical_alerts: "Alerta de dor lombar crônica",
      risk_flags: ["fall_risk" as const],
    };

    const emergencyContact = {
      name: "Carlos da Silva",
      phone: "(92) 98888-7777",
      relationship: "Cônjuge",
    };

    const payload = buildPatientExportData({
      patient: mockPatient,
      clinicalProfile,
      emergencyContact,
      clinicName: "Clínica Manaus Fisio",
      exportedBy: "Dra. Especialista",
    });

    // Metadata
    expect(payload.export_metadata.legal_basis).toContain("LGPD");
    expect(payload.export_metadata.clinic_name).toBe("Clínica Manaus Fisio");
    expect(payload.export_metadata.exported_by).toBe("Dra. Especialista");

    // Identificação
    expect(payload.identificacao.nome_completo).toBe("Maria da Silva");
    expect(payload.identificacao.codigo_paciente).toBe("PAC-001");
    expect(payload.identificacao.cpf).toBe("123.456.789-00");
    expect(payload.identificacao.idade).toBe(28);

    // Contatos
    expect(payload.contatos.telefone).toBe("(92) 99999-8888");
    expect(payload.contatos.email).toBe("paciente@exemplo.com");
    expect(payload.contatos.contato_emergencia.nome).toBe("Carlos da Silva");

    // Endereço
    expect(payload.endereco.logradouro).toBe("Av. Paraíba");
    expect(payload.endereco.cidade).toBe("Manaus");
    expect(payload.endereco.estado).toBe("AM");

    // Perfil de Saúde Base
    expect(payload.perfil_saude_base.tipo_sanguineo).toBe("O+");
    expect(payload.perfil_saude_base.alergias).toBe("Penicilina");
    expect(payload.perfil_saude_base.alertas_clinicos).toBe("Alerta de dor lombar crônica");

    // Histórico Clínico & Funcional
    expect(payload.historico_clinico_funcional.diagnosticos_previos).toBe("Lombalgia mecânica");
    expect(payload.historico_clinico_funcional.cirurgias_internacoes).toBe("Apendicectomia em 2015");
  });
});
