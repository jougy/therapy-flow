import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  PlatformCampaignEditorModal,
  isoToDatetimeLocal,
  datetimeLocalToIso,
} from "./PlatformCampaignEditorModal";
import {
  DEFAULT_CAMPAIGN_CONFIG,
  DEFAULT_CAMPAIGN_RULES,
  AffiliateCampaignConfig,
} from "./campaignTypes";

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    })),
    removeChannel: vi.fn().mockResolvedValue("ok"),
  },
}));

// Mock Toast
const mockToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe("PlatformCampaignEditorModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Helpers de data", () => {
    it("isoToDatetimeLocal converts ISO string to local input format correctly", () => {
      const iso = "2026-11-30T23:59:59.000Z";
      const local = isoToDatetimeLocal(iso);
      expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it("isoToDatetimeLocal handles invalid date string safely", () => {
      expect(isoToDatetimeLocal("invalid-date")).toBe("");
    });

    it("datetimeLocalToIso converts local string to valid ISO string", () => {
      const dt = "2026-11-15T14:30";
      const iso = datetimeLocalToIso(dt);
      expect(new Date(iso).getTime()).not.toBeNaN();
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("Modal Rendering & Interaction", () => {
    const mockOnOpenChange = vi.fn();
    const mockOnSave = vi.fn().mockResolvedValue({ success: true });

    it("renders modal with initial configuration fields when open", () => {
      render(
        <PlatformCampaignEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          config={DEFAULT_CAMPAIGN_CONFIG}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByTestId("platform-campaign-editor-modal")).toBeInTheDocument();
      expect(screen.getByText("Editor Soberano de Metas & Campanhas")).toBeInTheDocument();
      expect(screen.getByTestId("campaign-active-switch")).toBeInTheDocument();
      expect(screen.getByTestId("campaign-title-input")).toHaveValue(DEFAULT_CAMPAIGN_CONFIG.title);
      expect(screen.getByTestId("campaign-badge-input")).toHaveValue(DEFAULT_CAMPAIGN_CONFIG.badgeLabel);
      expect(screen.getByTestId("campaign-desc-input")).toHaveValue(DEFAULT_CAMPAIGN_CONFIG.description);
      expect(screen.getByTestId("campaign-target-input")).toHaveValue(DEFAULT_CAMPAIGN_CONFIG.targetCount);
      expect(screen.getByTestId("campaign-bonus-input")).toHaveValue(
        String(DEFAULT_CAMPAIGN_CONFIG.bonusValueCents / 100)
      );
      expect(screen.getByTestId("campaign-enddate-input")).toBeInTheDocument();
      expect(screen.getByTestId("campaign-rules-list")).toBeInTheDocument();
      expect(screen.getByTestId("campaign-save-btn")).toBeInTheDocument();
      expect(screen.getByTestId("campaign-restore-defaults-btn")).toBeInTheDocument();
    });

    it("allows toggling campaign active switch", () => {
      render(
        <PlatformCampaignEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          config={{ ...DEFAULT_CAMPAIGN_CONFIG, isActive: true }}
          onSave={mockOnSave}
        />
      );

      const toggle = screen.getByTestId("campaign-active-switch");
      expect(toggle).toHaveAttribute("aria-checked", "true");

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-checked", "false");
    });

    it("allows editing campaign title, target count and bonus value", () => {
      render(
        <PlatformCampaignEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          config={DEFAULT_CAMPAIGN_CONFIG}
          onSave={mockOnSave}
        />
      );

      const titleInput = screen.getByTestId("campaign-title-input");
      fireEvent.change(titleInput, { target: { value: "Sprint de Verão 2026" } });
      expect(titleInput).toHaveValue("Sprint de Verão 2026");

      const targetInput = screen.getByTestId("campaign-target-input");
      fireEvent.change(targetInput, { target: { value: "5" } });
      expect(targetInput).toHaveValue(5);

      const bonusInput = screen.getByTestId("campaign-bonus-input");
      fireEvent.change(bonusInput, { target: { value: "450" } });
      expect(bonusInput).toHaveValue("450");
      expect(screen.getByText(/R\$\s*450,00/)).toBeInTheDocument();
    });

    it("allows adding, editing and removing rules dynamically", async () => {
      render(
        <PlatformCampaignEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          config={{
            ...DEFAULT_CAMPAIGN_CONFIG,
            rulesList: ["Regra 1 inicial", "Regra 2 inicial"],
          }}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByDisplayValue("Regra 1 inicial")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Regra 2 inicial")).toBeInTheDocument();

      // Adiciona nova regra
      const addBtn = screen.getByTestId("campaign-add-rule-btn");
      fireEvent.click(addBtn);

      const ruleInput2 = screen.getByTestId("campaign-rule-input-2");
      expect(ruleInput2).toBeInTheDocument();
      fireEvent.change(ruleInput2, { target: { value: "Regra 3 adicionada" } });
      expect(ruleInput2).toHaveValue("Regra 3 adicionada");

      // Remove primeira regra
      const removeBtn0 = screen.getByTestId("campaign-remove-rule-btn-0");
      fireEvent.click(removeBtn0);

      expect(screen.queryByDisplayValue("Regra 1 inicial")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("Regra 2 inicial")).toBeInTheDocument();
    });

    it("restores default configuration when clicking 'Restaurar Padrões'", () => {
      render(
        <PlatformCampaignEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          config={{
            isActive: false,
            title: "Título customizado",
            description: "Descrição customizada",
            targetCount: 10,
            bonusValueCents: 90000,
            endDate: "2027-01-01T00:00:00Z",
            rulesList: ["Regra customizada"],
            badgeLabel: "Badge custom",
          }}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByTestId("campaign-title-input")).toHaveValue("Título customizado");

      const restoreBtn = screen.getByTestId("campaign-restore-defaults-btn");
      fireEvent.click(restoreBtn);

      expect(screen.getByTestId("campaign-title-input")).toHaveValue(DEFAULT_CAMPAIGN_CONFIG.title);
      expect(screen.getByTestId("campaign-target-input")).toHaveValue(DEFAULT_CAMPAIGN_CONFIG.targetCount);
      expect(screen.getByTestId("campaign-bonus-input")).toHaveValue(
        String(DEFAULT_CAMPAIGN_CONFIG.bonusValueCents / 100)
      );
    });

    it("submits valid form data and calls onSave and onOpenChange(false)", async () => {
      render(
        <PlatformCampaignEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          config={DEFAULT_CAMPAIGN_CONFIG}
          onSave={mockOnSave}
        />
      );

      const titleInput = screen.getByTestId("campaign-title-input");
      fireEvent.change(titleInput, { target: { value: "Novo Sprint Especial" } });

      const targetInput = screen.getByTestId("campaign-target-input");
      fireEvent.change(targetInput, { target: { value: "4" } });

      const bonusInput = screen.getByTestId("campaign-bonus-input");
      fireEvent.change(bonusInput, { target: { value: "400" } });

      const saveBtn = screen.getByTestId("campaign-save-btn");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      const savedPayload = mockOnSave.mock.calls[0][0] as AffiliateCampaignConfig;
      expect(savedPayload.title).toBe("Novo Sprint Especial");
      expect(savedPayload.targetCount).toBe(4);
      expect(savedPayload.bonusValueCents).toBe(40000);
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it("displays validation error when required title is empty", async () => {
      render(
        <PlatformCampaignEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          config={DEFAULT_CAMPAIGN_CONFIG}
          onSave={mockOnSave}
        />
      );

      const titleInput = screen.getByTestId("campaign-title-input");
      fireEvent.change(titleInput, { target: { value: "   " } });

      const saveBtn = screen.getByTestId("campaign-save-btn");
      fireEvent.click(saveBtn);

      expect(screen.getByRole("alert")).toHaveTextContent("O título da campanha é obrigatório.");
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });
});
