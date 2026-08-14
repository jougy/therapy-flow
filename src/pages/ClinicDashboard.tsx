import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
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
import { Activity, ArrowLeft, BarChart3, CalendarClock, CreditCard, Loader2, PieChart, Printer, TrendingUp, UsersRound, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { logRuntimeError } from "@/lib/runtime-debug";
import { getLegacyGroupHex } from "@/lib/group-colors";
import { PATIENT_STATUS_OPTIONS } from "@/lib/patient-statuses";
import { formatMoneyCents, getPaymentMethodLabel, MAX_SESSION_AMOUNT_CENTS, PAYMENT_METHOD_OPTIONS } from "@/lib/session-operations";
import type { HomeAgendaEventRecord, HomePatientGroupRecord, HomePatientRecord, HomeSessionRecord } from "@/lib/home-patients-view";
import { ClinicStatsPrintModal, STATS_BLOCKS, type StatsBlockId } from "@/components/ClinicStatsPrintModal";

type PatientGroupRow = Database["public"]["Tables"]["patient_groups"]["Row"];
type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "email" | "full_name" | "id" | "job_title" | "public_code" | "social_name">;
type PatientGroupWithColorSlot = PatientGroupRow & {
  clinic_group_color_slots?: { color_hex: string | null } | null;
};

type Segment = {
  color: string;
  label: string;
  value: number;
};

type DashboardSection = "overview" | "financial" | "agenda" | "patients" | "team";

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

const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const sanitizeCents = (value: number | null | undefined) => {
  if (!Number.isFinite(value ?? 0)) {
    return 0;
  }

  return Math.min(MAX_SESSION_AMOUNT_CENTS, Math.max(0, Math.round(value ?? 0)));
};

const formatMoney = (cents: number) => formatMoneyCents(sanitizeCents(cents));

const toLocalDate = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const getStartOfWeek = (reference: Date) => {
  const result = toLocalDate(reference);
  const weekday = result.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  result.setDate(result.getDate() + diff);
  return result;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatPercentage = (value: number) => `${Math.round(Number.isFinite(value) ? value : 0)}%`;

const resolveGroupColor = (group: PatientGroupWithColorSlot) =>
  group.clinic_group_color_slots?.color_hex ?? getLegacyGroupHex(group.color);

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
  { icon: CalendarClock, label: "Agenda", value: "agenda" },
  { icon: UsersRound, label: "Pacientes", value: "patients" },
  { icon: BarChart3, label: "Equipe", value: "team" },
];

const metricChartConfig = {
  atendimentos: { color: colors.blue, label: "Atendimentos" },
  emAberto: { color: colors.rose, label: "Em aberto" },
  pago: { color: colors.emerald, label: "Pago" },
  receita: { color: colors.emerald, label: "Receita" },
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

const mobileSectionClass = (section: DashboardSection, activeSection: DashboardSection) =>
  section === activeSection ? "grid" : "hidden md:grid";

const ClinicDashboard = () => {
  const navigate = useNavigate();
  const { can, clinic, clinicId, profile, user } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const [patients, setPatients] = useState<HomePatientRecord[]>([]);
  const [groups, setGroups] = useState<HomePatientGroupRecord[]>([]);
  const [sessions, setSessions] = useState<HomeSessionRecord[]>([]);
  const [agendaEvents, setAgendaEvents] = useState<HomeAgendaEventRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<DashboardSection>("overview");
  const canViewFinancialData = can("treasury.manage");

  const fetchData = useCallback(async () => {
    if (!user) {
      return;
    }

    setLoading(true);

    const [patientsRes, groupsRes, sessionsRes, agendaEventsRes, profilesRes] = await Promise.all([
      supabase.from("patients").select("*").order("updated_at", { ascending: false }),
      supabase.from("patient_groups").select("*, clinic_group_color_slots(color_hex)"),
      supabase.from("sessions").select("*"),
      supabase
        .from("agenda_events")
        .select("id, patient_id, title, event_type, status, scheduled_for")
        .order("scheduled_for", { ascending: true }),
      supabase.from("profiles").select("id, full_name, social_name, email, job_title, public_code"),
    ]);

    if (patientsRes.error || groupsRes.error || sessionsRes.error || agendaEventsRes.error || profilesRes.error) {
      logRuntimeError("clinic_dashboard.fetch", patientsRes.error ?? groupsRes.error ?? sessionsRes.error ?? agendaEventsRes.error ?? profilesRes.error, {
        clinicId,
      });
    }

    setPatients((patientsRes.data ?? []) as HomePatientRecord[]);
    setGroups(((groupsRes.data ?? []) as PatientGroupWithColorSlot[]).map((group) => ({
      color: resolveGroupColor(group),
      id: group.id,
      name: group.name,
      patient_id: group.patient_id,
      status: group.status,
    })));
    setSessions((sessionsRes.data ?? []) as HomeSessionRecord[]);
    setAgendaEvents((agendaEventsRes.data ?? []) as HomeAgendaEventRecord[]);
    setProfiles((profilesRes.data ?? []) as ProfileRow[]);
    setLoading(false);
  }, [clinicId, user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const analytics = useMemo(() => {
    const now = new Date();
    const today = toLocalDate(now);
    const startOfWeek = getStartOfWeek(now);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const groupById = new Map(groups.filter((group) => group.id).map((group) => [group.id as string, group]));
    const patientGroupsByPatientId = new Map<string, HomePatientGroupRecord[]>();
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

    groups.forEach((group) => {
      patientGroupsByPatientId.set(group.patient_id, [...(patientGroupsByPatientId.get(group.patient_id) ?? []), group]);
    });

    const getSessionGroup = (session: HomeSessionRecord) => {
      if (session.group_id) {
        return groupById.get(session.group_id) ?? null;
      }

      return patientGroupsByPatientId.get(session.patient_id)?.[0] ?? null;
    };

    const financialTotals = sessions.reduce(
      (totals, session) => {
        if (session.payment_status === "cortesia") {
          return totals;
        }

        const charged = sanitizeCents(session.amount_charged_cents);
        const paid = sanitizeCents(session.amount_paid_cents);

        totals.paid += Math.min(paid, charged);
        totals.credit += Math.max(0, paid - charged);
        totals.open += Math.max(0, charged - paid);

        return totals;
      },
      { credit: 0, open: 0, paid: 0 },
    );
    const forecastRevenueCents = financialTotals.paid + financialTotals.credit + financialTotals.open;
    const paidSessions = sessions.filter((session) => {
      const charged = sanitizeCents(session.amount_charged_cents);
      const paid = sanitizeCents(session.amount_paid_cents);
      return charged > 0 && paid >= charged;
    }).length;
    const canceledSessions = sessions.filter((session) => session.status === "cancelado").length;
    const activeAgendaEvents = agendaEvents.filter((event) => event.status !== "cancelado" && Number.isFinite(new Date(event.scheduled_for).getTime()));
    const lateAgendaEvents = activeAgendaEvents.filter((event) => new Date(event.scheduled_for).getTime() < now.getTime()).length;
    const confirmedAgendaEvents = activeAgendaEvents.filter((event) => new Date(event.scheduled_for).getTime() >= now.getTime() && event.status === "confirmado").length;
    const awaitingAgendaEvents = activeAgendaEvents.filter((event) => new Date(event.scheduled_for).getTime() >= now.getTime() && event.status !== "confirmado").length;
    const paymentStatusCounts = sessions.reduce(
      (counts, session) => {
        const charged = sanitizeCents(session.amount_charged_cents);
        const paid = sanitizeCents(session.amount_paid_cents);

        if (session.payment_status === "cortesia") counts.courtesy += 1;
        else if (paid > charged) counts.credit += 1;
        else if (charged > 0 && paid > 0 && paid < charged) counts.debt += 1;
        else if (charged > 0 && paid <= 0) counts.pending += 1;
        else if (charged > 0 && paid >= charged) counts.paid += 1;
        else counts.notCharged += 1;

        return counts;
      },
      { courtesy: 0, credit: 0, debt: 0, notCharged: 0, paid: 0, pending: 0 },
    );
    const paymentMethodCounts = sessions.reduce<Record<string, number>>((counts, session) => {
      const method = session.payment_status === "cortesia"
        ? "cortesia"
        : typeof session.payment_method === "string" ? session.payment_method : "nao_informado";
      counts[method] = (counts[method] ?? 0) + 1;
      return counts;
    }, {});
    const patientStatusSegments = PATIENT_STATUS_OPTIONS.filter((option) => option.value !== "pagamento_pendente")
      .map((option) => ({
        color: statusColor(option.value),
        label: option.label,
        value: patients.filter((patient) => patient.status === option.value).length,
      }))
      .filter((segment) => segment.value > 0);
    const paymentMethodSegments = PAYMENT_METHOD_OPTIONS.map((option) => ({
      color: paymentMethodColor(option.value),
      label: option.label,
      value: paymentMethodCounts[option.value] ?? 0,
    })).filter((segment) => segment.value > 0);
    const paymentStatusSegments = [
      { color: colors.blue, label: "Crédito", value: paymentStatusCounts.credit },
      { color: colors.rose, label: "Devendo", value: paymentStatusCounts.debt },
      { color: colors.amber, label: "Pendente", value: paymentStatusCounts.pending },
      { color: colors.emerald, label: "Pago", value: paymentStatusCounts.paid },
      { color: colors.violet, label: "Cortesia", value: paymentStatusCounts.courtesy },
      { color: colors.slate, label: "Não cobrado", value: paymentStatusCounts.notCharged },
    ].filter((segment) => segment.value > 0);

    const monthlyRevenue = monthLabels.map((label, month) => {
      const monthSessions = sessions.filter((session) => {
        const date = new Date(session.session_date);
        return date.getFullYear() === now.getFullYear() && date.getMonth() === month;
      });
      const totals = monthSessions.reduce(
        (acc, session) => {
          if (session.payment_status === "cortesia") {
            return acc;
          }
          const charged = sanitizeCents(session.amount_charged_cents);
          const paid = sanitizeCents(session.amount_paid_cents);
          acc.pago += Math.min(paid, charged) / 100;
          acc.emAberto += Math.max(0, charged - paid) / 100;
          return acc;
        },
        { emAberto: 0, pago: 0 },
      );

      return {
        ...totals,
        atendimentos: monthSessions.length,
        label,
      };
    });
    const last30Days = Array.from({ length: 30 }, (_, index) => {
      const date = addDays(today, index - 29);
      const key = getDayKey(date);
      const daySessions = sessions.filter((session) => getDayKey(toLocalDate(session.session_date)) === key);

      return {
        atendimentos: daySessions.length,
        label: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
      };
    });
    const weekdayDistribution = weekdayLabels.map((label, weekday) => ({
      atendimentos: sessions.filter((session) => new Date(session.session_date).getDay() === weekday).length,
      label,
    }));
    const groupCounts = new Map<string, { color: string; name: string; total: number }>();
    sessions.forEach((session) => {
      const group = getSessionGroup(session);
      if (!group) {
        return;
      }
      const current = groupCounts.get(group.name) ?? { color: group.color, name: group.name, total: 0 };
      current.total += 1;
      groupCounts.set(group.name, current);
    });
    const topGroups = Array.from(groupCounts.values()).sort((left, right) => right.total - left.total).slice(0, 8);
    const collaboratorCounts = new Map<string, { label: string; receita: number; total: number }>();
    sessions.forEach((session) => {
      const collaboratorId = session.provider_id || session.user_id || "desconhecido";
      const profile = profileById.get(collaboratorId);
      const rawName = (profile?.social_name || profile?.full_name || profile?.email || "").trim();
      const label = rawName
        ? rawName
        : profile?.public_code
          ? `Colaborador ${profile.public_code}`
          : collaboratorId !== "desconhecido"
            ? `Profissional #${collaboratorId.slice(0, 6)}`
            : "Profissional não especificado";

      const current = collaboratorCounts.get(collaboratorId) ?? {
        label,
        receita: 0,
        total: 0,
      };
      const charged = sanitizeCents(session.amount_charged_cents);
      const paid = sanitizeCents(session.amount_paid_cents);
      current.total += 1;
      current.receita += Math.min(paid, charged) / 100;
      collaboratorCounts.set(collaboratorId, current);
    });
    const collaborators = Array.from(collaboratorCounts.values()).sort((left, right) => right.total - left.total).slice(0, 8);
    const monthSessions = sessions.filter((session) => toLocalDate(session.session_date).getTime() >= startOfMonth.getTime());
    const yearSessions = sessions.filter((session) => toLocalDate(session.session_date).getTime() >= startOfYear.getTime());
    const recurringPatients = patients.filter((patient) => (patient.recurring_weekdays ?? []).length > 0).length;

    return {
      agendaChart: {
        formatSegmentValue: (value: number) => String(value),
        segments: [
          { color: colors.rose, label: "Atrasado", value: lateAgendaEvents },
          { color: colors.emerald, label: "Confirmado", value: confirmedAgendaEvents },
          { color: colors.amber, label: "Aguardando confirmação", value: awaitingAgendaEvents },
        ].filter((segment) => segment.value > 0),
        subtitle: `${activeAgendaEvents.length} agendamento${activeAgendaEvents.length !== 1 ? "s" : ""} ativo${activeAgendaEvents.length !== 1 ? "s" : ""}`,
        title: "Agenda de atendimentos",
        value: String(activeAgendaEvents.length),
      },
      cancellationRate: sessions.length > 0 ? (canceledSessions / sessions.length) * 100 : 0,
      cards: [
        { detail: "atendimentos registrados", icon: CalendarClock, title: "Total de atendimentos", value: String(sessions.length) },
        { detail: "atendimentos quitados", icon: CreditCard, title: "Pagamentos concluídos", value: String(paidSessions) },
        { detail: `${canceledSessions} cancelado${canceledSessions !== 1 ? "s" : ""}`, icon: BarChart3, title: "Índice de cancelamento", value: formatPercentage(sessions.length > 0 ? (canceledSessions / sessions.length) * 100 : 0) },
        { detail: "pacientes com recorrência configurada", icon: UsersRound, title: "Recorrência", value: `${formatPercentage(patients.length > 0 ? (recurringPatients / patients.length) * 100 : 0)}` },
      ],
      collaborators,
      forecastRevenueCents,
      last30Days,
      monthSessions: monthSessions.length,
      monthlyRevenue,
      patientStatusChart: {
        segments: patientStatusSegments,
        subtitle: `${patients.length} paciente${patients.length !== 1 ? "s" : ""} no cadastro`,
        title: "Pacientes por status",
        value: String(patients.length),
      },
      paymentChart: {
        formatSegmentValue: formatMoney,
        segments: [
          { color: colors.emerald, label: "Pago", value: financialTotals.paid },
          { color: colors.blue, label: "Crédito", value: financialTotals.credit },
          { color: colors.rose, label: "Em aberto", value: financialTotals.open },
        ].filter((segment) => segment.value > 0),
        subtitle: `Pago ${formatMoney(financialTotals.paid)} · crédito ${formatMoney(financialTotals.credit)} · em aberto ${formatMoney(financialTotals.open)}`,
        title: "Receita registrada",
        value: formatMoney(forecastRevenueCents),
      },
      paymentMethodChart: {
        formatSegmentValue: (value: number) => String(value),
        segments: paymentMethodSegments,
        subtitle: `${sessions.length} atendimento${sessions.length !== 1 ? "s" : ""} registrado${sessions.length !== 1 ? "s" : ""}`,
        title: "Método de pagamento",
        value: String(sessions.length),
      },
      paymentStatusChart: {
        formatSegmentValue: (value: number) => String(value),
        segments: paymentStatusSegments,
        subtitle: `${sessions.length} atendimento${sessions.length !== 1 ? "s" : ""} com status financeiro`,
        title: "Status de pagamento",
        value: String(sessions.length),
      },
      topGroups,
      todaySessions: sessions.filter((session) => toLocalDate(session.session_date).getTime() === today.getTime()).length,
      weekSessions: sessions.filter((session) => toLocalDate(session.session_date).getTime() >= startOfWeek.getTime()).length,
      weekdayDistribution,
      yearSessions: yearSessions.length,
    };
  }, [agendaEvents, groups, patients, profiles, sessions]);

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
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-5 overflow-x-hidden px-4 pb-28 pt-4 sm:p-6 lg:px-8">
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Button type="button" variant="ghost" className="-ml-2 mb-2 gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Estatísticas completas</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Analytics operacionais, financeiros e clínicos para acompanhar a saúde da clínica com mais profundidade.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button type="button" variant="outline" className="w-fit gap-2" onClick={() => void fetchData()}>
            <TrendingUp className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </header>

      <section className={`${mobileSectionClass("overview", activeSection)} min-w-0 gap-3 lg:grid-cols-2`}>
        <div className="lg:col-span-2">
          <DashboardProportionCard {...analytics.paymentChart} />
        </div>
        <DashboardProportionCard {...analytics.agendaChart} />
        <DashboardProportionCard {...analytics.paymentStatusChart} />
        <DashboardProportionCard {...analytics.patientStatusChart} />
        <DashboardProportionCard {...analytics.paymentMethodChart} />
      </section>

      <section className={`${mobileSectionClass("overview", activeSection)} min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4`}>
        {analytics.cards.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
        <MetricCard detail="atendimentos hoje" icon={CalendarClock} title="Quantidade por dia" value={String(analytics.todaySessions)} />
        <MetricCard detail="atendimentos nesta semana" icon={CalendarClock} title="Quantidade por semana" value={String(analytics.weekSessions)} />
        <MetricCard detail="atendimentos neste mês" icon={CalendarClock} title="Quantidade por mês" value={String(analytics.monthSessions)} />
        <MetricCard detail="atendimentos no ano" icon={CalendarClock} title="Quantidade por ano" value={String(analytics.yearSessions)} />
      </section>

      <section className={`${mobileSectionClass("financial", activeSection)} min-w-0 gap-4 xl:grid-cols-2`}>
        <div className="md:hidden">
          <DashboardProportionCard {...analytics.paymentChart} />
        </div>
        <div className="md:hidden">
          <DashboardProportionCard {...analytics.paymentStatusChart} />
        </div>
        <div className="md:hidden">
          <DashboardProportionCard {...analytics.paymentMethodChart} />
        </div>
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Receita e atendimentos no ano</CardTitle>
            <CardDescription>Pago, em aberto e volume mensal de atendimentos.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
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

        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Atendimentos nos últimos 30 dias</CardTitle>
            <CardDescription>Volume diário para perceber oscilações de agenda.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <ChartContainer config={metricChartConfig} className="h-72 w-full sm:h-80">
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
      </section>

      <section className={`${mobileSectionClass("agenda", activeSection)} min-w-0 gap-4 xl:grid-cols-3`}>
        <div className="md:hidden">
          <DashboardProportionCard {...analytics.agendaChart} />
        </div>
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por dia da semana</CardTitle>
            <CardDescription>Onde a agenda concentra mais atendimentos.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
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
      </section>

      <section className={`${mobileSectionClass("patients", activeSection)} min-w-0 gap-4 xl:grid-cols-3`}>
        <div className="md:hidden">
          <DashboardProportionCard {...analytics.patientStatusChart} />
        </div>
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Grupos mais recorrentes</CardTitle>
            <CardDescription>Top grupos vinculados aos atendimentos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.topGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem grupos suficientes para análise.</p>
            ) : (
              analytics.topGroups.map((group) => (
                <div key={group.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="inline-flex min-w-0 items-center gap-2 font-medium">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                      <span className="truncate">{group.name}</span>
                    </span>
                    <span className="text-muted-foreground">{group.total}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
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

        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Status financeiro</CardTitle>
            <CardDescription>Composição dos atendimentos por situação de pagamento.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <ChartContainer config={pieChartConfig} className="h-64 w-full sm:h-72">
              <RechartsPieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                <Pie data={analytics.paymentStatusChart.segments} dataKey="value" nameKey="label" innerRadius={54} outerRadius={92} paddingAngle={2}>
                  {analytics.paymentStatusChart.segments.map((segment) => (
                    <Cell key={segment.label} fill={segment.color} />
                  ))}
                </Pie>
              </RechartsPieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </section>

      <section className={`${mobileSectionClass("team", activeSection)} min-w-0 gap-4 xl:grid-cols-2`}>
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Produtividade por colaborador</CardTitle>
            <CardDescription>Atendimentos e receita quitada associada ao profissional.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            {analytics.collaborators.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem colaboradores associados aos atendimentos.</p>
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

        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Leitura executiva</CardTitle>
            <CardDescription>Sinais rápidos para priorizar ações da clínica.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Ticket médio registrado</p>
              <p className="mt-2 text-2xl font-semibold">{sessions.length > 0 ? formatMoney(Math.round(analytics.forecastRevenueCents / sessions.length)) : formatMoney(0)}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Cancelamento</p>
              <p className="mt-2 text-2xl font-semibold">{formatPercentage(analytics.cancellationRate)}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Média diária nos últimos 30 dias</p>
              <p className="mt-2 text-2xl font-semibold">
                {compactNumber.format(analytics.last30Days.reduce((sum, day) => sum + day.atendimentos, 0) / 30)}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Meses com receita no ano</p>
              <p className="mt-2 text-2xl font-semibold">
                {analytics.monthlyRevenue.filter((month) => month.pago + month.emAberto > 0).length}/12
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <ClinicStatsPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        onConfirmPrint={handleExecutePrint}
      />

      {/* ÁREA DE IMPRESSÃO (Renderizada via React Portal diretamente no body) */}
      {createPortal(
        <div id="print-clinic-stats-root" className="hidden print:block font-sans p-4 space-y-3 bg-white text-slate-900">
          <header className="border-b pb-2 mb-3 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">{clinic?.name ?? "Clínica"}</h1>
              <h2 className="text-xs text-slate-600 font-medium">Relatório de Estatísticas Completas</h2>
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

          {/* 2. Cards de Proporção (5 cards em grid 2 colunas) */}
          <div className="grid grid-cols-2 gap-2">
            {hasBlock("payment_chart") && <DashboardProportionCard {...analytics.paymentChart} compact />}
            {hasBlock("agenda_chart") && <DashboardProportionCard {...analytics.agendaChart} compact />}
            {hasBlock("payment_status_chart") && <DashboardProportionCard {...analytics.paymentStatusChart} compact />}
            {hasBlock("patient_status_chart") && <DashboardProportionCard {...analytics.patientStatusChart} compact />}
            {hasBlock("payment_method_chart") && <DashboardProportionCard {...analytics.paymentMethodChart} compact />}
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
                  <CardTitle className="text-xs font-bold">Grupos mais recorrentes</CardTitle>
                  <CardDescription className="text-[10px]">Top grupos vinculados.</CardDescription>
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
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{sessions.length > 0 ? formatMoney(Math.round(analytics.forecastRevenueCents / sessions.length)) : formatMoney(0)}</p>
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

