import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CadastroContaAlfa from "@/pages/CadastroContaAlfa";
import { toast } from "@/hooks/use-toast";
import { buildPublicAppUrl } from "@/lib/public-app-url";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signUp: supabaseMocks.signUp,
    },
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("CadastroContaAlfa", () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset();
    supabaseMocks.rpc.mockReset();
    supabaseMocks.signUp.mockReset();
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        disconnect() {}
        observe() {}
        unobserve() {}
      }
    );
  });

  it("creates a personal account and calls handle_personal_signup", async () => {
    supabaseMocks.signUp.mockResolvedValue({
      data: { user: { id: "user-alpha-1" }, session: null },
      error: null,
    });
    supabaseMocks.rpc.mockResolvedValue({
      data: { user_id: "user-alpha-1", has_clinic: false },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/auth/cadastro"]}>
        <CadastroContaAlfa />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/seu nome completo/i), { target: { value: "Owner <script>Teste</script>" } });
    fireEvent.change(screen.getByLabelText(/^cpf$/i), { target: { value: "529.982.247-25" } });
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), { target: { value: "1990-01-20" } });
    fireEvent.change(screen.getByLabelText(/número de contato/i), { target: { value: "(11) 99999-8888" } });
    fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: "alpha@example.com" } });
    fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: "teste1234" } });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: "teste1234" } });
    fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }));

    await waitFor(() => {
      expect(supabaseMocks.signUp).toHaveBeenCalledWith({
        email: "alpha@example.com",
        password: "teste1234",
        options: {
          emailRedirectTo: buildPublicAppUrl("/auth/confirmado"),
          data: {
            birth_date: "1990-01-20",
            cpf: "52998224725",
            full_name: "Owner Teste",
            phone: "11999998888",
            signup_source: "web_signup",
          },
        },
      });
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("handle_personal_signup", {
        _birth_date: "1990-01-20",
        _cpf: "52998224725",
        _email: "alpha@example.com",
        _full_name: "Owner Teste",
        _phone: "11999998888",
        _user_id: "user-alpha-1",
      });
      expect(screen.getByText(/confirme seu e-mail para continuar/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /ir para o login/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /acompanhar confirmação/i })).toBeInTheDocument();
    });
  });

  it("handles instant auto-login session when email confirmation is disabled", async () => {
    supabaseMocks.signUp.mockResolvedValue({
      data: {
        user: { id: "user-alpha-2" },
        session: { access_token: "token-123" },
      },
      error: null,
    });
    supabaseMocks.rpc.mockResolvedValue({
      data: { user_id: "user-alpha-2", has_clinic: false },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/auth/cadastro"]}>
        <CadastroContaAlfa />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/seu nome completo/i), { target: { value: "Usuario Direto" } });
    fireEvent.change(screen.getByLabelText(/^cpf$/i), { target: { value: "529.982.247-25" } });
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), { target: { value: "1995-05-15" } });
    fireEvent.change(screen.getByLabelText(/número de contato/i), { target: { value: "(11) 98888-7777" } });
    fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: "direto@example.com" } });
    fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: "senhaForte123" } });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: "senhaForte123" } });
    fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }));

    await waitFor(() => {
      expect(screen.getByText(/cadastro concluído com sucesso/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /avançar para o espaço pessoal/i })).toBeInTheDocument();
    });
  });

  it("blocks obviously invalid CPF and weak password before hitting Supabase", async () => {
    render(
      <MemoryRouter initialEntries={["/auth/cadastro"]}>
        <CadastroContaAlfa />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/seu nome completo/i), { target: { value: "Owner Teste" } });
    fireEvent.change(screen.getByLabelText(/^cpf$/i), { target: { value: "000.000.000-00" } });
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), { target: { value: "2020-01-20" } });
    fireEvent.change(screen.getByLabelText(/número de contato/i), { target: { value: "(11) 99999-8888" } });
    fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: "alpha@example.com" } });
    fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: "abcdefg" } });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: "abcdefg" } });

    expect(screen.getByRole("button", { name: /^criar conta$/i })).toBeDisabled();
    expect(supabaseMocks.signUp).not.toHaveBeenCalled();
  });

  it("translates signup rate-limit errors and starts a cooldown", async () => {
    supabaseMocks.signUp.mockResolvedValue({
      data: { user: null },
      error: new Error("For security purposes, you can only request this after 45 seconds."),
    });

    render(
      <MemoryRouter initialEntries={["/auth/cadastro"]}>
        <CadastroContaAlfa />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/seu nome completo/i), { target: { value: "Owner Teste" } });
    fireEvent.change(screen.getByLabelText(/^cpf$/i), { target: { value: "529.982.247-25" } });
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), { target: { value: "1990-01-20" } });
    fireEvent.change(screen.getByLabelText(/número de contato/i), { target: { value: "(11) 99999-8888" } });
    fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: "alpha@example.com" } });
    fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: "teste1234" } });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: "teste1234" } });
    fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        description: "Por segurança, o sistema bloqueou novas tentativas muito rápidas. Aguarde 45 segundos e tente novamente.",
        title: "Erro ao criar conta",
        variant: "destructive",
      }));
      expect(screen.getByText(/aguarde 45s para tentar criar a conta novamente/i)).toBeInTheDocument();
    });
  });
});

