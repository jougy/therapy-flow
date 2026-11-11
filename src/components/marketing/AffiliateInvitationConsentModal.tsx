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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Building2, ShieldCheck, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export interface AffiliateInvitationConsentModalProps {
  invitationId?: string;
  clinicName: string;
  isOpen: boolean;
  onClose: () => void;
  onRespond: (action: "accepted" | "rejected") => Promise<void>;
}

export function AffiliateInvitationConsentModal({
  invitationId: _invitationId,
  clinicName,
  isOpen,
  onClose,
  onRespond,
}: AffiliateInvitationConsentModalProps) {
  const [isAgreed, setIsAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<"accepted" | "rejected" | null>(null);

  // Reseta estado quando o modal fecha ou reabre
  useEffect(() => {
    if (!isOpen) {
      setIsAgreed(false);
      setIsSubmitting(false);
      setActiveAction(null);
    }
  }, [isOpen]);

  const handleRespond = async (action: "accepted" | "rejected") => {
    if (action === "accepted" && !isAgreed) return;

    setIsSubmitting(true);
    setActiveAction(action);
    try {
      await onRespond(action);
    } finally {
      setIsSubmitting(false);
      setActiveAction(null);
    }
  };

  const handleDecideLater = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDecideLater()}>
      <DialogContent
        className="w-full max-w-lg min-w-0 overflow-x-hidden p-0 rounded-2xl border bg-background shadow-2xl flex flex-col max-h-[90dvh]"
        data-testid="affiliate-consent-modal"
      >
        <DialogHeader className="p-5 pb-4 border-b bg-muted/20 text-left space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary w-fit">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span>Convite Institucional</span>
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            Convite para Programa de Afiliados de {clinicName}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Você foi convidado a integrar a equipe de afiliados desta clínica parceira com governança transparente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4 text-sm min-w-0 max-w-full">
          {/* Resumo Executivo */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs sm:text-sm">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Resumo das Condições de Transição</span>
            </div>
            <ul className="space-y-2.5 text-xs sm:text-sm text-foreground/90">
              <li className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Pausa Institucional:</strong> Ao aceitar gerir os afiliados da clínica, sua afiliação
                  pessoal entra em pausa/congelamento institucional temporário.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Janela de Resgate (40 Dias):</strong> Direito de reversão garantido em até 40 dias (ou até
                  a renovação da fatura do cliente) caso você decida retornar ao contexto anterior, com integridade
                  total dos seus splits.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>Comissões e Repasses:</strong> Toda comissão é creditada de acordo com as regras
                  acordadas com a clínica parceira e repassada automaticamente.
                </span>
              </li>
            </ul>
          </div>

          {/* Sanfona Expansível de Termos */}
          <Accordion type="single" collapsible className="w-full border rounded-xl px-4 py-1 bg-muted/10">
            <AccordionItem value="full-terms" className="border-none">
              <AccordionTrigger className="text-xs sm:text-sm font-medium py-3 text-muted-foreground hover:text-foreground">
                Ler Termos Completos e Governança
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-3 pt-1 pb-3 leading-relaxed">
                <div>
                  <h4 className="font-semibold text-foreground">Cláusula 1ª - Representação Institucional</h4>
                  <p>
                    O usuário aceita representar o programa de afiliados sob a bandeira e governança da clínica anfitriã,
                    seguindo as diretrizes e regras de conformidade da instituição.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Cláusula 2ª - Congelamento e Pausa de Carteira</h4>
                  <p>
                    Captações anteriores do usuário entram no estado temporário de suspensão/carência
                    (temporary_pause_with_grace_period), preservando vínculos até a consolidação da parceria.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Cláusula 3ª-A - Janela de Resgate (D+40)</h4>
                  <p>
                    Fica assegurada a janela de resgate irrevogável de até 40 dias corridos ou até a primeira renovação
                    de fatura de clientes indicados. Se houver descontinuidade antes deste marco, a carteira retorna
                    integralmente ao titular com seus splits preservados.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Cláusula 4ª - Split e Repasses</h4>
                  <p>
                    As comissões geradas no âmbito da clínica anfitriã serão processadas via divisão de recebíveis
                    conforme parâmetros estabelecidos pela administração da clínica.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Checkbox de Consentimento Obrigatório */}
          <div
            className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors min-h-[44px] cursor-pointer"
            onClick={() => !isSubmitting && setIsAgreed((prev) => !prev)}
            role="presentation"
          >
            <Checkbox
              id="affiliate-consent-checkbox"
              checked={isAgreed}
              onCheckedChange={(checked) => setIsAgreed(Boolean(checked))}
              disabled={isSubmitting}
              className="mt-0.5 shrink-0"
              data-testid="affiliate-consent-checkbox"
              onClick={(e) => e.stopPropagation()}
            />
            <Label
              htmlFor="affiliate-consent-checkbox"
              className="text-xs sm:text-sm font-medium leading-relaxed select-none cursor-pointer text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              Li e concordo com os termos de consentimento e transição de carteira (incluindo o congelamento temporário
              e a janela de resgate de 40 dias).
            </Label>
          </div>
        </div>

        {/* Rodapé com 3 Botões Touch-Friendly (>= 44px) */}
        <DialogFooter className="p-4 sm:p-5 border-t bg-muted/20 flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-between items-stretch sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto min-h-[44px] h-11 text-xs sm:text-sm"
            onClick={handleDecideLater}
            disabled={isSubmitting}
            data-testid="btn-decide-later"
          >
            Decidir mais tarde
          </Button>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto min-h-[44px] h-11 text-xs sm:text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleRespond("rejected")}
              disabled={isSubmitting}
              data-testid="btn-reject-invitation"
            >
              {isSubmitting && activeAction === "rejected" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Recusando...</span>
                </>
              ) : (
                "Recusar convite"
              )}
            </Button>

            <Button
              type="button"
              variant="default"
              className="w-full sm:w-auto min-h-[44px] h-11 text-xs sm:text-sm font-semibold"
              onClick={() => handleRespond("accepted")}
              disabled={!isAgreed || isSubmitting}
              data-testid="btn-accept-invitation"
            >
              {isSubmitting && activeAction === "accepted" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Aceitando...</span>
                </>
              ) : (
                "Aceitar convite"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
