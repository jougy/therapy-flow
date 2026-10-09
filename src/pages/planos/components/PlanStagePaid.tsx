import React from "react";
import { motion } from "framer-motion";
import { Check, ArrowRight, Users, Info, Loader2 } from "lucide-react";
import { PlanPriceCalculation, PlanType, BillingCycle } from "@/utils/subscriptionPricing";

export interface PlanFeatureItem {
  text: string;
  bold: boolean;
}

export interface PlanStagePaidProps {
  planId: PlanType;
  name: string;
  tagline: string;
  badge?: string;
  featured?: boolean;
  isCurrentActivePlan?: boolean;
  features: PlanFeatureItem[];
  pricing: PlanPriceCalculation;
  cycle: BillingCycle | "free";
  onSelectPlan: (planId: PlanType) => void;
  onOpenDetails: (planId: PlanType) => void;
  activatingTrial: boolean;
  // Extra seats for clinic
  allowExtraSeats?: boolean;
  extraSeatsCount?: number;
  onExtraSeatsChange?: (updater: (prev: number) => number) => void;
  baseSeatsLabel?: string;
}

export const PlanStagePaid: React.FC<PlanStagePaidProps> = React.memo(({
  planId,
  name,
  tagline,
  badge,
  featured = false,
  isCurrentActivePlan = false,
  features,
  pricing,
  cycle,
  onSelectPlan,
  onOpenDetails,
  activatingTrial,
  allowExtraSeats = false,
  extraSeatsCount = 0,
  onExtraSeatsChange,
  baseSeatsLabel,
}) => {
  const getCycleSubtext = () => {
    if (cycle === "monthly") return "Cobrado mensalmente";
    if (cycle === "quarterly") {
      return `Total R$ ${pricing.periodTotal.toFixed(0).replace(".", ",")} por trimestre`;
    }
    return `Total R$ ${pricing.periodTotal.toFixed(0).replace(".", ",")} por ano`;
  };

  const getSavingsLabel = () => {
    if (cycle === "annual") return "Economia de até 35%";
    if (cycle === "quarterly") return "-15% OFF";
    return null;
  };

  const savings = getSavingsLabel();

  return (
    <motion.article
      key={planId + cycle}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className={`relative w-full rounded-3xl bg-card text-card-foreground border-2 transition-all p-5 sm:p-7 shadow-xl flex flex-col justify-between gap-4 sm:gap-5 ${
        featured
          ? "border-blue-500 shadow-blue-500/15 dark:shadow-blue-500/10"
          : "border-border"
      }`}
    >
      {/* Head */}
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {isCurrentActivePlan && (
              <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Seu Plano Atual Ativo
              </span>
            )}
            {badge && (
              <span className="inline-block bg-gradient-to-r from-blue-600 to-sky-500 text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight leading-tight">
            {name}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-snug">
            {tagline}
          </p>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
          <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            R$&nbsp;{pricing.monthlyEquivalent.toFixed(0).replace(".", ",")}/mês
          </div>
          <div className="text-[11px] sm:text-xs text-muted-foreground font-medium">
            {getCycleSubtext()}
          </div>
          {savings && (
            <span className="inline-block bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-0.5">
              {savings}
            </span>
          )}
        </div>
      </div>

      {/* Launch bonus banner */}
      <div className="flex items-center gap-3 p-3 sm:p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-300 dark:border-amber-800/80 rounded-2xl text-amber-900 dark:text-amber-200">
        <span className="text-2xl shrink-0" aria-hidden="true">
          🎁
        </span>
        <div className="flex flex-col text-xs leading-snug">
          <strong className="text-amber-950 dark:text-amber-100 font-bold text-xs sm:text-[13px]">
            Bônus de lançamento incluso
          </strong>
          <span className="text-amber-800 dark:text-amber-300 text-[11px] sm:text-xs">
            Consultoria VIP de implantação e uso para os primeiros inscritos
          </span>
        </div>
      </div>

      {/* Extra seats calculator for Clinic */}
      {allowExtraSeats && onExtraSeatsChange && (
        <div className="p-2.5 rounded-xl bg-muted/60 border border-border flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-foreground flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              {baseSeatsLabel || "Acessos simultâneos"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Adicione vagas extras (+R$ 25/mês por vaga)
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={extraSeatsCount === 0}
              onClick={() => onExtraSeatsChange((prev) => Math.max(0, prev - 1))}
              className="w-7 h-7 rounded-lg bg-background border border-border disabled:opacity-30 flex items-center justify-center font-bold text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Diminuir acessos simultâneos"
            >
              -
            </button>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs px-1 min-w-[24px] text-center">
              +{extraSeatsCount}
            </span>
            <button
              type="button"
              onClick={() => onExtraSeatsChange((prev) => prev + 1)}
              className="w-7 h-7 rounded-lg bg-background border border-border flex items-center justify-center font-bold text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Aumentar acessos simultâneos"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Feature Grid (2 columns on desktop) */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs sm:text-[13px] text-foreground/85 dark:text-foreground/90 list-none p-0 m-0">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-snug">
              {f.bold ? (
                <strong className="text-foreground font-bold">
                  {f.text}
                </strong>
              ) : (
                f.text
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* Details modal trigger */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => onOpenDetails(planId)}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
        >
          <Info className="w-3.5 h-3.5" />
          <span>Ver detalhes e comparativo</span>
        </button>
      </div>

      {/* Action CTA button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => onSelectPlan(planId)}
          disabled={activatingTrial}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-black text-sm shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 hover:-translate-y-0.5 transition-all cursor-pointer min-h-[46px]"
        >
          {activatingTrial ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : null}
          <span>{isCurrentActivePlan ? `Seu Plano Atual (${name})` : `Assinar ${name}`}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.article>
  );
});

PlanStagePaid.displayName = "PlanStagePaid";
