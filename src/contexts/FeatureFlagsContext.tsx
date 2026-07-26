import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface FeatureFlagsContextType {
  flags: Record<string, any>;
  loading: boolean;
  isFeatureEnabled: (key: string) => boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  flags: {},
  loading: true,
  isFeatureEnabled: () => false,
});

export const useFeatureFlags = () => useContext(FeatureFlagsContext);

export const FeatureFlagsProvider = ({ children }: { children: ReactNode }) => {
  const { clinicId } = useAuth();
  const [flags, setFlags] = useState<Record<string, any>>({});
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
          setFlags((data as Record<string, any>) || {});
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [clinicId]);

  const isFeatureEnabled = (key: string) => {
    const val = flags[key];
    if (val && typeof val === 'object') {
      return val.enabled === true;
    }
    return val === true;
  };

  return (
    <FeatureFlagsContext.Provider value={{ flags, loading, isFeatureEnabled }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};
