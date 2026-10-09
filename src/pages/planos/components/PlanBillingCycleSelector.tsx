import React from "react";
import { BillingCycle } from "@/utils/subscriptionPricing";

export interface PlanBillingCycleSelectorProps {
  /** Ciclo atualmente selecionado (mensal, trimestral ou anual). */
  selectedCycle: BillingCycle;
  /** Callback acionado ao alternar o ciclo de faturamento. */
  onSelectCycle: (cycle: BillingCycle) => void;
}

export const PlanBillingCycleSelector: React.FC<PlanBillingCycleSelectorProps> = React.memo(({
  selectedCycle,
  onSelectCycle,
}) => {
  return (
    <div
      role="group"
      aria-label="Ciclos de faturamento"
      className="inline-flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-full max-w-full shadow-xs backdrop-blur-md flex-wrap"
    >
      <button
        type="button"
        data-cycle="monthly"
        onClick={() => onSelectCycle("monthly")}
        className={`inline-flex items-center justify-center gap-1 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer min-h-[34px] ${
          selectedCycle === "monthly"
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        }`}
      >
        <span>Mensal</span>
      </button>

      <button
        type="button"
        data-cycle="quarterly"
        onClick={() => onSelectCycle("quarterly")}
        className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer min-h-[34px] ${
          selectedCycle === "quarterly"
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        }`}
      >
        <span>Trimestral</span>
        <span
          className={`text-[10px] font-extrabold ${
            selectedCycle === "quarterly"
              ? "text-sky-300 dark:text-blue-600"
              : "text-blue-600 dark:text-sky-400"
          }`}
        >
          -15%
        </span>
      </button>

      <button
        type="button"
        data-cycle="annual"
        onClick={() => onSelectCycle("annual")}
        className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer min-h-[34px] ${
          selectedCycle === "annual"
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        }`}
      >
        <span>Anual</span>
        <span
          className={`text-[10px] font-extrabold ${
            selectedCycle === "annual"
              ? "text-emerald-300 dark:text-emerald-700"
              : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          -35% OFF
        </span>
      </button>
    </div>
  );
});

PlanBillingCycleSelector.displayName = "PlanBillingCycleSelector";
