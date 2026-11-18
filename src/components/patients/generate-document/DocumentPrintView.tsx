import React from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import { formatPatientCpf, formatPatientPhone } from "@/lib/patient-registration";
import {
  allowSignatureUrlTransform,
  formatBirthDate,
  formatCnpj,
  type DocumentPatientData,
  type DocumentTemplateItem,
  type InPersonSignedSnapshot,
} from "./types";
import { ElectronicSignatureStampCard } from "./ElectronicSignatureStampCard";

interface DocumentPrintViewProps {
  open: boolean;
  selectedTemplate: DocumentTemplateItem;
  patient?: DocumentPatientData | null;
  clinicDisplayName: string;
  clinicCnpj?: string;
  interpolatedMarkdown: string;
  collaboratorName?: string;
  collaboratorLicense?: string;
  signedInPerson?: InPersonSignedSnapshot | null;
}

export const DocumentPrintView: React.FC<DocumentPrintViewProps> = ({
  open,
  selectedTemplate,
  patient,
  clinicDisplayName,
  clinicCnpj,
  interpolatedMarkdown,
  collaboratorName,
  collaboratorLicense,
  signedInPerson,
}) => {
  if (typeof document === "undefined" || !open) return null;

  const patientDisplayName = patient?.name || patient?.full_name || "Paciente";

  return createPortal(
    <div
      id="print-generate-document-root"
      className="hidden print:block font-sans text-slate-900 bg-white p-6 max-w-4xl mx-auto space-y-4 leading-relaxed"
    >
      {/* Cabeçalho Institucional da Clínica */}
      <header className="border-b-2 border-slate-800 pb-3 text-center space-y-1">
        <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900">
          {clinicDisplayName}
        </h1>
        {clinicCnpj && (
          <p className="text-xs font-mono text-slate-600">
            CNPJ: {formatCnpj(clinicCnpj)}
          </p>
        )}
        <p className="text-xs font-semibold text-slate-700">
          {selectedTemplate.title}
        </p>
        {selectedTemplate.description && (
          <p className="text-[11px] font-mono text-slate-500">
            {selectedTemplate.description}
          </p>
        )}
      </header>

      {/* Identificação do Paciente */}
      {patient && (
        <section className="border border-slate-300 rounded p-4 bg-slate-50/50 text-xs text-slate-800 grid grid-cols-2 gap-4 avoid-break">
          <div className="space-y-1">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px] block">
              Identificação do Paciente
            </span>
            <p><strong>Nome Completo:</strong> {patient.name || patient.full_name || "Não informado"}</p>
            <p><strong>Data de Nascimento:</strong> {formatBirthDate(patient.date_of_birth || patient.birth_date) || "Não informada"}</p>
            {patient.cpf && <p><strong>CPF:</strong> {formatPatientCpf(patient.cpf)}</p>}
            {patient.responsible_name && (
              <p><strong>Responsável:</strong> {patient.responsible_name}</p>
            )}
          </div>
          <div className="space-y-1">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px] block">
              Contatos & Registro
            </span>
            {patient.phone ? (
              <p><strong>Telefone:</strong> {formatPatientPhone(patient.phone)}</p>
            ) : (
              <p><strong>Telefone:</strong> ___________________________</p>
            )}
            {patient.email && <p><strong>E-mail:</strong> {patient.email}</p>}
            {collaboratorName && (
              <p>
                <strong>Profissional:</strong> {collaboratorName}{" "}
                {collaboratorLicense ? `(${collaboratorLicense})` : ""}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Conteúdo Formatado em Markdown */}
      <main className="prose prose-sm max-w-none text-xs leading-relaxed text-slate-800 pt-2 prose-blockquote:border-l-4 prose-blockquote:border-l-emerald-600 prose-blockquote:bg-emerald-50/70 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:not-italic">
        <ReactMarkdown urlTransform={allowSignatureUrlTransform}>
          {interpolatedMarkdown}
        </ReactMarkdown>
      </main>

      {/* Linhas de Assinatura / Carimbo Eletrônico */}
      <footer className="border-t border-slate-400 pt-8 mt-6 space-y-6 avoid-break">
        {signedInPerson ? (
          <ElectronicSignatureStampCard
            signerName={signedInPerson.signerName}
            signerCpf={signedInPerson.signerCpf}
            signerRoleLabel={
              signedInPerson.signerRole === "responsavel" ? "Responsável Legal" : "Paciente"
            }
            signedAt={signedInPerson.signedAt}
            signatureImageUrl={signedInPerson.signatureImageUrl}
            clinicName={clinicDisplayName}
            methodLabel="Presencial na Clínica"
            verificationCode={signedInPerson.id}
            token={signedInPerson.signToken}
          />
        ) : (
          <div className="text-xs text-slate-600 text-center">
            Local e Data: _____________________________________, _____ de ____________________ de 20____
          </div>
        )}

        <div className="grid grid-cols-2 gap-8 pt-2">
          <div className="flex flex-col items-center justify-center space-y-1">
            {signedInPerson?.signatureImageUrl ? (
              <img
                src={signedInPerson.signatureImageUrl}
                alt={`Assinatura de ${signedInPerson.signerName}`}
                className="max-h-14 max-w-[200px] object-contain"
              />
            ) : null}
            <div className="w-full max-w-64 border-b border-slate-800" />
            <p className="font-semibold text-xs text-center text-slate-900">
              {signedInPerson?.signerName || patientDisplayName}
            </p>
            <p className="text-[11px] text-slate-600 text-center">
              {signedInPerson
                ? `Assinado digitalmente (${signedInPerson.signerRole === "responsavel" ? "Responsável Legal" : "Paciente"})`
                : `Assinatura do(a) Paciente / Titular${patient?.cpf ? ` • CPF: ${formatPatientCpf(patient.cpf)}` : ""}`}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center space-y-1">
            <div className="w-full max-w-64 border-b border-slate-800" />
            <p className="font-semibold text-xs text-center text-slate-900">
              {collaboratorName || clinicDisplayName}
            </p>
            <p className="text-[11px] text-slate-600 text-center">
              {collaboratorLicense
                ? `Registro: ${collaboratorLicense}`
                : "Profissional Responsável / Clínica"}
            </p>
          </div>
        </div>
      </footer>
    </div>,
    document.body
  );
};
