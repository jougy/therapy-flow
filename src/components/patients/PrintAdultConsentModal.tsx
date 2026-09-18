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
import { Printer, ShieldCheck, FileText, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import defaultAdultTermsMarkdown from "@/assets/adult-terms-of-consent.md?raw";
import type { TermsConfigPayload } from "@/components/TermsConfigModal";
import type { SharePatientData } from "@/components/patients/SharePatientRegistrationModal";
import { formatPatientCpf, formatPatientPhone } from "@/lib/patient-registration";

interface PrintAdultConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: SharePatientData | null;
  clinicId?: string | null;
  clinicName?: string;
  onPrinted?: () => void;
}

export const PrintAdultConsentModal: React.FC<PrintAdultConsentModalProps> = ({
  open,
  onOpenChange,
  patient,
  clinicId,
  clinicName = "Pluri-Health",
  onPrinted,
}) => {
  const [termsContent, setTermsContent] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setLoading(true);

    const loadTerms = async () => {
      try {
        // Camada 1: Resolução Clínica (se customizado pela clínica em clinics.custom_fields.clinic_terms)
        const targetClinicId = clinicId || (patient as { clinic_id?: string })?.clinic_id;
        if (targetClinicId) {
          const { data: clinicData } = await supabase
            .from("clinics")
            .select("custom_fields")
            .eq("id", targetClinicId)
            .maybeSingle();

          const custom = (clinicData?.custom_fields || {}) as Record<string, unknown>;
          const clinicTerms = (custom.clinic_terms || {}) as {
            adult_terms?: { content?: string };
          };

          if (clinicTerms.adult_terms?.content && isMounted) {
            setTermsContent(clinicTerms.adult_terms.content);
            setLoading(false);
            return;
          }
        }

        // Camada 2: Resolução Backoffice (feature_flags global terms_of_service_management)
        const { data } = await supabase
          .from("feature_flags")
          .select("value")
          .eq("key", "terms_of_service_management")
          .single();

        const payload = (data?.value || {}) as TermsConfigPayload;
        const backofficeContent = payload.adult_terms?.content;

        if (isMounted) {
          // Camada 3: Asset padrão embarcado
          setTermsContent(backofficeContent || defaultAdultTermsMarkdown);
        }
      } catch {
        if (isMounted) {
          // Camada 3: Fallback seguro
          setTermsContent(defaultAdultTermsMarkdown);
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

  const handlePrint = () => {
    onPrinted?.();
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const formattedDob = patient?.date_of_birth
    ? new Date(`${patient.date_of_birth}T12:00:00`).toLocaleDateString("pt-BR")
    : "Não informada";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-background border shadow-2xl z-50">
        <DialogHeader className="p-6 pb-4 border-b bg-emerald-500/10">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs tracking-wider uppercase">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
            Conformidade LGPD (Arts. 7º e 11) & Saúde (CFM 1.821/2007) • Impressão A4
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground mt-1 flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            Termo de Consentimento Livre e Esclarecido (Adulto)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Imprima o termo formatado em padrão A4 para coleta física de assinatura presencial.
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
              id="adult-consent-print-sheet"
              className="bg-card p-6 sm:p-8 rounded-xl border shadow-sm text-xs sm:text-sm text-foreground space-y-5 print:p-0 print:border-none print:shadow-none"
            >
              {/* Cabeçalho da Clínica */}
              <div className="border-b pb-4 text-center space-y-1">
                <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide text-primary">
                  {clinicName}
                </h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Termo de Consentimento Livre e Esclarecido (TCLE) & Normas Clínicas
                </p>
                <p className="text-[11px] font-mono text-muted-foreground">
                  LGPD Arts. 7º e 11 • Retenção de Prontuário CFM nº 1.821/2007 (20 anos)
                </p>
              </div>

              {/* Quadro de Qualificação do Paciente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg border bg-muted/30 text-xs">
                <div className="space-y-1">
                  <span className="font-semibold text-foreground uppercase tracking-wider text-[10px] text-muted-foreground block">
                    Identificação do Paciente
                  </span>
                  <p><strong>Nome Completo:</strong> {patient?.name || "Não informado"}</p>
                  <p><strong>Data de Nascimento:</strong> {formattedDob}</p>
                  {patient?.cpf && <p><strong>CPF:</strong> {formatPatientCpf(patient.cpf)}</p>}
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-foreground uppercase tracking-wider text-[10px] text-muted-foreground block">
                    Contatos & Registro
                  </span>
                  {patient?.phone ? (
                    <p><strong>Telefone:</strong> {formatPatientPhone(patient.phone)}</p>
                  ) : (
                    <p><strong>Telefone:</strong> ___________________________</p>
                  )}
                  {patient?.email && <p><strong>E-mail:</strong> {patient.email}</p>}
                  {patient?.patient_code && <p><strong>Prontuário:</strong> {patient.patient_code}</p>}
                </div>
              </div>

              {/* Corpo do Termo */}
              <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none text-xs leading-relaxed border-t pt-3">
                <ReactMarkdown>{termsContent}</ReactMarkdown>
              </div>

              {/* Linha de Assinatura com caneta */}
              <div className="border-t pt-8 mt-6 space-y-8">
                <div className="text-xs text-muted-foreground text-center">
                  Local e Data: _____________________________________, _____ de ____________________ de 20____
                </div>

                <div className="flex flex-col items-center justify-center space-y-1 pt-4">
                  <div className="w-72 border-b border-foreground/70" />
                  <p className="font-semibold text-xs text-center">
                    {patient?.name || "Assinatura do(a) Paciente"}
                  </p>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Titular dos Dados
                    {patient?.cpf ? ` • CPF: ${formatPatientCpf(patient.cpf)}` : ""}
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
            disabled={loading}
            className="gap-2 font-semibold shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimir Termo Físico (A4)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
