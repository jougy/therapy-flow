import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface FeatureFlagsContextType {
  flags: Record<string, unknown>;
  loading: boolean;
  isFeatureEnabled: (key: string) => boolean;
  flagOverrides: Record<string, boolean>;
  setFlagOverride: (key: string, enabled: boolean) => void;
  resetFlagOverrides: () => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  flags: {},
  loading: true,
  isFeatureEnabled: () => true,
  flagOverrides: {},
  setFlagOverride: () => {},
  resetFlagOverrides: () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export const useFeatureFlags = () => useContext(FeatureFlagsContext);

export const FeatureFlagsProvider = ({ children }: { children: ReactNode }) => {
  const { clinicId } = useAuth();
  const [flags, setFlags] = useState<Record<string, unknown>>({});
  const [flagOverrides, setFlagOverrides] = useState<Record<string, boolean>>({});
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
    if (key in flagOverrides) {
      return flagOverrides[key];
    }

    const val = flags[key];
    if (val && typeof val === "object" && "enabled" in val) {
      return (val as { enabled?: boolean }).enabled === true;
    }
    if (val !== undefined) {
      return val === true;
    }
    return true;
  };

  return (
    <FeatureFlagsContext.Provider value={{ flags, loading, isFeatureEnabled, flagOverrides, setFlagOverride, resetFlagOverrides }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

