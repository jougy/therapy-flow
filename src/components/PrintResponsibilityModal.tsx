import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Printer, XCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import defaultPrintTermsMarkdown from "@/assets/print-terms-of-responsibility.md?raw";
import type { TermsConfigPayload } from "@/components/TermsConfigModal";

interface PrintResponsibilityModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  documentTitle?: string;
}

export function PrintResponsibilityModal({
  isOpen,
  onConfirm,
  onCancel,
  documentTitle = "dados da plataforma",
}: PrintResponsibilityModalProps) {
  const [accepted, setAccepted] = useState(false);
  const [termsContent, setTermsContent] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setAccepted(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const loadTerms = async () => {
      try {
        const { data } = await supabase
          .from("feature_flags")
          .select("value")
          .eq("key", "terms_of_service_management")
          .single();

        const payload = (data?.value || {}) as TermsConfigPayload;
        const customContent = payload.print_terms?.content;

        if (isMounted) {
          setTermsContent(customContent || defaultPrintTermsMarkdown);
        }
      } catch {
        if (isMounted) {
          setTermsContent(defaultPrintTermsMarkdown);
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
  }, [isOpen]);

  const handleConfirm = () => {
    if (!accepted) return;
    onConfirm();
  };

  const handleClose = () => {
    setAccepted(false);
    onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-background border shadow-2xl z-50">
        <DialogHeader className="p-6 pb-4 border-b bg-amber-500/10">
          <div className="flex items-center gap-2 text-amber-600 font-semibold text-xs tracking-wider uppercase">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
            LGPD & Proteção de Dados Sensíveis
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground mt-1 flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            Termo de Responsabilidade para Impressão
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Você está prestes a imprimir <strong>{documentTitle}</strong>. Leia atentamente as condições de privacidade antes de prosseguir.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
              Carregando termos de responsabilidade...
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none p-3.5 sm:p-4 rounded-xl border bg-card/60 text-xs leading-relaxed">
              <ReactMarkdown>{termsContent}</ReactMarkdown>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 pt-3 border-t bg-muted/10 space-y-3 sm:space-y-4">
          <div className="flex items-start space-x-3 bg-card p-3 rounded-xl border shadow-sm">
            <Checkbox
              id="print-terms-check"
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(!!checked)}
              className="mt-0.5 shrink-0"
            />
            <Label htmlFor="print-terms-check" className="text-xs font-medium leading-relaxed cursor-pointer text-foreground">
              Declaro que li, compreendo e aceito a responsabilidade exclusiva pela guarda, manuseio seguro e eventual descarte físico dos documentos impressos.
            </Label>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground w-full sm:w-auto"
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              Cancelar impressão
            </Button>

            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!accepted}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 w-full sm:w-auto"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Aceitar e Imprimir
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PrintResponsibilityModal;
