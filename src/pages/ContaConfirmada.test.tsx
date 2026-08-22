import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContaConfirmada from "@/pages/ContaConfirmada";
import { toast } from "@/hooks/use-toast";

const supabaseMocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  resend: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: supabaseMocks.exchangeCodeForSession,
      resend: supabaseMocks.resend,
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("ContaConfirmada", () => {
  beforeEach(() => {
    supabaseMocks.exchangeCodeForSession.mockReset();
    supabaseMocks.resend.mockReset();
  });

  it("exchanges code for session and displays Claymorphism confirmed state", async () => {
    supabaseMocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: "token-123" } },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/auth/confirmado?code=auth-code-xyz"]}>
        <ContaConfirmada />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(supabaseMocks.exchangeCodeForSession).toHaveBeenCalledWith("auth-code-xyz");
      expect(screen.getByText(/conta confirmada!/i)).toBeInTheDocument();
    });
  });

  it("renders resend screen when aguardando is true and allows resending with cooldown", async () => {
    supabaseMocks.resend.mockResolvedValue({
      data: {},
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/auth/confirmado?email=paciente@exemplo.com&aguardando=true"]}>
        <ContaConfirmada />
      </MemoryRouter>
    );

    expect(screen.getByText(/confirme seu e-mail/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("paciente@exemplo.com")).toBeInTheDocument();

    const resendBtn = screen.getByRole("button", { name: /enviar novo e-mail/i });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(supabaseMocks.resend).toHaveBeenCalledWith(expect.objectContaining({
        email: "paciente@exemplo.com",
        type: "signup",
      }));
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: "E-mail enviado",
      }));
      expect(screen.getByText(/reenviar disponível em 60s/i)).toBeInTheDocument();
    });
  });

  it("displays expired token error message when URL contains error param", async () => {
    render(
      <MemoryRouter initialEntries={["/auth/confirmado?error=access_denied&error_description=Email+link+is+invalid+or+has+expired"]}>
        <ContaConfirmada />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/link expirado/i)).toBeInTheDocument();
      expect(screen.getByText(/email link is invalid or has expired/i)).toBeInTheDocument();
    });
  });
});
