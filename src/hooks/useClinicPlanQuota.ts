// src/hooks/useClinicPlanQuota.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface QuotaCheckResult {
  allowed: boolean;
  current_count: number;
  max_limit: number;
  is_free_trial: boolean;
  message: string;
}

export interface ClinicPlanUsage {
  isFreeTrial: boolean;
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

export function useClinicPlanQuota(clinicId?: string | null): ClinicPlanUsage {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<Omit<ClinicPlanUsage, "loading" | "refresh">>({
    isFreeTrial: false,
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
      const { data: sub } = await supabase
        .from("clinic_subscriptions")
        .select("*")
        .eq("clinic_id", clinicId)
        .maybeSingle();

      const isTrial = !sub ? false : (sub.status === "TRIAL" || (sub as any).is_free_trial === true);

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

      const maxAtt = isTrial ? ((sub as any)?.trial_max_attendances || 20) : -1;
      const maxPat = isTrial ? ((sub as any)?.trial_max_patients || 5) : -1;
      const maxFrm = isTrial ? ((sub as any)?.trial_max_custom_forms || 1) : -1;

      const currentAtt = attendanceCount || 0;
      const currentPat = patientCount || 0;
      const currentFrm = formCount || 0;

      setUsage({
        isFreeTrial: isTrial,
        attendances: {
          current: currentAtt,
          max: maxAtt,
          remaining: maxAtt === -1 ? 999999 : Math.max(0, maxAtt - currentAtt),
          isLimitReached: maxAtt !== -1 && currentAtt >= maxAtt,
        },
        patients: {
          current: currentPat,
          max: maxPat,
          remaining: maxPat === -1 ? 999999 : Math.max(0, maxPat - currentPat),
          isLimitReached: maxPat !== -1 && currentPat >= maxPat,
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
