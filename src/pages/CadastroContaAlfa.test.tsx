import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CadastroContaAlfa from "@/pages/CadastroContaAlfa";
import { toast } from "@/hooks/use-toast";

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

  it("creates an alpha owner account and calls handle_signup", async () => {
    supabaseMocks.signUp.mockResolvedValue({
      data: { user: { id: "user-alpha-1" } },
      error: null,
    });
    supabaseMocks.rpc.mockResolvedValue({
      data: { clinic_id: "clinic-alpha-1" },
      error: null,
    });
    supabaseMocks.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    render(
      <MemoryRouter initialEntries={["/cadastro/conta-alfa"]}>
        <CadastroContaAlfa />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/seu nome/i), { target: { value: "Owner <script>Teste</script>" } });
    fireEvent.change(screen.getByLabelText(/nome da clínica/i), { target: { value: "Clínica <b>Teste</b>" } });
    fireEvent.change(screen.getByLabelText(/^cpf$/i), { target: { value: "529.982.247-25" } });
    fireEvent.change(screen.getByLabelText(/cnpj da clínica/i), { target: { value: "04.252.011/0001-10" } });
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), { target: { value: "1990-01-20" } });
    fireEvent.change(screen.getByLabelText(/número de contato/i), { target: { value: "(11) 99999-8888" } });
    fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: "alpha@example.com" } });
    fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: "teste1234" } });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: "teste1234" } });
    fireEvent.click(screen.getByRole("button", { name: /criar conta alfa/i }));

    await waitFor(() => {
      expect(supabaseMocks.signUp).toHaveBeenCalledWith({
        email: "alpha@example.com",
        password: "teste1234",
        options: {
          emailRedirectTo: "http://localhost:3000/auth/confirmado",
          data: {
            birth_date: "1990-01-20",
            cnpj: "04252011000110",
            clinic_name: "Clínica Teste",
            cpf: "52998224725",
            full_name: "Owner Teste",
            phone: "11999998888",
            signup_source: "alpha_closed_link",
          },
        },
      });
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("handle_signup", {
        _cnpj: "04252011000110",
        _clinic_name: "Clínica Teste",
        _email: "alpha@example.com",
        _full_name: "Owner Teste",
        _subscription_plan: "clinic",
        _user_id: "user-alpha-1",
      });
    });
  });

  it("blocks obviously invalid CPF and weak password before hitting Supabase", async () => {
    render(
      <MemoryRouter initialEntries={["/cadastro/conta-alfa"]}>
        <CadastroContaAlfa />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/seu nome/i), { target: { value: "Owner Teste" } });
    fireEvent.change(screen.getByLabelText(/^cpf$/i), { target: { value: "000.000.000-00" } });
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), { target: { value: "2020-01-20" } });
    fireEvent.change(screen.getByLabelText(/número de contato/i), { target: { value: "(11) 99999-8888" } });
    fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: "alpha@example.com" } });
    fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: "abcdefg" } });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: "abcdefg" } });

    expect(screen.getByRole("button", { name: /criar conta alfa/i })).toBeDisabled();
    expect(supabaseMocks.signUp).not.toHaveBeenCalled();
  });

  it("translates signup rate-limit errors and starts a cooldown", async () => {
    supabaseMocks.signUp.mockResolvedValue({
      data: { user: null },
      error: new Error("For security purposes, you can only request this after 45 seconds."),
    });

    render(
      <MemoryRouter initialEntries={["/cadastro/conta-alfa"]}>
        <CadastroContaAlfa />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/seu nome/i), { target: { value: "Owner Teste" } });
    fireEvent.change(screen.getByLabelText(/^cpf$/i), { target: { value: "529.982.247-25" } });
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), { target: { value: "1990-01-20" } });
    fireEvent.change(screen.getByLabelText(/número de contato/i), { target: { value: "(11) 99999-8888" } });
    fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: "alpha@example.com" } });
    fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: "teste1234" } });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: "teste1234" } });
    fireEvent.click(screen.getByRole("button", { name: /criar conta alfa/i }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        description: "Por segurança, o Supabase bloqueou uma nova tentativa muito rápida. Aguarde 45 segundos e tente novamente.",
        title: "Erro ao criar conta",
        variant: "destructive",
      }));
      expect(screen.getByText(/aguarde 45s para tentar criar a conta novamente/i)).toBeInTheDocument();
    });
  });
});
