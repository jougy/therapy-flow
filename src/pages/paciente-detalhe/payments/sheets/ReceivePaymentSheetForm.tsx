import * as React from "react";
import { Banknote, CreditCard, Package, QrCode, ShieldCheck, Wallet } from "lucide-react";
import { Label } from "@/components/ui/label";
import { formatMoneyCents } from "@/lib/session-operations";
import { cn } from "@/lib/utils";
import type { ReceivePaymentMethodOption } from "../paymentMutations";
import type { PatientHealthInsuranceRecord, PatientPaymentPlanRow } from "../types";

export interface ReceivePaymentSheetFormProps {
  amountToReceiveCents: number;
  receiveMethod: ReceivePaymentMethodOption;
  onReceiveMethodChange: (method: ReceivePaymentMethodOption) => void;
  creditBalanceCents: number;
  activePlan: PatientPaymentPlanRow | null;
  remainingPlanSessions: number;
  patientInsurance: PatientHealthInsuranceRecord | null;
}

export const ReceivePaymentSheetForm: React.FC<ReceivePaymentSheetFormProps> = ({
  amountToReceiveCents,
  receiveMethod,
  onReceiveMethodChange,
  creditBalanceCents,
  activePlan,
  remainingPlanSessions,
  patientInsurance,
}) => {
  const options = [
    { id: "pix" as const, label: "Pix", icon: QrCode, disabled: false },
    { id: "cartao" as const, label: "Cartão", icon: CreditCard, disabled: false },
    { id: "dinheiro" as const, label: "Dinheiro", icon: Banknote, disabled: false },
    {
      id: "credito" as const,
      label: `Usar Crédito (${formatMoneyCents(creditBalanceCents)})`,
      icon: Wallet,
      disabled: creditBalanceCents <= 0,
    },
    {
      id: "pacote" as const,
      label: activePlan
        ? `Abater do Pacote (${remainingPlanSessions} rest.)`
        : "Abater do Pacote (sem pacote)",
      icon: Package,
      disabled: !activePlan || remainingPlanSessions <= 0,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-muted/40 p-3 text-sm">
        <p className="text-xs text-muted-foreground">Total a quitar</p>
        <p className="text-xl font-bold text-foreground">
          {formatMoneyCents(amountToReceiveCents)}
        </p>
      </div>

      <div className="space-y-2">
        <Label>Selecione como receber</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.map((opt) => {
            const Icon = opt.icon;
            const active = receiveMethod === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={opt.disabled}
                onClick={() => onReceiveMethodChange(opt.id)}
                className={cn(
                  "flex min-h-[44px] items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-background text-foreground hover:bg-muted/60",
                  opt.disabled && "cursor-not-allowed opacity-45",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {patientInsurance ? (
        <p className="flex items-center gap-1.5 text-xs text-sky-700 dark:text-sky-300">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          Convênio vinculado disponível para referência na guia.
        </p>
      ) : null}
    </div>
  );
};
