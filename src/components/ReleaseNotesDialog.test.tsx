import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReleaseNotesDialog from "@/components/ReleaseNotesDialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/runtime-debug", () => ({
  logRuntimeError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe("ReleaseNotesDialog", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "user-1",
      },
    } as ReturnType<typeof useAuth>);
  });

  it("shows pending release notes by category and acknowledges the latest version", async () => {
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({
        data: {
          latest_release_id: "release-2",
          latest_version: "alfa-26.06.08-1",
          releases: [
            {
              id: "release-2",
              items: [
                {
                  body: "Novo modal pos-login.",
                  category: "added",
                  id: "item-1",
                  title: "Notas por categoria",
                },
                {
                  body: "Evita avisos repetidos.",
                  category: "fixed",
                  id: "item-2",
                  title: "Confirmacao persistente",
                },
              ],
              published_at: "2026-06-08T12:00:00.000Z",
              summary: "Resumo da atualizacao",
              title: "Atualizacao",
              version: "alfa-26.06.08-1",
              version_order: 2026060801,
            },
          ],
          should_show: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { acknowledged: true },
        error: null,
      });

    render(<ReleaseNotesDialog />);

    await waitFor(() => expect(screen.getByText("Novidades da plataforma")).toBeInTheDocument());
    expect(screen.getByText("Notas por categoria")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reparado/i }));

    expect(screen.getByText("Confirmacao persistente")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /entendi/i }));

    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenLastCalledWith("acknowledge_current_user_release_notes", {
        _release_id: "release-2",
      })
    );
    await waitFor(() => expect(screen.queryByText("Novidades da plataforma")).not.toBeInTheDocument());
  });

  it("closes immediately even when acknowledge RPC fails (never traps the user)", async () => {
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({
        data: {
          latest_release_id: "release-2",
          latest_version: "beta-26.11.26-1",
          releases: [
            {
              id: "release-2",
              items: [
                {
                  body: "Nova funcionalidade.",
                  category: "added",
                  id: "item-1",
                  title: "Agendamento Atômico",
                },
              ],
              published_at: "2026-11-26T12:00:00.000Z",
              summary: "Resumo",
              title: "Atualizacao",
              version: "beta-26.11.26-1",
              version_order: 2026112601,
            },
          ],
          should_show: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'new row violates row-level security policy for table "user_release_note_states"' },
      });

    render(<ReleaseNotesDialog />);

    await waitFor(() => expect(screen.getByText("Novidades da plataforma")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /entendi/i }));

    await waitFor(() => expect(screen.queryByText("Novidades da plataforma")).not.toBeInTheDocument());
  });

  it("does not open on first access initialization", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        reason: "first_access_initialized",
        should_show: false,
      },
      error: null,
    });

    render(<ReleaseNotesDialog />);

    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("get_current_user_pending_release_notes"));
    expect(screen.queryByText("Novidades da plataforma")).not.toBeInTheDocument();
  });
});
