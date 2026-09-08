import React from "react";
import type { Database } from "@/integrations/supabase/types";
import { SummaryBlock } from "@/components/patients/SummaryBlock";
import { formatPatientDate } from "@/lib/patient-formatting";
import { getPatientOriginLabel } from "@/lib/patient-origin";

type Patient = Database["public"]["Tables"]["patients"]["Row"];

export interface PatientPersonalInfoTabProps {
  patient: Patient;
  hasResponsible: boolean;
  responsibleName?: string | null;
  responsibleCpf?: string | null;
  patientOriginDetails?: string | null;
}

export const PatientPersonalInfoTab: React.FC<PatientPersonalInfoTabProps> = ({
  patient,
  hasResponsible,
  responsibleName,
  responsibleCpf,
  patientOriginDetails,
}) => {
  return (
    <SummaryBlock
      title="Identificação e Dados Pessoais"
      description="Informações cadastrais e de identificação civil do paciente."
      values={[
        { label: "Nome completo", value: patient.name },
        { label: "Código do prontuário", value: patient.patient_code || patient.id },
        { label: "Data de nascimento", value: formatPatientDate(patient.date_of_birth) },
        { label: "Idade", value: patient.age ? `${patient.age} anos` : null },
        { label: "CPF", value: patient.cpf },
        { label: "RG", value: patient.rg },
        { label: "Gênero", value: patient.gender },
        { label: "Pronome", value: patient.pronoun },
        { label: "Profissão", value: patient.profession },
        {
          label: "Origem / Encaminhamento",
          value: [getPatientOriginLabel(patient.origin_type), patientOriginDetails]
            .filter(Boolean)
            .join("\n"),
        },
        {
          label: "Responsável legal (Nome)",
          value: hasResponsible ? responsibleName : null,
          fallback: hasResponsible ? "Não informado" : "Não se aplica (titular)",
        },
        {
          label: "Responsável legal (CPF)",
          value: hasResponsible ? responsibleCpf : null,
          fallback: hasResponsible ? "Não informado" : "Não se aplica (titular)",
        },
        { label: "Status operacional", value: patient.status },
        {
          label: "Situação do cadastro",
          value: patient.registration_complete ? "Cadastro Completo" : "Cadastro Preliminar",
        },
      ]}
    />
  );
};
