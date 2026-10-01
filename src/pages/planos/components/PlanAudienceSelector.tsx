import React from "react";
import { User, Building2 } from "lucide-react";

export interface PlanAudienceSelectorProps {
  audience: "prof" | "clinic";
  onSelectAudience: (aud: "prof" | "clinic") => void;
}

export const PlanAudienceSelector: React.FC<PlanAudienceSelectorProps> = React.memo(({
  audience,
  onSelectAudience,
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
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 min-h-[34px] ${
            audience === "prof"
              ? "bg-background text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Para Profissional</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={audience === "clinic"}
          onClick={() => onSelectAudience("clinic")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 min-h-[34px] ${
            audience === "clinic"
              ? "bg-background text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Para Clínica</span>
        </button>
      </div>
    </div>
  );
});

PlanAudienceSelector.displayName = "PlanAudienceSelector";
