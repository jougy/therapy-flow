import React from "react";
import { Calculator, AlertCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RANGE_COLOR_STYLES } from "@/types/calculated-field";
import type { MathEvalResult } from "@/lib/safe-math-evaluator";
import type { CalculatedFieldOutput, CalculatedFieldRange } from "@/lib/anamnesis-forms";
import { cn } from "@/lib/utils";

export interface EvaluatedOutputItem extends CalculatedFieldOutput {
  evalResult: MathEvalResult;
  matchedRange?: CalculatedFieldRange;
}

export interface CalculatedOutputCardListProps {
  outputs: EvaluatedOutputItem[];
}

export const CalculatedOutputCardList: React.FC<CalculatedOutputCardListProps> = ({
  outputs,
}) => {
  return (
    <div className="space-y-2 pt-1">
      {outputs.map((out) => {
        const { evalResult, matchedRange } = out;
        const colorTheme = matchedRange
          ? RANGE_COLOR_STYLES[matchedRange.color] || RANGE_COLOR_STYLES.blue
          : null;

        return (
          <Card
            key={out.id}
            className={cn(
              "transition-all border shadow-xs overflow-hidden",
              colorTheme ? cn(colorTheme.bg, colorTheme.border) : "bg-muted/30 border-border/80"
            )}
          >
            <CardContent className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">{out.name}</span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    ({out.formula})
                  </span>
                </div>

                {evalResult.success && typeof evalResult.value === "number" ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black tracking-tight text-foreground">
                      {evalResult.value}
                    </span>
                    {out.unit && (
                      <span className="text-xs font-semibold text-muted-foreground">
                        {out.unit}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                    Preencha todos os campos acima para obter o cálculo.
                  </p>
                )}
              </div>

              {/* Badge de Classificação Clínica */}
              {evalResult.success && matchedRange && colorTheme && (
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs px-2.5 py-1 font-semibold flex items-center gap-1.5 shadow-2xs",
                      colorTheme.bg,
                      colorTheme.border,
                      colorTheme.text
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span>{matchedRange.label}</span>
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
