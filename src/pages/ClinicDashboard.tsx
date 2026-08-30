import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Coins,
  CreditCard,
  Package,
  Printer,
  TrendingUp,
  UsersRound,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { PATIENT_STATUS_OPTIONS } from "@/lib/patient-statuses";
import { PAYMENT_METHOD_OPTIONS, MAX_SESSION_AMOUNT_CENTS, formatMoneyCents } from "@/lib/session-operations";
import { ClinicStatsPrintModal, STATS_BLOCKS, type StatsBlockId } from "@/components/ClinicStatsPrintModal";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { getClinicPatientPath } from "@/lib/patient-routing";
import {
  useClinicDashboardAnalyticsQuery,
  useInvalidateClinicData,
  DEFAULT_CLINIC_ANALYTICS,
  type PackagePlanItem,
} from "@/hooks/queries/useClinicDataQueries";

type Segment = {
  color: string;
  label: string;
  value: number;
};

type DashboardSection = "overview" | "financial" | "packages" | "agenda" | "patients" | "team";

const colors = {
  amber: "#f59e0b",
  blue: "#0ea5e9",
  cyan: "#22d3ee",
  emerald: "#10b981",
  lime: "#84cc16",
  rose: "#f43f5e",
  sky: "#38bdf8",
  slate: "#64748b",
  violet: "#8b5cf6",
  zinc: "#a1a1aa",
};

const sanitizeCents = (value: number | null | undefined) => {
  if (!Number.isFinite(value ?? 0)) {
    return 0;
  }

  return Math.min(MAX_SESSION_AMOUNT_CENTS, Math.max(0, Math.round(value ?? 0)));
};

const formatMoney = (cents: number) => formatMoneyCents(sanitizeCents(cents));

const formatPercentage = (value: number) => `${Math.round(Number.isFinite(value) ? value : 0)}%`;

const statusColor = (status: string) =>
  status === "ativo" ? colors.emerald :
  status === "pausado" ? colors.amber :
  status === "alta" ? colors.sky :
  status === "inativo" ? colors.slate :
  colors.zinc;

const paymentMethodColor = (method: string) =>
  method === "dinheiro" ? colors.emerald :
  method === "pix" ? colors.blue :
  method === "cartao_debito" ? colors.sky :
  method === "cartao_credito" ? colors.violet :
  method === "convenio" ? colors.amber :
  method === "transferencia" ? colors.slate :
  method === "credito_usado" ? colors.cyan :
  method === "cortesia" ? colors.lime :
  colors.zinc;

const compactNumber = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const dashboardSections: Array<{ icon: typeof TrendingUp; label: string; value: DashboardSection }> = [
  { icon: Activity, label: "Visão geral", value: "overview" },
  { icon: Wallet, label: "Financeiro", value: "financial" },
  { icon: Package, label: "Pacotes", value: "packages" },
  { icon: CalendarClock, label: "Agenda", value: "agenda" },
  { icon: UsersRound, label: "Pacientes", value: "patients" },
  { icon: BarChart3, label: "Equipe", value: "team" },
];

const metricChartConfig = {
  atendimentos: { color: colors.blue, label: "Atendimentos" },
  emAberto: { color: colors.rose, label: "Em aberto" },
  pago: { color: colors.emerald, label: "Pago" },
  receita: { color: colors.emerald, label: "Receita" },
  pacotes: { color: colors.violet, label: "Pacotes" },
} satisfies ChartConfig;

const pieChartConfig = {
  value: { label: "Quantidade" },
} satisfies ChartConfig;

const DashboardProportionCard = ({
  compact = false,
  formatSegmentValue,
  segments,
  subtitle,
  title,
  value,
}: {
  compact?: boolean;
  formatSegmentValue?: (value: number) => string;
  segments: Segment[];
  subtitle: string;
  title: string;
  value: string;
}) => {
  const normalizedSegments = segments.filter((segment) => Number.isFinite(segment.value) && segment.value > 0);
  const total = normalizedSegments.reduce((sum, segment) => sum + segment.value, 0);
  const visibleSegments = total > 0 ? normalizedSegments : [{ color: "#d6d3d1", label: "Sem dados", value: 1 }];
  const visibleTotal = visibleSegments.reduce((sum, item) => sum + item.value, 0);

  if (compact) {
    return (
      <Card className="min-w-0 overflow-hidden border shadow-none bg-slate-50/50">
        <CardContent className="p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
            <p className="text-base font-bold text-slate-900 leading-none">{value}</p>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">{subtitle}</p>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-slate-200/80">
            {visibleSegments.map((segment) => (
              <div
                key={segment.label}
                className="h-full"
                style={{ backgroundColor: segment.color, width: `${Math.max(4, (segment.value / visibleTotal) * 100)}%` }}
                title={`${segment.label}: ${segment.value}`}
              />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-600">
            {normalizedSegments.length > 0 ? (
              normalizedSegments.map((segment) => (
                <span key={segment.label} className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: segment.color }} />
                  {segment.label}: {formatSegmentValue ? `${formatSegmentValue(segment.value)} (${formatPercentage((segment.value / total) * 100)})` : formatPercentage((segment.value / total) * 100)}
                </span>
              ))
            ) : (
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                Sem dados suficientes
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
        <p className="mt-2 break-words text-3xl font-semibold leading-none text-foreground sm:text-4xl">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-4 flex h-7 overflow-hidden rounded-full bg-muted">
          {visibleSegments.map((segment) => (
            <div
              key={segment.label}
              className="h-full"
              style={{ backgroundColor: segment.color, width: `${Math.max(4, (segment.value / visibleTotal) * 100)}%` }}
              title={`${segment.label}: ${segment.value}`}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {normalizedSegments.length > 0 ? (
            normalizedSegments.map((segment) => (
              <span key={segment.label} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                {segment.label}: {formatSegmentValue ? `${formatSegmentValue(segment.value)} (${formatPercentage((segment.value / total) * 100)})` : formatPercentage((segment.value / total) * 100)}
              </span>
            ))
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              Sem dados suficientes
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const MetricCard = ({
  compact = false,
  detail,
  icon: Icon,
  title,
  value,
}: {
  compact?: boolean;
  detail: string;
  icon: typeof TrendingUp;
  title: string;
  value: string;
}) => {
  if (compact) {
    return (
      <Card className="min-w-0 overflow-hidden border shadow-none bg-slate-50/50">
        <CardContent className="p-2.5 flex items-center gap-2">
          <span className="rounded-md bg-primary/10 p-1.5 text-primary shrink-0">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{title}</p>
            <p className="text-base font-bold text-slate-900 leading-none mt-0.5">{value}</p>
            <p className="text-[9px] text-slate-500 truncate mt-0.5">{detail}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="flex items-start gap-3 p-4">
        <span className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const isSectionActive = (section: DashboardSection, activeSection: DashboardSection) =>
  activeSection === "overview" || activeSection === section;

const DashboardSkeleton = () => (
  <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-5 overflow-x-hidden px-4 pb-28 pt-4 sm:p-6 lg:px-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      <Skeleton className="h-44 w-full lg:col-span-2" />
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-44 w-full" />
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full" />
      ))}
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  </main>
);

const ClinicDashboard = () => {
  const navigate = useNavigate();
  const { clinicKey } = useParams<{ clinicKey?: string }>();
  const { can, clinic, clinicId, platformAccess, profile, user } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const clinicHomePath = clinicKey ? `/clinica/${clinicKey}` : clinic?.slug ? `/clinica/${clinic.slug}` : "";

  const [selectedYear] = useState<number>(() => new Date().getFullYear());
  const { data: analyticsData = DEFAULT_CLINIC_ANALYTICS, isLoading: loading } = useClinicDashboardAnalyticsQuery(
    clinicId,
    selectedYear,
    Boolean(user)
  );
  const invalidateClinicData = useInvalidateClinicData();

  const [activeSection, setActiveSection] = useState<DashboardSection>("overview");
  const canViewFinancialData = can("treasury.manage");

  const analytics = useMemo(() => {
    const paymentMethodSegments = PAYMENT_METHOD_OPTIONS.map((option) => ({
      color: paymentMethodColor(option.value),
      label: option.label,
      value: analyticsData.paymentMethodCounts[option.value] ?? 0,
    })).filter((segment) => segment.value > 0);

    const paymentStatusSegments = [
      { color: colors.blue, label: "Crédito", value: analyticsData.paymentStatusCounts.credit ?? 0 },
      { color: colors.rose, label: "Devendo", value: analyticsData.paymentStatusCounts.debt ?? 0 },
      { color: colors.amber, label: "Pendente", value: analyticsData.paymentStatusCounts.pending ?? 0 },
      { color: colors.emerald, label: "Pago", value: analyticsData.paymentStatusCounts.paid ?? 0 },
      {
        color: colors.violet,
        label: "Cortesia",
        value: (analyticsData.paymentStatusCounts.cortesia ?? analyticsData.paymentStatusCounts.courtesy) ?? 0,
      },
      { color: colors.slate, label: "Não cobrado", value: analyticsData.paymentStatusCounts.notCharged ?? 0 },
    ].filter((segment) => segment.value > 0);

    const patientStatusSegments = PATIENT_STATUS_OPTIONS.filter((option) => option.value !== "pagamento_pendente")
      .map((option) => ({
        color: statusColor(option.value),
        label: option.label,
        value: analyticsData.patientStatusCounts[option.value] ?? 0,
      }))
      .filter((segment) => segment.value > 0);

    const packageAnalytics = analyticsData.packageAnalytics ?? {
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
      statusCounts: { pago: 0, parcial: 0, pendente: 0, cancelado: 0 },
      plansList: [],
    };

    const packageStatusSegments = [
      { color: colors.blue, label: "Em andamento", value: packageAnalytics.inProgress },
      { color: colors.emerald, label: "Concluído", value: packageAnalytics.completed },
      { color: colors.rose, label: "Cancelado", value: packageAnalytics.canceled },
    ].filter((segment) => segment.value > 0);

    const packagePaymentSegments = [
      { color: colors.emerald, label: "Pago integral", value: packageAnalytics.statusCounts.pago ?? 0 },
      { color: colors.amber, label: "Pago parcial", value: packageAnalytics.statusCounts.parcial ?? 0 },
      { color: colors.rose, label: "Pendente", value: packageAnalytics.statusCounts.pendente ?? 0 },
      { color: colors.slate, label: "Cancelado", value: packageAnalytics.statusCounts.cancelado ?? 0 },
    ].filter((segment) => segment.value > 0);

    return {
      agendaChart: {
        formatSegmentValue: (value: number) => String(value),
        segments: [
          { color: colors.rose, label: "Atrasado", value: analyticsData.agendaCounts.late },
          { color: colors.emerald, label: "Confirmado", value: analyticsData.agendaCounts.confirmed },
          { color: colors.amber, label: "Aguardando confirmação", value: analyticsData.agendaCounts.awaiting },
        ].filter((segment) => segment.value > 0),
        subtitle: `${analyticsData.agendaCounts.total} agendamento${analyticsData.agendaCounts.total !== 1 ? "s" : ""} ativo${analyticsData.agendaCounts.total !== 1 ? "s" : ""}`,
        title: "Agenda de atendimentos",
        value: String(analyticsData.agendaCounts.total),
      },
      cancellationRate: analyticsData.cancellationRate,
      cards: [
        { detail: "atendimentos registrados", icon: CalendarClock, title: "Total de atendimentos", value: String(analyticsData.totalSessions) },
        { detail: "atendimentos quitados", icon: CreditCard, title: "Pagamentos concluídos", value: String(analyticsData.paidSessions) },
        { detail: `${analyticsData.canceledSessions} cancelado${analyticsData.canceledSessions !== 1 ? "s" : ""}`, icon: BarChart3, title: "Índice de cancelamento", value: formatPercentage(analyticsData.cancellationRate) },
        { detail: "pacientes com recorrência configurada", icon: UsersRound, title: "Recorrência", value: formatPercentage(analyticsData.totalPatients > 0 ? (analyticsData.recurringPatients / analyticsData.totalPatients) * 100 : 0) },
      ],
      packageAnalytics,
      packageStatusChart: {
        formatSegmentValue: (value: number) => String(value),
        segments: packageStatusSegments,
        subtitle: `${packageAnalytics.total} pacote${packageAnalytics.total !== 1 ? "s" : ""} contratado${packageAnalytics.total !== 1 ? "s" : ""}`,
        title: "Status dos pacotes",
        value: String(packageAnalytics.total),
      },
      packagePaymentChart: {
        formatSegmentValue: (value: number) => String(value),
        segments: packagePaymentSegments,
        subtitle: `Receita total ${formatMoney(packageAnalytics.totalRevenueCents)}`,
        title: "Situação financeira dos pacotes",
        value: String(packageAnalytics.total),
      },
      packageCards: [
        {
          detail: `${packageAnalytics.inProgress} em andamento · ${packageAnalytics.completed} concluído${packageAnalytics.completed !== 1 ? "s" : ""}`,
          icon: Package,
          title: "Total de pacotes",
          value: String(packageAnalytics.total),
        },
        {
          detail: `${packageAnalytics.totalSessionsUsed} de ${packageAnalytics.totalSessionsContracted} realizadas (${packageAnalytics.totalSessionsContracted > 0 ? Math.round((packageAnalytics.totalSessionsUsed / packageAnalytics.totalSessionsContracted) * 100) : 0}%)`,
          icon: Clock,
          title: "Sessões restantes",
          value: `${packageAnalytics.totalSessionsRemaining} a realizar`,
        },
        {
          detail: `Quitado: ${formatMoney(packageAnalytics.paidRevenueCents)}`,
          icon: Coins,
          title: "Receita em pacotes",
          value: formatMoney(packageAnalytics.totalRevenueCents),
        },
        {
          detail: `${(packageAnalytics.statusCounts.pendente ?? 0) + (packageAnalytics.statusCounts.parcial ?? 0)} com saldo pendente`,
          icon: CreditCard,
          title: "Saldo a receber",
          value: formatMoney(packageAnalytics.openRevenueCents),
        },
      ],
      collaborators: analyticsData.collaborators,
      forecastRevenueCents: analyticsData.financialTotals.forecastRevenueCents,
      last30Days: analyticsData.last30Days,
      monthSessions: analyticsData.monthSessions,
      monthlyRevenue: analyticsData.monthlyRevenue,
      patientStatusChart: {
        segments: patientStatusSegments,
        subtitle: `${analyticsData.totalPatients} paciente${analyticsData.totalPatients !== 1 ? "s" : ""} no cadastro`,
        title: "Pacientes por status",
        value: String(analyticsData.totalPatients),
      },
      paymentChart: {
        formatSegmentValue: formatMoney,
        segments: [
          { color: colors.emerald, label: "Pago", value: analyticsData.financialTotals.paid },
          { color: colors.blue, label: "Crédito", value: analyticsData.financialTotals.credit },
          { color: colors.rose, label: "Em aberto", value: analyticsData.financialTotals.open },
        ].filter((segment) => segment.value > 0),
        subtitle: `Pago ${formatMoney(analyticsData.financialTotals.paid)} · crédito ${formatMoney(analyticsData.financialTotals.credit)} · em aberto ${formatMoney(analyticsData.financialTotals.open)}`,
        title: "Receita registrada",
        value: formatMoney(analyticsData.financialTotals.forecastRevenueCents),
      },
      paymentMethodChart: {
        formatSegmentValue: (value: number) => String(value),
        segments: paymentMethodSegments,
        subtitle: `${analyticsData.totalSessions} atendimento${analyticsData.totalSessions !== 1 ? "s" : ""} registrado${analyticsData.totalSessions !== 1 ? "s" : ""}`,
        title: "Método de pagamento",
        value: String(analyticsData.totalSessions),
      },
      paymentStatusChart: {
        formatSegmentValue: (value: number) => String(value),
        segments: paymentStatusSegments,
        subtitle: `${analyticsData.totalSessions} atendimento${analyticsData.totalSessions !== 1 ? "s" : ""} com status financeiro`,
        title: "Status de pagamento",
        value: String(analyticsData.totalSessions),
      },
      topGroups: analyticsData.topGroups,
      todaySessions: analyticsData.todaySessions,
      weekSessions: analyticsData.weekSessions,
      weekdayDistribution: analyticsData.weekdayDistribution,
      yearSessions: analyticsData.yearSessions,
      totalSessions: analyticsData.totalSessions,
      paidSessions: analyticsData.paidSessions,
      canceledSessions: analyticsData.canceledSessions,
      financialTotals: analyticsData.financialTotals,
    };
  }, [analyticsData]);

  const canPrintStats = can("system.print") && isFeatureEnabled("print_general") && isFeatureEnabled("print_clinic_stats");
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printedBlockIds, setPrintedBlockIds] = useState<StatsBlockId[]>(() => STATS_BLOCKS.map((b) => b.id));

  const handleExecutePrint = (blockIds: StatsBlockId[]) => {
    setPrintedBlockIds(blockIds);
    setIsPrintModalOpen(false);
    const previousTitle = document.title;
    const clinicCleanName = (clinic?.name ?? "Clínica").replace(/[^a-zA-Z0-9-_\s]/g, " ").replaceAll(/\s+/g, " ").trim();
    document.title = `Estatísticas clínicas - ${clinicCleanName}`;

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = previousTitle;
      }, 1000);
    }, 150);
  };

  const hasBlock = (id: StatsBlockId) => printedBlockIds.includes(id);

  if (!canViewFinancialData || !isFeatureEnabled("dashboards_general")) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 sm:p-6">
        <Button type="button" variant="ghost" className="w-fit gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription>As estatísticas completas usam indicadores financeiros e estão disponíveis apenas para perfis com permissão de tesouraria.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-5 overflow-x-hidden px-4 pb-28 pt-4 sm:p-6 lg:px-8">
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Button type="button" variant="ghost" className="-ml-2 mb-2 gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Estatísticas completas</h1>
            <ComponentHelpButton helpId="clinic-kpis-block" size="sm" />
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Analytics operacionais, financeiros e clínicos para acompanhar a saúde da clínica com mais profundidade.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-fit gap-2"
            onClick={() => navigate(`${clinicHomePath}/configuracoes?secao=forms`)}
          >
            <ClipboardList className="h-4 w-4 text-primary" />
            Formulários & Anamneses
          </Button>
          {canPrintStats && (
            <Button
              type="button"
              variant="outline"
              className="w-fit gap-2 border-primary/40 text-primary hover:bg-primary/5"
              onClick={() => setIsPrintModalOpen(true)}
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          )}
          <Button type="button" variant="outline" className="w-fit gap-2" onClick={() => void invalidateClinicData(clinicId, ["analytics"])}>
            <TrendingUp className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </header>

      {Boolean(platformAccess) && analyticsData.totalPatients === 0 && analyticsData.totalSessions === 0 && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20">Backoffice</span>
            <span>Esta clínica não possui atendimentos ou pacientes registrados para o ano {selectedYear}.</span>
          </div>
          <span className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">Inspecione pelo menu Debug no topo (Cmd+Ctrl+D)</span>
        </div>
      )}

      {/* Navegação por Pílulas no Desktop */}
      <div className="hidden md:flex items-center gap-1.5 border-b border-border/60 pb-3 overflow-x-auto">
        {dashboardSections.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.value;

          return (
            <Button
              key={item.value}
              type="button"
              variant={isActive ? "default" : "outline"}
              size="sm"
              className={`gap-1.5 text-xs font-medium rounded-xl transition-all shrink-0 ${
                isActive ? "shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveSection(item.value)}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Button>
          );
        })}
      </div>

      {/* 1. BENTO BLOCK: VISÃO GERAL & PROPORÇÕES (Visível em overview) */}
      {isSectionActive("overview", activeSection) && (
        <section data-tutorial="clinic-kpis-block" className="flex flex-col gap-4">
          {/* 4 Cards Principais */}
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {analytics.cards.map((metric) => (
              <MetricCard key={metric.title} {...metric} />
            ))}
          </div>

          {/* 4 Cards de Volume por Período */}
          <div className="grid min-w-0 gap-3 grid-cols-2 sm:grid-cols-4">
            <MetricCard detail="atendimentos hoje" icon={CalendarClock} title="Hoje" value={String(analytics.todaySessions)} />
            <MetricCard detail="nesta semana" icon={CalendarClock} title="Esta semana" value={String(analytics.weekSessions)} />
            <MetricCard detail="neste mês" icon={CalendarClock} title="Este mês" value={String(analytics.monthSessions)} />
            <MetricCard detail="no ano" icon={CalendarClock} title="Neste ano" value={String(analytics.yearSessions)} />
          </div>

          {/* 3 Cards de Proporção em Grid 3 Colunas Perfeitas */}
          <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <DashboardProportionCard {...analytics.paymentChart} />
            <DashboardProportionCard {...analytics.agendaChart} />
            <DashboardProportionCard {...analytics.patientStatusChart} />
          </div>
        </section>
      )}

      {/* 2. BENTO BLOCK: FINANCEIRO & FATURAMENTO */}
      {isSectionActive("financial", activeSection) && (
        <section className="flex flex-col gap-4">
          {activeSection === "financial" && (
            <div className="flex items-center justify-between gap-2 border-b pb-2">
              <h2 className="text-lg font-semibold tracking-tight">Métricas Financeiras & Faturamento</h2>
              <span className="text-xs text-muted-foreground">Ano {selectedYear}</span>
            </div>
          )}
          
          <div className="grid min-w-0 gap-4 grid-cols-1 lg:grid-cols-12">
            {/* Receita e Atendimentos no Ano (7 cols) */}
            <Card className="min-w-0 overflow-hidden lg:col-span-7 flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Receita e atendimentos no ano</CardTitle>
                <CardDescription>Pago, em aberto e volume mensal de atendimentos ao longo dos meses.</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 flex-1 flex flex-col justify-center">
                <ChartContainer config={metricChartConfig} className="h-72 w-full sm:h-80">
                  <AreaChart data={analytics.monthlyRevenue} margin={{ bottom: 8, left: -10, right: 12, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="pago" stackId="1" stroke="var(--color-pago)" fill="var(--color-pago)" fillOpacity={0.32} />
                    <Area type="monotone" dataKey="emAberto" stackId="1" stroke="var(--color-emAberto)" fill="var(--color-emAberto)" fillOpacity={0.26} />
                    <Line type="monotone" dataKey="atendimentos" stroke="var(--color-atendimentos)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Status Financeiro Enriquecido dos Atendimentos (5 cols) */}
            <Card className="min-w-0 overflow-hidden lg:col-span-5 flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">Status Financeiro dos Atendimentos</CardTitle>
                  <Badge variant="outline" className="text-xs font-mono">
                    {analytics.totalSessions} sessõ{analytics.totalSessions !== 1 ? "es" : "o"}
                  </Badge>
                </div>
                <CardDescription>
                  Composição detalhada dos atendimentos por situação de cobrança e recebimento.
                </CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 flex-1 flex flex-col justify-between gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  {/* Donut chart com número central */}
                  <div className="sm:col-span-5 flex flex-col items-center justify-center relative min-h-[160px]">
                    <ChartContainer config={pieChartConfig} className="h-44 w-44">
                      <RechartsPieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                        <Pie
                          data={analytics.paymentStatusChart.segments}
                          dataKey="value"
                          nameKey="label"
                          innerRadius={48}
                          outerRadius={72}
                          paddingAngle={3}
                          strokeWidth={2}
                        >
                          {analytics.paymentStatusChart.segments.map((segment) => (
                            <Cell key={segment.label} fill={segment.color} />
                          ))}
                        </Pie>
                      </RechartsPieChart>
                    </ChartContainer>
                    {/* Indicador Central */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="text-2xl font-bold text-foreground leading-none">
                        {analytics.paidSessions}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">
                        Quitados
                      </span>
                    </div>
                  </div>

                  {/* Detalhamento dos Status */}
                  <div className="sm:col-span-7 flex flex-col gap-2">
                    {analytics.paymentStatusChart.segments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum atendimento com status financeiro.</p>
                    ) : (
                      analytics.paymentStatusChart.segments.map((segment) => {
                        const pct = analytics.totalSessions > 0 ? Math.round((segment.value / analytics.totalSessions) * 100) : 0;
                        return (
                          <div
                            key={segment.label}
                            className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
                                style={{ backgroundColor: segment.color }}
                              />
                              <span className="font-medium text-foreground truncate">{segment.label}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 font-mono">
                              <span className="text-muted-foreground font-semibold">
                                {segment.value} {segment.value === 1 ? "sessão" : "sessões"}
                              </span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold">
                                {pct}%
                              </Badge>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                
                {/* Rodapé com totais financeiros */}
                <div className="pt-2.5 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Receita quitada: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatMoney(analytics.financialTotals.paid)}</strong></span>
                  <span>Em aberto: <strong className="text-rose-600 dark:text-rose-400 font-semibold">{formatMoney(analytics.financialTotals.open)}</strong></span>
                </div>
              </CardContent>
            </Card>

            {/* Atendimentos nos últimos 30 dias (7 cols) */}
            <Card className="min-w-0 overflow-hidden lg:col-span-7 flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Atendimentos nos últimos 30 dias</CardTitle>
                <CardDescription>Volume diário para perceber oscilações de agenda e fluxo de pacientes.</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 flex-1 flex flex-col justify-center">
                <ChartContainer config={metricChartConfig} className="h-64 w-full sm:h-72">
                  <LineChart data={analytics.last30Days} margin={{ bottom: 8, left: -18, right: 12, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval={4} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="atendimentos" stroke="var(--color-atendimentos)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Métodos de Pagamento (5 cols) */}
            <div className="lg:col-span-5 flex flex-col">
              <DashboardProportionCard {...analytics.paymentMethodChart} />
            </div>
          </div>
        </section>
      )}

      {/* 3. BENTO BLOCK: PACOTES DE SESSÕES */}
      {isSectionActive("packages", activeSection) && (
        <section className="flex flex-col gap-4">
          {activeSection === "packages" && (
            <div className="flex items-center justify-between gap-2 border-b pb-2">
              <h2 className="text-lg font-semibold tracking-tight">Pacotes & Planos de Tratamento</h2>
              <span className="text-xs text-muted-foreground">{analytics.packageAnalytics.total} pacotes contratados</span>
            </div>
          )}

          {/* KPI Cards de Pacotes */}
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {analytics.packageCards.map((metric) => (
              <MetricCard key={metric.title} {...metric} />
            ))}
          </div>

          {/* Proporções de Pacotes */}
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <DashboardProportionCard {...analytics.packageStatusChart} />
            <DashboardProportionCard {...analytics.packagePaymentChart} />
          </div>

          {/* Lista Detalhada de Pacotes por Paciente */}
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Andamento de Pacotes por Paciente
                </CardTitle>
                <CardDescription>
                  Acompanhe as sessões realizadas, sessões restantes e quitação financeira de cada pacote.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="shrink-0 text-xs font-semibold px-2.5 py-1">
                {analytics.packageAnalytics.plansList.length} pacote{analytics.packageAnalytics.plansList.length !== 1 ? "s" : ""}
              </Badge>
            </CardHeader>
            <CardContent className="min-w-0">
              {analytics.packageAnalytics.plansList.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <Package className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                  Nenhum pacote de sessões cadastrado nesta clínica.
                </div>
              ) : (
                <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                  {analytics.packageAnalytics.plansList.map((plan) => {
                    const isFinished = plan.isCompleted || plan.usedSessions >= plan.totalSessions;
                    const progressPct = plan.totalSessions > 0 ? Math.min(100, Math.round((plan.usedSessions / plan.totalSessions) * 100)) : 0;
                    
                    return (
                      <div
                        key={plan.id}
                        className="group relative flex flex-col justify-between rounded-xl border bg-card/60 p-4 transition-all hover:bg-card hover:shadow-sm hover:border-primary/40"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {plan.patientCode && (
                                  <Badge variant="outline" className="text-[10px] font-mono shrink-0 px-1.5 py-0">
                                    {plan.patientCode}
                                  </Badge>
                                )}
                                <button
                                  type="button"
                                  onClick={() => navigate(getClinicPatientPath(clinicKey || clinic?.slug || clinic?.route_key, plan.patientCode || plan.patientId))}
                                  className="truncate font-semibold text-sm hover:text-primary hover:underline text-left inline-flex items-center gap-1"
                                >
                                  {plan.patientName}
                                  <ChevronRight className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                                </button>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 font-medium truncate">
                                {plan.planName}
                              </p>
                            </div>
                            
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-[10px] font-semibold border ${
                                isFinished
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
                              }`}
                            >
                              {isFinished ? "Concluído" : "Em andamento"}
                            </Badge>
                          </div>

                          {/* Barra de Progresso das Sessões */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-foreground">
                                {plan.usedSessions} de {plan.totalSessions} sessões
                              </span>
                              <span className={`font-semibold ${isFinished ? "text-emerald-600 dark:text-emerald-400" : "text-sky-600 dark:text-sky-400"}`}>
                                {progressPct}%
                              </span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isFinished ? "bg-emerald-500" : "bg-sky-500"
                                }`}
                                style={{ width: `${Math.max(4, progressPct)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                              <span>
                                {plan.remainingSessions > 0 ? (
                                  <>
                                    <strong className="text-foreground font-semibold">{plan.remainingSessions}</strong> sessõ{plan.remainingSessions !== 1 ? "es" : "o"} restante{plan.remainingSessions !== 1 ? "s" : ""}
                                  </>
                                ) : (
                                  "Todas as sessões realizadas"
                                )}
                              </span>
                              {plan.startDate && (
                                <span>Início: {new Date(plan.startDate).toLocaleDateString("pt-BR")}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Rodapé Financeiro do Pacote */}
                        <div className="mt-3.5 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${
                              plan.paymentStatus === "pago"
                                ? "bg-emerald-500"
                                : plan.paymentStatus === "parcial"
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`} />
                            <span className="font-medium capitalize text-muted-foreground">
                              {plan.paymentStatus === "pago"
                                ? "Quitado"
                                : plan.paymentStatus === "parcial"
                                ? "Parcial"
                                : "Pendente"}
                            </span>
                            {plan.paymentInstallments > 1 && (
                              <span className="text-[10px] text-muted-foreground/80 font-mono">
                                ({plan.paymentInstallments}x)
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-foreground">
                            {formatMoney(plan.totalAmountCents)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* 4. BENTO BLOCK: SINTOMAS & AGENDA */}
      {(isSectionActive("agenda", activeSection) || isSectionActive("patients", activeSection)) && (
        <section className="flex flex-col gap-4">
          <div className="grid min-w-0 gap-4 grid-cols-1 lg:grid-cols-12">
            {/* Sintomas mais recorrentes (6 cols) */}
            <Card className="min-w-0 overflow-hidden lg:col-span-6 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">Sintomas mais recorrentes</CardTitle>
                  <Badge variant="outline" className="text-xs font-mono">
                    {analytics.topGroups.reduce((sum, g) => sum + g.total, 0)} atendimentos
                  </Badge>
                </div>
                <CardDescription>
                  Top sintomas e linhas de cuidado vinculados aos atendimentos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 flex-1 flex flex-col justify-center">
                {analytics.topGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Sem sintomas suficientes para análise no período.</p>
                ) : (
                  analytics.topGroups.map((group) => {
                    const maxVal = Math.max(1, analytics.topGroups[0].total);
                    const pct = Math.round((group.total / maxVal) * 100);
                    return (
                      <div key={group.name} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="inline-flex min-w-0 items-center gap-2 font-medium">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full shadow-xs" style={{ backgroundColor: group.color }} />
                            <span className="truncate">{group.name}</span>
                          </span>
                          <span className="text-muted-foreground font-semibold text-xs">{group.total} atendimentos</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              backgroundColor: group.color,
                              width: `${Math.max(6, pct)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Distribuição por Dia da Semana (6 cols) */}
            <Card className="min-w-0 overflow-hidden lg:col-span-6 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Distribuição por dia da semana</CardTitle>
                <CardDescription>Onde a agenda concentra mais atendimentos ao longo da semana.</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 flex-1 flex flex-col justify-center">
                <ChartContainer config={metricChartConfig} className="h-64 w-full sm:h-72">
                  <BarChart data={analytics.weekdayDistribution} margin={{ bottom: 8, left: -18, right: 12, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="atendimentos" fill="var(--color-atendimentos)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* 5. BENTO BLOCK: EQUIPE & LEITURA EXECUTIVA */}
      {isSectionActive("team", activeSection) && (
        <section className="flex flex-col gap-4">
          <div className="grid min-w-0 gap-4 grid-cols-1 lg:grid-cols-12">
            {/* Produtividade por colaborador (6 cols) */}
            <Card className="min-w-0 overflow-hidden lg:col-span-6 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Produtividade por colaborador</CardTitle>
                <CardDescription>Atendimentos e receita quitada associada ao profissional.</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 flex-1 flex flex-col justify-center">
                {analytics.collaborators.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Sem colaboradores associados aos atendimentos.</p>
                ) : (
                  <ChartContainer config={metricChartConfig} className="h-72 w-full sm:h-80">
                    <BarChart data={analytics.collaborators} layout="vertical" margin={{ bottom: 8, left: -12, right: 36, top: 8 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="label" width={120} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="total" name="Atendimentos" fill={colors.blue} radius={[0, 6, 6, 0]}>
                        <LabelList dataKey="total" position="right" style={{ fill: "#0ea5e9", fontSize: 11, fontWeight: 700 }} formatter={(v: number | string) => (Number(v) > 0 ? v : "")} />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Leitura executiva (6 cols) */}
            <Card className="min-w-0 overflow-hidden lg:col-span-6 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Leitura executiva</CardTitle>
                <CardDescription>Sinais rápidos para priorizar ações estratégicas da clínica.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 flex-1 items-center">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ticket médio</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{analytics.totalSessions > 0 ? formatMoney(Math.round(analytics.forecastRevenueCents / analytics.totalSessions)) : formatMoney(0)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">por atendimento registrado</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cancelamento</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{formatPercentage(analytics.cancellationRate)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{analytics.canceledSessions} cancelados</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Média 30 dias</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {compactNumber.format(analytics.last30Days.reduce((sum, day) => sum + day.atendimentos, 0) / 30)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">atendimentos diários</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Meses c/ receita</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {analytics.monthlyRevenue.filter((month) => month.pago + month.emAberto > 0).length}/12
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">meses ativos no ano</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      <ClinicStatsPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        onConfirmPrint={handleExecutePrint}
      />

      {/* ÁREA DE IMPRESSÃO (Renderizada via React Portal diretamente no body) */}
      {createPortal(
        <div id="print-clinic-stats-root" className="hidden print:block font-sans p-4 space-y-3 bg-white text-slate-900">
          <header className="border-b pb-2 mb-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              {clinic?.logo_url ? (
                <img src={clinic.logo_url} alt="" className="h-10 max-w-[130px] object-contain rounded" />
              ) : (
                <img src="/branding/logo/pluri_health_icon_gradient.svg" alt="Pluri-Health" className="h-10 w-10 object-contain" />
              )}
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">{clinic?.name ?? "Pluri-Health"}</h1>
                <h2 className="text-xs text-slate-600 font-medium">Relatório de Estatísticas Completas</h2>
              </div>
            </div>
            <div className="text-right text-[10px] text-slate-600 space-y-0.5">
              <p><span className="font-medium text-slate-500">Gerado em:</span> {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}</p>
              <p><span className="font-semibold text-slate-700">Impresso por:</span> {profile?.full_name || profile?.social_name || user?.email || "Usuário do sistema"}{user?.email && (profile?.full_name || profile?.social_name) ? ` (${user.email})` : ""}</p>
            </div>
          </header>

          {/* 1. Cards de Métricas Gerais (8 cards em grid 4 colunas) */}
          {hasBlock("metrics_cards") && (
            <div className="grid grid-cols-4 gap-2">
              {analytics.cards.map((metric) => (
                <MetricCard key={metric.title} {...metric} compact />
              ))}
              <MetricCard detail="atendimentos hoje" icon={CalendarClock} title="Por dia" value={String(analytics.todaySessions)} compact />
              <MetricCard detail="nesta semana" icon={CalendarClock} title="Por semana" value={String(analytics.weekSessions)} compact />
              <MetricCard detail="neste mês" icon={CalendarClock} title="Por mês" value={String(analytics.monthSessions)} compact />
              <MetricCard detail="no ano" icon={CalendarClock} title="Por ano" value={String(analytics.yearSessions)} compact />
            </div>
          )}

          {/* 2. Cards de Proporção (7 cards em grid 2 colunas) */}
          <div className="grid grid-cols-2 gap-2">
            {hasBlock("payment_chart") && <DashboardProportionCard {...analytics.paymentChart} compact />}
            {hasBlock("agenda_chart") && <DashboardProportionCard {...analytics.agendaChart} compact />}
            {hasBlock("payment_status_chart") && <DashboardProportionCard {...analytics.paymentStatusChart} compact />}
            {hasBlock("patient_status_chart") && <DashboardProportionCard {...analytics.patientStatusChart} compact />}
            {hasBlock("payment_method_chart") && <DashboardProportionCard {...analytics.paymentMethodChart} compact />}
            {hasBlock("packages_summary") && (
              <>
                <DashboardProportionCard {...analytics.packageStatusChart} compact />
                <DashboardProportionCard {...analytics.packagePaymentChart} compact />
              </>
            )}
          </div>

          {/* 3. Gráficos Recharts (4 gráficos em grid 2 colunas) */}
          <div className="grid grid-cols-2 gap-2.5">
            {hasBlock("revenue_area_chart") && (
              <Card className="min-w-0 overflow-hidden border shadow-none bg-slate-50/50">
                <CardHeader className="p-2.5 pb-1">
                  <CardTitle className="text-xs font-bold">Receita e atendimentos no ano</CardTitle>
                  <CardDescription className="text-[10px]">Pago, em aberto e volume mensal.</CardDescription>
                </CardHeader>
                <CardContent className="p-2.5 pt-0 min-w-0 flex justify-center">
                  <ChartContainer config={metricChartConfig} responsive={false} className="h-36 w-full flex justify-center">
                    <AreaChart width={340} height={140} data={analytics.monthlyRevenue} margin={{ bottom: 4, left: -16, right: 8, top: 12 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                      <Area type="monotone" dataKey="pago" stackId="1" stroke="var(--color-pago)" fill="var(--color-pago)" fillOpacity={0.32} />
                      <Area type="monotone" dataKey="emAberto" stackId="1" stroke="var(--color-emAberto)" fill="var(--color-emAberto)" fillOpacity={0.26} />
                      <Line type="monotone" dataKey="atendimentos" stroke="var(--color-atendimentos)" strokeWidth={1.5} dot={true}>
                        <LabelList dataKey="atendimentos" position="top" style={{ fill: "#0ea5e9", fontSize: 8, fontWeight: 700 }} formatter={(v: number | string) => (Number(v) > 0 ? v : "")} />
                      </Line>
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {hasBlock("last30days_chart") && (
              <Card className="min-w-0 overflow-hidden border shadow-none bg-slate-50/50">
                <CardHeader className="p-2.5 pb-1">
                  <CardTitle className="text-xs font-bold">Atendimentos nos últimos 30 dias</CardTitle>
                  <CardDescription className="text-[10px]">Volume diário de atendimentos.</CardDescription>
                </CardHeader>
                <CardContent className="p-2.5 pt-0 min-w-0 flex justify-center">
                  <ChartContainer config={metricChartConfig} responsive={false} className="h-36 w-full flex justify-center">
                    <LineChart width={340} height={140} data={analytics.last30Days} margin={{ bottom: 4, left: -20, right: 8, top: 12 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} interval={5} tick={{ fontSize: 9 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                      <Line type="monotone" dataKey="atendimentos" stroke="var(--color-atendimentos)" strokeWidth={2} dot={true}>
                        <LabelList dataKey="atendimentos" position="top" style={{ fill: "#0ea5e9", fontSize: 8, fontWeight: 700 }} formatter={(v: number | string) => (Number(v) > 0 ? v : "")} />
                      </Line>
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {hasBlock("weekday_chart") && (
              <Card className="min-w-0 overflow-hidden border shadow-none bg-slate-50/50">
                <CardHeader className="p-2.5 pb-1">
                  <CardTitle className="text-xs font-bold">Distribuição por dia da semana</CardTitle>
                  <CardDescription className="text-[10px]">Concentração da agenda semanal.</CardDescription>
                </CardHeader>
                <CardContent className="p-2.5 pt-0 min-w-0 flex justify-center">
                  <ChartContainer config={metricChartConfig} responsive={false} className="h-36 w-full flex justify-center">
                    <BarChart width={340} height={140} data={analytics.weekdayDistribution} margin={{ bottom: 4, left: -20, right: 8, top: 12 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                      <Bar dataKey="atendimentos" fill="var(--color-atendimentos)" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="atendimentos" position="top" style={{ fill: "#0ea5e9", fontSize: 9, fontWeight: 700 }} formatter={(v: number | string) => (Number(v) > 0 ? v : "")} />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {hasBlock("collaborators_chart") && (
              <Card className="min-w-0 overflow-hidden border shadow-none bg-slate-50/50">
                <CardHeader className="p-2.5 pb-1">
                  <CardTitle className="text-xs font-bold">Produtividade por colaborador</CardTitle>
                  <CardDescription className="text-[10px]">Atendimentos associados ao profissional.</CardDescription>
                </CardHeader>
                <CardContent className="p-2.5 pt-0 min-w-0 flex justify-center">
                  {analytics.collaborators.length === 0 ? (
                    <p className="text-[10px] text-slate-500 py-4 text-center">Sem colaboradores associados.</p>
                  ) : (
                    <ChartContainer config={metricChartConfig} responsive={false} className="h-36 w-full flex justify-center">
                      <BarChart width={340} height={140} data={analytics.collaborators} layout="vertical" margin={{ bottom: 4, left: -12, right: 28, top: 4 }}>
                        <CartesianGrid horizontal={false} />
                        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                        <YAxis type="category" dataKey="label" width={110} tickLine={false} axisLine={false} tick={{ fontSize: 8 }} />
                        <Bar dataKey="total" name="Atendimentos" fill={colors.blue} radius={[0, 4, 4, 0]}>
                          <LabelList dataKey="total" position="right" style={{ fill: "#0ea5e9", fontSize: 9, fontWeight: 700 }} formatter={(v: number | string) => (Number(v) > 0 ? v : "")} />
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            )}

            {hasBlock("payment_status_chart") && (
              <Card className="min-w-0 overflow-hidden border shadow-none bg-slate-50/50">
                <CardHeader className="p-2.5 pb-1">
                  <CardTitle className="text-xs font-bold">Status financeiro</CardTitle>
                  <CardDescription className="text-[10px]">Composição dos atendimentos por situação de pagamento.</CardDescription>
                </CardHeader>
                <CardContent className="p-2.5 pt-0 min-w-0 flex items-center justify-between gap-2">
                  <ChartContainer config={pieChartConfig} responsive={false} className="h-32 w-32 flex items-center justify-center shrink-0">
                    <RechartsPieChart width={128} height={128}>
                      <Pie
                        data={analytics.paymentStatusChart.segments}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={30}
                        outerRadius={52}
                        paddingAngle={2}
                      >
                        {analytics.paymentStatusChart.segments.map((segment) => (
                          <Cell key={segment.label} fill={segment.color} />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ChartContainer>
                  <div className="flex-1 space-y-1 text-[10px] min-w-0">
                    {analytics.paymentStatusChart.segments.map((segment) => (
                      <div key={segment.label} className="flex items-center justify-between gap-1.5">
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: segment.color }} />
                          <span className="truncate text-slate-700 font-medium">{segment.label}</span>
                        </span>
                        <span className="font-semibold text-slate-900 shrink-0">{segment.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 4. Grupos + Leitura Executiva em grid 2 colunas */}
          <div className="grid grid-cols-2 gap-2.5">
            {hasBlock("groups_list") && (
              <Card className="min-w-0 overflow-hidden border shadow-none bg-slate-50/50">
                <CardHeader className="p-2.5 pb-1">
                  <CardTitle className="text-xs font-bold">Sintomas mais recorrentes</CardTitle>
                  <CardDescription className="text-[10px]">Top sintomas e linhas de cuidado.</CardDescription>
                </CardHeader>
                <CardContent className="p-2.5 pt-1 space-y-1.5">
                  {analytics.topGroups.length === 0 ? (
                    <p className="text-[10px] text-slate-500">Sem grupos suficientes para análise.</p>
                  ) : (
                    analytics.topGroups.slice(0, 5).map((group) => (
                      <div key={group.name} className="space-y-0.5">
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                            <span className="truncate">{group.name}</span>
                          </span>
                          <span className="text-slate-500 font-semibold">{group.total}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: group.color,
                              width: `${Math.max(6, (group.total / Math.max(1, analytics.topGroups[0].total)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}

            {hasBlock("executive_summary") && (
              <Card className="min-w-0 overflow-hidden border shadow-none bg-slate-50/50">
                <CardHeader className="p-2.5 pb-1">
                  <CardTitle className="text-xs font-bold">Leitura executiva</CardTitle>
                  <CardDescription className="text-[10px]">Indicadores operacionais rápidos.</CardDescription>
                </CardHeader>
                <CardContent className="p-2.5 pt-1 grid gap-2 grid-cols-2">
                  <div className="rounded border bg-white p-2">
                    <p className="text-[10px] text-slate-500">Ticket médio</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{analytics.totalSessions > 0 ? formatMoney(Math.round(analytics.forecastRevenueCents / analytics.totalSessions)) : formatMoney(0)}</p>
                  </div>
                  <div className="rounded border bg-white p-2">
                    <p className="text-[10px] text-slate-500">Cancelamento</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{formatPercentage(analytics.cancellationRate)}</p>
                  </div>
                  <div className="rounded border bg-white p-2">
                    <p className="text-[10px] text-slate-500">Média 30 dias</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {compactNumber.format(analytics.last30Days.reduce((sum, day) => sum + day.atendimentos, 0) / 30)}
                    </p>
                  </div>
                  <div className="rounded border bg-white p-2">
                    <p className="text-[10px] text-slate-500">Meses c/ receita</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {analytics.monthlyRevenue.filter((month) => month.pago + month.emAberto > 0).length}/12
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 4. Listagem Detalhada de Pacotes */}
          {hasBlock("packages_list") && analytics.packageAnalytics.plansList.length > 0 && (
            <div className="pt-1">
              <Card className="min-w-0 overflow-hidden border shadow-none bg-slate-50/50">
                <CardHeader className="p-2.5 pb-1 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-bold">Listagem de Pacotes e Planos</CardTitle>
                    <CardDescription className="text-[10px]">Andamento individual e sessões restantes.</CardDescription>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-600">
                    {analytics.packageAnalytics.plansList.length} pacotes
                  </span>
                </CardHeader>
                <CardContent className="p-2.5 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    {analytics.packageAnalytics.plansList.slice(0, 8).map((plan) => (
                      <div key={plan.id} className="rounded border bg-white p-2 text-[10px] space-y-1">
                        <div className="flex justify-between items-center font-bold">
                          <span className="truncate">{plan.patientName} {plan.patientCode ? `(${plan.patientCode})` : ""}</span>
                          <span className="font-semibold text-slate-700">{formatMoney(plan.totalAmountCents)}</span>
                        </div>
                        <div className="text-slate-500 truncate">{plan.planName}</div>
                        <div className="flex justify-between items-center text-slate-600 pt-0.5">
                          <span>{plan.usedSessions}/{plan.totalSessions} sessões ({plan.progressPercentage}%)</span>
                          <span className="font-medium">{plan.remainingSessions} restantes</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <footer className="pt-2 border-t text-center text-[9px] text-slate-400">
            <p>Documento gerado eletronicamente por Pluri-Health. O manuseio do papel impresso é de responsabilidade do solicitante.</p>
          </footer>
        </div>,
        document.body
      )}

      <nav
        className="designlab-settings-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/94 backdrop-blur supports-[backdrop-filter]:bg-background/88 md:hidden"
        data-dock-state="compact"
      >
        <div className="designlab-settings-mobile-dock flex justify-center gap-1 pb-1">
          {dashboardSections.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.value;

            return (
              <button
                key={item.value}
                type="button"
                className={`designlab-settings-mobile-item group relative flex min-w-0 shrink flex-col items-center justify-center rounded-xl p-[1px] text-center transition-[filter,transform] duration-150 ease-out active:translate-y-0.5 ${
                  isActive ? "is-active" : ""
                }`}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setActiveSection(item.value)}
              >
                <span className="designlab-settings-mobile-tooltip">{item.label}</span>
                <span
                  className={`designlab-settings-mobile-surface flex h-full w-full flex-col items-center justify-center rounded-[0.68rem] border px-2 py-2 transition-colors duration-300 ${
                    isActive ? "border-sky-300/90 bg-sky-50/70 text-sky-700" : "border-border/70 bg-card/92 text-muted-foreground"
                  }`}
                >
                  <span
                    className={`designlab-settings-mobile-icon grid h-7 w-7 place-items-center rounded-lg transition-colors duration-300 ${
                      isActive ? "bg-sky-100 text-sky-600" : "bg-muted/60 text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
};

export default ClinicDashboard;
