import React from "react";
import ReactMarkdown from "react-markdown";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPatientCpf, formatPatientPhone } from "@/lib/patient-registration";
import { ElectronicSignatureStampCard } from "./ElectronicSignatureStampCard";
import {
  allowSignatureUrlTransform,
  formatBirthDate,
  formatCnpj,
  type DocumentPatientData,
  type DocumentTemplateItem,
  type InPersonSignedSnapshot,
} from "./types";

interface DocumentPreviewSheetProps {
  selectedTemplate: DocumentTemplateItem;
  patient?: DocumentPatientData | null;
  effectiveClinicDisplayName: string;
  clinicCnpj?: string;
  interpolatedMarkdown: string;
  customVariablesCount: number;
  collaboratorName?: string | null;
  collaboratorLicense?: string | null;
  signedInPerson: InPersonSignedSnapshot | null;
  onGoToVariables: () => void;
}

export const DocumentPreviewSheet: React.FC<DocumentPreviewSheetProps> = ({
  selectedTemplate,
  patient,
  effectiveClinicDisplayName,
  clinicCnpj,
  interpolatedMarkdown,
  customVariablesCount,
  collaboratorName,
  collaboratorLicense,
  signedInPerson,
  onGoToVariables,
}) => {
  const patientDisplayName = patient?.name || patient?.full_name || "Paciente";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {customVariablesCount > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              Este modelo possui <strong>{customVariablesCount}</strong> variável(is) personalizada(s).
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onGoToVariables}
            className="h-7 text-xs bg-background shrink-0"
          >
            Preencher Agora
          </Button>
        </div>
      )}

      {/* Folha A4 Simulada */}
      <div
        id="document-preview-sheet"
        className="bg-card p-4 sm:p-8 rounded-xl border shadow-sm text-xs sm:text-sm text-foreground space-y-5"
      >
        {/* Cabeçalho da Clínica */}
        <div className="border-b pb-4 text-center space-y-1">
          <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide text-primary">
            {effectiveClinicDisplayName}
          </h2>
          {clinicCnpj && (
            <p className="text-[11px] font-mono text-muted-foreground">
              CNPJ: {formatCnpj(clinicCnpj)}
            </p>
          )}
          <p className="text-xs text-muted-foreground font-semibold">{selectedTemplate.title}</p>
          {selectedTemplate.description && (
            <p className="text-[11px] text-muted-foreground font-normal">
              {selectedTemplate.description}
            </p>
          )}
        </div>

        {/* Quadro de Qualificação do Paciente */}
        {patient && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg border bg-muted/30 text-xs">
            <div className="space-y-1">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground block">
                Identificação do Paciente
              </span>
              <p>
                <strong>Nome Completo:</strong> {patient.name || patient.full_name || "Não informado"}
              </p>
              <p>
                <strong>Data de Nascimento:</strong>{" "}
                {formatBirthDate(patient.date_of_birth || patient.birth_date) || "Não informada"}
              </p>
              {patient.cpf && (
                <p>
                  <strong>CPF:</strong> {formatPatientCpf(patient.cpf)}
                </p>
              )}
              {patient.responsible_name && (
                <p>
                  <strong>Responsável:</strong> {patient.responsible_name}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground block">
                Contatos & Profissional
              </span>
              {patient.phone ? (
                <p>
                  <strong>Telefone:</strong> {formatPatientPhone(patient.phone)}
                </p>
              ) : (
                <p>
                  <strong>Telefone:</strong> Não informado
                </p>
              )}
              {patient.email && (
                <p>
                  <strong>E-mail:</strong> {patient.email}
                </p>
              )}
              {collaboratorName && (
                <p>
                  <strong>Atendimento:</strong> {collaboratorName}{" "}
                  {collaboratorLicense ? `(${collaboratorLicense})` : ""}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Corpo Formatado em Markdown */}
        <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none text-xs leading-relaxed border-t pt-4 prose-blockquote:border-l-4 prose-blockquote:border-l-emerald-600 prose-blockquote:bg-emerald-50/60 dark:prose-blockquote:bg-emerald-950/20 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:not-italic">
          <ReactMarkdown urlTransform={allowSignatureUrlTransform}>
            {interpolatedMarkdown}
          </ReactMarkdown>
        </div>

        {/* Linhas de Assinatura / Carimbo Eletrônico */}
        <div className="border-t pt-6 mt-6 space-y-6">
          {signedInPerson ? (
            <ElectronicSignatureStampCard
              signerName={signedInPerson.signerName}
              signerCpf={signedInPerson.signerCpf}
              signerRoleLabel={
                signedInPerson.signerRole === "responsavel" ? "Responsável Legal" : "Paciente"
              }
              signedAt={signedInPerson.signedAt}
              signatureImageUrl={signedInPerson.signatureImageUrl}
              clinicName={effectiveClinicDisplayName}
              methodLabel="Presencial na Clínica"
              verificationCode={signedInPerson.id}
              token={signedInPerson.signToken}
            />
          ) : (
            <div className="text-xs text-muted-foreground text-center">
              Local e Data: _____________________________________, _____ de ____________________ de 20____
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="flex flex-col items-center justify-center space-y-1">
              {signedInPerson?.signatureImageUrl && (
                <img
                  src={signedInPerson.signatureImageUrl}
                  alt={`Assinatura de ${signedInPerson.signerName}`}
                  className="max-h-14 max-w-[200px] object-contain"
                />
              )}
              <div className="w-56 border-b border-foreground/70" />
              <p className="font-semibold text-xs text-center">
                {signedInPerson?.signerName || patientDisplayName}
              </p>
              <p className="text-[11px] text-muted-foreground text-center">
                {signedInPerson
                  ? `Assinado digitalmente (${signedInPerson.signerRole === "responsavel" ? "Responsável Legal" : "Paciente"})`
                  : "Assinatura do(a) Paciente / Titular"}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center space-y-1">
              <div className="w-56 border-b border-foreground/70" />
              <p className="font-semibold text-xs text-center">
                {collaboratorName || effectiveClinicDisplayName}
              </p>
              <p className="text-[11px] text-muted-foreground text-center">
                {collaboratorLicense
                  ? `Registro: ${collaboratorLicense}`
                  : "Profissional Responsável / Clínica"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
