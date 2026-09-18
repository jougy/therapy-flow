import React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import type {
  AnamnesisField,
  CalculatedFieldConfig,
  CalculatedFieldVariable,
} from "@/lib/anamnesis-forms";
import { wouldCauseCircularDependency } from "@/lib/safe-math-evaluator";

export interface VariablesSubTabProps {
  fieldId: string;
  config: CalculatedFieldConfig;
  allFields?: AnamnesisField[];
  otherCalculatedFields: AnamnesisField[];
  onUpdateConfig: (newConfig: Partial<CalculatedFieldConfig>) => void;
}

export const VariablesSubTab: React.FC<VariablesSubTabProps> = ({
  fieldId,
  config,
  allFields = [],
  otherCalculatedFields,
  onUpdateConfig,
}) => {
  const handleAddVariable = () => {
    const existingNames = new Set(config.variables.map((v) => v.name.toUpperCase()));
    let nextChar = "A";
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(65 + i);
      if (!existingNames.has(char)) {
        nextChar = char;
        break;
      }
    }
    const newVar: CalculatedFieldVariable = {
      id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: nextChar,
      label: `Entrada ${nextChar}`,
      unit: "",
    };
    onUpdateConfig({ variables: [...config.variables, newVar] });
  };

  const handleUpdateVariable = (id: string, updates: Partial<CalculatedFieldVariable>) => {
    const updated = config.variables.map((v) => (v.id === id ? { ...v, ...updates } : v));
    onUpdateConfig({ variables: updated });
  };

  const handleRemoveVariable = (id: string) => {
    onUpdateConfig({ variables: config.variables.filter((v) => v.id !== id) });
  };

  const handleMoveVariable = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= config.variables.length) return;
    const reordered = [...config.variables];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    onUpdateConfig({ variables: reordered });
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold text-foreground">Variáveis de Entrada</Label>
        <Button
          type="button"
          variant="outline"
          size="xs"
          aria-label="Adicionar Variável"
          onClick={handleAddVariable}
          className="text-xs gap-1 h-7 text-primary hover:bg-primary/5 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          + Adicionar
        </Button>
      </div>

      <div className="space-y-2.5">
        {config.variables.map((variable, index) => (
          <Card key={variable.id} className="border-border/60 shadow-none bg-background/50">
            <CardContent className="p-3 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    onClick={() => handleMoveVariable(index, -1)}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30 shrink-0"
                    aria-label={`Mover variável ${variable.name} para cima`}
                    title="Mover para cima"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === config.variables.length - 1}
                    onClick={() => handleMoveVariable(index, 1)}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30 shrink-0"
                    aria-label={`Mover variável ${variable.name} para baixo`}
                    title="Mover para baixo"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                  {variable.name}
                </span>
                <Input
                  value={variable.label}
                  onChange={(e) => handleUpdateVariable(variable.id, { label: e.target.value })}
                  placeholder="Nome da medição (Ex: Peso)"
                  className="h-8 text-xs flex-1"
                />
                <Input
                  value={variable.unit ?? ""}
                  onChange={(e) => handleUpdateVariable(variable.id, { unit: e.target.value })}
                  placeholder="Unid (kg)"
                  className="h-8 text-xs w-20 shrink-0 text-center"
                />
                {config.variables.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveVariable(variable.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    aria-label={`Remover variável ${variable.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Origem da Variável (Manual ou Puxar de outro campo calculado) */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">Origem:</span>
                <Select
                  value={variable.sourceFieldId || "manual"}
                  onValueChange={(val) =>
                    handleUpdateVariable(variable.id, {
                      sourceFieldId: val === "manual" ? undefined : val,
                    })
                  }
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="Digitação Manual" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Digitação Manual do Profissional</SelectItem>
                    {otherCalculatedFields.map((cf) => {
                      const isCircular = wouldCauseCircularDependency(fieldId, cf.id, allFields);
                      return (
                        <SelectItem
                          key={cf.id}
                          value={cf.id}
                          disabled={isCircular}
                          className={isCircular ? "opacity-50 cursor-not-allowed" : ""}
                        >
                          {isCircular ? `(Ciclo Bloqueado) ${cf.label}` : `Puxar de: ${cf.label}`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
