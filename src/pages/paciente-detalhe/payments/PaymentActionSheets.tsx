import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { calculateSessionUnitAmountCents } from "@/lib/payment-plans";
import {
  formatMoneyCents,
  getSessionBalanceCents,
  parseCurrencyToCents,
} from "@/lib/session-operations";
import {
  createPatientPaymentPlan,
  receiveSessionsPayment,
  upsertPatientHealthInsurance,
  type ReceivePaymentMethodOption,
} from "./paymentMutations";
import { ResponsiveFinanceSheet } from "./ResponsiveFinanceSheet";
import { AddCreditSheetForm } from "./sheets/AddCreditSheetForm";
import { LinkInsuranceSheetForm } from "./sheets/LinkInsuranceSheetForm";
import { NewPlanSheetForm } from "./sheets/NewPlanSheetForm";
import { ReceivePaymentSheetForm } from "./sheets/ReceivePaymentSheetForm";
import type {
  ClinicHealthInsuranceItem,
  PatientHealthInsuranceRecord,
  PatientPaymentPlanRow,
  PaymentSheetKind,
  Session,
} from "./types";

export interface PaymentActionSheetsProps {
  activeSheet: PaymentSheetKind;
  onClose: () => void;
  patientId: string;
  clinicId: string;
  userId?: string | null;
  creditBalanceCents: number;
  activePlan: PatientPaymentPlanRow | null;
  patientInsurance: PatientHealthInsuranceRecord | null;
  clinicInsurances: ClinicHealthInsuranceItem[];
  targetSession: Session | null;
  pendingSessions: Session[];
  onAddCredit: (amountCents: number, method: string, note?: string) => void;
  onDeductCredit: (usedCents: number) => void;
  onReloadPayments: () => Promise<void> | void;
  onRefreshSessions?: () => void;
}

export const PaymentActionSheets: React.FC<PaymentActionSheetsProps> = ({
  activeSheet,
  onClose,
  patientId,
  clinicId,
  userId,
  creditBalanceCents,
  activePlan,
  patientInsurance,
  clinicInsurances,
  targetSession,
  pendingSessions,
  onAddCredit,
  onDeductCredit,
  onReloadPayments,
  onRefreshSessions,
}) => {
  const [submitting, setSubmitting] = React.useState(false);

  const [creditPreset, setCreditPreset] = React.useState<number | "custom">(20_000);
  const [creditCustomInput, setCreditCustomInput] = React.useState("");
  const [creditMethod, setCreditMethod] = React.useState<string>("pix");

  const [planName, setPlanName] = React.useState("Pacote de 10 Sessões");
  const [planSessions, setPlanSessions] = React.useState<number>(10);
  const [planAmountInput, setPlanAmountInput] = React.useState("1.000,00");
  const [planMethod, setPlanMethod] = React.useState("pix");
  const [planStatus, setPlanStatus] = React.useState<"pago" | "pendente">("pago");

  const [selectedInsuranceId, setSelectedInsuranceId] = React.useState<string>("");
  const [customInsuranceName, setCustomInsuranceName] = React.useState("");
  const [cardNumber, setCardNumber] = React.useState("");
  const [guideNumber, setGuideNumber] = React.useState("");

  const [receiveMethod, setReceiveMethod] = React.useState<ReceivePaymentMethodOption>("pix");

  React.useEffect(() => {
    if (activeSheet === "add-credit") {
      setCreditPreset(20_000);
      setCreditCustomInput("");
      setCreditMethod("pix");
    } else if (activeSheet === "new-plan") {
      setPlanName(activePlan ? `Renovação ${activePlan.total_sessions} Sessões` : "Pacote de 10 Sessões");
      setPlanSessions(activePlan?.total_sessions || 10);
      setPlanAmountInput("1.000,00");
      setPlanMethod("pix");
      setPlanStatus("pago");
    } else if (activeSheet === "link-insurance") {
      setSelectedInsuranceId(
        patientInsurance?.health_insurance_id || (clinicInsurances[0]?.id ?? "custom"),
      );
      setCustomInsuranceName(patientInsurance?.insurance_name_custom || "");
      setCardNumber(patientInsurance?.card_number || "");
      setGuideNumber(patientInsurance?.plan_tier || "");
    } else if (activeSheet === "receive-payment") {
      setReceiveMethod("pix");
    }
  }, [activeSheet, activePlan, clinicInsurances, patientInsurance]);

  const targetSessionsList = React.useMemo(
    () => (targetSession ? [targetSession] : pendingSessions),
    [pendingSessions, targetSession],
  );

  const amountToReceiveCents = React.useMemo(
    () =>
      targetSessionsList.reduce((acc, session) => {
        const balance = getSessionBalanceCents(session);
        return acc + (balance > 0 ? balance : session.amount_charged_cents ?? 0);
      }, 0),
    [targetSessionsList],
  );

  const planTotalCents = parseCurrencyToCents(planAmountInput);
  const planUnitCents = calculateSessionUnitAmountCents(planTotalCents, planSessions);
  const remainingPlanSessions = activePlan
    ? Math.max(0, activePlan.total_sessions - activePlan.used_sessions)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);

      if (activeSheet === "add-credit") {
        const cents =
          creditPreset === "custom" ? parseCurrencyToCents(creditCustomInput) : creditPreset;
        if (cents <= 0) {
          toast({ title: "Informe um valor válido", variant: "destructive" });
          return;
        }
        onAddCredit(cents, creditMethod);
        toast({
          title: "Crédito adicionado",
          description: `${formatMoneyCents(cents)} adicionados ao saldo do paciente.`,
        });
        onClose();
        return;
      }

      if (activeSheet === "new-plan") {
        if (planSessions <= 0 || planTotalCents <= 0) {
          toast({ title: "Preencha quantidade de sessões e valor", variant: "destructive" });
          return;
        }
        await createPatientPaymentPlan({
          clinicId,
          patientId,
          userId,
          name: planName,
          totalSessions: planSessions,
          totalAmountCents: planTotalCents,
          paymentMethod: planMethod,
          paymentStatus: planStatus,
        });
        await onReloadPayments();
        toast({
          title: activePlan ? "Pacote renovado" : "Pacote criado",
          description: `${planSessions} sessões (${formatMoneyCents(planUnitCents)}/sessão).`,
        });
        onClose();
        return;
      }

      if (activeSheet === "link-insurance") {
        if (!cardNumber.trim()) {
          toast({ title: "Informe o número da carteirinha", variant: "destructive" });
          return;
        }
        const isCustom = !selectedInsuranceId || selectedInsuranceId === "custom";
        if (isCustom && !customInsuranceName.trim()) {
          toast({ title: "Selecione ou informe a operadora", variant: "destructive" });
          return;
        }
        await upsertPatientHealthInsurance({
          clinicId,
          patientId,
          existingRecord: patientInsurance,
          healthInsuranceId: isCustom ? null : selectedInsuranceId,
          customName: isCustom ? customInsuranceName : null,
          cardNumber,
          guideNumber,
        });
        await onReloadPayments();
        toast({ title: "Convênio vinculado ao paciente" });
        onClose();
        return;
      }

      if (activeSheet === "receive-payment") {
        const { settledCount } = await receiveSessionsPayment({
          targetSessions: targetSessionsList,
          method: receiveMethod,
          creditBalanceCents,
          activePlan,
          onDeductCredit,
        });
        await onReloadPayments();
        onRefreshSessions?.();
        toast({
          title: "Pagamento registrado",
          description: `${settledCount} ${settledCount === 1 ? "sessão atualizada" : "sessões atualizadas"}.`,
        });
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Não foi possível concluir a operação.";
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!activeSheet) return null;

  const sheetMeta: Record<
    Exclude<PaymentSheetKind, null>,
    { title: string; desc: string; cta: string }
  > = {
    "add-credit": {
      title: "Adicionar Crédito Livre",
      desc: "Adicione saldo antecipado para abater nas próximas sessões.",
      cta: "Confirmar Crédito",
    },
    "new-plan": {
      title: activePlan ? "Renovar Pacote de Sessões" : "Novo Pacote de Sessões",
      desc: "Defina a quantidade de sessões e o valor total do pacote.",
      cta: activePlan ? "Salvar Renovação" : "Criar Pacote",
    },
    "link-insurance": {
      title: "Vincular Plano de Saúde",
      desc: "Associe a operadora, carteirinha e número da guia do paciente.",
      cta: "Salvar Convênio",
    },
    "receive-payment": {
      title: "Receber Pagamento",
      desc:
        targetSessionsList.length > 1
          ? `Quitar ${targetSessionsList.length} sessões pendentes (${formatMoneyCents(amountToReceiveCents)}).`
          : `Quitar sessão pendente (${formatMoneyCents(amountToReceiveCents)}).`,
      cta: "Confirmar Recebimento",
    },
  };

  const meta = sheetMeta[activeSheet];

  return (
    <ResponsiveFinanceSheet
      open={Boolean(activeSheet)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={meta.title}
      description={meta.desc}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="min-h-[44px]">
            Cancelar
          </Button>
          <Button
            type="submit"
            form="patient-finance-sheet-form"
            disabled={submitting}
            className="min-h-[44px]"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {meta.cta}
          </Button>
        </div>
      }
    >
      <form id="patient-finance-sheet-form" onSubmit={handleSubmit} className="space-y-4">
        {activeSheet === "add-credit" ? (
          <AddCreditSheetForm
            creditPreset={creditPreset}
            onCreditPresetChange={setCreditPreset}
            creditCustomInput={creditCustomInput}
            onCreditCustomInputChange={setCreditCustomInput}
            creditMethod={creditMethod}
            onCreditMethodChange={setCreditMethod}
          />
        ) : null}

        {activeSheet === "new-plan" ? (
          <NewPlanSheetForm
            planName={planName}
            onPlanNameChange={setPlanName}
            planSessions={planSessions}
            onPlanSessionsChange={setPlanSessions}
            planAmountInput={planAmountInput}
            onPlanAmountInputChange={setPlanAmountInput}
            planUnitCents={planUnitCents}
            planStatus={planStatus}
            onPlanStatusChange={setPlanStatus}
            planMethod={planMethod}
            onPlanMethodChange={setPlanMethod}
          />
        ) : null}

        {activeSheet === "link-insurance" ? (
          <LinkInsuranceSheetForm
            clinicInsurances={clinicInsurances}
            selectedInsuranceId={selectedInsuranceId}
            onSelectedInsuranceIdChange={setSelectedInsuranceId}
            customInsuranceName={customInsuranceName}
            onCustomInsuranceNameChange={setCustomInsuranceName}
            cardNumber={cardNumber}
            onCardNumberChange={setCardNumber}
            guideNumber={guideNumber}
            onGuideNumberChange={setGuideNumber}
          />
        ) : null}

        {activeSheet === "receive-payment" ? (
          <ReceivePaymentSheetForm
            amountToReceiveCents={amountToReceiveCents}
            receiveMethod={receiveMethod}
            onReceiveMethodChange={setReceiveMethod}
            creditBalanceCents={creditBalanceCents}
            activePlan={activePlan}
            remainingPlanSessions={remainingPlanSessions}
            patientInsurance={patientInsurance}
          />
        ) : null}
      </form>
    </ResponsiveFinanceSheet>
  );
};
