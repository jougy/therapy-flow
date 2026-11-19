import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currencyDigitsToInput } from "@/lib/session-operations";

const CREDIT_PRESETS = [
  { label: "R$ 100", cents: 10_000 },
  { label: "R$ 200", cents: 20_000 },
  { label: "R$ 500", cents: 50_000 },
] as const;

const CREDIT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "cartao_credito", label: "Cartão" },
  { value: "dinheiro", label: "Dinheiro" },
] as const;

export interface AddCreditSheetFormProps {
  creditPreset: number | "custom";
  onCreditPresetChange: (preset: number | "custom") => void;
  creditCustomInput: string;
  onCreditCustomInputChange: (value: string) => void;
  creditMethod: string;
  onCreditMethodChange: (method: string) => void;
}

export const AddCreditSheetForm: React.FC<AddCreditSheetFormProps> = ({
  creditPreset,
  onCreditPresetChange,
  creditCustomInput,
  onCreditCustomInputChange,
  creditMethod,
  onCreditMethodChange,
}) => (
  <>
    <div className="space-y-2">
      <Label>Valor do crédito</Label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CREDIT_PRESETS.map((preset) => (
          <Button
            key={preset.cents}
            type="button"
            variant={creditPreset === preset.cents ? "default" : "outline"}
            onClick={() => onCreditPresetChange(preset.cents)}
            className="min-h-[44px]"
          >
            {preset.label}
          </Button>
        ))}
        <Button
          type="button"
          variant={creditPreset === "custom" ? "default" : "outline"}
          onClick={() => onCreditPresetChange("custom")}
          className="min-h-[44px]"
        >
          Outro
        </Button>
      </div>
    </div>

    {creditPreset === "custom" ? (
      <div className="space-y-1.5">
        <Label htmlFor="custom-credit-input">Valor personalizado (R$)</Label>
        <Input
          id="custom-credit-input"
          inputMode="numeric"
          placeholder="0,00"
          value={creditCustomInput}
          onChange={(e) => onCreditCustomInputChange(currencyDigitsToInput(e.target.value))}
          className="min-h-[44px]"
        />
      </div>
    ) : null}

    <div className="space-y-2">
      <Label>Forma de pagamento</Label>
      <div className="grid grid-cols-3 gap-2">
        {CREDIT_METHODS.map((m) => (
          <Button
            key={m.value}
            type="button"
            variant={creditMethod === m.value ? "default" : "outline"}
            onClick={() => onCreditMethodChange(m.value)}
            className="min-h-[44px]"
          >
            {m.label}
          </Button>
        ))}
      </div>
    </div>
  </>
);
