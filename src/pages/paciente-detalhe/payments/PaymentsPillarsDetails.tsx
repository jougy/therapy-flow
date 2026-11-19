import * as React from "react";
import { Package, Plus, ShieldCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPaymentPlanBadgeStyle, getPaymentPlanStatusLabel } from "@/lib/payment-plans";
import { formatMoneyCents, getPaymentMethodLabel } from "@/lib/session-operations";
import { cn } from "@/lib/utils";
import {
  formatShortDate,
  type PatientCreditState,
  type PatientHealthInsuranceRecord,
  type PatientPaymentPlanRow,
} from "./types";

export interface PaymentsPillarsDetailsProps {
  activePlan: PatientPaymentPlanRow | null;
  creditState: PatientCreditState;
  patientInsurance: PatientHealthInsuranceRecord | null;
  resolvedInsuranceName: string | null;
  canManageFinance: boolean;
  onOpenNewPlan: () => void;
  onOpenAddCredit: () => void;
  onOpenLinkInsurance: () => void;
}

export const PaymentsPillarsDetails: React.FC<PaymentsPillarsDetailsProps> = ({
  activePlan,
  creditState,
  patientInsurance,
  resolvedInsuranceName,
  canManageFinance,
  onOpenNewPlan,
  onOpenAddCredit,
  onOpenLinkInsurance,
}) => (
  <section className="grid w-full max-w-full min-w-0 grid-cols-1 gap-3 lg:grid-cols-3">
    {/* Pilar Pacote */}
    <div className="min-w-0 space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Package className="h-4 w-4 text-primary" />
          Detalhes do Pacote
        </span>
        {canManageFinance ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenNewPlan}
            className="min-h-[44px] text-xs"
          >
            {activePlan ? "Renovar" : "Criar"}
          </Button>
        ) : null}
      </div>
      {activePlan ? (
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-foreground">{activePlan.name}</span>
            <Badge className={cn("shrink-0 border", getPaymentPlanBadgeStyle(activePlan.payment_status))}>
              {getPaymentPlanStatusLabel(activePlan.payment_status)}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Valor total: {formatMoneyCents(activePlan.total_amount_cents)} ({formatMoneyCents(activePlan.session_unit_amount_cents)}/sessão)
          </p>
          <p className="text-muted-foreground">
            Início em {formatShortDate(activePlan.start_date)} ·{" "}
            {Math.max(0, activePlan.total_sessions - activePlan.used_sessions)} restantes
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Crie um pacote para acompanhar sessões contratadas e valor unitário.
        </p>
      )}
    </div>

    {/* Pilar Crédito */}
    <div className="min-w-0 space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Movimentações de Crédito
        </span>
        {canManageFinance ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenAddCredit}
            className="min-h-[44px] text-xs"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Crédito
          </Button>
        ) : null}
      </div>
      {creditState.history.length > 0 ? (
        <ul className="space-y-1.5 text-xs">
          {creditState.history.slice(0, 3).map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-2 text-muted-foreground">
              <span className="truncate">
                {getPaymentMethodLabel(entry.method)} · {formatShortDate(entry.created_at)}
              </span>
              <span
                className={cn(
                  "shrink-0 font-semibold tabular-nums",
                  entry.amount_cents >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400",
                )}
              >
                {entry.amount_cents >= 0 ? "+" : ""}
                {formatMoneyCents(entry.amount_cents)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nenhuma movimentação de crédito registrada para este paciente.
        </p>
      )}
    </div>

    {/* Pilar Convênio */}
    <div className="min-w-0 space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          Dados do Convênio
        </span>
        {canManageFinance ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenLinkInsurance}
            className="min-h-[44px] text-xs"
          >
            {patientInsurance ? "Editar" : "Vincular"}
          </Button>
        ) : null}
      </div>
      {patientInsurance ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{resolvedInsuranceName}</p>
          <p className="break-all">Carteirinha: {patientInsurance.card_number}</p>
          {patientInsurance.plan_tier ? (
            <p className="break-all">Guia: {patientInsurance.plan_tier}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sem convênio vinculado. Vincule uma operadora e carteirinha quando aplicável.
        </p>
      )}
    </div>
  </section>
);
