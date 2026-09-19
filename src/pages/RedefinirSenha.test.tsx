import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RedefinirSenha from "@/pages/RedefinirSenha";

const supabaseMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
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

describe("RedefinirSenha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
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

    // Fill valid CPF (52998224725 is a mathematically valid test CPF)
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
      expect(supabaseMocks.signOut).toHaveBeenCalled();
    });
  });
});
