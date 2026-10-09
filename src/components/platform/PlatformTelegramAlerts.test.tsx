import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformTelegramAlerts } from "@/components/platform/PlatformTelegramAlerts";

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

describe("PlatformTelegramAlerts", () => {
  beforeEach(() => {
    supabaseMocks.invoke.mockReset();
  });

  it("renders status cards and layout preview", () => {
    render(<PlatformTelegramAlerts />);

    expect(screen.getByText(/Central de Alertas & Notificações Telegram/i)).toBeInTheDocument();
    expect(screen.getByText(/Novo Cadastro Orgânico/i)).toBeInTheDocument();
    expect(screen.getByText(/Pagamento de Plano Asaas/i)).toBeInTheDocument();
    expect(screen.getByText(/Pré-visualização do Layout no Telegram/i)).toBeInTheDocument();
  });

  it("triggers test notification successfully", async () => {
    supabaseMocks.invoke.mockResolvedValue({
      data: { success: true, message: "Mensagem enviada com sucesso ao canal de avisos!" },
      error: null,
    });

    render(<PlatformTelegramAlerts />);

    const button = screen.getByRole("button", { name: /Disparar Mensagem de Teste no Telegram/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(supabaseMocks.invoke).toHaveBeenCalledWith("notify-admin-telegram", {
        body: expect.objectContaining({
          action: "SEND_TEST_NOTIFICATION",
          profession: "fisioterapeuta",
          gender: "Feminino",
          preferredPronoun: "Ela/Dela",
          origin: "Instagram (Bio/Campanha)",
        }),
      });
    });

    expect(await screen.findByText(/Sucesso no envio/i)).toBeInTheDocument();
    expect(screen.getByText(/Mensagem enviada com sucesso ao canal de avisos!/i)).toBeInTheDocument();
  });

  it("displays error message when test notification fails", async () => {
    supabaseMocks.invoke.mockResolvedValue({
      data: null,
      error: { message: "Token inválido" },
    });

    render(<PlatformTelegramAlerts />);

    const button = screen.getByRole("button", { name: /Disparar Mensagem de Teste no Telegram/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(supabaseMocks.invoke).toHaveBeenCalledWith("notify-admin-telegram", {
        body: expect.objectContaining({
          action: "SEND_TEST_NOTIFICATION",
        }),
      });
    });

    expect(await screen.findByText(/Falha no envio/i)).toBeInTheDocument();
    expect(screen.getByText(/Token inválido/i)).toBeInTheDocument();
  });
});
