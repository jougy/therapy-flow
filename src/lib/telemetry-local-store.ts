import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  type CanonicalPageColumn,
  type PageDwellMatrix,
  resolveCanonicalPageColumn,
} from "@/lib/telemetry/canonical-matrix";
import {
  sanitizeErrorEntryForCloud,
  shouldSkipDuplicateError,
  resetErrorDeduplicator,
} from "@/lib/telemetry/lgpd-scrubber";
import {
  getObservabilityMulticloudConfig,
  dispatchMatrixToUpstash,
  dispatchErrorToAxiom,
} from "@/lib/telemetry/multicloud-drivers";

const STORAGE_KEY = "therapy-flow.clientTelemetryStore";
const SPAM_BLOCK_DURATION_MS = 15 * 60 * 1000;
const MAX_ACTIONS_PER_5_MINUTES = 80;
const ACTION_SYNC_THRESHOLD = 15;

const METRIC_KEYS = [
  "pageViews", "printsDetected", "docsPrinted", "pdfExported", "jsonExported",
  "clinicalRecordsSaved", "formsCompleted", "upgradeViews", "formValidationErrors", "errorEventsCount",
] as const;

export interface ErrorLogEntry {
  id: string; timestamp: number; timeString?: string;
  scope: string; message: string; stack?: string; context?: unknown;
}

export interface ClientTelemetryData {
  pageViews: number; printsDetected: number; docsPrinted: number; pdfExported: number; jsonExported: number;
  clinicalRecordsSaved: number; formsCompleted: number; upgradeViews: number; formValidationErrors: number;
  errorEventsCount: number; dwellTimeSeconds: number; routes: Record<string, number>;
  pageDwellMatrix: PageDwellMatrix; actionHistory: number[]; lastSyncTime: number;
  unsyncedActionsCount: number; recentErrors: ErrorLogEntry[]; isSpamBlocked: boolean;
  spamBlockedUntil: number | null; spamReason: string | null;
}

export type TelemetryActionType =
  | "page_view" | "print_screen" | "document_print" | "export_pdf" | "export_json"
  | "clinical_records_saved" | "clinical_record_saved" | "forms_completed" | "form_completed"
  | "upgrade_views" | "upgrade_view" | "form_validation_errors" | "form_validation_error" | "error_event";

const ACTION_COUNTER_MAP: Record<string, (typeof METRIC_KEYS)[number]> = {
  page_view: "pageViews", print_screen: "printsDetected", document_print: "docsPrinted",
  export_pdf: "pdfExported", export_json: "jsonExported", clinical_records_saved: "clinicalRecordsSaved",
  clinical_record_saved: "clinicalRecordsSaved", forms_completed: "formsCompleted", form_completed: "formsCompleted",
  upgrade_views: "upgradeViews", upgrade_view: "upgradeViews", form_validation_errors: "formValidationErrors",
  form_validation_error: "formValidationErrors", error_event: "errorEventsCount",
};

const createDefaultStore = (): ClientTelemetryData => ({
  pageViews: 0, printsDetected: 0, docsPrinted: 0, pdfExported: 0, jsonExported: 0,
  clinicalRecordsSaved: 0, formsCompleted: 0, upgradeViews: 0, formValidationErrors: 0,
  errorEventsCount: 0, dwellTimeSeconds: 0, routes: {}, pageDwellMatrix: {},
  actionHistory: [], lastSyncTime: 0, unsyncedActionsCount: 0, recentErrors: [],
  isSpamBlocked: false, spamBlockedUntil: null, spamReason: null,
});

const getInitialStore = (): ClientTelemetryData => {
  const base = createDefaultStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<ClientTelemetryData>;
    return {
      ...base, ...parsed,
      routes: parsed.routes || {}, pageDwellMatrix: parsed.pageDwellMatrix || {},
      actionHistory: Array.isArray(parsed.actionHistory) ? parsed.actionHistory : [],
      recentErrors: Array.isArray(parsed.recentErrors) ? parsed.recentErrors : [],
    };
  } catch (e) {
    console.warn("[LocalTelemetry] Erro ao ler store do localStorage:", e);
    return base;
  }
};

export type TelemetryTriggerReason =
  | "login" | "logout" | "app_exit" | "periodic" | "domain_event"
  | "manual" | "threshold_batch" | "online" | "error_occurred";

export interface TelemetrySyncOptions {
  clinicId?: string | null; userName?: string; force?: boolean;
  isSpamAlert?: boolean; triggerReason?: TelemetryTriggerReason; keepalive?: boolean;
}

export interface RecordErrorInfo {
  scope?: string; message: string; stack?: string; context?: unknown;
  syncImmediately?: boolean; forceDirectInsert?: boolean;
}

export const sanitizeTelemetryRoute = (path: string): string => {
  if (!path) return "/";
  const clean = path.split("?")[0].split("#")[0].trim();
  if (!clean) return "/";
  return clean
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:id");
};

class ClientTelemetryManager {
  private store: ClientTelemetryData;
  private inFlightSyncPromise: Promise<void> | null = null;
  private cachedClinicId: string | null = null;
  private cachedUserName = "Usuário";

  constructor() {
    this.store = getInitialStore();
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    } catch (e) {
      console.warn("[LocalTelemetry] Erro ao salvar store no localStorage:", e);
    }
  }

  public setContext(clinicId?: string | null, userName?: string) {
    if (clinicId !== undefined) this.cachedClinicId = clinicId;
    if (userName) this.cachedUserName = userName;
  }

  private checkSpamBlockStatus(): boolean {
    if (this.store.isSpamBlocked && this.store.spamBlockedUntil) {
      if (Date.now() >= this.store.spamBlockedUntil) {
        this.store.isSpamBlocked = false;
        this.store.spamBlockedUntil = null;
        this.store.spamReason = null;
        this.save();
        return false;
      }
      return true;
    }
    return false;
  }

  public recordAction(
    type: TelemetryActionType,
    pathname: string,
    metadata: { dwell_time_seconds?: number } = {}
  ) {
    const now = Date.now();
    if (this.checkSpamBlockStatus()) {
      console.warn("[LocalTelemetry] Ação ignorada devido a bloqueio anti-spam ativo.");
      return;
    }

    const tenMinsAgo = now - 10 * 60 * 1000;
    this.store.actionHistory = this.store.actionHistory.filter((t) => t >= tenMinsAgo);
    this.store.actionHistory.push(now);

    const safeRoute = sanitizeTelemetryRoute(pathname);
    const canonicalCol = resolveCanonicalPageColumn(pathname);

    const counterKey = ACTION_COUNTER_MAP[type];
    if (counterKey) this.store[counterKey] += 1;

    if (type === "page_view") {
      this.store.routes[safeRoute] = (this.store.routes[safeRoute] || 0) + 1;
      if (metadata.dwell_time_seconds) this.store.dwellTimeSeconds += metadata.dwell_time_seconds;
    }

    if (type === "page_view" || metadata.dwell_time_seconds) {
      if (!(canonicalCol in this.store.pageDwellMatrix)) this.store.pageDwellMatrix[canonicalCol] = 0;
      if (metadata.dwell_time_seconds) {
        this.store.pageDwellMatrix[canonicalCol] =
          (this.store.pageDwellMatrix[canonicalCol] || 0) + metadata.dwell_time_seconds;
      }
    }

    this.store.unsyncedActionsCount = (this.store.unsyncedActionsCount || 0) + 1;

    const fiveMinsAgo = now - 5 * 60 * 1000;
    const recentActionsIn5Mins = this.store.actionHistory.filter((t) => t >= fiveMinsAgo).length;

    if (recentActionsIn5Mins >= MAX_ACTIONS_PER_5_MINUTES && !this.store.isSpamBlocked) {
      this.store.isSpamBlocked = true;
      this.store.spamBlockedUntil = now + SPAM_BLOCK_DURATION_MS;
      this.store.spamReason = `Rate limit excedido: ${recentActionsIn5Mins} ações em 5 minutos. Conexão pausada por 15 minutos.`;
      this.save();

      try {
        toast({
          title: "Alerta de Segurança Pluri-Health",
          description: "Frequência anormal de ações detectada. A sincronização foi pausada temporariamente.",
          variant: "destructive",
        });
      } catch {
        // Fallback silencioso
      }

      void this.syncToServer({ isSpamAlert: true });
      return;
    }

    this.save();

    if (this.store.unsyncedActionsCount >= ACTION_SYNC_THRESHOLD) {
      void this.syncToServer({
        clinicId: this.cachedClinicId, userName: this.cachedUserName,
        force: true, triggerReason: "threshold_batch",
      });
    }
  }

  public recordPageDwell(pathname: string, seconds: number) {
    if (seconds <= 0) return;
    this.store.dwellTimeSeconds += seconds;
    const col = resolveCanonicalPageColumn(pathname);
    this.store.pageDwellMatrix[col] = (this.store.pageDwellMatrix[col] || 0) + seconds;
    this.store.unsyncedActionsCount = (this.store.unsyncedActionsCount || 0) + 1;
    this.save();
  }

  public recordError(errorInfo: RecordErrorInfo) {
    const route = typeof window !== "undefined" ? window.location.pathname : "/";
    const sanitized = sanitizeErrorEntryForCloud({
      scope: errorInfo.scope || "runtime", message: errorInfo.message,
      stack: errorInfo.stack, context: errorInfo.context,
    });

    const now = Date.now();
    const d = new Date(now);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const timeString = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const errorItem: ErrorLogEntry = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`, timestamp: now, timeString,
      scope: sanitized.scope, message: sanitized.message, stack: sanitized.stack, context: sanitized.context,
    };

    this.store.errorEventsCount = (this.store.errorEventsCount || 0) + 1;
    this.store.unsyncedActionsCount = (this.store.unsyncedActionsCount || 0) + 1;
    const currentRecent = Array.isArray(this.store.recentErrors) ? this.store.recentErrors : [];
    this.store.recentErrors = [errorItem, ...currentRecent.slice(0, 49)];
    this.save();

    if (shouldSkipDuplicateError(errorItem.scope, errorItem.message, route)) return;

    const config = getObservabilityMulticloudConfig();
    const driver = config.errorLogsDriver;

    if (driver === "axiom") {
      void dispatchErrorToAxiom({
        timestamp: new Date(now).toISOString(), scope: errorItem.scope,
        message: errorItem.message, stack: errorItem.stack, context: errorItem.context,
        route, clinic_id: this.cachedClinicId,
      });
      return;
    }

    if (driver === "supabase_optimized" || errorInfo.forceDirectInsert) {
      void (async () => {
        try {
          const { data: authData } = await supabase.auth.getSession();
          const { error } = await supabase.from("platform_error_logs").insert({
            user_id: authData?.session?.user?.id || null, clinic_id: this.cachedClinicId || null,
            error_type: "runtime", scope: errorItem.scope, message: errorItem.message,
            stack_trace: errorItem.stack || null, context: (errorItem.context as Record<string, unknown>) || {}, route,
          });
          if (error) console.warn("[LocalTelemetry] Falha ao persistir erro em platform_error_logs:", error.message);
        } catch (err) {
          console.warn("[LocalTelemetry] Erro de rede ao persistir log:", err);
        }
      })();

      void this.syncToServer({
        clinicId: this.cachedClinicId, userName: this.cachedUserName, force: true, triggerReason: "error_occurred",
      });
      return;
    }

    if (errorInfo.syncImmediately) {
      void this.syncToServer({
        clinicId: this.cachedClinicId, userName: this.cachedUserName, force: true, triggerReason: "error_occurred",
      });
    }
  }

  public async syncToServer({
    clinicId, userName, force = false, isSpamAlert = false, triggerReason = "domain_event",
  }: TelemetrySyncOptions = {}): Promise<void> {
    const activeClinicId = clinicId !== undefined ? clinicId : this.cachedClinicId;
    const activeUserName = userName || this.cachedUserName || "Usuário";

    if (this.inFlightSyncPromise) await this.inFlightSyncPromise;

    const syncExecution = async () => {
      const now = Date.now();
      if (!isSpamAlert && this.checkSpamBlockStatus()) {
        console.warn("[LocalTelemetry] Sincronização ignorada: usuário com rate limit ativo.");
        return;
      }

      const hasMatrixData = Object.values(this.store.pageDwellMatrix).some((v) => (v || 0) > 0);
      const hasDataToSync =
        this.store.dwellTimeSeconds > 0 || this.store.isSpamBlocked ||
        hasMatrixData || METRIC_KEYS.some((key) => this.store[key] > 0);

      if (!hasDataToSync && !isSpamAlert && triggerReason !== "login") return;

      const delta = {
        pageViews: this.store.pageViews, printsDetected: this.store.printsDetected,
        docsPrinted: this.store.docsPrinted, pdfExported: this.store.pdfExported,
        jsonExported: this.store.jsonExported, clinicalRecordsSaved: this.store.clinicalRecordsSaved,
        formsCompleted: this.store.formsCompleted, upgradeViews: this.store.upgradeViews,
        formValidationErrors: this.store.formValidationErrors, errorEventsCount: this.store.errorEventsCount,
        dwellTimeSeconds: this.store.dwellTimeSeconds, unsyncedActionsCount: this.store.unsyncedActionsCount,
        routes: { ...this.store.routes }, pageDwellMatrix: { ...this.store.pageDwellMatrix },
        isSpamFlagged: this.store.isSpamBlocked, spamReason: this.store.spamReason,
      };

      for (const key of METRIC_KEYS) this.store[key] -= delta[key];
      this.store.dwellTimeSeconds -= delta.dwellTimeSeconds;
      this.store.unsyncedActionsCount = Math.max(0, (this.store.unsyncedActionsCount || 0) - delta.unsyncedActionsCount);
      this.store.routes = {};
      this.store.pageDwellMatrix = {};
      this.store.lastSyncTime = now;
      this.save();

      const config = getObservabilityMulticloudConfig();
      if (config.metricsDriver === "upstash_redis") {
        try {
          const authData = await supabase.auth.getSession();
          const userId = authData?.data?.session?.user?.id || "anonymous";
          const counters: Record<string, number> = {
            pageViews: delta.pageViews, printsDetected: delta.printsDetected,
            docsPrinted: delta.docsPrinted, pdfExported: delta.pdfExported,
            clinicalRecordsSaved: delta.clinicalRecordsSaved, formsCompleted: delta.formsCompleted,
            dwellTimeSeconds: delta.dwellTimeSeconds,
          };
          await dispatchMatrixToUpstash(userId, activeClinicId || null, delta.pageDwellMatrix, counters);
          return;
        } catch (err) {
          console.warn("[LocalTelemetry] Falha no driver Upstash, fallback para RPC:", err);
        }
      }

      try {
        const rpcPayload: Record<string, unknown> = {
          _clinic_id: activeClinicId || null, _user_name: activeUserName || "Usuário",
          _page_views: delta.pageViews, _prints_detected: delta.printsDetected,
          _docs_printed: delta.docsPrinted, _pdf_exported: delta.pdfExported,
          _dwell_seconds: delta.dwellTimeSeconds, _top_routes: delta.routes,
          _is_spam_flagged: delta.isSpamFlagged, _spam_reason: delta.spamReason,
        };
        if (Object.keys(delta.pageDwellMatrix).length > 0) {
          rpcPayload._page_dwell_matrix = delta.pageDwellMatrix;
        }

        const { error } = await supabase.rpc("upsert_user_telemetry_summary", rpcPayload);
        if (error) {
          console.warn("[LocalTelemetry] RPC falhou:", error.message);
          this.rollbackDelta(delta);
        }
      } catch (err) {
        console.warn("[LocalTelemetry] Erro ao chamar sync RPC:", err);
        this.rollbackDelta(delta);
      }
    };

    this.inFlightSyncPromise = syncExecution().finally(() => {
      this.inFlightSyncPromise = null;
    });

    return this.inFlightSyncPromise;
  }

  private rollbackDelta(delta: {
    pageViews: number; printsDetected: number; docsPrinted: number; pdfExported: number;
    jsonExported: number; clinicalRecordsSaved: number; formsCompleted: number; upgradeViews: number;
    formValidationErrors: number; errorEventsCount: number; dwellTimeSeconds: number;
    unsyncedActionsCount: number; routes: Record<string, number>; pageDwellMatrix?: PageDwellMatrix;
  }) {
    for (const key of METRIC_KEYS) this.store[key] += delta[key];
    this.store.dwellTimeSeconds += delta.dwellTimeSeconds;
    this.store.unsyncedActionsCount = (this.store.unsyncedActionsCount || 0) + delta.unsyncedActionsCount;
    for (const [r, c] of Object.entries(delta.routes)) this.store.routes[r] = (this.store.routes[r] || 0) + c;
    if (delta.pageDwellMatrix) {
      for (const [col, s] of Object.entries(delta.pageDwellMatrix)) {
        const k = col as CanonicalPageColumn;
        this.store.pageDwellMatrix[k] = (this.store.pageDwellMatrix[k] || 0) + (s || 0);
      }
    }
    this.save();
  }

  public flushImmediate(options?: Omit<TelemetrySyncOptions, "force">) {
    return this.syncToServer({ ...options, force: true });
  }

  public resetLocalStore() {
    resetErrorDeduplicator();
    this.store = createDefaultStore();
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
