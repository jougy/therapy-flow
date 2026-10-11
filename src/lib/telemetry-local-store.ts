import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "therapy-flow.clientTelemetryStore";
const SPAM_BLOCK_DURATION_MS = 15 * 60 * 1000;
const MAX_ACTIONS_PER_5_MINUTES = 80; // Rate limit threshold
const ACTION_SYNC_THRESHOLD = 15; // Auto-sync batch threshold

export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  timeString?: string;
  scope: string;
  message: string;
  stack?: string;
  context?: unknown;
}

export interface ClientTelemetryData {
  pageViews: number;
  printsDetected: number;
  docsPrinted: number;
  pdfExported: number;
  jsonExported: number;
  clinicalRecordsSaved: number;
  formsCompleted: number;
  upgradeViews: number;
  formValidationErrors: number;
  errorEventsCount: number;
  dwellTimeSeconds: number;
  routes: Record<string, number>;
  actionHistory: number[]; // timestamps
  lastSyncTime: number;
  unsyncedActionsCount: number;
  recentErrors: ErrorLogEntry[];
  isSpamBlocked: boolean;
  spamBlockedUntil: number | null;
  spamReason: string | null;
}

export type TelemetryActionType =
  | "page_view"
  | "print_screen"
  | "document_print"
  | "export_pdf"
  | "export_json"
  | "clinical_records_saved"
  | "clinical_record_saved"
  | "forms_completed"
  | "form_completed"
  | "upgrade_views"
  | "upgrade_view"
  | "form_validation_errors"
  | "form_validation_error"
  | "error_event";

const getInitialStore = (): ClientTelemetryData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ClientTelemetryData>;
      return {
        pageViews: parsed.pageViews || 0,
        printsDetected: parsed.printsDetected || 0,
        docsPrinted: parsed.docsPrinted || 0,
        pdfExported: parsed.pdfExported || 0,
        jsonExported: parsed.jsonExported || 0,
        clinicalRecordsSaved: parsed.clinicalRecordsSaved || 0,
        formsCompleted: parsed.formsCompleted || 0,
        upgradeViews: parsed.upgradeViews || 0,
        formValidationErrors: parsed.formValidationErrors || 0,
        errorEventsCount: parsed.errorEventsCount || 0,
        dwellTimeSeconds: parsed.dwellTimeSeconds || 0,
        routes: parsed.routes || {},
        actionHistory: Array.isArray(parsed.actionHistory) ? parsed.actionHistory : [],
        lastSyncTime: parsed.lastSyncTime || 0,
        unsyncedActionsCount: parsed.unsyncedActionsCount || 0,
        recentErrors: Array.isArray(parsed.recentErrors) ? parsed.recentErrors : [],
        isSpamBlocked: parsed.isSpamBlocked || false,
        spamBlockedUntil: parsed.spamBlockedUntil || null,
        spamReason: parsed.spamReason || null,
      };
    }
  } catch (e) {
    console.warn("[LocalTelemetry] Error reading localStorage store:", e);
  }

  return {
    pageViews: 0,
    printsDetected: 0,
    docsPrinted: 0,
    pdfExported: 0,
    jsonExported: 0,
    clinicalRecordsSaved: 0,
    formsCompleted: 0,
    upgradeViews: 0,
    formValidationErrors: 0,
    errorEventsCount: 0,
    dwellTimeSeconds: 0,
    routes: {},
    actionHistory: [],
    lastSyncTime: 0,
    unsyncedActionsCount: 0,
    recentErrors: [],
    isSpamBlocked: false,
    spamBlockedUntil: null,
    spamReason: null,
  };
};

export type TelemetryTriggerReason =
  | "login"
  | "logout"
  | "app_exit"
  | "periodic"
  | "domain_event"
  | "manual"
  | "threshold_batch"
  | "online"
  | "error_occurred";

export interface TelemetrySyncOptions {
  clinicId?: string | null;
  userName?: string;
  force?: boolean;
  isSpamAlert?: boolean;
  triggerReason?: TelemetryTriggerReason;
  keepalive?: boolean;
}

export const sanitizeTelemetryRoute = (path: string): string => {
  if (!path) return "/";
  // Remove query params and hash fragments
  const cleanPath = path.split("?")[0].split("#")[0].trim();
  if (!cleanPath) return "/";

  return cleanPath
    // Replace UUIDs with :id to prevent PHI exposure / table bloating
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    // Replace numeric IDs in path segments
    .replace(/\/\d+(?=\/|$)/g, "/:id");
};

class ClientTelemetryManager {
  private store: ClientTelemetryData;
  private inFlightSyncPromise: Promise<void> | null = null;
  private cachedClinicId: string | null = null;
  private cachedUserName: string = "Usuário";

  constructor() {
    this.store = getInitialStore();
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    } catch (e) {
      console.warn("[LocalTelemetry] Error saving to localStorage:", e);
    }
  }

  public setContext(clinicId?: string | null, userName?: string) {
    if (clinicId !== undefined) {
      this.cachedClinicId = clinicId;
    }
    if (userName) {
      this.cachedUserName = userName;
    }
  }

  // Check if spam block has expired
  private checkSpamBlockStatus(): boolean {
    if (this.store.isSpamBlocked && this.store.spamBlockedUntil) {
      if (Date.now() >= this.store.spamBlockedUntil) {
        this.store.isSpamBlocked = false;
        this.store.spamBlockedUntil = null;
        this.store.spamReason = null;
        this.save();
        return false;
      }
      return true; // Still blocked
    }
    return false;
  }

  // Accumulate local action
  public recordAction(
    type: TelemetryActionType,
    pathname: string,
    metadata: { dwell_time_seconds?: number } = {}
  ) {
    const now = Date.now();

    // Check if blocked by anti-spam rate limiter
    if (this.checkSpamBlockStatus()) {
      console.warn("[LocalTelemetry] Action ignored due to active anti-spam block.");
      return;
    }

    // Clean old action timestamps (keep only last 10 minutes)
    const tenMinsAgo = now - 10 * 60 * 1000;
    this.store.actionHistory = this.store.actionHistory.filter((t) => t >= tenMinsAgo);
    this.store.actionHistory.push(now);

    const safeRoute = sanitizeTelemetryRoute(pathname);

    // Increment specific counters
    if (type === "page_view") {
      this.store.pageViews += 1;
      const currentRouteCount = this.store.routes[safeRoute] || 0;
      this.store.routes[safeRoute] = currentRouteCount + 1;

      if (metadata.dwell_time_seconds) {
        this.store.dwellTimeSeconds += metadata.dwell_time_seconds;
      }
    } else if (type === "print_screen") {
      this.store.printsDetected += 1;
    } else if (type === "document_print") {
      this.store.docsPrinted += 1;
    } else if (type === "export_pdf") {
      this.store.pdfExported += 1;
    } else if (type === "export_json") {
      this.store.jsonExported += 1;
    } else if (type === "clinical_records_saved" || type === "clinical_record_saved") {
      this.store.clinicalRecordsSaved += 1;
    } else if (type === "forms_completed" || type === "form_completed") {
      this.store.formsCompleted += 1;
    } else if (type === "upgrade_views" || type === "upgrade_view") {
      this.store.upgradeViews += 1;
    } else if (type === "form_validation_errors" || type === "form_validation_error") {
      this.store.formValidationErrors += 1;
    } else if (type === "error_event") {
      this.store.errorEventsCount += 1;
    }

    this.store.unsyncedActionsCount = (this.store.unsyncedActionsCount || 0) + 1;

    // Anti-Spam Defense Check (actions in last 5 minutes)
    const fiveMinsAgo = now - 5 * 60 * 1000;
    const recentActionsIn5Mins = this.store.actionHistory.filter((t) => t >= fiveMinsAgo).length;

    if (recentActionsIn5Mins >= MAX_ACTIONS_PER_5_MINUTES && !this.store.isSpamBlocked) {
      // Trigger Anti-Spam Defense!
      this.store.isSpamBlocked = true;
      this.store.spamBlockedUntil = now + SPAM_BLOCK_DURATION_MS;
      this.store.spamReason = `Rate limit excedido: ${recentActionsIn5Mins} ações em 5 minutos. Conexão pausada por 15 minutos.`;
      this.save();

      try {
        toast({
          title: "Alerta de Segurança Pluri-Health",
          description: "Frequência anormal de ações por minuto detectada. Sua sincronização foi pausada temporariamente por 15 minutos.",
          variant: "destructive",
        });
      } catch {
        // Safe fallback
      }

      // Dispatch emergency single RPC alert to Backoffice
      void this.syncToServer({ isSpamAlert: true });
      return;
    }

    this.save();

    // Auto-sync threshold trigger (15 actions batch)
    if (this.store.unsyncedActionsCount >= ACTION_SYNC_THRESHOLD) {
      void this.syncToServer({
        clinicId: this.cachedClinicId,
        userName: this.cachedUserName,
        force: true,
        triggerReason: "threshold_batch",
      });
    }
  }

  // Record an error event and immediately trigger telemetry synchronization
  public recordError(errorInfo: {
    scope?: string;
    message: string;
    stack?: string;
    context?: unknown;
  }) {
    const now = Date.now();
    const date = new Date(now);
    const timeString = `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;

    const errorItem: ErrorLogEntry = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
      timeString,
      scope: errorInfo.scope || "runtime",
      message: errorInfo.message || "Erro desconhecido",
      stack: errorInfo.stack,
      context: errorInfo.context,
    };

    this.store.errorEventsCount = (this.store.errorEventsCount || 0) + 1;
    this.store.unsyncedActionsCount = (this.store.unsyncedActionsCount || 0) + 1;
    const currentRecent = Array.isArray(this.store.recentErrors) ? this.store.recentErrors : [];
    this.store.recentErrors = [errorItem, ...currentRecent.slice(0, 49)];
    this.save();

    void this.syncToServer({
      clinicId: this.cachedClinicId,
      userName: this.cachedUserName,
      force: true,
      triggerReason: "error_occurred",
    });
  }

  // Idempotent & Concurrency-Safe Sync to Server via single RPC upsert
  public async syncToServer({
    clinicId,
    userName,
    force = false,
    isSpamAlert = false,
    triggerReason = "domain_event",
  }: TelemetrySyncOptions = {}): Promise<void> {
    const activeClinicId = clinicId !== undefined ? clinicId : this.cachedClinicId;
    const activeUserName = userName || this.cachedUserName || "Usuário";

    // If a sync is already in flight, wait for it before evaluating next sync pass
    if (this.inFlightSyncPromise) {
      await this.inFlightSyncPromise;
    }

    const syncExecution = async () => {
      const now = Date.now();

      // Check if spam block is active and not an emergency spam alert
      if (!isSpamAlert && this.checkSpamBlockStatus()) {
        console.warn("[LocalTelemetry] Sync skipped because user is currently rate-limited.");
        return;
      }

      // Check if there is anything to sync
      const hasDataToSync =
        this.store.pageViews > 0 ||
        this.store.printsDetected > 0 ||
        this.store.docsPrinted > 0 ||
        this.store.pdfExported > 0 ||
        this.store.jsonExported > 0 ||
        this.store.clinicalRecordsSaved > 0 ||
        this.store.formsCompleted > 0 ||
        this.store.upgradeViews > 0 ||
        this.store.formValidationErrors > 0 ||
        this.store.errorEventsCount > 0 ||
        this.store.isSpamBlocked;

      if (!hasDataToSync && !isSpamAlert && triggerReason !== "login") {
        return;
      }

      // Extract delta snapshot and immediately subtract to allow new concurrent actions
      const delta = {
        pageViews: this.store.pageViews,
        printsDetected: this.store.printsDetected,
        docsPrinted: this.store.docsPrinted,
        pdfExported: this.store.pdfExported,
        jsonExported: this.store.jsonExported,
        clinicalRecordsSaved: this.store.clinicalRecordsSaved,
        formsCompleted: this.store.formsCompleted,
        upgradeViews: this.store.upgradeViews,
        formValidationErrors: this.store.formValidationErrors,
        errorEventsCount: this.store.errorEventsCount,
        dwellTimeSeconds: this.store.dwellTimeSeconds,
        unsyncedActionsCount: this.store.unsyncedActionsCount,
        routes: { ...this.store.routes },
        isSpamFlagged: this.store.isSpamBlocked,
        spamReason: this.store.spamReason,
      };

      this.store.pageViews -= delta.pageViews;
      this.store.printsDetected -= delta.printsDetected;
      this.store.docsPrinted -= delta.docsPrinted;
      this.store.pdfExported -= delta.pdfExported;
      this.store.jsonExported -= delta.jsonExported;
      this.store.clinicalRecordsSaved -= delta.clinicalRecordsSaved;
      this.store.formsCompleted -= delta.formsCompleted;
      this.store.upgradeViews -= delta.upgradeViews;
      this.store.formValidationErrors -= delta.formValidationErrors;
      this.store.errorEventsCount -= delta.errorEventsCount;
      this.store.dwellTimeSeconds -= delta.dwellTimeSeconds;
      this.store.unsyncedActionsCount = Math.max(0, (this.store.unsyncedActionsCount || 0) - delta.unsyncedActionsCount);
      this.store.routes = {};
      this.store.lastSyncTime = now;
      this.save();

      try {
        const { error } = await supabase.rpc("upsert_user_telemetry_summary", {
          _clinic_id: activeClinicId || null,
          _user_name: activeUserName || "Usuário",
          _page_views: delta.pageViews,
          _prints_detected: delta.printsDetected,
          _docs_printed: delta.docsPrinted,
          _pdf_exported: delta.pdfExported,
          _dwell_seconds: delta.dwellTimeSeconds,
          _top_routes: delta.routes,
          _is_spam_flagged: delta.isSpamFlagged,
          _spam_reason: delta.spamReason,
        });

        if (error) {
          console.warn("[LocalTelemetry] Sync RPC failed:", error.message);
          // Rollback delta counters back into store on RPC error
          this.rollbackDelta(delta);
        }
      } catch (err) {
        console.warn("[LocalTelemetry] Error calling sync RPC:", err);
        this.rollbackDelta(delta);
      }
    };

    this.inFlightSyncPromise = syncExecution().finally(() => {
      this.inFlightSyncPromise = null;
    });

    return this.inFlightSyncPromise;
  }

  private rollbackDelta(delta: {
    pageViews: number;
    printsDetected: number;
    docsPrinted: number;
    pdfExported: number;
    jsonExported: number;
    clinicalRecordsSaved: number;
    formsCompleted: number;
    upgradeViews: number;
    formValidationErrors: number;
    errorEventsCount: number;
    dwellTimeSeconds: number;
    unsyncedActionsCount: number;
    routes: Record<string, number>;
  }) {
    this.store.pageViews += delta.pageViews;
    this.store.printsDetected += delta.printsDetected;
    this.store.docsPrinted += delta.docsPrinted;
    this.store.pdfExported += delta.pdfExported;
    this.store.jsonExported += delta.jsonExported;
    this.store.clinicalRecordsSaved += delta.clinicalRecordsSaved;
    this.store.formsCompleted += delta.formsCompleted;
    this.store.upgradeViews += delta.upgradeViews;
    this.store.formValidationErrors += delta.formValidationErrors;
    this.store.errorEventsCount += delta.errorEventsCount;
    this.store.dwellTimeSeconds += delta.dwellTimeSeconds;
    this.store.unsyncedActionsCount = (this.store.unsyncedActionsCount || 0) + delta.unsyncedActionsCount;
    for (const [r, c] of Object.entries(delta.routes)) {
      this.store.routes[r] = (this.store.routes[r] || 0) + c;
    }
    this.save();
  }

  public flushImmediate(options?: Omit<TelemetrySyncOptions, "force">) {
    return this.syncToServer({ ...options, force: true });
  }

  public resetLocalStore() {
    this.store = {
      pageViews: 0,
      printsDetected: 0,
      docsPrinted: 0,
      pdfExported: 0,
      jsonExported: 0,
      clinicalRecordsSaved: 0,
      formsCompleted: 0,
      upgradeViews: 0,
      formValidationErrors: 0,
      errorEventsCount: 0,
      dwellTimeSeconds: 0,
      routes: {},
      actionHistory: [],
      lastSyncTime: 0,
      unsyncedActionsCount: 0,
      recentErrors: [],
      isSpamBlocked: false,
      spamBlockedUntil: null,
      spamReason: null,
    };
    this.save();
  }

  public getStore(): ClientTelemetryData {
    return { ...this.store };
  }

  public getRecentErrors(): ErrorLogEntry[] {
    return Array.isArray(this.store.recentErrors) ? [...this.store.recentErrors] : [];
  }

  public clearRecentErrors() {
    this.store.recentErrors = [];
    this.save();
  }
}

export const localTelemetryManager = new ClientTelemetryManager();
