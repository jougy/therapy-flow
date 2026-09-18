import React from "react";
import { Plus, Trash2 } from "lucide-react";
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
  CalculatedFieldConfig,
  CalculatedFieldOutput,
} from "@/lib/anamnesis-forms";

export interface FormulasSubTabProps {
  config: CalculatedFieldConfig;
  testInputs?: Record<string, number>;
  onTestInputChange?: (varName: string, value: number) => void;
  onUpdateConfig: (newConfig: Partial<CalculatedFieldConfig>) => void;
}

const MATH_OPERATORS = ["(", ")", "+", "-", "*", "/", "^", "%", "//", "√"] as const;

export const FormulasSubTab: React.FC<FormulasSubTabProps> = ({
  config,
  onUpdateConfig,
}) => {
  const handleAddOutput = () => {
    const newOutput: CalculatedFieldOutput = {
      id: `out_${Date.now()}`,
      name: `Resultado ${config.outputs.length + 1}`,
      formula: config.variables[0]?.name || "0",
      unit: "",
      precision: 2,
    };
    onUpdateConfig({ outputs: [...config.outputs, newOutput] });
  };

  const handleUpdateOutput = (id: string, updates: Partial<CalculatedFieldOutput>) => {
    const updated = config.outputs.map((o) => (o.id === id ? { ...o, ...updates } : o));
    onUpdateConfig({ outputs: updated });
  };

  const handleRemoveOutput = (id: string) => {
    if (config.outputs.length <= 1) return; // Mínimo 1 saída
    onUpdateConfig({ outputs: config.outputs.filter((o) => o.id !== id) });
  };

  const insertIntoFormula = (outputId: string, textToInsert: string) => {
    const output = config.outputs.find((o) => o.id === outputId);
    if (!output) return;
    const currentFormula = output.formula || "";
    handleUpdateOutput(outputId, {
      formula: `${currentFormula} ${textToInsert} `.replace(/\s+/g, " ").trim(),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground">
          Fórmulas & Saídas de Resultado
        </Label>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={handleAddOutput}
          className="text-xs gap-1 h-7 text-primary hover:bg-primary/5"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar Saída
        </Button>
      </div>

      {config.outputs.map((output) => {
        return (
          <Card key={output.id} className="border-border/70 shadow-none bg-background/60">
            <CardContent className="p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={output.name}
                  onChange={(e) => handleUpdateOutput(output.id, { name: e.target.value })}
                  placeholder="Nome do resultado (Ex: IMC)"
                  className="h-8 text-xs font-medium flex-1"
                />
                <Input
                  value={output.unit ?? ""}
                  onChange={(e) => handleUpdateOutput(output.id, { unit: e.target.value })}
                  placeholder="Unidade (kg/m²)"
                  className="h-8 text-xs w-24 shrink-0 text-center"
                />
                <Select
                  value={String(output.precision ?? 2)}
                  onValueChange={(val) =>
                    handleUpdateOutput(output.id, { precision: Number(val) })
                  }
                >
                  <SelectTrigger className="h-8 text-xs w-24 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 casas</SelectItem>
                    <SelectItem value="1">1 casa</SelectItem>
                    <SelectItem value="2">2 casas</SelectItem>
                    <SelectItem value="3">3 casas</SelectItem>
                    <SelectItem value="4">4 casas</SelectItem>
                  </SelectContent>
                </Select>
                {config.outputs.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveOutput(output.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    aria-label={`Remover saída ${output.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Campo de Fórmula com Teclado Interativo */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Expressão Matemática:</span>
                  <span className="font-mono text-[10px] text-primary">
                    A, B, +, -, *, /, ^, %, //, √
                  </span>
                </div>
                <Input
                  value={output.formula}
                  onChange={(e) => handleUpdateOutput(output.id, { formula: e.target.value })}
                  placeholder="Ex: A / ((B / 100) ^ 2)"
                  className="font-mono text-xs h-8 bg-muted/20"
                />

                {/* Barra de Ferramentas / Teclado Matemático */}
                <div className="space-y-1.5 pt-1">
                  {/* Chips de Variáveis */}
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-semibold text-muted-foreground mr-1">
                      Variáveis:
                    </span>
                    {config.variables.map((v) => (
                      <Button
                        key={v.id}
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => insertIntoFormula(output.id, v.name)}
                        className="h-6 px-1.5 text-[11px] font-bold font-mono text-primary bg-primary/10 hover:bg-primary/20"
                      >
                        +{v.name} ({v.label})
                      </Button>
                    ))}
                  </div>

                  {/* Botões de Operadores */}
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-semibold text-muted-foreground mr-1">
                      Operadores:
                    </span>
                    {MATH_OPERATORS.map((op) => (
                      <Button
                        key={op}
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => insertIntoFormula(output.id, op)}
                        className="h-6 w-6 p-0 text-xs font-mono font-bold hover:border-primary/50"
                      >
                        {op}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
