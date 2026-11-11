import React from "react";
import { DollarSign, Receipt, Users } from "lucide-react";
import type { AffiliateRecord } from "./types";

export interface AffiliateMetricsCardsProps {
  affiliate: AffiliateRecord;
}

export const AffiliateMetricsCards: React.FC<AffiliateMetricsCardsProps> = ({ affiliate }) => {
  const formattedLifetimeBrl = ((affiliate.lifetime_commission_cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-full min-w-0">
      <div className="p-3 rounded-lg border bg-muted/30 flex items-center gap-3 min-w-0">
        <Users className="h-5 w-5 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground font-medium uppercase truncate">Indicados Ativos</p>
          <p className="text-lg font-bold truncate" data-testid="metric-active-referrals">
            {affiliate.active_referrals_count ?? 0}
          </p>
        </div>
      </div>
      <div className="p-3 rounded-lg border bg-muted/30 flex items-center gap-3 min-w-0">
        <Receipt className="h-5 w-5 text-emerald-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground font-medium uppercase truncate">Faturas Pagas</p>
          <p className="text-lg font-bold truncate" data-testid="metric-total-sales">
            {affiliate.total_sales_count ?? 0}
          </p>
        </div>
      </div>
      <div className="p-3 rounded-lg border bg-muted/30 flex items-center gap-3 min-w-0">
        <DollarSign className="h-5 w-5 text-amber-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground font-medium uppercase truncate">Comissão Total</p>
          <p
            className="text-lg font-bold truncate text-emerald-700 dark:text-emerald-400"
            data-testid="metric-lifetime-commission"
          >
            {formattedLifetimeBrl}
          </p>
        </div>
      </div>
    </div>
  );
};
