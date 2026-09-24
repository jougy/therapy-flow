import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface HorizontalStepperNavigatorProps {
  currentStep: number;
  totalSteps: number;
  completedSteps?: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

/**
 * Garante que o índice da etapa esteja estritamente dentro dos limites válidos [0, totalSteps - 1].
 */
export const safeStepIndex = (step: number, totalSteps: number): number => {
  if (totalSteps <= 0) return 0;
  return Math.min(Math.max(0, step), totalSteps - 1);
};

export const HorizontalStepperNavigator: React.FC<HorizontalStepperNavigatorProps> = ({
  currentStep,
  totalSteps,
  completedSteps = 0,
  onPrev,
  onNext,
  className,
}) => {
  if (totalSteps <= 0) return null;

  const isFirst = currentStep <= 0;
  const isLast = currentStep >= totalSteps - 1;

  return (
    <nav
      role="navigation"
      aria-label="Navegação de etapas"
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 rounded-lg border bg-muted/20 select-none",
        className
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        disabled={isFirst}
        aria-label="Etapa anterior"
        className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <div
        className="flex flex-col items-center justify-center gap-1 text-center min-w-0 flex-1 px-2"
        aria-live="polite"
      >
        <span className="text-xs font-semibold text-foreground tracking-tight">
          {currentStep + 1} de {totalSteps} • {completedSteps} preenchidas
        </span>
        {totalSteps > 1 && (
          <div className="w-full max-w-[160px] h-1.5 bg-muted/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${Math.min(100, Math.max(0, ((currentStep + 1) / totalSteps) * 100))}%`,
              }}
            />
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        disabled={isLast}
        aria-label="Próxima etapa"
        className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </nav>
  );
};
