import type { Database } from "@/integrations/supabase/types";
import type { PatientClinicalProfile, PatientEmergencyContact } from "@/lib/patient-clinical-profile";
import { formatPatientOriginDetails, getPatientOriginLabel } from "@/lib/patient-origin";

type Patient = Database["public"]["Tables"]["patients"]["Row"];
type PatientClinicalSnapshot = Database["public"]["Tables"]["patient_clinical_snapshots"]["Row"];

export interface PatientExportPayload {
  export_metadata: {
    exported_at: string;
    legal_basis: string;
    system: string;
    clinic_name: string;
    exported_by: string;
    version: string;
  };
  identificacao: {
    codigo_paciente: string | null;
    nome_completo: string;
    data_nascimento: string | null;
    idade: number | null;
    cpf: string | null;
    rg: string | null;
    cpf_responsavel: string | null;
    utiliza_cpf_responsavel: boolean;
    genero: string | null;
    pronome: string | null;
    profissao: string | null;
    status: string;
    cadastro_concluido: boolean;
    origem_tipo: string;
    origem_detalhes: string | null;
    criado_em: string;
    atualizado_em: string;
  };
  contatos: {
    telefone: string | null;
    email: string | null;
    contato_emergencia: {
      nome: string;
      vinculo: string;
      telefone: string;
    };
  };
  endereco: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    cep: string | null;
    pais: string | null;
  };
  perfil_saude_base: {
    tipo_sanguineo: string | null;
    problemas_cronicos: string | null;
    alergias: string | null;
    alertas_clinicos: string;
    condicoes_congenitas_geneticas: string;
    historico_familiar: string;
    marcadores_risco: string[];
  };
  historico_clinico_funcional: {
    diagnosticos_previos: string;
    cirurgias_internacoes: string | null;
    implantes_dispositivos: string;
    historico_quedas: string;
    medicamentos_continuos: string | null;
    contexto_funcional: string;
    dispositivos_apoio: string;
    estilo_de_vida: string;
    substancias_e_vicios: {
      historico_geral: string;
      faz_uso_substancias: boolean;
      possui_vicios_compulsoes: boolean;
      registros_substancias: PatientClinicalProfile["substance_use_records"];
      registros_vicios: PatientClinicalProfile["addiction_records"];
    };
    observacoes_clinicas: string | null;
  };
  historico_versoes?: Array<{
    data: string;
    nota_alteracao: string | null;
    criado_por?: string | null;
  }>;
}

export const buildPatientExportData = ({
  patient,
  clinicalProfile,
  emergencyContact,
  snapshots = [],
  clinicName = "Clínica Pluri-Health",
  exportedBy = "Profissional autorizado",
}: {
  patient: Patient;
  clinicalProfile: PatientClinicalProfile;
  emergencyContact: PatientEmergencyContact;
  snapshots?: PatientClinicalSnapshot[];
  clinicName?: string;
  exportedBy?: string;
}): PatientExportPayload => {
  const originDetails = formatPatientOriginDetails(patient);

  return {
    export_metadata: {
      exported_at: new Date().toISOString(),
      legal_basis: "Lei Geral de Proteção de Dados (LGPD - Lei Federal nº 13.709/2018, Art. 18, incisos II e V - Direito de Acesso e Portabilidade dos Dados)",
      system: "Pluri-Health",
      clinic_name: clinicName,
      exported_by: exportedBy,
      version: "1.0",
    },
    identificacao: {
      codigo_paciente: patient.patient_code,
      nome_completo: patient.name,
      data_nascimento: patient.date_of_birth,
      idade: patient.age,
      cpf: patient.cpf,
      rg: patient.rg,
      cpf_responsavel: patient.responsible_cpf,
      utiliza_cpf_responsavel: Boolean(patient.uses_responsible_cpf),
      genero: patient.gender,
      pronome: patient.pronoun,
      profissao: patient.profession,
      status: patient.status,
      cadastro_concluido: Boolean(patient.registration_complete),
      origem_tipo: getPatientOriginLabel(patient.origin_type),
      origem_detalhes: originDetails,
      criado_em: patient.created_at,
      atualizado_em: patient.updated_at,
    },
    contatos: {
      telefone: patient.phone,
      email: patient.email,
      contato_emergencia: {
        nome: emergencyContact.name || "Não informado",
        vinculo: emergencyContact.relationship || "Não informado",
        telefone: emergencyContact.phone || "Não informado",
      },
    },
    endereco: {
      logradouro: patient.street,
      numero: patient.address_number,
      complemento: patient.address_complement,
      bairro: patient.neighborhood,
      cidade: patient.city,
      estado: patient.state,
      cep: patient.cep,
      pais: patient.country,
    },
    perfil_saude_base: {
      tipo_sanguineo: patient.blood_type,
      problemas_cronicos: patient.chronic_conditions,
      alergias: patient.allergies,
      alertas_clinicos: clinicalProfile.clinical_alerts || "",
      condicoes_congenitas_geneticas: clinicalProfile.congenital_genetic_conditions || "",
      historico_familiar: clinicalProfile.family_history || "",
      marcadores_risco: clinicalProfile.risk_flags || [],
    },
    historico_clinico_funcional: {
      diagnosticos_previos: clinicalProfile.diagnoses || "",
      cirurgias_internacoes: patient.surgeries,
      implantes_dispositivos: clinicalProfile.implants_devices || "",
      historico_quedas: clinicalProfile.falls_history || "",
      medicamentos_continuos: patient.continuous_medications,
      contexto_funcional: clinicalProfile.functional_independence || "",
      dispositivos_apoio: clinicalProfile.mobility_aids || "",
      estilo_de_vida: clinicalProfile.lifestyle_notes || "",
      substancias_e_vicios: {
        historico_geral: clinicalProfile.substance_use_history || "",
        faz_uso_substancias: Boolean(clinicalProfile.uses_substances),
        possui_vicios_compulsoes: Boolean(clinicalProfile.has_addictions),
        registros_substancias: clinicalProfile.substance_use_records || [],
        registros_vicios: clinicalProfile.addiction_records || [],
      },
      observacoes_clinicas: patient.clinical_notes,
    },
    historico_versoes: snapshots.map((s) => ({
      data: s.created_at,
      nota_alteracao: s.change_note,
      criado_por: s.created_by,
    })),
  };
};

export const downloadPatientDataJson = (payload: PatientExportPayload, patientName: string) => {
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const safeName = (patientName || "paciente")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `cadastro-lgpd-${safeName}-${dateStr}.json`;

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
