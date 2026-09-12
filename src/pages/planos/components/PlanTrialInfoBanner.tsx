import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export interface PlanTrialInfoBannerProps {
  /** Indica se deve renderizar o banner (somente se não possui assinatura ativa e o trial está habilitado). */
  visible: boolean;
}

/**
 * Banner explicativo sobre a modalidade de Degustação Gratuita Volumétrica/Temporal.
 *
 * Racional de Negócio:
 * - Reduz atrito cognitivo e objeção de compra esclarecendo os termos da degustação.
 * - Deixa explícito que NÃO exige cartão de crédito inicial.
 *
 * Complexidade Assintótica: O(1).
 */
export const PlanTrialInfoBanner: React.FC<PlanTrialInfoBannerProps> = React.memo(({ visible }) => {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="z-10 w-full max-w-5xl mt-10 p-6 rounded-3xl bg-card/60 dark:bg-neutral-900/40 border border-border dark:border-neutral-800 text-foreground text-xs sm:text-sm flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20 shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="font-bold text-foreground text-sm sm:text-base">Como funciona o Teste Gratuito (7 dias)?</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Você pode cadastrar até <strong>5 pacientes</strong>, realizar até <strong>20 atendimentos clínicos</strong> com <strong>1 formulário personalizado extra</strong> e até <strong>4 acessos simultâneos</strong> durante o <strong>teste gratuito de 7 dias ou até 20 atendimentos</strong> (equivalente ao plano Clínica Pro).
          </p>
        </div>
      </div>
    </motion.div>
  );
});

PlanTrialInfoBanner.displayName = "PlanTrialInfoBanner";
