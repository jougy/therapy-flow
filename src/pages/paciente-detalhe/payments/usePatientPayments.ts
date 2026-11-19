import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  loadPatientCreditState,
  savePatientCreditState,
  type ClinicHealthInsuranceItem,
  type PatientCreditState,
  type PatientHealthInsuranceRecord,
  type PatientPaymentPlanRow,
} from "./types";

export function usePatientPayments(params: {
  patientId: string;
  clinicId: string;
  canReadFinance: boolean;
}) {
  const { patientId, clinicId, canReadFinance } = params;
  const [paymentPlans, setPaymentPlans] = React.useState<PatientPaymentPlanRow[]>([]);
  const [clinicInsurances, setClinicInsurances] = React.useState<ClinicHealthInsuranceItem[]>([]);
  const [patientInsurance, setPatientInsurance] =
    React.useState<PatientHealthInsuranceRecord | null>(null);
  const [creditState, setCreditState] = React.useState<PatientCreditState>(() =>
    loadPatientCreditState(patientId),
  );
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setCreditState(loadPatientCreditState(patientId));
  }, [patientId]);

  const loadPaymentsData = React.useCallback(async () => {
    if (!patientId || !clinicId || !canReadFinance) return;
    setLoading(true);
    try {
      const untyped = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null }>;
            };
          };
        };
      };

      const [plansRes, clinicInsRes, patientInsRes] = await Promise.all([
        supabase
          .from("patient_payment_plans")
          .select("*")
          .eq("patient_id", patientId)
          .neq("payment_status", "cancelado")
          .order("created_at", { ascending: false }),
        untyped
          .from("clinic_health_insurances")
          .select("id, name, ans_code, payment_term_days, is_active, deleted_at")
          .eq("clinic_id", clinicId)
          .order("name", { ascending: true }),
        untyped
          .from("patient_health_insurances")
          .select("*")
          .eq("patient_id", patientId)
          .order("updated_at", { ascending: false }),
      ]);

      if (plansRes.data) {
        setPaymentPlans(plansRes.data as PatientPaymentPlanRow[]);
      }
      if (clinicInsRes.data) {
        setClinicInsurances(
          (clinicInsRes.data as Array<ClinicHealthInsuranceItem & { deleted_at?: string | null }>).filter(
            (item) => item.is_active !== false && !item.deleted_at,
          ),
        );
      }
      if (patientInsRes.data && patientInsRes.data.length > 0) {
        setPatientInsurance(patientInsRes.data[0] as PatientHealthInsuranceRecord);
      } else {
        setPatientInsurance(null);
      }
    } finally {
      setLoading(false);
    }
  }, [canReadFinance, clinicId, patientId]);

  React.useEffect(() => {
    void loadPaymentsData();
  }, [loadPaymentsData]);

  const handleAddCredit = React.useCallback(
    (amountCents: number, method: string, note?: string) => {
      setCreditState((prev) => {
        const next: PatientCreditState = {
          balance_cents: prev.balance_cents + amountCents,
          history: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              amount_cents: amountCents,
              method,
              created_at: new Date().toISOString(),
              note,
            },
            ...prev.history.slice(0, 14),
          ],
        };
        savePatientCreditState(patientId, next);
        return next;
      });
    },
    [patientId],
  );

  const handleDeductCredit = React.useCallback(
    (usedCents: number) => {
      if (usedCents <= 0) return;
      setCreditState((prev) => {
        const next: PatientCreditState = {
          balance_cents: Math.max(0, prev.balance_cents - usedCents),
          history: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              amount_cents: -usedCents,
              method: "credito_usado",
              created_at: new Date().toISOString(),
              note: "Abatimento em sessão",
            },
            ...prev.history.slice(0, 14),
          ],
        };
        savePatientCreditState(patientId, next);
        return next;
      });
    },
    [patientId],
  );

  return {
    paymentPlans,
    clinicInsurances,
    patientInsurance,
    creditState,
    loading,
    loadPaymentsData,
    handleAddCredit,
    handleDeductCredit,
  };
}
