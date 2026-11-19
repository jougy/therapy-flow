import * as React from "react";
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
import { currencyDigitsToInput, formatMoneyCents } from "@/lib/session-operations";

const PLAN_SESSION_PRESETS = [5, 10, 20] as const;

export interface NewPlanSheetFormProps {
  planName: string;
  onPlanNameChange: (value: string) => void;
  planSessions: number;
  onPlanSessionsChange: (sessions: number) => void;
  planAmountInput: string;
  onPlanAmountInputChange: (value: string) => void;
  planUnitCents: number;
  planStatus: "pago" | "pendente";
  onPlanStatusChange: (status: "pago" | "pendente") => void;
  planMethod: string;
  onPlanMethodChange: (method: string) => void;
}

export const NewPlanSheetForm: React.FC<NewPlanSheetFormProps> = ({
  planName,
  onPlanNameChange,
  planSessions,
  onPlanSessionsChange,
  planAmountInput,
  onPlanAmountInputChange,
  planUnitCents,
  planStatus,
  onPlanStatusChange,
  planMethod,
  onPlanMethodChange,
}) => (
  <>
    <div className="space-y-1.5">
      <Label htmlFor="plan-name-input">Nome do pacote</Label>
      <Input
        id="plan-name-input"
        value={planName}
        onChange={(e) => onPlanNameChange(e.target.value)}
        className="min-h-[44px]"
      />
    </div>

    <div className="space-y-2">
      <Label>Quantidade de sessões</Label>
      <div className="grid grid-cols-3 gap-2">
        {PLAN_SESSION_PRESETS.map((count) => (
          <Button
            key={count}
            type="button"
            variant={planSessions === count ? "default" : "outline"}
            onClick={() => {
              onPlanSessionsChange(count);
              onPlanNameChange(`Pacote de ${count} Sessões`);
            }}
            className="min-h-[44px]"
          >
            {count} sessões
          </Button>
        ))}
      </div>
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="plan-amount-input">Valor total (R$)</Label>
        <Input
          id="plan-amount-input"
          inputMode="numeric"
          value={planAmountInput}
          onChange={(e) => onPlanAmountInputChange(currencyDigitsToInput(e.target.value))}
          className="min-h-[44px]"
        />
        <p className="text-xs text-muted-foreground">
          Por sessão: <strong className="text-foreground">{formatMoneyCents(planUnitCents)}</strong>
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Status do pacote</Label>
        <Select value={planStatus} onValueChange={(v) => onPlanStatusChange(v as "pago" | "pendente")}>
          <SelectTrigger className="min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pago">Pago integralmente</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div className="space-y-1.5">
      <Label>Forma de pagamento</Label>
      <Select value={planMethod} onValueChange={onPlanMethodChange}>
        <SelectTrigger className="min-h-[44px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pix">Pix</SelectItem>
          <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
          <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
          <SelectItem value="dinheiro">Dinheiro</SelectItem>
          <SelectItem value="transferencia">Transferência</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </>
);
