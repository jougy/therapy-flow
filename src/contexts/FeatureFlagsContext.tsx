import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { withTransientRetry } from "@/lib/supabase-resilience";

export type SimulationAudienceMode = "tester" | "common";

export interface FeatureFlagsContextType {
  flags: Record<string, unknown>;
  loading: boolean;
  isFeatureEnabled: (key: string) => boolean;
  flagOverrides: Record<string, boolean>;
  setFlagOverride: (key: string, enabled: boolean) => void;
  resetFlagOverrides: () => void;
  simulationAudienceMode: SimulationAudienceMode;
  setSimulationAudienceMode: (mode: SimulationAudienceMode) => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  flags: {},
  loading: true,
  isFeatureEnabled: () => true,
  flagOverrides: {},
  setFlagOverride: () => {},
  resetFlagOverrides: () => {},
  simulationAudienceMode: "tester",
  setSimulationAudienceMode: () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export const useFeatureFlags = () => useContext(FeatureFlagsContext);

export const FeatureFlagsProvider = ({ children }: { children: ReactNode }) => {
  const { clinicId, platformAccess, isPlatformOwner, isPlatformMarketing, session } = useAuth();
  const [flagOverrides, setFlagOverrides] = useState<Record<string, boolean>>({});
  const [simulationAudienceMode, setSimulationAudienceMode] = useState<SimulationAudienceMode>("tester");
  const hasAuthContext = Boolean(session?.user?.id || isPlatformOwner || isPlatformMarketing || import.meta.env.MODE === "test");

  const { data: flags = {}, isLoading: loading } = useQuery<Record<string, unknown>>({
    queryKey: ["feature-flags", clinicId ?? "global", hasAuthContext],
    enabled: Boolean(clinicId) || hasAuthContext,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!clinicId) {
        const { data, error } = await withTransientRetry(async () =>
          await supabase
            .from("feature_flags")
            .select("key, value")
            .eq("scope", "global")
        );

        if (error) {
          console.error("Erro ao carregar feature flags globais:", error);
          return {};
        }

        const globalFlags: Record<string, unknown> = {};
        data?.forEach((item) => {
          if (item.key) {
            globalFlags[item.key] = item.value;
          }
        });
        return globalFlags;
      }

      const { data, error } = await withTransientRetry(async () =>
        await supabase.rpc("get_clinic_feature_flags", { _clinic_id: clinicId })
      );

      if (error) {
        console.error("Erro ao carregar feature flags:", error);
        return {};
      }

      return (data as Record<string, unknown>) || {};
    },
  });

  const setFlagOverride = (key: string, enabled: boolean) => {
    setFlagOverrides((prev) => ({ ...prev, [key]: enabled }));
  };

  const resetFlagOverrides = () => {
    setFlagOverrides({});
  };

  const isFeatureEnabled = (key: string) => {
    // 1. Overrides explícitos no modal de flags da simulação têm precedência imediata
    if (key in flagOverrides) {
      return flagOverrides[key];
    }

    const val = flags[key];
    let isRawEnabled = true;
    let visibility: "all" | "testers" = "all";

    if (val && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      if ("enabled" in obj) {
        isRawEnabled = obj.enabled === true;
      }
      if (obj.visibility === "testers") {
        visibility = "testers";
      }
    } else if (val !== undefined) {
      isRawEnabled = val === true;
    }

    if (!isRawEnabled) {
      return false;
    }

    // 2. Se a feature flag é restrita a 'testers':
    if (visibility === "testers") {
      const isSimulationActive = Boolean(platformAccess?.isSimulation);

      // Se estamos em modo de simulação no backoffice:
      if (isSimulationActive) {
        // Se a visão selecionada for 'common' (usuário comum), a flag de teste fica desligada
        if (simulationAudienceMode === "common") {
          return false;
        }
        // Se for visão 'tester', permite acesso
        return true;
      }

      // Fora de simulação: platform owners sempre têm visão completa
      if (isPlatformOwner) {
        return true;
      }

      // Usuário comum em produção: flag restrita a testers fica desativada
      return false;
    }

    return isRawEnabled;
  };

  return (
    <FeatureFlagsContext.Provider
      value={{
        flags,
        loading,
        isFeatureEnabled,
        flagOverrides,
        setFlagOverride,
        resetFlagOverrides,
        simulationAudienceMode,
        setSimulationAudienceMode,
      }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  );
};

