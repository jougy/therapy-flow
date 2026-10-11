import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { localTelemetryManager, type TelemetryActionType, type TelemetryTriggerReason } from "@/lib/telemetry-local-store";

export type TelemetryEventType =
  | "print_screen"
  | "document_print"
  | "page_view"
  | "export_pdf"
  | "export_json"
  | "clinical_records_saved"
  | "forms_completed"
  | "upgrade_views"
  | "form_validation_errors"
  | "error_event";

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
  const lastSyncedUserLoginRef = useRef<string | null>(null);

  // Keep local telemetry store context updated with active clinic & user
  useEffect(() => {
    localTelemetryManager.setContext(clinicId, userName);
  }, [clinicId, userName]);

  // Sync on Login / User Identification
  useEffect(() => {
    if (user?.id && lastSyncedUserLoginRef.current !== user.id) {
      lastSyncedUserLoginRef.current = user.id;
      void localTelemetryManager.syncToServer({
        clinicId,
        userName,
        force: true,
        triggerReason: "login",
      });
    }
  }, [user?.id, clinicId, userName]);

  const trackEvent = useCallback(
    ({
      eventType,
      pathname,
      metadata = {},
    }: TrackEventOptions) => {
      const targetPath = pathname || location.pathname;

      // Record in local store (zero immediate database calls, batches up to 15 actions)
      localTelemetryManager.recordAction(eventType as TelemetryActionType, targetPath, {
        dwell_time_seconds: Number(metadata.dwell_time_seconds || 0),
      });

      // If anti-print or critical event, attempt an immediate sync pass
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

  // Explicit Flush on Logout
  const flushOnLogout = useCallback(async () => {
    return localTelemetryManager.syncToServer({
      clinicId,
      userName,
      force: true,
      triggerReason: "logout",
    });
  }, [clinicId, userName]);

  // General Sync Trigger helper
  const syncToServer = useCallback(
    (options?: { force?: boolean; triggerReason?: TelemetryTriggerReason }) => {
      return localTelemetryManager.syncToServer({
        clinicId,
        userName,
        ...options,
      });
    },
    [clinicId, userName]
  );

  // Sync on Online connection restore (flush backlog on reconnection)
  useEffect(() => {
    const handleOnline = () => {
      void localTelemetryManager.syncToServer({
        clinicId,
        userName,
        force: true,
        triggerReason: "online",
      });
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [clinicId, userName]);

  // Sync on App Exit / PWA tab close / beforeunload / visibility change
  useEffect(() => {
    const handleExit = () => {
      void localTelemetryManager.syncToServer({
        clinicId,
        userName,
        force: true,
        triggerReason: "app_exit",
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleExit();
      }
    };

    window.addEventListener("pagehide", handleExit);
    window.addEventListener("beforeunload", handleExit);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handleExit);
      window.removeEventListener("beforeunload", handleExit);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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

  const trackExportJson = useCallback(
    (resourceType: string, resourceId?: string, metadata?: Record<string, unknown>) => {
      return trackEvent({
        eventType: "export_json",
        resourceType,
        resourceId,
        metadata: {
          trigger: "export_json_action",
          ...metadata,
        },
      });
    },
    [trackEvent]
  );

  const trackClinicalRecordSaved = useCallback(
    (resourceType?: string, resourceId?: string, metadata?: Record<string, unknown>) => {
      trackEvent({
        eventType: "clinical_records_saved",
        resourceType,
        resourceId,
        metadata: {
          trigger: "clinical_record_saved",
          ...metadata,
        },
      });
      // High-value clinical action: domain event sync
      void localTelemetryManager.syncToServer({
        clinicId,
        userName,
        force: true,
        triggerReason: "domain_event",
      });
    },
    [clinicId, userName, trackEvent]
  );

  const trackFormCompleted = useCallback(
    (templateId?: string, metadata?: Record<string, unknown>) => {
      trackEvent({
        eventType: "forms_completed",
        resourceId: templateId,
        metadata: {
          trigger: "form_completion",
          ...metadata,
        },
      });
    },
    [trackEvent]
  );

  const trackUpgradeView = useCallback(
    (planOrFeature?: string, metadata?: Record<string, unknown>) => {
      trackEvent({
        eventType: "upgrade_views",
        metadata: {
          planOrFeature,
          ...metadata,
        },
      });
    },
    [trackEvent]
  );

  const trackFormValidationError = useCallback(
    (formIdOrStep?: string, errorsCount?: number, metadata?: Record<string, unknown>) => {
      trackEvent({
        eventType: "form_validation_errors",
        metadata: {
          formIdOrStep,
          errorsCount,
          ...metadata,
        },
      });
    },
    [trackEvent]
  );

  const trackError = useCallback(
    (errorInfo: { scope?: string; message: string; stack?: string; context?: unknown }) => {
      localTelemetryManager.recordError(errorInfo);
    },
    []
  );

  return {
    trackEvent,
    trackDocumentPrint,
    trackExportPdf,
    trackExportJson,
    trackClinicalRecordSaved,
    trackFormCompleted,
    trackUpgradeView,
    trackFormValidationError,
    trackError,
    triggerDomainSync,
    flushOnLogout,
    syncToServer,
  };
}
