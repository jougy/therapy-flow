import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, CheckCircle2, Clock, Info, Package, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DEFAULT_PAYMENT_PLAN_FORM_VALUES,
  PAYMENT_PLAN_STATUS_OPTIONS,
  calculateSessionUnitAmountCents,
  generatePlanScheduleDates,
  getPaymentPlanStatusLabel,
  type PaymentPlanFormValues,
} from "@/lib/payment-plans";
import {
  PAYMENT_INSTALLMENT_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  currencyDigitsToInput,
  formatMoneyCents,
  parseCurrencyToCents,
} from "@/lib/session-operations";
import { PATIENT_RECURRENCE_WEEKDAY_OPTIONS } from "@/lib/patient-recurrence";

interface PaymentPlanCollapsibleProps {
  disabled?: boolean;
  onChange: (values: PaymentPlanFormValues) => void;
  patientRecurringTime?: string;
  patientRecurringWeekdays?: number[];
  values: PaymentPlanFormValues;
}

const CurrencyInput = ({
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
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">R$</span>
    <Input
      id={id}
      className="pl-10"
      inputMode="decimal"
      maxLength={16}
      type="text"
      value={value}
      onChange={(event) => onChange(currencyDigitsToInput(event.target.value))}
      placeholder="0,00"
      disabled={disabled}
    />
  </div>
);

export const PaymentPlanCollapsible = ({
  disabled = false,
  onChange,
  patientRecurringTime,
  patientRecurringWeekdays,
  values,
}: PaymentPlanCollapsibleProps) => {
  const totalAmountCents = useMemo(() => parseCurrencyToCents(values.totalAmount), [values.totalAmount]);
  const unitAmountCents = useMemo(
    () => calculateSessionUnitAmountCents(totalAmountCents, values.totalSessions),
    [totalAmountCents, values.totalSessions]
  );

  const previewDates = useMemo(() => {
    if (!values.autoPreScheduleAgenda && !values.autoCreateDraftSessions) {
      return [];
    }
    return generatePlanScheduleDates({
      count: values.totalSessions,
      startDateStr: values.startDate || new Date().toISOString().split("T")[0],
      recurringWeekdays: values.recurringWeekdays,
      recurringTime: values.recurringTime || "14:00",
    });
  }, [
    values.autoPreScheduleAgenda,
    values.autoCreateDraftSessions,
    values.totalSessions,
    values.startDate,
    values.recurringWeekdays,
    values.recurringTime,
  ]);

  const toggleWeekday = (weekdayValue: number) => {
    const current = new Set(values.recurringWeekdays);
    if (current.has(weekdayValue)) {
      current.delete(weekdayValue);
    } else {
      current.add(weekdayValue);
    }
    onChange({
      ...values,
      recurringWeekdays: Array.from(current).sort((a, b) => a - b),
    });
  };

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm transition-all">
      {/* Header Toggle Checkbox */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Checkbox
            id="plan-create-toggle"
            checked={values.createPlan}
            onCheckedChange={(checked) =>
              onChange({
                ...values,
                createPlan: Boolean(checked),
                recurringWeekdays:
                  values.recurringWeekdays.length > 0
                    ? values.recurringWeekdays
                    : patientRecurringWeekdays && patientRecurringWeekdays.length > 0
                    ? patientRecurringWeekdays
                    : [1],
                recurringTime: values.recurringTime || patientRecurringTime || "14:00",
              })
            }
            disabled={disabled}
            aria-label="Criar Plano de Pagamento (Pacote de Sessões)"
          />
          <Label htmlFor="plan-create-toggle" className="flex cursor-pointer items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Criar Plano de Pagamento / Pacote de Sessões
            </span>
          </Label>
        </div>
        {values.createPlan && (
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            <Sparkles className="mr-1 h-3 w-3" /> Pacote Ativo
          </Badge>
        )}
      </div>

      {/* Retractable Collapsible Section */}
      <AnimatePresence initial={false}>
        {values.createPlan && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-4 rounded-lg border bg-muted/20 p-4">
              {/* Informational Banner */}
              <div className="flex items-start gap-2.5 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Pacote de Sessões com Crédito Antecipado</p>
                  <p className="mt-0.5 text-muted-foreground">
                    Ao criar este plano, os créditos de sessão serão gerados automaticamente. O paciente poderá ter suas sessões pré-agendadas na agenda da clínica.
                  </p>
                </div>
              </div>

              {/* Main Form Fields */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* Nome do Plano */}
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="plan-name">Nome do Pacote / Plano</Label>
                  <Input
                    id="plan-name"
                    value={values.name}
                    onChange={(e) => onChange({ ...values, name: e.target.value })}
                    placeholder="Ex: Pacote de 10 Sessões"
                    disabled={disabled}
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
                    value={values.totalSessions}
                    onChange={(e) =>
                      onChange({
                        ...values,
                        totalSessions: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                    disabled={disabled}
                  />
                </div>

                {/* Valor Total */}
                <div className="space-y-1.5">
                  <Label htmlFor="plan-total-amount">Valor Total do Pacote</Label>
                  <CurrencyInput
                    id="plan-total-amount"
                    value={values.totalAmount}
                    onChange={(val) => onChange({ ...values, totalAmount: val })}
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* Grid 2: Método, Parcelas, Status & Unit price display */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Método de Pagamento */}
                <div className="space-y-1.5">
                  <Label htmlFor="plan-payment-method">Método de pagamento</Label>
                  <Select
                    value={values.paymentMethod}
                    onValueChange={(val) => onChange({ ...values, paymentMethod: val })}
                    disabled={disabled}
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

                {/* Parcelas */}
                <div className="space-y-1.5">
                  <Label htmlFor="plan-installments">Parcelamento</Label>
                  <Select
                    value={String(values.paymentInstallments)}
                    onValueChange={(val) => onChange({ ...values, paymentInstallments: parseInt(val, 10) || 1 })}
                    disabled={disabled}
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

                {/* Status do Pagamento do Plano */}
                <div className="space-y-1.5">
                  <Label htmlFor="plan-payment-status">Status do pagamento</Label>
                  <Select
                    value={values.paymentStatus}
                    onValueChange={(val) =>
                      onChange({
                        ...values,
                        paymentStatus: val as PaymentPlanFormValues["paymentStatus"],
                      })
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger id="plan-payment-status">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_PLAN_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Card de Valor Unitário Calculado */}
                <div className="flex flex-col justify-end">
                  <div className="rounded-lg border bg-background p-2.5">
                    <span className="text-[11px] font-medium uppercase text-muted-foreground block">
                      Valor por sessão
                    </span>
                    <span className="text-base font-bold text-foreground">
                      {formatMoneyCents(unitAmountCents)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pre-scheduling Options */}
              <div className="space-y-3 rounded-lg border bg-background p-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-primary" />
                    Pré-agendamento na Agenda
                  </span>
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id="plan-preschedule-agenda"
                        checked={values.autoPreScheduleAgenda}
                        onCheckedChange={(c) => onChange({ ...values, autoPreScheduleAgenda: Boolean(c) })}
                        disabled={disabled}
                      />
                      <Label htmlFor="plan-preschedule-agenda" className="cursor-pointer text-xs font-normal">
                        Pré-agendar na Agenda
                      </Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id="plan-create-drafts"
                        checked={values.autoCreateDraftSessions}
                        onCheckedChange={(c) => onChange({ ...values, autoCreateDraftSessions: Boolean(c) })}
                        disabled={disabled}
                      />
                      <Label htmlFor="plan-create-drafts" className="cursor-pointer text-xs font-normal">
                        Criar rascunhos de sessão
                      </Label>
                    </div>
                  </div>
                </div>

                {(values.autoPreScheduleAgenda || values.autoCreateDraftSessions) && (
                  <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Data de Inicio */}
                    <div className="space-y-1.5">
                      <Label htmlFor="plan-start-date">Data da 1ª sessão</Label>
                      <Input
                        id="plan-start-date"
                        type="date"
                        value={values.startDate}
                        onChange={(e) => onChange({ ...values, startDate: e.target.value })}
                        disabled={disabled}
                      />
                    </div>

                    {/* Horario padrao */}
                    <div className="space-y-1.5">
                      <Label htmlFor="plan-recurring-time" className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Horário padrão
                      </Label>
                      <Input
                        id="plan-recurring-time"
                        type="time"
                        value={values.recurringTime}
                        onChange={(e) => onChange({ ...values, recurringTime: e.target.value })}
                        disabled={disabled}
                      />
                    </div>

                    {/* Dias da semana */}
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                      <Label>Dias da semana</Label>
                      <div className="flex flex-wrap gap-1">
                        {PATIENT_RECURRENCE_WEEKDAY_OPTIONS.map((weekday) => {
                          const isActive = values.recurringWeekdays.includes(weekday.value);
                          return (
                            <button
                              key={weekday.value}
                              type="button"
                              onClick={() => toggleWeekday(weekday.value)}
                              disabled={disabled}
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

                {/* Dynamic Summary Card */}
                {previewDates.length > 0 && (
                  <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs space-y-1.5 text-muted-foreground border">
                    <div className="flex items-center justify-between font-semibold text-foreground">
                      <span>Resumo dos Pré-agendamentos ({previewDates.length} sessões):</span>
                      <span className="text-primary font-medium">
                        {previewDates[0].toLocaleDateString("pt-BR")} até {previewDates[previewDates.length - 1].toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {previewDates.slice(0, 6).map((d, i) => (
                        <Badge key={i} variant="secondary" className="text-[11px]">
                          #{i + 1}: {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às {values.recurringTime}
                        </Badge>
                      ))}
                      {previewDates.length > 6 && (
                        <Badge variant="outline" className="text-[11px]">
                          +{previewDates.length - 6} sessões...
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
