import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PatientFilesPanel } from "@/components/PatientFilesPanel";
import { createAppDiagnosticError } from "@/lib/app-diagnostics";

const queueMocks = vi.hoisted(() => ({
  deleteUpload: vi.fn(),
  enqueue: vi.fn(),
  items: [] as Array<Record<string, unknown>>,
  removeItem: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  files: [] as Array<Record<string, unknown>>,
  functionsInvoke: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/lib/patient-file-upload-queue", async () => {
  const actual = await vi.importActual<typeof import("@/lib/patient-file-upload-queue")>("@/lib/patient-file-upload-queue");

  return {
    ...actual,
    deleteUploadedPatientFile: queueMocks.deleteUpload,
    enqueuePatientFileUpload: queueMocks.enqueue,
    removePatientFileUploadQueueItem: queueMocks.removeItem,
    usePatientFileUploadQueue: () => queueMocks.items,
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const createQueryBuilder = () => {
    const builder = {
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      order: vi.fn(() => builder),
      select: vi.fn(() => builder),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: supabaseMocks.files, error: null }),
    };
    return builder;
  };

  return {
    supabase: {
      from: vi.fn(() => createQueryBuilder()),
      functions: {
        invoke: supabaseMocks.functionsInvoke,
      },
    },
  };
});

describe("PatientFilesPanel", () => {
  const validSessionId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    supabaseMocks.files = [];
    supabaseMocks.functionsInvoke.mockReset();
    queueMocks.deleteUpload.mockReset();
    queueMocks.enqueue.mockReset();
    queueMocks.items = [];
    queueMocks.removeItem.mockReset();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders an empty state when the patient has no files", async () => {
    render(<PatientFilesPanel clinicId="clinic-1" patientId="patient-1" sessionId={null} variant="patient" />);

    expect(await screen.findByText("Nenhum arquivo registrado.")).toBeInTheDocument();
  });

  it("renders uploaded files with compression metadata", async () => {
    supabaseMocks.files = [
      {
        bucket_name: "bucket",
        byte_size: 800,
        category: "image",
        checksum_sha256: null,
        clinic_id: "clinic-1",
        compression_profile: "image-webp-balanced-v1",
        content_type: "image/webp",
        created_at: "2026-07-08T12:00:00.000Z",
        deleted_at: null,
        id: "upload-1",
        image_height: 800,
        image_width: 1200,
        last_accessed_at: null,
        metadata: {},
        object_key: "key",
        original_byte_size: 1000,
        original_content_type: "image/png",
        original_filename: "exame.png",
        page_count: null,
        patient_id: "patient-1",
        provider: "backblaze_b2",
        session_id: null,
        status: "uploaded",
        storage_encoding: null,
        stored_byte_size: 800,
        stored_content_type: "image/webp",
        updated_at: "2026-07-08T12:00:00.000Z",
        upload_expires_at: "2026-07-08T12:15:00.000Z",
        uploaded_at: "2026-07-08T12:05:00.000Z",
        uploaded_by_user_id: "user-1",
      },
    ];

    render(<PatientFilesPanel clinicId="clinic-1" patientId="patient-1" sessionId={null} variant="patient" />);

    expect(await screen.findByText("exame.png")).toBeInTheDocument();
    expect(screen.getByText("20% menor")).toBeInTheDocument();
    expect(screen.getByText("image-webp-balanced-v1")).toBeInTheDocument();
  });

  it("shows a clinical rasterization notice for visually compressed PDFs", async () => {
    supabaseMocks.files = [
      {
        bucket_name: "bucket",
        byte_size: 800,
        category: "document",
        checksum_sha256: null,
        clinic_id: "clinic-1",
        compression_profile: "pdf-clinical-raster-v1",
        content_type: "application/pdf",
        created_at: "2026-07-08T12:00:00.000Z",
        deleted_at: null,
        id: "upload-1",
        image_height: null,
        image_width: null,
        last_accessed_at: null,
        metadata: {},
        object_key: "key",
        original_byte_size: 1000,
        original_content_type: "application/pdf",
        original_filename: "catalogo.pdf",
        page_count: 1,
        patient_id: "patient-1",
        provider: "backblaze_b2",
        session_id: null,
        status: "uploaded",
        storage_encoding: null,
        stored_byte_size: 800,
        stored_content_type: "application/pdf",
        updated_at: "2026-07-08T12:00:00.000Z",
        upload_expires_at: "2026-07-08T12:15:00.000Z",
        uploaded_at: "2026-07-08T12:05:00.000Z",
        uploaded_by_user_id: "user-1",
      },
    ];

    render(<PatientFilesPanel clinicId="clinic-1" patientId="patient-1" sessionId={null} variant="patient" />);

    expect(await screen.findByText("catalogo.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Arquivo otimizado para armazenamento/)).toBeInTheDocument();
  });

  it("enqueues valid PDF uploads", async () => {
    const { container } = render(<PatientFilesPanel clinicId="clinic-1" patientId="patient-1" sessionId={validSessionId} variant="session" />);
    await screen.findByText("Nenhum arquivo registrado.");

    const input = container.querySelector('input[accept="application/pdf"]') as HTMLInputElement;
    const file = new File(["pdf"], "anamnese.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(queueMocks.enqueue).toHaveBeenCalledWith({
        clinicId: "clinic-1",
        file,
        patientId: "patient-1",
        sessionId: validSessionId,
      });
    });
  });

  it("does not query session files when the route uses the new-session placeholder", async () => {
    render(<PatientFilesPanel clinicId="clinic-1" disabledReason="Salve antes." patientId="patient-1" sessionId="novo" variant="session" />);

    expect(await screen.findByText("Nenhum arquivo registrado.")).toBeInTheDocument();
    expect(queueMocks.enqueue).not.toHaveBeenCalled();
  });

  it("opens and copies a diagnostic for failed uploads", async () => {
    queueMocks.items = [
      {
        clinicId: "clinic-1",
        diagnosticError: createAppDiagnosticError({
          context: { clinicId: "4ee5c96a-67ad-4675-b51a-1cb902506353", fileName: "arquivo.pdf" },
          error: new Error("Edge Function returned a non-2xx status code"),
          functionName: "b2-upload-url",
          stage: "Preparar upload",
          status: 500,
        }),
        error: "O app não conseguiu preparar uma URL segura para enviar o arquivo.",
        fileName: "arquivo.pdf",
        id: "queue-1",
        patientId: "patient-1",
        progress: 35,
        sessionId: validSessionId,
        status: "failed",
        uploadId: null,
      },
    ];

    render(<PatientFilesPanel clinicId="clinic-1" patientId="patient-1" sessionId={validSessionId} variant="session" />);

    fireEvent.click(await screen.findByLabelText("Abrir diagnóstico do erro"));

    expect(await screen.findByText("Falha na Edge Function b2-upload-url")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copiar diagnóstico/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("# Pedido de ajuda para depurar erro técnico"));
    });
  });

  it("confirms and discards an uploaded file", async () => {
    queueMocks.deleteUpload.mockImplementation(async () => {
      supabaseMocks.files = [];
      return { deleted: true, uploadId: "upload-1" };
    });
    supabaseMocks.files = [
      {
        bucket_name: "bucket",
        byte_size: 800,
        category: "image",
        checksum_sha256: null,
        clinic_id: "clinic-1",
        compression_profile: "image-webp-balanced-v1",
        content_type: "image/webp",
        created_at: "2026-07-08T12:00:00.000Z",
        deleted_at: null,
        id: "upload-1",
        image_height: 800,
        image_width: 1200,
        last_accessed_at: null,
        metadata: {},
        object_key: "key",
        original_byte_size: 1000,
        original_content_type: "image/png",
        original_filename: "exame.png",
        page_count: null,
        patient_id: "patient-1",
        provider: "backblaze_b2",
        session_id: validSessionId,
        status: "uploaded",
        storage_encoding: null,
        stored_byte_size: 800,
        stored_content_type: "image/webp",
        updated_at: "2026-07-08T12:00:00.000Z",
        upload_expires_at: "2026-07-08T12:15:00.000Z",
        uploaded_at: "2026-07-08T12:05:00.000Z",
        uploaded_by_user_id: "user-1",
      },
    ];

    render(<PatientFilesPanel clinicId="clinic-1" patientId="patient-1" sessionId={validSessionId} variant="session" />);

    expect(await screen.findByText("exame.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /descartar/i }));
    fireEvent.click(await screen.findByRole("button", { name: /descartar definitivamente/i }));

    await waitFor(() => {
      expect(queueMocks.deleteUpload).toHaveBeenCalledWith({
        clinicId: "clinic-1",
        fileName: "exame.png",
        patientId: "patient-1",
        sessionId: validSessionId,
        uploadId: "upload-1",
      });
    });
    expect(screen.queryByText("exame.png")).not.toBeInTheDocument();
  });
});
