import React from "react";
import { ShieldCheck } from "lucide-react";
import { formatPatientCpf } from "@/lib/patient-registration";
import { SignatureQrCode } from "./SignatureQrCode";
import { buildPublicSignatureVerificationUrl } from "./types";

export interface ElectronicSignatureStampCardProps {
  signerName: string;
  signerCpf?: string | null;
  signerRoleLabel?: string;
  councilRegistration?: string | null;
  signedAt: string;
  signatureImageUrl?: string | null;
  clinicName?: string;
  methodLabel?: string;
  verificationCode?: string;
  token?: string | null;
  className?: string;
}

export const ElectronicSignatureStampCard: React.FC<ElectronicSignatureStampCardProps> = ({
  signerName,
  signerCpf,
  signerRoleLabel,
  councilRegistration,
  signedAt,
  signatureImageUrl,
  clinicName,
  methodLabel = "Assinatura Eletrônica",
  verificationCode,
  token,
  className = "",
}) => {
  const parsedDate = new Date(signedAt);
  const formattedDate = Number.isNaN(parsedDate.getTime())
    ? signedAt
    : parsedDate.toLocaleDateString("pt-BR");
  const formattedTime = Number.isNaN(parsedDate.getTime())
    ? ""
    : parsedDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const origin =
    typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  const verificationUrl = buildPublicSignatureVerificationUrl(origin, token);

  return (
    <div
      data-testid="electronic-signature-stamp"
      className={`rounded-xl border border-emerald-500/40 border-l-4 border-l-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/25 p-3.5 sm:p-4 text-xs text-slate-900 dark:text-slate-100 space-y-2.5 avoid-break w-full max-w-full min-w-0 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Documento assinado virtualmente</span>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          {methodLabel}
        </span>
      </div>

      <div className="flex items-start justify-between gap-3 sm:gap-4 min-w-0">
        {/* Coluna esquerda: assinatura .webp sem fundo + dados essenciais */}
        <div className="flex-1 min-w-0 space-y-2">
          {signatureImageUrl && (
            <div className="py-1.5 px-2.5 rounded-lg bg-white/90 dark:bg-slate-900/60 border border-emerald-500/20 inline-flex items-center justify-center max-w-full">
              <img
                src={signatureImageUrl}
                alt={`Assinatura de ${signerName}`}
                className="max-h-16 max-w-full sm:max-w-[220px] object-contain"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] leading-relaxed">
            <p className="break-words">
              <strong>Nome completo:</strong> {signerName}
            </p>
            {signerCpf && (
              <p>
                <strong>CPF:</strong> {formatPatientCpf(signerCpf)}
              </p>
            )}
            {councilRegistration && (
              <p className="break-words">
                <strong>Conselho Regional:</strong> {councilRegistration}
              </p>
            )}
            {signerRoleLabel && (
              <p>
                <strong>Vínculo:</strong> {signerRoleLabel}
              </p>
            )}
            <p>
              <strong>Data e Horário:</strong> {formattedDate}
              {formattedTime ? ` • ${formattedTime}` : ""}
            </p>
            {clinicName && (
              <p className="break-words">
                <strong>Clínica:</strong> {clinicName}
              </p>
            )}
            {verificationCode && (
              <p className="font-mono text-[10px] break-all sm:col-span-2 text-muted-foreground">
                <strong>Código de Verificação:</strong> {verificationCode}
              </p>
            )}
          </div>
        </div>

        {/* Coluna direita: QR Code de verificação pública */}
        <div className="shrink-0 flex flex-col items-center gap-1 text-center">
          <SignatureQrCode url={verificationUrl} />
          <span className="text-[10px] font-medium text-emerald-800 dark:text-emerald-300 leading-tight max-w-[88px] sm:max-w-[96px]">
            Escaneie para verificar
          </span>
        </div>
      </div>
    </div>
  );
};
