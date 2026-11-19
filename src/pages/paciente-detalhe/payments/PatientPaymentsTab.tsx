import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getSessionBalanceCents } from "@/lib/session-operations";
import { cn } from "@/lib/utils";
import { PaymentActionSheets } from "./PaymentActionSheets";
import { PaymentsChargesList } from "./PaymentsChargesList";
import { PaymentsPillarsDetails } from "./PaymentsPillarsDetails";
import { PaymentsSummaryCards } from "./PaymentsSummaryCards";
import { isSessionPendingCharge, type PaymentSheetKind, type Session } from "./types";
import { usePatientPayments } from "./usePatientPayments";

export interface PatientPaymentsTabProps {
  patientId: string;
  clinicId: string;
  sessions: Session[];
  onRefreshSessions?: () => void;
}

export const PatientPaymentsTab: React.FC<PatientPaymentsTabProps> = ({
  patientId,
  clinicId,
  sessions,
  onRefreshSessions,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const { can, user } = useAuth();
  const canReadFinance = can("treasury.read") || can("treasury.manage");
  const canManageFinance = can("treasury.manage");

  const {
    paymentPlans,
    clinicInsurances,
    patientInsurance,
    creditState,
    loading,
    loadPaymentsData,
    handleAddCredit,
    handleDeductCredit,
  } = usePatientPayments({ patientId, clinicId, canReadFinance });

  const [activeSheet, setActiveSheet] = React.useState<PaymentSheetKind>(null);
  const [targetSession, setTargetSession] = React.useState<Session | null>(null);

  const pendingSessions = React.useMemo(
    () => sessions.filter(isSessionPendingCharge),
    [sessions],
  );

  const pendingTotalCents = React.useMemo(
    () =>
      pendingSessions.reduce((sum, s) => {
        const bal = getSessionBalanceCents(s);
        return sum + (bal > 0 ? bal : s.amount_charged_cents ?? 0);
      }, 0),
    [pendingSessions],
  );

  const activePlan = React.useMemo(
    () =>
      paymentPlans.find((p) => (p.used_sessions ?? 0) < (p.total_sessions ?? 1)) ??
      paymentPlans[0] ??
      null,
    [paymentPlans],
  );

  const resolvedInsuranceName = React.useMemo(() => {
    if (!patientInsurance) return null;
    if (patientInsurance.health_insurance_id) {
      const found = clinicInsurances.find((c) => c.id === patientInsurance.health_insurance_id);
      if (found) return found.name;
    }
    return patientInsurance.insurance_name_custom || "Convênio vinculado";
  }, [clinicInsurances, patientInsurance]);

  if (!canReadFinance) {
    return (
      <div className="w-full max-w-full min-w-0 rounded-2xl border border-dashed p-8 text-center">
        <Lock className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">
          Acesso financeiro restrito
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Solicite permissão de visualização financeira para consultar pagamentos deste paciente.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
      className="w-full max-w-full min-w-0 overflow-x-hidden space-y-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">
          Financeiro do Paciente
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void loadPaymentsData()}
          disabled={loading}
          className="min-h-[44px] px-3 text-xs text-muted-foreground"
        >
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      <PaymentsSummaryCards
        pendingTotalCents={pendingTotalCents}
        pendingCount={pendingSessions.length}
        creditBalanceCents={creditState.balance_cents}
        activePlan={activePlan}
        patientInsurance={patientInsurance}
        insuranceName={resolvedInsuranceName}
        canManageFinance={canManageFinance}
        onOpenReceiveAll={() => {
          setTargetSession(null);
          setActiveSheet("receive-payment");
        }}
        onOpenAddCredit={() => setActiveSheet("add-credit")}
        onOpenNewPlan={() => setActiveSheet("new-plan")}
        onOpenLinkInsurance={() => setActiveSheet("link-insurance")}
      />

      <PaymentsChargesList
        sessions={sessions}
        canManageFinance={canManageFinance}
        onReceiveSession={(session) => {
          setTargetSession(session);
          setActiveSheet("receive-payment");
        }}
      />

      <PaymentsPillarsDetails
        activePlan={activePlan}
        creditState={creditState}
        patientInsurance={patientInsurance}
        resolvedInsuranceName={resolvedInsuranceName}
        canManageFinance={canManageFinance}
        onOpenNewPlan={() => setActiveSheet("new-plan")}
        onOpenAddCredit={() => setActiveSheet("add-credit")}
        onOpenLinkInsurance={() => setActiveSheet("link-insurance")}
      />

      <PaymentActionSheets
        activeSheet={activeSheet}
        onClose={() => {
          setActiveSheet(null);
          setTargetSession(null);
        }}
        patientId={patientId}
        clinicId={clinicId}
        userId={user?.id}
        creditBalanceCents={creditState.balance_cents}
        activePlan={activePlan}
        patientInsurance={patientInsurance}
        clinicInsurances={clinicInsurances}
        targetSession={targetSession}
        pendingSessions={pendingSessions}
        onAddCredit={handleAddCredit}
        onDeductCredit={handleDeductCredit}
        onReloadPayments={loadPaymentsData}
        onRefreshSessions={onRefreshSessions}
      />
    </motion.div>
  );
};
