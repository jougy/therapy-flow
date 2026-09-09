import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailConfirmationRequiredModal } from "@/components/EmailConfirmationRequiredModal";

const mockNavigate = vi.fn();
const mockSignOut = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("EmailConfirmationRequiredModal", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSignOut.mockReset();
  });

  it("does not render if user is not authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      signOut: mockSignOut,
    });

    render(
      <MemoryRouter initialEntries={["/espacopessoal"]}>
        <EmailConfirmationRequiredModal />
      </MemoryRouter>
    );

    expect(screen.queryByText(/atualizamos nossas medidas de segurança/i)).not.toBeInTheDocument();
  });

  it("does not render if user's email is already confirmed", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "user-1",
        email: "confirmado@exemplo.com",
        email_confirmed_at: "2026-09-08T12:00:00Z",
      },
      signOut: mockSignOut,
    });

    render(
      <MemoryRouter initialEntries={["/espacopessoal"]}>
        <EmailConfirmationRequiredModal />
      </MemoryRouter>
    );

    expect(screen.queryByText(/atualizamos nossas medidas de segurança/i)).not.toBeInTheDocument();
  });

  it("does not render on public auth routes even if email is unconfirmed", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "user-1",
        email: "pendente@exemplo.com",
        email_confirmed_at: null,
      },
      signOut: mockSignOut,
    });

    render(
      <MemoryRouter initialEntries={["/auth/confirmado"]}>
        <EmailConfirmationRequiredModal />
      </MemoryRouter>
    );

    expect(screen.queryByText(/atualizamos nossas medidas de segurança/i)).not.toBeInTheDocument();
  });

  it("renders blocking security modal when user is unconfirmed on protected routes", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "user-1",
        email: "pendente@exemplo.com",
        email_confirmed_at: null,
      },
      signOut: mockSignOut,
    });

    render(
      <MemoryRouter initialEntries={["/espacopessoal"]}>
        <EmailConfirmationRequiredModal />
      </MemoryRouter>
    );

    expect(screen.getByText("Atualizamos nossas medidas de segurança")).toBeInTheDocument();
    expect(screen.getByText(/é indispensável confirmar a titularidade do e-mail cadastrado/i)).toBeInTheDocument();
    expect(screen.getByText("pendente@exemplo.com")).toBeInTheDocument();

    // Click confirm email
    const confirmBtn = screen.getByRole("button", { name: /confirmar meu e-mail/i });
    fireEvent.click(confirmBtn);

    expect(mockNavigate).toHaveBeenCalledWith(
      "/auth/confirmado?email=pendente%40exemplo.com&aguardando=true",
      { state: { email: "pendente@exemplo.com" } }
    );

    // Click sign out
    const signOutBtn = screen.getByRole("button", { name: /sair da conta/i });
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/auth", { replace: true });
    });
  });
});
