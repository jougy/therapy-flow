import React from "react";
import { User, Building2, ShieldCheck } from "lucide-react";

export type AudienceType = "prof" | "clinic" | "enterprise";

export interface PlanAudienceSelectorProps {
  audience: AudienceType;
  onSelectAudience: (aud: AudienceType) => void;
  onEnterpriseClick?: () => void;
}

export const PlanAudienceSelector: React.FC<PlanAudienceSelectorProps> = React.memo(({
  audience,
  onSelectAudience,
  onEnterpriseClick,
}) => {
  const handleEnterprise = () => {
    if (onEnterpriseClick) {
      onEnterpriseClick();
    } else {
      onSelectAudience("enterprise");
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Seletor de Perfil"
      className="inline-flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-full max-w-full shadow-xs backdrop-blur-md"
    >
      <button
        type="button"
        role="tab"
        aria-selected={audience === "prof"}
        onClick={() => onSelectAudience("prof")}
        className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap min-h-[34px] ${
          audience === "prof"
            ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-black/5"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        }`}
      >
        <User className="w-3.5 h-3.5" />
        <span>Profissional Solo</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={audience === "clinic"}
        onClick={() => onSelectAudience("clinic")}
        className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap min-h-[34px] ${
          audience === "clinic"
            ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-black/5"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        }`}
      >
        <Building2 className="w-3.5 h-3.5" />
        <span>Clínica com Equipe</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={audience === "enterprise"}
        onClick={handleEnterprise}
        className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap min-h-[34px] ${
          audience === "enterprise"
            ? "bg-slate-900 text-cyan-400 dark:bg-slate-800 shadow-xs ring-1 ring-cyan-500/30"
            : "text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400"
        }`}
      >
        <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
        <span>Enterprise</span>
      </button>
    </div>
  );
});

PlanAudienceSelector.displayName = "PlanAudienceSelector";
