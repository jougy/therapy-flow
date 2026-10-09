import React from "react";
import { motion } from "framer-motion";
import { Check, ArrowLeft, Loader2, ArrowRight } from "lucide-react";

export interface PlanStageTrialProps {
  onCloseTrial: () => void;
  onStartTrial: () => void;
  activatingTrial: boolean;
}

export const PlanStageTrial: React.FC<PlanStageTrialProps> = React.memo(({
  onCloseTrial,
  onStartTrial,
  activatingTrial,
}) => {
  return (
    <motion.article
      key="trial-stage"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="w-full rounded-3xl bg-linear-to-br from-emerald-50/80 via-white to-teal-50/80 dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/40 border-2 border-emerald-500 p-5 sm:p-7 shadow-2xl shadow-emerald-500/15 flex flex-col justify-between gap-4 sm:gap-5"
    >
      <div className="flex justify-between items-center gap-3">
        <span className="bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full">
          TESTE GRATUITO
        </span>

        <button
          type="button"
          onClick={onCloseTrial}
          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/60 hover:bg-emerald-200 dark:hover:bg-emerald-900 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Ver planos</span>
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          7 dias grátis, sem cartão de crédito
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-snug">
          Use todas as funções na sua rotina real e decida depois. Sem compromisso e sem fidelidade.
        </p>
      </div>

      {/* 3 Metrics */}
      <div className="grid grid-cols-3 gap-2 p-2.5 bg-white/90 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl text-center shadow-xs">
        <div className="flex flex-col py-1">
          <strong className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
            7 dias
          </strong>
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            de acesso completo
          </span>
        </div>
        <div className="flex flex-col py-1 border-x border-slate-200 dark:border-slate-800">
          <strong className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
            20
          </strong>
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            atendimentos inclusos
          </span>
        </div>
        <div className="flex flex-col py-1">
          <strong className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
            R$ 0
          </strong>
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            sem cartão
          </span>
        </div>
      </div>

      {/* Features */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 list-none p-0 m-0">
        <li className="flex items-start gap-2">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-900 dark:text-white font-bold">
              Prontuário eletrônico
            </strong>{" "}
            e agenda com WhatsApp
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-900 dark:text-white font-bold">
              Duplicação em 1 toque
            </strong>{" "}
            para evoluir rápido
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-900 dark:text-white font-bold">
              Consultoria VIP
            </strong>{" "}
            de implantação de lançamento
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span>Cancele quando quiser com 1 clique</span>
        </li>
      </ul>

      {/* Actions */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onStartTrial}
          disabled={activatingTrial}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:shadow-emerald-600/40 hover:-translate-y-0.5 transition-all cursor-pointer min-h-[46px]"
        >
          {activatingTrial ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : null}
          <span>Iniciar Teste Gratuito (7 dias)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.article>
  );
});

PlanStageTrial.displayName = "PlanStageTrial";
