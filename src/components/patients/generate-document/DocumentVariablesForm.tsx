import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck, Eye } from "lucide-react";
import { formatVariableLabel, KNOWN_VARIABLES } from "./types";

interface DocumentVariablesFormProps {
  customVariables: string[];
  customVariableValues: Record<string, string>;
  onCustomVariableChange: (key: string, value: string) => void;
  defaultKnownValues: Record<string, string>;
  adjustedKnownValues: Record<string, string>;
  onAdjustedKnownChange: (key: string, value: string) => void;
  onResetAdjustedKnown: () => void;
  onGoToPreview: () => void;
}

export const DocumentVariablesForm: React.FC<DocumentVariablesFormProps> = ({
  customVariables,
  customVariableValues,
  onCustomVariableChange,
  defaultKnownValues,
  adjustedKnownValues,
  onAdjustedKnownChange,
  onResetAdjustedKnown,
  onGoToPreview,
}) => {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Seção 1: Variáveis Customizadas do Modelo */}
      {customVariables.length > 0 ? (
        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <div>
              <h3 className="font-semibold text-sm text-foreground">
                Campos Específicos do Modelo Selecionado
              </h3>
              <p className="text-xs text-muted-foreground">
                Preencha os valores abaixo para que sejam substituídos automaticamente no documento.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {customVariables.map((vKey) => (
              <div key={vKey} className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center justify-between">
                  <span>{formatVariableLabel(vKey)}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{vKey}</span>
                </Label>
                <Input
                  placeholder={`Informe o valor para ${formatVariableLabel(vKey)}...`}
                  value={customVariableValues[vKey] || ""}
                  onChange={(e) => onCustomVariableChange(vKey, e.target.value)}
                  className="h-9 text-xs bg-background"
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border bg-card text-center text-xs text-muted-foreground">
          Este modelo utiliza apenas as variáveis padrão do sistema (já preenchidas automaticamente).
        </div>
      )}

      {/* Seção 2: Conferir / Ajustar Variáveis Padrão Conhecidas */}
      <div className="p-4 rounded-xl border bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-sm text-foreground">
                Variáveis Automáticas do Sistema
              </h3>
              <p className="text-xs text-muted-foreground">
                Preenchidas automaticamente a partir do prontuário, profissional e clínica.
              </p>
            </div>
          </div>
          {Object.keys(adjustedKnownValues).length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetAdjustedKnown}
              className="text-xs h-7 text-muted-foreground hover:text-foreground"
            >
              Restaurar Padrões
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {KNOWN_VARIABLES.map((key) => {
            const currentValue =
              adjustedKnownValues[key] !== undefined
                ? adjustedKnownValues[key]
                : defaultKnownValues[key] || "";

            return (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center justify-between">
                  <span>{formatVariableLabel(key)}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{key}</span>
                </Label>
                <Input
                  value={currentValue}
                  onChange={(e) => onAdjustedKnownChange(key, e.target.value)}
                  placeholder={`Valor de ${formatVariableLabel(key)}...`}
                  className="h-9 text-xs bg-background"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={onGoToPreview}
          className="gap-2 text-xs font-medium"
        >
          <Eye className="w-4 h-4" />
          <span>Conferir Pré-visualização</span>
        </Button>
      </div>
    </div>
  );
};
