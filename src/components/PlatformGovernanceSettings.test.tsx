import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformGovernanceSettings, PUNISHMENT_LABELS } from "@/components/PlatformGovernanceSettings";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("PlatformGovernanceSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          value: {
            max_actions: 80,
            time_window_minutes: 5,
            cooldown_minutes: 15,
            enabled_punishments: {
              sync_throttle: true,
              warning_modal: true,
              read_only_mode: true,
              revoke_print_export: true,
              temporary_suspension: true,
              permanent_ban: true,
            },
            default_durations_minutes: {
              sync_throttle: 15,
              warning_modal: 0,
              read_only_mode: 60,
              revoke_print_export: 1440,
              temporary_suspension: 60,
              permanent_ban: 0,
            },
          },
        },
        error: null,
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    } as any);
  });

  it("renders rate-limiting parameters correctly", async () => {
    render(<PlatformGovernanceSettings />);

    await waitFor(() => {
      expect(screen.getByText("Governança & Segurança Global")).toBeInTheDocument();
    });

    expect(screen.getByText("Parâmetros de Rate-Limiting por Usuário")).toBeInTheDocument();
    expect(screen.getByText("Limite de Ações (Ações)")).toBeInTheDocument();
    expect(screen.getByText("Janela de Medição (Minutos)")).toBeInTheDocument();
    expect(screen.getByText("Pausa de Cooldown (Minutos)")).toBeInTheDocument();
  });

  it("renders catalog with all 6 punishments", async () => {
    render(<PlatformGovernanceSettings />);

    await waitFor(() => {
      expect(screen.getByText("Catálogo de Punições Habilitadas na Plataforma")).toBeInTheDocument();
    });

    expect(screen.getByText("Pausa de Sincronização")).toBeInTheDocument();
    expect(screen.getByText("Advertência em Modal")).toBeInTheDocument();
    expect(screen.getByText("Modo Somente Leitura")).toBeInTheDocument();
    expect(screen.getByText("Bloqueio de Impressão e PDF")).toBeInTheDocument();
    expect(screen.getByText("Suspensão Temporária de Acesso")).toBeInTheDocument();
    expect(screen.getByText("Banimento Permanente de Conta")).toBeInTheDocument();

    expect(Object.keys(PUNISHMENT_LABELS)).toHaveLength(6);
  });

  it("saves global governance rules when save button is clicked", async () => {
    render(<PlatformGovernanceSettings />);

    await waitFor(() => {
      expect(screen.getByText("Salvar Regras Globais")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Salvar Regras Globais"));

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("governance_rules");
    });
  });
});
