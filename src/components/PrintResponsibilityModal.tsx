import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  safeRestoreBodyPointerEvents,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Printer, XCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import defaultPrintTermsMarkdown from "@/assets/print-terms-of-responsibility.md?raw";
import type { TermsConfigPayload } from "@/components/TermsConfigModal";

// Module-level cache for remote terms (O(1) retrieval, avoids redundant network queries & UI flicker)
let cachedTermsContent: string | null = null;

export interface PrintResponsibilityModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  documentTitle?: string;
}

/**
 * Sanitiza rigorosamente títulos e referências a documentos antes da renderização,
 * eliminando tags HTML, sequências de injeção XSS e caracteres de formatação Markdown.
 */
export function sanitizeDocumentTitle(title?: string): string {
  if (!title || typeof title !== "string") {
    return "dados da plataforma";
  }

  const sanitized = Array.from(title)
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;

      // Replace C0 controls, DEL, and C1 controls with spaces.
      return (
        codePoint <= 0x1f ||
        (codePoint >= 0x7f && codePoint <= 0x9f)
      )
        ? " "
        : character;
    })
    .join("");

  return (
    sanitized
      .replace(/<[^>]*>/g, "")
      .replace(/[\\`*_{}[\]()#+\-.!<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100) || "dados da plataforma"
  );
}

// Sanitização de links renderizados no ReactMarkdown
const markdownComponents = {
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const isSafe = href && (/^https?:\/\//i.test(href) || /^mailto:/i.test(href));
    if (!isSafe) {
      return <span className="underline decoration-dotted">{children}</span>;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

export const PrintResponsibilityModal: React.FC<PrintResponsibilityModalProps> = React.memo(
  function PrintResponsibilityModal({
    isOpen,
    onConfirm,
    onCancel,
    documentTitle = "dados da plataforma",
  }: PrintResponsibilityModalProps) {
    const [accepted, setAccepted] = useState(false);
    const [termsContent, setTermsContent] = useState<string>(
      () => cachedTermsContent || defaultPrintTermsMarkdown
    );
    const [loading, setLoading] = useState(false);

    const safeDocumentTitle = useMemo(() => sanitizeDocumentTitle(documentTitle), [documentTitle]);

    const handleClose = useCallback(() => {
      setAccepted(false);
      safeRestoreBodyPointerEvents();
      onCancel();
    }, [onCancel]);

    const handleConfirm = useCallback(() => {
      // Estrita verificação booleana LGPD antes de invocar onConfirm
      if (accepted !== true) {
        console.warn("[PrintResponsibilityModal] Bloqueio LGPD: Aceite obrigatório não confirmado.");
        return;
      }
      setAccepted(false);
      safeRestoreBodyPointerEvents();
      onConfirm();
    }, [accepted, onConfirm]);

    useEffect(() => {
      if (!isOpen) {
        setAccepted(false);
        safeRestoreBodyPointerEvents();
        return;
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          handleClose();
        }
      };

      window.addEventListener("keydown", handleKeyDown);

      let isMounted = true;

      // Se já temos em cache, não re-exibimos spinner para evitar layout shift
      if (!cachedTermsContent) {
        setLoading(true);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 3000);

      const loadTerms = async () => {
        try {
          const query = supabase
            .from("feature_flags")
            .select("value")
            .eq("key", "terms_of_service_management");

          const queryWithSignal =
            typeof (query as { abortSignal?: (signal: AbortSignal) => typeof query }).abortSignal === "function"
              ? (query as { abortSignal: (signal: AbortSignal) => typeof query }).abortSignal(controller.signal)
              : query;

          const { data, error } = await queryWithSignal.maybeSingle();

          if (error) {
            console.warn(
              "[PrintResponsibilityModal] Erro ou restrição ao carregar termos remotos, aplicando fallback padrão:",
              error.message
            );
          }

          const payload = (data?.value || {}) as TermsConfigPayload;
          const customContent = payload.print_terms?.content;
          const finalContent = customContent?.trim() ? customContent : defaultPrintTermsMarkdown;

          cachedTermsContent = finalContent;
          if (isMounted) {
            setTermsContent(finalContent);
          }
        } catch {
          // Trata aborto por timeout ou falha de rede sem travar o modal
          if (isMounted && !cachedTermsContent) {
            setTermsContent(defaultPrintTermsMarkdown);
          }
        } finally {
          clearTimeout(timeoutId);
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      void loadTerms();

      return () => {
        isMounted = false;
        clearTimeout(timeoutId);
        controller.abort();
        window.removeEventListener("keydown", handleKeyDown);
        safeRestoreBodyPointerEvents();
      };
    }, [isOpen, handleClose]);

    return (
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && isOpen) handleClose();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl bg-background border shadow-2xl z-50">
          <DialogHeader className="relative p-4 sm:p-6 pb-4 border-b bg-amber-500/10">
            <div className="flex items-center gap-2 text-amber-600 font-semibold text-xs tracking-wider uppercase">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
              LGPD & Proteção de Dados Sensíveis
            </div>
            <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground mt-1 flex items-center gap-2 pr-12">
              <Printer className="w-5 h-5 text-primary shrink-0" />
              <span>Termo de Responsabilidade para Impressão</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pr-12">
              Você está prestes a imprimir <strong>{safeDocumentTitle}</strong>. Leia atentamente as condições de privacidade antes de prosseguir.
            </DialogDescription>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar modal"
              className="absolute right-2 top-2 sm:right-3 sm:top-3 h-11 w-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <XCircle className="h-5 w-5" />
              <span className="sr-only">Fechar modal</span>
            </button>
          </DialogHeader>

          <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-3">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
                Carregando termos de responsabilidade...
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none p-3.5 sm:p-4 rounded-xl border bg-card/60 text-xs leading-relaxed">
                <ReactMarkdown components={markdownComponents}>{termsContent}</ReactMarkdown>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6 pt-3 border-t bg-muted/10 space-y-3 sm:space-y-4">
            <div className="flex items-start space-x-3 bg-card p-3 rounded-xl border shadow-sm">
              <Checkbox
                id="print-terms-check"
                checked={accepted}
                onCheckedChange={(checked) => setAccepted(checked === true)}
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
                disabled={!accepted || loading}
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
);

export default PrintResponsibilityModal;
