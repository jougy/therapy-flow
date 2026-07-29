import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TermsUpdatePromptModal } from "@/components/TermsUpdatePromptModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe("TermsUpdatePromptModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-123", user_metadata: { language: "pt-BR" } } as never,
      profile: { terms_accepted_version: "old-version" } as never,
      operationalRole: "owner",
      isSuperAdmin: false,
    } as never);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              value: {
                publishedVersion: "v2026-07-26",
                user_br: { content: "# Termos Usuários BR", filename: "user_br.md", updatedAt: "2026-07-26" },
                owner_br: { content: "# Termos Owner BR", filename: "owner_br.md", updatedAt: "2026-07-26" },
              },
            },
            error: null,
          }),
        }),
      }),
    } as never);

    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null });
  });

  it("renders when user version is different from published version", async () => {
    render(<TermsUpdatePromptModal />);

    await waitFor(() => {
      expect(screen.getByText("Novos Termos de Uso e Consentimento")).toBeInTheDocument();
    });

    expect(screen.getByText("Revisar depois")).toBeInTheDocument();
    expect(screen.getByText("Aceitar e continuar")).toBeInTheDocument();
  });

  it("enables Aceitar e continuar button when checkbox is checked", async () => {
    render(<TermsUpdatePromptModal />);

    await waitFor(() => {
      expect(screen.getByText("Novos Termos de Uso e Consentimento")).toBeInTheDocument();
    });

    const checkbox = screen.getByRole("checkbox");
    const acceptBtn = screen.getByRole("button", { name: /aceitar e continuar/i });

    expect(acceptBtn).toBeDisabled();
    fireEvent.click(checkbox);
    expect(acceptBtn).not.toBeDisabled();
  });
});
