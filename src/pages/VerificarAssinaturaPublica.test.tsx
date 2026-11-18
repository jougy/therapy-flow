import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import QRCode from "qrcode";
import VerificarAssinaturaPublica from "./VerificarAssinaturaPublica";
import { ElectronicSignatureStampCard } from "@/components/patients/generate-document";

const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

describe("VerificarAssinaturaPublica", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  const renderPage = (token = "tok-verify-123") =>
    render(
      <MemoryRouter initialEntries={[`/verificar-assinatura/${token}`]}>
        <Routes>
          <Route path="/verificar-assinatura/:token" element={<VerificarAssinaturaPublica />} />
        </Routes>
      </MemoryRouter>
    );

  it("loads verification record via get_document_signature_by_token and renders all signer and legal details", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        id: "sig-uuid-001",
        clinic_id: "clinic-1",
        clinic_name: "Clínica Pluri Saúde",
        clinic_logo_url: null,
        patient_id: "pat-1",
        patient_name: "Maria Oliveira",
        session_id: null,
        template_id: null,
        template_title: "Termo de Consentimento Informado",
        rendered_markdown: "# Termo",
        status: "signed_remote",
        signer_name: "Dr. Carlos Eduardo",
        signer_role: "colaborador",
        signer_cpf: "12345678900",
        signed_at: "2026-11-17T14:30:00Z",
        already_signed: true,
        created_at: "2026-11-17T14:00:00Z",
        signature_metadata: {
          council_registration: "CRP 06/12345",
          global_user_id: "usr_abc987",
        },
      },
      error: null,
    });

    renderPage("tok-verify-123");

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("get_document_signature_by_token", {
        p_token: "tok-verify-123",
      });
    });

    expect(await screen.findByText("Assinatura Eletrônica Registrada")).toBeInTheDocument();
    expect(screen.getByText("Dr. Carlos Eduardo")).toBeInTheDocument();
    expect(screen.getByText("***.456.789-**")).toBeInTheDocument();
    expect(screen.getByText("CRP 06/12345")).toBeInTheDocument();
    expect(screen.getByText("usr_abc987")).toBeInTheDocument();
    expect(screen.getByText("Clínica Pluri Saúde")).toBeInTheDocument();
    expect(screen.getByText("Termo de Consentimento Informado")).toBeInTheDocument();

    const termsLink = screen.getByRole("link", { name: /Termos de Uso/i });
    expect(termsLink).toHaveAttribute("href", "/termos");

    const privacyLink = screen.getByRole("link", { name: /Política de Privacidade/i });
    expect(privacyLink).toHaveAttribute("href", "/privacidade");

    const leiLink = screen.getByRole("link", { name: /Lei nº 14\.063\/2020/i });
    expect(leiLink).toHaveAttribute(
      "href",
      "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14063.htm"
    );
    expect(leiLink).toHaveAttribute("target", "_blank");

    const mpLink = screen.getByRole("link", { name: /MP nº 2\.200-2\/2001/i });
    expect(mpLink).toHaveAttribute(
      "href",
      "https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm"
    );
    expect(mpLink).toHaveAttribute("target", "_blank");
  });

  it("displays error state when token is not found", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Documento para assinatura não encontrado ou removido." },
    });

    renderPage("tok-invalido");

    expect(await screen.findByText("Registro Não Encontrado")).toBeInTheDocument();
    expect(
      screen.getByText("Documento para assinatura não encontrado ou removido.")
    ).toBeInTheDocument();
  });

  it("displays preview state on /verificar-assinatura/preview without calling RPC", async () => {
    renderPage("preview");

    expect(await screen.findByText("Prévia de Verificação")).toBeInTheDocument();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("ElectronicSignatureStampCard & SignatureQrCode", () => {
  it("renders signature webp image on the left and QR code pointing to verification URL on the right", async () => {
    const toDataUrlSpy = vi
      .spyOn(QRCode, "toDataURL")
      .mockResolvedValue("data:image/png;base64,MOCK_QR_CODE" as never);

    const { rerender } = render(
      <ElectronicSignatureStampCard
        signerName="Dra. Mariana Costa"
        signerCpf="98765432100"
        councilRegistration="CREFITO-3/99887-F"
        signedAt="2026-11-17T15:00:00Z"
        signatureImageUrl="data:image/webp;base64,MOCK_SIGN_WEBP"
        token="tok-qr-777"
      />
    );

    await waitFor(() => {
      expect(toDataUrlSpy).toHaveBeenCalledWith(
        `${window.location.origin}/verificar-assinatura/tok-qr-777`,
        { width: 120, margin: 1 }
      );
    });

    expect(screen.getByAltText("Assinatura de Dra. Mariana Costa")).toHaveAttribute(
      "src",
      "data:image/webp;base64,MOCK_SIGN_WEBP"
    );
    expect(
      await screen.findByAltText("QR Code para verificar assinatura eletrônica")
    ).toHaveAttribute("src", "data:image/png;base64,MOCK_QR_CODE");
    expect(screen.getByText("Escaneie para verificar")).toBeInTheDocument();
    expect(screen.getByText("CREFITO-3/99887-F")).toBeInTheDocument();

    rerender(
      <ElectronicSignatureStampCard
        signerName="Dra. Mariana Costa"
        signedAt="2026-11-17T15:00:00Z"
      />
    );

    await waitFor(() => {
      expect(toDataUrlSpy).toHaveBeenCalledWith(
        `${window.location.origin}/verificar-assinatura/preview`,
        { width: 120, margin: 1 }
      );
    });

    toDataUrlSpy.mockRestore();
  });
});
