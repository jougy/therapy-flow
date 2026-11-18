import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GenerateDocumentModal } from "./GenerateDocumentModal";

const insertSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "clinic_document_signatures") {
        return {
          insert: (payload: Record<string, unknown>) => {
            insertSpy(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: "sig-record-1",
                    sign_token: payload.sign_token,
                    status: payload.status,
                    signed_at: payload.signed_at ?? null,
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "clinic-test",
                name: "Clínica Pluri Saúde",
                cnpj: "12.345.678/0001-90",
                custom_fields: {},
              },
              error: null,
            }),
            eq: () => ({
              is: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      };
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-test", email: "dr.carlos@clinica.com" },
    profile: {
      full_name: "Dr. Carlos Eduardo",
      email: "dr.carlos@clinica.com",
      professional_license: "CRP 06/12345",
    },
    clinic: { id: "clinic-test", name: "Clínica Pluri Saúde" },
    clinicId: "clinic-test",
  }),
}));

describe("GenerateDocumentModal", () => {
  const dummyPatient = {
    id: "pat-123",
    name: "Maria de Oliveira",
    date_of_birth: "1990-05-15",
    cpf: "12345678900",
    phone: "11987654321",
    email: "maria@email.com",
  };

  beforeEach(() => {
    insertSpy.mockClear();
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

  it("renders correctly with patient information and document preview", async () => {
    render(
      <GenerateDocumentModal
        open={true}
        onOpenChange={vi.fn()}
        patient={dummyPatient}
        clinicName="Clínica Pluri Saúde"
      />
    );

    expect(screen.getByText("Gerar Documento com Variáveis")).toBeInTheDocument();
    expect(await screen.findByText("Clínica Pluri Saúde")).toBeInTheDocument();
    expect(screen.getAllByText("Maria de Oliveira").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /Imprimir \/ Salvar PDF/i })).toBeInTheDocument();

    const printRoot = document.getElementById("print-generate-document-root");
    expect(printRoot).toBeInTheDocument();
  });

  it("calls window.print when clicking print button", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    const onPrintedMock = vi.fn();

    render(
      <GenerateDocumentModal
        open={true}
        onOpenChange={vi.fn()}
        patient={dummyPatient}
        clinicName="Clínica Pluri Saúde"
        onPrinted={onPrintedMock}
      />
    );

    await screen.findByText("Clínica Pluri Saúde");

    const printButton = screen.getByRole("button", { name: /Imprimir \/ Salvar PDF/i });
    expect(printButton).not.toBeDisabled();
    fireEvent.click(printButton);

    expect(onPrintedMock).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it("displays 3 signature collection channels and generates WhatsApp pending link", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    render(
      <GenerateDocumentModal
        open={true}
        onOpenChange={vi.fn()}
        patient={dummyPatient}
        clinicName="Clínica Pluri Saúde"
      />
    );

    await screen.findByText("Clínica Pluri Saúde");
    fireEvent.click(screen.getByRole("button", { name: /Colher Assinatura/i }));

    expect(screen.getByText("Enviar por WhatsApp / Celular")).toBeInTheDocument();
    expect(screen.getByText("RECOMENDADO")).toBeInTheDocument();
    expect(screen.getByText("Assinar agora nesta tela (Presencial)")).toBeInTheDocument();
    expect(screen.getByText("Imprimir termo físico em papel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Gerar Link e Abrir WhatsApp/i }));

    await waitFor(() => {
      expect(insertSpy).toHaveBeenCalledTimes(1);
    });

    const payload = insertSpy.mock.calls[0][0];
    expect(payload.status).toBe("pending");
    expect(typeof payload.sign_token).toBe("string");
    expect(payload.sign_token.length).toBeGreaterThan(10);
    expect(payload.rendered_markdown).toContain("Termo de Consentimento");

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://wa.me/5511987654321?text="),
      "_blank",
      "noopener,noreferrer"
    );

    const copyBtn = await screen.findByRole("button", { name: /Copiar Link/i });
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringContaining(`/assinar-documento/${payload.sign_token}`)
      );
    });

    openSpy.mockRestore();
  });

  it("supports in-person canvas signature and injects electronic stamp", async () => {
    render(
      <GenerateDocumentModal
        open={true}
        onOpenChange={vi.fn()}
        patient={dummyPatient}
        clinicName="Clínica Pluri Saúde"
      />
    );

    await screen.findByText("Clínica Pluri Saúde");
    fireEvent.click(screen.getByRole("button", { name: /Colher Assinatura/i }));

    fireEvent.click(screen.getByLabelText("Assinar agora nesta tela (Presencial)"));
    fireEvent.click(screen.getByRole("button", { name: /Abrir Lousa de Assinatura/i }));

    const canvas = screen.getByLabelText("Quadro de assinatura digital");
    fireEvent.mouseDown(canvas, { clientX: 20, clientY: 20 });
    fireEvent.mouseMove(canvas, { clientX: 80, clientY: 40 });
    fireEvent.mouseUp(canvas);

    const confirmBtn = screen.getByRole("button", { name: /Confirmar Assinatura Presencial/i });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(insertSpy).toHaveBeenCalledTimes(1);
    });

    const payload = insertSpy.mock.calls[0][0];
    expect(payload.status).toBe("signed_in_person");
    expect(payload.signer_name).toBe("Maria de Oliveira");
    expect(payload.signer_cpf).toBe("12345678900");
    expect(payload.signature_image_url).toContain("data:image/webp");

    expect(await screen.findAllByText("Documento assinado virtualmente")).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /Imprimir \/ Salvar PDF Assinado/i }).length
    ).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: /Ver Documento Assinado/i }));
    const printRoot = document.getElementById("print-generate-document-root");
    expect(printRoot?.textContent).toContain("Documento assinado virtualmente");
    expect(printRoot?.textContent).toContain("Maria de Oliveira");
  });

  it("registers pending_physical and triggers print on paper channel", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    const onPrintedMock = vi.fn();

    render(
      <GenerateDocumentModal
        open={true}
        onOpenChange={vi.fn()}
        patient={dummyPatient}
        clinicName="Clínica Pluri Saúde"
        onPrinted={onPrintedMock}
      />
    );

    await screen.findByText("Clínica Pluri Saúde");
    fireEvent.click(screen.getByRole("button", { name: /Colher Assinatura/i }));

    fireEvent.click(screen.getByLabelText("Imprimir termo físico em papel"));
    fireEvent.click(screen.getByRole("button", { name: /Registrar e Imprimir A4 \(Papel\)/i }));

    await waitFor(() => {
      expect(insertSpy).toHaveBeenCalledTimes(1);
    });

    expect(insertSpy.mock.calls[0][0].status).toBe("pending_physical");
    expect(onPrintedMock).toHaveBeenCalled();

    printSpy.mockRestore();
  });
});
