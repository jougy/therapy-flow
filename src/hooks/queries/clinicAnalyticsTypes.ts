export interface ClinicDashboardAnalytics {
  year: number;
  totalSessions: number;
  paidSessions: number;
  canceledSessions: number;
  cancellationRate: number;
  todaySessions: number;
  weekSessions: number;
  monthSessions: number;
  yearSessions: number;
  financialTotals: {
    paid: number;
    credit: number;
    open: number;
    forecastRevenueCents: number;
  };
  paymentStatusCounts: {
    cortesia?: number;
    courtesy?: number;
    credit?: number;
    debt?: number;
    pending?: number;
    paid?: number;
    notCharged?: number;
    [key: string]: number | undefined;
  };
  paymentMethodCounts: Record<string, number>;
  patientStatusCounts: Record<string, number>;
  totalPatients: number;
  recurringPatients: number;
  agendaCounts: {
    late: number;
    confirmed: number;
    awaiting: number;
    total: number;
  };
  monthlyRevenue: Array<{
    label: string;
    pago: number;
    emAberto: number;
    atendimentos: number;
  }>;
  last30Days: Array<{
    label: string;
    atendimentos: number;
  }>;
  weekdayDistribution: Array<{
    label: string;
    atendimentos: number;
  }>;
  topGroups: Array<{
    name: string;
    color: string;
    total: number;
  }>;
  collaborators: Array<{
    label: string;
    total: number;
    receita: number;
  }>;
  packageAnalytics?: ClinicPackageAnalytics;
}

export interface PackagePlanItem {
  id: string;
  patientId: string;
  patientName: string;
  patientCode?: string | null;
  planName: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  progressPercentage: number;
  totalAmountCents: number;
  paymentStatus: string;
  paymentMethod: string;
  paymentInstallments: number;
  isCompleted: boolean;
  startDate?: string | null;
  createdAt: string;
}

export interface ClinicPackageAnalytics {
  total: number;
  inProgress: number;
  completed: number;
  canceled: number;
  totalRevenueCents: number;
  paidRevenueCents: number;
  openRevenueCents: number;
  totalSessionsContracted: number;
  totalSessionsUsed: number;
  totalSessionsRemaining: number;
  statusCounts: {
    pago?: number;
    parcial?: number;
    pendente?: number;
    cancelado?: number;
    [key: string]: number | undefined;
  };
  plansList: PackagePlanItem[];
}

export const DEFAULT_CLINIC_ANALYTICS: ClinicDashboardAnalytics = {
  year: new Date().getFullYear(),
  totalSessions: 0,
  paidSessions: 0,
  canceledSessions: 0,
  cancellationRate: 0,
  todaySessions: 0,
  weekSessions: 0,
  monthSessions: 0,
  yearSessions: 0,
  financialTotals: {
    paid: 0,
    credit: 0,
    open: 0,
    forecastRevenueCents: 0,
  },
  paymentStatusCounts: {
    courtesy: 0,
    credit: 0,
    debt: 0,
    pending: 0,
    paid: 0,
    notCharged: 0,
  },
  paymentMethodCounts: {},
  patientStatusCounts: {},
  totalPatients: 0,
  recurringPatients: 0,
  agendaCounts: {
    late: 0,
    confirmed: 0,
    awaiting: 0,
    total: 0,
  },
  monthlyRevenue: [
    { label: "Jan", pago: 0, emAberto: 0, atendimentos: 0 },
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
  last30Days: [],
  weekdayDistribution: [
    { label: "Dom", atendimentos: 0 },
    { label: "Seg", atendimentos: 0 },
    { label: "Ter", atendimentos: 0 },
    { label: "Qua", atendimentos: 0 },
    { label: "Qui", atendimentos: 0 },
    { label: "Sex", atendimentos: 0 },
    { label: "Sáb", atendimentos: 0 },
  ],
  topGroups: [],
  collaborators: [],
  packageAnalytics: {
    total: 0,
    inProgress: 0,
    completed: 0,
    canceled: 0,
    totalRevenueCents: 0,
    paidRevenueCents: 0,
    openRevenueCents: 0,
    totalSessionsContracted: 0,
    totalSessionsUsed: 0,
    totalSessionsRemaining: 0,
    statusCounts: {
      pago: 0,
      parcial: 0,
      pendente: 0,
      cancelado: 0,
    },
    plansList: [],
  },
};
