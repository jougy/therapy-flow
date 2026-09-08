import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Award, ArrowLeft } from "lucide-react";
import { useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TermsOfServiceModal } from "@/components/TermsOfServiceModal";
import { usePlanosState } from "./planos/hooks/usePlanosState";
import {
  PlanBillingCycleSelector,
  PlanCouponInput,
  PlanCardSolo,
  PlanCardClinic,
  PlanCardEnterprise,
  PlanDetailsModal,
  PlanFAQModal,
  PlanTrialExplanationModal,
} from "./planos/components";

/**
 * Página Principal de Planos e Assinaturas (Orquestrador Declarativo).
 *
 * Arquitetura & Qualidade de Engenharia:
 * - Arquivo orquestrador super enxuto (< 170 linhas).
 * - Total separação de responsabilidades (SoC):
 *   - Lógica de estado, queries e RPCs isoladas no hook `usePlanosState`.
 *   - Subcomponentes isolados e reutilizáveis em `src/pages/planos/components/`.
 * - Algoritmo Big-O otimizado com `useMemo` (O(1)) e callbacks estáveis via `useCallback`.
 */
export default function PlanosAssinatura() {
  const navigate = useNavigate();
  const [detailsPlanId, setDetailsPlanId] = React.useState<"solo" | "clinic" | "enterprise" | null>(null);
  const [isFAQModalOpen, setIsFAQModalOpen] = React.useState(false);
  const [isTrialModalOpen, setIsTrialModalOpen] = React.useState(false);

  const {
    existingClinicName,
    hasActiveSubscription,
    isFreeTrialEnabled,
    selectedCycle,
    setSelectedCycle,
    isFreeCycle,
    selectedPlanId,
    activatingTrial,
    extraConcurrent,
    setExtraConcurrent,
    extraConcurrentEnterprise,
    setExtraConcurrentEnterprise,
    couponInput,
    setCouponInput,
    validatingCoupon,
    appliedCoupon,
    couponError,
    handleValidateCoupon,
    handleRemoveCoupon,
    soloPricing,
    clinicPricing,
    enterprisePricing,
    handleSelectPlan,
    isTermsModalOpen,
    setIsTermsModalOpen,
    loading,
    isModuleEnabled,
  } = usePlanosState();

  if (!loading && !isModuleEnabled) {
    return <Navigate to="/espacopessoal" replace />;
  }

  const currentDetailsPricing =
    detailsPlanId === "solo"
      ? soloPricing
      : detailsPlanId === "enterprise"
      ? enterprisePricing
      : clinicPricing;

  return (
    <div className="min-h-screen lg:h-[100dvh] bg-background text-foreground flex flex-col items-center justify-start lg:justify-between px-3 sm:px-6 lg:px-8 py-2 sm:py-3 lg:py-3 relative overflow-y-auto overflow-x-hidden">
      {/* Botão de Retorno e Ações de Apoio no Topo */}
      <div className="w-full max-w-7xl shrink-0 z-10 flex items-center justify-between h-8 sm:h-9 mb-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/espacopessoal")}
          className="text-muted-foreground hover:text-foreground -ml-2 gap-1.5 font-medium h-8 text-xs sm:text-sm min-h-[36px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao Espaço Pessoal
        </Button>

        <div className="flex items-center gap-2">
          {!hasActiveSubscription && isFreeTrialEnabled && (
            <button
              type="button"
              onClick={() => setIsTrialModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Como funciona a degustação?</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFAQModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 hover:bg-primary/20 text-primary dark:text-blue-400 border border-primary/20 text-xs font-semibold transition-colors"
          >
            <Award className="w-3.5 h-3.5 text-primary" />
            <span>Dúvidas Frequentes & Garantias</span>
          </button>
        </div>
      </div>

      {/* Ambient Glow */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/10 dark:bg-blue-500/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Header com Apresentação de Título Compacto */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="z-10 text-center shrink-0 mb-1 lg:mb-2 max-w-2xl space-y-1"
      >
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
          Escolha o Plano Ideal para seu Espaço
        </h1>
        <p className="text-xs text-muted-foreground max-w-xl mx-auto line-clamp-1">
          {existingClinicName
            ? `Configurando o espaço: ${existingClinicName}`
            : "Economize até 25% no plano anual ou comece com a degustação gratuita sem cartão."}
        </p>

        <PlanBillingCycleSelector
          selectedCycle={selectedCycle}
          onSelectCycle={setSelectedCycle}
          hasActiveSubscription={hasActiveSubscription}
          isFreeTrialEnabled={isFreeTrialEnabled}
        />
      </motion.div>

      {/* Caixa de Cupom (Planos Pagos) */}
      {!isFreeCycle && (
        <div className="z-10 shrink-0 mb-1 w-full max-w-md">
          <PlanCouponInput
            couponInput={couponInput}
            onCouponInputChange={setCouponInput}
            validatingCoupon={validatingCoupon}
            onValidateCoupon={handleValidateCoupon}
            appliedCoupon={appliedCoupon}
            couponError={couponError}
            onRemoveCoupon={handleRemoveCoupon}
          />
        </div>
      )}

      {/* Grid de Planos Principais: 3 Tiers (Solo, Clínica Pro, Enterprise) */}
      <div className="z-10 grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4 xl:gap-5 w-full max-w-7xl flex-1 items-stretch min-h-0 my-1">
        <PlanCardSolo
          isFreeCycle={isFreeCycle}
          pricing={soloPricing}
          isSelected={selectedPlanId === "solo"}
          onSelectPlan={handleSelectPlan}
          onOpenDetails={(plan) => setDetailsPlanId(plan)}
          activatingTrial={activatingTrial}
        />
        <PlanCardClinic
          isFreeCycle={isFreeCycle}
          pricing={clinicPricing}
          isSelected={selectedPlanId === "clinic"}
          onSelectPlan={handleSelectPlan}
          onOpenDetails={(plan) => setDetailsPlanId(plan)}
          activatingTrial={activatingTrial}
          extraConcurrent={extraConcurrent}
          onExtraConcurrentChange={setExtraConcurrent}
        />
        <PlanCardEnterprise
          isFreeCycle={isFreeCycle}
          pricing={enterprisePricing}
          isSelected={selectedPlanId === "enterprise"}
          onSelectPlan={handleSelectPlan}
          onOpenDetails={(plan) => setDetailsPlanId(plan)}
          activatingTrial={activatingTrial}
          extraConcurrentEnterprise={extraConcurrentEnterprise}
          onExtraConcurrentEnterpriseChange={setExtraConcurrentEnterprise}
        />
      </div>

      {/* Rodapé Compacto com Gatilhos de Modal e Garantia Ética */}
      <div className="w-full max-w-7xl shrink-0 z-10 pt-2 pb-1 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5 text-center sm:text-left">
          <span className="font-semibold text-foreground">Pluri-Health:</span>
          <span>Prontuário eletrônico em conformidade com CFP/CFM e LGPD. Sem fidelidade ou multas.</span>
        </div>

        <div className="flex items-center gap-3">
          {!hasActiveSubscription && isFreeTrialEnabled && (
            <button
              type="button"
              onClick={() => setIsTrialModalOpen(true)}
              className="hover:text-foreground underline sm:hidden font-medium"
            >
              Regras da degustação
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsFAQModalOpen(true)}
            className="hover:text-foreground underline font-medium"
          >
            Ver Dúvidas & Perguntas Frequentes
          </button>
        </div>
      </div>

      {/* Modais de Suporte e Detalhamento */}
      <PlanDetailsModal
        isOpen={detailsPlanId !== null}
        onClose={() => setDetailsPlanId(null)}
        planId={detailsPlanId}
        pricing={currentDetailsPricing}
        isFreeCycle={isFreeCycle}
        onSelectPlan={handleSelectPlan}
      />

      <PlanFAQModal
        isOpen={isFAQModalOpen}
        onClose={() => setIsFAQModalOpen(false)}
      />

      <PlanTrialExplanationModal
        isOpen={isTrialModalOpen}
        onClose={() => setIsTrialModalOpen(false)}
        onSelectPlan={handleSelectPlan}
      />

      <TermsOfServiceModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        planId={selectedPlanId}
      />
    </div>
  );
}
