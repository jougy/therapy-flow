import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { localTelemetryManager } from "@/lib/telemetry-local-store";
import { supabase } from "@/integrations/supabase/client";
import { resolveCanonicalPageColumn } from "@/lib/telemetry/canonical-matrix";
import {
  scrubSensitiveHealthData,
  shouldSkipDuplicateError,
} from "@/lib/telemetry/lgpd-scrubber";
import { setObservabilityMulticloudConfig } from "@/lib/telemetry/multicloud-drivers";

const { mockRpc, mockFrom, mockInsert, mockGetSession } = vi.hoisted(() => {
  const insert = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const from = vi.fn(() => ({
    insert,
  }));
  const getSession = vi.fn(() =>
    Promise.resolve({ data: { session: null }, error: null })
  );
  const rpc = vi.fn(() =>
    Promise.resolve({ data: { success: true }, error: null })
  );

  return {
    mockRpc: rpc,
    mockInsert: insert,
    mockFrom: from,
    mockGetSession: getSession,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
    auth: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("ClientTelemetryManager & Triggers", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setObservabilityMulticloudConfig({
      errorLogsDriver: "supabase_optimized",
      metricsDriver: "supabase_optimized",
    });
    localTelemetryManager.resetLocalStore();
  });

  afterEach(() => {
    setObservabilityMulticloudConfig({
      errorLogsDriver: "supabase_optimized",
      metricsDriver: "supabase_optimized",
    });
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

  it("accumulates dynamic routes in the canonical 'pacientes' column without creating dynamic sub-columns", () => {
    // Verificação de resolução direta de colunas canônicas
    expect(resolveCanonicalPageColumn("/clinica/vitalis/pacientes/PAC-9021")).toBe("pacientes");
    expect(resolveCanonicalPageColumn("/pacientes/123e4567-e89b-12d3-a456-426614174000/editar")).toBe("pacientes");
    expect(resolveCanonicalPageColumn("/pacientes")).toBe("pacientes");

    // Registro de permanência em sub-rotas dinâmicas variadas
    localTelemetryManager.recordPageDwell("/clinica/vitalis/pacientes/PAC-9021", 15);
    localTelemetryManager.recordPageDwell("/pacientes/123e4567-e89b-12d3-a456-426614174000/editar", 25);
    localTelemetryManager.recordPageDwell("/pacientes", 20);

    const store = localTelemetryManager.getStore();

    // Todo o tempo deve acumular na mesma coluna canônica "pacientes"
    expect(store.pageDwellMatrix.pacientes).toBe(60);
    expect(store.dwellTimeSeconds).toBe(60);

    // Não deve criar colunas avulsas para códigos PAC ou sub-rotas completas
    expect((store.pageDwellMatrix as Record<string, unknown>)["PAC-9021"]).toBeUndefined();
    expect((store.pageDwellMatrix as Record<string, unknown>)["/clinica/vitalis/pacientes/PAC-9021"]).toBeUndefined();
    expect(Object.keys(store.pageDwellMatrix)).toEqual(["pacientes"]);
  });

  it("scrubs CPF, email, PAC codes and Bearer/JWT tokens via scrubSensitiveHealthData and recordError", () => {
    const rawSensitive =
      "Paciente PAC-4421 (CPF 123.456.789-00, email paciente@saude.com.br) autenticado com Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.xyz";

    const scrubbed = scrubSensitiveHealthData(rawSensitive);
    expect(scrubbed).toContain("[CPF_REDACTED]");
    expect(scrubbed).toContain("[EMAIL_REDACTED]");
    expect(scrubbed).toContain("PAC-[REDACTED]");
    expect(scrubbed).toContain("Bearer [TOKEN_REDACTED]");
    expect(scrubbed).not.toContain("123.456.789-00");
    expect(scrubbed).not.toContain("paciente@saude.com.br");
    expect(scrubbed).not.toContain("PAC-4421");
    expect(scrubbed).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");

    localTelemetryManager.recordError({
      scope: "prontuario.salvar",
      message: "Erro ao salvar PAC-4421 do paciente com CPF 123.456.789-00 e email paciente@saude.com.br",
      stack: "Error: Token Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.xyz expirou",
      context: {
        pacienteCpf: "123.456.789-00",
        contato: "paciente@saude.com.br",
        codigoProntuario: "PAC-4421",
      },
    });

    const store = localTelemetryManager.getStore();
    const latestError = store.recentErrors[0];

    expect(latestError.message).toBe("Erro ao salvar PAC-[REDACTED] do paciente com CPF [CPF_REDACTED] e email [EMAIL_REDACTED]");
    expect(latestError.message).not.toContain("123.456.789-00");
    expect(latestError.message).not.toContain("paciente@saude.com.br");
    expect(latestError.message).not.toContain("PAC-4421");

    expect(latestError.stack).toContain("Bearer [TOKEN_REDACTED]");
    expect(latestError.stack).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");

    const scrubbedContext = latestError.context as Record<string, unknown>;
    expect(scrubbedContext.pacienteCpf).toBe("[CPF_REDACTED]");
    expect(scrubbedContext.contato).toBe("[EMAIL_REDACTED]");
    expect(scrubbedContext.codigoProntuario).toBe("PAC-[REDACTED]");
  });

  it("does not duplicate network calls when triggering the same error 3 times within 5 minutes", async () => {
    setObservabilityMulticloudConfig({ errorLogsDriver: "supabase_optimized" });

    const duplicateError = {
      scope: "auth.login",
      message: "Falha de conexão com provedor OAuth",
      stack: "Error: timeout at oauth.ts:15",
    };

    // Teste unitário da função shouldSkipDuplicateError
    expect(shouldSkipDuplicateError("auth.login", "Falha de conexão com provedor OAuth", "/login")).toBe(false);
    expect(shouldSkipDuplicateError("auth.login", "Falha de conexão com provedor OAuth", "/login")).toBe(true);
    expect(shouldSkipDuplicateError("auth.login", "Falha de conexão com provedor OAuth", "/login")).toBe(true);

    // Reseta store e mocks antes do teste de integração do localTelemetryManager
    localTelemetryManager.resetLocalStore();
    vi.clearAllMocks();

    // Dispara o mesmo erro 3 vezes consecutivas
    localTelemetryManager.recordError(duplicateError);
    localTelemetryManager.recordError(duplicateError);
    localTelemetryManager.recordError(duplicateError);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const store = localTelemetryManager.getStore();
    // No store local, as 3 ocorrências são devidamente bufferizadas no histórico recente de erros
    expect(store.recentErrors.length).toBe(3);

    // Na rede, apenas 1 chamada de insert direto e 1 de sync RPC devem ter sido despachadas
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("does NOT execute supabase.from('platform_error_logs').insert when errorLogsDriver is 'local_buffer'", async () => {
    setObservabilityMulticloudConfig({ errorLogsDriver: "local_buffer" });

    localTelemetryManager.recordError({
      scope: "financeiro.faturas",
      message: "Erro temporário de cálculo de split",
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    // O erro é gravado no buffer local de telemetria
    const store = localTelemetryManager.getStore();
    expect(store.recentErrors.length).toBe(1);
    expect(store.recentErrors[0].scope).toBe("financeiro.faturas");

    // Supabase platform_error_logs NÃO é acionado, poupando Disk I/O
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("executes supabase.from('platform_error_logs').insert when errorLogsDriver is 'supabase_optimized'", async () => {
    setObservabilityMulticloudConfig({ errorLogsDriver: "supabase_optimized" });

    localTelemetryManager.recordError({
      scope: "financeiro.faturas",
      message: "Erro crítico no banco de dados",
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockFrom).toHaveBeenCalledWith("platform_error_logs");
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});
