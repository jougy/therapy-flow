import React from "react";
import { motion } from "framer-motion";
import { UserRound, CheckCircle2, ChevronRight, QrCode, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanPriceCalculation } from "@/utils/subscriptionPricing";

export interface PlanCardSoloProps {
  /** Indica se o ciclo selecionado é o de degustação gratuita. */
  isFreeCycle: boolean;
  /** Objeto de precificação calculada centralizada para o plano Solo. */
  pricing: PlanPriceCalculation;
  /** Indica se este card é o atualmente selecionado. */
  isSelected: boolean;
  /** Callback acionado ao selecionar/contratar este plano. */
  onSelectPlan: (planId: "solo") => void;
  /** Callback para abrir modal com especificações detalhadas do plano. */
  onOpenDetails?: (planId: "solo") => void;
  /** Indica estado de ativação de degustação em andamento (spinner). */
  activatingTrial: boolean;
}

/**
 * Card de Apresentação do Plano Profissional Solo (Compacto e Ultra-Responsivo).
 *
 * Complexidade Assintótica: O(1) de tempo e espaço.
 */
export const PlanCardSolo: React.FC<PlanCardSoloProps> = React.memo(({
  isFreeCycle,
  pricing,
  isSelected,
  onSelectPlan,
  onOpenDetails,
  activatingTrial,
}) => {
  const highlights = isFreeCycle
    ? [
        "1 Profissional de saúde (titular)",
        "1 Acesso simultâneo individual",
        "Até 20 atendimentos na degustação",
        "Até 5 pacientes cadastrados",
      ]
    : [
        "1 Profissional de saúde (titular)",
        "1 Acesso simultâneo individual",
        "Atendimentos e pacientes 100% ilimitados",
        "Prontuário eletrônico completo e anamnese",
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      onClick={() => onSelectPlan("solo")}
      className={`relative group rounded-2xl p-px bg-gradient-to-b from-border to-border/40 dark:from-neutral-800 dark:to-neutral-900 shadow-md transition-all hover:shadow-lg flex flex-col cursor-pointer ${
        isSelected ? "ring-2 ring-emerald-500 shadow-emerald-500/20" : ""
      }`}
    >
      <div className="h-full rounded-[15px] bg-card/95 backdrop-blur-xl p-3.5 sm:p-4 flex flex-col justify-between space-y-2.5 border border-border/50">
        <div>
          {/* Header */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <UserRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight">Profissional Solo</h3>
              <p className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold leading-tight">
                1 Profissional Titular
              </p>
            </div>
          </div>

          <p className="text-muted-foreground text-[11px] mb-2 line-clamp-2 leading-snug">
            {isFreeCycle
              ? "Experimente gratuitamente atendimentos individuais e prontuário completo."
              : "Perfeito para profissionais autônomos organizarem atendimentos com prontuário completo."}
          </p>

          {/* Preço Dinâmico / Free */}
          <div className="mb-2 p-2 sm:p-2.5 rounded-xl bg-muted/40 dark:bg-neutral-900/60 border border-border dark:border-neutral-800">
            {isFreeCycle ? (
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    Grátis
                  </span>
                  <span className="text-muted-foreground text-[11px] font-medium">/ 7 dias</span>
                </div>
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/60 dark:border-neutral-800 mt-1">
                  20 atendimentos, 5 pacientes e 1 formulário extra inclusos.
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-foreground">
                    R$ {pricing.monthlyEquivalent.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground text-[11px] font-medium">/mês</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/60 dark:border-neutral-800 mt-1">
                  <span>Total: <strong className="text-foreground font-semibold">R$ {pricing.periodTotal.toFixed(2)}</strong>/{pricing.periodLabel}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                    <QrCode className="w-2.5 h-2.5" /> PIX: -5%
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Destaques compactos */}
          <div className="space-y-1 mb-2">
            {highlights.map((feature, i) => (
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
                onOpenDetails("solo");
              }}
              className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 inline-flex items-center gap-1 hover:underline mb-1"
            >
              <Info className="w-3 h-3" />
              <span>Ver todos os recursos e detalhes</span>
            </button>
          )}
        </div>

        {/* Botão CTA */}
        <div className="pt-1">
          <Button
            type="button"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-9 sm:h-10 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 min-h-[38px]"
            disabled={activatingTrial}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPlan("solo");
            }}
          >
            {activatingTrial && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isFreeCycle ? "Ativar Degustação Solo" : "Contratar Solo"}
            {!activatingTrial && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
});

PlanCardSolo.displayName = "PlanCardSolo";
