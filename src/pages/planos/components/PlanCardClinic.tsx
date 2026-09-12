import React from "react";
import { motion } from "framer-motion";
import { Building2, CheckCircle2, ChevronRight, QrCode, Users, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlanPriceCalculation } from "@/utils/subscriptionPricing";

export interface PlanCardClinicProps {
  /** Indica se o ciclo selecionado é o de degustação gratuita. */
  isFreeCycle: boolean;
  /** Objeto de precificação calculada centralizada para o plano Clínica Pro. */
  pricing: PlanPriceCalculation;
  /** Indica se este card é o atualmente selecionado. */
  isSelected: boolean;
  /** Callback acionado ao selecionar/contratar este plano. */
  onSelectPlan: (planId: "clinic") => void;
  /** Callback para abrir modal com especificações detalhadas do plano. */
  onOpenDetails?: (planId: "clinic") => void;
  /** Indica estado de ativação de degustação em andamento (spinner). */
  activatingTrial: boolean;
  /** Quantidade de acessos concorrentes adicionais além dos 4 da base. */
  extraConcurrent: number;
  /** Callback de atualização dos acessos simultâneos extras. */
  onExtraConcurrentChange: (updater: (prev: number) => number) => void;
}

/**
 * Card de Apresentação do Plano Clínica Pro (Compacto e Ultra-Responsivo).
 *
 * Complexidade Assintótica: O(1) de tempo e espaço.
 */
export const PlanCardClinic: React.FC<PlanCardClinicProps> = React.memo(({
  isFreeCycle,
  pricing,
  isSelected,
  onSelectPlan,
  onOpenDetails,
  activatingTrial,
  extraConcurrent,
  onExtraConcurrentChange,
}) => {
  const highlights = isFreeCycle
    ? [
        "Equipe completa (até 4 acessos simultâneos)",
        "Até 20 atendimentos no teste gratuito",
        "Até 5 pacientes cadastrados",
        "Controle de perfis e agendas integradas",
      ]
    : [
        "Colaboradores ilimitados (até 30 vagas base)",
        `${4 + extraConcurrent} acessos simultâneos inclusos (base 4)`,
        "Atendimentos e pacientes 100% ilimitados",
        "Controle de permissões (RBAC) e agendas compartilhadas",
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      onClick={() => onSelectPlan("clinic")}
      className={`relative group rounded-2xl p-px bg-gradient-to-b from-primary via-primary/50 to-primary/20 dark:from-blue-500 dark:to-blue-900 shadow-xl shadow-primary/10 dark:shadow-blue-900/30 md:-translate-y-1 flex flex-col cursor-pointer transition-all ${
        isSelected ? "ring-2 ring-primary shadow-primary/40" : ""
      }`}
    >
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary dark:via-blue-400 to-transparent" />

      <div className="h-full rounded-[15px] bg-card/95 backdrop-blur-xl p-3.5 sm:p-4 flex flex-col justify-between relative overflow-hidden space-y-2.5 border border-primary/30">
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/15 dark:bg-blue-500/10 blur-[30px] rounded-full pointer-events-none" />

        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary text-primary-foreground rounded-lg shadow-sm shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight">Clínica Pro</h3>
                <p className="text-[10px] sm:text-[11px] text-primary dark:text-blue-400 font-semibold leading-tight">
                  Equipes (Base 4 Assentos)
                </p>
              </div>
            </div>
            <Badge className="bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wider shrink-0">
              {isFreeCycle ? "Teste Gratuito" : "Recomendado"}
            </Badge>
          </div>

          <p className="text-muted-foreground text-[11px] mb-2 line-clamp-2 leading-snug">
            {isFreeCycle
              ? "Experimente 7 dias com equipe completa: 4 acessos simultâneos e colaboração total."
              : "Ideal para clínicas em expansão: 4 acessos simultâneos inclusos com gestão de equipe."}
          </p>

          {/* Preço Dinâmico / Free */}
          <div className="mb-2 p-2 sm:p-2.5 rounded-xl bg-muted/40 dark:bg-neutral-900/60 border border-border dark:border-neutral-800">
            {isFreeCycle ? (
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-primary dark:text-blue-400">
                    Grátis
                  </span>
                  <span className="text-muted-foreground text-[11px] font-medium">/ 7 dias</span>
                </div>
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/60 dark:border-neutral-800 mt-1">
                  4 acessos simultâneos inclusos para toda a equipe experimentar.
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

          {/* Ajuste de Acessos Simultâneos na Clínica (R$ 25/mês cada) */}
          {!isFreeCycle && (
            <div 
              className="p-1.5 rounded-lg bg-muted/30 dark:bg-neutral-900/40 border border-border dark:border-neutral-800/80 space-y-0.5 mb-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1 text-[11px]">
                  <Users className="w-3 h-3 text-primary dark:text-blue-400" /> Acessos Simultâneos:
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={extraConcurrent === 0}
                    onClick={() => onExtraConcurrentChange((prev) => Math.max(0, prev - 1))}
                    className="w-5 h-5 rounded bg-muted hover:bg-muted-foreground/20 dark:bg-neutral-800 disabled:opacity-40 flex items-center justify-center font-bold text-foreground text-xs transition-colors"
                    aria-label="Diminuir acessos simultâneos"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-primary dark:text-blue-400 text-xs px-1">
                    {4 + extraConcurrent}
                  </span>
                  <button
                    type="button"
                    onClick={() => onExtraConcurrentChange((prev) => prev + 1)}
                    className="w-5 h-5 rounded bg-muted hover:bg-muted-foreground/20 dark:bg-neutral-800 flex items-center justify-center font-bold text-foreground text-xs transition-colors"
                    aria-label="Aumentar acessos simultâneos"
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground">
                Base 4 (+R$ 25,00/mês por vaga extra).
              </p>
            </div>
          )}

          {/* Destaques compactos */}
          <div className="space-y-1 mb-2">
            {highlights.map((feature, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-foreground/80 dark:text-neutral-300">
                <CheckCircle2 className="w-3 h-3 text-primary dark:text-blue-400 shrink-0" />
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
                onOpenDetails("clinic");
              }}
              className="text-[11px] font-semibold text-primary hover:text-primary/90 dark:text-blue-400 inline-flex items-center gap-1 hover:underline mb-1"
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
            className="w-full font-bold shadow-md h-9 sm:h-10 text-xs sm:text-sm rounded-xl transition-all min-h-[38px] bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={activatingTrial}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPlan("clinic");
            }}
          >
            {activatingTrial && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isFreeCycle ? "Iniciar Teste Gratuito (7 dias)" : "Contratar Clínica Pro"}
            {!activatingTrial && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
});

PlanCardClinic.displayName = "PlanCardClinic";
