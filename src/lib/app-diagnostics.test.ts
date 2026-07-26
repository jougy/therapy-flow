import { describe, expect, it } from "vitest";
import {
  createAppDiagnosticError,
  formatDiagnosticForPrompt,
  maskSensitiveDiagnosticText,
  sanitizeFilenameForDiagnostic,
} from "@/lib/app-diagnostics";

describe("app diagnostics", () => {
  it("creates a humanized edge function diagnostic", () => {
    const diagnostic = createAppDiagnosticError({
      context: {
        clinicId: "4ee5c96a-67ad-4675-b51a-1cb902506353",
        fileName: "CATALOGO_SILVER_MOISSANITE_EDIT_COM_PRECOS_TRIPLOS.pdf",
      },
      error: new Error("Edge Function returned a non-2xx status code"),
      functionName: "b2-upload-url",
      stage: "Preparar upload",
      status: 500,
      technicalDetails: { error: "Variavel de ambiente ausente: B2_BUCKET_NAME" },
    });

    expect(diagnostic.title).toBe("Falha na Edge Function b2-upload-url");
    expect(diagnostic.stage).toBe("Preparar upload");
    expect(diagnostic.status).toBe(500);
    expect(diagnostic.safeContext.clinicId).toBe("4ee5...6353");
    expect(diagnostic.safeContext.fileName).toBe("CATALOGO_S...PLOS.pdf");
  });

  it("masks signed urls, uuids and long tokens", () => {
    const masked = maskSensitiveDiagnosticText(
      "https://bucket.s3/key.pdf?X-Amz-Signature=abcdef 4ee5c96a-67ad-4675-b51a-1cb902506353 abcdefghijklmnopqrstuvwxyz123456",
    );

    expect(masked).toContain("[signed-url-redacted]");
    expect(masked).toContain("4ee5...6353");
    expect(masked).toContain("abcdef...[redacted]");
  });

  it("shortens long filenames but preserves extension", () => {
    expect(sanitizeFilenameForDiagnostic("CATALOGO_SILVER_MOISSANITE_EDIT_COM_PRECOS_TRIPLOS.pdf")).toBe("CATALOGO_S...PLOS.pdf");
  });

  it("formats a prompt-ready markdown report", () => {
    const diagnostic = createAppDiagnosticError({
      context: { patientId: "fb68a091-f987-481c-aeb5-43e94edbc94d" },
      error: new Error("Falha"),
      stage: "Confirmar upload",
    });

    const report = formatDiagnosticForPrompt(diagnostic);

    expect(report).toContain("# Pedido de ajuda para depurar erro técnico");
    expect(report).toContain("- Etapa: Confirmar upload");
    expect(report).toContain("patientId: fb68...c94d");
    expect(report).toContain("src/lib/patient-file-upload-queue.ts");
  });
});
