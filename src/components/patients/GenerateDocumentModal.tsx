import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getActiveBrand } from "@/hooks/useActiveBrand";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Printer,
  FileSignature,
  ShieldCheck,
  Loader2,
  Sparkles,
  Eye,
  SlidersHorizontal,
  PenTool,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  interpolateTermVariables,
  extractVariablesFromMarkdown,
  formatCurrentTimeHHMM,
  formatDateExtenso,
  formatDateShortBr,
} from "@/lib/termVariables";
import { generateGlobalUserId } from "@/lib/user-identity";
import { formatPatientCpf, formatPatientPhone } from "@/lib/patient-registration";
import {
  type GenerateDocumentModalProps,
  type InPersonSignedSnapshot,
  formatBirthDate,
  formatCnpj,
  KNOWN_VARIABLES,
  useDocumentTemplates,
  DocumentPrintView,
  DocumentPreviewSheet,
  DocumentVariablesForm,
  DocumentSignatureChannelStep,
} from "./generate-document";

export { type GenerateDocumentModalProps, type DocumentPatientData } from "./generate-document";

export const GenerateDocumentModal: React.FC<GenerateDocumentModalProps> = ({
  open,
  onOpenChange,
  patient,
  clinicId,
  clinicName,
  sessionId,
  initialTemplateId,
  onPrinted,
}) => {
  const { user, profile, clinic: authClinic, clinicId: authClinicId } = useAuth();
  const effectiveClinicId = clinicId || patient?.clinic_id || authClinicId;

  const [activeTab, setActiveTab] = useState<"preview" | "variables" | "signature">("preview");
  const [customVariableValues, setCustomVariableValues] = useState<Record<string, string>>({});
  const [adjustedKnownValues, setAdjustedKnownValues] = useState<Record<string, string>>({});
  const [signedInPerson, setSignedInPerson] = useState<InPersonSignedSnapshot | null>(null);

  const {
    loading,
    clinicCnpj,
    customTemplates,
    availableTemplates,
    selectedTemplate,
    selectedTemplateId,
    setSelectedTemplateId,
  } = useDocumentTemplates({
    open,
    clinicId: effectiveClinicId,
    initialTemplateId,
  });

  const effectiveClinicDisplayName = clinicName || authClinic?.name || `Clínica ${getActiveBrand().name}`;
  const patientDisplayName = patient?.name || patient?.full_name || "Paciente";

  const defaultKnownValues = useMemo<Record<string, string>>(() => {
    const now = new Date();
    const patientDob = patient?.date_of_birth || patient?.birth_date;
    const rawPatientAddr = patient?.address;
    const patientAddress =
      typeof rawPatientAddr === "string"
        ? rawPatientAddr
        : rawPatientAddr && typeof rawPatientAddr === "object"
        ? [
            rawPatientAddr.street,
            rawPatientAddr.number,
            rawPatientAddr.neighborhood,
            rawPatientAddr.city,
            rawPatientAddr.state,
          ]
            .filter(Boolean)
            .join(", ")
        : "";

    return {
      "<nome_paciente>": patient?.name || patient?.full_name || "",
      "<cpf_paciente>": patient?.cpf ? formatPatientCpf(patient.cpf) : "",
      "<rg_paciente>": patient?.rg || "",
      "<data_nascimento_paciente>": formatBirthDate(patientDob),
      "<estado_civil_paciente>": patient?.marital_status || "",
      "<profissao_paciente>": patient?.profession || "",
      "<endereco_paciente>": patientAddress,
      "<telefone_paciente>": patient?.phone ? formatPatientPhone(patient.phone) : "",
      "<email_paciente>": patient?.email || "",
      "<nome_responsavel>":
        patient?.responsible_name ||
        patient?.legal_guardian_name ||
        patient?.emergency_contact_name ||
        "",
      "<cpf_responsavel>": patient?.responsible_cpf
        ? formatPatientCpf(patient.responsible_cpf)
        : "",
      "<telefone_responsavel>": patient?.responsible_phone
        ? formatPatientPhone(patient.responsible_phone)
        : patient?.emergency_contact_phone
        ? formatPatientPhone(patient.emergency_contact_phone)
        : "",
      "<nome_colaborador>": profile?.full_name || profile?.social_name || user?.email || "",
      "<email_colaborador>": profile?.email || user?.email || "",
      "<crp_crm_colaborador>": profile?.professional_license || profile?.council_name || "",
      "<nome_clinica>": effectiveClinicDisplayName,
      "<cnpj_clinica>": formatCnpj(clinicCnpj),
      "<data_atual>": formatDateShortBr(now),
      "<horario_atual>": formatCurrentTimeHHMM(now),
      "<data_extenso>": formatDateExtenso(now),
    };
  }, [patient, effectiveClinicDisplayName, profile, user, clinicCnpj]);

  const detectedVariables = useMemo(() => {
    if (!selectedTemplate?.content) return [];
    return extractVariablesFromMarkdown(selectedTemplate.content);
  }, [selectedTemplate]);

  const customVariables = useMemo(() => {
    return detectedVariables.filter((v) => !KNOWN_VARIABLES.includes(v));
  }, [detectedVariables]);

  const interpolatedMarkdown = useMemo(() => {
    if (!selectedTemplate?.content) return "";
    const mergedValues: Record<string, string> = {
      ...defaultKnownValues,
      ...adjustedKnownValues,
      ...customVariableValues,
    };
    const profileRecord = profile as Record<string, unknown> | null;
    const signatureWebpUrl =
      typeof profileRecord?.signature_webp_url === "string"
        ? profileRecord.signature_webp_url
        : undefined;
    const globalUserId = generateGlobalUserId({
      userId: user?.id,
      publicCode: profile?.public_code,
      email: user?.email,
    });

    const signaturesPayload: NonNullable<
      Parameters<typeof interpolateTermVariables>[2]
    >["signatures"] = profile
      ? {
          colaborador: {
            fullName: profile.full_name || profile.social_name || user?.email,
            cpf: profile.cpf ? formatPatientCpf(profile.cpf) : undefined,
            councilRegistration: profile.professional_license
              ? `${profile.council_name ? `${profile.council_name} ` : ""}${profile.professional_license}`
              : undefined,
            globalUserId,
            signatureWebpUrl,
          },
        }
      : {};

    if (signedInPerson) {
      const signedAtDate = new Date(signedInPerson.signedAt);
      signaturesPayload[signedInPerson.signerRole] = {
        fullName: signedInPerson.signerName,
        cpf: signedInPerson.signerCpf ? formatPatientCpf(signedInPerson.signerCpf) : undefined,
        date: formatDateShortBr(signedAtDate),
        time: formatCurrentTimeHHMM(signedAtDate),
        location: signedInPerson.location || effectiveClinicDisplayName,
        globalUserId: patient?.patient_code || patient?.id || signedInPerson.id,
        signatureWebpUrl: signedInPerson.signatureImageUrl,
      };
    }

    return interpolateTermVariables(selectedTemplate.content, mergedValues, {
      signatures: Object.keys(signaturesPayload).length > 0 ? signaturesPayload : undefined,
    });
  }, [
    selectedTemplate,
    defaultKnownValues,
    adjustedKnownValues,
    customVariableValues,
    profile,
    user,
    signedInPerson,
    effectiveClinicDisplayName,
    patient,
  ]);

  const printTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (printTimerRef.current) clearTimeout(printTimerRef.current);
    };
  }, []);

  const handlePrint = () => {
    onPrinted?.();
    if (printTimerRef.current) clearTimeout(printTimerRef.current);
    printTimerRef.current = setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[92dvh] sm:max-h-[88dvh] flex flex-col p-0 overflow-hidden rounded-2xl bg-background border shadow-2xl z-50">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b bg-muted/30">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
              <ShieldCheck className="w-4 h-4 shrink-0 text-primary" />
              Gerador de Termos & Documentos Clínicos • Formatação A4
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-1">
              <div className="min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-primary shrink-0" />
                  <span>Gerar Documento com Variáveis</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                  Paciente: <span className="font-semibold text-foreground">{patientDisplayName}</span>
                  {patient?.cpf && ` • CPF: ${formatPatientCpf(patient.cpf)}`}
                </DialogDescription>
              </div>

              <div className="w-full sm:w-72 shrink-0">
                <Select
                  value={selectedTemplateId}
                  onValueChange={(val) => {
                    setSelectedTemplateId(val);
                    setCustomVariableValues({});
                    setSignedInPerson(null);
                  }}
                  disabled={loading}
                >
                  <SelectTrigger className="h-9 text-xs font-medium bg-background border-border">
                    <SelectValue placeholder="Selecione um modelo" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <SelectGroup>
                      <SelectLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Modelos Padrão do Sistema
                      </SelectLabel>
                      {availableTemplates
                        .filter((t) => !t.isCustom)
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">
                            {t.title}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                    {customTemplates.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Modelos Personalizados da Clínica
                        </SelectLabel>
                        {customTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">
                            {t.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "preview" | "variables" | "signature")}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="px-4 sm:px-6 pt-2 pb-0 border-b bg-muted/10 flex items-center justify-between gap-2 overflow-x-auto touch-pan-x">
              <TabsList className="h-9 bg-muted/60 p-0.5 shrink-0">
                <TabsTrigger value="preview" className="text-xs gap-1.5 px-3">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Pré-visualização A4</span>
                </TabsTrigger>
                <TabsTrigger value="variables" className="text-xs gap-1.5 px-3">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Ajustar Variáveis</span>
                  {customVariables.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">
                      {customVariables.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="signature" className="text-xs gap-1.5 px-3">
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Colher Assinatura</span>
                  {signedInPerson && (
                    <Badge className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-emerald-600 text-white">
                      Assinado
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {customVariables.length > 0 && activeTab === "preview" && (
                <button
                  type="button"
                  onClick={() => setActiveTab("variables")}
                  className="text-xs text-primary font-medium hover:underline flex items-center gap-1 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Preencher variáveis ({customVariables.length})</span>
                </button>
              )}
            </div>

            <TabsContent value="preview" className="flex-1 min-h-0 p-3 sm:p-6 overflow-y-auto overscroll-contain m-0 bg-muted/20">
              {loading ? (
                <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span>Carregando modelo e dados do paciente...</span>
                </div>
              ) : (
                <DocumentPreviewSheet
                  selectedTemplate={selectedTemplate}
                  patient={patient}
                  effectiveClinicDisplayName={effectiveClinicDisplayName}
                  clinicCnpj={clinicCnpj}
                  interpolatedMarkdown={interpolatedMarkdown}
                  customVariablesCount={customVariables.length}
                  collaboratorName={profile?.full_name || profile?.social_name}
                  collaboratorLicense={profile?.professional_license || profile?.council_name}
                  signedInPerson={signedInPerson}
                  onGoToVariables={() => setActiveTab("variables")}
                />
              )}
            </TabsContent>

            <TabsContent value="variables" className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto overscroll-contain m-0 space-y-6 bg-muted/10">
              <DocumentVariablesForm
                customVariables={customVariables}
                customVariableValues={customVariableValues}
                onCustomVariableChange={(k, v) =>
                  setCustomVariableValues((prev) => ({ ...prev, [k]: v }))
                }
                defaultKnownValues={defaultKnownValues}
                adjustedKnownValues={adjustedKnownValues}
                onAdjustedKnownChange={(k, v) =>
                  setAdjustedKnownValues((prev) => ({ ...prev, [k]: v }))
                }
                onResetAdjustedKnown={() => setAdjustedKnownValues({})}
                onGoToPreview={() => setActiveTab("preview")}
              />
            </TabsContent>

            <TabsContent value="signature" className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto overscroll-contain m-0 bg-muted/10">
              <DocumentSignatureChannelStep
                clinicId={effectiveClinicId}
                clinicDisplayName={effectiveClinicDisplayName}
                patient={patient}
                sessionId={sessionId}
                userId={user?.id}
                selectedTemplate={selectedTemplate}
                rawInterpolatedMarkdown={interpolatedMarkdown}
                signedInPerson={signedInPerson}
                onInPersonSigned={(snapshot) => setSignedInPerson(snapshot)}
                onPrintDocument={handlePrint}
                onGoToPreview={() => setActiveTab("preview")}
              />
            </TabsContent>
          </Tabs>

          <DialogFooter className="p-3 sm:p-4 border-t bg-muted/20 flex flex-col-reverse sm:flex-row gap-2 justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs min-h-[44px] sm:min-h-[36px]"
            >
              Fechar
            </Button>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {activeTab !== "signature" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab("signature")}
                  disabled={loading}
                  className="gap-2 font-semibold text-xs min-h-[44px] sm:min-h-[36px]"
                >
                  <PenTool className="w-4 h-4" />
                  <span>Colher Assinatura</span>
                </Button>
              )}
              <Button
                type="button"
                onClick={handlePrint}
                disabled={loading}
                className="gap-2 font-semibold shadow-sm text-xs min-h-[44px] sm:min-h-[36px]"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {signedInPerson
                    ? "Imprimir / Salvar PDF Assinado (A4)"
                    : "Imprimir / Salvar PDF (A4)"}
                </span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentPrintView
        open={open}
        selectedTemplate={selectedTemplate}
        patient={patient}
        clinicDisplayName={effectiveClinicDisplayName}
        clinicCnpj={clinicCnpj}
        interpolatedMarkdown={interpolatedMarkdown}
        collaboratorName={profile?.full_name || profile?.social_name}
        collaboratorLicense={profile?.professional_license || profile?.council_name}
        signedInPerson={signedInPerson}
      />
    </>
  );
};
