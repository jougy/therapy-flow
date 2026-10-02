import React from "react";
import { User, Building2 } from "lucide-react";

export interface PlanAudienceSelectorProps {
  audience: "prof" | "clinic";
  onSelectAudience: (aud: "prof" | "clinic") => void;
  onEnterpriseClick?: () => void;
}

export const PlanAudienceSelector: React.FC<PlanAudienceSelectorProps> = React.memo(({
  audience,
  onSelectAudience,
  onEnterpriseClick,
}) => {
  return (
    <div className="flex justify-center pt-1">
      <div
        role="tablist"
        aria-label="Seletor de Perfil"
        className="p-1 bg-muted/70 dark:bg-neutral-900/90 border border-border dark:border-neutral-800 rounded-full inline-flex items-center gap-1 shadow-xs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={audience === "prof"}
          onClick={() => onSelectAudience("prof")}
          className={`px-3.5 sm:px-4 py-2 sm:py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 min-h-[44px] sm:min-h-[36px] ${
            audience === "prof"
              ? "bg-background text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
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
          className={`px-3.5 sm:px-4 py-2 sm:py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 min-h-[44px] sm:min-h-[36px] ${
            audience === "clinic"
              ? "bg-background text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Clínica com Equipe</span>
        </button>

        {onEnterpriseClick ? (
          <button
            type="button"
            role="tab"
            aria-selected={false}
            onClick={onEnterpriseClick}
            className="px-3 sm:px-3.5 py-2 sm:py-1.5 rounded-full text-xs font-semibold text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 transition-all flex items-center gap-1.5 min-h-[44px] sm:min-h-[36px]"
            title="Para redes de clínicas ou hospitais"
          >
            <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
            <span>Enterprise</span>
          </button>
        ) : (
          <a
            href="#enterprise-banner"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById("enterprise-banner");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="px-3 sm:px-3.5 py-2 sm:py-1.5 rounded-full text-xs font-semibold text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 transition-all flex items-center gap-1.5 min-h-[44px] sm:min-h-[36px]"
            title="Para redes de clínicas ou hospitais"
          >
            <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
            <span>Enterprise</span>
          </a>
        )}
      </div>
    </div>
  );
});

PlanAudienceSelector.displayName = "PlanAudienceSelector";
