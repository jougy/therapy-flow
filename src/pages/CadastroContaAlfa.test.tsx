import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CadastroContaAlfa from "@/pages/CadastroContaAlfa";
import { toast } from "@/hooks/use-toast";
import { buildPublicAppUrl } from "@/lib/public-app-url";

const mockNavigate = vi.fn();
const mockTrackCompleteRegistration = vi.fn();
const mockTrackStartTrial = vi.fn();

vi.mock("@/lib/meta-pixel", async () => {
  const actual = await vi.importActual<typeof import("@/lib/meta-pixel")>("@/lib/meta-pixel");
  return {
    ...actual,
    trackCompleteRegistration: (...args: unknown[]) => mockTrackCompleteRegistration(...args),
    trackStartTrial: (...args: unknown[]) => mockTrackStartTrial(...args),
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signUp: supabaseMocks.signUp,
      signOut: supabaseMocks.signOut,
    },
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
    functions: {
      invoke: supabaseMocks.invoke,
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("CadastroContaAlfa", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockTrackCompleteRegistration.mockReset();
    mockTrackStartTrial.mockReset();
    supabaseMocks.from.mockReset();
    supabaseMocks.rpc.mockReset();
    supabaseMocks.signUp.mockReset();
    supabaseMocks.signOut.mockReset();
    supabaseMocks.invoke.mockReset();
    supabaseMocks.invoke.mockResolvedValue({ data: {}, error: null });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.HTMLElement.prototype.hasPointerCapture = vi.fn();
    window.HTMLElement.prototype.releasePointerCapture = vi.fn();
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
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }));

    await waitFor(() => {
      expect(supabaseMocks.signUp).toHaveBeenCalledWith(expect.objectContaining({
        email: "alpha@example.com",
        password: "teste1234",
        options: expect.objectContaining({
          emailRedirectTo: buildPublicAppUrl("/auth/confirmado"),
          data: expect.objectContaining({
            birth_date: "1990-01-20",
            cpf: "52998224725",
            full_name: "Owner Teste",
            phone: "11999998888",
            signup_source: "web_signup",
          }),
        }),
      }));
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("handle_personal_signup", {
        _birth_date: "1990-01-20",
        _council_number: null,
        _cpf: "52998224725",
        _email: "alpha@example.com",
        _full_name: "Owner Teste",
        _phone: "11999998888",
        _profession: null,
        _user_id: "user-alpha-1",
      });
      expect(mockNavigate).toHaveBeenCalledWith(
        "/auth/confirmado?email=alpha%40example.com&aguardando=true",
        { state: { email: "alpha@example.com" } }
      );
      expect(mockTrackCompleteRegistration).toHaveBeenCalledWith(expect.objectContaining({
        profession: "physiotherapist",
        userData: {
          email: "alpha@example.com",
          phone: "11999998888",
          name: "Owner Teste",
        },
      }));
      expect(mockTrackStartTrial).toHaveBeenCalledWith(expect.objectContaining({
        profession: "physiotherapist",
        userData: {
          email: "alpha@example.com",
          phone: "11999998888",
          name: "Owner Teste",
        },
      }));
    });
  });

  it("signs out and redirects immediately to /auth/confirmado when session is created automatically", async () => {
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
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }));

    await waitFor(() => {
      expect(supabaseMocks.signOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(
        "/auth/confirmado?email=direto%40example.com&aguardando=true",
        { state: { email: "direto@example.com" } }
      );
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
    fireEvent.click(screen.getByRole("checkbox"));
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

  it("navigates to /auth when clicking 'Já possui uma conta? Entrar'", () => {
    render(
      <MemoryRouter initialEntries={["/auth/cadastro"]}>
        <CadastroContaAlfa />
      </MemoryRouter>
    );

    const loginButton = screen.getByRole("button", { name: /Já possui uma conta\? Entrar/i });
    expect(loginButton).toBeInTheDocument();

    fireEvent.click(loginButton);
    expect(mockNavigate).toHaveBeenCalledWith("/auth");
  });

  it("submits profession and council number when filled", async () => {
    supabaseMocks.signUp.mockResolvedValue({
      data: { user: { id: "user-alpha-2" }, session: null },
      error: null,
    });
    supabaseMocks.rpc.mockResolvedValue({
      data: { user_id: "user-alpha-2", has_clinic: true },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/auth/cadastro"]}>
        <CadastroContaAlfa />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/seu nome completo/i), { target: { value: "Dra. Maria Fisioterapeuta" } });
    fireEvent.change(screen.getByLabelText(/^cpf$/i), { target: { value: "529.982.247-25" } });
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), { target: { value: "1988-06-15" } });
    fireEvent.change(screen.getByLabelText(/número de contato/i), { target: { value: "(11) 98888-1111" } });
    fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: "maria@example.com" } });
    fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: "senhaSegura123" } });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: "senhaSegura123" } });
    fireEvent.click(screen.getByRole("checkbox"));

    // Simula seleção de profissão via Select
    const professionSelect = screen.getByLabelText(/profissão/i);
    fireEvent.click(professionSelect);

    const optionFisio = await screen.findByRole("option", { name: "Fisioterapeuta" });
    fireEvent.click(optionFisio);

    // O campo de conselho regional aparece
    const councilInput = await screen.findByLabelText(/número do crefito/i);
    fireEvent.change(councilInput, { target: { value: "123456-F" } });

    fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }));

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("handle_personal_signup", expect.objectContaining({
        _birth_date: "1988-06-15",
        _council_number: "123456-F",
        _cpf: "52998224725",
        _email: "maria@example.com",
        _full_name: "Dra. Maria Fisioterapeuta",
        _phone: "11988881111",
        _profession: "fisioterapeuta",
        _user_id: "user-alpha-2",
      }));
    });
  });
});

