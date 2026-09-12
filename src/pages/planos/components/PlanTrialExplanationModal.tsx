import React from "react";
import { Sparkles, Clock, ShieldAlert, CheckCircle2, HeartHandshake, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface PlanTrialExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan?: (planId: "solo" | "clinic" | "enterprise") => void;
}

/**
 * Modal explicativo detalhado sobre o funcionamento da Degustação Gratuita e regras do Modo Leitura.
 */
export const PlanTrialExplanationModal: React.FC<PlanTrialExplanationModalProps> = ({
  isOpen,
  onClose,
  onSelectPlan,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="space-y-1.5 text-left pb-2 border-b border-border/60">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold w-fit">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Transparência e Respeito Ético</span>
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            Como funciona o Teste Gratuito (7 dias)?
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Entenda como experimentar a plataforma com sua equipe e o que acontece após o período de teste.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-3 text-xs sm:text-sm text-muted-foreground">
          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-foreground space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400 text-xs sm:text-sm">
              <Clock className="w-4 h-4" />
              <span>Cotas Inclusas no Período de Teste (7 Dias ou 20 Atendimentos)</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Durante o teste gratuito, você tem acesso imediato para validar os recursos na prática:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Até <strong>4 acessos simultâneos</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Até <strong>20 atendimentos clínicos</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Até <strong>5 pacientes cadastrados</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span><strong>1 formulário personalizado extra</strong></span>
              </li>
            </ul>
          </div>

          <div className="p-3.5 rounded-xl bg-card/60 dark:bg-neutral-900/40 border border-border space-y-2 text-foreground">
            <div className="flex items-center gap-2 font-bold text-foreground text-xs sm:text-sm">
              <Eye className="w-4 h-4 text-primary" />
              <span>O que acontece após os 7 dias ou atingir as 20 sessões?</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sua conta entra automaticamente em <strong>Modo Leitura</strong>:
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>Apenas o <strong>titular/proprietário</strong> do espaço tem permissão de acesso ao sistema.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Garantia Ética CFM/CFP e LGPD:</strong> Você nunca perde o acesso aos seus prontuários e históricos médicos já registrados. Eles permanecem legíveis para sempre.</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>Novas edições, cadastros de pacientes e novos atendimentos ficam pausados até a contratação de um plano.</span>
              </li>
            </ul>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border/50">
            <HeartHandshake className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Sem fidelidade, sem pegadinhas e sem necessidade de cartão para começar a testar.</span>
          </div>
        </div>

        <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs h-9">
            Entendido
          </Button>
          {onSelectPlan && (
            <Button
              size="sm"
              onClick={() => {
                onClose();
                onSelectPlan("clinic");
              }}
              className="rounded-xl text-xs h-9 bg-primary text-primary-foreground font-semibold"
            >
              Começar Teste Gratuito
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
