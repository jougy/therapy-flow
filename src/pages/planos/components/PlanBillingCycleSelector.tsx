import React from "react";
import { Sparkles } from "lucide-react";
import { BillingCycle } from "@/utils/subscriptionPricing";

/**
 * Propriedades para o componente seletor de ciclo de faturamento.
 */
export interface PlanBillingCycleSelectorProps {
  /** Ciclo atualmente selecionado (mensal, trimestral, anual ou degustação grátis). */
  selectedCycle: BillingCycle | "free";
  /** Callback acionado ao alternar o ciclo de faturamento. */
  onSelectCycle: (cycle: BillingCycle | "free") => void;
  /** Indica se a clínica já possui uma assinatura ativa/paga (ocultando a aba de degustação grátis). */
  hasActiveSubscription: boolean;
  /** Flag do sistema indicando se a modalidade de trial gratuito está habilitada. */
  isFreeTrialEnabled: boolean;
}

/**
 * Seletor de Ciclos de Faturamento e Modalidade Degustação Grátis.
 * 
 * Racional de Negócio / Efeito Ancoragem:
 * - O ciclo Anual (-25% OFF) é o default para incentivar LTV e retenção.
 * - Ciclo Trimestral oferece desconto intermediário (-10% OFF).
 * - O ciclo "Degustação Grátis" permite ativação instantânea sem cartão quando elegível.
 *
 * Complexidade Assintótica: O(1) de tempo e memória.
 */
export const PlanBillingCycleSelector: React.FC<PlanBillingCycleSelectorProps> = React.memo(({
  selectedCycle,
  onSelectCycle,
  hasActiveSubscription,
  isFreeTrialEnabled,
}) => {
  return (
    <div className="pt-1.5 sm:pt-2 flex justify-center">
      <div 
        role="tablist" 
        aria-label="Ciclos de faturamento"
        className="p-1 bg-muted/60 dark:bg-neutral-900/90 border border-border dark:border-neutral-800 rounded-xl inline-flex items-center gap-1 shadow-sm dark:shadow-xl backdrop-blur-md flex-wrap justify-center"
      >
        {!hasActiveSubscription && isFreeTrialEnabled && (
          <button
            type="button"
            onClick={() => onSelectCycle("free")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 min-h-[34px] ${
              selectedCycle === "free"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>Teste gratuito (7 dias)</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onSelectCycle("monthly")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 min-h-[34px] ${
            selectedCycle === "monthly"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Mensal</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectCycle("quarterly")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 min-h-[34px] ${
            selectedCycle === "quarterly"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Trimestral</span>
          <span className="px-1 py-0.5 rounded bg-blue-500/15 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[9px] uppercase font-extrabold">
            -10% OFF
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectCycle("annual")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 min-h-[34px] ${
            selectedCycle === "annual"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Anual</span>
          <span className="px-1 py-0.5 rounded bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] uppercase font-extrabold">
            -25% OFF
          </span>
        </button>
      </div>
    </div>
  );
});

PlanBillingCycleSelector.displayName = "PlanBillingCycleSelector";
