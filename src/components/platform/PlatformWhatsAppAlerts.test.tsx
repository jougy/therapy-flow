import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformWhatsAppAlerts } from "@/components/platform/PlatformWhatsAppAlerts";

const supabaseMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: supabaseMocks.invoke,
    },
  },
}));

describe("PlatformWhatsAppAlerts", () => {
  beforeEach(() => {
    supabaseMocks.invoke.mockReset();
  });

  it("renders status cards, active commercial phone number and interactive templates", () => {
    render(<PlatformWhatsAppAlerts />);

    expect(screen.getByText(/Mensageria WhatsApp \(Pluri Fisio\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Meta Cloud API Oficial \(Graph API\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Conexão Meta WhatsApp Business Cloud API Ativa/i)).toBeInTheDocument();
    expect(screen.getByText(/Infraestrutura direta da Meta/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\+55 \(11\) 96047-4566/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1\. Onboarding de Novos Cadastros/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Agradecimento e Ativação de Plano/i)).toBeInTheDocument();
    expect(screen.getByText(/Pré-visualização Interativa dos Templates/i)).toBeInTheDocument();
    expect(screen.getByText(/📞 Agendar Introdução/i)).toBeInTheDocument();
    expect(screen.getByText(/🚀 Seguir por conta própria/i)).toBeInTheDocument();
  });

  it("switches between welcome and plan activation templates in preview", () => {
    render(<PlatformWhatsAppAlerts />);

    const planTab = screen.getByRole("tab", { name: /2\. Ativação de Plano/i });
    fireEvent.focus(planTab);
    fireEvent.keyDown(planTab, { key: "Enter" });
    fireEvent.click(planTab);

    expect(screen.getByText(/Confirmamos com sucesso a ativação do seu plano/i)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/app\.plurifisio\.com\.br/i)).toBeInTheDocument();
  });

  it("formats phone number with brazilian mask", () => {
    render(<PlatformWhatsAppAlerts />);

    const phoneInput = screen.getByLabelText(/Telefone de Destino/i);
    fireEvent.change(phoneInput, { target: { value: "11988887777" } });

    expect(phoneInput).toHaveValue("(11) 98888-7777");
  });

  it("triggers test whatsapp message successfully", async () => {
    supabaseMocks.invoke.mockResolvedValue({
      data: { success: true, messageId: "msg_test_123", message: "Mensagem disparada com sucesso!" },
      error: null,
    });

    render(<PlatformWhatsAppAlerts />);

    const submitBtn = screen.getByRole("button", { name: /Disparar Mensagem de Teste no WhatsApp/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supabaseMocks.invoke).toHaveBeenCalledWith("notify-admin-telegram", {
        body: expect.objectContaining({
          action: "SEND_TEST_WHATSAPP",
          templateType: "welcome",
          phone: "(11) 96047-4566",
        }),
      });
    });

    expect(await screen.findByText(/Sucesso no disparo/i)).toBeInTheDocument();
    expect(screen.getByText(/msg_test_123/i)).toBeInTheDocument();
  });

  it("handles error when edge function fails", async () => {
    supabaseMocks.invoke.mockResolvedValue({
      data: null,
      error: { message: "Evolution API offline" },
    });

    render(<PlatformWhatsAppAlerts />);

    const submitBtn = screen.getByRole("button", { name: /Disparar Mensagem de Teste no WhatsApp/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supabaseMocks.invoke).toHaveBeenCalledWith("notify-admin-telegram", {
        body: expect.objectContaining({
          action: "SEND_TEST_WHATSAPP",
        }),
      });
    });

    expect(await screen.findByText(/Falha no disparo/i)).toBeInTheDocument();
    expect(screen.getByText(/Evolution API offline/i)).toBeInTheDocument();
  });
});
