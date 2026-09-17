import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformReauthModal } from "./PlatformReauthModal";
import { supabase } from "@/integrations/supabase/client";

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      setSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      mfa: {
        listFactors: vi.fn(),
        challengeAndVerify: vi.fn(),
      },
    },
  },
}));

describe("PlatformReauthModal - Modal de Reautenticação 2FA (Ente Auth)", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    pendingChanges: [
      "Tipo de plano: Plano Solo ➔ Plano com Equipe (Clínica)",
      "Dias de assinatura: +30 dia(s)",
    ],
    reason: "Atualização solicitada formalmente pelo suporte",
    actionLabel: "Editar acesso da clínica",
    isDestructive: false,
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.mfa.listFactors).mockResolvedValue({
      data: {
        totp: [
          {
            id: "factor-totp-123",
            friendly_name: "Ente Auth Master",
            factor_type: "totp",
            status: "verified",
          },
        ],
      } as any,
      error: null,
    });
    vi.mocked(supabase.auth.mfa.challengeAndVerify).mockResolvedValue({
      data: { message: "ok" } as any,
      error: null,
    });
  });

  it("renderiza o modal aberto com título de segurança, alterações pendentes e motivo", () => {
    render(<PlatformReauthModal {...defaultProps} />);

    expect(screen.getByText("Reautenticação 2FA Requerida")).toBeInTheDocument();
    expect(screen.getByText(/Confirme com seu código do Ente Auth/i)).toBeInTheDocument();
    expect(screen.getByText("Alterações que serão aplicadas:")).toBeInTheDocument();
    expect(screen.getByText("Tipo de plano: Plano Solo ➔ Plano com Equipe (Clínica)")).toBeInTheDocument();
    expect(screen.getByText("Dias de assinatura: +30 dia(s)")).toBeInTheDocument();
    expect(screen.getByText(/Atualização solicitada formalmente pelo suporte/i)).toBeInTheDocument();
    expect(screen.getByTestId("platform-reauth-input")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar e aplicar alterações" })).toBeDisabled();
  });

  it("renderiza a ação quando não há pendingChanges", () => {
    render(
      <PlatformReauthModal
        {...defaultProps}
        pendingChanges={[]}
        actionLabel="Criar subconta"
      />
    );

    expect(screen.getByText("Ação a executar:")).toBeInTheDocument();
    expect(screen.getByText("Criar subconta")).toBeInTheDocument();
  });

  it("permite digitar o código 2FA numérico de 6 dígitos e habilita o botão de confirmação", () => {
    render(<PlatformReauthModal {...defaultProps} />);

    const input = screen.getByTestId("platform-reauth-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "123456" } });

    expect(input.value).toBe("123456");
    expect(screen.getByRole("button", { name: "Confirmar e aplicar alterações" })).toBeEnabled();
  });

  it("filtra caracteres não numéricos e limita a 6 dígitos", () => {
    render(<PlatformReauthModal {...defaultProps} />);

    const input = screen.getByTestId("platform-reauth-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc 12-34 56 78 xyz" } });

    expect(input.value).toBe("123456");
  });

  it("valida código com supabase.auth.mfa.challengeAndVerify e chama onConfirm se válido", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <PlatformReauthModal
        {...defaultProps}
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />
    );

    const input = screen.getByTestId("platform-reauth-input");
    fireEvent.change(input, { target: { value: "654321" } });

    const confirmButton = screen.getByRole("button", { name: "Confirmar e aplicar alterações" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(supabase.auth.mfa.listFactors).toHaveBeenCalled();
      expect(supabase.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({
        factorId: "factor-totp-123",
        code: "654321",
      });
      expect(onConfirm).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("exibe mensagem de erro e não fecha o modal se a validação MFA falhar", async () => {
    vi.mocked(supabase.auth.mfa.challengeAndVerify).mockResolvedValue({
      data: null as any,
      error: { message: "Código inválido", name: "AuthApiError", status: 400 } as any,
    });

    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <PlatformReauthModal
        {...defaultProps}
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />
    );

    const input = screen.getByTestId("platform-reauth-input");
    fireEvent.change(input, { target: { value: "000111" } });

    const confirmButton = screen.getByRole("button", { name: "Confirmar e aplicar alterações" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Código MFA inválido ou expirado/i)).toBeInTheDocument();
      expect(onConfirm).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });

  it("exibe erro amigável se nenhum fator TOTP verificado for encontrado", async () => {
    vi.mocked(supabase.auth.mfa.listFactors).mockResolvedValue({
      data: { totp: [] } as any,
      error: null,
    });

    const onConfirm = vi.fn();

    render(<PlatformReauthModal {...defaultProps} onConfirm={onConfirm} />);

    const input = screen.getByTestId("platform-reauth-input");
    fireEvent.change(input, { target: { value: "112233" } });

    const confirmButton = screen.getByRole("button", { name: "Confirmar e aplicar alterações" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(
        screen.getByText(/Nenhum segundo fator \(2FA\/MFA\) verificado encontrado na sua conta master/i)
      ).toBeInTheDocument();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  it("fecha o modal ao clicar em Cancelar", () => {
    const onOpenChange = vi.fn();
    render(<PlatformReauthModal {...defaultProps} onOpenChange={onOpenChange} />);

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    fireEvent.click(cancelBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("mantém o modal aberto e exibe erro amigável se onConfirm subsequente falhar", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("Falha no servidor de backend"));
    const onOpenChange = vi.fn();

    render(
      <PlatformReauthModal
        {...defaultProps}
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />
    );

    const input = screen.getByTestId("platform-reauth-input");
    fireEvent.change(input, { target: { value: "123456" } });

    const confirmButton = screen.getByRole("button", { name: "Confirmar e aplicar alterações" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled();
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Falha no servidor de backend")).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });

  it("ordena fatores pelo mais recente e sincroniza sessão com setSession ao validar", async () => {
    const mockSession = { access_token: "aal2-jwt-token", refresh_token: "refresh-123" };
    vi.mocked(supabase.auth.mfa.listFactors).mockResolvedValue({
      data: {
        totp: [
          {
            id: "factor-old",
            friendly_name: "Ente Antigo",
            factor_type: "totp",
            status: "verified",
            created_at: "2026-01-01T10:00:00.000Z",
          },
          {
            id: "factor-newest",
            friendly_name: "Ente Novo",
            factor_type: "totp",
            status: "verified",
            created_at: "2026-08-01T10:00:00.000Z",
          },
        ],
      } as any,
      error: null,
    });
    vi.mocked(supabase.auth.mfa.challengeAndVerify).mockResolvedValue({
      data: { session: mockSession } as any,
      error: null,
    });

    const onConfirm = vi.fn();
    render(<PlatformReauthModal {...defaultProps} onConfirm={onConfirm} />);

    const input = screen.getByTestId("platform-reauth-input");
    fireEvent.change(input, { target: { value: "789123" } });

    const confirmButton = screen.getByRole("button", { name: "Confirmar e aplicar alterações" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      // Garante que tentou primeiro o fator mais recente
      expect(supabase.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({
        factorId: "factor-newest",
        code: "789123",
      });
      // Sincroniza sessão imediatamente
      expect(supabase.auth.setSession).toHaveBeenCalledWith(mockSession);
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  it("tenta o próximo fator TOTP se o mais recente falhar com código inválido", async () => {
    vi.mocked(supabase.auth.mfa.listFactors).mockResolvedValue({
      data: {
        totp: [
          {
            id: "factor-old",
            friendly_name: "Ente Antigo",
            factor_type: "totp",
            status: "verified",
            created_at: "2026-01-01T10:00:00.000Z",
          },
          {
            id: "factor-newest",
            friendly_name: "Ente Novo",
            factor_type: "totp",
            status: "verified",
            created_at: "2026-08-01T10:00:00.000Z",
          },
        ],
      } as any,
      error: null,
    });

    vi.mocked(supabase.auth.mfa.challengeAndVerify)
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Invalid TOTP code", name: "AuthApiError", status: 400 } as any,
      })
      .mockResolvedValueOnce({
        data: { session: { access_token: "second-factor-success" } } as any,
        error: null,
      });

    const onConfirm = vi.fn();
    render(<PlatformReauthModal {...defaultProps} onConfirm={onConfirm} />);

    const input = screen.getByTestId("platform-reauth-input");
    fireEvent.change(input, { target: { value: "654321" } });

    const confirmButton = screen.getByRole("button", { name: "Confirmar e aplicar alterações" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(supabase.auth.mfa.challengeAndVerify).toHaveBeenNthCalledWith(1, {
        factorId: "factor-newest",
        code: "654321",
      });
      expect(supabase.auth.mfa.challengeAndVerify).toHaveBeenNthCalledWith(2, {
        factorId: "factor-old",
        code: "654321",
      });
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  it("possui classes de responsividade mobile e scroll adequadas para telas pequenas", () => {
    render(<PlatformReauthModal {...defaultProps} />);

    const modal = screen.getByTestId("platform-reauth-modal");
    expect(modal.className).toContain("max-h-[90vh]");
    expect(modal.className).toContain("overflow-y-auto");
    expect(modal.className).toContain("overscroll-contain");
  });
});
