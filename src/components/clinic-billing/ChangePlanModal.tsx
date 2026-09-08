import React from "react";
import { UserRound, Building2, Sparkles, CheckCircle2, Plus, CreditCard, AlertCircle, Loader2, Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BillingCycle, PlanPriceCalculation } from "@/utils/subscriptionPricing";

export interface ChangePlanModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  targetCycle: BillingCycle;
  onCycleChange: (cycle: BillingCycle) => void;
  targetPlan: "solo" | "clinic" | "enterprise";
  onPlanChange: (plan: "solo" | "clinic" | "enterprise") => void;
  currentPlan?: "solo" | "clinic" | "enterprise";
  currentCycle?: BillingCycle;
  hasActiveRecurringCard?: boolean;
  extraConcurrentCount: number;
  activeCollaboratorsCount: number;
  submitting: boolean;
  onConfirmChangePlan: () => void;
  onNavigateToCheckout: () => void;
  modalPricingSolo: PlanPriceCalculation;
  modalPricingClinic: PlanPriceCalculation;
  modalPricingEnterprise: PlanPriceCalculation;
}

/**
 * Modal de Alteração de Plano (Upgrade / Downgrade com Seleção de Ciclo).
 *
 * Racional de Negócio & Salvaguardas:
 * - Trava de segurança contra perda de dados: impede downgrade para "Solo" se a clínica
 *   possuir colaboradores ativos cadastrados.
 * - Elimina conflito de botões: clientes com cartão recorrente ativo podem confirmar alteração imediata;
 *   clientes em Degustação, PIX ou sem cartão ativo são guiados diretamente ao checkout seguro.
 * - Amplo espaço visual (sm:max-w-4xl) e compatibilidade com scroll mobile.
 *
 * Complexidade Assintótica: O(1) de tempo e espaço.
 */
export const ChangePlanModal: React.FC<ChangePlanModalProps> = React.memo(({
  isOpen,
  onOpenChange,
  targetCycle,
  onCycleChange,
  targetPlan,
  onPlanChange,
  currentPlan,
  currentCycle,
  hasActiveRecurringCard = false,
  extraConcurrentCount,
  activeCollaboratorsCount,
  submitting,
  onConfirmChangePlan,
  onNavigateToCheckout,
  modalPricingSolo,
  modalPricingClinic,
  modalPricingEnterprise,
}) => {
  const isSamePlanAndCycle = Boolean(
    currentPlan &&
    currentCycle &&
    targetPlan === currentPlan &&
    targetCycle === currentCycle
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border text-popover-foreground sm:max-w-4xl rounded-2xl max-h-[90dvh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Alterar Plano de Assinatura
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Escolha o plano e o ciclo ideais para expandir o potencial e a equipe da sua clínica.
          </DialogDescription>
        </DialogHeader>

        {/* Seletor de Ciclo com Destaque de Economia */}
        <div className="flex justify-center my-3">
          <div className="p-1.5 bg-muted/80 rounded-2xl inline-flex items-center gap-1.5 border">
            <button
              type="button"
              onClick={() => onCycleChange("monthly")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all min-h-[36px] ${
                targetCycle === "monthly"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => onCycleChange("quarterly")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all min-h-[36px] flex items-center gap-1.5 ${
                targetCycle === "quarterly"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Trimestral</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">
                -10%
              </span>
            </button>
            <button
              type="button"
              onClick={() => onCycleChange("annual")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all min-h-[36px] flex items-center gap-1.5 ${
                targetCycle === "annual"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Anual</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">
                -25% Economia
              </span>
            </button>
          </div>
        </div>

        {/* Grid de Planos - 3 Colunas Espaçosas no Desktop, 1 Coluna Fluida no Mobile */}
        <div className="grid gap-4 py-2 grid-cols-1 sm:grid-cols-3">
          {/* Card 1: Plano Solo */}
          <div
            onClick={() => onPlanChange("solo")}
            className={`cursor-pointer rounded-2xl p-4 border transition-all flex flex-col justify-between relative ${
              targetPlan === "solo"
                ? "border-emerald-500 bg-emerald-500/5 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20"
                : "border-border bg-card hover:border-neutral-400 dark:hover:border-neutral-700"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <UserRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-foreground">Profissional Solo</h4>
                    <p className="text-xs text-muted-foreground">Atendimento individual</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                {currentPlan === "solo" && currentCycle === targetCycle && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                    Plano Atual
                  </Badge>
                )}
                {targetPlan === "solo" && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold">
                    Selecionado
                  </Badge>
                )}
              </div>

              <div className="mb-3">
                <div className="text-2xl font-black text-foreground">
                  R$ {modalPricingSolo.monthlyEquivalent.toFixed(2)}
                  <span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cobrado R$ {modalPricingSolo.periodTotal.toFixed(2)} por {modalPricingSolo.periodLabel}
                </p>
              </div>

              <ul className="text-xs text-muted-foreground space-y-2 border-t border-border pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>1 Profissional titular</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>1 Acesso simultâneo</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Prontuários e agendas ilimitados</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Card 2: Plano Clínica Pro */}
          <div
            onClick={() => onPlanChange("clinic")}
            className={`cursor-pointer rounded-2xl p-4 border transition-all flex flex-col justify-between relative ${
              targetPlan === "clinic"
                ? "border-blue-500 bg-blue-500/5 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/20"
                : "border-border bg-card hover:border-neutral-400 dark:hover:border-neutral-700"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-foreground">Clínica Pro</h4>
                    <p className="text-xs text-muted-foreground">Equipes e consultórios</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                {currentPlan === "clinic" && currentCycle === targetCycle && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] font-bold">
                    Plano Atual
                  </Badge>
                )}
                {targetPlan === "clinic" && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold">
                    Selecionado
                  </Badge>
                )}
              </div>

              <div className="mb-3">
                <div className="text-2xl font-black text-foreground">
                  R$ {modalPricingClinic.monthlyEquivalent.toFixed(2)}
                  <span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cobrado R$ {modalPricingClinic.periodTotal.toFixed(2)} por {modalPricingClinic.periodLabel}
                </p>
              </div>

              <ul className="text-xs text-muted-foreground space-y-2 border-t border-border pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>Colaboradores ilimitados</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>
                    <strong>{4 + (targetPlan === "clinic" ? extraConcurrentCount : 0)} Acessos simultâneos</strong> (base 4)
                  </span>
                </li>
                <li className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>Acessos extras: +R$ 25/mês</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Card 3: Plano Enterprise */}
          <div
            onClick={() => onPlanChange("enterprise")}
            className={`cursor-pointer rounded-2xl p-4 border transition-all flex flex-col justify-between relative ${
              targetPlan === "enterprise"
                ? "border-purple-500 bg-purple-500/5 shadow-md shadow-purple-500/10 ring-2 ring-purple-500/20"
                : "border-border bg-card hover:border-neutral-400 dark:hover:border-neutral-700"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-foreground">Enterprise</h4>
                    <p className="text-xs text-muted-foreground">Alta escala e policlínicas</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                {currentPlan === "enterprise" && currentCycle === targetCycle && (
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] font-bold">
                    Plano Atual
                  </Badge>
                )}
                {targetPlan === "enterprise" && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold">
                    Selecionado
                  </Badge>
                )}
              </div>

              <div className="mb-3">
                <div className="text-2xl font-black text-foreground">
                  R$ {modalPricingEnterprise.monthlyEquivalent.toFixed(2)}
                  <span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cobrado R$ {modalPricingEnterprise.periodTotal.toFixed(2)} por {modalPricingEnterprise.periodLabel}
                </p>
              </div>

              <ul className="text-xs text-muted-foreground space-y-2 border-t border-border pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Até 100 colaboradores</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>
                    <strong>{10 + (targetPlan === "enterprise" ? extraConcurrentCount : 0)} Acessos simultâneos</strong> (base 10)
                  </span>
                </li>
                <li className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold">
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>Acessos extras: +R$ 15/mês (-40% OFF)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Alerta de Downgrade Bloqueado se houver colaboradores ativos */}
        {targetPlan === "solo" && activeCollaboratorsCount > 0 && (
          <Alert variant="destructive" className="rounded-xl my-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-semibold text-sm">Bloqueio de Downgrade</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              Sua clínica possui <strong>{activeCollaboratorsCount} colaborador(es) ativo(s)</strong>. Para alterar para o plano Solo, você precisa primeiro remover ou desativar os colaboradores na aba de membros.
            </AlertDescription>
          </Alert>
        )}

        {/* Box Informativo de Contexto Financeiro */}
        <div className="rounded-xl border bg-muted/40 p-3.5 flex items-start gap-3 my-2 text-xs">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-muted-foreground">
            {hasActiveRecurringCard ? (
              <p>
                <strong className="text-foreground font-semibold">Assinatura com Cartão Recorrente:</strong> Ao confirmar, o novo plano será atualizado diretamente no Asaas e a cobrança proporcional será refletida na sua próxima fatura, sem necessidade de reinserir o cartão.
              </p>
            ) : (
              <p>
                <strong className="text-foreground font-semibold">Ativação via Checkout:</strong> Para iniciar ou renovar seu plano, você será direcionado à página de pagamento seguro onde poderá emitir o PIX ou cadastrar um cartão de crédito.
              </p>
            )}
          </div>
        </div>

        {/* Rodapé Dinâmico e Sem Conflitos */}
        <DialogFooter className="gap-2 flex-col sm:flex-row sm:justify-between pt-2 border-t border-border mt-2">
          {hasActiveRecurringCard ? (
            <>
              {/* Opção secundária para quem quiser pagar por outro meio / PIX no checkout */}
              <Button
                variant="outline"
                type="button"
                onClick={onNavigateToCheckout}
                disabled={submitting}
                className="border-border text-muted-foreground hover:text-foreground rounded-xl min-h-[44px]"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Ir para Checkout / Pagamento
              </Button>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                  className="text-muted-foreground min-h-[44px]"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={onConfirmChangePlan}
                  disabled={submitting || isSamePlanAndCycle || (targetPlan === "solo" && activeCollaboratorsCount > 0)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl min-h-[44px]"
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isSamePlanAndCycle ? "Plano Atual Selecionado" : "Confirmar Alteração de Plano"}
                </Button>
              </div>
            </>
          ) : (
            /* Sem cartão ativo: Fluxo Unificado e Claro para Checkout */
            <div className="w-full flex items-center justify-between gap-2 flex-col sm:flex-row">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="text-muted-foreground min-h-[44px] order-2 sm:order-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={onNavigateToCheckout}
                disabled={submitting || (targetPlan === "solo" && activeCollaboratorsCount > 0)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl min-h-[44px] order-1 sm:order-2 shadow-md w-full sm:w-auto"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Ir para Checkout / Pagamento
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

ChangePlanModal.displayName = "ChangePlanModal";
