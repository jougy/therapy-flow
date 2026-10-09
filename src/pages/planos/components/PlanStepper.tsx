import React from "react";
import { Slider } from "@/components/ui/slider";

export interface PlanStepperProps {
  stepIndex: number;
  onChangeStep: (step: number) => void;
  audience: "prof" | "clinic" | "enterprise";
}

const STEP_DATA = {
  prof: [
    { name: "Básico", hint: "Iniciando" },
    { name: "Médio", hint: "Alta demanda" },
    { name: "Top", hint: "Com secretária" },
  ],
  clinic: [
    { name: "Básico", hint: "Consultórios" },
    { name: "Médio", hint: "Consolidadas" },
    { name: "Top", hint: "Grandes redes" },
  ],
  enterprise: [
    { name: "Custom", hint: "Sob medida" },
    { name: "Multi-unidades", hint: "Redes" },
    { name: "Hospitais", hint: "Corporativo" },
  ],
};

export const PlanStepper: React.FC<PlanStepperProps> = React.memo(({
  stepIndex,
  onChangeStep,
  audience,
}) => {
  const steps = STEP_DATA[audience] || STEP_DATA.prof;

  return (
    <div className="w-full bg-card text-card-foreground border border-border rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col gap-3 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
          Porte do seu atendimento
        </span>
        <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-500/20">
          {steps[stepIndex]?.name}
        </span>
      </div>

      <div className="relative py-2 px-1">
        <Slider
          value={[stepIndex]}
          onValueChange={(val) => {
            if (val && val.length > 0) onChangeStep(val[0]);
          }}
          min={0}
          max={2}
          step={1}
          aria-label="Selecionar plano por porte"
          className="cursor-pointer py-1"
        />
      </div>

      <div className="grid grid-cols-3 gap-1">
        {steps.map((step, idx) => {
          const isActive = idx === stepIndex;
          const alignClass =
            idx === 0 ? "text-left items-start" : idx === 2 ? "text-right items-end" : "text-center items-center";

          return (
            <button
              key={step.name + idx}
              type="button"
              onClick={() => onChangeStep(idx)}
              aria-pressed={isActive}
              className={`flex flex-col gap-0.5 p-1.5 rounded-xl transition-all cursor-pointer ${alignClass} ${
                isActive
                  ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10 dark:bg-blue-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <span className="text-xs sm:text-sm font-extrabold">{step.name}</span>
              <span className="text-[10px] sm:text-[11px] font-medium opacity-80">
                {step.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

PlanStepper.displayName = "PlanStepper";

