import React from "react";
import { Lock, ArrowUpRight, CheckCircle2, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { PLAN_PRICING_CONFIG } from "@/utils/subscriptionPricing";

export interface TrialReadOnlyModalProps {
  /** Se o modal está atualmente visível. */
  isOpen: boolean;
  /** Callback para fechamento do modal. */
  onClose: () => void;
  /** Identificador único da clínica ativa (UUID). */
  clinicId?: string | null;
  /** Descrição amigável da ação bloqueada que o usuário tentou executar (ex: "cadastrar novo paciente", "salvar evolução clínica"). */
  actionAttempted?: string;
}

/**
 * Modal Interceptador de Escrita em Modo Somente Leitura (Strict Read-Only Enforcement).
 *
 * Racional de Negócio & Salvaguarda Ética:
 * 1. Interceptação Preventiva de Mutação:
 *    - Quando o usuário tenta criar ou editar dados clínicos essenciais (pacientes, sessões, formulários)
 *      em um espaço com degustação esgotada ou assinatura vencida, este modal é acionado.
 * 2. Garantia de Inviolabilidade de Dados:
 *    - Tranquiliza o profissional de saúde de que seu histórico está 100% íntegro e preservado,
 *      reafirmando a conformidade legal do sistema com CFM e LGPD.
 * 3. Efeito Ancoragem & Conversão Transparente:
 *    - Exibe os valores transparentes de entrada para os 3 tiers oficiais (Solo, Clínica Pro e Enterprise)
 *      e direciona diretamente para a tela de contratação de planos.
 *
 * Complexidade Assintótica:
 * - Tempo: O(1)
 * - Espaço: O(1)
 */
export const TrialReadOnlyModal: React.FC<TrialReadOnlyModalProps> = React.memo(({
  isOpen,
  onClose,
  clinicId,
  actionAttempted = "criar ou modificar dados",
}) => {
  const navigate = useNavigate();

  const handleGoToPlans = () => {
    onClose();
    if (clinicId) {
      navigate(`/planos?clinicId=${clinicId}`);
    } else {
      navigate("/planos");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-popover border text-popover-foreground sm:max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="text-center sm:text-left space-y-3">
          <div className="mx-auto sm:mx-0 w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
            <Lock className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Badge variant="outline" className="border-red-500/40 text-red-400 bg-red-500/10 text-[10px] font-bold uppercase tracking-wider">
                Modo Somente Leitura Ativo
              </Badge>
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-extrabold text-foreground">
              Acesso de Escrita Bloqueado
            </DialogTitle>
          </div>

          <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Seu período de teste ou degustação gratuita foi concluído. Não é permitido {actionAttempted} enquanto o espaço estiver no modo somente leitura.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-3 rounded-2xl bg-muted/40 border border-border p-4 text-xs">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldAlert className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Seus dados clínicos estão 100% seguros</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Todos os pacientes, prontuários, evoluções e anamneses já registrados permanecem preservados e podem ser consultados normalmente a qualquer momento.
          </p>

          <div className="pt-2 border-t border-border space-y-1.5 text-foreground/90">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Plano Solo: R$ {PLAN_PRICING_CONFIG.solo.annual.monthlyEq.toFixed(2)}/mês (anual)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Plano Clínica Pro: 4 assentos inclusos por R$ {PLAN_PRICING_CONFIG.clinic.annual.baseMonthlyEq.toFixed(2)}/mês</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span>Plano Enterprise: 10 assentos por R$ {PLAN_PRICING_CONFIG.enterprise.annual.baseMonthlyEq.toFixed(2)}/mês</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="rounded-xl text-xs text-muted-foreground hover:text-foreground min-h-[44px]"
          >
            Continuar em Modo Leitura
          </Button>
          <Button
            type="button"
            onClick={handleGoToPlans}
            className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground min-h-[44px] flex items-center gap-1.5 shadow-md"
          >
            <span>Ver Planos e Assinar</span>
            <ArrowUpRight className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

TrialReadOnlyModal.displayName = "TrialReadOnlyModal";

export default TrialReadOnlyModal;
