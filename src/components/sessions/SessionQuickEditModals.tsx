import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { getCurrentDateTimeInputValue } from "@/lib/session-payload";
import type { SessionPaymentStatus } from "@/lib/session-operations";
import {
  CurrencyInput,
  PaymentCompositionChips,
  PaymentStatusAutoControl,
} from "./SessionPaymentSection";
import {
  PAYMENT_ADJUSTMENT_REASON_MAX_LENGTH,
  PAYMENT_INSTALLMENT_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  formatMoneyCents,
  normalizePaymentInstallments,
  type SessionPaymentMethod,
} from "@/lib/session-operations";
import { normalizePaymentMethod } from "./types";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SessionQuickEditModalsProps {
  // Presence Dialog
  presenceDialogOpen: boolean;
  savingPresence: boolean;
  draftScheduledStartAt: string;
  draftPatientArrivedAt: string;
  draftSessionDate: string;
  draftArrivalDeltaLabel: string | null;
  draftArrivalDeltaMinutes: number | null;
  onPresenceDialogOpenChange: (open: boolean) => void;
  onDraftScheduledStartAtChange: (val: string) => void;
  onDraftPatientArrivedAtChange: (val: string) => void;
  onDraftSessionDateChange: (val: string) => void;
  onSavePresenceSummary: () => Promise<void>;

  // Payment Dialog
  paymentDialogOpen: boolean;
  savingPayment: boolean;
  draftNormalizedPaymentStatus: SessionPaymentStatus;
  draftPaymentStatusDate: string;
  draftPaymentMethod: SessionPaymentMethod;
  draftPaymentInstallments: number;
  draftAmountOriginal: string;
  draftAmountCharged: string;
  draftAmountPaid: string;
  draftPaymentAdjustmentReason: string;
  draftHasPaymentAdjustment: boolean;
  draftAmountOriginalCents: number;
  draftAmountChargedCents: number;
  draftAmountPaidCents: number;
  draftPaymentAdjustmentCents: number;
  draftPaymentAdjustmentPercent: number;
  patientAvailableCreditCents: number;
  remainingDraftPatientCreditCents: number;
  canApplyDraftPatientCredit: boolean;
  effectiveDraftCreditAppliedCents: number;
  draftPaymentStatus: SessionPaymentStatus;
  onPaymentDialogOpenChange: (open: boolean) => void;
  onDraftPaymentStatusChange: (status: SessionPaymentStatus) => void;
  onDraftPaymentStatusDateChange: (val: string) => void;
  onDraftPaymentMethodChange: (val: SessionPaymentMethod) => void;
  onDraftPaymentInstallmentsChange: (val: number) => void;
  onDraftAmountOriginalChange: (val: string) => void;
  onDraftAmountChargedChange: (val: string) => void;
  onDraftAmountPaidChange: (val: string) => void;
  onDraftPaymentAdjustmentReasonChange: (val: string) => void;
  onApplyDraftPatientCredit: () => void;
  onSavePaymentSummary: () => Promise<void>;
}

export const SessionQuickEditModals = ({
  presenceDialogOpen,
  savingPresence,
  draftScheduledStartAt,
  draftPatientArrivedAt,
  draftSessionDate,
  draftArrivalDeltaLabel,
  draftArrivalDeltaMinutes,
  onPresenceDialogOpenChange,
  onDraftScheduledStartAtChange,
  onDraftPatientArrivedAtChange,
  onDraftSessionDateChange,
  onSavePresenceSummary,
  paymentDialogOpen,
  savingPayment,
  draftNormalizedPaymentStatus,
  draftPaymentStatusDate,
  draftPaymentMethod,
  draftPaymentInstallments,
  draftAmountOriginal,
  draftAmountCharged,
  draftAmountPaid,
  draftPaymentAdjustmentReason,
  draftHasPaymentAdjustment,
  draftAmountOriginalCents,
  draftAmountChargedCents,
  draftAmountPaidCents,
  draftPaymentAdjustmentCents,
  draftPaymentAdjustmentPercent,
  patientAvailableCreditCents,
  remainingDraftPatientCreditCents,
  canApplyDraftPatientCredit,
  effectiveDraftCreditAppliedCents,
  draftPaymentStatus,
  onPaymentDialogOpenChange,
  onDraftPaymentStatusChange,
  onDraftPaymentStatusDateChange,
  onDraftPaymentMethodChange,
  onDraftPaymentInstallmentsChange,
  onDraftAmountOriginalChange,
  onDraftAmountChargedChange,
  onDraftAmountPaidChange,
  onDraftPaymentAdjustmentReasonChange,
  onApplyDraftPatientCredit,
  onSavePaymentSummary,
}: SessionQuickEditModalsProps) => {
  return (
    <>
      <Dialog open={presenceDialogOpen} onOpenChange={(open) => !savingPresence && onPresenceDialogOpenChange(open)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar presença</DialogTitle>
            <DialogDescription>Atualize o horário agendado, chegada e início do atendimento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="quick-scheduled-start">Horário agendado</Label>
              <Input
                id="quick-scheduled-start"
                max="2100-12-31T23:59"
                min="2000-01-01T00:00"
                type="datetime-local"
                value={draftScheduledStartAt}
                onChange={(event) => onDraftScheduledStartAtChange(event.target.value)}
                disabled={savingPresence}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="quick-patient-arrived">Horário de chegada</Label>
                {draftArrivalDeltaLabel ? (
                  <span
                    className={`text-xs font-semibold ${draftArrivalDeltaMinutes && draftArrivalDeltaMinutes > 0 ? "text-destructive" : "text-success"}`}
                  >
                    {draftArrivalDeltaLabel}
                  </span>
                ) : null}
              </div>
              <div className="relative">
                <Input
                  id="quick-patient-arrived"
                  className="pr-20"
                  max="2100-12-31T23:59"
                  min="2000-01-01T00:00"
                  type="datetime-local"
                  value={draftPatientArrivedAt}
                  onChange={(event) => onDraftPatientArrivedAtChange(event.target.value)}
                  disabled={savingPresence}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="absolute right-1 top-1/2 h-8 -translate-y-1/2 px-3 text-xs"
                  onClick={() => onDraftPatientArrivedAtChange(getCurrentDateTimeInputValue())}
                  disabled={savingPresence}
                >
                  Agora
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-session-date">Data e hora do início do atendimento</Label>
              <div className="relative">
                <Input
                  id="quick-session-date"
                  className="pr-20"
                  max="2100-12-31T23:59"
                  min="2000-01-01T00:00"
                  type="datetime-local"
                  value={draftSessionDate}
                  onChange={(event) => onDraftSessionDateChange(event.target.value)}
                  disabled={savingPresence}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="absolute right-1 top-1/2 h-8 -translate-y-1/2 px-3 text-xs"
                  onClick={() => onDraftSessionDateChange(getCurrentDateTimeInputValue())}
                  disabled={savingPresence}
                >
                  Agora
                </Button>
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onPresenceDialogOpenChange(false)}
              disabled={savingPresence}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void onSavePresenceSummary()} disabled={savingPresence}>
              {savingPresence ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar presença
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={(open) => !savingPayment && onPaymentDialogOpenChange(open)}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar pagamento</DialogTitle>
            <DialogDescription>Atualize status, valor original, ajuste, valor final e baixa do pagamento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Status de pagamento</Label>
              <PaymentStatusAutoControl
                status={draftNormalizedPaymentStatus}
                onChange={onDraftPaymentStatusChange}
                saving={savingPayment}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-payment-status-date">Data do pagamento</Label>
              <Input
                id="quick-payment-status-date"
                max="2100-12-31"
                min="2000-01-01"
                type="date"
                value={draftPaymentStatusDate}
                onChange={(event) => onDraftPaymentStatusDateChange(event.target.value)}
                disabled={savingPayment}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
              <div className="space-y-2">
                <Label htmlFor="quick-payment-method">Método de pagamento</Label>
                <Select
                  value={draftPaymentMethod}
                  onValueChange={(value) => onDraftPaymentMethodChange(normalizePaymentMethod(value))}
                  disabled={savingPayment || draftNormalizedPaymentStatus === "cortesia"}
                >
                  <SelectTrigger id="quick-payment-method">
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
              <div className="space-y-2">
                <Label htmlFor="quick-payment-installments">Parcelas</Label>
                <Select
                  value={String(draftPaymentInstallments)}
                  onValueChange={(value) => onDraftPaymentInstallmentsChange(normalizePaymentInstallments(value))}
                  disabled={savingPayment || draftNormalizedPaymentStatus === "cortesia"}
                >
                  <SelectTrigger id="quick-payment-installments">
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
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quick-amount-original">Valor original</Label>
                <CurrencyInput
                  id="quick-amount-original"
                  value={draftAmountOriginal}
                  onChange={onDraftAmountOriginalChange}
                  disabled={savingPayment}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-amount-charged">Valor final da consulta</Label>
                <CurrencyInput
                  id="quick-amount-charged"
                  value={draftAmountCharged}
                  onChange={onDraftAmountChargedChange}
                  disabled={savingPayment}
                />
              </div>
            </div>
            {draftHasPaymentAdjustment ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground line-through">{formatMoneyCents(draftAmountOriginalCents)}</span>
                  <span className="font-medium">{formatMoneyCents(draftAmountChargedCents)}</span>
                  <span className={`text-xs font-semibold ${draftPaymentAdjustmentCents > 0 ? "text-success" : "text-destructive"}`}>
                    {draftPaymentAdjustmentCents > 0 ? "+" : ""}
                    {draftPaymentAdjustmentPercent}%
                  </span>
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="quick-amount-paid">Quanto foi pago</Label>
                  {patientAvailableCreditCents > 0 ? (
                    <span className="text-xs font-medium text-primary">
                      Crédito: {formatMoneyCents(remainingDraftPatientCreditCents)}
                    </span>
                  ) : null}
                </div>
                <CurrencyInput
                  id="quick-amount-paid"
                  value={draftAmountPaid}
                  onChange={onDraftAmountPaidChange}
                  disabled={savingPayment}
                />
                {patientAvailableCreditCents > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onApplyDraftPatientCredit}
                      disabled={!canApplyDraftPatientCredit || savingPayment}
                    >
                      Usar crédito
                    </Button>
                    {effectiveDraftCreditAppliedCents > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Aplicado nesta sessão: {formatMoneyCents(effectiveDraftCreditAppliedCents)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <PaymentCompositionChips
                  creditCents={effectiveDraftCreditAppliedCents}
                  paidCents={draftAmountPaid ? Number(draftAmountPaid.replace(/\D/g, "")) : 0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-payment-adjustment-reason">Motivo do desconto/acréscimo</Label>
                <Textarea
                  id="quick-payment-adjustment-reason"
                  className="min-h-24 resize-y"
                  maxLength={PAYMENT_ADJUSTMENT_REASON_MAX_LENGTH}
                  value={draftPaymentAdjustmentReason}
                  onChange={(event) => onDraftPaymentAdjustmentReasonChange(event.target.value)}
                  placeholder="Opcional"
                  disabled={savingPayment}
                />
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Em aberto:{" "}
              {formatMoneyCents(
                draftPaymentStatus === "cortesia" ? 0 : Math.max(0, draftAmountChargedCents - draftAmountPaidCents)
              )}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onPaymentDialogOpenChange(false)}
              disabled={savingPayment}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void onSavePaymentSummary()} disabled={savingPayment}>
              {savingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar pagamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
