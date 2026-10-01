import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, QrCode, Users, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlanPriceCalculation, PlanType } from "@/utils/subscriptionPricing";

export interface PlanCardTierProps {
  planId: PlanType;
  name: string;
  tagline: string;
  badge?: string;
  featured?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  colorTheme: "blue" | "emerald" | "purple";
  features: string[];
  pricing: PlanPriceCalculation;
  isFreeCycle: boolean;
  isSelected: boolean;
  onSelectPlan: (planId: PlanType) => void;
  onOpenDetails?: (planId: PlanType) => void;
  activatingTrial: boolean;
  // Calculadora de assentos extras (apenas para planos de clínica)
  allowExtraSeats?: boolean;
  extraSeatsCount?: number;
  onExtraSeatsChange?: (updater: (prev: number) => number) => void;
  baseSeatsLabel?: string;
}

export const PlanCardTier: React.FC<PlanCardTierProps> = React.memo(({
  planId,
  name,
  tagline,
  badge,
  featured = false,
  icon: Icon,
  colorTheme,
  features,
  pricing,
  isFreeCycle,
  isSelected,
  onSelectPlan,
  onOpenDetails,
  activatingTrial,
  allowExtraSeats = false,
  extraSeatsCount = 0,
  onExtraSeatsChange,
  baseSeatsLabel,
}) => {
  const borderGradient =
    colorTheme === "purple"
      ? "from-purple-500/50 via-indigo-500/30 to-border/40"
      : colorTheme === "emerald"
      ? "from-emerald-500/50 via-teal-500/30 to-border/40"
      : "from-blue-600 via-blue-500/50 to-blue-200 dark:from-blue-500 dark:to-blue-900";

  const ringColor =
    colorTheme === "purple"
      ? "ring-2 ring-purple-500 shadow-purple-500/20"
      : colorTheme === "emerald"
      ? "ring-2 ring-emerald-500 shadow-emerald-500/20"
      : "ring-2 ring-blue-600 shadow-blue-500/30";

  const iconBg =
    colorTheme === "purple"
      ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
      : colorTheme === "emerald"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";

  const btnBg =
    featured
      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/30"
      : colorTheme === "purple"
      ? "bg-purple-600 hover:bg-purple-700 text-white"
      : colorTheme === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
      : "bg-primary hover:bg-primary/90 text-primary-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      onClick={() => onSelectPlan(planId)}
      className={`relative group rounded-2xl p-px bg-gradient-to-b ${borderGradient} shadow-md transition-all hover:shadow-lg flex flex-col cursor-pointer ${
        featured ? "md:-translate-y-1 shadow-lg" : ""
      } ${isSelected ? ringColor : ""}`}
    >
      <div className={`h-full rounded-[15px] bg-card/95 backdrop-blur-xl p-3.5 sm:p-4 flex flex-col justify-between space-y-2.5 border ${
        featured ? "border-blue-500/30" : "border-border/50"
      }`}>
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg border shrink-0 ${iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight">{name}</h3>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-semibold leading-tight line-clamp-1">
                  {tagline}
                </p>
              </div>
            </div>
            {badge && (
              <Badge className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wider shrink-0">
                {badge}
              </Badge>
            )}
          </div>

          {/* Preço Dinâmico / Free */}
          <div className="mb-2 p-2 sm:p-2.5 rounded-xl bg-muted/40 dark:bg-neutral-900/60 border border-border dark:border-neutral-800">
            {isFreeCycle ? (
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
                    Grátis
                  </span>
                  <span className="text-muted-foreground text-[11px] font-medium">/ 7 dias</span>
                </div>
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/60 dark:border-neutral-800 mt-1">
                  Avaliação gratuita completa por 7 dias. Cancele quando quiser.
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-foreground">
                    R$&nbsp;{pricing.monthlyEquivalent.toFixed(2).replace(".", ",")}
                  </span>
                  <span className="text-muted-foreground text-[11px] font-medium">/mês</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/60 dark:border-neutral-800 mt-1">
                  <span>
                    Total: <strong className="text-foreground font-semibold">R$&nbsp;{pricing.periodTotal.toFixed(2).replace(".", ",")}</strong>/{pricing.periodLabel}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                    <QrCode className="w-2.5 h-2.5" /> PIX: -5%
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Calculadora de Acessos Extras (quando aplicável) */}
          {allowExtraSeats && !isFreeCycle && onExtraSeatsChange && (
            <div
              className="p-1.5 rounded-lg bg-muted/30 dark:bg-neutral-900/40 border border-border dark:border-neutral-800/80 space-y-0.5 mb-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1 text-[11px]">
                  <Users className="w-3 h-3 text-primary" /> Acessos Extras:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={extraSeatsCount === 0}
                    onClick={() => onExtraSeatsChange((prev) => Math.max(0, prev - 1))}
                    className="w-7 h-7 sm:w-6 sm:h-6 rounded-md bg-muted hover:bg-muted-foreground/20 dark:bg-neutral-800 disabled:opacity-40 flex items-center justify-center font-bold text-foreground text-sm transition-colors active:scale-95"
                    aria-label="Diminuir acessos simultâneos"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-primary text-xs px-1 min-w-[20px] text-center">
                    +{extraSeatsCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => onExtraSeatsChange((prev) => prev + 1)}
                    className="w-7 h-7 sm:w-6 sm:h-6 rounded-md bg-muted hover:bg-muted-foreground/20 dark:bg-neutral-800 flex items-center justify-center font-bold text-foreground text-sm transition-colors active:scale-95"
                    aria-label="Aumentar acessos simultâneos"
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground">
                {baseSeatsLabel || "Base inclusa"} (+R$ 25,00/mês por vaga extra).
              </p>
            </div>
          )}

          {/* Destaques do Plano */}
          <div className="space-y-1 mb-2">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-foreground/80 dark:text-neutral-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">{feature}</span>
              </div>
            ))}
          </div>

          {/* Botão Saiba Mais */}
          {onOpenDetails && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(planId);
              }}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center gap-1 hover:underline mb-1"
            >
              <Info className="w-3 h-3" />
              <span>Ver detalhes e comparativo</span>
            </button>
          )}
        </div>

        {/* Botão CTA */}
        <div className="pt-1">
          <Button
            type="button"
            className={`w-full font-bold shadow-md h-9 sm:h-10 text-xs sm:text-sm rounded-xl transition-all min-h-[38px] ${btnBg}`}
            disabled={activatingTrial}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPlan(planId);
            }}
          >
            {activatingTrial && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isFreeCycle ? "Iniciar Teste Gratuito (7 dias)" : `Escolher ${name}`}
            {!activatingTrial && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
});

PlanCardTier.displayName = "PlanCardTier";
