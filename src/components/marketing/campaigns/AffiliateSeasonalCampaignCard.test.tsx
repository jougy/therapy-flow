import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  AffiliateSeasonalCampaignCard,
  calculateCountdown,
  formatCampaignBonus,
  DEFAULT_CAMPAIGN_CONFIG,
} from "./AffiliateSeasonalCampaignCard";

// Mock do Supabase
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

describe("AffiliateSeasonalCampaignCard & Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("calculateCountdown", () => {
    it("returns zero and isExpired=true when target date is in the past", () => {
      const pastDate = new Date(Date.now() - 5000);
      const res = calculateCountdown(pastDate);

      expect(res.isExpired).toBe(true);
      expect(res.days).toBe(0);
      expect(res.hours).toBe(0);
      expect(res.minutes).toBe(0);
      expect(res.seconds).toBe(0);
      expect(res.formatted).toEqual({
        days: "00",
        hours: "00",
        minutes: "00",
        seconds: "00",
      });
    });

    it("correctly breaks down remaining time for a future date", () => {
      const now = Date.now();
      // 2 days + 5 hours + 10 minutes + 20 seconds
      const target = now + (2 * 86400 + 5 * 3600 + 10 * 60 + 20) * 1000 + 500;
      const res = calculateCountdown(target);

      expect(res.isExpired).toBe(false);
      expect(res.days).toBe(2);
      expect(res.hours).toBe(5);
      expect(res.minutes).toBe(10);
      expect(res.seconds).toBe(20);
      expect(res.formatted.days).toBe("02");
      expect(res.formatted.hours).toBe("05");
      expect(res.formatted.minutes).toBe("10");
      expect(res.formatted.seconds).toBe("20");
    });
  });

  describe("formatCampaignBonus", () => {
    it("formats cents to BRL standard correctly", () => {
      expect(formatCampaignBonus(30000)).toMatch(/R\$\s*300,00/);
      expect(formatCampaignBonus(50000)).toMatch(/R\$\s*500,00/);
      expect(formatCampaignBonus(0)).toMatch(/R\$\s*0,00/);
    });
  });

  describe("AffiliateSeasonalCampaignCard Component", () => {
    it("renders default campaign configuration and elements with 0 initial referrals", () => {
      render(<AffiliateSeasonalCampaignCard />);

      expect(screen.getByText(DEFAULT_CAMPAIGN_CONFIG.title)).toBeInTheDocument();
      expect(screen.getByText(DEFAULT_CAMPAIGN_CONFIG.description)).toBeInTheDocument();
      expect(screen.getByTestId("campaign-badge")).toHaveTextContent("Desafio Sazonal Ativo");
      expect(screen.getByTestId("reward-badge")).toHaveTextContent("+ R$ 300,00 no Asaas");
      expect(screen.getByTestId("campaign-progress-label")).toHaveTextContent(
        "0 de 3 clínicas indicadas (0%)"
      );
      expect(
        screen.getByText(
          "Nenhuma indicação registrada nesta campanha ainda. Compartilhe seu link para dar a largada no sprint!"
        )
      ).toBeInTheDocument();
      expect(screen.getByTestId("countdown-days")).toBeInTheDocument();
      expect(screen.getByTestId("countdown-hours")).toBeInTheDocument();
      expect(screen.getByTestId("countdown-minutes")).toBeInTheDocument();
      expect(screen.getByTestId("countdown-seconds")).toBeInTheDocument();
    });

    it("renders custom campaign configuration and calculates progress correctly", () => {
      render(
        <AffiliateSeasonalCampaignCard
          title="🚀 Sprint de Expansão Nacional"
          description="Indique 5 clínicas e receba R$ 500,00 de bônus imediato."
          targetCount={5}
          currentCount={2}
          bonusValueCents={50000}
        />
      );

      expect(screen.getByText("🚀 Sprint de Expansão Nacional")).toBeInTheDocument();
      expect(screen.getByText("Indique 5 clínicas e receba R$ 500,00 de bônus imediato.")).toBeInTheDocument();
      expect(screen.getByTestId("campaign-progress-label")).toHaveTextContent(
        "2 de 5 clínicas indicadas (40%)"
      );
      expect(screen.getByTestId("reward-badge")).toHaveTextContent("+ R$ 500,00 no Asaas");
      expect(screen.getByText(/Faltam apenas/i)).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("displays motivational message when currentCount is explicitly zero", () => {
      render(
        <AffiliateSeasonalCampaignCard
          targetCount={5}
          currentCount={0}
        />
      );

      expect(screen.getByTestId("campaign-progress-label")).toHaveTextContent(
        "0 de 5 clínicas indicadas (0%)"
      );
      expect(
        screen.getByText(
          "Nenhuma indicação registrada nesta campanha ainda. Compartilhe seu link para dar a largada no sprint!"
        )
      ).toBeInTheDocument();
      expect(screen.queryByText(/Faltam apenas/i)).not.toBeInTheDocument();
    });

    it("displays goal completed celebration state when currentCount >= targetCount", () => {
      render(
        <AffiliateSeasonalCampaignCard
          targetCount={3}
          currentCount={4}
          bonusValueCents={30000}
        />
      );

      expect(screen.getByTestId("campaign-progress-label")).toHaveTextContent(
        "4 de 3 clínicas indicadas (100%)"
      );
      expect(screen.getByText(/Meta atingida!/i)).toBeInTheDocument();
    });

    it("handles copying campaign link to clipboard and calls onCopyLink", async () => {
      const handleCopyLink = vi.fn();
      render(
        <AffiliateSeasonalCampaignCard
          couponCode="CLINICA10"
          referralSlug="dr-silva"
          onCopyLink={handleCopyLink}
        />
      );

      const copyBtn = screen.getByTestId("campaign-copy-btn");
      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "https://pluri.health/?cupom=CLINICA10&ref=dr-silva&utm_source=campaign&utm_medium=affiliate&utm_campaign=sprint-bonus"
      );
      expect(handleCopyLink).toHaveBeenCalledWith(
        "https://pluri.health/?cupom=CLINICA10&ref=dr-silva&utm_source=campaign&utm_medium=affiliate&utm_campaign=sprint-bonus"
      );
    });

    it("triggers WhatsApp share with pre-filled message and calls onShareWhatsApp", async () => {
      const handleShareWhatsApp = vi.fn();
      render(
        <AffiliateSeasonalCampaignCard
          couponCode="FISIO30"
          referralSlug="dra-lucia"
          onShareWhatsApp={handleShareWhatsApp}
        />
      );

      const waBtn = screen.getByTestId("campaign-whatsapp-btn");
      await act(async () => {
        fireEvent.click(waBtn);
      });

      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining("https://api.whatsapp.com/send?text="),
        "_blank",
        "noopener,noreferrer"
      );
      expect(handleShareWhatsApp).toHaveBeenCalled();
    });

    it("opens rules dialog when clicking 'Regras do Desafio' or triggers custom onViewDetails", async () => {
      render(<AffiliateSeasonalCampaignCard />);

      const detailsBtn = screen.getByTestId("campaign-details-btn");
      await act(async () => {
        fireEvent.click(detailsBtn);
      });

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Regras do/i })).toBeInTheDocument();
      expect(screen.getByText(/Meta e Premiação/i)).toBeInTheDocument();
      expect(screen.getByText(/Bônus Cumulativo/i)).toBeInTheDocument();
      expect(screen.getByText(/Liquidação Direta no Asaas/i)).toBeInTheDocument();
      expect(screen.getByText(/Verificação & Anti-Fraude/i)).toBeInTheDocument();

      const closeBtn = screen.getByRole("button", { name: /Entendi as Regras/i });
      await act(async () => {
        fireEvent.click(closeBtn);
      });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("calls custom onViewDetails callback when provided instead of default modal", async () => {
      const handleViewDetails = vi.fn();
      render(<AffiliateSeasonalCampaignCard onViewDetails={handleViewDetails} />);

      const detailsBtn = screen.getByTestId("campaign-details-btn");
      await act(async () => {
        fireEvent.click(detailsBtn);
      });

      expect(handleViewDetails).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("displays expired badges and notice when endDate is past", () => {
      const pastDate = new Date(Date.now() - 60000);
      render(<AffiliateSeasonalCampaignCard endDate={pastDate} />);

      expect(screen.getByText("Campanha Encerrada")).toBeInTheDocument();
      expect(screen.getByText("Prazo esgotado")).toBeInTheDocument();
      expect(screen.getByTestId("countdown-days")).toHaveTextContent("00");
      expect(screen.getByTestId("countdown-hours")).toHaveTextContent("00");
      expect(screen.getByTestId("countdown-minutes")).toHaveTextContent("00");
      expect(screen.getByTestId("countdown-seconds")).toHaveTextContent("00");
    });

    it("renders nothing when campaign is inactive and canEdit is false", () => {
      const { container } = render(
        <AffiliateSeasonalCampaignCard
          config={{ ...DEFAULT_CAMPAIGN_CONFIG, isActive: false }}
          canEdit={false}
        />
      );
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId("affiliate-seasonal-campaign-card")).not.toBeInTheDocument();
    });

    it("renders inactive prompt card with activation button when campaign is inactive and canEdit is true", () => {
      render(
        <AffiliateSeasonalCampaignCard
          config={{ ...DEFAULT_CAMPAIGN_CONFIG, isActive: false }}
          canEdit={true}
        />
      );

      expect(screen.getByTestId("affiliate-seasonal-campaign-inactive")).toBeInTheDocument();
      expect(screen.getByText("Nenhum Desafio Sazonal Ativo no Momento")).toBeInTheDocument();
      expect(screen.getByTestId("activate-campaign-btn")).toBeInTheDocument();
    });

    it("renders configure button when canEdit is true and opens editor modal", async () => {
      render(
        <AffiliateSeasonalCampaignCard
          canEdit={true}
        />
      );

      const configBtn = screen.getByTestId("campaign-configure-btn");
      expect(configBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(configBtn);
      });

      expect(screen.getByTestId("platform-campaign-editor-modal")).toBeInTheDocument();
    });

    it("renders dynamic rules in the modal dialog from config.rulesList", async () => {
      render(
        <AffiliateSeasonalCampaignCard
          config={{
            ...DEFAULT_CAMPAIGN_CONFIG,
            rulesList: [
              "Regra Dinâmica Alfa: Indique parceiros",
              "Regra Dinâmica Beta: Receba bônus",
            ],
          }}
        />
      );

      const detailsBtn = screen.getByTestId("campaign-details-btn");
      await act(async () => {
        fireEvent.click(detailsBtn);
      });

      expect(screen.getByText(/Regra Dinâmica Alfa/i)).toBeInTheDocument();
      expect(screen.getByText(/Regra Dinâmica Beta/i)).toBeInTheDocument();
    });
  });
});
