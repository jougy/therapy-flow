import { useState, useRef, useCallback, useEffect } from "react";
import type { AccessibleClinic } from "@/hooks/useAuth";
import { getUserClinicsSyncFromLocalStorage } from "@/lib/clinics-local-cache";

export interface UseClinicsRecoveryOptions {
  authLoading: boolean;
  userId?: string | null;
  accessibleClinics: AccessibleClinic[];
  hasEnterpriseAccess: boolean;
  isPlatformOwner?: boolean;
  refreshAuthState: () => Promise<void>;
}

export function useClinicsRecovery({
  authLoading,
  userId,
  accessibleClinics,
  hasEnterpriseAccess,
  isPlatformOwner,
  refreshAuthState,
}: UseClinicsRecoveryOptions) {
  const [isSearchingClinics, setIsSearchingClinics] = useState(false);
  const [searchClinicsAttempt, setSearchClinicsAttempt] = useState(0);
  const [searchClinicsStatusMessage, setSearchClinicsStatusMessage] = useState<string | undefined>(undefined);
  const autoSearchAttemptedRef = useRef(false);
  const inFlightSearchPromiseRef = useRef<Promise<void> | null>(null);

  const handleSearchClinics = useCallback(
    async (_isManualTrigger = true) => {
      if (inFlightSearchPromiseRef.current) {
        return inFlightSearchPromiseRef.current;
      }

      const runSearch = async () => {
        setIsSearchingClinics(true);
        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          setSearchClinicsAttempt(attempt);

          if (attempt === 1) {
            setSearchClinicsStatusMessage("Buscando seus espaços de atendimento com carinho...");
          } else if (attempt === 2) {
            setSearchClinicsStatusMessage("Reconectando aos seus dados (tentativa 2 de 3)...");
          } else {
            setSearchClinicsStatusMessage("Finalizando a busca das suas clínicas (tentativa 3 de 3)...");
          }

          try {
            await refreshAuthState();
          } catch {
            // Continua retentativa
          }

          if (accessibleClinics && accessibleClinics.length > 0) {
            setIsSearchingClinics(false);
            setSearchClinicsStatusMessage(undefined);
            return;
          }

          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 600));
          }
        }

        setIsSearchingClinics(false);
        setSearchClinicsStatusMessage(
          "Não conseguimos carregar suas clínicas agora. Isso costuma acontecer quando o sinal da internet oscila ou ao retornar após alguns dias sem acesso."
        );
      };

      const promise = runSearch().finally(() => {
        inFlightSearchPromiseRef.current = null;
      });

      inFlightSearchPromiseRef.current = promise;
      return promise;
    },
    [accessibleClinics, refreshAuthState]
  );

  useEffect(() => {
    // Se o usuário já possui clínicas em memória ou no cache local síncrono, aborta a busca forçada
    const hasLocalClinics = userId ? (getUserClinicsSyncFromLocalStorage(userId)?.length ?? 0) > 0 : false;

    if (
      authLoading ||
      !userId ||
      isPlatformOwner ||
      hasEnterpriseAccess ||
      (accessibleClinics && accessibleClinics.length > 0) ||
      hasLocalClinics ||
      autoSearchAttemptedRef.current
    ) {
      return;
    }

    autoSearchAttemptedRef.current = true;
    const timer = window.setTimeout(() => {
      void handleSearchClinics(false);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [accessibleClinics, authLoading, handleSearchClinics, hasEnterpriseAccess, isPlatformOwner, userId]);

  useEffect(() => {
    if (accessibleClinics && accessibleClinics.length > 0) {
      setSearchClinicsAttempt(0);
      setSearchClinicsStatusMessage(undefined);
      setIsSearchingClinics(false);
    }
  }, [accessibleClinics]);

  return {
    isSearchingClinics,
    searchClinicsAttempt,
    searchClinicsStatusMessage,
    handleSearchClinics,
  };
}
