import React, { useState } from "react";
import {
  Calculator,
  SlidersHorizontal,
  Palette,
} from "lucide-react";
import {
  VariablesSubTab,
  FormulasSubTab,
  RangesSubTab,
} from "./calculated-editor";
import {
  DEFAULT_CALCULATED_CONFIG,
  type CalculatedSubTab,
} from "@/types/calculated-field";
import type {
  AnamnesisField,
  CalculatedFieldConfig,
} from "@/lib/anamnesis-forms";
import { cn } from "@/lib/utils";

export interface CalculatedFieldInspectorProps {
  field: AnamnesisField;
  allFields?: AnamnesisField[];
  onUpdateConfig: (config: CalculatedFieldConfig) => void;
}

export const CalculatedFieldInspector: React.FC<CalculatedFieldInspectorProps> = ({
  field,
  allFields = [],
  onUpdateConfig,
}) => {
  const [subTab, setSubTab] = useState<CalculatedSubTab>("variables");
  const [testInputs, setTestInputs] = useState<Record<string, number>>({});

  const config: CalculatedFieldConfig = field.calculatedConfig ?? DEFAULT_CALCULATED_CONFIG;

  // Outros campos calculados do formulário disponíveis como fonte reativa
  const otherCalculatedFields = allFields.filter(
    (f) => f.type === "calculated" && f.id !== field.id
  );

  const updateConfig = (newConfig: Partial<CalculatedFieldConfig>) => {
    onUpdateConfig({
      ...config,
      ...newConfig,
    });
  };

  const handleTestInputChange = (varName: string, value: number) => {
    setTestInputs((prev) => ({
      ...prev,
      [varName]: value,
    }));
  };

  return (
    <div className="space-y-4 pt-2 border-t mt-4">
      {/* Sub-abas compactas */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setSubTab("variables")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-all cursor-pointer",
            subTab === "variables"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Entradas</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("formulas")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-all cursor-pointer",
            subTab === "formulas"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Calculator className="h-3.5 w-3.5" />
          <span>Fórmulas</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("ranges")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-all cursor-pointer",
            subTab === "ranges"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Palette className="h-3.5 w-3.5" />
          <span>Faixas & Cores</span>
        </button>
      </div>

      {/* ABA 1: ENTRADAS / VARIÁVEIS */}
      {subTab === "variables" && (
        <VariablesSubTab
          fieldId={field.id}
          config={config}
          allFields={allFields}
          otherCalculatedFields={otherCalculatedFields}
          onUpdateConfig={updateConfig}
        />
      )}

      {/* ABA 2: FÓRMULAS & SAÍDAS */}
      {subTab === "formulas" && (
        <FormulasSubTab
          config={config}
          testInputs={testInputs}
          onTestInputChange={handleTestInputChange}
          onUpdateConfig={updateConfig}
        />
      )}

      {/* ABA 3: CLASSIFICAÇÃO & CORES */}
      {subTab === "ranges" && (
        <RangesSubTab
          config={config}
          onUpdateConfig={updateConfig}
        />
      )}
    </div>
  );
};
