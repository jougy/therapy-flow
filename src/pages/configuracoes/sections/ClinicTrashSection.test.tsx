import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ClinicTrashSection,
  calculateNextSundayCountdown,
  createTrashToastAction,
  formatTrashDate,
  getTrashRoutePath,
  navigateToClinicTrash,
  type TrashItem,
} from "./ClinicTrashSection";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

vi.mock("@/components/tutorial/ComponentHelpButton", () => ({
  ComponentHelpButton: () => <button type="button">Ajuda</button>,
}));

const mockTrashItems: TrashItem[] = [
  {
    id: "session-1",
    entity_type: "sessions",
    title: "João Victor",
    subtitle: "Data: 18/09/2026 10:00 • Profissional: Dr. Roberto",
    deleted_at: "2026-09-18T10:00:00.000Z",
    deleted_by_name: "Dr. Roberto",
    expires_at: "2026-09-20T23:59:59.000Z",
  },
  {
    id: "session-2",
    entity_type: "sessions",
    title: "Ana Clara",
    subtitle: "Data: 17/09/2026 15:30",
    deleted_at: "2026-09-17T15:30:00.000Z",
    deleted_by_name: "Dra. Paula",
    expires_at: "2026-09-20T23:59:59.000Z",
  },
  {
    id: "patient-1",
    entity_type: "patients",
    title: "Carlos Eduardo Silva",
    subtitle: "CPF: 123.456.789-00 • Tel: 11999999999",
    deleted_at: "2026-09-16T14:00:00.000Z",
    deleted_by_name: "Dr. Roberto",
    expires_at: "2026-09-20T23:59:59.000Z",
  },
  {
    id: "form-1",
    entity_type: "forms",
    title: "Anamnese Postural Avançada",
    subtitle: "Modelo com 15 campos customizados",
    deleted_at: "2026-09-15T09:00:00.000Z",
    deleted_by_name: "Admin",
    expires_at: "2026-09-20T23:59:59.000Z",
  },
];

describe("ClinicTrashSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      clinicId: "clinic-1",
      can: (cap: string) => cap === "clinic_trash.manage",
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: mockTrashItems,
      error: null,
    } as unknown as ReturnType<typeof supabase.rpc>);
  });

  describe("Utility Functions & Navigation", () => {
    it("formats ISO date string correctly", () => {
      const formatted = formatTrashDate("2026-09-18T14:30:00.000Z");
      expect(formatted).toMatch(/18\/09\/2026 às \d{2}:\d{2}/);
    });

    it("returns dash for invalid or null date", () => {
      expect(formatTrashDate(null)).toBe("-");
      expect(formatTrashDate("invalid-date")).toBe("-");
    });

    it("calculates next sunday countdown correctly on Friday", () => {
      // 2026-09-18 is a Friday (day 5)
      const testFriday = new Date("2026-09-18T12:00:00.000Z");
      const { daysRemaining, nextSundayDateFormatted } = calculateNextSundayCountdown(testFriday);
      expect(daysRemaining).toBe(2);
      expect(nextSundayDateFormatted).toContain("20/09/2026 às 23:59");
    });

    it("calculates next sunday countdown correctly on Sunday midday", () => {
      // 2026-09-20 is Sunday (day 0) midday
      const testSunday = new Date("2026-09-20T12:00:00.000Z");
      const { daysRemaining } = calculateNextSundayCountdown(testSunday);
      expect(daysRemaining).toBe(0);
    });

    it("calculates next sunday countdown correctly on Monday", () => {
      // 2026-09-21 is Monday (day 1)
      const testMonday = new Date("2026-09-21T10:00:00.000Z");
      const { daysRemaining } = calculateNextSundayCountdown(testMonday);
      expect(daysRemaining).toBe(6);
    });

    it("resolves canonical trash route paths with or without clinicKey", () => {
      expect(getTrashRoutePath("clinica-teste")).toBe("/clinica/clinica-teste/configuracoes/lixeira");
      expect(getTrashRoutePath(null)).toBe("/configuracoes/lixeira");
      expect(getTrashRoutePath("")).toBe("/configuracoes/lixeira");
    });

    it("navigates using provided router navigate function", () => {
      const navigateMock = vi.fn();
      navigateToClinicTrash("minha-clinica", navigateMock);
      expect(navigateMock).toHaveBeenCalledWith("/clinica/minha-clinica/configuracoes/lixeira");
    });

    it("falls back to window.location when router navigate is not provided", () => {
      const assignMock = vi.fn();
      const originalAssign = window.location.assign;
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...window.location, assign: assignMock },
      });

      navigateToClinicTrash("clinica-xyz", null);
      expect(assignMock).toHaveBeenCalledWith("/clinica/clinica-xyz/configuracoes/lixeira");

      Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...window.location, assign: originalAssign },
      });
    });

    it("renders createTrashToastAction and handles click with router navigate", () => {
      const navigateMock = vi.fn();
      const actionElement = createTrashToastAction("clinica-123", navigateMock);
      render(<div>{actionElement}</div>);

      const button = screen.getByRole("button", { name: "Acessar a lixeira" });
      expect(button).toBeInTheDocument();

      fireEvent.click(button);
      expect(navigateMock).toHaveBeenCalledWith("/clinica/clinica-123/configuracoes/lixeira");
    });
  });

  describe("Component Rendering and Interaction", () => {
    it("renders trash header, countdown banner and tabs with item counts", async () => {
      render(<ClinicTrashSection />);

      expect(await screen.findByText("Lixeira da Clínica")).toBeInTheDocument();
      expect(screen.getByText(/Itens excluídos são mantidos nesta lixeira até o próximo domingo às 23:59/i)).toBeInTheDocument();

      // Atendimentos count = 2
      expect(screen.getByRole("tab", { name: /atendimentos/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /pacientes/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /formulários/i })).toBeInTheDocument();
    });

    it("displays items in the active sessions tab and filters by search", async () => {
      render(<ClinicTrashSection />);

      expect(await screen.findByText("João Victor")).toBeInTheDocument();
      expect(screen.getByText("Ana Clara")).toBeInTheDocument();

      // Search
      const searchInput = screen.getByPlaceholderText("Buscar na lixeira...");
      fireEvent.change(searchInput, { target: { value: "Ana" } });

      expect(screen.queryByText("João Victor")).not.toBeInTheDocument();
      expect(screen.getByText("Ana Clara")).toBeInTheDocument();
    });

    it("switches tabs and displays patients and forms", async () => {
      render(<ClinicTrashSection />);

      await screen.findByText("João Victor");

      // Switch to Pacientes tab
      const patientsTab = screen.getByRole("tab", { name: /pacientes/i });
      fireEvent.pointerDown(patientsTab);
      fireEvent.mouseDown(patientsTab);
      fireEvent.click(patientsTab);

      await waitFor(() => {
        expect(screen.getByText("Carlos Eduardo Silva")).toBeInTheDocument();
      });
      expect(screen.queryByText("João Victor")).not.toBeInTheDocument();

      // Switch to Formulários tab
      const formsTab = screen.getByRole("tab", { name: /formulários/i });
      fireEvent.pointerDown(formsTab);
      fireEvent.mouseDown(formsTab);
      fireEvent.click(formsTab);

      await waitFor(() => {
        expect(screen.getByText("Anamnese Postural Avançada")).toBeInTheDocument();
      });
    });

    it("restores a single item when clicking the restore button", async () => {
      render(<ClinicTrashSection />);

      await screen.findByText("João Victor");

      const restoreButtons = screen.getAllByRole("button", { name: /restaurar/i });
      fireEvent.click(restoreButtons[0]);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith("restore_entity_from_trash", {
          _entity_type: "sessions",
          _entity_ids: ["session-1"],
        });
      });

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Item restaurado com sucesso",
        })
      );
    });

    it("supports bulk selection and restore", async () => {
      render(<ClinicTrashSection />);

      await screen.findByText("João Victor");

      // Click select all
      const selectAllBtn = screen.getByLabelText(/selecionar todos/i);
      fireEvent.click(selectAllBtn);

      const bulkRestoreBtn = await screen.findByRole("button", { name: /restaurar selecionados/i });
      fireEvent.click(bulkRestoreBtn);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith("restore_entity_from_trash", {
          _entity_type: "sessions",
          _entity_ids: ["session-1", "session-2"],
        });
      });

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Itens restaurados com sucesso",
        })
      );
    });

    it("disables restoration when user lacks clinic_trash.manage permission", async () => {
      vi.mocked(useAuth).mockReturnValue({
        clinicId: "clinic-1",
        can: () => false,
      } as unknown as ReturnType<typeof useAuth>);

      render(<ClinicTrashSection />);

      await screen.findByText("João Victor");

      const restoreButtons = screen.getAllByRole("button", { name: /restaurar/i });
      expect(restoreButtons[0]).toBeDisabled();
    });

    it("handles restoration RPC error gracefully", async () => {
      vi.mocked(supabase.rpc).mockImplementation(((fn: string, args: unknown) => {
        if (fn === "get_clinic_trash_items") {
          return Promise.resolve({ data: mockTrashItems, error: null });
        }
        if (fn === "restore_entity_from_trash") {
          return Promise.resolve({ data: null, error: new Error("Falha no banco") });
        }
        return Promise.resolve({ data: null, error: null });
      }) as unknown as typeof supabase.rpc);

      render(<ClinicTrashSection />);

      await screen.findByText("João Victor");

      const restoreButtons = screen.getAllByRole("button", { name: /restaurar/i });
      fireEvent.click(restoreButtons[0]);

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Erro ao restaurar item",
            description: "Falha no banco",
            variant: "destructive",
          })
        );
      });
    });

    it("shows welcoming empty state when trash is empty", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [],
        error: null,
      } as unknown as ReturnType<typeof supabase.rpc>);

      render(<ClinicTrashSection />);

      expect(await screen.findByText("A lixeira está vazia")).toBeInTheDocument();
      expect(screen.getByText(/Nenhum atendimento aguardando exclusão definitiva/i)).toBeInTheDocument();
    });
  });
});
