import React from "react";
import { motion } from "framer-motion";
import { Check, MessageCircle, ArrowRight } from "lucide-react";
import { PlanType } from "@/utils/subscriptionPricing";

export interface PlanStageEnterpriseProps {
  onSelectEnterprise: (planId: PlanType) => void;
}

const ENTERPRISE_ITEMS = [
  {
    title: "Migração Assistida VIP",
    desc: "Importação completa sem perda de dados.",
  },
  {
    title: "Múltiplas unidades e filiais",
    desc: "Permissões por unidade, gestor e profissional.",
  },
  {
    title: "SLA dedicado e treinamento",
    desc: "Canal direto com suporte prioritário.",
  },
  {
    title: "Integrações customizadas",
    desc: "API, faturamento TISS/TUSS e ERPs.",
  },
];

export const PlanStageEnterprise: React.FC<PlanStageEnterpriseProps> = React.memo(({
  onSelectEnterprise,
}) => {
  return (
    <motion.article
      key="enterprise-stage"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="w-full rounded-3xl bg-slate-900 text-white border-2 border-cyan-500/50 p-5 sm:p-7 shadow-2xl flex flex-col justify-between gap-4 sm:gap-5"
    >
      <div className="flex flex-col gap-2">
        <span className="self-start bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
          Grandes redes e hospitais
        </span>

        <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
          Soluções corporativas sob medida
        </h3>

        <p className="text-xs sm:text-sm text-slate-300 leading-snug">
          Governança avançada, banco de dados isolado e suporte 24/7 para redes com mais de 30 profissionais.
        </p>
      </div>

      {/* 2x2 Grid */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 list-none p-0 m-0">
        {ENTERPRISE_ITEMS.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="flex flex-col text-xs sm:text-[13px] leading-snug">
              <strong className="text-white font-bold">{item.title}</strong>
              <span className="text-slate-300 text-[11px] sm:text-xs">
                {item.desc}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
        <button
          type="button"
          onClick={() => onSelectEnterprise("clinica_top")}
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-black text-sm shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 hover:-translate-y-0.5 transition-all cursor-pointer min-h-[46px]"
        >
          <span>Contratar Enterprise</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <a
          href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20gostaria%20de%20conversar%20sobre%20o%20Plano%20Enterprise%20do%20Pluri%20Fisio"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold text-xs sm:text-sm hover:-translate-y-0.5 transition-all cursor-pointer min-h-[46px]"
        >
          <MessageCircle className="w-4 h-4 text-emerald-400" />
          <span>Falar com consultor</span>
        </a>
      </div>
    </motion.article>
  );
});

PlanStageEnterprise.displayName = "PlanStageEnterprise";
