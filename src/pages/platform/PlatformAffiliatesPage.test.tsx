import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PlatformAffiliatesPage } from "./PlatformAffiliatesPage";
import { supabase } from "@/integrations/supabase/client";

vi.mock("./affiliates/AffiliatesCrmTab", () => ({
  AffiliatesCrmTab: () => <div data-testid="affiliates-crm-tab">CRM & Relações Tab</div>,
}));

vi.mock("./affiliates/AffiliatesStatsTab", () => ({
  AffiliatesStatsTab: () => <div data-testid="affiliates-stats-tab">Estatísticas & Desempenho Tab</div>,
}));

const mockToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const TabsContext = React.createContext<{
  activeValue?: string;
  onValueChange?: (v: string) => void;
}>({});

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, value, onValueChange, ...props }: any) => (
    <TabsContext.Provider value={{ activeValue: value, onValueChange }}>
      <div {...props}>{children}</div>
    </TabsContext.Provider>
  ),
  TabsList: ({ children, ...props }: any) => (
    <div role="tablist" {...props}>
      {children}
    </div>
  ),
  TabsTrigger: ({ value, children, ...props }: any) => {
    const { activeValue, onValueChange } = React.useContext(TabsContext);
    return (
      <button
        role="tab"
        type="button"
        aria-selected={value === activeValue}
        onClick={() => onValueChange?.(value)}
        {...props}
      >
        {children}
      </button>
    );
  },
  TabsContent: ({ value, children, ...props }: any) => {
    const { activeValue } = React.useContext(TabsContext);
    if (value !== activeValue) return null;
    return (
      <div role="tabpanel" {...props}>
        {children}
      </div>
    );
  },
}));

describe("PlatformAffiliatesPage", () => {
  const mockAffiliates = [
    {
      id: "aff-1",
      coupon_code: "MARIANA30",
      referral_slug: "dra-mariana",
      tier: "gold",
      status: "active",
      active_referrals_count: 15,
      total_sales_count: 42,
      lifetime_commission_cents: 350000,
      first_month_commission_percent: 40,
      recurring_commission_percent: 16,
      profile: {
        id: "usr-1",
        full_name: "Dra. Mariana Silva",
        email: "mariana@exemplo.com",
        cpf: "111.222.333-44",
      },
    },
    {
      id: "aff-2",
      coupon_code: "CARLOS30",
      referral_slug: "carlos-fisio",
      tier: "bronze",
      status: "active",
      active_referrals_count: 2,
      total_sales_count: 5,
      lifetime_commission_cents: 25000,
      first_month_commission_percent: 30,
      recurring_commission_percent: 10,
      profile: {
        id: "usr-2",
        full_name: "Dr. Carlos Santos",
        email: "carlos@exemplo.com",
        cpf: "555.666.777-88",
      },
    },
  ];

  let upsertMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "affiliates") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockAffiliates,
              error: null,
            }),
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockAffiliates[0],
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        } as any;
      }

      if (table === "governance_rules") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
          upsert: upsertMock,
        } as any;
      }

      if (table === "affiliate_invitations") {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any;
    });
  });

  it("renders page header and all 4 tabs", async () => {
    render(<PlatformAffiliatesPage />);

    expect(screen.getByRole("heading", { name: /Afiliados & Parceiros/i })).toBeInTheDocument();
    expect(screen.getByTestId("tab-overview")).toBeInTheDocument();
    expect(screen.getByTestId("tab-stats")).toBeInTheDocument();
    expect(screen.getByTestId("tab-crm")).toBeInTheDocument();
    expect(screen.getByTestId("tab-tiers")).toBeInTheDocument();
  });

  it("switches to CRM tab and renders AffiliatesCrmTab", async () => {
    render(<PlatformAffiliatesPage />);

    const crmTab = screen.getByTestId("tab-crm");
    fireEvent.click(crmTab);

    await waitFor(() => {
      expect(screen.getByTestId("affiliates-crm-tab")).toBeInTheDocument();
    });
  });

  it("switches to stats tab and renders AffiliatesStatsTab", async () => {
    render(<PlatformAffiliatesPage />);

    const statsTab = screen.getByTestId("tab-stats");
    fireEvent.click(statsTab);

    await waitFor(() => {
      expect(screen.getByTestId("affiliates-stats-tab")).toBeInTheDocument();
    });
  });

  it("renders overview metrics and affiliates directory list", async () => {
    render(<PlatformAffiliatesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("affiliate-seasonal-campaign-card")).toBeInTheDocument();
      expect(screen.getByText("Total de Parceiros")).toBeInTheDocument();
      expect(screen.getByText("MARIANA30")).toBeInTheDocument();
      expect(screen.getByText("Dra. Mariana Silva")).toBeInTheDocument();
      expect(screen.getByText("CARLOS30")).toBeInTheDocument();
      expect(screen.getByText("Dr. Carlos Santos")).toBeInTheDocument();
    });
  });

  it("switches to tiers editor tab and renders all 8 canonical tiers", async () => {
    render(<PlatformAffiliatesPage />);

    const tiersTab = screen.getByTestId("tab-tiers");
    fireEvent.click(tiersTab);

    await waitFor(() => {
      expect(screen.getByText("Configuração dos 8 Tiers Oficiais")).toBeInTheDocument();
      expect(screen.getByTestId("tier-card-bronze")).toBeInTheDocument();
      expect(screen.getByTestId("tier-card-silver")).toBeInTheDocument();
      expect(screen.getByTestId("tier-card-gold")).toBeInTheDocument();
      expect(screen.getByTestId("tier-card-sapphire")).toBeInTheDocument();
      expect(screen.getByTestId("tier-card-ruby")).toBeInTheDocument();
      expect(screen.getByTestId("tier-card-emerald")).toBeInTheDocument();
      expect(screen.getByTestId("tier-card-diamond")).toBeInTheDocument();
      expect(screen.getByTestId("tier-card-legendary")).toBeInTheDocument();
    });
  });

  it("allows modifying tier commissions and saving to governance_rules", async () => {
    render(<PlatformAffiliatesPage />);

    fireEvent.click(screen.getByTestId("tab-tiers"));

    await waitFor(() => {
      expect(screen.getByTestId("tier-card-bronze")).toBeInTheDocument();
    });

    const bronzeCard = screen.getByTestId("tier-card-bronze");
    const inputs = bronzeCard.querySelectorAll("input[type='number']");
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    // Alterar comissão de 1º mês do Bronze
    fireEvent.change(inputs[0], { target: { value: "32" } });

    const saveBtn = screen.getByTestId("save-tiers-btn");
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "affiliate_tiers_config",
          value: expect.objectContaining({
            tiers: expect.any(Array),
          }),
        })
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Tiers Atualizados com Sucesso!",
        })
      );
    });
  });

  it("allows restoring default tiers", async () => {
    render(<PlatformAffiliatesPage />);

    fireEvent.click(screen.getByTestId("tab-tiers"));

    await waitFor(() => {
      expect(screen.getByText("Restaurar Padrões")).toBeInTheDocument();
    });

    const restoreBtn = screen.getByText("Restaurar Padrões");
    fireEvent.click(restoreBtn);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Padrões Oficiais Restaurados",
      })
    );
  });

  it("opens general management modal from overview tab", async () => {
    render(<PlatformAffiliatesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("open-general-management-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("open-general-management-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("platform-affiliate-management-modal")).toBeInTheDocument();
    });
  });

  it("opens invite partner flow from overview tab", async () => {
    render(<PlatformAffiliatesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("open-invite-affiliate-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("open-invite-affiliate-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("invite-partner-name-input")).toBeInTheDocument();
      expect(screen.getByTestId("invite-partner-email-input")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("invite-partner-name-input"), {
      target: { value: "Dra. Joana" },
    });
    fireEvent.change(screen.getByTestId("invite-partner-email-input"), {
      target: { value: "joana@fisio.com" },
    });

    fireEvent.click(screen.getByTestId("proceed-invite-btn"));

    await waitFor(() => {
      expect(screen.getByText("Convidar para Afiliado")).toBeInTheDocument();
    });
  });
});
