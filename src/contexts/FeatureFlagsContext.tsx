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
  isFeatureEnabled: () => false,
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
    if (!clinicId) {
      setFlags({});
      setLoading(false);
      return;
    }

    setLoading(true);
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

