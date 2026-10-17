import React from "react";
import { ClipboardPaste, Copy, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AgendaViewMode, CopiedPeriodState } from "./types";

export interface AgendaPeriodClipboardActionsProps {
  viewMode: AgendaViewMode;
  copiedPeriod: CopiedPeriodState | null;
  isPasting: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onCancel: () => void;
  canScheduleWrite?: boolean;
}

export function AgendaPeriodClipboardActions({
  viewMode,
  copiedPeriod,
  isPasting,
  onCopy,
  onPaste,
  onCancel,
  canScheduleWrite = true,
}: AgendaPeriodClipboardActionsProps) {
  if (viewMode === "year") {
    return null;
  }

  const periodName = viewMode === "day" ? "dia" : viewMode === "week" ? "semana" : "mês";

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {!copiedPeriod ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCopy}
          className="h-8 gap-1.5 rounded-lg text-xs font-medium text-foreground hover:text-primary shrink-0 border-dashed hover:border-primary/50"
          title={`Copiar compromissos do(a) ${periodName} atual`}
        >
          <Copy className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline">Copiar {periodName}</span>
          <span className="sm:hidden">Copiar</span>
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onPaste}
            disabled={isPasting || !canScheduleWrite}
            className="h-8 gap-1.5 rounded-lg text-xs font-semibold shrink-0 bg-primary text-primary-foreground shadow-xs animate-in fade-in"
            title={
              !canScheduleWrite
                ? "Você não possui permissão para criar agendamentos"
                : `Colar ${copiedPeriod.events.length} compromissos copiados no período atual`
            }
          >
            {isPasting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ClipboardPaste className="h-3.5 w-3.5" />
            )}
            <span>Colar</span>
            <Badge
              variant="secondary"
              className="ml-0.5 px-1.5 py-0 text-[10px] h-4 bg-white/20 text-primary-foreground"
            >
              {copiedPeriod.events.length}
            </Badge>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isPasting}
            className="h-8 px-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            title="Cancelar modo de cópia"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cancelar</span>
          </Button>
        </div>
      )}
    </div>
  );
}
