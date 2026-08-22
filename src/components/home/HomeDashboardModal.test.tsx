import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomeDashboardModal } from "@/components/home/HomeDashboardModal";

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

const sampleAnalytics = {
  year: 2026,
  totalSessions: 42,
  paidSessions: 35,
  canceledSessions: 3,
  cancellationRate: 7.1,
  todaySessions: 4,
  weekSessions: 18,
  monthSessions: 42,
  yearSessions: 120,
  financialTotals: {
    paid: 525000,
    credit: 0,
    open: 105000,
    forecastRevenueCents: 630000,
  },
  paymentStatusCounts: {
    paid: 35,
    pending: 4,
    debt: 0,
    credit: 0,
    courtesy: 3,
    notCharged: 0,
  },
  paymentMethodCounts: {
    pix: 25,
    cartao_credito: 10,
    dinheiro: 7,
  },
  patientStatusCounts: {
    ativo: 20,
    alta: 5,
  },
  totalPatients: 25,
  recurringPatients: 15,
  agendaCounts: {
    late: 1,
    confirmed: 8,
    awaiting: 2,
    total: 11,
  },
  monthlyRevenue: [
    { label: "Jan", pago: 5250, emAberto: 1050, atendimentos: 42 },
  ],
  last30Days: [],
  weekdayDistribution: [],
  topGroups: [{ name: "Terapia de Casal", color: "#0ea5e9", total: 10 }],
  collaborators: [{ label: "Dr. Roberto", total: 42, receita: 5250 }],
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn((fnName: string) => {
      if (fnName === "get_clinic_dashboard_analytics") {
        return Promise.resolve({ data: sampleAnalytics, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "dr.roberto@clinica.com" },
    clinicId: "clinic-1",
    can: () => true,
  }),
}));

describe("HomeDashboardModal", () => {
  it("renders correctly with analytics RPC data when open", async () => {
    const onOpenChange = vi.fn();
    const onNavigateForms = vi.fn();
    const onNavigateDashboard = vi.fn();

    renderWithClient(
      <HomeDashboardModal
        open={true}
        onOpenChange={onOpenChange}
        clinicId="clinic-1"
        onNavigateForms={onNavigateForms}
        onNavigateDashboard={onNavigateDashboard}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Total de atendimentos")).toBeInTheDocument();
    });

    expect(screen.getByText("Indicadores rápidos da clínica para acompanhar operação, atendimentos e pagamentos.")).toBeInTheDocument();
    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
    expect(screen.getByText("Pagamentos concluídos")).toBeInTheDocument();
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(screen.getByText("Índice de cancelamento")).toBeInTheDocument();
    expect(screen.getByText("7%")).toBeInTheDocument();

    const formsBtn = screen.getByRole("button", { name: /Formulários & Anamneses/i });
    fireEvent.click(formsBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onNavigateForms).toHaveBeenCalled();

    const statsBtn = screen.getByRole("button", { name: /Estatísticas completas/i });
    fireEvent.click(statsBtn);
    expect(onNavigateDashboard).toHaveBeenCalled();
  });
});
