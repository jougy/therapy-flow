import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Auth from "@/pages/Auth";

const supabaseMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: supabaseMocks.signInWithPassword,
      signOut: supabaseMocks.signOut,
    },
    rpc: supabaseMocks.rpc,
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("Auth", () => {
  it("accepts CPF as owner document for login validation", async () => {
    supabaseMocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    supabaseMocks.rpc.mockResolvedValue({ data: true, error: null });

    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <Auth />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/cpf ou cnpj/i), { target: { value: "12345678901" } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(supabaseMocks.signInWithPassword).toHaveBeenCalledWith({
        email: "owner@example.com",
        password: "123456",
      });
    });

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("validate_user_clinic", {
      _cnpj: "12345678901",
      _user_id: "user-1",
    });
  });

  it("renders a closed-access login screen without signup or demo accounts", () => {
    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <Auth />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByText(/acesso restrito/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cpf ou cnpj/i)).toBeInTheDocument();
    expect(screen.queryByText(/criar conta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cadastre-se/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/logins de teste locais/i)).not.toBeInTheDocument();
  });
});
