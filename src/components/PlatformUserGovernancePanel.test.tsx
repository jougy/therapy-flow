import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformUserGovernancePanel } from "@/components/PlatformUserGovernancePanel";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("PlatformUserGovernancePanel", () => {
  const userId = "fb266abe-87ad-4f19-a60a-07c0ccdc23e5";
  const userName = "Dra. Ana Silva";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === "get_user_active_governance") {
        return Promise.resolve({
          data: [],
          error: null,
        }) as unknown as ReturnType<typeof supabase.rpc>;
      }
      if (fn === "apply_user_punishment") {
        return Promise.resolve({ data: { success: true }, error: null }) as unknown as ReturnType<typeof supabase.rpc>;
      }
      return Promise.resolve({ data: null, error: null }) as unknown as ReturnType<typeof supabase.rpc>;
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof supabase.from>);
  });

  it("renders PlatformUserGovernancePanel with header and action buttons", async () => {
    render(<PlatformUserGovernancePanel userId={userId} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText("Governança & Punições da Conta")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Aplicar Punição Manual/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Limite VIP/i })).toBeInTheDocument();
    expect(screen.getByText("Status: Conta sem Restrições Ativas")).toBeInTheDocument();
  });

  it("opens manual punishment modal when button is clicked", async () => {
    render(<PlatformUserGovernancePanel userId={userId} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Aplicar Punição Manual/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Aplicar Punição Manual/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Aplicar Punição Manual" })).toBeInTheDocument();
    });

    expect(screen.getByText("Tipo de Punição")).toBeInTheDocument();
    expect(screen.getByText("Motivo Auditável")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmar Punição/i })).toBeInTheDocument();
  });

  it("opens VIP limit modal when button is clicked", async () => {
    render(<PlatformUserGovernancePanel userId={userId} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Limite VIP/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Limite VIP/i }));

    await waitFor(() => {
      expect(screen.getByText("Sobrescrever Limites de Rate-Limit (VIP)")).toBeInTheDocument();
    });

    expect(screen.getByText("Máximo de Ações Permitidas")).toBeInTheDocument();
    expect(screen.getByText("Janela de Tempo (Minutos)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar Sobrescrita/i })).toBeInTheDocument();
  });
});
