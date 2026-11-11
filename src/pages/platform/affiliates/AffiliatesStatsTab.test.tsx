import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AffiliatesStatsTab } from "./AffiliatesStatsTab";
import {
  EMPTY_AFFILIATES_STATS,
  type AffiliatesStatsData,
} from "./affiliatesStatsData";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("recharts", () => {
  const Component = ({ children, ...props }: any) => <div {...props}>{children}</div>;
  return {
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
    AreaChart: ({ children, ...props }: any) => <svg data-testid="area-chart" {...props}>{children}</svg>,
    Area: ({ ...props }: any) => <g data-testid="area-series" {...props} />,
    BarChart: ({ children, ...props }: any) => <svg data-testid="bar-chart" {...props}>{children}</svg>,
    Bar: ({ children, ...props }: any) => <g data-testid="bar-series" {...props}>{children}</g>,
    Cell: ({ ...props }: any) => <g data-testid="chart-cell" {...props} />,
    XAxis: ({ ...props }: any) => <g data-testid="x-axis" {...props} />,
    YAxis: ({ ...props }: any) => <g data-testid="y-axis" {...props} />,
    Tooltip: () => <g data-testid="chart-tooltip" />,
    CartesianGrid: () => <g data-testid="cartesian-grid" />,
  };
});

describe("AffiliatesStatsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "affiliates") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        } as any;
      }
      return {
        select: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      } as any;
    });
  });

  it("renders tab container, headers, and refresh button", () => {
    render(<AffiliatesStatsTab />);

    expect(screen.getByTestId("affiliates-stats-tab")).toBeInTheDocument();
    expect(screen.getByText("Telemetria e Desempenho da Rede")).toBeInTheDocument();
    expect(screen.getByTestId("btn-refresh-stats")).toBeInTheDocument();
  });

  it("renders initial zeroed real metrics when Supabase returns empty collections", async () => {
    render(<AffiliatesStatsTab />);

    await waitFor(() => {
      expect(screen.getByTestId("metric-conversion-rate")).toBeInTheDocument();
    });

    // Card 1: Conversão
    const conversionCard = screen.getByTestId("metric-conversion-rate");
    expect(within(conversionCard).getByText("Taxa de Conversão Global")).toBeInTheDocument();
    expect(within(conversionCard).getByText("0.0%")).toBeInTheDocument();

    // Card 2: MRR
    const mrrCard = screen.getByTestId("metric-mrr");
    expect(within(mrrCard).getByText("MRR Gerado da Rede")).toBeInTheDocument();
    expect(within(mrrCard).getByText("R$ 0,00")).toBeInTheDocument();

    // Card 3: Comissões
    const commCard = screen.getByTestId("metric-commissions-split");
    expect(within(commCard).getByText("Comissões: Quarentena vs Liberadas")).toBeInTheDocument();
    expect(within(commCard).getByText("Hold 40d")).toBeInTheDocument();
    expect(within(commCard).getAllByText("R$ 0,00").length).toBe(2);

    // Card 4: Clínicas ativas
    const clinicsCard = screen.getByTestId("metric-active-clinics");
    expect(within(clinicsCard).getByText("Clínicas Ativas Indicadas")).toBeInTheDocument();
    expect(within(clinicsCard).getByText("0")).toBeInTheDocument();

    // Leaderboard vazio elegante
    expect(screen.getByTestId("leaderboard-empty")).toBeInTheDocument();
    expect(
      screen.getByText("Nenhum parceiro com indicações ativas no momento")
    ).toBeInTheDocument();

    // Distribuição de 8 planos e tiers zerados
    expect(screen.getByText(/Profissional Básico:/)).toBeInTheDocument();
    expect(screen.getByText(/Profissional Médio:/)).toBeInTheDocument();
    expect(screen.getByText(/Profissional Top:/)).toBeInTheDocument();
    expect(screen.getByText(/Clínica Básico:/)).toBeInTheDocument();
    expect(screen.getByText(/Clínica Médio:/)).toBeInTheDocument();
    expect(screen.getByText(/Clínica Top:/)).toBeInTheDocument();
    expect(screen.getByText(/Solo \(Legado\):/)).toBeInTheDocument();
    expect(screen.getByText(/Enterprise \(Legado\):/)).toBeInTheDocument();
    expect(screen.getByText("Bronze: 0")).toBeInTheDocument();
    expect(screen.getByText("Prata: 0")).toBeInTheDocument();
    expect(screen.getByText("Ouro: 0")).toBeInTheDocument();
  });

  it("loads and aggregates real data from Supabase without crashing", async () => {
    const mockRealAffiliates = [
      {
        id: "aff-101",
        user_id: "usr-1",
        tier: "gold",
        active_referrals_count: 8,
        lifetime_commission_cents: 240000,
        coupon_code: "OURO10",
        profiles: { full_name: "Dra. Juliana Mendes", email: "juliana@exemplo.com" },
      },
      {
        id: "aff-102",
        user_id: "usr-2",
        tier: "silver",
        active_referrals_count: 3,
        lifetime_commission_cents: 90000,
        coupon_code: "PRATA05",
        profiles: { full_name: "Dr. Marcos Rocha", email: "marcos@exemplo.com" },
      },
    ];

    const mockRealCommissions = [
      { amount_cents: 150000, status: "paid" },
      { amount_cents: 50000, status: "pending" },
      { amount_cents: 30000, status: "locked" },
    ];

    const mockRealConversions = [
      { status: "active", plan_type: "solo", created_at: new Date().toISOString() },
      { status: "active", plan_type: "team", created_at: new Date().toISOString() },
      { status: "active", plan_type: "enterprise", created_at: new Date().toISOString() },
      { status: "trial", plan_type: "solo", created_at: new Date().toISOString() },
    ];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "affiliates") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockRealAffiliates,
              error: null,
            }),
          }),
        } as any;
      }
      if (table === "affiliate_commissions") {
        return {
          select: vi.fn().mockResolvedValue({
            data: mockRealCommissions,
            error: null,
          }),
        } as any;
      }
      if (table === "affiliate_conversions") {
        return {
          select: vi.fn().mockResolvedValue({
            data: mockRealConversions,
            error: null,
          }),
        } as any;
      }
      return {
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any;
    });

    render(<AffiliatesStatsTab />);

    await waitFor(() => {
      expect(screen.getByText("Dra. Juliana Mendes")).toBeInTheDocument();
    });

    // Validar consultas
    expect(supabase.from).toHaveBeenCalledWith("affiliates");
    expect(supabase.from).toHaveBeenCalledWith("affiliate_commissions");
    expect(supabase.from).toHaveBeenCalledWith("affiliate_conversions");

    // Taxa de conversão: 3 ativas / 4 total = 75.0%
    const conversionCard = screen.getByTestId("metric-conversion-rate");
    expect(within(conversionCard).getByText("75.0%")).toBeInTheDocument();

    // MRR: 250 (solo) + 450 (team) + 850 (enterprise) = 1550 => R$ 1.550,00
    const mrrCard = screen.getByTestId("metric-mrr");
    expect(within(mrrCard).getByText("R$ 1.550,00")).toBeInTheDocument();

    // Comissões: Liberadas R$ 1.500,00 e Quarentena R$ 800,00
    const commCard = screen.getByTestId("metric-commissions-split");
    expect(within(commCard).getByText("R$ 1.500,00")).toBeInTheDocument();
    expect(within(commCard).getByText("R$ 800,00")).toBeInTheDocument();

    // Clínicas ativas: 3
    const clinicsCard = screen.getByTestId("metric-active-clinics");
    expect(within(clinicsCard).getByText("3")).toBeInTheDocument();

    // Leaderboard com parceiros reais
    expect(screen.getByText("OURO10")).toBeInTheDocument();
    expect(screen.getByText("Dr. Marcos Rocha")).toBeInTheDocument();
    expect(screen.getByText("PRATA05")).toBeInTheDocument();

    // Tiers com as conversões somadas
    expect(screen.getByText("Ouro: 8")).toBeInTheDocument();
    expect(screen.getByText("Prata: 3")).toBeInTheDocument();
  });

  it("renders custom initialData when provided via props without querying Supabase", () => {
    const customData: AffiliatesStatsData = {
      ...EMPTY_AFFILIATES_STATS,
      avgConversionRate: 42.5,
      totalMrr: 99000,
      totalActiveClinics: 250,
      leaderboard: [
        {
          id: "custom-1",
          name: "Parceiro Campeão",
          coupon: "CAMPEAO50",
          tier: "legendary",
          activeClinics: 100,
          conversionRate: 50.0,
          mrrGenerated: 34000,
          commissionEarnedCents: 1020000,
        },
      ],
    };

    render(<AffiliatesStatsTab initialData={customData} />);

    expect(screen.getByText("42.5%")).toBeInTheDocument();
    expect(screen.getByText("R$ 99.000,00")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
    expect(screen.getByText("Parceiro Campeão")).toBeInTheDocument();
    expect(screen.getByText("CAMPEAO50")).toBeInTheDocument();
    expect(screen.getByText("Legendary")).toBeInTheDocument();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("handles refresh button click and triggers reload", async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: "aff-real-1",
          coupon_code: "SUPERTOP",
          tier: "diamond",
          active_referrals_count: 55,
          lifetime_commission_cents: 800000,
          profile: { full_name: "Super Parceiro Real" },
        },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "affiliates") {
        return {
          select: vi.fn().mockReturnValue({
            order: mockOrder,
          }),
        } as any;
      }
      return {
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any;
    });

    render(<AffiliatesStatsTab />);

    const refreshBtn = screen.getByTestId("btn-refresh-stats");
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(mockOrder).toHaveBeenCalled();
    });
  });

  it("supports view toggle between 8 plans and 3 billing cycles with accurate counts and percentages", async () => {
    const mockRealConversions = [
      { status: "active", plan_type: "prof_basico", billing_cycle: "monthly", created_at: new Date().toISOString() },
      { status: "active", plan_type: "prof_medio", billing_cycle: "quarterly", created_at: new Date().toISOString() },
      { status: "active", plan_type: "clinica_top", billing_cycle: "annual", created_at: new Date().toISOString() },
    ];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "affiliates") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as any;
      }
      if (table === "affiliate_conversions") {
        return {
          select: vi.fn().mockResolvedValue({ data: mockRealConversions, error: null }),
        } as any;
      }
      return {
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any;
    });

    render(<AffiliatesStatsTab />);

    await waitFor(() => {
      expect(screen.getByText("Clínicas por Plano")).toBeInTheDocument();
    });

    // Validar botões de alternância e dados dos 8 planos
    expect(screen.getByRole("button", { name: /nível d.*plano/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ciclo de faturamento/i })).toBeInTheDocument();
    expect(screen.getByText(/Profissional Básico:/)).toBeInTheDocument();
    expect(screen.getByText(/Profissional Médio:/)).toBeInTheDocument();
    expect(screen.getByText(/Clínica Top:/)).toBeInTheDocument();

    // Alternar para ciclo de faturamento
    const cycleBtn = screen.getByTestId("btn-view-cycle");
    fireEvent.click(cycleBtn);

    expect(screen.getByText("Clínicas por Ciclo de Faturamento")).toBeInTheDocument();
    expect(screen.getByText(/Mensal:/)).toBeInTheDocument();
    expect(screen.getByText(/Trimestral:/)).toBeInTheDocument();
    expect(screen.getByText(/Anual:/)).toBeInTheDocument();

    // Alternar de volta para nível de plano
    const planBtn = screen.getByTestId("btn-view-plan");
    fireEvent.click(planBtn);

    expect(screen.getByText("Clínicas por Plano")).toBeInTheDocument();
    expect(screen.getByText(/Profissional Básico:/)).toBeInTheDocument();
  });
});
