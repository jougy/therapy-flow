import { describe, expect, it } from "vitest";
import {
  buildPatientFileObjectPrefix,
  formatPatientFileSize,
  getPatientFileCompressionRatio,
  getPatientUploadCategoryFromContentType,
  normalizePatientUploadContentType,
  PATIENT_FILE_UPLOAD_MAX_BYTES,
  shouldUseClinicalRasterPdf,
  shouldUseProcessedPatientFile,
  validatePatientFileUploadCandidate,
} from "@/lib/patient-file-uploads";

describe("patient file uploads", () => {
  it("normalizes content types and derives default categories", () => {
    expect(normalizePatientUploadContentType("Image/PNG; charset=binary")).toBe("image/png");
    expect(getPatientUploadCategoryFromContentType("application/pdf")).toBe("document");
    expect(getPatientUploadCategoryFromContentType("image/jpeg")).toBe("image");
    expect(getPatientUploadCategoryFromContentType("text/plain")).toBe("other");
  });

  it("accepts PDF and image uploads within the size limit", () => {
    expect(validatePatientFileUploadCandidate({
      name: "exame.pdf",
      size: 1024,
      type: "application/pdf",
    })).toMatchObject({ isValid: true, errors: [] });

    expect(validatePatientFileUploadCandidate({
      name: "foto.webp",
      size: PATIENT_FILE_UPLOAD_MAX_BYTES,
      type: "image/webp",
    })).toMatchObject({ isValid: true, errors: [] });
  });

  it("rejects unsupported, empty, or oversized uploads", () => {
    const invalid = validatePatientFileUploadCandidate({
      name: "",
      size: PATIENT_FILE_UPLOAD_MAX_BYTES + 1,
      type: "text/plain",
    });

    expect(invalid.isValid).toBe(false);
    expect(invalid.errors).toEqual([
      "O arquivo precisa ter nome.",
      "Envie apenas PDF, DOC/DOCX ou imagens nos formatos JPEG, PNG, WebP, HEIC ou HEIF.",
      "O arquivo precisa ter no máximo 50 MB.",
    ]);
  });

  it("only uses processed files when the optimized version is meaningfully smaller", () => {
    expect(shouldUseProcessedPatientFile(10_000, 9_900)).toBe(false);
    expect(shouldUseProcessedPatientFile(10_000, 9_700)).toBe(true);
    expect(shouldUseProcessedPatientFile(10_000, 0)).toBe(false);
  });

  it("only uses clinical PDF rasterization when the size reduction pays for visual loss", () => {
    expect(shouldUseClinicalRasterPdf(10_000, 9_200)).toBe(false);
    expect(shouldUseClinicalRasterPdf(10_000, 8_900)).toBe(true);
    expect(shouldUseClinicalRasterPdf(10_000, 0)).toBe(false);
  });

  it("formats compression metadata for the UI", () => {
    expect(formatPatientFileSize(1536)).toBe("1.5 KB");
    expect(formatPatientFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(getPatientFileCompressionRatio(10_000, 6_500)).toBe(35);
    expect(getPatientFileCompressionRatio(10_000, 12_000)).toBe(0);
  });

  it("builds the canonical B2 prefix for session and general patient files", () => {
    expect(buildPatientFileObjectPrefix({
      clinicId: "clinic-1",
      patientId: "patient-1",
      sessionId: "session-1",
    })).toBe("clinics/clinic-1/patients/patient-1/sessions/session-1/files");

    expect(buildPatientFileObjectPrefix({
      clinicId: "clinic-1",
      patientId: "patient-1",
      sessionId: null,
    })).toBe("clinics/clinic-1/patients/patient-1/sessions/general/files");
  });
});
