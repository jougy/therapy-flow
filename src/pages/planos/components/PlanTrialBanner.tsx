import React from "react";
import { ChevronRight } from "lucide-react";

export interface PlanTrialBannerProps {
  onClick: () => void;
}

export const PlanTrialBanner: React.FC<PlanTrialBannerProps> = React.memo(({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Conhecer o teste gratuito de 7 dias"
      className="w-full inline-flex items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-linear-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-emerald-900 dark:text-emerald-100 text-xs sm:text-sm text-left cursor-pointer shadow-xs hover:border-emerald-400 dark:hover:border-emerald-700 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap uppercase tracking-wider shrink-0">
          7 DIAS GRÁTIS
        </span>
        <span className="text-[11px] sm:text-xs text-emerald-950 dark:text-emerald-200 line-clamp-2">
          <strong>Está indeciso?</strong> Teste gratuitamente por 7 dias sem cadastrar cartão
        </span>
      </div>

      <div className="inline-flex items-center gap-0.5 font-bold text-emerald-700 dark:text-emerald-300 text-xs shrink-0 group-hover:translate-x-0.5 transition-transform">
        <span>Conhecer</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </button>
  );
});

PlanTrialBanner.displayName = "PlanTrialBanner";
