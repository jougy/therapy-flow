import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { Calendar, Clock, Clock3, CheckCircle2, CreditCard, Gift, Info, Package, Sparkles, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useClinicPlanQuota } from "@/hooks/useClinicPlanQuota";
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
  PAYMENT_PLAN_STATUS_OPTIONS,
  calculateSessionUnitAmountCents,
  generatePlanScheduleDates,
  getPaymentPlanBadgeStyle,
  getPaymentPlanStatusLabel,
  type PatientPaymentPlanRow,
  type PaymentPlanFormValues,
} from "@/lib/payment-plans";
import { PATIENT_RECURRENCE_WEEKDAY_OPTIONS } from "@/lib/patient-recurrence";
import {
  PAYMENT_AMOUNT_INPUT_MAX_LENGTH,
  normalizePaymentMethod,
  paymentStatusBadgeClassNames,
} from "./types";
import { getPaymentStatusLabel, parseCurrencyToCents } from "@/lib/session-operations";

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
  const { clinic } = useAuth();
  const quota = useClinicPlanQuota(clinic?.id);

  // Determina a modalidade ativa: 'pacote', 'cortesia' ou 'avulso'
  const currentMode: "avulso" | "pacote" | "cortesia" = useMemo(() => {
    if (currentNormalizedPaymentStatus === "cortesia") {
      return "cortesia";
    }
    if (paymentPlanForm.createPlan || activePaymentPlan) {
      return "pacote";
    }
    return "avulso";
  }, [currentNormalizedPaymentStatus, paymentPlanForm.createPlan, activePaymentPlan]);

  const handleModeChange = (mode: string) => {
    if (mode === "cortesia") {
      onPaymentPlanFormChange((prev) => ({ ...prev, createPlan: false }));
      onPaymentStatusChange("cortesia");
    } else if (mode === "pacote") {
      if (currentNormalizedPaymentStatus === "cortesia") {
        onPaymentStatusChange("nao_cobrado");
      }
      onPaymentPlanFormChange((prev) => ({
        ...prev,
        createPlan: true,
      }));
    } else {
      // avulso
      if (currentNormalizedPaymentStatus === "cortesia") {
        onPaymentStatusChange("nao_cobrado");
      }
      onPaymentPlanFormChange((prev) => ({ ...prev, createPlan: false }));
    }
  };

  const planTotalAmountCents = useMemo(
    () => parseCurrencyToCents(paymentPlanForm.totalAmount),
    [paymentPlanForm.totalAmount]
  );
  const planUnitAmountCents = useMemo(
    () => calculateSessionUnitAmountCents(planTotalAmountCents, paymentPlanForm.totalSessions),
    [planTotalAmountCents, paymentPlanForm.totalSessions]
  );

  const planPreviewDates = useMemo(() => {
    if (!paymentPlanForm.autoPreScheduleAgenda && !paymentPlanForm.autoCreateDraftSessions) {
      return [];
    }
    return generatePlanScheduleDates({
      count: paymentPlanForm.totalSessions,
      startDateStr: paymentPlanForm.startDate || new Date().toISOString().split("T")[0],
      recurringWeekdays: paymentPlanForm.recurringWeekdays,
      recurringTime: paymentPlanForm.recurringTime || "14:00",
    });
  }, [
    paymentPlanForm.autoPreScheduleAgenda,
    paymentPlanForm.autoCreateDraftSessions,
    paymentPlanForm.totalSessions,
    paymentPlanForm.startDate,
    paymentPlanForm.recurringWeekdays,
    paymentPlanForm.recurringTime,
  ]);

  const toggleWeekday = (weekdayValue: number) => {
    const current = new Set(paymentPlanForm.recurringWeekdays);
    if (current.has(weekdayValue)) {
      current.delete(weekdayValue);
    } else {
      current.add(weekdayValue);
    }
    onPaymentPlanFormChange((prev) => ({
      ...prev,
      recurringWeekdays: Array.from(current).sort((a, b) => a - b),
    }));
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Header com Título e Help */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pagamento</h2>
          <p className="text-sm text-muted-foreground">
            Escolha a modalidade de cobrança e preencha as condições de pagamento.
          </p>
        </div>
        <ComponentHelpButton helpId="session-tab-payment" size="xs" />
      </div>

      {/* Seletor de Modalidade de Cobrança */}
      <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Modalidade de Cobrança
          </span>
        </div>
        <Tabs
          value={currentMode}
          onValueChange={handleModeChange}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid w-full grid-cols-3 sm:w-[380px]">
            <TabsTrigger value="avulso" disabled={locked || !!activePaymentPlan} className="gap-1.5 text-xs">
              <CreditCard className="h-3.5 w-3.5" />
              <span>Avulso</span>
            </TabsTrigger>
            <TabsTrigger value="pacote" disabled={locked} className="gap-1.5 text-xs">
              <Package className="h-3.5 w-3.5" />
              <span>Pacote</span>
              {activePaymentPlan ? (
                <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                  Ativo
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="cortesia" disabled={locked || !!activePaymentPlan} className="gap-1.5 text-xs">
              <Gift className="h-3.5 w-3.5" />
              <span>Cortesia</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* SEÇÃO: PACOTE ATIVO EXISTENTE */}
      {activePaymentPlan ? (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 p-4 text-xs text-primary">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/20 p-2">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Vinculado ao {activePaymentPlan.name}</p>
              <p className="text-muted-foreground mt-0.5">
                Esta sessão será debitada automaticamente ({activePaymentPlan.used_sessions} de {activePaymentPlan.total_sessions} realizadas).
              </p>
            </div>
          </div>
          <Badge variant="outline" className={getPaymentPlanBadgeStyle(activePaymentPlan.payment_status)}>
            {getPaymentPlanStatusLabel(activePaymentPlan.payment_status)}
          </Badge>
        </div>
      ) : null}

      {/* SEÇÃO 1: PACOTE DE SESSÕES (CRIAR NOVO) */}
      {currentMode === "pacote" && !activePaymentPlan && (
        <div className="space-y-4 rounded-xl border border-primary/20 bg-card p-4 sm:p-5 shadow-sm transition-all">
          {/* Informational Banner */}
          <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Pacote de Sessões com Crédito Antecipado</p>
              <p className="mt-0.5 text-muted-foreground">
                Ao salvar o atendimento nesta modalidade, o pacote será gerado, esta sessão será a 1ª utilizada e os créditos/agendamentos das demais ficarão vinculados ao paciente.
              </p>
            </div>
          </div>

          {/* Alerta Preventivo de Cota de Teste Grátis */}
          {quota.isFreeTrial && (quota.attendances.current + (parseInt(String(paymentPlanForm.totalSessions), 10) || 1)) > quota.attendances.max && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-semibold text-amber-300">
                  Aviso de Cota do Plano de Teste Grátis
                </p>
                <p className="text-[11px] text-neutral-300">
                  Este pacote de <strong>{paymentPlanForm.totalSessions} sessões</strong> fará sua clínica totalizar <strong>{quota.attendances.current + (parseInt(String(paymentPlanForm.totalSessions), 10) || 1)} atendimentos</strong> (seu plano gratuito possui {quota.attendances.remaining} restantes de {quota.attendances.max}). O pacote e todos os pré-agendamentos serão salvos normalmente na agenda, mas a evolução clínica a partir do 21º atendimento exigirá a contratação de um plano ilimitado.
                </p>
              </div>
            </div>
          )}

          {/* Grid Principal do Pacote */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Nome do Pacote */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="plan-name">Nome do Pacote / Plano</Label>
              <Input
                id="plan-name"
                value={paymentPlanForm.name}
                onChange={(e) => onPaymentPlanFormChange((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Pacote de 10 Sessões"
                disabled={locked}
              />
            </div>

            {/* Quantidade de Sessões */}
            <div className="space-y-1.5">
              <Label htmlFor="plan-total-sessions">Quantidade de Sessões</Label>
              <Input
                id="plan-total-sessions"
                type="number"
                min={2}
                max={100}
                value={paymentPlanForm.totalSessions}
                onChange={(e) =>
                  onPaymentPlanFormChange((prev) => ({
                    ...prev,
                    totalSessions: Math.max(1, parseInt(e.target.value, 10) || 1),
                  }))
                }
                disabled={locked}
              />
            </div>

            {/* Valor Total do Pacote */}
            <div className="space-y-1.5">
              <Label htmlFor="plan-total-amount">Valor Total do Pacote</Label>
              <CurrencyInput
                id="plan-total-amount"
                value={paymentPlanForm.totalAmount}
                onChange={(val) => onPaymentPlanFormChange((prev) => ({ ...prev, totalAmount: val }))}
                disabled={locked}
              />
            </div>
          </div>

          {/* Grid Pagamento do Pacote */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Método de Pagamento */}
            <div className="space-y-1.5">
              <Label htmlFor="plan-payment-method">Método de pagamento</Label>
              <Select
                value={paymentPlanForm.paymentMethod}
                onValueChange={(val) => onPaymentPlanFormChange((prev) => ({ ...prev, paymentMethod: val }))}
                disabled={locked}
              >
                <SelectTrigger id="plan-payment-method">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.filter((o) => o.value !== "cortesia").map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Parcelamento */}
            <div className="space-y-1.5">
              <Label htmlFor="plan-installments">Parcelamento</Label>
              <Select
                value={String(paymentPlanForm.paymentInstallments)}
                onValueChange={(val) =>
                  onPaymentPlanFormChange((prev) => ({ ...prev, paymentInstallments: parseInt(val, 10) || 1 }))
                }
                disabled={locked}
              >
                <SelectTrigger id="plan-installments">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_INSTALLMENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Card de Valor Unitário Calculado */}
            <div className="flex flex-col justify-end">
              <div className="rounded-lg border bg-muted/30 p-2.5">
                <span className="text-[11px] font-medium uppercase text-muted-foreground block">
                  Valor por sessão
                </span>
                <span className="text-base font-bold text-foreground">
                  {formatMoneyCents(planUnitAmountCents)}
                </span>
              </div>
            </div>
          </div>

          {/* Indicador Inteligente de Quitação do Pacote */}
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {paymentPlanForm.paymentStatus === "pago" ? (
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Pacote considerado <strong>pago no ato</strong> (créditos liberados automaticamente)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <Clock3 className="h-4 w-4 shrink-0" />
                  <span>Cobrança <strong>pendente</strong> (a faturar / receber posteriormente)</span>
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs self-start sm:self-auto"
              disabled={locked}
              onClick={() =>
                onPaymentPlanFormChange((prev) => ({
                  ...prev,
                  paymentStatus: prev.paymentStatus === "pago" ? "pendente" : "pago",
                }))
              }
            >
              {paymentPlanForm.paymentStatus === "pago"
                ? "Alternar para pendente"
                : "Marcar como pago no ato"}
            </Button>
          </div>

          {/* Pré-agendamento das Próximas Sessões */}
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" />
                Pré-agendamento das demais sessões na Agenda
              </span>
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="plan-preschedule-agenda"
                    checked={paymentPlanForm.autoPreScheduleAgenda}
                    onCheckedChange={(c) =>
                      onPaymentPlanFormChange((prev) => ({ ...prev, autoPreScheduleAgenda: Boolean(c) }))
                    }
                    disabled={locked}
                  />
                  <Label htmlFor="plan-preschedule-agenda" className="cursor-pointer text-xs font-normal">
                    Pré-agendar na Agenda
                  </Label>
                </div>
              </div>
            </div>

            {paymentPlanForm.autoPreScheduleAgenda && (
              <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-3">
                {/* Data de Inicio */}
                <div className="space-y-1.5">
                  <Label htmlFor="plan-start-date">Data da 1ª sessão</Label>
                  <Input
                    id="plan-start-date"
                    type="date"
                    value={paymentPlanForm.startDate}
                    onChange={(e) =>
                      onPaymentPlanFormChange((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                    disabled={locked}
                  />
                </div>

                {/* Horário padrão */}
                <div className="space-y-1.5">
                  <Label htmlFor="plan-recurring-time" className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Horário padrão
                  </Label>
                  <Input
                    id="plan-recurring-time"
                    type="time"
                    value={paymentPlanForm.recurringTime}
                    onChange={(e) =>
                      onPaymentPlanFormChange((prev) => ({ ...prev, recurringTime: e.target.value }))
                    }
                    disabled={locked}
                  />
                </div>

                {/* Dias da semana */}
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label>Dias da semana</Label>
                  <div className="flex flex-wrap gap-1">
                    {PATIENT_RECURRENCE_WEEKDAY_OPTIONS.map((weekday) => {
                      const isActive = paymentPlanForm.recurringWeekdays.includes(weekday.value);
                      return (
                        <button
                          key={weekday.value}
                          type="button"
                          onClick={() => toggleWeekday(weekday.value)}
                          disabled={locked}
                          className={`h-7 px-2 rounded text-xs font-medium border transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/40 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {weekday.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Resumo dos Pré-agendamentos */}
            {planPreviewDates.length > 0 && (
              <div className="mt-3 rounded-md bg-background p-3 text-xs space-y-1.5 text-muted-foreground border">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span>Resumo dos Pré-agendamentos ({planPreviewDates.length} sessões):</span>
                  <span className="text-primary font-medium">
                    {planPreviewDates[0].toLocaleDateString("pt-BR")} até {planPreviewDates[planPreviewDates.length - 1].toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {planPreviewDates.slice(0, 6).map((d, i) => (
                    <Badge key={i} variant="secondary" className="text-[11px]">
                      #{i + 1}: {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às {paymentPlanForm.recurringTime}
                    </Badge>
                  ))}
                  {planPreviewDates.length > 6 && (
                    <Badge variant="outline" className="text-[11px]">
                      +{planPreviewDates.length - 6} sessões...
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEÇÃO 2: COBRANÇA AVULSA OU CORTESIA */}
      {currentMode !== "pacote" && (
        <div className="space-y-4">
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
                disabled={locked || currentNormalizedPaymentStatus === "cortesia"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount-charged">Valor da consulta</Label>
              <CurrencyInput
                id="amount-charged"
                value={amountCharged}
                onChange={onAmountChargedChange}
                disabled={locked || currentNormalizedPaymentStatus === "cortesia"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount-paid">Quanto foi pago</Label>
              <CurrencyInput
                id="amount-paid"
                value={amountPaid}
                onChange={onAmountPaidChange}
                disabled={locked || currentNormalizedPaymentStatus === "cortesia"}
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
                    disabled={!canApplyPatientCredit || currentNormalizedPaymentStatus === "cortesia"}
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
            Em aberto: {formatMoneyCents(currentNormalizedPaymentStatus === "cortesia" ? 0 : paymentBalanceCents)}
          </p>
        </div>
      )}
    </div>
  );
};
