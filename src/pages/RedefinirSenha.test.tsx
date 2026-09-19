import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RedefinirSenha from "@/pages/RedefinirSenha";

const supabaseMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  refreshSession: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: supabaseMocks.getSession,
      onAuthStateChange: supabaseMocks.onAuthStateChange,
      updateUser: supabaseMocks.updateUser,
      getUser: supabaseMocks.getUser,
      exchangeCodeForSession: supabaseMocks.exchangeCodeForSession,
      refreshSession: supabaseMocks.refreshSession,
      signOut: supabaseMocks.signOut,
    },
    rpc: supabaseMocks.rpc,
    from: supabaseMocks.from,
  },
}));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({
  toast: toastMock,
}));

const clearPasswordRecoveryMock = vi.hoisted(() => vi.fn());
const refreshAuthStateMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    clearPasswordRecovery: clearPasswordRecoveryMock,
    refreshAuthState: refreshAuthStateMock,
  }),
}));

describe("RedefinirSenha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    supabaseMocks.refreshSession.mockResolvedValue({ data: {}, error: null });
  });

  it("renders standard password reset when user has CPF in profile", async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-123" } } },
    });
    supabaseMocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { full_name: "Dr. João", cpf: "123.456.789-09" },
          }),
        }),
      }),
    });

    render(
      <MemoryRouter initialEntries={["/auth/redefinir-senha"]}>
        <RedefinirSenha />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Criar nova senha" })).toBeInTheDocument();
    });

    expect(screen.queryByLabelText(/nome completo/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^cpf$/i)).not.toBeInTheDocument();
  });

  it("renders regularize profile form when user does not have CPF", async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-without-cpf" } } },
    });
    supabaseMocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { full_name: "Dra. Maria", cpf: null },
          }),
        }),
      }),
    });
    supabaseMocks.updateUser.mockResolvedValue({ error: null });
    supabaseMocks.rpc.mockResolvedValue({ error: null });
    supabaseMocks.signOut.mockResolvedValue({ error: null });

    render(
      <MemoryRouter initialEntries={["/auth/redefinir-senha?regularizar=true"]}>
        <RedefinirSenha />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Completar cadastro e criar senha" })).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^cpf$/i)).toBeInTheDocument();

    // Preenche CPF matematicamente válido (52998224725)
    fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: "Dra. Maria Atualizada" } });
    fireEvent.change(screen.getByLabelText(/^cpf$/i), { target: { value: "52998224725" } });
    fireEvent.change(screen.getByLabelText(/^nova senha$/i), { target: { value: "SenhaSegura123!" } });
    fireEvent.change(screen.getByLabelText(/^confirmar senha$/i), { target: { value: "SenhaSegura123!" } });

    fireEvent.click(screen.getByRole("button", { name: /salvar dados e confirmar senha/i }));

    await waitFor(() => {
      expect(supabaseMocks.updateUser).toHaveBeenCalledWith({ password: "SenhaSegura123!" });
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("complete_unregistered_cpf_profile", {
        _full_name: "Dra. Maria Atualizada",
        _cpf: "52998224725",
      });
      expect(supabaseMocks.signOut).not.toHaveBeenCalled();
      expect(screen.getByText("Sua senha foi alterada com sucesso!")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /ir para o espaço pessoal agora/i })).toBeInTheDocument();
    });
  });

  it("handles authorization code exchange (?code=...) and shows recovery form", async () => {
    supabaseMocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: { user: { id: "user-exchange" } } },
      error: null,
    });
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: null },
    });
    supabaseMocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { full_name: "Dr. Exchange", cpf: "123.456.789-09" },
          }),
        }),
      }),
    });

    render(
      <MemoryRouter initialEntries={["/auth/redefinir-senha?code=auth-code-123"]}>
        <RedefinirSenha />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(supabaseMocks.exchangeCodeForSession).toHaveBeenCalledWith("auth-code-123");
      expect(screen.getByRole("heading", { name: "Criar nova senha" })).toBeInTheDocument();
    });
  });

  it("rejects weak password before submitting to supabase", async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-weak" } } },
    });
    supabaseMocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { full_name: "Dr. Fraco", cpf: "123.456.789-09" },
          }),
        }),
      }),
    });

    render(
      <MemoryRouter initialEntries={["/auth/redefinir-senha"]}>
        <RedefinirSenha />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Criar nova senha" })).toBeInTheDocument();
    });

    // Senha sem números (somente letras)
    fireEvent.change(screen.getByLabelText(/^nova senha$/i), { target: { value: "senhafraca" } });
    fireEvent.change(screen.getByLabelText(/^confirmar senha$/i), { target: { value: "senhafraca" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar nova senha/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Senha fraca",
        variant: "destructive",
      })
    );
    expect(supabaseMocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects mismatched password before submitting to supabase", async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-mismatch" } } },
    });
    supabaseMocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { full_name: "Dr. Incompativel", cpf: "123.456.789-09" },
          }),
        }),
      }),
    });

    render(
      <MemoryRouter initialEntries={["/auth/redefinir-senha"]}>
        <RedefinirSenha />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Criar nova senha" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^nova senha$/i), { target: { value: "SenhaForte123!" } });
    fireEvent.change(screen.getByLabelText(/^confirmar senha$/i), { target: { value: "OutraSenha123!" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar nova senha/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "As senhas não conferem",
        variant: "destructive",
      })
    );
    expect(supabaseMocks.updateUser).not.toHaveBeenCalled();
  });

  it("handles exchangeCodeForSession error gracefully and displays expired/invalid state", async () => {
    supabaseMocks.exchangeCodeForSession.mockResolvedValue({
      data: null,
      error: { message: "Invalid or expired recovery token" },
    });
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: null },
    });

    render(
      <MemoryRouter initialEntries={["/auth/redefinir-senha?code=invalid-code"]}>
        <RedefinirSenha />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(supabaseMocks.exchangeCodeForSession).toHaveBeenCalledWith("invalid-code");
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Código inválido ou expirado",
          variant: "destructive",
        })
      );
      expect(screen.getByText(/o link de recuperação não está ativo ou expirou/i)).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Criar nova senha" })).not.toBeInTheDocument();
    });
  });

  it("clears password recovery and navigates to login when clicking 'Voltar para o login'", async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: null },
    });

    render(
      <MemoryRouter initialEntries={["/auth/redefinir-senha"]}>
        <RedefinirSenha />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/o link de recuperação não está ativo ou expirou/i)).toBeInTheDocument();
    });

    const backButton = screen.getByRole("button", { name: /voltar para o login/i });
    fireEvent.click(backButton);

    expect(clearPasswordRecoveryMock).toHaveBeenCalled();
  });

  it("clears password recovery on unmount to prevent perpetual recovery state", async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-unmount" } } },
    });
    supabaseMocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { full_name: "Dr. Unmount", cpf: "123.456.789-09" },
          }),
        }),
      }),
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={["/auth/redefinir-senha"]}>
        <RedefinirSenha />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Criar nova senha" })).toBeInTheDocument();
    });

    unmount();

    expect(clearPasswordRecoveryMock).toHaveBeenCalled();
  });

  it("renews session, syncs auth state and clears recovery state before redirecting to /espacopessoal", async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-redirect-test" } } },
    });
    supabaseMocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { full_name: "Dr. Redirect", cpf: "123.456.789-09" },
          }),
        }),
      }),
    });
    supabaseMocks.updateUser.mockResolvedValue({ error: null });

    render(
      <MemoryRouter initialEntries={["/auth/redefinir-senha"]}>
        <RedefinirSenha />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Criar nova senha" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^nova senha$/i), { target: { value: "NovaSenha123!" } });
    fireEvent.change(screen.getByLabelText(/^confirmar senha$/i), { target: { value: "NovaSenha123!" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar nova senha/i }));

    await waitFor(() => {
      expect(supabaseMocks.updateUser).toHaveBeenCalledWith({ password: "NovaSenha123!" });
      expect(supabaseMocks.refreshSession).toHaveBeenCalled();
      expect(refreshAuthStateMock).toHaveBeenCalled();
      expect(screen.getByText("Sua senha foi alterada com sucesso!")).toBeInTheDocument();
    });

    const redirectButton = screen.getByRole("button", { name: /ir para o espaço pessoal agora/i });
    expect(redirectButton).toBeInTheDocument();

    fireEvent.click(redirectButton);

    expect(clearPasswordRecoveryMock).toHaveBeenCalled();
  });
});
