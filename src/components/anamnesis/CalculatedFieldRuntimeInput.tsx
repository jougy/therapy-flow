import React, { useMemo, useCallback } from "react";
import { FieldLabelWithHelp } from "@/components/anamnesis/FieldLabelWithHelp";
import {
  CalculatedVariableInputGrid,
  CalculatedOutputCardList,
  type EvaluatedOutputItem,
} from "./calculated-runtime";
import { evaluateMathFormula, wouldCauseCircularDependency } from "@/lib/safe-math-evaluator";
import { DEFAULT_CALCULATED_CONFIG } from "@/types/calculated-field";
import type {
  AnamnesisField,
  CalculatedFieldConfig,
  CalculatedFieldRange,
  CalculatedFieldResponseValue,
} from "@/lib/anamnesis-forms";

export interface CalculatedFieldRuntimeInputProps {
  field: AnamnesisField;
  value: unknown; // Estrutura: CalculatedFieldResponseValue ({ inputs, outputs })
  onChange: (value: CalculatedFieldResponseValue) => void;
  allFormValues?: Record<string, unknown>;
  allFields?: AnamnesisField[];
  disabled?: boolean;
  onFocus?: () => void;
  isEditorMode?: boolean;
  onReorderVariables?: (fromIdx: number, toIdx: number) => void;
}

export const CalculatedFieldRuntimeInput: React.FC<CalculatedFieldRuntimeInputProps> = ({
  field,
  value,
  onChange,
  allFormValues = {},
  allFields = [],
  disabled = false,
  onFocus,
  isEditorMode = false,
  onReorderVariables,
}) => {
  const config: CalculatedFieldConfig = field.calculatedConfig ?? DEFAULT_CALCULATED_CONFIG;

  // Extrair o estado atual armazenado
  const currentInputs = useMemo<Record<string, number | null>>(() => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const rec = value as Record<string, unknown>;
      if (rec.inputs && typeof rec.inputs === "object") {
        return rec.inputs as Record<string, number | null>;
      }
    }
    return {};
  }, [value]);

  // Resolver as variáveis ativas considerando se alguma é puxada reativamente de outro campo
  const resolvedVariables = useMemo(() => {
    const vars: Record<string, number | null> = {};

    for (const v of config.variables) {
      if (v.sourceFieldId) {
        // Previne referência circular em runtime (ex: Campo A depende de B e B de A)
        const hasCycle = wouldCauseCircularDependency(field.id, v.sourceFieldId, allFields);
        if (hasCycle) {
          vars[v.name] = null;
          continue;
        }

        // Puxa o resultado do outro campo calculado
        const sourceVal = allFormValues[v.sourceFieldId];
        if (sourceVal && typeof sourceVal === "object" && !Array.isArray(sourceVal)) {
          const rec = sourceVal as Record<string, unknown>;
          if (rec.outputs && typeof rec.outputs === "object") {
            const outVals = Object.values(rec.outputs as Record<string, unknown>);
            const num = Number(outVals[0]);
            vars[v.name] = Number.isFinite(num) ? num : null;
            continue;
          }
        }
        vars[v.name] = null;
      } else {
        const stored = currentInputs[v.name];
        vars[v.name] = typeof stored === "number" && Number.isFinite(stored) ? stored : null;
      }
    }

    return vars;
  }, [config.variables, currentInputs, allFormValues, field.id, allFields]);

  // Calcular os resultados instantaneamente
  const calculatedOutputs = useMemo<EvaluatedOutputItem[]>(() => {
    return config.outputs.map((out) => {
      const evalResult = evaluateMathFormula(
        out.formula,
        resolvedVariables,
        out.precision ?? 2
      );

      // Encontrar a faixa correspondente, se houver
      let matchedRange: CalculatedFieldRange | undefined;
      if (evalResult.success && typeof evalResult.value === "number" && config.ranges) {
        const val = evalResult.value;
        matchedRange = config.ranges.find((r) => {
          const minOk = r.min === undefined || val >= r.min;
          const maxOk = r.max === undefined || val <= r.max;
          return minOk && maxOk;
        });
      }

      return {
        ...out,
        evalResult,
        matchedRange,
      };
    });
  }, [config.outputs, config.ranges, resolvedVariables]);

  // Notificar pai quando as entradas mudarem
  const handleInputChange = useCallback((varName: string, rawVal: string) => {
    const parsed = rawVal.trim() === "" ? null : Number(rawVal.replace(",", "."));
    const nextInputs = {
      ...currentInputs,
      [varName]: Number.isFinite(parsed) ? parsed : null,
    };

    // Calcular novo snapshot de outputs para persistência
    const nextOutputs: Record<string, number | null> = {};
    for (const out of config.outputs) {
      const res = evaluateMathFormula(
        out.formula,
        { ...resolvedVariables, [varName]: parsed },
        out.precision ?? 2
      );
      nextOutputs[out.name] = res.success && typeof res.value === "number" ? res.value : null;
    }

    onChange({
      inputs: nextInputs,
      outputs: nextOutputs,
    });
  }, [config.outputs, currentInputs, onChange, resolvedVariables]);

  return (
    <div className="min-w-0 space-y-3">
      <FieldLabelWithHelp
        label={field.label}
        helpText={field.helpText}
        required={field.required}
      />

      {/* Grid de Entradas / Variáveis */}
      <CalculatedVariableInputGrid
        config={config}
        allFields={allFields}
        resolvedVariables={resolvedVariables}
        disabled={disabled}
        onInputChange={handleInputChange}
        onFocus={onFocus}
        isEditorMode={isEditorMode}
        onReorderVariables={onReorderVariables}
      />

      {/* Cards de Saída e Classificação Clínica */}
      <CalculatedOutputCardList outputs={calculatedOutputs} />
    </div>
  );
};
