import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { PaymentPlanCollapsible } from "@/components/PaymentPlanCollapsible";
import { Package } from "lucide-react";
import {
  PAYMENT_ADJUSTMENT_REASON_MAX_LENGTH,
  PAYMENT_INSTALLMENT_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  currencyDigitsToInput,
  formatMoneyCents,
  normalizePaymentInstallments,
  type SessionPaymentMethod,
  type SessionPaymentStatus,
} from "@/lib/session-operations";
import {
  getPaymentPlanBadgeStyle,
  getPaymentPlanStatusLabel,
  type PatientPaymentPlanRow,
  type PaymentPlanFormValues,
} from "@/lib/payment-plans";
import {
  PAYMENT_AMOUNT_INPUT_MAX_LENGTH,
  normalizePaymentMethod,
  paymentStatusBadgeClassNames,
} from "./types";
import { getPaymentStatusLabel } from "@/lib/session-operations";

export const PaymentStatusAutoControl = ({
  disabled,
  onChange,
  saving,
  status,
}: {
  disabled?: boolean;
  onChange: (status: SessionPaymentStatus) => void;
  saving?: boolean;
  status: SessionPaymentStatus;
}) => {
  const isCourtesy = status === "cortesia";

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
      <Badge
        variant="outline"
        className={`w-fit gap-1.5 px-3 py-1 text-sm ${paymentStatusBadgeClassNames[status]}`}
      >
        {getPaymentStatusLabel(status)}
      </Badge>
      <label className="flex w-fit items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium">
        <Checkbox
          checked={isCourtesy}
          onCheckedChange={(checked) => onChange(checked ? "cortesia" : "nao_cobrado")}
          disabled={disabled || saving}
          aria-label="Marcar pagamento como cortesia"
        />
        <span>Cortesia</span>
      </label>
    </div>
  );
};

export const PaymentCompositionChips = ({
  creditCents,
  paidCents,
}: {
  creditCents: number;
  paidCents: number;
}) => {
  if (creditCents <= 0) {
    return null;
  }

  const complementaryCents = Math.max(0, paidCents - creditCents);

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
        Pago {formatMoneyCents(paidCents)}
      </span>
      <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        Crédito {formatMoneyCents(creditCents)}
      </span>
      <span className="rounded-full border border-muted-foreground/20 bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
        Complemento {formatMoneyCents(complementaryCents)}
      </span>
    </div>
  );
};

export const CurrencyInput = ({
  disabled,
  id,
  onChange,
  value,
}: {
  disabled?: boolean;
  id: string;
  onChange: (value: string) => void;
  value: string;
}) => (
  <div className="relative">
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
      R$
    </span>
    <Input
      id={id}
      className="pl-10"
      inputMode="decimal"
      maxLength={PAYMENT_AMOUNT_INPUT_MAX_LENGTH}
      type="text"
      value={value}
      onChange={(event) => onChange(currencyDigitsToInput(event.target.value))}
      placeholder="0,00"
      disabled={disabled}
    />
  </div>
);

export interface SessionPaymentSectionProps {
  amountCharged: string;
  amountOriginal: string;
  amountPaid: string;
  canApplyPatientCredit: boolean;
  currentNormalizedPaymentStatus: SessionPaymentStatus;
  effectiveCreditAppliedCents: number;
  locked: boolean;
  paymentAdjustmentReason: string;
  paymentBalanceCents: number;
  paymentInstallments: number;
  paymentMethod: SessionPaymentMethod;
  paymentPlanForm: PaymentPlanFormValues;
  activePaymentPlan: PatientPaymentPlanRow | null;
  patientAvailableCreditCents: number;
  paymentStatusDate: string;
  remainingPatientCreditCents: number;
  onApplyPatientCredit: () => void;
  onPaymentAdjustmentReasonChange: (val: string) => void;
  onPaymentInstallmentsChange: (val: number) => void;
  onPaymentMethodChange: (val: SessionPaymentMethod) => void;
  onPaymentPlanFormChange: React.Dispatch<React.SetStateAction<PaymentPlanFormValues>>;
  onPaymentStatusChange: (status: SessionPaymentStatus) => void;
  onPaymentStatusDateChange: (date: string) => void;
  onAmountChargedChange: (amount: string) => void;
  onAmountOriginalChange: (amount: string) => void;
  onAmountPaidChange: (amount: string) => void;
}

export const SessionPaymentSection = ({
  amountCharged,
  amountOriginal,
  amountPaid,
  canApplyPatientCredit,
  currentNormalizedPaymentStatus,
  effectiveCreditAppliedCents,
  locked,
  paymentAdjustmentReason,
  paymentBalanceCents,
  paymentInstallments,
  paymentMethod,
  paymentPlanForm,
  activePaymentPlan,
  patientAvailableCreditCents,
  paymentStatusDate,
  remainingPatientCreditCents,
  onApplyPatientCredit,
  onPaymentAdjustmentReasonChange,
  onPaymentInstallmentsChange,
  onPaymentMethodChange,
  onPaymentPlanFormChange,
  onPaymentStatusChange,
  onPaymentStatusDateChange,
  onAmountChargedChange,
  onAmountOriginalChange,
  onAmountPaidChange,
}: SessionPaymentSectionProps) => {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pagamento</h2>
          <p className="text-sm text-muted-foreground">Informe o status, valor da consulta e quanto já foi pago.</p>
        </div>
        <ComponentHelpButton helpId="session-tab-payment" size="xs" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,0.95fr)_minmax(260px,1.05fr)_minmax(130px,0.45fr)_minmax(220px,0.8fr)]">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <PaymentStatusAutoControl
            status={currentNormalizedPaymentStatus}
            onChange={onPaymentStatusChange}
            disabled={locked}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payment-method">Método de pagamento</Label>
          <Select
            value={paymentMethod}
            onValueChange={(value) => onPaymentMethodChange(normalizePaymentMethod(value))}
            disabled={locked || currentNormalizedPaymentStatus === "cortesia"}
          >
            <SelectTrigger id="payment-method">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHOD_OPTIONS.filter((option) => option.value !== "cortesia").map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payment-installments">Parcelas</Label>
          <Select
            value={String(paymentInstallments)}
            onValueChange={(value) => onPaymentInstallmentsChange(normalizePaymentInstallments(value))}
            disabled={locked || currentNormalizedPaymentStatus === "cortesia"}
          >
            <SelectTrigger id="payment-installments">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_INSTALLMENT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payment-status-date">Data do pagamento</Label>
          <Input
            id="payment-status-date"
            max="2100-12-31"
            min="2000-01-01"
            type="date"
            value={paymentStatusDate}
            onChange={(event) => onPaymentStatusDateChange(event.target.value)}
            disabled={locked}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount-original">Valor original</Label>
          <CurrencyInput
            id="amount-original"
            value={amountOriginal}
            onChange={onAmountOriginalChange}
            disabled={locked}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount-charged">Valor da consulta</Label>
          <CurrencyInput
            id="amount-charged"
            value={amountCharged}
            onChange={onAmountChargedChange}
            disabled={locked}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount-paid">Quanto foi pago</Label>
          <CurrencyInput
            id="amount-paid"
            value={amountPaid}
            onChange={onAmountPaidChange}
            disabled={locked}
          />
          {patientAvailableCreditCents > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-xs font-medium text-primary">
                Crédito disponível: {formatMoneyCents(remainingPatientCreditCents)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onApplyPatientCredit}
                disabled={!canApplyPatientCredit}
              >
                Usar crédito
              </Button>
              {effectiveCreditAppliedCents > 0 ? (
                <span className="text-xs text-muted-foreground">
                  Aplicado nesta sessão: {formatMoneyCents(effectiveCreditAppliedCents)}
                </span>
              ) : null}
            </div>
          ) : null}
          <PaymentCompositionChips
            creditCents={effectiveCreditAppliedCents}
            paidCents={amountPaid ? Number(amountPaid.replace(/\D/g, "")) : 0}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="payment-adjustment-reason">Motivo do desconto/acréscimo</Label>
        <Textarea
          id="payment-adjustment-reason"
          className="min-h-20 resize-y"
          maxLength={PAYMENT_ADJUSTMENT_REASON_MAX_LENGTH}
          value={paymentAdjustmentReason}
          onChange={(event) => onPaymentAdjustmentReasonChange(event.target.value)}
          placeholder="Opcional"
          disabled={locked}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Em aberto: {formatMoneyCents(paymentBalanceCents)}
      </p>

      {activePaymentPlan ? (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 p-3.5 text-xs text-primary">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Vinculado ao {activePaymentPlan.name}</p>
              <p className="text-muted-foreground">
                Sessão de pacote ({activePaymentPlan.used_sessions} de {activePaymentPlan.total_sessions} realizadas)
              </p>
            </div>
          </div>
          <Badge variant="outline" className={getPaymentPlanBadgeStyle(activePaymentPlan.payment_status)}>
            {getPaymentPlanStatusLabel(activePaymentPlan.payment_status)}
          </Badge>
        </div>
      ) : (
        <PaymentPlanCollapsible
          disabled={locked}
          values={paymentPlanForm}
          onChange={onPaymentPlanFormChange}
        />
      )}
    </div>
  );
};
