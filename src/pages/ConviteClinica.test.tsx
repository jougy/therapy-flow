import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConviteClinica from "@/pages/ConviteClinica";
import { toast } from "@/hooks/use-toast";

const supabaseMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  rpc: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: supabaseMocks.getSession,
      onAuthStateChange: supabaseMocks.onAuthStateChange,
      signInWithPassword: supabaseMocks.signInWithPassword,
      signUp: supabaseMocks.signUp,
    },
    rpc: supabaseMocks.rpc,
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    signOut: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe("ConviteClinica", () => {
  beforeEach(() => {
    supabaseMocks.getSession.mockReset();
    supabaseMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    supabaseMocks.rpc.mockReset();
    supabaseMocks.signInWithPassword.mockReset();
    supabaseMocks.signUp.mockReset();
  });

  it("renders accept button when user is already logged in with the invited email", async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1", email: "colaborador@clinica.com" } } },
      error: null,
    });
    supabaseMocks.rpc.mockImplementation(async (method: string) => {
      if (method === "get_clinic_collaborator_invitation") {
        return {
          data: {
            clinic_name: "Clínica Bem Estar",
            email: "colaborador@clinica.com",
            existing_user: true,
            operational_role: "professional",
            job_title: "Psicólogo Clínico",
            status: "pending",
          },
          error: null,
        };
      }
      if (method === "accept_clinic_collaborator_invitation") {
        return { data: { clinic_id: "clinic-123", status: "accepted" }, error: null };
      }
      return { data: null, error: null };
    });

    render(
      <MemoryRouter initialEntries={["/convite/clinica/valid-token-123"]}>
        <Routes>
          <Route path="/convite/clinica/:token" element={<ConviteClinica />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/você já está conectado como colaborador@clinica.com/i)).toBeInTheDocument();
    const acceptButton = screen.getByRole("button", { name: /aceitar convite e entrar na clínica/i });
    expect(acceptButton).toBeInTheDocument();

    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("accept_clinic_collaborator_invitation", {
        _full_name: null,
        _token: "valid-token-123",
      });
      expect(toast).toHaveBeenCalledWith({
        title: "Acesso ativado com sucesso!",
        description: "Bem-vindo(a) à equipe da Clínica Bem Estar! Seu acesso foi ativado com sucesso.",
      });
    });
  });

  it("renders guided onboarding form for new users without an account", async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    supabaseMocks.rpc.mockImplementation(async (method: string) => {
      if (method === "get_clinic_collaborator_invitation") {
        return {
          data: {
            clinic_name: "Clínica Bem Estar",
            email: "novo.membro@clinica.com",
            existing_user: false,
            operational_role: "professional",
            job_title: "Terapeuta Ocupacional",
            status: "pending",
          },
          error: null,
        };
      }
      if (method === "handle_personal_signup") {
        return { data: { user_id: "new-user-123" }, error: null };
      }
      if (method === "accept_clinic_collaborator_invitation") {
        return { data: { clinic_id: "clinic-123", status: "accepted" }, error: null };
      }
      return { data: null, error: null };
    });

    supabaseMocks.signUp.mockResolvedValue({
      data: {
        user: { id: "new-user-123" },
        session: { access_token: "jwt-token-123" },
      },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/convite/clinica/new-user-token"]}>
        <Routes>
          <Route path="/convite/clinica/:token" element={<ConviteClinica />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/finalização de cadastro/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^cpf$/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: "Dr. João Silva" } });
    fireEvent.change(screen.getByLabelText(/^cpf$/i), { target: { value: "529.982.247-25" } });
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), { target: { value: "1992-04-10" } });
    fireEvent.change(screen.getByLabelText(/telefone \/ whatsapp/i), { target: { value: "(11) 98888-7777" } });
    fireEvent.change(screen.getByLabelText(/^criar senha$/i), { target: { value: "senhaForte123" } });
    fireEvent.change(screen.getByLabelText(/^confirmar senha$/i), { target: { value: "senhaForte123" } });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: /concluir cadastro e entrar na clínica/i }));

    await waitFor(() => {
      expect(supabaseMocks.signUp).toHaveBeenCalledWith(expect.objectContaining({
        email: "novo.membro@clinica.com",
        password: "senhaForte123",
      }));
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("handle_personal_signup", {
        _birth_date: "1992-04-10",
        _cpf: "52998224725",
        _email: "novo.membro@clinica.com",
        _full_name: "Dr. João Silva",
        _phone: "11988887777",
        _user_id: "new-user-123",
      });
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("accept_clinic_collaborator_invitation", {
        _full_name: "Dr. João Silva",
        _token: "new-user-token",
      });
    });
  });

  it("switches to login mode and shows friendly toast when user already exists during signup", async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    supabaseMocks.rpc.mockImplementation(async (method: string) => {
      if (method === "get_clinic_collaborator_invitation") {
        return {
          data: {
            clinic_name: "Clínica Bem Estar",
            email: "existente@clinica.com",
            existing_user: false,
            operational_role: "professional",
            status: "pending",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    supabaseMocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "User already registered", code: "user_already_exists" },
    });

    render(
      <MemoryRouter initialEntries={["/convite/clinica/existing-token"]}>
        <Routes>
          <Route path="/convite/clinica/:token" element={<ConviteClinica />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/finalização de cadastro/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: "Dra. Ana Costa" } });
    fireEvent.change(screen.getByLabelText(/^cpf$/i), { target: { value: "529.982.247-25" } });
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), { target: { value: "1990-01-01" } });
    fireEvent.change(screen.getByLabelText(/telefone \/ whatsapp/i), { target: { value: "(11) 97777-6666" } });
    fireEvent.change(screen.getByLabelText(/^criar senha$/i), { target: { value: "senhaForte123" } });
    fireEvent.change(screen.getByLabelText(/^confirmar senha$/i), { target: { value: "senhaForte123" } });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: /concluir cadastro e entrar na clínica/i }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: "Conta já cadastrada",
        description: "Você já possui uma conta no Pluri-Health. Basta digitar sua senha para ativar seu acesso à clínica.",
      });
      expect(screen.getByText(/sua senha de acesso/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /entrar e aceitar convite/i })).toBeInTheDocument();
    });
  });

  it("stores token in sessionStorage when signup requires email confirmation", async () => {
    sessionStorage.clear();
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    supabaseMocks.rpc.mockImplementation(async (method: string) => {
      if (method === "get_clinic_collaborator_invitation") {
        return {
          data: {
            clinic_name: "Clínica Bem Estar",
            email: "aguardando.confirmacao@clinica.com",
            existing_user: false,
            operational_role: "professional",
            status: "pending",
          },
          error: null,
        };
      }
      if (method === "handle_personal_signup") {
        return { data: { user_id: "unconfirmed-user-1" }, error: null };
      }
      return { data: null, error: null };
    });

    supabaseMocks.signUp.mockResolvedValue({
      data: {
        user: { id: "unconfirmed-user-1" },
        session: null, // No immediate session -> confirmation required
      },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/convite/clinica/unconfirmed-token-777"]}>
        <Routes>
          <Route path="/convite/clinica/:token" element={<ConviteClinica />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/finalização de cadastro/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: "Dr. Carlos Silva" } });
    fireEvent.change(screen.getByLabelText(/^cpf$/i), { target: { value: "529.982.247-25" } });
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), { target: { value: "1988-05-15" } });
    fireEvent.change(screen.getByLabelText(/telefone \/ whatsapp/i), { target: { value: "(11) 96666-5555" } });
    fireEvent.change(screen.getByLabelText(/^criar senha$/i), { target: { value: "senhaForte123" } });
    fireEvent.change(screen.getByLabelText(/^confirmar senha$/i), { target: { value: "senhaForte123" } });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: /concluir cadastro e entrar na clínica/i }));

    await waitFor(() => {
      expect(sessionStorage.getItem("pending_clinic_invitation_token")).toBe("unconfirmed-token-777");
    });
  });

  it("auto-heals and accepts invitation when pending token is in sessionStorage and session becomes active", async () => {
    sessionStorage.setItem("pending_clinic_invitation_token", "saved-token-abc");

    supabaseMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-abc", email: "confirmado@clinica.com" } } },
      error: null,
    });

    supabaseMocks.rpc.mockImplementation(async (method: string) => {
      if (method === "get_clinic_collaborator_invitation") {
        return {
          data: {
            clinic_name: "Clínica Bem Estar",
            email: "confirmado@clinica.com",
            existing_user: true,
            operational_role: "professional",
            status: "pending",
          },
          error: null,
        };
      }
      if (method === "accept_clinic_collaborator_invitation") {
        return { data: { clinic_id: "clinic-1", status: "accepted" }, error: null };
      }
      return { data: null, error: null };
    });

    render(
      <MemoryRouter initialEntries={["/convite/clinica/saved-token-abc"]}>
        <Routes>
          <Route path="/convite/clinica/:token" element={<ConviteClinica />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("accept_clinic_collaborator_invitation", {
        _full_name: null,
        _token: "saved-token-abc",
      });
      expect(sessionStorage.getItem("pending_clinic_invitation_token")).toBeNull();
      expect(toast).toHaveBeenCalledWith({
        title: "Acesso ativado com sucesso!",
        description: "Bem-vindo(a) à equipe da Clínica Bem Estar! Seu acesso foi ativado com sucesso.",
      });
    });
  });
});
