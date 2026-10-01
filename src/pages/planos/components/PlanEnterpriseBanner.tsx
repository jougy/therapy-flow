import React from "react";
import { MessageSquare, ArrowRight } from "lucide-react";

export const PlanEnterpriseBanner: React.FC = React.memo(() => {
  return (
    <div className="z-10 w-full max-w-7xl mx-auto my-2 p-3 sm:p-4 rounded-2xl bg-card/80 border border-dashed border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-foreground shadow-xs">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
          <MessageSquare className="w-4 h-4" />
        </div>
        <div className="space-y-0.5 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              Plano Enterprise
            </span>
            <h4 className="font-bold text-xs sm:text-sm text-foreground">
              Redes de clínicas ou hospitais? Vamos conversar.
            </h4>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Múltiplas unidades integradas, migração dedicada de servidores antigos, SLAs personalizados e governança avançada.
          </p>
        </div>
      </div>

      <a
        href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20gostaria%20de%20conversar%20sobre%20o%20Plano%20Enterprise%20do%20Pluri%20Fisio"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-foreground text-background hover:bg-primary hover:text-primary-foreground transition-all shrink-0 min-h-[36px]"
      >
        <span>Vamos conversar</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </a>
    </div>
  );
});

PlanEnterpriseBanner.displayName = "PlanEnterpriseBanner";
