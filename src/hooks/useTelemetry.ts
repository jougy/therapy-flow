import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { localTelemetryManager } from "@/lib/telemetry-local-store";

export type TelemetryEventType = 
  | 'print_screen'
  | 'document_print'
  | 'page_view'
  | 'export_pdf';

export interface TrackEventOptions {
  eventType: TelemetryEventType;
  pathname?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export function useTelemetry() {
  const { user, profile, clinicId } = useAuth();
  const location = useLocation();

  const currentPathRef = useRef<string>(location.pathname);
  const entryTimeRef = useRef<number>(Date.now());

  const userName = profile?.full_name || profile?.email || user?.email || "Usuário Desconhecido";

  const trackEvent = useCallback(
    ({
      eventType,
      pathname,
      metadata = {},
    }: TrackEventOptions) => {
      const targetPath = pathname || location.pathname;

      // Record in local store (zero immediate database calls)
      localTelemetryManager.recordAction(eventType, targetPath, {
        dwell_time_seconds: Number(metadata.dwell_time_seconds || 0),
      });

      // If anti-print or critical event, attempt a sync pass
      if (eventType === "print_screen") {
        void localTelemetryManager.syncToServer({
          clinicId,
          userName,
          triggerReason: "domain_event",
        });
      }
    },
    [clinicId, userName, location.pathname]
  );

  // Trigger explicit Domain Event Sync (e.g. patient created, session saved)
  const triggerDomainSync = useCallback(
    (reason: "PATIENT_CREATED" | "SESSION_SAVED" | "CUSTOM" = "CUSTOM") => {
      return localTelemetryManager.syncToServer({
        clinicId,
        userName,
        force: true,
        triggerReason: "domain_event",
      });
    },
    [clinicId, userName]
  );

  // 5-Minute Periodic Cooldown Check Sync
  useEffect(() => {
    const interval = setInterval(() => {
      void localTelemetryManager.syncToServer({
        clinicId,
        userName,
        triggerReason: "periodic",
      });
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearInterval(interval);
    };
  }, [clinicId, userName]);

  // Sync on App Exit / PWA tab close
  useEffect(() => {
    const handleExit = () => {
      void localTelemetryManager.syncToServer({
        clinicId,
        userName,
        force: true,
        triggerReason: "app_exit",
      });
    };

    window.addEventListener("pagehide", handleExit);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        handleExit();
      }
    });

    return () => {
      window.removeEventListener("pagehide", handleExit);
    };
  }, [clinicId, userName]);

  // Track Page Views & Dwell Time
  useEffect(() => {
    const previousPath = currentPathRef.current;
    const now = Date.now();
    const dwellTimeSeconds = Math.max(1, Math.round((now - entryTimeRef.current) / 1000));

    if (previousPath && previousPath !== location.pathname) {
      trackEvent({
        eventType: "page_view",
        pathname: previousPath,
        metadata: {
          dwell_time_seconds: dwellTimeSeconds,
        },
      });
    }

    currentPathRef.current = location.pathname;
    entryTimeRef.current = now;

    trackEvent({
      eventType: "page_view",
      pathname: location.pathname,
      metadata: {
        action: "entry",
      },
    });
  }, [location.pathname, trackEvent]);

  // Intercept Global Browser Print Events
  useEffect(() => {
    const handleBeforePrint = () => {
      trackEvent({
        eventType: "document_print",
        metadata: {
          trigger: "window.onbeforeprint",
        },
      });
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
    };
  }, [trackEvent]);

  const trackDocumentPrint = useCallback(
    (resourceType: string, resourceId?: string, metadata?: Record<string, unknown>) => {
      return trackEvent({
        eventType: "document_print",
        resourceType,
        resourceId,
        metadata: {
          trigger: "button_click",
          ...metadata,
        },
      });
    },
    [trackEvent]
  );

  const trackExportPdf = useCallback(
    (resourceType: string, resourceId?: string, metadata?: Record<string, unknown>) => {
      return trackEvent({
        eventType: "export_pdf",
        resourceType,
        resourceId,
        metadata: {
          trigger: "export_pdf_action",
          ...metadata,
        },
      });
    },
    [trackEvent]
  );

  return {
    trackEvent,
    trackDocumentPrint,
    trackExportPdf,
    triggerDomainSync,
  };
}
