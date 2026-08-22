import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ClinicDashboard from "@/pages/ClinicDashboard";

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => {
  const sampleAnalytics = {
    year: new Date().getFullYear(),
    totalSessions: 2,
    paidSessions: 1,
    canceledSessions: 0,
    cancellationRate: 0,
    todaySessions: 2,
    weekSessions: 2,
    monthSessions: 2,
    yearSessions: 2,
    financialTotals: {
      paid: 15000,
      credit: 0,
      open: 12000,
      forecastRevenueCents: 27000,
    },
    paymentStatusCounts: {
      paid: 1,
      pending: 1,
      credit: 0,
      debt: 0,
      cortesia: 0,
      notCharged: 0,
    },
    paymentMethodCounts: {
      pix: 1,
      cartao_credito: 1,
    },
    patientStatusCounts: {
      ativo: 1,
    },
    totalPatients: 1,
    recurringPatients: 0,
    agendaCounts: {
      late: 0,
      confirmed: 1,
      awaiting: 0,
      total: 1,
    },
    monthlyRevenue: [
      { label: "Jan", pago: 150, emAberto: 120, atendimentos: 2 },
      { label: "Fev", pago: 0, emAberto: 0, atendimentos: 0 },
      { label: "Mar", pago: 0, emAberto: 0, atendimentos: 0 },
      { label: "Abr", pago: 0, emAberto: 0, atendimentos: 0 },
      { label: "Mai", pago: 0, emAberto: 0, atendimentos: 0 },
      { label: "Jun", pago: 0, emAberto: 0, atendimentos: 0 },
      { label: "Jul", pago: 0, emAberto: 0, atendimentos: 0 },
      { label: "Ago", pago: 0, emAberto: 0, atendimentos: 0 },
      { label: "Set", pago: 0, emAberto: 0, atendimentos: 0 },
      { label: "Out", pago: 0, emAberto: 0, atendimentos: 0 },
      { label: "Nov", pago: 0, emAberto: 0, atendimentos: 0 },
      { label: "Dez", pago: 0, emAberto: 0, atendimentos: 0 },
    ],
    last30Days: Array.from({ length: 30 }, (_, i) => ({
      label: `${String(i + 1).padStart(2, "0")}/08`,
      atendimentos: i === 29 ? 2 : 0,
    })),
    weekdayDistribution: [
      { label: "Dom", atendimentos: 0 },
      { label: "Seg", atendimentos: 1 },
      { label: "Ter", atendimentos: 1 },
      { label: "Qua", atendimentos: 0 },
      { label: "Qui", atendimentos: 0 },
      { label: "Sex", atendimentos: 0 },
      { label: "Sáb", atendimentos: 0 },
    ],
    topGroups: [
      { name: "Terapia Cognitiva", color: "#0ea5e9", total: 2 },
    ],
    collaborators: [
      { label: "Dra. Especialista", total: 2, receita: 150 },
    ],
  };

  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      rpc: vi.fn((fnName: string) => {
        if (fnName === "get_clinic_dashboard_analytics") {
          return Promise.resolve({ data: sampleAnalytics, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    },
  };
});

// Mock useAuth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "admin@clinica.com" },
    profile: { full_name: "Admin Clínico", email: "admin@clinica.com" },
    clinic: { id: "clinic-1", name: "Minha Clínica Particular" },
    clinicId: "clinic-1",
    can: () => true,
  }),
}));

// Mock FeatureFlags
vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
  }),
}));

describe("ClinicDashboard - Print Stats SVG Rendering Verification", () => {
  it("renders #print-clinic-stats-root with non-zero width and height SVG elements for all Recharts charts", async () => {
    renderWithClient(
      <MemoryRouter>
        <ClinicDashboard />
      </MemoryRouter>
    );

    // Wait for the dashboard to finish loading data
    await waitFor(() => {
      expect(screen.queryByText("Minha Clínica Particular")).toBeInTheDocument();
    });

    // 1. Check that #print-clinic-stats-root is present in document.body
    const printRoot = document.body.querySelector("#print-clinic-stats-root");
    expect(printRoot).not.toBeNull();
    expect(printRoot).toHaveClass("print:block");

    // 2. Verify header information in print root
    expect(printRoot?.textContent).toContain("Minha Clínica Particular");
    expect(printRoot?.textContent).toContain("Relatório de Estatísticas Completas");
    expect(printRoot?.textContent).toContain("Impresso por: Admin Clínico (admin@clinica.com)");

    // 3. Verify all 5 Recharts chart cards are present in print root
    expect(printRoot?.textContent).toContain("Receita e atendimentos no ano");
    expect(printRoot?.textContent).toContain("Atendimentos nos últimos 30 dias");
    expect(printRoot?.textContent).toContain("Distribuição por dia da semana");
    expect(printRoot?.textContent).toContain("Produtividade por colaborador");
    expect(printRoot?.textContent).toContain("Status financeiro");

    // 4. Locate all SVGs rendered by Recharts inside #print-clinic-stats-root
    const chartSvgs = printRoot?.querySelectorAll("svg.recharts-surface");
    expect(chartSvgs).toBeDefined();
    expect(chartSvgs!.length).toBe(5);

    // 5. Verify each SVG chart has explicit non-zero width and height attributes (> 0)
    chartSvgs!.forEach((svg) => {
      const width = svg.getAttribute("width");
      const height = svg.getAttribute("height");
      const viewBox = svg.getAttribute("viewBox");

      expect(width).toBeTruthy();
      expect(height).toBeTruthy();

      const numWidth = Number(width);
      const numHeight = Number(height);

      expect(numWidth).toBeGreaterThan(0);
      expect(numHeight).toBeGreaterThan(0);

      // Verify viewBox matches SVG dimensions
      expect(viewBox).toBe(`0 0 ${numWidth} ${numHeight}`);
    });

    // 6. Verify AreaChart contains path elements for pago and emAberto areas
    const areaPaths = printRoot?.querySelectorAll(".recharts-area-area");
    expect(areaPaths?.length).toBeGreaterThan(0);

    // 7. Verify LineChart contains line path elements
    const lineCurves = printRoot?.querySelectorAll(".recharts-line-curve");
    expect(lineCurves?.length).toBeGreaterThan(0);

    // 8. Verify BarCharts contain bar rectangles
    const barRectangles = printRoot?.querySelectorAll(".recharts-bar-rectangle");
    expect(barRectangles?.length).toBeGreaterThan(0);

    // 9. Verify PieChart contains pie sectors
    const pieSectors = printRoot?.querySelectorAll(".recharts-pie-sector");
    expect(pieSectors?.length).toBeGreaterThan(0);
  });
});
