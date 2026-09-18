import React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { AnamnesisField, CalculatedFieldConfig } from "@/lib/anamnesis-forms";

export interface CalculatedVariableInputGridProps {
  config: CalculatedFieldConfig;
  allFields?: AnamnesisField[];
  resolvedVariables: Record<string, number | null>;
  disabled?: boolean;
  onInputChange: (varName: string, rawVal: string) => void;
  onFocus?: () => void;
  isEditorMode?: boolean;
  onReorderVariables?: (fromIdx: number, toIdx: number) => void;
}

export const CalculatedVariableInputGrid: React.FC<CalculatedVariableInputGridProps> = ({
  config,
  allFields = [],
  resolvedVariables,
  disabled = false,
  onInputChange,
  onFocus,
  isEditorMode = false,
  onReorderVariables,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {config.variables.map((v, index) => {
        const isDerived = !!v.sourceFieldId;
        const sourceField = isDerived ? allFields.find((f) => f.id === v.sourceFieldId) : null;
        const val = resolvedVariables[v.name];

        return (
          <div key={v.id} className="space-y-1.5 rounded-lg border bg-card/60 p-3 shadow-2xs relative group">
            <div className="flex items-center justify-between gap-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5 min-w-0">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[11px] font-bold text-primary">
                  {v.name}
                </span>
                <span className="truncate">{v.label}</span>
              </Label>
              <div className="flex items-center gap-1 shrink-0">
                {isEditorMode && onReorderVariables && (
                  <div className="flex items-center gap-0.5 bg-muted/60 rounded px-0.5 py-0.5 border border-border/40">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderVariables(index, index - 1);
                      }}
                      className="h-5 w-5 text-muted-foreground hover:text-foreground disabled:opacity-25"
                      aria-label={`Mover variável ${v.name} para a esquerda`}
                      title="Mover para esquerda"
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === config.variables.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderVariables(index, index + 1);
                      }}
                      className="h-5 w-5 text-muted-foreground hover:text-foreground disabled:opacity-25"
                      aria-label={`Mover variável ${v.name} para a direita`}
                      title="Mover para direita"
                    >
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {v.unit && (
                  <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {v.unit}
                  </span>
                )}
              </div>
            </div>

            {isDerived ? (
              <div className="flex items-center justify-between rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground truncate">
                  Puxado de {sourceField?.label || "outro campo"}:
                </span>
                <span className="font-mono font-bold text-primary">
                  {val !== null && val !== undefined ? `${val} ${v.unit || ""}` : "Aguardando cálculo..."}
                </span>
              </div>
            ) : (
              <Input
                type="text"
                inputMode="decimal"
                disabled={disabled}
                placeholder={v.label || "0"}
                value={val !== null && val !== undefined ? String(val) : ""}
                onChange={(e) => onInputChange(v.name, e.target.value)}
                onFocus={onFocus}
                className="h-9 text-xs font-medium"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
