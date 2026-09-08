import React from "react";
import { motion } from "framer-motion";
import { Sparkles, CheckCircle2, ChevronRight, QrCode, Users, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlanPriceCalculation } from "@/utils/subscriptionPricing";

export interface PlanCardEnterpriseProps {
  /** Indica se o ciclo selecionado é o de degustação gratuita. */
  isFreeCycle: boolean;
  /** Objeto de precificação calculada centralizada para o plano Enterprise. */
  pricing: PlanPriceCalculation;
  /** Indica se este card é o atualmente selecionado. */
  isSelected: boolean;
  /** Callback acionado ao selecionar/contratar este plano. */
  onSelectPlan: (planId: "enterprise") => void;
  /** Callback para abrir modal com especificações detalhadas do plano. */
  onOpenDetails?: (planId: "enterprise") => void;
  /** Indica estado de ativação de degustação em andamento (spinner). */
  activatingTrial: boolean;
  /** Quantidade de acessos concorrentes adicionais além dos 10 da base. */
  extraConcurrentEnterprise: number;
  /** Callback de atualização dos acessos simultâneos extras para o plano Enterprise. */
  onExtraConcurrentEnterpriseChange: (updater: (prev: number) => number) => void;
}

/**
 * Card de Apresentação do Plano Enterprise (Compacto e Ultra-Responsivo).
 *
 * Complexidade Assintótica: O(1) de tempo e espaço.
 */
export const PlanCardEnterprise: React.FC<PlanCardEnterpriseProps> = React.memo(({
  isFreeCycle,
  pricing,
  isSelected,
  onSelectPlan,
  onOpenDetails,
  activatingTrial,
  extraConcurrentEnterprise,
  onExtraConcurrentEnterpriseChange,
}) => {
  const highlights = isFreeCycle
    ? [
        "Para grandes clínicas e redes em teste",
        "Até 20 atendimentos na degustação",
        "Até 5 pacientes cadastrados",
        "Suporte prioritário e auditoria avançada",
      ]
    : [
        "Até 100 colaboradores e profissionais",
        `${10 + extraConcurrentEnterprise} acessos simultâneos inclusos (base 10)`,
        "Atendimentos e pacientes 100% ilimitados",
        "Extras com tarifa reduzida de R$ 15/mês (-40%)",
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      onClick={() => onSelectPlan("enterprise")}
      className={`relative group rounded-2xl p-px bg-gradient-to-b from-purple-500/50 via-indigo-500/30 to-border/40 dark:from-purple-600/40 dark:to-neutral-900 shadow-lg transition-all hover:shadow-xl flex flex-col cursor-pointer ${
        isSelected ? "ring-2 ring-purple-500 shadow-purple-500/30" : ""
      }`}
    >
      <div className="h-full rounded-[15px] bg-card/95 backdrop-blur-xl p-3.5 sm:p-4 flex flex-col justify-between relative overflow-hidden space-y-2.5 border border-purple-500/30">
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-[30px] rounded-full pointer-events-none" />

        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg border border-purple-500/20 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight">Enterprise</h3>
                <p className="text-[10px] sm:text-[11px] text-purple-600 dark:text-purple-400 font-semibold leading-tight">
                  Alta Escala (Base 10 Assentos)
                </p>
              </div>
            </div>
            <Badge className="bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wider shrink-0">
              Alta Escala
            </Badge>
          </div>

          <p className="text-muted-foreground text-[11px] mb-2 line-clamp-2 leading-snug">
            {isFreeCycle
              ? "Para grandes clínicas e redes. Teste recursos avançados de telemetria."
              : "Solução para redes: 10 acessos na base com desconto especial em assentos adicionais."}
          </p>

          {/* Preço Dinâmico / Free */}
          <div className="mb-2 p-2 sm:p-2.5 rounded-xl bg-muted/40 dark:bg-neutral-900/60 border border-border dark:border-neutral-800">
            {isFreeCycle ? (
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">
                    Grátis
                  </span>
                  <span className="text-muted-foreground text-[11px] font-medium">/ 7 dias</span>
                </div>
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/60 dark:border-neutral-800 mt-1">
                  Avaliação completa para grandes equipes sem cartão.
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

          {/* Ajuste de Acessos Simultâneos no Enterprise (R$ 15/mês cada) */}
          {!isFreeCycle && (
            <div 
              className="p-1.5 rounded-lg bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 space-y-0.5 mb-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1 text-[11px]">
                  <Users className="w-3 h-3 text-purple-600 dark:text-purple-400" /> Acessos Simultâneos:
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={extraConcurrentEnterprise === 0}
                    onClick={() => onExtraConcurrentEnterpriseChange((prev) => Math.max(0, prev - 1))}
                    className="w-5 h-5 rounded bg-muted hover:bg-muted-foreground/20 dark:bg-neutral-800 disabled:opacity-40 flex items-center justify-center font-bold text-foreground text-xs transition-colors"
                    aria-label="Diminuir acessos simultâneos"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-xs px-1">
                    {10 + extraConcurrentEnterprise}
                  </span>
                  <button
                    type="button"
                    onClick={() => onExtraConcurrentEnterpriseChange((prev) => prev + 1)}
                    className="w-5 h-5 rounded bg-muted hover:bg-muted-foreground/20 dark:bg-neutral-800 flex items-center justify-center font-bold text-foreground text-xs transition-colors"
                    aria-label="Aumentar acessos simultâneos"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-[9px] pt-0.5 border-t border-purple-500/10">
                <span className="text-muted-foreground">10 na base</span>
                <span className="text-purple-600 dark:text-purple-300 font-bold">
                  Extras: R$ 15/mês (-40% OFF)
                </span>
              </div>
            </div>
          )}

          {/* Destaques compactos */}
          <div className="space-y-1 mb-2">
            {highlights.map((feature, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-foreground/80 dark:text-neutral-300">
                <CheckCircle2 className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
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
                onOpenDetails("enterprise");
              }}
              className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 inline-flex items-center gap-1 hover:underline mb-1"
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
            className="w-full font-bold shadow-md h-9 sm:h-10 text-xs sm:text-sm rounded-xl transition-all min-h-[38px] bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20"
            disabled={activatingTrial}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPlan("enterprise");
            }}
          >
            {activatingTrial && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isFreeCycle ? "Ativar Degustação" : "Contratar Enterprise"}
            {!activatingTrial && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
});

PlanCardEnterprise.displayName = "PlanCardEnterprise";
