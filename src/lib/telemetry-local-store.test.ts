import { describe, it, expect, beforeEach, vi } from "vitest";
import { localTelemetryManager } from "@/lib/telemetry-local-store";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({ data: { success: true }, error: null })),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("ClientTelemetryManager & Triggers", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    localTelemetryManager.resetLocalStore();
  });

  it("records all actions including new domain actions and updates store counters", () => {
    localTelemetryManager.recordAction("page_view", "/app/dashboard", { dwell_time_seconds: 15 });
    localTelemetryManager.recordAction("print_screen", "/app/pacientes");
    localTelemetryManager.recordAction("document_print", "/app/prontuario");
    localTelemetryManager.recordAction("export_pdf", "/app/relatorios");
    localTelemetryManager.recordAction("clinical_records_saved", "/app/prontuario");
    localTelemetryManager.recordAction("forms_completed", "/app/formularios");
    localTelemetryManager.recordAction("upgrade_views", "/app/planos");
    localTelemetryManager.recordAction("form_validation_errors", "/app/cadastro");

    const store = localTelemetryManager.getStore();
    expect(store.pageViews).toBe(1);
    expect(store.printsDetected).toBe(1);
    expect(store.docsPrinted).toBe(1);
    expect(store.pdfExported).toBe(1);
    expect(store.clinicalRecordsSaved).toBe(1);
    expect(store.formsCompleted).toBe(1);
    expect(store.upgradeViews).toBe(1);
    expect(store.formValidationErrors).toBe(1);
    expect(store.dwellTimeSeconds).toBe(15);
    expect(store.routes["/app/dashboard"]).toBe(1);
    expect(store.unsyncedActionsCount).toBe(8);
  });

  it("triggers automatic sync when reaching 15 actions threshold (threshold_batch)", async () => {
    // Record 14 actions (below threshold)
    for (let i = 0; i < 14; i++) {
      localTelemetryManager.recordAction("page_view", `/app/page-${i}`);
    }
    expect(supabase.rpc).not.toHaveBeenCalled();

    // 15th action hits the threshold and triggers auto-sync
    localTelemetryManager.recordAction("page_view", "/app/page-15");
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("recordError captures error info, increments error counters and triggers immediate sync", () => {
    localTelemetryManager.recordError({
      scope: "editor.save",
      message: "Falha na conexão ao salvar prontuário",
      stack: "Error: Falha na conexão\n at save (editor.ts:42)",
      context: { patientId: "123" },
    });

    const store = localTelemetryManager.getStore();
    expect(store.recentErrors.length).toBe(1);
    expect(store.recentErrors[0].scope).toBe("editor.save");
    expect(store.recentErrors[0].message).toBe("Falha na conexão ao salvar prontuário");
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("syncs immediately with trigger 'login' even when store is zeroed", async () => {
    await localTelemetryManager.syncToServer({
      clinicId: "clinic-1",
      userName: "Dr. João",
      triggerReason: "login",
      force: true,
    });

    expect(supabase.rpc).toHaveBeenCalledWith("upsert_user_telemetry_summary", {
      _clinic_id: "clinic-1",
      _user_name: "Dr. João",
      _page_views: 0,
      _prints_detected: 0,
      _docs_printed: 0,
      _pdf_exported: 0,
      _dwell_seconds: 0,
      _top_routes: {},
      _is_spam_flagged: false,
      _spam_reason: null,
    });
  });

  it("syncs immediately with trigger 'logout' and resets local counters", async () => {
    localTelemetryManager.recordAction("page_view", "/app/agenda");
    localTelemetryManager.recordAction("document_print", "/app/documentos");

    await localTelemetryManager.syncToServer({
      clinicId: "clinic-1",
      userName: "Dr. João",
      triggerReason: "logout",
      force: true,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "upsert_user_telemetry_summary",
      expect.objectContaining({
        _clinic_id: "clinic-1",
        _user_name: "Dr. João",
        _page_views: 1,
        _docs_printed: 1,
      })
    );

    const storeAfter = localTelemetryManager.getStore();
    expect(storeAfter.pageViews).toBe(0);
    expect(storeAfter.docsPrinted).toBe(0);
    expect(storeAfter.unsyncedActionsCount).toBe(0);
  });

  it("syncs on trigger 'app_exit', 'online' and 'domain_event'", async () => {
    localTelemetryManager.recordAction("export_pdf", "/app/laudo");

    await localTelemetryManager.syncToServer({
      clinicId: "clinic-1",
      triggerReason: "app_exit",
      force: true,
    });

    expect(supabase.rpc).toHaveBeenCalled();
  });

  it("sanitizes dynamic UUIDs and numbers in route pathnames to protect patient privacy", () => {
    localTelemetryManager.recordAction(
      "page_view",
      "/app/pacientes/550e8400-e29b-41d4-a716-446655440000/prontuario?tab=anamnese#section1"
    );
    localTelemetryManager.recordAction("page_view", "/app/prontuario/12345/evolucao");

    const store = localTelemetryManager.getStore();
    expect(store.routes["/app/pacientes/:id/prontuario"]).toBe(1);
    expect(store.routes["/app/prontuario/:id/evolucao"]).toBe(1);
    // Sensitive raw UUID and query parameters should NOT appear as keys
    expect(store.routes["/app/pacientes/550e8400-e29b-41d4-a716-446655440000/prontuario?tab=anamnese#section1"]).toBeUndefined();
  });

  it("handles concurrent sync calls gracefully without double counting or race conditions", async () => {
    localTelemetryManager.recordAction("page_view", "/app/dashboard");
    localTelemetryManager.recordAction("page_view", "/app/dashboard");

    // Fire two syncs concurrently (e.g. login hook and user auth event at the same instant)
    await Promise.all([
      localTelemetryManager.syncToServer({
        clinicId: "clinic-1",
        userName: "Dr. João",
        triggerReason: "login",
        force: true,
      }),
      localTelemetryManager.syncToServer({
        clinicId: "clinic-1",
        userName: "Dr. João",
        triggerReason: "login",
        force: true,
      }),
    ]);

    // The first sync sends the 2 page views, the second sync (running after) sees 0
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    const storeAfter = localTelemetryManager.getStore();
    expect(storeAfter.pageViews).toBe(0);
  });
});
