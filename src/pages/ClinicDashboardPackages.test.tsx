import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ClinicDashboard from "./ClinicDashboard";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    can: () => true,
    canViewFinancialData: true,
    clinic: { id: "clinic-1", name: "Clínica Teste", slug: "clinica-teste", route_key: "clinica-teste" },
    clinicId: "clinic-1",
    isPlatformOwner: false,
    loading: false,
    platformAccess: null,
    profile: { full_name: "Dr. Teste", id: "user-1" },
    user: { email: "teste@example.com", id: "user-1" },
  }),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
  }),
}));

vi.mock("@/hooks/queries/useClinicDataQueries", () => ({
  DEFAULT_CLINIC_ANALYTICS: {
    year: 2026,
    totalSessions: 20,
    paidSessions: 20,
    canceledSessions: 0,
    cancellationRate: 0,
    todaySessions: 0,
    weekSessions: 0,
    monthSessions: 20,
    yearSessions: 20,
    financialTotals: { paid: 320000, credit: 0, open: 0, forecastRevenueCents: 320000 },
    paymentStatusCounts: { paid: 20 },
    paymentMethodCounts: { pix: 5, cartao_credito: 5 },
    patientStatusCounts: { ativo: 5 },
    totalPatients: 5,
    recurringPatients: 5,
    agendaCounts: { late: 0, confirmed: 0, awaiting: 0, total: 0 },
    monthlyRevenue: [],
    last30Days: [],
    weekdayDistribution: [],
    topGroups: [],
    collaborators: [],
    packageAnalytics: {
      total: 5,
      inProgress: 4,
      completed: 1,
      canceled: 0,
      totalRevenueCents: 569000,
      paidRevenueCents: 403500,
      openRevenueCents: 165500,
      totalSessionsContracted: 37,
      totalSessionsUsed: 20,
      totalSessionsRemaining: 17,
      statusCounts: { pago: 3, parcial: 1, pendente: 1, cancelado: 0 },
      plansList: [
        {
          id: "plan-1",
          patientId: "p1",
          patientName: "Lucas Gabriel Fernandes",
          patientCode: "PAC-002",
          planName: "Pacote Reabilitação Esportiva - 10 Sessões",
          totalSessions: 10,
          usedSessions: 4,
          remainingSessions: 6,
          progressPercentage: 40,
          totalAmountCents: 150000,
          paymentStatus: "pago",
          paymentMethod: "cartao_credito",
          paymentInstallments: 3,
          isCompleted: false,
          startDate: "2026-08-10",
          createdAt: "2026-08-10T09:00:00.000Z",
        },
        {
          id: "plan-2",
          patientId: "p2",
          patientName: "Juliana Mendes Fonseca",
          patientCode: "PAC-005",
          planName: "Pacote Recuperação de Tornozelo - 4 Sessões",
          totalSessions: 4,
          usedSessions: 4,
          remainingSessions: 0,
          progressPercentage: 100,
          totalAmountCents: 56000,
          paymentStatus: "pago",
          paymentMethod: "pix",
          paymentInstallments: 1,
          isCompleted: true,
          startDate: "2026-08-11",
          createdAt: "2026-08-11T16:00:00.000Z",
        },
      ],
    },
  },
  useClinicDashboardAnalyticsQuery: () => ({
    data: {
      year: 2026,
      totalSessions: 20,
      paidSessions: 20,
      canceledSessions: 0,
      cancellationRate: 0,
      todaySessions: 0,
      weekSessions: 0,
      monthSessions: 20,
      yearSessions: 20,
      financialTotals: { paid: 320000, credit: 0, open: 0, forecastRevenueCents: 320000 },
      paymentStatusCounts: { paid: 20 },
      paymentMethodCounts: { pix: 5, cartao_credito: 5 },
      patientStatusCounts: { ativo: 5 },
      totalPatients: 5,
      recurringPatients: 5,
      agendaCounts: { late: 0, confirmed: 0, awaiting: 0, total: 0 },
      monthlyRevenue: [],
      last30Days: [],
      weekdayDistribution: [],
      topGroups: [],
      collaborators: [],
      packageAnalytics: {
        total: 5,
        inProgress: 4,
        completed: 1,
        canceled: 0,
        totalRevenueCents: 569000,
        paidRevenueCents: 403500,
        openRevenueCents: 165500,
        totalSessionsContracted: 37,
        totalSessionsUsed: 20,
        totalSessionsRemaining: 17,
        statusCounts: { pago: 3, parcial: 1, pendente: 1, cancelado: 0 },
        plansList: [
          {
            id: "plan-1",
            patientId: "p1",
            patientName: "Lucas Gabriel Fernandes",
            patientCode: "PAC-002",
            planName: "Pacote Reabilitação Esportiva - 10 Sessões",
            totalSessions: 10,
            usedSessions: 4,
            remainingSessions: 6,
            progressPercentage: 40,
            totalAmountCents: 150000,
            paymentStatus: "pago",
            paymentMethod: "cartao_credito",
            paymentInstallments: 3,
            isCompleted: false,
            startDate: "2026-08-10",
            createdAt: "2026-08-10T09:00:00.000Z",
          },
          {
            id: "plan-2",
            patientId: "p2",
            patientName: "Juliana Mendes Fonseca",
            patientCode: "PAC-005",
            planName: "Pacote Recuperação de Tornozelo - 4 Sessões",
            totalSessions: 4,
            usedSessions: 4,
            remainingSessions: 0,
            progressPercentage: 100,
            totalAmountCents: 56000,
            paymentStatus: "pago",
            paymentMethod: "pix",
            paymentInstallments: 1,
            isCompleted: true,
            startDate: "2026-08-11",
            createdAt: "2026-08-11T16:00:00.000Z",
          },
        ],
      },
    },
    isLoading: false,
  }),
  useInvalidateClinicData: () => vi.fn(),
}));

describe("ClinicDashboard - Packages Section", () => {
  it("renders packages KPIs and detailed plans list", () => {
    render(
      <MemoryRouter initialEntries={["/clinica/clinica-teste/dashboard"]}>
        <Routes>
          <Route path="/clinica/:clinicKey/dashboard" element={<ClinicDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify header and navigation
    expect(screen.getByText("Estatísticas completas")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /pacotes/i }).length).toBeGreaterThanOrEqual(1);

    // Verify packages section title
    expect(screen.getByText("Andamento de Pacotes por Paciente")).toBeInTheDocument();
    expect(
      screen.getByText("Acompanhe as sessões realizadas, sessões restantes e quitação financeira de cada pacote.")
    ).toBeInTheDocument();

    // Verify package cards and progress
    expect(screen.getAllByText("Lucas Gabriel Fernandes").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("PAC-002").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pacote Reabilitação Esportiva - 10 Sessões").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("4 de 10 sessões").length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText("Juliana Mendes Fonseca").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("PAC-005").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pacote Recuperação de Tornozelo - 4 Sessões").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("4 de 4 sessões").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Concluído").length).toBeGreaterThanOrEqual(1);
  });
});
