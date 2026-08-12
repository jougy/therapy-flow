import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTelemetry } from "@/hooks/useTelemetry";
import { toast } from "@/hooks/use-toast";

const DEFAULT_PROTECTED_ROUTES = [
  "/pacientes",
  "/sessoes",
  "/formularios",
  "/configuracoes/equipe",
];

export interface AntiPrintConfig {
  enabled: boolean;
  protectedRoutes?: string[];
}

export function useAntiPrintProtection() {
  const { clinicId } = useAuth();
  const location = useLocation();
  const { trackEvent } = useTelemetry();

  const [isBlurred, setIsBlurred] = useState(false);
  const [config, setConfig] = useState<AntiPrintConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const lastTriggerTimeRef = useRef<number>(0);

  // Load clinic feature flag configuration for anti_print_protection
  const loadConfig = useCallback(async () => {
    if (!clinicId) {
      setConfig(null);
      setLoadingConfig(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("value")
        .eq("key", "anti_print_protection")
        .or(`clinic_id.eq.${clinicId},scope.eq.global`)
        .order("scope", { ascending: false }) // clinic scope overrides global
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const val = data[0].value;
        if (typeof val === "boolean") {
          setConfig({ enabled: val, protectedRoutes: DEFAULT_PROTECTED_ROUTES });
        } else if (typeof val === "object" && val !== null) {
          const rawObj = val as Record<string, unknown>;
          const isEnabled = rawObj.enabled === true || rawObj.enabled === "true";
          const routes = Array.isArray(rawObj.protectedRoutes)
            ? (rawObj.protectedRoutes as string[])
            : DEFAULT_PROTECTED_ROUTES;
          setConfig({ enabled: isEnabled, protectedRoutes: routes });
        } else {
          setConfig({ enabled: false });
        }
      } else {
        setConfig({ enabled: false });
      }
    } catch (err) {
      console.warn("[AntiPrint] Failed to load flag config:", err);
      setConfig({ enabled: false });
    } finally {
      setLoadingConfig(false);
    }
  }, [clinicId]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  // Check if current route is protected
  const isRouteProtected = useCallback(() => {
    if (!config?.enabled) return false;
    const routes = config.protectedRoutes || DEFAULT_PROTECTED_ROUTES;
    const current = location.pathname;

    return routes.some((route) => {
      if (route === current) return true;
      if (route !== "/" && current.startsWith(route)) return true;
      return false;
    });
  }, [config, location.pathname]);

  const handlePrintDetection = useCallback(
    (reason: string) => {
      if (!isRouteProtected()) return;

      const now = Date.now();
      // Throttle triggers to prevent multiple logs/alerts within 2 seconds
      if (now - lastTriggerTimeRef.current < 2000) return;
      lastTriggerTimeRef.current = now;

      // 1. Log telemetry event
      void trackEvent({
        eventType: "print_screen",
        pathname: location.pathname,
        metadata: {
          detection_reason: reason,
        },
      });

      // 2. Display Toast warning
      toast({
        title: "Pluri-Health detectou esta captura de tela",
        description: "Esta página contém dados confidenciais protegidos por LGPD.",
        variant: "destructive",
      });

      // 3. Activate Blur State
      setIsBlurred(true);
    },
    [isRouteProtected, location.pathname, trackEvent]
  );

  // Keydown Event Listener for Print Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key (Windows/Linux)
      if (e.key === "PrintScreen" || e.code === "PrintScreen") {
        e.preventDefault();
        handlePrintDetection("PrintScreen Key");
        return;
      }

      // macOS Shortcuts: Meta + Shift + 3, 4, 5
      if (e.metaKey && e.shiftKey) {
        if (["Digit3", "Digit4", "Digit5", "Key3", "Key4", "Key5", "3", "4", "5"].includes(e.code) || ["3", "4", "5"].includes(e.key)) {
          handlePrintDetection(`macOS Shortcut Meta+Shift+${e.key}`);
          return;
        }
      }

      // Ctrl + PrintScreen / Alt + PrintScreen
      if (e.key === "PrintScreen" && (e.ctrlKey || e.altKey)) {
        e.preventDefault();
        handlePrintDetection("Ctrl/Alt + PrintScreen");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [handlePrintDetection]);

  // Monitor Window Focus / Visibility Changes
  useEffect(() => {
    let focusLostTime = 0;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        focusLostTime = Date.now();
      } else {
        // If window lost visibility for a short duration while on protected route, evaluate as potential snipping tool capture
        const duration = Date.now() - focusLostTime;
        if (focusLostTime > 0 && duration > 100 && duration < 5000) {
          if (isRouteProtected()) {
            handlePrintDetection("Visibility Change / Snipping Tool Detection");
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [handlePrintDetection, isRouteProtected]);

  const unblur = useCallback(() => {
    setIsBlurred(false);
  }, []);

  return {
    isBlurred,
    unblur,
    isProtected: isRouteProtected(),
    loadingConfig,
    refetchConfig: loadConfig,
  };
}
