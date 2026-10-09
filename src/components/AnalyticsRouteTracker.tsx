import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initGlobalAnalytics, trackPageView } from "@/lib/analytics-tracker";

/**
 * Componente declarativo que inicializa o rastreamento unificado (Meta Pixel, GA4, Clarity)
 * e dispara automaticamente PageView a cada transição de rota no React Router.
 */
export function AnalyticsRouteTracker() {
  const location = useLocation();

  useEffect(() => {
    initGlobalAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}
