import type { CalculatedFieldConfig } from "@/lib/anamnesis-forms";

export type CalculatedSubTab = "variables" | "formulas" | "ranges";

export interface RangeColorOption {
  value: string;
  label: string;
  bg: string;
  border: string;
  text: string;
}

export const RANGE_COLOR_OPTIONS: RangeColorOption[] = [
  { value: "blue", label: "Azul", bg: "bg-blue-500", border: "border-blue-500", text: "text-blue-600 dark:text-blue-400" },
  { value: "emerald", label: "Verde", bg: "bg-emerald-500", border: "border-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  { value: "amber", label: "Amarelo / Laranja", bg: "bg-amber-500", border: "border-amber-500", text: "text-amber-600 dark:text-amber-400" },
  { value: "orange", label: "Laranja Escuro", bg: "bg-orange-500", border: "border-orange-500", text: "text-orange-600 dark:text-orange-400" },
  { value: "red", label: "Vermelho", bg: "bg-red-500", border: "border-red-500", text: "text-red-600 dark:text-red-400" },
  { value: "purple", label: "Roxo", bg: "bg-purple-500", border: "border-purple-500", text: "text-purple-600 dark:text-purple-400" },
];

export const RANGE_COLOR_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-700 dark:text-blue-300" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-700 dark:text-emerald-300" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-700 dark:text-amber-300" },
  orange: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-700 dark:text-orange-300" },
  red: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-700 dark:text-red-300" },
  purple: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-700 dark:text-purple-300" },
};

export const DEFAULT_CALCULATED_CONFIG: CalculatedFieldConfig = {
  variables: [
    { id: "var_1", name: "A", label: "Entrada A", unit: "" },
    { id: "var_2", name: "B", label: "Entrada B", unit: "" },
  ],
  outputs: [
    {
      id: "out_1",
      name: "Resultado",
      formula: "A + B",
      unit: "",
      precision: 2,
    },
  ],
  ranges: [],
};

