import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "therapy-flow.clientTelemetryStore";
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const SPAM_BLOCK_DURATION_MS = 15 * 60 * 1000;
const MAX_ACTIONS_PER_5_MINUTES = 80; // Rate limit threshold

export interface ClientTelemetryData {
  pageViews: number;
  printsDetected: number;
  docsPrinted: number;
  pdfExported: number;
  dwellTimeSeconds: number;
  routes: Record<string, number>;
  actionHistory: number[]; // timestamps
  lastSyncTime: number;
  isSpamBlocked: boolean;
  spamBlockedUntil: number | null;
  spamReason: string | null;
}

const getInitialStore = (): ClientTelemetryData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ClientTelemetryData;
      return {
        pageViews: parsed.pageViews || 0,
        printsDetected: parsed.printsDetected || 0,
        docsPrinted: parsed.docsPrinted || 0,
        pdfExported: parsed.pdfExported || 0,
        dwellTimeSeconds: parsed.dwellTimeSeconds || 0,
        routes: parsed.routes || {},
        actionHistory: Array.isArray(parsed.actionHistory) ? parsed.actionHistory : [],
        lastSyncTime: parsed.lastSyncTime || 0,
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
    dwellTimeSeconds: 0,
    routes: {},
    actionHistory: [],
    lastSyncTime: 0,
    isSpamBlocked: false,
    spamBlockedUntil: null,
    spamReason: null,
  };
};

class ClientTelemetryManager {
  private store: ClientTelemetryData;

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
    type: "page_view" | "print_screen" | "document_print" | "export_pdf",
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

    // Increment specific counters
    if (type === "page_view") {
      this.store.pageViews += 1;
      const currentRouteCount = this.store.routes[pathname] || 0;
      this.store.routes[pathname] = currentRouteCount + 1;

      if (metadata.dwell_time_seconds) {
        this.store.dwellTimeSeconds += metadata.dwell_time_seconds;
      }
    } else if (type === "print_screen") {
      this.store.printsDetected += 1;
    } else if (type === "document_print") {
      this.store.docsPrinted += 1;
    } else if (type === "export_pdf") {
      this.store.pdfExported += 1;
    }

    // Anti-Spam Defense Check (actions in last 5 minutes)
    const fiveMinsAgo = now - FIVE_MINUTES_MS;
    const recentActionsIn5Mins = this.store.actionHistory.filter((t) => t >= fiveMinsAgo).length;

    if (recentActionsIn5Mins >= MAX_ACTIONS_PER_5_MINUTES && !this.store.isSpamBlocked) {
      // Trigger Anti-Spam Defense!
      this.store.isSpamBlocked = true;
      this.store.spamBlockedUntil = now + SPAM_BLOCK_DURATION_MS;
      this.store.spamReason = `Rate limit excedido: ${recentActionsIn5Mins} ações em 5 minutos. Conexão pausada por 15 minutos.`;
      this.save();

      toast({
        title: "Alerta de Segurança Pluri-Health",
        description: "Frequência anormal de ações por minuto detectada. Sua sincronização foi pausada temporariamente por 15 minutos.",
        variant: "destructive",
      });

      // Dispatch emergency single RPC alert to Backoffice
      void this.syncToServer({ isSpamAlert: true });
      return;
    }

    this.save();
  }

  // Idempotent Sync to Server via single RPC upsert
  public async syncToServer({
    clinicId,
    userName,
    force = false,
    isSpamAlert = false,
    triggerReason = "periodic",
  }: {
    clinicId?: string | null;
    userName?: string;
    force?: boolean;
    isSpamAlert?: boolean;
    triggerReason?: "domain_event" | "app_exit" | "periodic" | "manual";
  } = {}) {
    const now = Date.now();

    // Check if spam block is active and not an emergency spam alert
    if (!isSpamAlert && this.checkSpamBlockStatus()) {
      console.warn("[LocalTelemetry] Sync skipped because user is currently rate-limited.");
      return;
    }

    // Check 5-minute cooldown unless force is true or it's a domain event / app exit / spam alert
    const timeSinceLastSync = now - this.store.lastSyncTime;
    if (!force && !isSpamAlert && triggerReason === "periodic" && timeSinceLastSync < FIVE_MINUTES_MS) {
      return; // Respect 5-minute cooldown
    }

    // Check if there is anything to sync
    const hasDataToSync =
      this.store.pageViews > 0 ||
      this.store.printsDetected > 0 ||
      this.store.docsPrinted > 0 ||
      this.store.pdfExported > 0 ||
      this.store.isSpamBlocked;

    if (!hasDataToSync && !isSpamAlert) {
      return;
    }

    // Copy snapshot data
    const snapshot = {
      pageViews: this.store.pageViews,
      printsDetected: this.store.printsDetected,
      docsPrinted: this.store.docsPrinted,
      pdfExported: this.store.pdfExported,
      dwellTimeSeconds: this.store.dwellTimeSeconds,
      routes: { ...this.store.routes },
      isSpamFlagged: this.store.isSpamBlocked,
      spamReason: this.store.spamReason,
    };

    try {
      const { error } = await supabase.rpc("upsert_user_telemetry_summary", {
        _clinic_id: clinicId || null,
        _user_name: userName || "Usuário",
        _page_views: snapshot.pageViews,
        _prints_detected: snapshot.printsDetected,
        _docs_printed: snapshot.docsPrinted,
        _pdf_exported: snapshot.pdfExported,
        _dwell_seconds: snapshot.dwellTimeSeconds,
        _top_routes: snapshot.routes,
        _is_spam_flagged: snapshot.isSpamFlagged,
        _spam_reason: snapshot.spamReason,
      });

      if (error) {
        console.warn("[LocalTelemetry] Sync RPC failed:", error.message);
        return;
      }

      // Reset local counters after successful idempotent UPSERT
      this.store.pageViews = 0;
      this.store.printsDetected = 0;
      this.store.docsPrinted = 0;
      this.store.pdfExported = 0;
      this.store.dwellTimeSeconds = 0;
      this.store.routes = {};
      this.store.lastSyncTime = now;
      this.save();
    } catch (err) {
      console.warn("[LocalTelemetry] Error calling sync RPC:", err);
    }
  }

  public getStore(): ClientTelemetryData {
    return { ...this.store };
  }
}

export const localTelemetryManager = new ClientTelemetryManager();
