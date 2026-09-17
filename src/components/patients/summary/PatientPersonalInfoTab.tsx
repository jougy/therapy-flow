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
          value: hasResponsible || patient.responsible_name ? (patient.responsible_name || responsibleName) : null,
          fallback: hasResponsible || patient.responsible_name ? "Não informado" : "Não se aplica (titular)",
        },
        {
          label: "Responsável legal (Vínculo)",
          value: hasResponsible || patient.responsible_name ? (patient.responsible_relationship || "Não informado") : null,
          fallback: hasResponsible || patient.responsible_name ? "Não informado" : "Não se aplica (titular)",
        },
        {
          label: "Responsável legal (CPF)",
          value: hasResponsible ? responsibleCpf : null,
          fallback: hasResponsible ? "Não informado" : "Não se aplica (titular)",
        },
        {
          label: "Consentimento de Menor (LGPD)",
          value: (patient.age !== null && patient.age !== undefined && patient.age < 18) || patient.guardian_consent
            ? (() => {
                const c = patient.guardian_consent as { status?: string; method?: string; signed_at?: string } | null;
                if (c?.status === "signed") {
                  const m = c.method === "in_person" ? "Presencial na Tela" : c.method === "paper" ? "Físico em Papel" : "Digital via Celular";
                  return `Autorizado e Assinado (${m})`;
                }
                if (c?.status === "printed") return "Termo Impresso (Pendente Assinatura Física)";
                return "Pendente de Autorização do Responsável";
              })()
            : null,
          fallback: "Não se aplica (titular)",
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
