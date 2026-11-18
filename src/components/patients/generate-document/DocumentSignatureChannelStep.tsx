import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, PenTool, Printer, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatPatientPhone } from "@/lib/patient-registration";
import { DocumentInPersonSignatureView } from "./DocumentInPersonSignatureView";
import { DocumentWhatsAppChannelBox } from "./DocumentWhatsAppChannelBox";
import { ElectronicSignatureStampCard } from "./ElectronicSignatureStampCard";
import { createDocumentSignatureRecord } from "./signatureService";
import {
  generateDocumentSignToken,
  isValidUuid,
  type DocumentPatientData,
  type DocumentSignatureChannel,
  type DocumentTemplateItem,
  type InPersonSignedSnapshot,
} from "./types";

interface DocumentSignatureChannelStepProps {
  clinicId?: string | null;
  clinicDisplayName: string;
  patient?: DocumentPatientData | null;
  sessionId?: string | null;
  userId?: string | null;
  selectedTemplate: DocumentTemplateItem;
  rawInterpolatedMarkdown: string;
  signedInPerson: InPersonSignedSnapshot | null;
  onInPersonSigned: (snapshot: InPersonSignedSnapshot) => void;
  onPrintDocument: () => void;
  onGoToPreview: () => void;
}

export const DocumentSignatureChannelStep: React.FC<DocumentSignatureChannelStepProps> = ({
  clinicId,
  clinicDisplayName,
  patient,
  sessionId,
  userId,
  selectedTemplate,
  rawInterpolatedMarkdown,
  signedInPerson,
  onInPersonSigned,
  onPrintDocument,
  onGoToPreview,
}) => {
  const defaultRole: "paciente" | "responsavel" =
    selectedTemplate.category === "minor_consent" ? "responsavel" : "paciente";

  const [selectedChannel, setSelectedChannel] = useState<DocumentSignatureChannel>("whatsapp");
  const [signerRole, setSignerRole] = useState<"paciente" | "responsavel">(defaultRole);
  const [showInPersonPad, setShowInPersonPad] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [submittingPaper, setSubmittingPaper] = useState(false);
  const [paperRegistered, setPaperRegistered] = useState(false);

  useEffect(() => {
    setSignerRole(defaultRole);
  }, [defaultRole]);

  useEffect(() => {
    const defaultPhone =
      signerRole === "responsavel"
        ? patient?.responsible_phone || patient?.emergency_contact_phone || patient?.phone || ""
        : patient?.phone || patient?.responsible_phone || "";
    setWhatsappPhone(defaultPhone ? formatPatientPhone(defaultPhone) : "");
  }, [patient, signerRole]);

  const canPersist = Boolean(clinicId && patient?.id);
  const persistedTemplateId =
    selectedTemplate.isFromTable && isValidUuid(selectedTemplate.id)
      ? selectedTemplate.id
      : null;

  const recipientDisplayName = useMemo(() => {
    if (signerRole === "responsavel") {
      return patient?.responsible_name || patient?.legal_guardian_name || "Responsável Legal";
    }
    return patient?.name || patient?.full_name || "Paciente";
  }, [patient, signerRole]);

  const handleRegisterPaperAndPrint = async () => {
    if (!clinicId || !patient?.id) {
      onPrintDocument();
      return;
    }

    setSubmittingPaper(true);
    try {
      const signToken = generateDocumentSignToken();
      await createDocumentSignatureRecord({
        clinicId,
        patientId: patient.id,
        sessionId: sessionId || null,
        templateId: persistedTemplateId,
        templateTitle: selectedTemplate.title,
        renderedMarkdown: rawInterpolatedMarkdown,
        signToken,
        status: "pending_physical",
        signerName: recipientDisplayName,
        signerRole,
        signatureMetadata: {
          channel: "paper",
          printed_at: new Date().toISOString(),
        },
        createdBy: userId || null,
      });

      setPaperRegistered(true);
      toast({
        title: "Documento registrado como Pendente de Assinatura Física",
        description: "Abrindo visualização de impressão A4.",
      });
      onPrintDocument();
    } catch (err) {
      toast({
        title: "Erro ao registrar impressão física",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmittingPaper(false);
    }
  };

  if (showInPersonPad) {
    return (
      <DocumentInPersonSignatureView
        clinicId={clinicId}
        clinicDisplayName={clinicDisplayName}
        patient={patient}
        sessionId={sessionId}
        userId={userId}
        selectedTemplate={selectedTemplate}
        persistedTemplateId={persistedTemplateId}
        rawInterpolatedMarkdown={rawInterpolatedMarkdown}
        signerRole={signerRole}
        onSignerRoleChange={setSignerRole}
        onBack={() => setShowInPersonPad(false)}
        onSigned={(snapshot) => {
          onInPersonSigned(snapshot);
          setShowInPersonPad(false);
        }}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 w-full min-w-0">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
          Como deseja colher a assinatura neste momento?
        </p>
        <p className="text-xs text-muted-foreground">
          Escolha o canal ideal para o documento <strong>{selectedTemplate.title}</strong>.
        </p>
      </div>

      {!canPersist && (
        <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-200">
          Vincule um paciente salvo ao prontuário para habilitar o registro de assinatura digital remota ou presencial.
        </div>
      )}

      {signedInPerson && (
        <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Assinatura presencial concluída e injetada no documento!</span>
          </div>

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

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onGoToPreview}
              className="min-h-[44px] text-xs gap-2 flex-1"
            >
              <ShieldCheck className="w-4 h-4" />
              Ver Documento Assinado
            </Button>
            <Button
              type="button"
              onClick={onPrintDocument}
              className="min-h-[44px] text-xs font-semibold gap-2 flex-1"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Salvar PDF Assinado
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {/* Canal 1: WhatsApp / Celular */}
        <div
          onClick={() => setSelectedChannel("whatsapp")}
          className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
            selectedChannel === "whatsapp"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border/70 hover:border-primary/40 hover:bg-muted/30"
          }`}
        >
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-sm text-foreground flex flex-wrap items-center gap-2">
                <span>Enviar por WhatsApp / Celular</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  RECOMENDADO
                </span>
              </span>
              <input
                type="radio"
                name="document_signature_channel"
                aria-label="Enviar por WhatsApp / Celular"
                checked={selectedChannel === "whatsapp"}
                onChange={() => setSelectedChannel("whatsapp")}
                className="accent-primary h-4 w-4 shrink-0"
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Gera link único seguro para <strong>{recipientDisplayName}</strong> revisar o termo e assinar digitalmente no próprio smartphone em 1 minuto.
            </p>

            {selectedChannel === "whatsapp" && (
              <DocumentWhatsAppChannelBox
                clinicId={clinicId}
                clinicDisplayName={clinicDisplayName}
                patientId={patient?.id}
                sessionId={sessionId}
                userId={userId}
                persistedTemplateId={persistedTemplateId}
                templateTitle={selectedTemplate.title}
                rawInterpolatedMarkdown={rawInterpolatedMarkdown}
                recipientDisplayName={recipientDisplayName}
                signerRole={signerRole}
                onSignerRoleChange={setSignerRole}
                whatsappPhone={whatsappPhone}
                onWhatsappPhoneChange={setWhatsappPhone}
                canPersist={canPersist}
              />
            )}
          </div>
        </div>

        {/* Canal 2: Assinar agora nesta tela (Presencial) */}
        <div
          onClick={() => setSelectedChannel("in_person")}
          className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
            selectedChannel === "in_person"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border/70 hover:border-primary/40 hover:bg-muted/30"
          }`}
        >
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
            <PenTool className="w-5 h-5" />
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-sm text-foreground">
                Assinar agora nesta tela (Presencial)
              </span>
              <input
                type="radio"
                name="document_signature_channel"
                aria-label="Assinar agora nesta tela (Presencial)"
                checked={selectedChannel === "in_person"}
                onChange={() => setSelectedChannel("in_person")}
                className="accent-primary h-4 w-4 shrink-0"
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O paciente ou responsável está na recepção ou no consultório agora? Abra a lousa de assinatura digital para ele rubricar diretamente com o dedo ou mouse.
            </p>

            {selectedChannel === "in_person" && (
              <div onClick={(e) => e.stopPropagation()} className="pt-1">
                <Button
                  type="button"
                  disabled={!canPersist}
                  onClick={() => setShowInPersonPad(true)}
                  className="w-full min-h-[44px] text-xs font-semibold gap-2"
                >
                  <PenTool className="w-4 h-4" />
                  {signedInPerson ? "Colher Nova Assinatura Presencial" : "Abrir Lousa de Assinatura"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Canal 3: Imprimir termo físico em papel */}
        <div
          onClick={() => setSelectedChannel("paper")}
          className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
            selectedChannel === "paper"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border/70 hover:border-primary/40 hover:bg-muted/30"
          }`}
        >
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
            <Printer className="w-5 h-5" />
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-sm text-foreground">
                Imprimir termo físico em papel
              </span>
              <input
                type="radio"
                name="document_signature_channel"
                aria-label="Imprimir termo físico em papel"
                checked={selectedChannel === "paper"}
                onChange={() => setSelectedChannel("paper")}
                className="accent-primary h-4 w-4 shrink-0"
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Gera o documento formatado em A4 para assinatura com caneta. O sistema registrará como <strong>&quot;Pendente de Assinatura Física&quot;</strong> no prontuário.
            </p>

            {selectedChannel === "paper" && (
              <div onClick={(e) => e.stopPropagation()} className="pt-1 space-y-2">
                <Button
                  type="button"
                  disabled={submittingPaper}
                  onClick={handleRegisterPaperAndPrint}
                  className="w-full min-h-[44px] text-xs font-semibold gap-2"
                >
                  {submittingPaper ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  Registrar e Imprimir A4 (Papel)
                </Button>
                {paperRegistered && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    Registrado como &quot;Pendente de Assinatura Física&quot;.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
