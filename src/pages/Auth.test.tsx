import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Auth from "@/pages/Auth";

const supabaseMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: supabaseMocks.signInWithPassword,
      resetPasswordForEmail: supabaseMocks.resetPasswordForEmail,
    },
    rpc: supabaseMocks.rpc,
  },
}));

const toastMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-toast", () => ({
  toast: toastMock,
}));

vi.mock("@/components/ui/tabs", () => {
  return {
    Tabs: ({ value, onValueChange, children }: { value?: string; onValueChange?: (val: string) => void; children: React.ReactNode }) => (
      <div data-testid="mock-tabs" data-value={value}>
        {typeof children === "function"
          ? (children as (props: { value?: string; onValueChange?: (val: string) => void }) => React.ReactNode)({ value, onValueChange })
          : React.Children.map(children, (child) => {
              if (!React.isValidElement(child)) return null;
              return React.cloneElement(child, { activeValue: value, onValueChange } as Record<string, unknown>);
            })}
      </div>
    ),
    TabsList: ({ children, activeValue, onValueChange }: { children: React.ReactNode; activeValue?: string; onValueChange?: (val: string) => void }) => (
      <div role="tablist">
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return null;
          return React.cloneElement(child, { activeValue, onValueChange } as Record<string, unknown>);
        })}
      </div>
    ),
    TabsTrigger: ({ value, activeValue, onValueChange, children, ...props }: { value: string; activeValue?: string; onValueChange?: (val: string) => void; children: React.ReactNode }) => {
      const restProps = { ...props } as Record<string, unknown>;
      delete restProps.activeValue;
      delete restProps.onValueChange;
      return (
        <button
          role="tab"
          type="button"
          aria-selected={value === activeValue}
          onClick={() => onValueChange?.(value)}
          {...restProps}
        >
          {children}
        </button>
      );
    },
    TabsContent: ({ value, activeValue, children, ...props }: { value: string; activeValue?: string; children: React.ReactNode }) => {
      if (value !== activeValue) return null;
      const restProps = { ...props } as Record<string, unknown>;
      delete restProps.activeValue;
      delete restProps.onValueChange;
      return <div role="tabpanel" {...restProps}>{children}</div>;
    },
  };
});



describe("Auth", () => {
  it("authenticates with email and password before clinic selection", async () => {
    supabaseMocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <Auth />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(supabaseMocks.signInWithPassword).toHaveBeenCalledWith({
        email: "owner@example.com",
        password: "123456",
      });
    });
  });

  it("renders a closed-access login screen without signup or demo accounts", () => {
    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <Auth />
      </MemoryRouter>
    );

    expect(screen.getByText("Pluri-Health")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByText(/próxima etapa/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/cpf ou cnpj/i)).not.toBeInTheDocument();
    expect(screen.getByText(/criar conta/i)).toBeInTheDocument();
    expect(screen.queryByText(/cadastre-se/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/logins de teste locais/i)).not.toBeInTheDocument();
  });

  it("redirects to /auth/confirmado when login fails with Email not confirmed error", async () => {
    supabaseMocks.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error("Email not confirmed"),
    });

    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <Auth />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "pendente@example.com" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "senha123" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(supabaseMocks.signInWithPassword).toHaveBeenCalledWith({
        email: "pendente@example.com",
        password: "senha123",
      });
    });
  });

  describe("Recovery Mode", () => {
    it("handles recovery by email when email has CPF registered", async () => {
      supabaseMocks.rpc.mockResolvedValue({
        data: { status: "email_found_with_cpf", email: "dr.silva@example.com" },
        error: null,
      });
      supabaseMocks.resetPasswordForEmail.mockResolvedValue({ error: null });

      render(
        <MemoryRouter initialEntries={["/auth"]}>
          <Auth />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByText(/esqueci minha senha/i));
      expect(screen.getByText("Recuperar acesso")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /por e-mail/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /por cpf/i })).toBeInTheDocument();

      const emailInput = screen.getByLabelText(/e-mail cadastrado/i);
      fireEvent.change(emailInput, { target: { value: "dr.silva@example.com" } });
      fireEvent.click(screen.getByRole("button", { name: /enviar e-mail de recuperação/i }));

      await waitFor(() => {
        expect(supabaseMocks.rpc).toHaveBeenCalledWith("request_account_recovery_status", {
          _identifier: "dr.silva@example.com",
        });
        expect(supabaseMocks.resetPasswordForEmail).toHaveBeenCalledWith(
          "dr.silva@example.com",
          expect.objectContaining({
            redirectTo: expect.stringContaining("/auth/redefinir-senha"),
          })
        );
      });
    });

    it("handles recovery by email when user has no CPF (redirects with regularizar=true)", async () => {
      supabaseMocks.rpc.mockResolvedValue({
        data: { status: "email_found_without_cpf", email: "semcpf@example.com" },
        error: null,
      });
      supabaseMocks.resetPasswordForEmail.mockResolvedValue({ error: null });

      render(
        <MemoryRouter initialEntries={["/auth"]}>
          <Auth />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByText(/esqueci minha senha/i));
      const emailInput = screen.getByLabelText(/e-mail cadastrado/i);
      fireEvent.change(emailInput, { target: { value: "semcpf@example.com" } });
      fireEvent.click(screen.getByRole("button", { name: /enviar e-mail de recuperação/i }));

      await waitFor(() => {
        expect(supabaseMocks.rpc).toHaveBeenCalledWith("request_account_recovery_status", {
          _identifier: "semcpf@example.com",
        });
        expect(supabaseMocks.resetPasswordForEmail).toHaveBeenCalledWith(
          "semcpf@example.com",
          expect.objectContaining({
            redirectTo: expect.stringContaining("/auth/redefinir-senha?regularizar=true"),
          })
        );
      });
    });

    it("displays error when email is not registered", async () => {
      supabaseMocks.rpc.mockResolvedValue({
        data: { status: "email_not_found" },
        error: null,
      });

      render(
        <MemoryRouter initialEntries={["/auth"]}>
          <Auth />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByText(/esqueci minha senha/i));
      const emailInput = screen.getByLabelText(/e-mail cadastrado/i);
      fireEvent.change(emailInput, { target: { value: "naoexiste@example.com" } });
      fireEvent.click(screen.getByRole("button", { name: /enviar e-mail de recuperação/i }));

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "E-mail não registrado",
            variant: "destructive",
          })
        );
      });
    });

    it("handles recovery by CPF when CPF is found", async () => {
      supabaseMocks.rpc.mockResolvedValue({
        data: {
          status: "cpf_found",
          email: "joao@example.com",
          masked_email: "j***o@example.com",
        },
        error: null,
      });
      supabaseMocks.resetPasswordForEmail.mockResolvedValue({ error: null });

      render(
        <MemoryRouter initialEntries={["/auth"]}>
          <Auth />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByText(/esqueci minha senha/i));
      fireEvent.click(screen.getByRole("tab", { name: /por cpf/i }));

      const cpfInput = screen.getByLabelText(/cpf cadastrado/i);
      fireEvent.change(cpfInput, { target: { value: "12345678909" } });
      fireEvent.click(screen.getByRole("button", { name: /localizar conta e enviar link/i }));

      await waitFor(() => {
        expect(supabaseMocks.rpc).toHaveBeenCalledWith("request_account_recovery_status", {
          _identifier: "12345678909",
        });
        expect(supabaseMocks.resetPasswordForEmail).toHaveBeenCalledWith(
          "joao@example.com",
          expect.objectContaining({
            redirectTo: expect.stringContaining("/auth/redefinir-senha"),
          })
        );
        expect(toastMock).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Recuperação enviada",
            description: expect.stringContaining("joao@example.com"),
          })
        );
      });
    });

    it("displays error when CPF is not found", async () => {
      supabaseMocks.rpc.mockResolvedValue({
        data: { status: "cpf_not_found" },
        error: null,
      });

      render(
        <MemoryRouter initialEntries={["/auth"]}>
          <Auth />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByText(/esqueci minha senha/i));
      fireEvent.click(screen.getByRole("tab", { name: /por cpf/i }));

      const cpfInput = screen.getByLabelText(/cpf cadastrado/i);
      fireEvent.change(cpfInput, { target: { value: "00000000000" } });
      fireEvent.click(screen.getByRole("button", { name: /localizar conta e enviar link/i }));

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "CPF não registrado",
            variant: "destructive",
          })
        );
      });
    });
  });
});
