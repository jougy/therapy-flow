import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssinarDocumentoPublico from "./AssinarDocumentoPublico";

const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

describe("AssinarDocumentoPublico", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          setTransform: vi.fn(),
          scale: vi.fn(),
          clearRect: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          lineCap: "round",
          lineJoin: "round",
          strokeStyle: "#0f172a",
          lineWidth: 2.4,
        }) as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(
      () => "data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA="
    );
  });

  const renderPage = (token = "tok-abc-123") =>
    render(
      <MemoryRouter initialEntries={[`/assinar-documento/${token}`]}>
        <Routes>
          <Route path="/assinar-documento/:token" element={<AssinarDocumentoPublico />} />
        </Routes>
      </MemoryRouter>
    );

  it("loads pending document and submits remote digital signature", async () => {
    rpcMock.mockImplementation(async (fnName: string) => {
      if (fnName === "get_document_signature_by_token") {
        return {
          data: {
            id: "doc-1",
            clinic_id: "clinic-1",
            clinic_name: "Clínica Vida Plena",
            clinic_logo_url: null,
            patient_id: "pat-1",
            patient_name: "Ana Paula",
            session_id: null,
            template_id: null,
            template_title: "Termo de Consentimento Adulto",
            rendered_markdown: "# Termo\n\nConcordo com os atendimentos.",
            status: "pending",
            signer_name: "Ana Paula",
            signer_role: "paciente",
            signed_at: null,
            already_signed: false,
            created_at: "2026-11-17T00:00:00Z",
          },
          error: null,
        };
      }

      if (fnName === "submit_document_signature_by_token") {
        return {
          data: {
            success: true,
            id: "doc-1",
            status: "signed_remote",
            signer_name: "Ana Paula Souza",
            signed_at: "2026-11-17T02:30:00Z",
            template_title: "Termo de Consentimento Adulto",
          },
          error: null,
        };
      }

      return { data: null, error: null };
    });

    renderPage();

    expect(await screen.findByText("Clínica Vida Plena")).toBeInTheDocument();
    expect(screen.getByText("Concordo com os atendimentos.")).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Nome Completo/i);
    fireEvent.change(nameInput, { target: { value: "Ana Paula Souza" } });

    const cpfInput = screen.getByLabelText(/CPF do Assinante/i);
    fireEvent.change(cpfInput, { target: { value: "12345678900" } });

    const canvas = screen.getByLabelText("Quadro de assinatura digital");
    fireEvent.mouseDown(canvas, { clientX: 15, clientY: 15 });
    fireEvent.mouseMove(canvas, { clientX: 65, clientY: 35 });
    fireEvent.mouseUp(canvas);

    const submitBtn = screen.getByRole("button", { name: /Assinar Digitalmente/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "submit_document_signature_by_token",
        expect.objectContaining({
          p_token: "tok-abc-123",
          p_signer_name: "Ana Paula Souza",
          p_signer_cpf: "12345678900",
          p_signature_image_url: expect.stringContaining("data:image/webp"),
          p_metadata: expect.objectContaining({
            date: expect.any(String),
            time: expect.any(String),
            userAgent: expect.any(String),
          }),
        })
      );
    });

    expect(await screen.findByText("Documento Assinado com Sucesso!")).toBeInTheDocument();
    expect(screen.getByText("Documento assinado virtualmente")).toBeInTheDocument();
  });

  it("displays electronic stamp immediately when document is already signed", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        id: "doc-2",
        clinic_id: "clinic-1",
        clinic_name: "Clínica Vida Plena",
        clinic_logo_url: null,
        patient_id: "pat-2",
        patient_name: "Carlos Mendes",
        session_id: null,
        template_id: null,
        template_title: "Termo de Consentimento",
        rendered_markdown: "# Termo Assinado",
        status: "signed_remote",
        signer_name: "Carlos Mendes",
        signer_role: "paciente",
        signed_at: "2026-11-16T18:00:00Z",
        already_signed: true,
        created_at: "2026-11-16T17:00:00Z",
      },
      error: null,
    });

    renderPage("tok-signed-456");

    expect(await screen.findByText("Documento Assinado com Sucesso!")).toBeInTheDocument();
    expect(screen.getByText("Documento assinado virtualmente")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Assinar Digitalmente/i })).not.toBeInTheDocument();
  });
});
