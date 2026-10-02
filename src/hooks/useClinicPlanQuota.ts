// src/hooks/useClinicPlanQuota.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculateTrialRemainingTime } from "@/lib/trial";

export interface QuotaCheckResult {
  allowed: boolean;
  current_count: number;
  max_limit: number;
  is_free_trial: boolean;
  message: string;
}

export interface ClinicPlanUsage {
  isFreeTrial: boolean;
  isTrialExpired: boolean;
  isExpired: boolean;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  attendances: {
    current: number;
    max: number;
    remaining: number;
    isLimitReached: boolean;
  };
  patients: {
    current: number;
    max: number;
    remaining: number;
    isLimitReached: boolean;
  };
  forms: {
    current: number;
    max: number;
    remaining: number;
    isLimitReached: boolean;
  };
  loading: boolean;
  refresh: () => Promise<void>;
}

interface ClinicSubscriptionRecord {
  status?: string | null;
  is_free_trial?: boolean | null;
  expires_at?: string | null;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  is_read_only?: boolean | null;
  trial_ended?: boolean | null;
  is_expired?: boolean | null;
  plan_type?: string | null;
  trial_max_attendances?: number | null;
  trial_max_patients?: number | null;
  trial_max_custom_forms?: number | null;
  [key: string]: unknown;
}

export function useClinicPlanQuota(clinicId?: string | null): ClinicPlanUsage {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<Omit<ClinicPlanUsage, "loading" | "refresh">>({
    isFreeTrial: false,
    isTrialExpired: false,
    isExpired: false,
    subscriptionStatus: "",
    trialEndsAt: null,
    daysRemaining: null,
    hoursRemaining: null,
    attendances: { current: 0, max: 20, remaining: 20, isLimitReached: false },
    patients: { current: 0, max: 5, remaining: 5, isLimitReached: false },
    forms: { current: 0, max: 1, remaining: 1, isLimitReached: false },
  });

  const fetchQuotas = useCallback(async () => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    try {
      // 1. Buscar assinatura da clínica
      const { data: subData } = await supabase
        .from("clinic_subscriptions")
        .select("*")
        .eq("clinic_id", clinicId)
        .maybeSingle();

      const sub = subData as ClinicSubscriptionRecord | null;
      const rawStatus = (sub?.status || "").toUpperCase();
      const isTrial = !sub ? false : (rawStatus === "TRIAL" || sub.is_free_trial === true);
      const isTimeExpired = sub?.expires_at
        ? new Date(sub.expires_at).getTime() < Date.now()
        : sub?.current_period_end
        ? new Date(sub.current_period_end).getTime() < Date.now()
        : false;
      const isExplicitReadOnly = Boolean(sub?.is_read_only);
      const isTrialExplicitEnded = sub?.trial_ended === true || sub?.is_expired === true;

      // 2. Contar Atendimentos Realizados (não cancelados e não rascunho)
      const { count: attendanceCount } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .neq("status", "cancelado")
        .neq("status", "rascunho");

      // 3. Contar Pacientes Ativos
      const { count: patientCount } = await supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("is_active", true);

      // 4. Contar Formulários Personalizados Ativos
      const { count: formCount } = await supabase
        .from("anamnesis_form_templates")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("is_system_default", false)
        .eq("is_active", true);

      const planType = sub?.plan_type || "";
      const isProfBasico = planType === "prof_basico" || planType === "prof-basico";

      const maxAtt = isTrial ? (sub?.trial_max_attendances || 20) : -1;
      const maxPat = isTrial ? (sub?.trial_max_patients || 5) : -1;
      const maxFrm = isTrial ? (sub?.trial_max_custom_forms || 1) : isProfBasico ? 1 : -1;

      const currentAtt = attendanceCount || 0;
      const currentPat = patientCount || 0;
      const currentFrm = formCount || 0;

      const isAttLimitReached = maxAtt !== -1 && currentAtt >= maxAtt;
      const isPatLimitReached = maxPat !== -1 && currentPat >= maxPat;
      const isQuotaExhausted = isTrial && (isAttLimitReached || isPatLimitReached);

      const isTrialExpiredCalculated =
        rawStatus === "TRIAL_EXPIRED" ||
        (isTrial && (isTimeExpired || isExplicitReadOnly || isQuotaExhausted || isTrialExplicitEnded));

      const isSubscriptionExpired =
        rawStatus === "EXPIRED" ||
        rawStatus === "SUSPENDED" ||
        isTrialExpiredCalculated ||
        (isTimeExpired && !isTrial);

      const trialEndsAtDate = sub?.trial_ends_at || sub?.expires_at || sub?.current_period_end || null;
      const { daysRemaining: calculatedDaysRemaining, hoursRemaining: calculatedHoursRemaining } =
        calculateTrialRemainingTime(trialEndsAtDate);

      setUsage({
        isFreeTrial: isTrial,
        isTrialExpired: isTrialExpiredCalculated,
        isExpired: isSubscriptionExpired,
        subscriptionStatus: rawStatus,
        trialEndsAt: trialEndsAtDate,
        daysRemaining: calculatedDaysRemaining,
        hoursRemaining: calculatedHoursRemaining,
        attendances: {
          current: currentAtt,
          max: maxAtt,
          remaining: maxAtt === -1 ? 999999 : Math.max(0, maxAtt - currentAtt),
          isLimitReached: isAttLimitReached,
        },
        patients: {
          current: currentPat,
          max: maxPat,
          remaining: maxPat === -1 ? 999999 : Math.max(0, maxPat - currentPat),
          isLimitReached: isPatLimitReached,
        },
        forms: {
          current: currentFrm,
          max: maxFrm,
          remaining: maxFrm === -1 ? 999999 : Math.max(0, maxFrm - currentFrm),
          isLimitReached: maxFrm !== -1 && currentFrm >= maxFrm,
        },
      });
    } catch (err) {
      console.error("Erro ao carregar cotas da clínica:", err);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchQuotas();
  }, [fetchQuotas]);

  return {
    ...usage,
    loading,
    refresh: fetchQuotas,
  };
}
