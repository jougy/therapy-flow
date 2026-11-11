import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const { clinicId, platformAccess, isPlatformOwner } = useAuth();
  const [flags, setFlags] = useState<Record<string, unknown>>({});
  const [flagOverrides, setFlagOverrides] = useState<Record<string, boolean>>({});
  const [simulationAudienceMode, setSimulationAudienceMode] = useState<SimulationAudienceMode>("tester");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    if (!clinicId) {
      // Quando clinicId não está definido (ex: Espaço Pessoal / rotas do profissional),
      // buscar as feature flags de escopo global para aplicar as diretrizes da plataforma
      supabase
        .from("feature_flags")
        .select("key, value")
        .eq("scope", "global")
        .then(({ data, error }) => {
          if (error) {
            console.error("Erro ao carregar feature flags globais:", error);
            setFlags({});
          } else {
            const globalFlags: Record<string, unknown> = {};
            data?.forEach((item) => {
              if (item.key) {
                globalFlags[item.key] = item.value;
              }
            });
            setFlags(globalFlags);
          }
        })
        .finally(() => {
          setLoading(false);
        });
      return;
    }

    supabase.rpc("get_clinic_feature_flags", { _clinic_id: clinicId })
      .then(({ data, error }) => {
        if (error) {
          console.error("Erro ao carregar feature flags:", error);
          setFlags({});
        } else {
          setFlags((data as Record<string, unknown>) || {});
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [clinicId]);

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

