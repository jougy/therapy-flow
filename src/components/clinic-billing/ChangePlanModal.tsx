import React, { useState } from "react";
import { UserRound, Building2, Sparkles, CheckCircle2, Plus, CreditCard, AlertCircle, Loader2, Info, ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BillingCycle, PlanPriceCalculation, PlanType, calculatePlanPrice } from "@/utils/subscriptionPricing";

export interface ChangePlanModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  targetCycle: BillingCycle;
  onCycleChange: (cycle: BillingCycle) => void;
  targetPlan: PlanType;
  onPlanChange: (plan: PlanType) => void;
  currentPlan?: PlanType;
  currentCycle?: BillingCycle;
  hasActiveRecurringCard?: boolean;
  extraConcurrentCount: number;
  activeCollaboratorsCount: number;
  submitting: boolean;
  onConfirmChangePlan: () => void;
  onNavigateToCheckout: () => void;
  modalPricingSolo?: PlanPriceCalculation;
  modalPricingClinic?: PlanPriceCalculation;
  modalPricingEnterprise?: PlanPriceCalculation;
}

/**
 * Modal de Alteração de Plano (Upgrade / Downgrade com Seleção de Ciclo e Perfil).
 *
 * Racional de Negócio & Salvaguardas:
 * - Trava de segurança contra perda de dados: impede downgrade para planos de 1 acesso (Solo / prof_basico / prof_medio)
 *   se a clínica possuir colaboradores ativos cadastrados. Para prof_top (2 acessos), bloqueia se colaboradores > 1.
 * - Suporta seletor de perfil [Para Profissional] vs [Para Clínica] com 3 tiers em cada.
 * - Compatibilidade retroativa 100% com IDs legados solo, clinic e enterprise.
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
  const isClinicFamilyTarget =
    targetPlan === "clinica_basico" ||
    targetPlan === "clinica_medio" ||
    targetPlan === "clinica_top" ||
    targetPlan === "clinic" ||
    targetPlan === "enterprise";

  const [audience, setAudience] = useState<"prof" | "clinic">(
    isClinicFamilyTarget ? "clinic" : "prof"
  );

  React.useEffect(() => {
    if (isOpen) {
      setAudience(isClinicFamilyTarget ? "clinic" : "prof");
    }
  }, [isOpen, isClinicFamilyTarget]);

  const isSamePlanAndCycle = Boolean(
    currentPlan &&
    currentCycle &&
    targetPlan === currentPlan &&
    targetCycle === currentCycle
  );

  // Precificações dinâmicas O(1)
  const profBasicoPricing = React.useMemo(() => calculatePlanPrice({ planType: "prof_basico", billingCycle: targetCycle }), [targetCycle]);
  const profMedioPricing = React.useMemo(() => modalPricingSolo || calculatePlanPrice({ planType: "prof_medio", billingCycle: targetCycle }), [modalPricingSolo, targetCycle]);
  const profTopPricing = React.useMemo(() => calculatePlanPrice({ planType: "prof_top", billingCycle: targetCycle }), [targetCycle]);

  const clinicaBasicoPricing = React.useMemo(() => calculatePlanPrice({
    planType: "clinica_basico",
    billingCycle: targetCycle,
    additionalSeats: targetPlan === "clinica_basico" ? extraConcurrentCount : 0,
  }), [targetCycle, targetPlan, extraConcurrentCount]);

  const clinicaMedioPricing = React.useMemo(() => modalPricingClinic || calculatePlanPrice({
    planType: "clinica_medio",
    billingCycle: targetCycle,
    additionalSeats: targetPlan === "clinica_medio" || targetPlan === "clinic" ? extraConcurrentCount : 0,
  }), [modalPricingClinic, targetCycle, targetPlan, extraConcurrentCount]);

  const clinicaTopPricing = React.useMemo(() => modalPricingEnterprise || calculatePlanPrice({
    planType: "clinica_top",
    billingCycle: targetCycle,
    additionalSeats: targetPlan === "clinica_top" || targetPlan === "enterprise" ? extraConcurrentCount : 0,
  }), [modalPricingEnterprise, targetCycle, targetPlan, extraConcurrentCount]);

  // Trava de segurança de downgrade
  const isOneSeatPlan = targetPlan === "solo" || targetPlan === "prof_basico" || targetPlan === "prof_medio";
  const isDowngradeBlocked =
    (isOneSeatPlan && activeCollaboratorsCount > 0) ||
    (targetPlan === "prof_top" && activeCollaboratorsCount > 1);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border text-popover-foreground sm:max-w-4xl rounded-2xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Alterar Plano de Assinatura
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs sm:text-sm">
            Escolha o plano e o ciclo ideais para expandir o potencial e a equipe da sua clínica.
          </DialogDescription>
        </DialogHeader>

        {/* 1. Seletor de Perfil: [Para Profissional] vs [Para Clínica] */}
        <div className="flex justify-center pt-1">
          <div
            role="tablist"
            aria-label="Perfil de Assinatura"
            className="p-1 bg-muted/70 dark:bg-neutral-900/90 border border-border rounded-full inline-flex items-center gap-1 shadow-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={audience === "prof"}
              onClick={() => {
                setAudience("prof");
                if (isClinicFamilyTarget) onPlanChange("prof_medio");
              }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 min-h-[32px] ${
                audience === "prof"
                  ? "bg-background text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Para Profissional</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={audience === "clinic"}
              onClick={() => {
                setAudience("clinic");
                if (!isClinicFamilyTarget) onPlanChange("clinica_medio");
              }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 min-h-[32px] ${
                audience === "clinic"
                  ? "bg-background text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Para Clínica</span>
            </button>
          </div>
        </div>

        {/* 2. Seletor de Ciclo com Destaque de Economia */}
        <div className="flex justify-center my-2">
          <div className="p-1.5 bg-muted/80 rounded-2xl inline-flex items-center gap-1.5 border">
            <button
              type="button"
              onClick={() => onCycleChange("monthly")}
              className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-semibold transition-all min-h-[34px] ${
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
              className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-semibold transition-all min-h-[34px] flex items-center gap-1.5 ${
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
              className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-semibold transition-all min-h-[34px] flex items-center gap-1.5 ${
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

        {/* 3. Grid de Planos do Perfil Ativo */}
        {audience === "prof" ? (
          <div className="grid gap-3 py-2 grid-cols-1 sm:grid-cols-3">
            {/* Profissional Básico */}
            <div
              onClick={() => onPlanChange("prof_basico")}
              className={`cursor-pointer rounded-2xl p-4 border transition-all flex flex-col justify-between relative ${
                targetPlan === "prof_basico"
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
                      <h4 className="font-bold text-base text-foreground">Profissional Básico</h4>
                      <p className="text-xs text-muted-foreground">Autônomo iniciando</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  {currentPlan === "prof_basico" && currentCycle === targetCycle && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                      Plano Atual
                    </Badge>
                  )}
                  {targetPlan === "prof_basico" && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold">
                      Selecionado
                    </Badge>
                  )}
                </div>

                <div className="mb-3">
                  <div className="text-2xl font-black text-foreground">
                    R$ {profBasicoPricing.monthlyEquivalent.toFixed(2)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cobrado R$ {profBasicoPricing.periodTotal.toFixed(2)} por {profBasicoPricing.periodLabel}
                  </p>
                </div>

                <ul className="text-xs text-muted-foreground space-y-1.5 border-t border-border pt-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>1 Acesso simultâneo individual</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Pacientes e atendimentos ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>1 formulário universal + 1 ficha</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Profissional Médio */}
            <div
              onClick={() => onPlanChange("prof_medio")}
              className={`cursor-pointer rounded-2xl p-4 border transition-all flex flex-col justify-between relative ${
                targetPlan === "prof_medio" || targetPlan === "solo"
                  ? "border-blue-500 bg-blue-500/5 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/20"
                  : "border-border bg-card hover:border-neutral-400 dark:hover:border-neutral-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                      <UserRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-foreground">Profissional Médio</h4>
                      <p className="text-xs text-muted-foreground">Alta demanda e fichas livres</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  {(currentPlan === "prof_medio" || currentPlan === "solo") && currentCycle === targetCycle && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] font-bold">
                      Plano Atual
                    </Badge>
                  )}
                  {(targetPlan === "prof_medio" || targetPlan === "solo") && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold">
                      Selecionado
                    </Badge>
                  )}
                  <Badge className="bg-blue-600 text-white text-[9px] font-bold uppercase">Mais Popular</Badge>
                </div>

                <div className="mb-3">
                  <div className="text-2xl font-black text-foreground">
                    R$ {profMedioPricing.monthlyEquivalent.toFixed(2)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cobrado R$ {profMedioPricing.periodTotal.toFixed(2)} por {profMedioPricing.periodLabel}
                  </p>
                </div>

                <ul className="text-xs text-muted-foreground space-y-1.5 border-t border-border pt-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>1 Acesso simultâneo individual</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Formulários e fichas ilimitadas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Controle de pagamentos e pacotes</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Profissional Top */}
            <div
              onClick={() => onPlanChange("prof_top")}
              className={`cursor-pointer rounded-2xl p-4 border transition-all flex flex-col justify-between relative ${
                targetPlan === "prof_top"
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
                      <h4 className="font-bold text-base text-foreground">Profissional Top</h4>
                      <p className="text-xs text-muted-foreground">Você + Apoio</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  {currentPlan === "prof_top" && currentCycle === targetCycle && (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] font-bold">
                      Plano Atual
                    </Badge>
                  )}
                  {targetPlan === "prof_top" && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold">
                      Selecionado
                    </Badge>
                  )}
                  <Badge className="bg-purple-600 text-white text-[9px] font-bold uppercase">2 Acessos</Badge>
                </div>

                <div className="mb-3">
                  <div className="text-2xl font-black text-foreground">
                    R$ {profTopPricing.monthlyEquivalent.toFixed(2)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cobrado R$ {profTopPricing.periodTotal.toFixed(2)} por {profTopPricing.periodLabel}
                  </p>
                </div>

                <ul className="text-xs text-muted-foreground space-y-1.5 border-t border-border pt-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                    <span><strong>2 Acessos simultâneos</strong> (Titular + Apoio)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                    <span>Lembretes WhatsApp & Recibos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                    <span>Suporte prioritário</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 py-2 grid-cols-1 sm:grid-cols-3">
            {/* Clínica Básico */}
            <div
              onClick={() => onPlanChange("clinica_basico")}
              className={`cursor-pointer rounded-2xl p-4 border transition-all flex flex-col justify-between relative ${
                targetPlan === "clinica_basico"
                  ? "border-purple-500 bg-purple-500/5 shadow-md shadow-purple-500/10 ring-2 ring-purple-500/20"
                  : "border-border bg-card hover:border-neutral-400 dark:hover:border-neutral-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-foreground">Clínica Básico</h4>
                      <p className="text-xs text-muted-foreground">Salas compartilhadas</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  {currentPlan === "clinica_basico" && currentCycle === targetCycle && (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] font-bold">
                      Plano Atual
                    </Badge>
                  )}
                  {targetPlan === "clinica_basico" && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold">
                      Selecionado
                    </Badge>
                  )}
                </div>

                <div className="mb-3">
                  <div className="text-2xl font-black text-foreground">
                    R$ {clinicaBasicoPricing.monthlyEquivalent.toFixed(2)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cobrado R$ {clinicaBasicoPricing.periodTotal.toFixed(2)} por {clinicaBasicoPricing.periodLabel}
                  </p>
                </div>

                <ul className="text-xs text-muted-foreground space-y-1.5 border-t border-border pt-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                    <span><strong>{2 + (targetPlan === "clinica_basico" ? extraConcurrentCount : 0)} Acessos</strong> (base 2)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                    <span>Colaboradores ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium">
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Extras: +R$ 25/mês</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Clínica Médio */}
            <div
              onClick={() => onPlanChange("clinica_medio")}
              className={`cursor-pointer rounded-2xl p-4 border transition-all flex flex-col justify-between relative ${
                targetPlan === "clinica_medio" || targetPlan === "clinic"
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
                      <h4 className="font-bold text-base text-foreground">Clínica Médio</h4>
                      <p className="text-xs text-muted-foreground">Equipes consolidadas</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  {(currentPlan === "clinica_medio" || currentPlan === "clinic") && currentCycle === targetCycle && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] font-bold">
                      Plano Atual
                    </Badge>
                  )}
                  {(targetPlan === "clinica_medio" || targetPlan === "clinic") && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold">
                      Selecionado
                    </Badge>
                  )}
                  <Badge className="bg-blue-600 text-white text-[9px] font-bold uppercase">Recomendado</Badge>
                </div>

                <div className="mb-3">
                  <div className="text-2xl font-black text-foreground">
                    R$ {clinicaMedioPricing.monthlyEquivalent.toFixed(2)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cobrado R$ {clinicaMedioPricing.periodTotal.toFixed(2)} por {clinicaMedioPricing.periodLabel}
                  </p>
                </div>

                <ul className="text-xs text-muted-foreground space-y-1.5 border-t border-border pt-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                    <span><strong>{4 + (targetPlan === "clinica_medio" || targetPlan === "clinic" ? extraConcurrentCount : 0)} Acessos</strong> (base 4)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Permissões editáveis & Repasses</span>
                  </li>
                  <li className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Extras: +R$ 25/mês</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Clínica Top */}
            <div
              onClick={() => onPlanChange("clinica_top")}
              className={`cursor-pointer rounded-2xl p-4 border transition-all flex flex-col justify-between relative ${
                targetPlan === "clinica_top" || targetPlan === "enterprise"
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
                      <h4 className="font-bold text-base text-foreground">Clínica Top</h4>
                      <p className="text-xs text-muted-foreground">Alta rotatividade e escala</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  {(currentPlan === "clinica_top" || currentPlan === "enterprise") && currentCycle === targetCycle && (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] font-bold">
                      Plano Atual
                    </Badge>
                  )}
                  {(targetPlan === "clinica_top" || targetPlan === "enterprise") && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold">
                      Selecionado
                    </Badge>
                  )}
                  <Badge className="bg-purple-600 text-white text-[9px] font-bold uppercase">8 Acessos Base</Badge>
                </div>

                <div className="mb-3">
                  <div className="text-2xl font-black text-foreground">
                    R$ {clinicaTopPricing.monthlyEquivalent.toFixed(2)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cobrado R$ {clinicaTopPricing.periodTotal.toFixed(2)} por {clinicaTopPricing.periodLabel}
                  </p>
                </div>

                <ul className="text-xs text-muted-foreground space-y-1.5 border-t border-border pt-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                    <span><strong>{8 + (targetPlan === "clinica_top" || targetPlan === "enterprise" ? extraConcurrentCount : 0)} Acessos</strong> (base 8)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                    <span>Auditoria completa & Gestão multissala</span>
                  </li>
                  <li className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold">
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Extras: +R$ 25/mês</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Alerta de Downgrade Bloqueado se houver colaboradores ativos */}
        {isDowngradeBlocked && (
          <Alert variant="destructive" className="rounded-xl my-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-semibold text-sm">Bloqueio de Downgrade</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              {isOneSeatPlan ? (
                <>Sua clínica possui <strong>{activeCollaboratorsCount} colaborador(es) ativo(s)</strong>. Para alterar para um plano de 1 acesso, você precisa primeiro remover ou desativar os colaboradores na aba de membros.</>
              ) : (
                <>O plano Profissional Top suporta no máximo 1 colaborador de apoio além do titular. Sua clínica possui <strong>{activeCollaboratorsCount} colaboradores ativos</strong>.</>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Box Informativo de Contexto Financeiro */}
        <div className="rounded-xl border bg-muted/40 p-3 flex items-start gap-2.5 my-1.5 text-xs">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-muted-foreground">
            {hasActiveRecurringCard ? (
              <p>
                <strong className="text-foreground font-semibold">Assinatura com Cartão Recorrente:</strong> Ao confirmar, o novo plano será atualizado diretamente no Asaas e a cobrança proporcional será refletida na sua próxima fatura.
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
              <Button
                variant="outline"
                type="button"
                onClick={onNavigateToCheckout}
                disabled={submitting}
                className="border-border text-muted-foreground hover:text-foreground rounded-xl min-h-[40px] text-xs"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Ir para Checkout / Pagamento
              </Button>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                  className="text-muted-foreground min-h-[40px] text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={onConfirmChangePlan}
                  disabled={submitting || isSamePlanAndCycle || isDowngradeBlocked}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl min-h-[40px] text-xs"
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isSamePlanAndCycle ? "Plano Atual Selecionado" : "Confirmar Alteração de Plano"}
                </Button>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between gap-2 flex-col sm:flex-row">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="text-muted-foreground min-h-[40px] text-xs order-2 sm:order-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={onNavigateToCheckout}
                disabled={submitting || isDowngradeBlocked}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl min-h-[40px] text-xs order-1 sm:order-2 shadow-md w-full sm:w-auto"
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

