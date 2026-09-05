import React from "react";
import { createPortal } from "react-dom";
import type { Database } from "@/integrations/supabase/types";
import type { PatientClinicalProfile, PatientEmergencyContact } from "@/lib/patient-clinical-profile";
import { getFunctionalIndependenceLabel, getPatientRiskFlagLabel } from "@/lib/patient-clinical-profile";
import { formatPatientOriginDetails, getPatientOriginLabel } from "@/lib/patient-origin";

type Patient = Database["public"]["Tables"]["patients"]["Row"];
type PatientClinicalSnapshot = Database["public"]["Tables"]["patient_clinical_snapshots"]["Row"];

interface PatientRegistrationPrintViewProps {
  patient: Patient;
  clinic: {
    name?: string | null;
    logo_url?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    cnpj?: string | null;
  } | null;
  profile?: {
    full_name?: string | null;
    social_name?: string | null;
    professional_document?: string | null;
  } | null;
  user?: { email?: string | null } | null;
  clinicalProfile: PatientClinicalProfile;
  emergencyContact: PatientEmergencyContact;
  snapshots?: PatientClinicalSnapshot[];
  profileNameById?: Map<string, string>;
}

const formatDate = (date?: string | null) => {
  if (!date) return "—";
  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
  } catch {
    return date;
  }
};

const formatDateTime = (date?: string | null) => {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return date;
  }
};

const formatFullAddress = (patient: Patient) => {
  const streetLine = [patient.street, patient.address_number].filter(Boolean).join(", ");
  const complement = patient.address_complement ? ` (${patient.address_complement})` : "";
  const neighborhood = patient.neighborhood ? `Bairro: ${patient.neighborhood}` : "";
  const cityState = [patient.city, patient.state].filter(Boolean).join(" - ");
  const cep = patient.cep ? `CEP: ${patient.cep}` : "";
  const country = patient.country ? patient.country : "";

  const parts = [
    streetLine ? `${streetLine}${complement}` : null,
    neighborhood || null,
    cityState || null,
    cep || null,
    country || null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" • ") : "Não informado";
};

export const PatientRegistrationPrintView: React.FC<PatientRegistrationPrintViewProps> = ({
  patient,
  clinic,
  profile,
  user,
  clinicalProfile,
  emergencyContact,
  snapshots = [],
  profileNameById = new Map(),
}) => {
  const originDetails = formatPatientOriginDetails(patient);
  const issuerName = profile?.full_name || profile?.social_name || user?.email || "Profissional Responsável";
  const now = new Date();
  const printDateFormatted = now.toLocaleDateString("pt-BR");
  const printTimeFormatted = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const activeRiskFlags = (clinicalProfile.risk_flags || []).map((flag) => getPatientRiskFlagLabel(flag));

  return createPortal(
    <div id="print-patient-registration-root" className="hidden print:block font-sans text-slate-900 bg-white p-6 max-w-4xl mx-auto space-y-4 leading-relaxed">
      {/* Cabeçalho Institucional & LGPD */}
      <header className="border-b-2 border-slate-800 pb-3 flex justify-between items-start gap-4">
        <div className="flex items-center gap-3">
          {clinic?.logo_url ? (
            <img src={clinic.logo_url} alt="" className="h-12 max-w-[140px] object-contain rounded" />
          ) : (
            <img src="/branding/logo/pluri_health_icon_gradient.svg" alt="Pluri-Health" className="h-12 w-12 object-contain" />
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight uppercase tracking-tight">{clinic?.name ?? "Pluri-Health"}</h1>
            <p className="text-xs font-semibold text-slate-700">Dossiê de Dados Cadastrais e Perfil de Saúde do Paciente</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Conformidade LGPD — Lei Federal nº 13.709/2018 (Art. 18: Livre Acesso e Portabilidade de Dados Pessoais)
            </p>
          </div>
        </div>
        <div className="text-right text-[10px] text-slate-600 space-y-0.5 shrink-0">
          <p><span className="font-semibold text-slate-700">Data de emissão:</span> {printDateFormatted} às {printTimeFormatted}</p>
          <p><span className="font-semibold text-slate-700">Emitido por:</span> {issuerName}</p>
          {profile?.professional_document ? (
            <p><span className="font-semibold text-slate-700">Conselho/Registro:</span> {profile.professional_document}</p>
          ) : null}
          {patient.patient_code ? (
            <p className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded inline-block mt-0.5">
              Prontuário: {patient.patient_code}
            </p>
          ) : null}
        </div>
      </header>

      {/* 1. Dados Pessoais e Identificação */}
      <section className="rounded-lg border border-slate-200 bg-slate-50/40 p-3.5 space-y-2 break-inside-avoid">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            1. Identificação e Dados Pessoais
          </h2>
          <span className="text-[10px] font-semibold text-slate-600">
            Status: {patient.registration_complete ? "Cadastro Concluído" : "Cadastro Preliminar"}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="col-span-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Nome Completo</span>
            <span className="font-bold text-slate-900 text-sm">{patient.name}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Data de Nascimento</span>
            <span className="text-slate-800">{formatDate(patient.date_of_birth)} {patient.age ? `(${patient.age} anos)` : ""}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Gênero / Pronome</span>
            <span className="text-slate-800">{[patient.gender, patient.pronoun].filter(Boolean).join(" • ") || "—"}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">CPF</span>
            <span className="text-slate-800 font-mono">{patient.cpf || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">RG</span>
            <span className="text-slate-800 font-mono">{patient.rg || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Profissão</span>
            <span className="text-slate-800">{patient.profession || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Origem / Encaminhamento</span>
            <span className="text-slate-800">{getPatientOriginLabel(patient.origin_type)}</span>
          </div>
        </div>

        {patient.uses_responsible_cpf && patient.responsible_cpf ? (
          <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-900">
            <span className="font-bold">CPF do Responsável Legal:</span> {patient.responsible_cpf}
          </div>
        ) : null}

        {originDetails ? (
          <div className="text-[11px] text-slate-600 bg-white rounded p-2 border border-slate-200/60">
            <span className="font-semibold text-slate-700">Detalhes de Origem / Convênio:</span> {originDetails}
          </div>
        ) : null}
      </section>

      {/* 2. Contatos e Localização */}
      <section className="rounded-lg border border-slate-200 bg-slate-50/40 p-3.5 space-y-2 break-inside-avoid">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200/80 pb-1.5">
          2. Contatos e Endereço Residencial
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Telefone / Celular</span>
            <span className="text-slate-800 font-medium">{patient.phone || "—"}</span>
          </div>
          <div className="col-span-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">E-mail</span>
            <span className="text-slate-800">{patient.email || "—"}</span>
          </div>
        </div>

        <div className="text-xs border-t border-slate-200/60 pt-2">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Contato de Emergência</span>
          <span className="text-slate-800">
            {emergencyContact.name ? (
              <>
                <strong className="font-semibold text-slate-900">{emergencyContact.name}</strong>
                {emergencyContact.relationship ? ` (${emergencyContact.relationship})` : ""}
                {emergencyContact.phone ? ` • Telefone: ${emergencyContact.phone}` : ""}
              </>
            ) : "Nenhum contato de emergência informado"}
          </span>
        </div>

        <div className="text-xs border-t border-slate-200/60 pt-2">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Endereço Completo</span>
          <span className="text-slate-800">{formatFullAddress(patient)}</span>
        </div>
      </section>

      {/* 3. Saúde Base & Alertas */}
      <section className="rounded-lg border border-slate-200 bg-slate-50/40 p-3.5 space-y-2 break-inside-avoid">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200/80 pb-1.5">
          3. Perfil de Saúde Base e Alertas
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Tipo Sanguíneo</span>
            <span className="font-bold text-slate-900">{patient.blood_type || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Alergias</span>
            <span className="text-slate-800">{patient.allergies || "Nenhuma registrada"}</span>
          </div>
          <div className="col-span-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Problemas Crônicos</span>
            <span className="text-slate-800">{patient.chronic_conditions || "Nenhum registrado"}</span>
          </div>
        </div>

        {clinicalProfile.clinical_alerts ? (
          <div className="text-xs bg-rose-50 border border-rose-200 rounded p-2 text-rose-900">
            <span className="font-bold uppercase tracking-wide text-[10px] block text-rose-700">Alertas Clínicos Imediatos:</span>
            {clinicalProfile.clinical_alerts}
          </div>
        ) : null}

        {activeRiskFlags.length > 0 ? (
          <div className="text-xs pt-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Marcadores de Risco Ativos</span>
            <div className="flex flex-wrap gap-1.5">
              {activeRiskFlags.map((label) => (
                <span key={label} className="bg-slate-200 text-slate-800 text-[10px] font-semibold px-2 py-0.5 rounded">
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {(clinicalProfile.congenital_genetic_conditions || clinicalProfile.family_history) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs border-t border-slate-200/60 pt-2">
            {clinicalProfile.congenital_genetic_conditions ? (
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Condições Congênitas ou Genéticas</span>
                <span className="text-slate-800">{clinicalProfile.congenital_genetic_conditions}</span>
              </div>
            ) : null}
            {clinicalProfile.family_history ? (
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Histórico Familiar</span>
                <span className="text-slate-800">{clinicalProfile.family_history}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* 4. Histórico Clínico & Funcional */}
      <section className="rounded-lg border border-slate-200 bg-slate-50/40 p-3.5 space-y-2 break-inside-avoid">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200/80 pb-1.5">
          4. Histórico Clínico e Contexto Funcional
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Diagnósticos Prévios</span>
            <span className="text-slate-800 whitespace-pre-line leading-snug">{clinicalProfile.diagnoses || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Cirurgias e Internações</span>
            <span className="text-slate-800 whitespace-pre-line leading-snug">{patient.surgeries || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Medicamentos de Uso Contínuo</span>
            <span className="text-slate-800 whitespace-pre-line leading-snug">{patient.continuous_medications || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Implantes e Dispositivos</span>
            <span className="text-slate-800 whitespace-pre-line leading-snug">{clinicalProfile.implants_devices || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Histórico de Quedas</span>
            <span className="text-slate-800 whitespace-pre-line leading-snug">{clinicalProfile.falls_history || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Contexto Funcional / Apoio</span>
            <span className="text-slate-800 leading-snug">
              {[
                clinicalProfile.functional_independence ? getFunctionalIndependenceLabel(clinicalProfile.functional_independence) : null,
                clinicalProfile.mobility_aids ? `Apoio: ${clinicalProfile.mobility_aids}` : null,
              ].filter(Boolean).join(" • ") || "—"}
            </span>
          </div>
        </div>

        {clinicalProfile.substance_use_history ? (
          <div className="text-xs border-t border-slate-200/60 pt-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Uso de Substâncias, Vícios e Compulsões</span>
            <span className="text-slate-800 whitespace-pre-line leading-snug">{clinicalProfile.substance_use_history}</span>
          </div>
        ) : null}

        {patient.clinical_notes ? (
          <div className="text-xs border-t border-slate-200/60 pt-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Observações Clínicas Adicionais</span>
            <span className="text-slate-800 whitespace-pre-line leading-snug">{patient.clinical_notes}</span>
          </div>
        ) : null}
      </section>

      {/* 5. Histórico de Versões / Auditoria (se houver snapshots) */}
      {snapshots.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-slate-50/40 p-3.5 space-y-2 break-inside-avoid">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200/80 pb-1.5">
            5. Auditoria de Alterações Cadastrais Anteriores ({snapshots.length} versões registradas)
          </h2>
          <div className="space-y-1.5 text-[11px]">
            {snapshots.slice(0, 5).map((snap, idx) => (
              <div key={snap.id || idx} className="flex items-start justify-between border-b border-slate-100 pb-1">
                <div>
                  <span className="font-semibold text-slate-800">{formatDateTime(snap.created_at)}</span>
                  <span className="text-slate-500 ml-2">
                    por {snap.created_by ? profileNameById.get(snap.created_by) ?? "Colaborador" : "Colaborador"}
                  </span>
                  {snap.change_note ? (
                    <p className="text-slate-600 italic mt-0.5">Nota: {snap.change_note}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 6. Declaração Legal de Entrega e Recebimento LGPD */}
      <footer className="rounded-lg border-2 border-slate-300 p-4 space-y-4 break-inside-avoid bg-white">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Termo de Entrega e Recebimento de Dados Pessoais (LGPD - Art. 18)
          </h3>
          <p className="text-[11px] text-slate-700 mt-1 leading-relaxed text-justify">
            Declaro que recebi cópia física/digital integral dos meus dados cadastrais e de saúde sob custódia da clínica{" "}
            <strong>{clinic?.name ?? "desta clínica"}</strong>, exercendo os direitos de confirmação de tratamento e livre acesso previstos
            no Artigo 18 da Lei Federal nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 pt-4">
          <div className="text-center">
            <div className="border-b border-slate-400 pb-1 min-h-[32px]"></div>
            <p className="text-xs font-bold text-slate-800 mt-1">{patient.name}</p>
            <p className="text-[10px] text-slate-500">Paciente / Responsável Legal</p>
          </div>
          <div className="text-center">
            <div className="border-b border-slate-400 pb-1 min-h-[32px]"></div>
            <p className="text-xs font-bold text-slate-800 mt-1">{issuerName}</p>
            <p className="text-[10px] text-slate-500">Responsável pela Emissão / Clínica</p>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-[9px] text-slate-400">
          <span>Pluri-Health • Sistema de Gestão em Saúde • https://pluri.health</span>
          <span>Documento confidencial — Protegido por sigilo profissional e LGPD</span>
        </div>
      </footer>
    </div>,
    document.body
  );
};
