import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RANGE_COLOR_OPTIONS, RANGE_COLOR_STYLES } from "@/types/calculated-field";
import type {
  CalculatedFieldConfig,
  CalculatedFieldRange,
} from "@/lib/anamnesis-forms";
import { cn } from "@/lib/utils";

export interface RangesSubTabProps {
  config: CalculatedFieldConfig;
  onUpdateConfig: (newConfig: Partial<CalculatedFieldConfig>) => void;
}

export const RangesSubTab: React.FC<RangesSubTabProps> = ({
  config,
  onUpdateConfig,
}) => {
  const handleAddRange = () => {
    const newRange: CalculatedFieldRange = {
      id: `range_${Date.now()}`,
      min: 0,
      max: 100,
      label: "Nova Faixa",
      color: "emerald",
    };
    onUpdateConfig({ ranges: [...(config.ranges || []), newRange] });
  };

  const handleUpdateRange = (id: string, updates: Partial<CalculatedFieldRange>) => {
    const updated = (config.ranges || []).map((r) => (r.id === id ? { ...r, ...updates } : r));
    onUpdateConfig({ ranges: updated });
  };

  const handleRemoveRange = (id: string) => {
    onUpdateConfig({ ranges: (config.ranges || []).filter((r) => r.id !== id) });
  };

  return (
    <div className="space-y-3.5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Label className="text-xs font-semibold text-foreground">
            Faixas Clínicas de Classificação
          </Label>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            Classifica o resultado e colore o card no atendimento conforme o valor obtido.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={handleAddRange}
          className="text-xs gap-1 h-7 text-primary hover:bg-primary/5 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          + Adicionar Faixa
        </Button>
      </div>

      <div className="space-y-2.5">
        {(config.ranges || []).map((range, index) => {
          const colorMeta = RANGE_COLOR_OPTIONS.find((c) => c.value === range.color);
          const styleMeta = RANGE_COLOR_STYLES[range.color] || {
            bg: "bg-primary/10",
            border: "border-primary/20",
            text: "text-primary",
          };

          return (
            <Card key={range.id} className="border-border/60 shadow-none bg-background/50">
              <CardContent className="p-3 space-y-2.5">
                {/* Linha 1: Título "Faixa {index + 1}", badge de cor e botão de lixeira/excluir */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-foreground">
                      Faixa {index + 1}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-medium h-5 px-1.5 flex items-center gap-1",
                        styleMeta.bg,
                        styleMeta.border,
                        styleMeta.text
                      )}
                    >
                      <span
                        className={cn("h-2 w-2 rounded-full shrink-0", colorMeta?.bg || "bg-primary")}
                      />
                      <span className="truncate">{colorMeta?.label || range.color}</span>
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveRange(range.id)}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    aria-label={`Remover faixa ${range.label}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Linha 2: Intervalo numérico com labels: "De" [ Input min ] "até" [ Input max ] */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 font-medium">De</span>
                  <Input
                    type="number"
                    placeholder="Min"
                    value={range.min ?? ""}
                    onChange={(e) =>
                      handleUpdateRange(range.id, {
                        min: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    className="h-7 text-xs flex-1 text-center"
                  />
                  <span className="text-muted-foreground shrink-0 font-medium">até</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={range.max ?? ""}
                    onChange={(e) =>
                      handleUpdateRange(range.id, {
                        max: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    className="h-7 text-xs flex-1 text-center"
                  />
                </div>

                {/* Linha 3: Label "Texto da Classificação / Diagnóstico" [ Input de texto largo ] e "Cor da Badge" [ Seletor de cor ] */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                        Texto da Classificação / Diagnóstico
                      </Label>
                      <Input
                        placeholder="Ex: Peso Normal, Risco Elevado..."
                        value={range.label}
                        onChange={(e) => handleUpdateRange(range.id, { label: e.target.value })}
                        className="h-7 text-xs w-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                        Cor da Badge
                      </Label>
                      <Select
                        value={range.color}
                        onValueChange={(val) => handleUpdateRange(range.id, { color: val })}
                      >
                        <SelectTrigger className="h-7 text-xs w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RANGE_COLOR_OPTIONS.map((c) => (
                            <SelectItem key={c.value} value={c.value} className="text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className={cn("h-2.5 w-2.5 rounded-full", c.bg)} />
                                <span>{c.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {(config.ranges || []).length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
            Nenhuma faixa cadastrada. O resultado será exibido apenas como número neutro.
          </div>
        )}
      </div>
    </div>
  );
};
