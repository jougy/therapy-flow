import { memo, useMemo, useState, useEffect } from "react";
import { BarChart3, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PATIENT_STATUS_OPTIONS } from "@/lib/patient-statuses";
import { PAYMENT_METHOD_OPTIONS, formatMoneyCents } from "@/lib/session-operations";
import { useAuth } from "@/hooks/useAuth";
import {
  useClinicDashboardAnalyticsQuery,
  DEFAULT_CLINIC_ANALYTICS,
  type ClinicDashboardAnalytics,
} from "@/hooks/queries/useClinicDataQueries";
import type { HomeAgendaEventRecord, HomePatientRecord, HomeSessionRecord } from "@/lib/home-patients-view";
import { DashboardProportionCard, formatPercentage } from "./DashboardProportionCard";
import { AffiliateFinancialStatsBlock } from "@/components/marketing/stats/AffiliateFinancialStatsBlock";

const dashboardColors = {
  amber: "#f59e0b",
  blue: "#0ea5e9",
  cyan: "#22d3ee",
  emerald: "#10b981",
  green: "#22c55e",
  lime: "#84cc16",
  rose: "#f43f5e",
  sky: "#38bdf8",
  slate: "#64748b",
  teal: "#14b8a6",
  violet: "#8b5cf6",
  zinc: "#a1a1aa",
};

const formatMoney = (cents: number) => formatMoneyCents(Number.isFinite(cents) ? cents : 0);

interface HomeDashboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId?: string | null;
  patients?: HomePatientRecord[];
  sessions?: HomeSessionRecord[];
  agendaEvents?: HomeAgendaEventRecord[];
  listMode?: string;
  onNavigateForms: () => void;
  onNavigateDashboard: () => void;
}

export const HomeDashboardModal = memo(function HomeDashboardModal({
  open,
  onOpenChange,
  clinicId: propClinicId,
  patients: propPatients,
  sessions: propSessions,
  agendaEvents: propAgendaEvents,
  listMode,
  onNavigateForms,
  onNavigateDashboard,
}: HomeDashboardModalProps) {
  const { clinicId: authClinicId, user, can } = useAuth();
  const clinicId = propClinicId ?? authClinicId;
  const canViewAffiliates = Boolean(typeof can === "function" && can("marketing.affiliates.view"));
  const isAffiliatesListMode = listMode === "affiliates";

  const [activeTab, setActiveTab] = useState<"general" | "affiliates">(
    isAffiliatesListMode ? "affiliates" : "general"
  );

  useEffect(() => {
    if (isAffiliatesListMode) {
      setActiveTab("affiliates");
    }
  }, [isAffiliatesListMode]);

  const { data: analyticsData = DEFAULT_CLINIC_ANALYTICS, isLoading } = useClinicDashboardAnalyticsQuery(
    clinicId,
    undefined,
    open && activeTab === "general" && Boolean(clinicId) && Boolean(user)
  );

  const resolvedAnalytics = useMemo<ClinicDashboardAnalytics>(() => {
    if (analyticsData && (analyticsData.totalPatients > 0 || analyticsData.totalSessions > 0)) {
      return analyticsData;
    }

    if (propPatients && propPatients.length > 0) {
      const patientStatusCounts: Record<string, number> = {};
      let recurringPatients = 0;
      propPatients.forEach((p) => {
        const s = p.status || "ativo";
        patientStatusCounts[s] = (patientStatusCounts[s] ?? 0) + 1;
        if (p.is_recurring || (Array.isArray(p.recurring_weekdays) && p.recurring_weekdays.length > 0)) {
          recurringPatients += 1;
        }
      });

      const paymentMethodCounts: Record<string, number> = {};
      const paymentStatusCounts: Record<string, number> = {};
      let paidSessions = 0;
      let canceledSessions = 0;
      let financialPaid = 0;
      let financialCredit = 0;
      let financialOpen = 0;

      (propSessions ?? []).forEach((sess) => {
        if (sess.status === "cancelado") {
          canceledSessions += 1;
        }
        if (sess.payment_method) {
          paymentMethodCounts[sess.payment_method] = (paymentMethodCounts[sess.payment_method] ?? 0) + 1;
        }
        const charged = sess.amount_charged_cents ?? 0;
        const paid = sess.amount_paid_cents ?? 0;
        if (charged > 0 && paid >= charged) {
          paidSessions += 1;
          paymentStatusCounts["paid"] = (paymentStatusCounts["paid"] ?? 0) + 1;
        } else if (charged > 0 && paid > 0 && paid < charged) {
          paymentStatusCounts["debt"] = (paymentStatusCounts["debt"] ?? 0) + 1;
        } else if (charged > 0 && paid <= 0) {
          paymentStatusCounts["pending"] = (paymentStatusCounts["pending"] ?? 0) + 1;
        } else if (paid > charged) {
          paymentStatusCounts["credit"] = (paymentStatusCounts["credit"] ?? 0) + 1;
        }

        financialPaid += Math.min(paid, charged);
        financialCredit += Math.max(0, paid - charged);
        financialOpen += Math.max(0, charged - paid);
      });

      let agendaLate = 0;
      let agendaConfirmed = 0;
      let agendaAwaiting = 0;
      const now = new Date();
      (propAgendaEvents ?? []).forEach((ev) => {
        if (ev.status === "cancelado") return;
        const dt = ev.scheduled_for ? new Date(ev.scheduled_for) : null;
        if (dt && dt < now) {
          agendaLate += 1;
        } else if (ev.status === "confirmado") {
          agendaConfirmed += 1;
        } else {
          agendaAwaiting += 1;
        }
      });

      const totalSessions = propSessions?.length ?? 0;
      return {
        ...DEFAULT_CLINIC_ANALYTICS,
        totalPatients: propPatients.length,
        recurringPatients,
        patientStatusCounts,
        totalSessions,
        paidSessions,
        canceledSessions,
        cancellationRate: totalSessions > 0 ? Math.round((canceledSessions / totalSessions) * 100) : 0,
        financialTotals: {
          paid: financialPaid,
          credit: financialCredit,
          open: financialOpen,
          forecastRevenueCents: financialPaid + financialCredit + financialOpen,
        },
        paymentMethodCounts,
        paymentStatusCounts,
        agendaCounts: {
          late: agendaLate,
          confirmed: agendaConfirmed,
          awaiting: agendaAwaiting,
          total: (propAgendaEvents ?? []).filter((e) => e.status !== "cancelado").length,
        },
      };
    }

    return analyticsData;
  }, [analyticsData, propPatients, propSessions, propAgendaEvents]);

  const data = useMemo(() => {
    if (!open || activeTab !== "general") return null;

    const totalPatients = resolvedAnalytics.totalPatients;
    const totalSessions = resolvedAnalytics.totalSessions;
    const canceledSessions = resolvedAnalytics.canceledSessions;
    const paidSessions = resolvedAnalytics.paidSessions;
    const financialTotals = resolvedAnalytics.financialTotals;
    const forecastRevenueCents = financialTotals.forecastRevenueCents;

    const patientStatusCounts = PATIENT_STATUS_OPTIONS.filter((opt) => opt.value !== "pagamento_pendente")
      .map((statusOption) => ({
        color:
          statusOption.value === "ativo"
            ? dashboardColors.emerald
            : statusOption.value === "pausado"
            ? dashboardColors.amber
            : statusOption.value === "alta"
            ? dashboardColors.sky
            : statusOption.value === "inativo"
            ? dashboardColors.slate
            : dashboardColors.zinc,
        label: statusOption.label,
        value: resolvedAnalytics.patientStatusCounts[statusOption.value] ?? 0,
      }))
      .filter((segment) => segment.value > 0);

    const paymentMethodSegments = PAYMENT_METHOD_OPTIONS.map((option) => ({
      color:
        option.value === "dinheiro"
          ? dashboardColors.emerald
          : option.value === "pix"
          ? dashboardColors.blue
          : option.value === "cartao_debito"
          ? dashboardColors.sky
          : option.value === "cartao_credito"
          ? dashboardColors.violet
          : option.value === "convenio"
          ? dashboardColors.amber
          : option.value === "transferencia"
          ? dashboardColors.slate
          : option.value === "credito_usado"
          ? dashboardColors.cyan
          : option.value === "cortesia"
          ? dashboardColors.lime
          : dashboardColors.zinc,
      label: option.label,
      value: resolvedAnalytics.paymentMethodCounts[option.value] ?? 0,
    })).filter((segment) => segment.value > 0);

    return {
      cards: [
        { detail: "atendimentos registrados", title: "Total de atendimentos", value: String(totalSessions) },
        { detail: "atendimentos quitados", title: "Pagamentos concluídos", value: String(paidSessions) },
        {
          detail: `${canceledSessions} cancelado${canceledSessions !== 1 ? "s" : ""}`,
          title: "Índice de cancelamento",
          value: formatPercentage(resolvedAnalytics.cancellationRate),
        },
      ],
      paymentChart: {
        formatSegmentValue: formatMoney,
        segments: [
          { color: dashboardColors.emerald, label: "Pago", value: financialTotals.paid },
          { color: dashboardColors.blue, label: "Crédito", value: financialTotals.credit },
          { color: dashboardColors.rose, label: "Em aberto", value: financialTotals.open },
        ].filter((segment) => segment.value > 0),
        subtitle: `Pago ${formatMoney(financialTotals.paid)} · crédito ${formatMoney(financialTotals.credit)} · em aberto ${formatMoney(financialTotals.open)}`,
        title: "Receita registrada",
        value: formatMoney(forecastRevenueCents),
      },
      patientStatusChart: {
        segments: patientStatusCounts,
        subtitle: `${totalPatients} paciente${totalPatients !== 1 ? "s" : ""} no cadastro`,
        title: "Pacientes por status",
        value: String(totalPatients),
      },
      agendaChart: {
        formatSegmentValue: (value: number) => String(value),
        segments: [
          { color: dashboardColors.rose, label: "Atrasado", value: resolvedAnalytics.agendaCounts.late },
          { color: dashboardColors.emerald, label: "Confirmado", value: resolvedAnalytics.agendaCounts.confirmed },
          { color: dashboardColors.amber, label: "Aguardando confirmação", value: resolvedAnalytics.agendaCounts.awaiting },
        ].filter((segment) => segment.value > 0),
        subtitle: `${resolvedAnalytics.agendaCounts.total} agendamento${resolvedAnalytics.agendaCounts.total !== 1 ? "s" : ""} ativo${resolvedAnalytics.agendaCounts.total !== 1 ? "s" : ""}`,
        title: "Agenda de atendimentos",
        value: String(resolvedAnalytics.agendaCounts.total),
      },
      paymentStatusChart: {
        formatSegmentValue: (value: number) => String(value),
        segments: [
          { color: dashboardColors.blue, label: "Crédito", value: resolvedAnalytics.paymentStatusCounts.credit ?? 0 },
          { color: dashboardColors.rose, label: "Devendo", value: resolvedAnalytics.paymentStatusCounts.debt ?? 0 },
          { color: dashboardColors.amber, label: "Pendente", value: resolvedAnalytics.paymentStatusCounts.pending ?? 0 },
          { color: dashboardColors.emerald, label: "Pago", value: resolvedAnalytics.paymentStatusCounts.paid ?? 0 },
          {
            color: dashboardColors.violet,
            label: "Cortesia",
            value: (resolvedAnalytics.paymentStatusCounts.cortesia ?? resolvedAnalytics.paymentStatusCounts.courtesy) ?? 0,
          },
          { color: dashboardColors.slate, label: "Não cobrado", value: resolvedAnalytics.paymentStatusCounts.notCharged ?? 0 },
        ].filter((segment) => segment.value > 0),
        subtitle: `${totalSessions} atendimento${totalSessions !== 1 ? "s" : ""} com status financeiro`,
        title: "Status de pagamento",
        value: String(totalSessions),
      },
      paymentMethodChart: {
        formatSegmentValue: (value: number) => String(value),
        segments: paymentMethodSegments,
        subtitle: `${totalSessions} atendimento${totalSessions !== 1 ? "s" : ""} registrado${totalSessions !== 1 ? "s" : ""}`,
        title: "Método de pagamento",
        value: String(totalSessions),
      },
      packageStatusChart: {
        formatSegmentValue: (value: number) => String(value),
        segments: [
          { color: dashboardColors.blue, label: "Em andamento", value: resolvedAnalytics.packageAnalytics?.inProgress ?? 0 },
          { color: dashboardColors.emerald, label: "Concluído", value: resolvedAnalytics.packageAnalytics?.completed ?? 0 },
          { color: dashboardColors.rose, label: "Cancelado", value: resolvedAnalytics.packageAnalytics?.canceled ?? 0 },
        ].filter((s) => s.value > 0),
        subtitle: `${resolvedAnalytics.packageAnalytics?.total ?? 0} pacote${(resolvedAnalytics.packageAnalytics?.total ?? 0) !== 1 ? "s" : ""} · ${resolvedAnalytics.packageAnalytics?.totalSessionsRemaining ?? 0} sessões restantes a realizar`,
        title: "Pacotes de sessões",
        value: String(resolvedAnalytics.packageAnalytics?.total ?? 0),
      },
      volumeMetrics: [
        {
          detail: "atendimentos hoje",
          title: "Quantidade por dia",
          value: String(resolvedAnalytics.todaySessions),
        },
        {
          detail: "atendimentos nesta semana",
          title: "Quantidade por semana",
          value: String(resolvedAnalytics.weekSessions),
        },
        {
          detail: "atendimentos neste mês",
          title: "Quantidade por mês",
          value: String(resolvedAnalytics.monthSessions),
        },
      ],
    };
  }, [open, activeTab, resolvedAnalytics]);

  if (!open) return null;

  const showTabToggle = canViewAffiliates || isAffiliatesListMode;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-4xl sm:p-6">
        <DialogHeader className="gap-3 text-left sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <DialogTitle>
              {activeTab === "affiliates" ? "Resumo Geral de Afiliados" : "Resumo geral"}
            </DialogTitle>
            <DialogDescription>
              {activeTab === "affiliates"
                ? "Indicadores financeiros de comissões, saldo Asaas e compliance fiscal do programa de parceiros."
                : "Indicadores rápidos da clínica para acompanhar operação, atendimentos e pagamentos."}
            </DialogDescription>
            {showTabToggle && (
              <div className="pt-1">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border w-fit">
                  <Button
                    type="button"
                    size="sm"
                    variant={activeTab === "general" ? "default" : "ghost"}
                    onClick={() => setActiveTab("general")}
                    className="min-h-[44px] sm:min-h-[36px] text-xs h-9 touch-manipulation"
                  >
                    Visão Clínica
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeTab === "affiliates" ? "default" : "ghost"}
                    onClick={() => setActiveTab("affiliates")}
                    className="min-h-[44px] sm:min-h-[36px] text-xs h-9 touch-manipulation"
                  >
                    Afiliados & Parcerias
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "general" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit gap-2 min-h-[44px] touch-manipulation"
                  onClick={() => {
                    onOpenChange(false);
                    onNavigateForms();
                  }}
                >
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Formulários & Anamneses
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit gap-2 min-h-[44px] touch-manipulation"
                  onClick={() => {
                    onOpenChange(false);
                    onNavigateDashboard();
                  }}
                >
                  <BarChart3 className="h-4 w-4" />
                  Estatísticas completas
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-fit gap-2 min-h-[44px] touch-manipulation"
                onClick={() => {
                  onOpenChange(false);
                  onNavigateDashboard();
                }}
              >
                <BarChart3 className="h-4 w-4" />
                Estatísticas completas de afiliados
              </Button>
            )}
          </div>
        </DialogHeader>

        {activeTab === "affiliates" ? (
          <AffiliateFinancialStatsBlock
            clinicId={clinicId}
            onNavigateFullStats={() => {
              onOpenChange(false);
              onNavigateDashboard();
            }}
          />
        ) : isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-40 w-full sm:col-span-2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          data && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <DashboardProportionCard {...data.paymentChart} />
              </div>
              <DashboardProportionCard {...data.packageStatusChart} />
              <DashboardProportionCard {...data.agendaChart} />
              <DashboardProportionCard {...data.paymentStatusChart} />
              <DashboardProportionCard {...data.patientStatusChart} />
              <DashboardProportionCard {...data.paymentMethodChart} />
              {data.cards.map((metric) => (
                <Card key={metric.title} className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.title}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{metric.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{metric.detail}</p>
                </Card>
              ))}
              {data.volumeMetrics.map((metric) => (
                <Card key={metric.title} className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.title}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{metric.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{metric.detail}</p>
                </Card>
              ))}
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
});
