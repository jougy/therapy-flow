import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, ShieldAlert, CheckCircle2, FileText, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import defaultMinorTermsMarkdown from "@/assets/minor-terms-of-responsibility.md?raw";
import type { TermsConfigPayload } from "@/components/TermsConfigModal";
import type { SharePatientData } from "@/components/patients/SharePatientRegistrationModal";
import { formatPatientCpf, formatPatientPhone } from "@/lib/patient-registration";
import { toast } from "@/hooks/use-toast";

interface PrintGuardianConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: SharePatientData | null;
  clinicId?: string | null;
  clinicName?: string;
  onPrinted?: () => void;
}

export const PrintGuardianConsentModal: React.FC<PrintGuardianConsentModalProps> = ({
  open,
  onOpenChange,
  patient,
  clinicId,
  clinicName = "Pluri-Health",
  onPrinted,
}) => {
  const [termsContent, setTermsContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setLoading(true);

    const loadTerms = async () => {
      try {
        // Camada 1: Termo customizado da Clínica (se houver clinicId ou patient.clinic_id)
        const targetClinicId = clinicId || (patient as { clinic_id?: string })?.clinic_id;
        if (targetClinicId) {
          const { data: clinicData } = await supabase
            .from("clinics")
            .select("custom_fields")
            .eq("id", targetClinicId)
            .maybeSingle();

          const custom = (clinicData?.custom_fields || {}) as Record<string, unknown>;
          const clinicTerms = (custom.clinic_terms || {}) as {
            minor_terms?: { content?: string };
          };

          if (clinicTerms.minor_terms?.content && isMounted) {
            setTermsContent(clinicTerms.minor_terms.content);
            setLoading(false);
            return;
          }
        }

        // Camada 2: Termo customizado no Backoffice (feature_flags global)
        const { data } = await supabase
          .from("feature_flags")
          .select("value")
          .eq("key", "terms_of_service_management")
          .single();

        const payload = (data?.value || {}) as TermsConfigPayload;
        const backofficeContent = payload.minor_terms?.content || payload.minor_consent?.content;

        if (isMounted) {
          // Camada 3: Asset padrão embarcado
          setTermsContent(backofficeContent || defaultMinorTermsMarkdown);
        }
      } catch {
        if (isMounted) {
          // Camada 3: Fallback seguro
          setTermsContent(defaultMinorTermsMarkdown);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadTerms();

    return () => {
      isMounted = false;
    };
  }, [open, clinicId, patient]);

  const handlePrint = async () => {
    if (!patient?.id) return;
    setUpdatingStatus(true);

    try {
      // Atualiza o status do consentimento para 'printed'
      const consentPayload = {
        status: "printed",
        method: "paper",
        paper_printed_at: new Date().toISOString(),
        responsible_name: patient.responsible_name || null,
        responsible_relationship: patient.responsible_relationship || null,
        responsible_cpf: patient.responsible_cpf || (patient.cpf && patient.responsible_name ? patient.cpf : null),
      };

      await supabase.rpc("update_patient_guardian_consent", {
        _patient_id: patient.id,
        _consent_payload: consentPayload,
      });

      toast({
        title: "Status atualizado: Termo Impresso",
        description: "Registrado como Pendente de Assinatura Física no prontuário.",
      });

      onPrinted?.();
    } catch (err) {
      console.warn("Não foi possível atualizar o status no banco:", err);
    } finally {
      setUpdatingStatus(false);
      // Dispara a impressão do navegador
      setTimeout(() => {
        window.print();
      }, 150);
    }
  };

  const formattedDob = patient?.date_of_birth
    ? new Date(`${patient.date_of_birth}T12:00:00`).toLocaleDateString("pt-BR")
    : "Não informada";

  const guardianCpf = patient?.responsible_cpf || (patient?.cpf && patient?.responsible_name ? patient.cpf : "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-background border shadow-2xl z-50">
        <DialogHeader className="p-6 pb-4 border-b bg-amber-500/10">
          <div className="flex items-center gap-2 text-amber-600 font-semibold text-xs tracking-wider uppercase">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
            Conformidade LGPD (Art. 14) • Impressão A4
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground mt-1 flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            Termo de Consentimento do Responsável (Menor de Idade)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Imprima o termo formatado em padrão A4 para coleta presencial de assinatura com caneta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-4 bg-muted/20">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span>Carregando documento de consentimento...</span>
            </div>
          ) : (
            <div
              id="guardian-consent-print-sheet"
              className="bg-card p-6 sm:p-8 rounded-xl border shadow-sm text-xs sm:text-sm text-foreground space-y-5 print:p-0 print:border-none print:shadow-none"
            >
              {/* Cabeçalho da Clínica */}
              <div className="border-b pb-4 text-center space-y-1">
                <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide text-primary">
                  {clinicName}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Termo de Consentimento Livre e Esclarecido para Tratamento de Dados de Menor
                </p>
                <p className="text-[11px] font-mono text-muted-foreground">
                  Art. 14 da Lei Federal nº 13.709/2018 (LGPD)
                </p>
              </div>

              {/* Quadro de Qualificação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg border bg-muted/30 text-xs">
                <div className="space-y-1">
                  <span className="font-semibold text-foreground uppercase tracking-wider text-[10px] text-muted-foreground block">
                    Dados do Paciente (Menor)
                  </span>
                  <p><strong>Nome:</strong> {patient?.name || "Não informado"}</p>
                  <p><strong>Data de Nascimento:</strong> {formattedDob}</p>
                  {patient?.cpf && <p><strong>CPF:</strong> {formatPatientCpf(patient.cpf)}</p>}
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-foreground uppercase tracking-wider text-[10px] text-muted-foreground block">
                    Dados do Responsável Legal
                  </span>
                  <p><strong>Nome:</strong> {patient?.responsible_name || "___________________________________"}</p>
                  <p><strong>Vínculo:</strong> {patient?.responsible_relationship || "Mãe / Pai / Tutor Legal"}</p>
                  {guardianCpf ? (
                    <p><strong>CPF:</strong> {formatPatientCpf(guardianCpf)}</p>
                  ) : (
                    <p><strong>CPF:</strong> ___________________________</p>
                  )}
                  {patient?.phone && <p><strong>Telefone:</strong> {formatPatientPhone(patient.phone)}</p>}
                </div>
              </div>

              {/* Corpo do Termo */}
              <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none text-xs leading-relaxed border-t pt-3">
                <ReactMarkdown>{termsContent}</ReactMarkdown>
              </div>

              {/* Linha de Assinatura */}
              <div className="border-t pt-8 mt-6 space-y-8">
                <div className="text-xs text-muted-foreground text-center">
                  Local e Data: _____________________________________, _____ de ____________________ de 20____
                </div>

                <div className="flex flex-col items-center justify-center space-y-1 pt-4">
                  <div className="w-72 border-b border-foreground/70" />
                  <p className="font-semibold text-xs text-center">
                    {patient?.responsible_name || "Assinatura do(a) Responsável Legal"}
                  </p>
                  <p className="text-[11px] text-muted-foreground text-center">
                    {patient?.responsible_relationship ? `Representante Legal (${patient.responsible_relationship})` : "Responsável Legal / Poder Familiar"}
                    {guardianCpf ? ` • CPF: ${formatPatientCpf(guardianCpf)}` : ""}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/10 flex flex-col-reverse sm:flex-row gap-2 justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
          <Button
            type="button"
            onClick={handlePrint}
            disabled={loading || updatingStatus}
            className="gap-2 font-semibold shadow-sm"
          >
            {updatingStatus ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            Imprimir Termo Físico (A4)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
