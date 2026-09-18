import { Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SundayCountdownResult } from "@/lib/trashUtils";

interface TrashCountdownBannerProps {
  countdown: SundayCountdownResult;
}

export const TrashCountdownBanner = ({ countdown }: TrashCountdownBannerProps) => {
  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="text-sm text-amber-950 dark:text-amber-200">
            <p className="font-medium">
              Itens excluídos são mantidos nesta lixeira até o próximo domingo às 23:59.
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300/80 mt-0.5">
              Após essa data, o expurgo definitivo e permanente é executado automaticamente. Você pode restaurar qualquer item com 1 clique antes do domingo.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2 bg-amber-100/90 dark:bg-amber-900/40 px-3 py-1.5 rounded-lg border border-amber-300/50 text-xs font-semibold text-amber-900 dark:text-amber-100">
          <Calendar className="h-4 w-4" />
          <span>Expurgo: {countdown.nextSundayDateFormatted}</span>
          <Badge variant="outline" className="bg-amber-200/60 text-amber-900 border-amber-300 text-[10px] ml-1">
            {countdown.daysRemaining === 0 ? "Hoje à noite" : `em ${countdown.daysRemaining} dias`}
          </Badge>
        </div>
      </div>
    </div>
  );
};
