import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MfaRecoveryView } from "@/components/auth/MfaRecoveryView";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      signOut: vi.fn(),
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("MfaRecoveryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carrega e renderiza as opções de WhatsApp e E-mail mascarados", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        success: true,
        user: {
          id: "usr_123",
          name: "Test User",
          email_available: true,
          email_masked: "j***@gmx.com",
          whatsapp_available: true,
          whatsapp_masked: "(11) 9****-**42",
        },
      },
      error: null,
    });

    render(
      <MemoryRouter>
        <MfaRecoveryView
          title="Recuperação Master"
          description="Recupere o acesso 2FA"
          onSuccessRedirect="/platform/mfa"
          backRedirect="/platform/mfa"
        />
      </MemoryRouter>
    );

    expect(await screen.findByText("Recuperação Master")).toBeInTheDocument();
    expect(await screen.findByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("E-mail")).toBeInTheDocument();
    expect(screen.getByText("Enviar para (11) 9****-**42")).toBeInTheDocument();
    expect(screen.getByText("Enviar para j***@gmx.com")).toBeInTheDocument();
  });

  it("avança para o input de 6 dígitos após solicitar o código com sucesso", async () => {
    vi.mocked(supabase.functions.invoke)
      .mockResolvedValueOnce({
        data: {
          success: true,
          user: {
            id: "usr_123",
            name: "Test User",
            email_available: true,
            email_masked: "j***@gmx.com",
            whatsapp_available: true,
            whatsapp_masked: "(11) 9****-**42",
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          channel: "whatsapp",
          target_masked: "(11) 9****-**42",
        },
        error: null,
      });

    render(
      <MemoryRouter>
        <MfaRecoveryView
          title="Recuperação Master"
          description="Recupere o acesso 2FA"
          onSuccessRedirect="/platform/mfa"
          backRedirect="/platform/mfa"
        />
      </MemoryRouter>
    );

    const submitBtn = await screen.findByRole("button", { name: /Enviar código de verificação/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByLabelText(/Código de 6 dígitos/i)).toBeInTheDocument();
    expect(screen.getByText(/Código enviado para \(11\) 9\*\*\*\*-\*\*42/i)).toBeInTheDocument();
  });
});
