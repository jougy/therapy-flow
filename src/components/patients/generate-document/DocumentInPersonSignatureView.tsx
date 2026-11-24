import React, { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { formatPatientCpf } from "@/lib/patient-registration";
import {
  formatCurrentTimeHHMM,
  formatDateShortBr,
  interpolateTermVariables,
  renderElectronicSignatureStamp,
} from "@/lib/termVariables";
import { SignaturePadCanvas } from "./SignaturePadCanvas";
import { createDocumentSignatureRecord, type CreateDocumentSignatureInput } from "./signatureService";
import { isOfflineOrNetworkError } from "@/lib/local-first/networkError";
import { enqueueOfflineMutation } from "@/lib/local-first/offlineMutationQueue";
import {
  cacheOfflineDocumentSignature,
  computeSha256Hex,
} from "@/lib/local-first/offlineSignatureHelpers";
import {
  generateDocumentSignToken,
  type DocumentPatientData,
  type DocumentTemplateItem,
  type InPersonSignedSnapshot,
} from "./types";

interface DocumentInPersonSignatureViewProps {
  clinicId?: string | null;
  clinicDisplayName: string;
  patient?: DocumentPatientData | null;
  sessionId?: string | null;
  userId?: string | null;
  selectedTemplate: DocumentTemplateItem;
  persistedTemplateId: string | null;
  rawInterpolatedMarkdown: string;
  signerRole: "paciente" | "responsavel";
  onSignerRoleChange: (role: "paciente" | "responsavel") => void;
  onBack: () => void;
  onSigned: (snapshot: InPersonSignedSnapshot) => void;
}

export const DocumentInPersonSignatureView: React.FC<DocumentInPersonSignatureViewProps> = ({
  clinicId,
  clinicDisplayName,
  patient,
  sessionId,
  userId,
  selectedTemplate,
  persistedTemplateId,
  rawInterpolatedMarkdown,
  signerRole,
  onSignerRoleChange,
  onBack,
  onSigned,
}) => {
  const [signerName, setSignerName] = useState("");
  const [signerCpf, setSignerCpf] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const defaultName =
      signerRole === "responsavel"
        ? patient?.responsible_name || patient?.legal_guardian_name || ""
        : patient?.name || patient?.full_name || "";
    const defaultCpf =
      signerRole === "responsavel" ? patient?.responsible_cpf || "" : patient?.cpf || "";
    setSignerName(defaultName);
    setSignerCpf(defaultCpf ? formatPatientCpf(defaultCpf) : "");
  }, [patient, signerRole]);

  const handleConfirmInPerson = async () => {
    if (!clinicId || !patient?.id) {
      toast({
        title: "Dados incompletos",
        description: "É necessário um paciente e clínica vinculados para salvar a assinatura.",
        variant: "destructive",
      });
      return;
    }

    if (signerName.trim().length < 2) {
      toast({
        title: "Nome obrigatório",
        description: "Informe o nome completo de quem está assinando.",
        variant: "destructive",
      });
      return;
    }

    const cpfDigits = signerCpf.replace(/\D/g, "");
    if (cpfDigits.length > 0 && cpfDigits.length !== 11) {
      toast({
        title: "CPF inválido",
        description: "Informe os 11 dígitos do CPF ou deixe o campo em branco.",
        variant: "destructive",
      });
      return;
    }

    if (!signatureDataUrl) {
      toast({
        title: "Assinatura obrigatória",
        description: "Solicite que o assinante rubrique na lousa digital.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    const now = new Date();
    const signedAtIso = now.toISOString();
    const signToken = generateDocumentSignToken();
    const formattedCpf = cpfDigits.length === 11 ? formatPatientCpf(cpfDigits) : null;

    const stampData = {
      fullName: signerName.trim(),
      cpf: formattedCpf,
      date: formatDateShortBr(now),
      time: formatCurrentTimeHHMM(now),
      location: clinicDisplayName,
      globalUserId: patient.patient_code || patient.id,
      signatureWebpUrl: signatureDataUrl,
    };

    const hasTag =
      rawInterpolatedMarkdown.includes("<assinatura_paciente>") ||
      rawInterpolatedMarkdown.includes("<assinatura_responsavel>");

    const renderedWithStamp = hasTag
      ? interpolateTermVariables(rawInterpolatedMarkdown, {}, {
          now,
          signatures: { [signerRole]: stampData },
        })
      : `${rawInterpolatedMarkdown}\n\n---\n\n${renderElectronicSignatureStamp(stampData, "markdown")}`;

    const signatureInput: CreateDocumentSignatureInput = {
      clinicId,
      patientId: patient.id,
      sessionId: sessionId || null,
      templateId: persistedTemplateId,
      templateTitle: selectedTemplate.title,
      renderedMarkdown: renderedWithStamp,
      signToken,
      status: "signed_in_person",
      signerName: signerName.trim(),
      signerCpf: cpfDigits || null,
      signerRole,
      signatureImageUrl: signatureDataUrl,
      signedAt: signedAtIso,
      signatureMetadata: {
        channel: "in_person",
        signed_method: "in_person",
        date: stampData.date,
        time: stampData.time,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      },
      createdBy: userId || null,
    };

    const handleOfflineSignature = async () => {
      const sha256Hash = await computeSha256Hex(
        JSON.stringify({
          clinicId,
          patientId: patient.id,
          signToken,
          signedAt: signedAtIso,
          signerName: signatureInput.signerName,
          signerCpf: signatureInput.signerCpf,
          renderedMarkdown: renderedWithStamp,
          signatureImageUrl: signatureDataUrl,
        })
      );
      const offlineId = crypto.randomUUID();
      const offlineInput: CreateDocumentSignatureInput = {
        ...signatureInput,
        signatureMetadata: {
          ...signatureInput.signatureMetadata,
          sha256_hash: sha256Hash,
          offline_recorded: true,
        },
      };

      await cacheOfflineDocumentSignature(patient.id, signToken, {
        ...offlineInput,
        id: offlineId,
      });
      await enqueueOfflineMutation("create_document_signature", offlineInput);

      onSigned({
        id: offlineId,
        signToken,
        signerName: signerName.trim(),
        signerCpf: cpfDigits || null,
        signerRole,
        signatureImageUrl: signatureDataUrl,
        signedAt: signedAtIso,
        location: clinicDisplayName,
      });

      toast({
        title: "Assinatura registrada offline!",
        description: "Hash SHA-256 gerado e carimbo salvo localmente — será sincronizada ao reconectar.",
      });
    };

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await handleOfflineSignature();
        return;
      }

      const created = await createDocumentSignatureRecord(signatureInput);

      onSigned({
        id: created.id,
        signToken: created.sign_token,
        signerName: signerName.trim(),
        signerCpf: cpfDigits || null,
        signerRole,
        signatureImageUrl: signatureDataUrl,
        signedAt: created.signed_at || signedAtIso,
        location: clinicDisplayName,
      });

      toast({
        title: "Assinatura presencial registrada!",
        description: "O carimbo eletrônico foi injetado no documento.",
      });
    } catch (err) {
      if (isOfflineOrNetworkError(err)) {
        await handleOfflineSignature();
        return;
      }
      toast({
        title: "Erro ao salvar assinatura presencial",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 w-full min-w-0">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-xs min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar aos canais
        </Button>
        <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
          <PenTool className="w-4 h-4" />
          Assinatura Presencial
        </span>
      </div>

      <div className="p-4 sm:p-5 rounded-xl border bg-card shadow-sm space-y-4">
        <div className="space-y-1">
          <h3 className="font-bold text-sm sm:text-base text-foreground">
            Lousa de Assinatura Digital ({selectedTemplate.title})
          </h3>
          <p className="text-xs text-muted-foreground">
            Confirme os dados de quem está assinando e peça para rubricar no quadro abaixo com o dedo ou mouse.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={signerRole === "paciente" ? "default" : "outline"}
            onClick={() => onSignerRoleChange("paciente")}
            className="text-xs min-h-[40px]"
          >
            Assinante: Paciente
          </Button>
          <Button
            type="button"
            size="sm"
            variant={signerRole === "responsavel" ? "default" : "outline"}
            onClick={() => onSignerRoleChange("responsavel")}
            className="text-xs min-h-[40px]"
          >
            Assinante: Responsável Legal
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="in-person-signer-name" className="text-xs font-medium">
              Nome Completo do Assinante <span className="text-destructive">*</span>
            </Label>
            <Input
              id="in-person-signer-name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Nome completo"
              className="h-10 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="in-person-signer-cpf" className="text-xs font-medium">
              CPF do Assinante
            </Label>
            <Input
              id="in-person-signer-cpf"
              value={signerCpf}
              onChange={(e) => setSignerCpf(formatPatientCpf(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              inputMode="numeric"
              className="h-10 text-xs"
            />
          </div>
        </div>

        <SignaturePadCanvas onSignatureChange={setSignatureDataUrl} disabled={submitting} />

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="min-h-[44px] text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!signatureDataUrl || signerName.trim().length < 2 || submitting}
            onClick={handleConfirmInPerson}
            className="min-h-[44px] text-xs font-semibold gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Confirmar Assinatura Presencial
          </Button>
        </div>
      </div>
    </div>
  );
};
