import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUpDown, BarChart3, CalendarDays, Check, ChevronDown, ChevronRight, ChevronUp, Clock3, FileText, ListFilter, Loader2, Plus, Search, UsersRound, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import AgendaWidget from "@/components/AgendaWidget";
import PatientCard from "@/components/PatientCard";
import {
  DEFAULT_HOME_PATIENT_SORT_KEY,
  HOME_PATIENT_AGENDA_STATUS_OPTIONS,
  HOME_PATIENT_PAYMENT_STATUS_OPTIONS,
  HOME_PATIENT_RECURRENCE_STATUS_OPTIONS,
  HOME_PATIENT_SORT_OPTIONS,
  HOME_PATIENT_WEEKDAY_OPTIONS,
  buildHomePatientViews,
  getActiveHomePatientFilterCount,
  hasActiveHomePatientFilters,
  type HomeAgendaEventRecord,
  type HomePatientAgendaFilterStatus,
  type HomeCollaboratorFilterRecord,
  type HomePatientFilters,
  type HomePatientGroupRecord,
  type HomePatientPaymentFilterStatus,
  type HomePatientRecurrenceFilterStatus,
  type HomePatientRecord,
  type HomePatientSortKey,
  DEFAULT_HOME_SESSION_SORT_KEY,
  HOME_SESSION_SORT_OPTIONS,
  type HomeSessionSortKey,
  type HomeSessionRecord,
} from "@/lib/home-patients-view";
import { getLegacyGroupHex } from "@/lib/group-colors";
import { PATIENT_STATUS_OPTIONS } from "@/lib/patient-statuses";
import { normalizePatientOriginType, PATIENT_ORIGIN_OPTIONS, type PatientOriginType } from "@/lib/patient-origin";
import { AGENDA_EVENTS_UPDATED_EVENT } from "@/lib/agenda-events";
import { formatMoneyCents, getPaymentMethodLabel, getPaymentStatusLabel, MAX_SESSION_AMOUNT_CENTS, PAYMENT_METHOD_OPTIONS } from "@/lib/session-operations";

type ClinicMembershipRow = Database["public"]["Tables"]["clinic_memberships"]["Row"];
type PatientGroupRow = Database["public"]["Tables"]["patient_groups"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type PatientGroupWithColorSlot = PatientGroupRow & {
  clinic_group_color_slots?: { color_hex: string | null } | null;
};
type HomeListMode = "patients" | "sessions";

const normalize = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const resolveGroupFilterColor = (group: PatientGroupWithColorSlot) =>
  group.clinic_group_color_slots?.color_hex ?? getLegacyGroupHex(group.color);

const FILTER_SECTIONS = {
  agenda: "agenda",
  collaborator: "collaborator",
  dates: "dates",
  groups: "groups",
  origins: "origins",
  payments: "payments",
  recurrence: "recurrence",
  statuses: "statuses",
  weekdays: "weekdays",
} as const;

type FilterSectionKey = (typeof FILTER_SECTIONS)[keyof typeof FILTER_SECTIONS];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const toLocalDate = (value: string) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getStartOfWeek = (reference: Date) => {
  const result = new Date(reference);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

const formatPercentage = (value: number) => `${Math.round(value)}%`;

const formatMoney = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" }).format(
    Number.isFinite(cents) ? cents / 100 : 0,
  );

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "Sem data";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const sanitizeDashboardCents = (value: number | null | undefined) => {
  if (!Number.isFinite(value ?? 0)) {
    return 0;
  }

  return Math.min(MAX_SESSION_AMOUNT_CENTS, Math.max(0, Math.round(value ?? 0)));
};

const sanitizeDashboardSegmentValue = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

type DashboardSegment = {
  color: string;
  label: string;
  value: number;
};

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

const DashboardProportionCard = ({
  formatSegmentValue,
  segments,
  subtitle,
  title,
  value,
}: {
  formatSegmentValue?: (value: number) => string;
  segments: DashboardSegment[];
  subtitle: string;
  title: string;
  value: string;
}) => {
  const normalizedSegments = segments
    .map((segment) => ({ ...segment, value: sanitizeDashboardSegmentValue(segment.value) }))
    .filter((segment) => segment.value > 0);
  const total = normalizedSegments.reduce((sum, segment) => sum + segment.value, 0);
  const visibleSegments = total > 0 ? normalizedSegments : [{ color: "#d6d3d1", label: "Sem dados", value: 1 }];
  const visibleTotal = visibleSegments.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
      <p className="mt-2 font-serif text-4xl leading-none text-foreground sm:text-5xl">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-4 flex h-7 overflow-hidden rounded-full bg-muted">
        {visibleSegments.map((segment) => {
          const width = `${Math.max(4, (segment.value / visibleTotal) * 100)}%`;

          return (
            <div
              key={segment.label}
              className="h-full"
              style={{ backgroundColor: segment.color, width }}
              title={`${segment.label}: ${segment.value}`}
            />
          );
        })}
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
    </Card>
  );
};

const Index = () => {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<HomePatientRecord[]>([]);
  const [patientGroups, setPatientGroups] = useState<HomePatientGroupRecord[]>([]);
  const [collaborators, setCollaborators] = useState<HomeCollaboratorFilterRecord[]>([]);
  const [sessions, setSessions] = useState<HomeSessionRecord[]>([]);
  const [agendaEvents, setAgendaEvents] = useState<HomeAgendaEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalPatients: 0, activePatients: 0, totalSessions: 0 });
  const [selectedAgendaStatuses, setSelectedAgendaStatuses] = useState<HomePatientAgendaFilterStatus[]>([]);
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<HomePatientPaymentFilterStatus[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedGroupNames, setSelectedGroupNames] = useState<string[]>([]);
  const [selectedOriginTypes, setSelectedOriginTypes] = useState<PatientOriginType[]>([]);
  const [selectedRecurrenceStatuses, setSelectedRecurrenceStatuses] = useState<HomePatientRecurrenceFilterStatus[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedCollaboratorIds, setSelectedCollaboratorIds] = useState<string[]>([]);
  const [collaboratorQuery, setCollaboratorQuery] = useState("");
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<FilterSectionKey, boolean>>({
    agenda: false,
    collaborator: true,
    dates: false,
    groups: true,
    origins: false,
    payments: false,
    recurrence: false,
    statuses: true,
    weekdays: false,
  });
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [selectedRecurringWeekdays, setSelectedRecurringWeekdays] = useState<number[]>([]);
  const [sessionDateFrom, setSessionDateFrom] = useState("");
  const [sessionDateTo, setSessionDateTo] = useState("");
  const [sortKey, setSortKey] = useState<HomePatientSortKey>(DEFAULT_HOME_PATIENT_SORT_KEY);
  const [sessionSortKey, setSessionSortKey] = useState<HomeSessionSortKey>(DEFAULT_HOME_SESSION_SORT_KEY);
  const [listMode, setListMode] = useState<HomeListMode>("patients");
  const [agendaDialogOpen, setAgendaDialogOpen] = useState(false);
  const [dashboardDialogOpen, setDashboardDialogOpen] = useState(false);
  const [mobileSearchFocused, setMobileSearchFocused] = useState(false);
  const [toolbarFixed, setToolbarFixed] = useState(false);
  const toolbarSentinelRef = useRef<HTMLDivElement | null>(null);
  const toolbarPlaceholderRef = useRef<HTMLDivElement | null>(null);
  const toolbarStartTopRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isDesignLabExperience = true;
  const { can, clinicId, user } = useAuth();
  const canViewFinancialData = can("treasury.manage");
  const deletedPatientId =
    typeof (location.state as { deletedPatientId?: unknown } | null)?.deletedPatientId === "string"
      ? (location.state as { deletedPatientId: string }).deletedPatientId
      : null;

  const filters: HomePatientFilters = {
    agendaStatuses: selectedAgendaStatuses,
    collaboratorIds: selectedCollaboratorIds,
    colors: selectedColors,
    groupNames: selectedGroupNames,
    originTypes: selectedOriginTypes,
    paymentStatuses: selectedPaymentStatuses,
    recurrenceStatuses: selectedRecurrenceStatuses,
    recurringWeekdays: selectedRecurringWeekdays,
    searchTerm: search,
    sessionDateFrom,
    sessionDateTo,
    statuses: selectedStatuses,
    weekdays: selectedWeekdays,
  };
  const activeFilterCount = getActiveHomePatientFilterCount(filters);
  const filtersAreActive = hasActiveHomePatientFilters(filters);
  const isShowingPatientList =
    search.trim().length > 0 || filtersAreActive || sortKey !== DEFAULT_HOME_PATIENT_SORT_KEY;
  const visiblePatients = buildHomePatientViews({
    agendaEvents,
    filters,
    patientGroups,
    patients,
    sessions,
    sortKey,
    showFinancialData: canViewFinancialData,
  });
  const selectedPatientSortLabel =
    HOME_PATIENT_SORT_OPTIONS.find((option) => option.value === sortKey)?.label ?? "Pacientes recentes";
  const availableGroups = useMemo(
    () => Array.from(new Set(patientGroups.map((group) => group.name))).sort((left, right) => left.localeCompare(right, "pt-BR")),
    [patientGroups],
  );
  const availableColors = useMemo(
    () => Array.from(new Set(patientGroups.map((group) => group.color))).sort((left, right) => left.localeCompare(right, "pt-BR")),
    [patientGroups],
  );
  const visibleGroups = useMemo(
    () =>
      availableGroups.filter((groupName) => {
        if (selectedColors.length === 0) {
          return true;
        }

        return patientGroups.some((group) => group.name === groupName && selectedColors.includes(group.color));
      }),
    [availableGroups, patientGroups, selectedColors],
  );
  const groupListHeightClass = visibleGroups.length <= 2 ? "max-h-[112px]" : "max-h-[240px]";
  const visibleCollaborators = useMemo(() => {
    const normalizedQuery = normalize(collaboratorQuery);

    return collaborators.filter((collaborator) => {
      if (!normalizedQuery) {
        return true;
      }

      return normalize(
        [
          collaborator.full_name,
          collaborator.email,
          collaborator.job_title,
          collaborator.operational_role,
        ].filter(Boolean).join(" "),
      ).includes(normalizedQuery);
    });
  }, [collaboratorQuery, collaborators]);
  const collaboratorListHeightClass = visibleCollaborators.length <= 2 ? "max-h-[128px]" : "max-h-[240px]";
  const recentPatients = buildHomePatientViews({
    agendaEvents,
    filters: {
      collaboratorIds: [],
      agendaStatuses: [],
      colors: [],
      groupNames: [],
      originTypes: [],
      paymentStatuses: [],
      recurrenceStatuses: [],
      recurringWeekdays: [],
      searchTerm: "",
      sessionDateFrom: "",
      sessionDateTo: "",
      statuses: [],
      weekdays: [],
    },
    patientGroups,
    patients,
    sessions,
    sortKey: DEFAULT_HOME_PATIENT_SORT_KEY,
    showFinancialData: canViewFinancialData,
  });
  const patientById = useMemo(() => new Map(patients.map((patient) => [patient.id, patient])), [patients]);
  const groupById = useMemo(
    () => new Map(patientGroups.filter((group) => group.id).map((group) => [group.id as string, group])),
    [patientGroups],
  );
  const patientGroupsByPatientId = useMemo(() => {
    const map = new Map<string, HomePatientGroupRecord[]>();

    patientGroups.forEach((group) => {
      map.set(group.patient_id, [...(map.get(group.patient_id) ?? []), group]);
    });

    return map;
  }, [patientGroups]);
  const visibleSessions = useMemo(() => {
    const normalizedSearch = normalize(search);
    const dateFrom = sessionDateFrom ? new Date(`${sessionDateFrom}T00:00:00`) : null;
    const dateTo = sessionDateTo ? new Date(`${sessionDateTo}T23:59:59`) : null;

    return sessions
      .filter((session) => {
        const patient = patientById.get(session.patient_id);
        const sessionDate = new Date(session.session_date);
        const hasValidDate = !Number.isNaN(sessionDate.getTime());
        const sessionGroup = session.group_id ? groupById.get(session.group_id) : null;
        const patientGroupsForSession = patientGroupsByPatientId.get(session.patient_id) ?? [];
        const groupsToSearch = sessionGroup ? [sessionGroup] : patientGroupsForSession;

        if (normalizedSearch) {
          const searchable = normalize([
            patient?.name,
            patient?.cpf,
            patient?.phone,
            session.status,
            getPaymentStatusLabel(session.payment_status),
            getPaymentMethodLabel(session.payment_method),
            formatDateTime(session.session_date),
            ...groupsToSearch.map((group) => group.name),
          ].filter(Boolean).join(" "));

          if (!searchable.includes(normalizedSearch)) {
            return false;
          }
        }

        if (selectedStatuses.length > 0 && (!patient || !selectedStatuses.includes(patient.status))) {
          return false;
        }

        if (selectedOriginTypes.length > 0 && (!patient || !selectedOriginTypes.includes(normalizePatientOriginType(patient.origin_type)))) {
          return false;
        }

        if (selectedRecurrenceStatuses.length > 0) {
          const hasRecurrence = (patient?.recurring_weekdays ?? []).length > 0;
          if (selectedRecurrenceStatuses.includes("recurring") && !hasRecurrence) {
            return false;
          }
          if (selectedRecurrenceStatuses.includes("not_recurring") && hasRecurrence) {
            return false;
          }
        }

        if (selectedRecurringWeekdays.length > 0) {
          const recurringWeekdays = patient?.recurring_weekdays ?? [];
          if (!selectedRecurringWeekdays.some((weekday) => recurringWeekdays.includes(weekday))) {
            return false;
          }
        }

        if (selectedCollaboratorIds.length > 0) {
          const collaboratorIds = [session.provider_id, session.user_id].filter(Boolean);
          if (!collaboratorIds.some((id) => selectedCollaboratorIds.includes(id as string))) {
            return false;
          }
        }

        if (selectedGroupNames.length > 0 && !groupsToSearch.some((group) => selectedGroupNames.includes(group.name))) {
          return false;
        }

        if (selectedColors.length > 0 && !groupsToSearch.some((group) => selectedColors.includes(group.color))) {
          return false;
        }

        if (canViewFinancialData && selectedPaymentStatuses.length > 0) {
          const charged = sanitizeDashboardCents(session.amount_charged_cents);
          const paid = sanitizeDashboardCents(session.amount_paid_cents);
          const balance = Math.max(0, charged - paid);
          const credit = Math.max(0, paid - charged);
          const status =
            session.payment_status === "cortesia" ? "courtesy" :
            charged <= 0 && paid <= 0 ? "not_charged" :
            credit > 0 ? "credit" :
            balance > 0 && paid > 0 ? "debt" :
            balance > 0 ? "pending" :
            "paid";

          if (!selectedPaymentStatuses.includes(status as HomePatientPaymentFilterStatus)) {
            return false;
          }
        }

        if (dateFrom && (!hasValidDate || sessionDate < dateFrom)) {
          return false;
        }

        if (dateTo && (!hasValidDate || sessionDate > dateTo)) {
          return false;
        }

        if (selectedWeekdays.length > 0 && (!hasValidDate || !selectedWeekdays.includes(sessionDate.getDay()))) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        const leftDate = new Date(left.session_date);
        const rightDate = new Date(right.session_date);
        const leftTime = Number.isNaN(leftDate.getTime()) ? 0 : leftDate.getTime();
        const rightTime = Number.isNaN(rightDate.getTime()) ? 0 : rightDate.getTime();
        const leftPatientName = patientById.get(left.patient_id)?.name ?? "";
        const rightPatientName = patientById.get(right.patient_id)?.name ?? "";

        switch (sessionSortKey) {
          case "session_date_asc":
            return leftTime - rightTime;
          case "status_asc":
            return (left.status ?? "").localeCompare(right.status ?? "", "pt-BR") || rightTime - leftTime;
          case "patient_name_asc":
            return leftPatientName.localeCompare(rightPatientName, "pt-BR", { sensitivity: "base" }) || rightTime - leftTime;
          case "amount_charged_desc":
            return (right.amount_charged_cents ?? 0) - (left.amount_charged_cents ?? 0) || rightTime - leftTime;
          case "amount_paid_desc":
            return (right.amount_paid_cents ?? 0) - (left.amount_paid_cents ?? 0) || rightTime - leftTime;
          case "session_date_desc":
          default:
            return rightTime - leftTime;
        }
      });
  }, [
    canViewFinancialData,
    groupById,
    patientById,
    patientGroupsByPatientId,
    search,
    selectedCollaboratorIds,
    selectedColors,
    selectedGroupNames,
    selectedOriginTypes,
    selectedPaymentStatuses,
    selectedRecurrenceStatuses,
    selectedRecurringWeekdays,
    selectedStatuses,
    selectedWeekdays,
    sessionDateFrom,
    sessionDateTo,
    sessionSortKey,
    sessions,
  ]);
  const dashboardData = useMemo(() => {
    const now = new Date();
    const today = toLocalDate(now);
    const startOfWeek = getStartOfWeek(now);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const canceledSessions = sessions.filter((session) => session.status === "cancelado").length;
    const activeAgendaEvents = agendaEvents.filter((event) => event.status !== "cancelado" && Number.isFinite(new Date(event.scheduled_for).getTime()));
    const lateAgendaEvents = activeAgendaEvents.filter((event) => new Date(event.scheduled_for).getTime() < now.getTime()).length;
    const confirmedAgendaEvents = activeAgendaEvents.filter((event) => new Date(event.scheduled_for).getTime() >= now.getTime() && event.status === "confirmado").length;
    const awaitingAgendaEvents = activeAgendaEvents.filter((event) => new Date(event.scheduled_for).getTime() >= now.getTime() && event.status !== "confirmado").length;
    const financialTotals = sessions.reduce(
      (totals, session) => {
        if (session.payment_status === "cortesia") {
          return totals;
        }

        const charged = sanitizeDashboardCents(session.amount_charged_cents);
        const paid = sanitizeDashboardCents(session.amount_paid_cents);

        totals.paid += Math.min(paid, charged);
        totals.credit += Math.max(0, paid - charged);
        totals.open += Math.max(0, charged - paid);

        return totals;
      },
      { credit: 0, open: 0, paid: 0 },
    );
    const forecastRevenueCents = financialTotals.paid + financialTotals.credit + financialTotals.open;
    const paidSessions = sessions.filter((session) => {
      const charged = sanitizeDashboardCents(session.amount_charged_cents);
      const paid = sanitizeDashboardCents(session.amount_paid_cents);
      return charged > 0 && paid >= charged;
    }).length;
    const paymentStatusCounts = sessions.reduce(
      (counts, session) => {
        const charged = sanitizeDashboardCents(session.amount_charged_cents);
        const paid = sanitizeDashboardCents(session.amount_paid_cents);

        if (session.payment_status === "cortesia") {
          counts.courtesy += 1;
        } else if (paid > charged) {
          counts.credit += 1;
        } else if (charged > 0 && paid > 0 && paid < charged) {
          counts.debt += 1;
        } else if (charged > 0 && paid <= 0) {
          counts.pending += 1;
        } else if (charged > 0 && paid >= charged) {
          counts.paid += 1;
        } else {
          counts.notCharged += 1;
        }

        return counts;
      },
      { courtesy: 0, credit: 0, debt: 0, notCharged: 0, paid: 0, pending: 0 },
    );
    const patientStatusCounts = PATIENT_STATUS_OPTIONS.filter((statusOption) => statusOption.value !== "pagamento_pendente").map((statusOption) => ({
      color:
        statusOption.value === "ativo" ? dashboardColors.emerald :
        statusOption.value === "pausado" ? dashboardColors.amber :
        statusOption.value === "alta" ? dashboardColors.sky :
        statusOption.value === "inativo" ? dashboardColors.slate :
        dashboardColors.zinc,
      label: statusOption.label,
      value: patients.filter((patient) => patient.status === statusOption.value).length,
    })).filter((segment) => segment.value > 0);
    const paymentMethodCounts = sessions.reduce<Record<string, number>>((counts, session) => {
      const method = session.payment_status === "cortesia"
        ? "cortesia"
        : typeof session.payment_method === "string" ? session.payment_method : "nao_informado";

      counts[method] = (counts[method] ?? 0) + 1;
      return counts;
    }, {});
    const paymentMethodSegments = PAYMENT_METHOD_OPTIONS.map((option) => ({
      color:
        option.value === "dinheiro" ? dashboardColors.emerald :
        option.value === "pix" ? dashboardColors.blue :
        option.value === "cartao_debito" ? dashboardColors.sky :
        option.value === "cartao_credito" ? dashboardColors.violet :
        option.value === "convenio" ? dashboardColors.amber :
        option.value === "transferencia" ? dashboardColors.slate :
        option.value === "credito_usado" ? dashboardColors.cyan :
        option.value === "cortesia" ? dashboardColors.lime :
        dashboardColors.zinc,
      label: option.label,
      value: paymentMethodCounts[option.value] ?? 0,
    })).filter((segment) => segment.value > 0);

    return {
      cards: [
        { detail: "atendimentos registrados", title: "Total de atendimentos", value: String(stats.totalSessions) },
        { detail: "atendimentos quitados", title: "Pagamentos concluídos", value: String(paidSessions) },
        {
          detail: `${canceledSessions} cancelado${canceledSessions !== 1 ? "s" : ""}`,
          title: "Índice de cancelamento",
          value: stats.totalSessions > 0 ? formatPercentage((canceledSessions / stats.totalSessions) * 100) : "0%",
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
        subtitle: `${stats.totalPatients} paciente${stats.totalPatients !== 1 ? "s" : ""} no cadastro`,
        title: "Pacientes por status",
        value: String(stats.totalPatients),
      },
      agendaChart: {
        formatSegmentValue: (value: number) => String(value),
        segments: [
          { color: dashboardColors.rose, label: "Atrasado", value: lateAgendaEvents },
          { color: dashboardColors.emerald, label: "Confirmado", value: confirmedAgendaEvents },
          { color: dashboardColors.amber, label: "Aguardando confirmação", value: awaitingAgendaEvents },
        ].filter((segment) => segment.value > 0),
        subtitle: `${activeAgendaEvents.length} agendamento${activeAgendaEvents.length !== 1 ? "s" : ""} ativo${activeAgendaEvents.length !== 1 ? "s" : ""}`,
        title: "Agenda de atendimentos",
        value: String(activeAgendaEvents.length),
      },
      paymentStatusChart: {
        formatSegmentValue: (value: number) => String(value),
        segments: [
          { color: dashboardColors.blue, label: "Crédito", value: paymentStatusCounts.credit },
          { color: dashboardColors.rose, label: "Devendo", value: paymentStatusCounts.debt },
          { color: dashboardColors.amber, label: "Pendente", value: paymentStatusCounts.pending },
          { color: dashboardColors.emerald, label: "Pago", value: paymentStatusCounts.paid },
          { color: dashboardColors.violet, label: "Cortesia", value: paymentStatusCounts.courtesy },
          { color: dashboardColors.slate, label: "Não cobrado", value: paymentStatusCounts.notCharged },
        ].filter((segment) => segment.value > 0),
        subtitle: `${sessions.length} atendimento${sessions.length !== 1 ? "s" : ""} com status financeiro`,
        title: "Status de pagamento",
        value: String(sessions.length),
      },
      paymentMethodChart: {
        formatSegmentValue: (value: number) => String(value),
        segments: paymentMethodSegments,
        subtitle: `${sessions.length} atendimento${sessions.length !== 1 ? "s" : ""} registrado${sessions.length !== 1 ? "s" : ""}`,
        title: "Método de pagamento",
        value: String(sessions.length),
      },
      volumeMetrics: [
      {
        detail: "atendimentos hoje",
        title: "Quantidade por dia",
        value: String(sessions.filter((session) => toLocalDate(session.session_date).getTime() === today.getTime()).length),
      },
      {
        detail: "atendimentos nesta semana",
        title: "Quantidade por semana",
        value: String(sessions.filter((session) => toLocalDate(session.session_date).getTime() >= startOfWeek.getTime()).length),
      },
      {
        detail: "atendimentos neste mês",
        title: "Quantidade por mês",
        value: String(sessions.filter((session) => toLocalDate(session.session_date).getTime() >= startOfMonth.getTime()).length),
      },
      ],
    };
  }, [agendaEvents, patients, sessions, stats.totalPatients, stats.totalSessions]);

  const toggleStatus = (status: string, checked: boolean | "indeterminate") => {
    setSelectedStatuses((current) => {
      if (checked === true) {
        return current.includes(status) ? current : [...current, status];
      }

      return current.filter((value) => value !== status);
    });
  };

  const toggleStringFilter = <T extends string>(
    value: T,
    checked: boolean | "indeterminate",
    setValues: (updater: (current: T[]) => T[]) => void,
  ) => {
    setValues((current) => {
      if (checked === true) {
        return current.includes(value) ? current : [...current, value];
      }

      return current.filter((item) => item !== value);
    });
  };

  const toggleWeekday = (weekday: number, checked: boolean | "indeterminate") => {
    setSelectedWeekdays((current) => {
      if (checked === true) {
        return current.includes(weekday) ? current : [...current, weekday];
      }

      return current.filter((value) => value !== weekday);
    });
  };

  const toggleRecurringWeekday = (weekday: number, checked: boolean | "indeterminate") => {
    setSelectedRecurringWeekdays((current) => {
      if (checked === true) {
        return current.includes(weekday) ? current : [...current, weekday];
      }

      return current.filter((value) => value !== weekday);
    });
  };

  const toggleSection = (section: FilterSectionKey) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSelectedAgendaStatuses([]);
    setSelectedPaymentStatuses([]);
    setSelectedRecurrenceStatuses([]);
    setSelectedRecurringWeekdays([]);
    setSelectedGroupNames([]);
    setSelectedOriginTypes([]);
    setSelectedColors([]);
    setSelectedCollaboratorIds([]);
    setCollaboratorQuery("");
    setSelectedWeekdays([]);
    setSessionDateFrom("");
    setSessionDateTo("");
  };

  const fetchData = useCallback(async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    if (!user) return;

    if (showLoading) {
      setLoading(true);
    }

    const [patientsRes, groupsRes, sessionsRes, agendaEventsRes, membershipsRes, profilesRes] = await Promise.all([
      supabase.from("patients").select("*").order("updated_at", { ascending: false }),
      supabase.from("patient_groups").select("*, clinic_group_color_slots(color_hex)"),
      supabase
        .from("sessions")
        .select("*"),
      supabase
        .from("agenda_events")
        .select("id, patient_id, title, event_type, status, scheduled_for")
        .neq("status", "cancelado")
        .order("scheduled_for", { ascending: true }),
      clinicId
        ? supabase
            .from("clinic_memberships")
            .select("user_id, operational_role, is_active, membership_status")
            .eq("clinic_id", clinicId)
        : Promise.resolve({ data: [] }),
      clinicId
        ? supabase.from("profiles").select("id, full_name, email, job_title").eq("clinic_id", clinicId)
        : Promise.resolve({ data: [] }),
    ]);

    const pats = patientsRes.data ?? [];
    const groups = ((groupsRes.data ?? []) as PatientGroupWithColorSlot[]).map<HomePatientGroupRecord>((group) => ({
      color: resolveGroupFilterColor(group),
      id: group.id,
      name: group.name,
      patient_id: group.patient_id,
      status: group.status,
    }));
    const fetchedSessions = sessionsRes.data ?? [];
    const fetchedAgendaEvents = agendaEventsRes.data ?? [];
    const memberships = ((membershipsRes.data ?? []) as ClinicMembershipRow[]).filter(
      (membership) => membership.is_active && membership.membership_status === "active",
    );
    const profiles = (profilesRes.data ?? []) as Pick<ProfileRow, "email" | "full_name" | "id" | "job_title">[];
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const collaboratorRows = memberships.map<HomeCollaboratorFilterRecord>((membership) => {
      const profile = profileMap.get(membership.user_id);

      return {
        email: profile?.email ?? null,
        full_name: profile?.full_name ?? null,
        id: membership.user_id,
        job_title: profile?.job_title ?? null,
        operational_role: membership.operational_role,
      };
    });

    setPatients(pats);
    setPatientGroups(groups);
    setSessions(fetchedSessions);
    setAgendaEvents(fetchedAgendaEvents);
    setCollaborators(collaboratorRows);
    setStats({
      totalPatients: pats.length,
      activePatients: pats.filter((p) => p.status === "ativo").length,
      totalSessions: fetchedSessions.length,
    });
    setLoading(false);
  }, [clinicId, user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData, location.key]);

  useEffect(() => {
    const handleAgendaEventsUpdated = () => {
      void fetchData({ showLoading: false });
    };

    window.addEventListener(AGENDA_EVENTS_UPDATED_EVENT, handleAgendaEventsUpdated);

    return () => {
      window.removeEventListener(AGENDA_EVENTS_UPDATED_EVENT, handleAgendaEventsUpdated);
    };
  }, [fetchData]);

  useEffect(() => {
    if (!deletedPatientId) {
      return;
    }

    setPatients((current) => {
      const deletedPatient = current.find((patient) => patient.id === deletedPatientId);

      if (!deletedPatient) {
        return current;
      }

      setStats((stats) => ({
        ...stats,
        activePatients: deletedPatient.status === "ativo" ? Math.max(0, stats.activePatients - 1) : stats.activePatients,
        totalPatients: Math.max(0, stats.totalPatients - 1),
      }));

      return current.filter((patient) => patient.id !== deletedPatientId);
    });
  }, [deletedPatientId]);

  useEffect(() => {
    const measureToolbarStart = () => {
      if (!toolbarSentinelRef.current || toolbarFixed) {
        return;
      }

      toolbarStartTopRef.current =
        toolbarSentinelRef.current.getBoundingClientRect().top + window.scrollY;
    };

    const updateToolbarState = () => {
      if (toolbarStartTopRef.current === null) {
        measureToolbarStart();
      }

      const shouldFix = window.scrollY > (toolbarStartTopRef.current ?? Number.POSITIVE_INFINITY);
      setToolbarFixed((current) => (current === shouldFix ? current : shouldFix));
    };

    const initializeToolbarState = () => {
      measureToolbarStart();
      updateToolbarState();
    };

    initializeToolbarState();
    window.addEventListener("scroll", updateToolbarState, { passive: true });
    window.addEventListener("resize", initializeToolbarState);

    return () => {
      window.removeEventListener("scroll", updateToolbarState);
      window.removeEventListener("resize", initializeToolbarState);
    };
  }, [toolbarFixed]);

  const designLabActionButtonClass =
    "group/design-action w-10 justify-center gap-0 overflow-hidden px-0 transition-[width,gap,padding,box-shadow,border-color,background-color,transform] duration-700 ease-in-out hover:justify-start hover:gap-2 hover:px-3.5 focus-visible:justify-start focus-visible:gap-2 focus-visible:px-3.5 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.10),0_10px_22px_hsl(var(--primary)/0.10)]";
  const designLabPrimaryActionButtonClass =
    "group/design-action w-10 justify-center gap-0 overflow-hidden px-0 transition-[width,gap,padding,box-shadow,transform,background-color] duration-700 ease-in-out hover:w-[168px] hover:justify-start hover:gap-2 hover:px-3.5 hover:-translate-y-0.5 hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.16),0_10px_22px_hsl(var(--primary)/0.16)] focus-visible:w-[168px] focus-visible:justify-start focus-visible:gap-2 focus-visible:px-3.5";
  const designLabIconClass = "h-4 w-4 shrink-0 group-hover/design-action:animate-[designlab-icon-dance_0.7s_ease-in-out]";
  const designLabLabelClass =
    "ml-0 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-700 ease-in-out group-hover/design-action:ml-2 group-hover/design-action:max-w-[9rem] group-hover/design-action:opacity-100 group-focus-visible/design-action:ml-2 group-focus-visible/design-action:max-w-[9rem] group-focus-visible/design-action:opacity-100";

  const renderListModeSwitch = (compact = false) => {
    const liquidListMode = true;
    const patientsSelected = listMode === "patients";
    const patientsButtonStateClass = patientsSelected
      ? liquidListMode
        ? `text-primary-foreground shadow-sm hover:bg-primary focus-visible:bg-primary ${compact ? "bg-primary" : ""}`
        : "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground";
    const sessionsButtonStateClass = listMode === "sessions"
      ? liquidListMode
        ? `text-primary-foreground shadow-sm hover:bg-primary focus-visible:bg-primary ${compact ? "bg-primary" : ""}`
        : "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground";
    const designLabPatientsModeClass = isDesignLabExperience && !compact
      ? patientsSelected
        ? "group/design-action w-10 flex-none overflow-hidden px-0 transition-[width,padding,box-shadow,border-color,background-color,color] duration-700 ease-in-out hover:w-[126px] hover:px-4 hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.10),0_8px_18px_hsl(var(--primary)/0.10)] focus-visible:w-[126px] focus-visible:px-4"
        : "group/design-action w-10 flex-none overflow-hidden px-0 transition-[width,padding,box-shadow,border-color,background-color,color] duration-700 ease-in-out hover:w-[126px] hover:px-4 hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.08),0_8px_18px_hsl(var(--primary)/0.08)] focus-visible:w-[126px] focus-visible:px-4"
      : "flex-1 gap-2 px-3 transition-colors";
    const designLabSessionsModeClass = isDesignLabExperience && !compact
      ? !patientsSelected
        ? "group/design-action w-10 flex-none overflow-hidden px-0 transition-[width,padding,box-shadow,border-color,background-color,color] duration-700 ease-in-out hover:w-[154px] hover:px-4 hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.10),0_8px_18px_hsl(var(--primary)/0.10)] focus-visible:w-[154px] focus-visible:px-4"
        : "group/design-action w-10 flex-none overflow-hidden px-0 transition-[width,padding,box-shadow,border-color,background-color,color] duration-700 ease-in-out hover:w-[154px] hover:px-4 hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.08),0_8px_18px_hsl(var(--primary)/0.08)] focus-visible:w-[154px] focus-visible:px-4"
      : "flex-1 gap-2 px-3 transition-colors";
    const designLabPatientsLabelClass = compact && isDesignLabExperience
      ? "relative z-10"
      : compact
        ? "sr-only"
        : isDesignLabExperience && !patientsSelected
        ? "relative z-10 ml-0 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-700 ease-in-out group-hover/design-action:ml-2 group-hover/design-action:max-w-[6rem] group-hover/design-action:opacity-100 group-focus-visible/design-action:ml-2 group-focus-visible/design-action:max-w-[6rem] group-focus-visible/design-action:opacity-100"
        : isDesignLabExperience
          ? "relative z-10 ml-0 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-700 ease-in-out group-hover/design-action:ml-2 group-hover/design-action:max-w-[6rem] group-hover/design-action:opacity-100 group-focus-visible/design-action:ml-2 group-focus-visible/design-action:max-w-[6rem] group-focus-visible/design-action:opacity-100"
          : "relative z-10";
    const designLabSessionsLabelClass = compact && isDesignLabExperience
      ? "relative z-10"
      : compact
        ? "sr-only"
        : isDesignLabExperience && patientsSelected
        ? "relative z-10 ml-0 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-700 ease-in-out group-hover/design-action:ml-2 group-hover/design-action:max-w-[8rem] group-hover/design-action:opacity-100 group-focus-visible/design-action:ml-2 group-focus-visible/design-action:max-w-[8rem] group-focus-visible/design-action:opacity-100"
        : isDesignLabExperience
          ? "relative z-10 ml-0 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-700 ease-in-out group-hover/design-action:ml-2 group-hover/design-action:max-w-[8rem] group-hover/design-action:opacity-100 group-focus-visible/design-action:ml-2 group-focus-visible/design-action:max-w-[8rem] group-focus-visible/design-action:opacity-100"
          : "relative z-10";

    return (
      <div
        className={`inline-flex rounded-2xl border bg-muted/30 p-1 ${compact && isDesignLabExperience ? "h-10 w-full" : compact ? "h-11 w-24" : isDesignLabExperience ? "h-10 overflow-visible" : "h-10"}`}
        role="tablist"
        aria-label="Alternar lista da homepage"
      >
        <button
          type="button"
          className={`relative z-10 inline-flex items-center justify-center rounded-xl text-sm font-medium duration-700 ease-in-out ${patientsButtonStateClass} ${designLabPatientsModeClass}`}
          onClick={() => setListMode("patients")}
          role="tab"
          aria-selected={patientsSelected}
        >
          {patientsSelected && (
            <motion.span
              layoutId="list-mode-indicator"
              aria-hidden="true"
              className="designlab-liquid-toggle-indicator pointer-events-none absolute inset-0 z-0 rounded-xl bg-primary shadow-[0_8px_18px_hsl(var(--primary)/0.20),inset_0_0_0_1px_hsl(var(--primary-foreground)/0.22)]"
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 28,
                mass: 1.4
              }}
              style={{ originX: 0.5, originY: 0.5 }}
            />
          )}
          <UsersRound className={`relative z-10 h-4 w-4 shrink-0 transition-transform duration-700 ${isDesignLabExperience && !compact ? "group-hover/design-action:animate-[designlab-icon-dance_0.7s_ease-in-out]" : ""}`} />
          <span className={designLabPatientsLabelClass}>Pacientes</span>
        </button>
        <button
          type="button"
          className={`relative z-10 inline-flex items-center justify-center rounded-xl text-sm font-medium duration-700 ease-in-out ${sessionsButtonStateClass} ${designLabSessionsModeClass}`}
          onClick={() => setListMode("sessions")}
          role="tab"
          aria-selected={!patientsSelected}
        >
          {!patientsSelected && (
            <motion.span
              layoutId="list-mode-indicator"
              aria-hidden="true"
              className="designlab-liquid-toggle-indicator pointer-events-none absolute inset-0 z-0 rounded-xl bg-primary shadow-[0_8px_18px_hsl(var(--primary)/0.20),inset_0_0_0_1px_hsl(var(--primary-foreground)/0.22)]"
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 28,
                mass: 1.4
              }}
              style={{ originX: 0.5, originY: 0.5 }}
            />
          )}
          <FileText className={`relative z-10 h-4 w-4 shrink-0 transition-transform duration-700 ${isDesignLabExperience && !compact ? "group-hover/design-action:animate-[designlab-icon-dance_0.7s_ease-in-out]" : ""}`} />
          <span className={designLabSessionsLabelClass}>Atendimentos</span>
        </button>
      </div>
    );
  };

  const renderPatientSortSelect = (compact = false) => {
    const designLabTriggerClass =
      "group/design-action w-10 flex-none justify-center overflow-hidden px-0 transition-[width,padding,box-shadow,border-color,background-color,transform] duration-700 ease-in-out hover:w-[104px] hover:justify-start hover:px-3.5 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.10),0_10px_22px_hsl(var(--primary)/0.10)] focus-visible:w-[104px] focus-visible:justify-start focus-visible:px-3.5 [&>svg:last-child]:hidden [&>svg:last-child]:w-0";
    const mobileDesignLabTriggerClass =
      "h-10 min-w-0 flex-1 rounded-xl px-3 [&>svg:last-child]:hidden";

    return (
      <div className="flex items-center">
        <Select value={sortKey} onValueChange={(value) => setSortKey(value as HomePatientSortKey)}>
          <SelectTrigger
            className={
              compact && isDesignLabExperience
                ? mobileDesignLabTriggerClass
                : compact
                ? "h-11 min-w-[112px] flex-1 rounded-2xl px-3"
                : isDesignLabExperience
                  ? designLabTriggerClass
                  : "w-[140px]"
            }
            aria-label="Ordem dos pacientes"
          >
            <div className={isDesignLabExperience && !compact ? "flex min-w-0 items-center gap-0 transition-[gap] duration-700 ease-in-out group-hover/design-action:gap-2 group-focus-visible/design-action:gap-2" : compact && isDesignLabExperience ? "flex min-w-0 items-center justify-center gap-2" : "flex min-w-0 items-center gap-2"}>
              <ArrowUpDown className={`h-4 w-4 shrink-0 text-muted-foreground ${isDesignLabExperience && !compact ? "group-hover/design-action:animate-[designlab-icon-dance_0.7s_ease-in-out]" : ""}`} />
              <span className={compact && isDesignLabExperience ? "shrink-0 text-sm" : isDesignLabExperience && !compact ? "ml-0 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-700 ease-in-out group-hover/design-action:ml-2 group-hover/design-action:max-w-[7rem] group-hover/design-action:opacity-100 group-focus-visible/design-action:ml-2 group-focus-visible/design-action:max-w-[7rem] group-focus-visible/design-action:opacity-100" : "shrink-0"}>Ordem</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {HOME_PATIENT_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };
  const renderSessionSortSelect = (compact = false) => {
    const designLabTriggerClass =
      "group/design-action w-10 flex-none justify-center overflow-hidden px-0 transition-[width,padding,box-shadow,border-color,background-color,transform] duration-700 ease-in-out hover:w-[104px] hover:justify-start hover:px-3.5 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.10),0_10px_22px_hsl(var(--primary)/0.10)] focus-visible:w-[104px] focus-visible:justify-start focus-visible:px-3.5 [&>svg:last-child]:hidden [&>svg:last-child]:w-0";
    const mobileDesignLabTriggerClass =
      "h-10 min-w-0 flex-1 rounded-xl px-3 [&>svg:last-child]:hidden";

    return (
      <div className="flex items-center">
        <Select value={sessionSortKey} onValueChange={(value) => setSessionSortKey(value as HomeSessionSortKey)}>
          <SelectTrigger
            className={
              compact && isDesignLabExperience
                ? mobileDesignLabTriggerClass
                : compact
                ? "h-11 min-w-[112px] flex-1 rounded-2xl px-3"
                : isDesignLabExperience
                  ? designLabTriggerClass
                  : "w-[140px]"
            }
            aria-label="Ordem dos atendimentos"
          >
            <div className={isDesignLabExperience && !compact ? "flex min-w-0 items-center gap-0 transition-[gap] duration-700 ease-in-out group-hover/design-action:gap-2 group-focus-visible/design-action:gap-2" : compact && isDesignLabExperience ? "flex min-w-0 items-center justify-center gap-2" : "flex min-w-0 items-center gap-2"}>
              <ArrowUpDown className={`h-4 w-4 shrink-0 text-muted-foreground ${isDesignLabExperience && !compact ? "group-hover/design-action:animate-[designlab-icon-dance_0.7s_ease-in-out]" : ""}`} />
              <span className={compact && isDesignLabExperience ? "shrink-0 text-sm" : isDesignLabExperience && !compact ? "ml-0 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-700 ease-in-out group-hover/design-action:ml-2 group-hover/design-action:max-w-[7rem] group-hover/design-action:opacity-100 group-focus-visible/design-action:ml-2 group-focus-visible/design-action:max-w-[7rem] group-focus-visible/design-action:opacity-100" : "shrink-0"}>Ordem</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {HOME_SESSION_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderSessionCard = (session: HomeSessionRecord) => {
    const patient = patientById.get(session.patient_id);
    const group = session.group_id ? groupById.get(session.group_id) : null;
    const patientGroupsForSession = patientGroupsByPatientId.get(session.patient_id) ?? [];
    const fallbackGroup = patientGroupsForSession[0] ?? null;
    const charged = sanitizeDashboardCents(session.amount_charged_cents);
    const paid = sanitizeDashboardCents(session.amount_paid_cents);
    const balance = Math.max(0, charged - paid);
    const credit = Math.max(0, paid - charged);
    const sessionPath = `/pacientes/${session.patient_id}/sessao/${session.id}`;
    const patientPath = `/pacientes/${session.patient_id}`;

    return (
      <Card
        key={session.id}
        className="cursor-pointer p-4 transition-shadow duration-150 hover:shadow-md"
        onClick={() => navigate(sessionPath)}
        role="button"
        tabIndex={0}
        aria-label={`Abrir atendimento de ${patient?.name ?? "paciente sem nome"}`}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            navigate(sessionPath);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{formatDateTime(session.session_date)}</span>
              <Badge variant="outline" className="capitalize">{session.status || "sem status"}</Badge>
              {group || fallbackGroup ? (
                <Badge
                  variant="secondary"
                  className="max-w-[180px] gap-1.5 truncate text-muted-foreground"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: (group ?? fallbackGroup)?.color }}
                  />
                  {(group ?? fallbackGroup)?.name}
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <button
                type="button"
                className="font-medium text-foreground hover:underline"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(patientPath);
                }}
              >
                {patient?.name ?? "Paciente não encontrado"}
              </button>
              <span>{getPaymentMethodLabel(session.payment_method)}</span>
              {canViewFinancialData ? (
                <span>{getPaymentStatusLabel(session.payment_status)}</span>
              ) : null}
            </div>
            {canViewFinancialData ? (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Cobrado {formatMoneyCents(charged)}</span>
                <span>Pago {formatMoneyCents(paid)}</span>
                {balance > 0 ? <span className="text-destructive">Em aberto {formatMoneyCents(balance)}</span> : null}
                {credit > 0 ? <span className="text-primary">Crédito {formatMoneyCents(credit)}</span> : null}
              </div>
            ) : null}
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className={isDesignLabExperience ? "space-y-4 pb-20 md:space-y-6 md:pb-0" : "space-y-6"}>
      <div ref={toolbarSentinelRef} aria-hidden="true" className="h-0" />
      <div
        ref={toolbarPlaceholderRef}
        aria-hidden="true"
        className={toolbarFixed ? isDesignLabExperience ? "block h-[64px] md:h-[62px]" : "block h-[190px] md:h-[62px]" : "hidden"}
      />
      <div
        className={
          toolbarFixed
            ? "!mt-0 fixed left-0 right-0 top-0 z-30 border-b border-border/60 bg-background/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85 md:px-6"
            : isDesignLabExperience
              ? "rounded-2xl border border-border/60 bg-background/95 p-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85 md:rounded-xl md:p-3"
              : "rounded-2xl border border-border/60 bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85 md:rounded-xl"
        }
      >
        <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
          <div className="md:hidden">
            {isDesignLabExperience ? (
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1 transition-[flex-basis,width] duration-200 ease-out">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={listMode === "patients" ? "Buscar paciente..." : "Buscar atendimento..."}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => setMobileSearchFocused(true)}
                    onBlur={() => setMobileSearchFocused(false)}
                    className="h-10 rounded-xl border-muted-foreground/20 bg-muted/20 pl-10 text-[16px] shadow-none"
                    aria-label={listMode === "patients" ? "Busca mobile de pacientes" : "Busca mobile de atendimentos"}
                  />
                </div>
                {!mobileSearchFocused ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="relative h-10 w-10 rounded-xl px-0"
                        aria-label={activeFilterCount > 0 ? `Ajustes da lista, ${activeFilterCount} filtros ativos` : "Ajustes da lista"}
                      >
                        <ListFilter className="h-4 w-4" />
                        {activeFilterCount > 0 ? (
                          <Badge variant="secondary" className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-[10px]">
                            {activeFilterCount}
                          </Badge>
                        ) : null}
                      </Button>
                    </DialogTrigger>
                    <Select
                      value={listMode === "patients" ? sortKey : sessionSortKey}
                      onValueChange={(value) => {
                        if (listMode === "patients") {
                          setSortKey(value as HomePatientSortKey);
                          return;
                        }
                        setSessionSortKey(value as HomeSessionSortKey);
                      }}
                    >
                      <SelectTrigger
                        className="h-10 w-10 justify-center rounded-xl px-0 [&>svg:last-child]:hidden [&>svg:last-child]:w-0"
                        aria-label={listMode === "patients" ? "Ordem dos pacientes" : "Ordem dos atendimentos"}
                      >
                        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                      </SelectTrigger>
                      <SelectContent>
                        {(listMode === "patients" ? HOME_PATIENT_SORT_OPTIONS : HOME_SESSION_SORT_OPTIONS).map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={listMode === "patients" ? "Buscar paciente..." : "Buscar atendimento..."}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-12 rounded-2xl border-muted-foreground/20 bg-muted/20 pl-10 text-base shadow-none"
                    aria-label={listMode === "patients" ? "Busca mobile de pacientes" : "Busca mobile de atendimentos"}
                  />
                </div>
                <div className="flex gap-2">
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 flex-1 rounded-2xl px-3"
                      aria-label={activeFilterCount > 0 ? `Ajustes da lista, ${activeFilterCount} filtros ativos` : "Ajustes da lista"}
                    >
                      <ListFilter className="h-4 w-4" />
                      <span>Filtro</span>
                      {activeFilterCount > 0 ? <Badge variant="secondary" className="ml-1 px-1.5">{activeFilterCount}</Badge> : null}
                    </Button>
                  </DialogTrigger>
                  {listMode === "patients" ? renderPatientSortSelect(true) : renderSessionSortSelect(true)}
                </div>
                <div className="flex gap-2">
                  <Button className="h-11 flex-1 rounded-2xl px-3" onClick={() => navigate("/pacientes/novo")} aria-label="Novo paciente">
                    <Plus className="h-4 w-4" />
                    <span className="ml-1 max-[360px]:sr-only">Novo</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-2xl px-3"
                    onClick={() => setAgendaDialogOpen(true)}
                    aria-label="Abrir agenda"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                  {canViewFinancialData ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-2xl px-3"
                      onClick={() => setDashboardDialogOpen(true)}
                      aria-label="Abrir estatísticas"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                {renderListModeSwitch(true)}
              </div>
            )}
          </div>

          <div className="hidden items-center gap-3 md:flex md:flex-wrap">
            <div className="relative min-w-[200px] max-w-lg flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={listMode === "patients" ? "Buscar paciente, CPF ou telefone..." : "Buscar atendimento, paciente, status ou data..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label={listMode === "patients" ? "Buscar paciente por nome, CPF ou telefone" : "Buscar atendimento por paciente, status ou data"}
              />
            </div>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className={isDesignLabExperience ? `${designLabActionButtonClass} hover:w-[108px] focus-visible:w-[108px]` : undefined}
                aria-label={activeFilterCount > 0 ? `Filtro, ${activeFilterCount} ativos` : "Filtro"}
              >
                <ListFilter className={isDesignLabExperience ? designLabIconClass : "h-4 w-4"} />
                <span className={isDesignLabExperience ? designLabLabelClass : undefined}>Filtro</span>
                {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
              </Button>
            </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
            <DialogHeader className="text-left">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle>Filtros</DialogTitle>
                  <DialogDescription className="text-sm">
                    Refine a lista por status, origem, pagamentos, agendamentos, recorrência, grupos, colaborador e período.
                  </DialogDescription>
                </div>
                <Button type="button" variant="ghost" size="sm" className="mr-8 shrink-0" onClick={clearFilters}>
                  Sem filtros
                </Button>
              </div>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4">
                <Collapsible open={openSections.statuses} onOpenChange={() => toggleSection("statuses")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
                    <span className="font-medium">Status de atividade</span>
                    {openSections.statuses ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-2 pt-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                    {PATIENT_STATUS_OPTIONS.map((statusOption) => (
                      <label key={statusOption.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedStatuses.includes(statusOption.value)}
                          onCheckedChange={(checked) => toggleStatus(statusOption.value, checked)}
                          aria-label={statusOption.label}
                        />
                        <span>{statusOption.label}</span>
                      </label>
                    ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={openSections.origins} onOpenChange={() => toggleSection("origins")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
                    <span className="font-medium">Origem do paciente</span>
                    {openSections.origins ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-2 pt-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {PATIENT_ORIGIN_OPTIONS.map((originOption) => (
                        <label key={originOption.value} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedOriginTypes.includes(originOption.value)}
                            onCheckedChange={(checked) => toggleStringFilter(originOption.value, checked, setSelectedOriginTypes)}
                            aria-label={originOption.label}
                          />
                          <span>{originOption.label}</span>
                        </label>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {canViewFinancialData ? (
                  <Collapsible open={openSections.payments} onOpenChange={() => toggleSection("payments")}>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
                      <span className="font-medium">Status de pagamento</span>
                      {openSections.payments ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-2 pt-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {HOME_PATIENT_PAYMENT_STATUS_OPTIONS.map((statusOption) => (
                          <label key={statusOption.value} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selectedPaymentStatuses.includes(statusOption.value)}
                              onCheckedChange={(checked) => toggleStringFilter(statusOption.value, checked, setSelectedPaymentStatuses)}
                              aria-label={statusOption.label}
                            />
                            <span>{statusOption.label}</span>
                          </label>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}

                <Collapsible open={openSections.agenda} onOpenChange={() => toggleSection("agenda")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
                    <span className="font-medium">Status de agendamento</span>
                    {openSections.agenda ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-2 pt-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {HOME_PATIENT_AGENDA_STATUS_OPTIONS.map((statusOption) => (
                        <label key={statusOption.value} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedAgendaStatuses.includes(statusOption.value)}
                            onCheckedChange={(checked) => toggleStringFilter(statusOption.value, checked, setSelectedAgendaStatuses)}
                            aria-label={statusOption.label}
                          />
                          <span>{statusOption.label}</span>
                        </label>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={openSections.recurrence} onOpenChange={() => toggleSection("recurrence")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
                    <span className="font-medium">Recorrência programada</span>
                    {openSections.recurrence ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 px-2 pt-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {HOME_PATIENT_RECURRENCE_STATUS_OPTIONS.map((statusOption) => (
                        <label key={statusOption.value} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedRecurrenceStatuses.includes(statusOption.value)}
                            onCheckedChange={(checked) => toggleStringFilter(statusOption.value, checked, setSelectedRecurrenceStatuses)}
                            aria-label={statusOption.label}
                          />
                          <span>{statusOption.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dias programados</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {HOME_PATIENT_WEEKDAY_OPTIONS.map((weekday) => (
                          <label key={weekday.value} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selectedRecurringWeekdays.includes(weekday.value)}
                              onCheckedChange={(checked) => toggleRecurringWeekday(weekday.value, checked)}
                              aria-label={`Recorrência em ${weekday.label}`}
                            />
                            <span>{weekday.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={openSections.groups} onOpenChange={() => toggleSection("groups")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
                    <span className="font-medium">Grupos</span>
                    {openSections.groups ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    <ScrollArea className="w-full whitespace-nowrap">
                      <div className="flex gap-2 pb-2">
                        {availableColors.map((color) => {
                          const selected = selectedColors.includes(color);

                          return (
                            <button
                              key={color}
                              type="button"
                              className={`relative h-5 w-5 shrink-0 rounded-full transition hover:scale-105 ${selected ? "ring-2 ring-primary ring-offset-2" : ""}`}
                              onClick={() =>
                                setSelectedColors((current) =>
                                  current.includes(color) ? current.filter((item) => item !== color) : [...current, color],
                                )
                              }
                              aria-pressed={selected}
                              aria-label={`Cor ${color}`}
                              title={color}
                              style={{ backgroundColor: color }}
                            >
                              <span className="sr-only">{color}</span>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>

                    <ScrollArea className={`${groupListHeightClass} rounded-lg border`}>
                      <div className="divide-y">
                        {visibleGroups.map((groupName) => {
                          const selected = selectedGroupNames.includes(groupName);
                          const groupColor = patientGroups.find((group) => group.name === groupName)?.color ?? "#CBD5E1";

                          return (
                            <button
                              key={groupName}
                              type="button"
                              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                              style={{ boxShadow: `inset 4px 0 0 ${groupColor}` }}
                              onClick={() =>
                                setSelectedGroupNames((current) =>
                                  current.includes(groupName)
                                    ? current.filter((item) => item !== groupName)
                                    : [...current, groupName],
                                )
                              }
                            >
                              <Checkbox checked={selected} aria-label={groupName} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{groupName}</p>
                              </div>
                              {selected ? (
                                <Badge variant="secondary" className="gap-1">
                                  <Check className="h-3 w-3" />
                                  Selecionado
                                </Badge>
                              ) : null}
                            </button>
                          );
                        })}
                        {visibleGroups.length === 0 ? (
                          <div className="flex items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground">
                            Nenhum grupo encontrado para as cores selecionadas.
                          </div>
                        ) : null}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={openSections.collaborator} onOpenChange={() => toggleSection("collaborator")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
                    <span className="font-medium">Colaborador</span>
                    {openSections.collaborator ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={collaboratorQuery}
                        onChange={(event) => setCollaboratorQuery(event.target.value)}
                        placeholder="Buscar por nome, email, função ou cargo"
                        className="pl-9"
                      />
                    </div>
                    <ScrollArea className={`${collaboratorListHeightClass} rounded-lg border`}>
                      <div className="divide-y">
                        {visibleCollaborators.map((collaborator) => {
                          const selected = selectedCollaboratorIds.includes(collaborator.id);
                          const label = collaborator.full_name ?? collaborator.email ?? collaborator.id;
                          return (
                            <button
                              key={collaborator.id}
                              type="button"
                              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                              onClick={() =>
                                setSelectedCollaboratorIds((current) =>
                                  current.includes(collaborator.id)
                                    ? current.filter((id) => id !== collaborator.id)
                                    : [...current, collaborator.id],
                                )
                              }
                            >
                              <Checkbox checked={selected} aria-label={`Selecionar ${label}`} />
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                {label.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{label}</p>
                                <p className="truncate text-xs text-muted-foreground">{collaborator.email || "Sem email"}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {collaborator.job_title ? (
                                  <Badge variant="outline" className="hidden sm:inline-flex">
                                    {collaborator.job_title}
                                  </Badge>
                                ) : null}
                                {selected ? (
                                  <Badge variant="secondary" className="gap-1">
                                    <Check className="h-3 w-3" />
                                    Selecionado
                                  </Badge>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                        {visibleCollaborators.length === 0 ? (
                          <div className="flex items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground">
                            Nenhum colaborador encontrado.
                          </div>
                        ) : null}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={openSections.dates} onOpenChange={() => toggleSection("dates")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
                    <span className="font-medium">Período dos atendimentos</span>
                    {openSections.dates ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground" htmlFor="home-session-date-from">Data inicial</label>
                        <Input
                          id="home-session-date-from"
                          type="date"
                          value={sessionDateFrom}
                          onChange={(event) => setSessionDateFrom(event.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground" htmlFor="home-session-date-to">Data final</label>
                        <Input
                          id="home-session-date-to"
                          type="date"
                          value={sessionDateTo}
                          onChange={(event) => setSessionDateTo(event.target.value)}
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={openSections.weekdays} onOpenChange={() => toggleSection("weekdays")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
                    <span className="font-medium">Dias dos atendimentos</span>
                    {openSections.weekdays ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {HOME_PATIENT_WEEKDAY_OPTIONS.map((weekday) => (
                        <label key={weekday.value} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedWeekdays.includes(weekday.value)}
                            onCheckedChange={(checked) => toggleWeekday(weekday.value, checked)}
                            aria-label={weekday.label}
                          />
                          <span>{weekday.label}</span>
                        </label>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={clearFilters}>Limpar</Button>
              <Button onClick={() => setFilterDialogOpen(false)}>
                <ArrowDown className="mr-2 h-4 w-4" />
                Aplicar filtros
              </Button>
            </DialogFooter>
          </DialogContent>
          {listMode === "patients" ? renderPatientSortSelect() : renderSessionSortSelect()}
          <div className="shrink-0">
            {renderListModeSwitch()}
          </div>
          <Button
            className={isDesignLabExperience ? designLabPrimaryActionButtonClass : "gap-2"}
            onClick={() => navigate("/pacientes/novo")}
            aria-label="Novo Paciente"
          >
            <Plus className={isDesignLabExperience ? designLabIconClass : "h-4 w-4"} />
            <span className={isDesignLabExperience ? designLabLabelClass : undefined}>Novo Paciente</span>
          </Button>
          <div className="ml-auto flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size={isDesignLabExperience ? "default" : "icon"}
            className={isDesignLabExperience ? `${designLabActionButtonClass} hover:w-[116px] focus-visible:w-[116px]` : undefined}
            onClick={() => setAgendaDialogOpen(true)}
            aria-label="Abrir agenda"
          >
            <CalendarDays className={isDesignLabExperience ? designLabIconClass : "h-4 w-4"} />
            {isDesignLabExperience ? <span className={designLabLabelClass}>Agenda</span> : null}
          </Button>
          {canViewFinancialData ? (
            <Button
              type="button"
              variant="outline"
              size={isDesignLabExperience ? "default" : "icon"}
              className={isDesignLabExperience ? `${designLabActionButtonClass} hover:w-[144px] focus-visible:w-[144px]` : undefined}
              onClick={() => setDashboardDialogOpen(true)}
              aria-label="Abrir estatísticas"
            >
              <BarChart3 className={isDesignLabExperience ? designLabIconClass : "h-4 w-4"} />
              {isDesignLabExperience ? <span className={designLabLabelClass}>Estatísticas</span> : null}
            </Button>
          ) : null}
          </div>
          </div>
        </Dialog>
        <Dialog open={agendaDialogOpen} onOpenChange={setAgendaDialogOpen}>
          <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
            <DialogHeader className="text-left">
              <DialogTitle>Agenda</DialogTitle>
              <DialogDescription>Veja e gerencie os agendamentos da clínica.</DialogDescription>
            </DialogHeader>
            <AgendaWidget />
          </DialogContent>
        </Dialog>
        {canViewFinancialData ? (
          <Dialog open={dashboardDialogOpen} onOpenChange={setDashboardDialogOpen}>
            <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-4xl sm:p-6">
              <DialogHeader className="gap-3 text-left sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <DialogTitle>Resumo geral</DialogTitle>
                  <DialogDescription>Indicadores rápidos da clínica para acompanhar operação, atendimentos e pagamentos.</DialogDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit gap-2"
                  onClick={() => {
                    setDashboardDialogOpen(false);
                    navigate("dashboard");
                  }}
                >
                  <BarChart3 className="h-4 w-4" />
                  Estatísticas completas
                </Button>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <DashboardProportionCard {...dashboardData.paymentChart} />
                </div>
                <DashboardProportionCard {...dashboardData.agendaChart} />
                <DashboardProportionCard {...dashboardData.paymentStatusChart} />
                <DashboardProportionCard {...dashboardData.patientStatusChart} />
                <DashboardProportionCard {...dashboardData.paymentMethodChart} />
                {dashboardData.cards.map((metric) => (
                  <Card key={metric.title} className="p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.title}</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{metric.value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{metric.detail}</p>
                  </Card>
                ))}
                {dashboardData.volumeMetrics.map((metric) => (
                  <Card key={metric.title} className="p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.title}</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{metric.value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{metric.detail}</p>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {isDesignLabExperience ? (
        <nav
          className="designlab-settings-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/94 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/88 md:hidden"
          aria-label="Navegação principal da clínica"
        >
          <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-1.5">
            <button
              type="button"
              className={`designlab-settings-mobile-item group relative flex min-w-0 flex-col items-center justify-center rounded-xl p-[1px] text-center transition-[filter,transform] duration-300 ease-out active:translate-y-0.5 ${
                listMode === "patients" ? "is-active" : ""
              }`}
              onClick={() => setListMode("patients")}
              aria-label="Pacientes"
              aria-pressed={listMode === "patients"}
            >
              <span className="designlab-settings-mobile-surface flex h-14 w-full items-center justify-center rounded-[0.68rem] border border-border/80 bg-card/92 text-muted-foreground transition-colors duration-300 group-[.is-active]:border-primary/45 group-[.is-active]:bg-primary/10 group-[.is-active]:text-primary">
                <span className="designlab-settings-mobile-icon grid h-8 w-8 place-items-center rounded-lg bg-muted/70 text-foreground transition-colors duration-300 group-[.is-active]:bg-primary/14 group-[.is-active]:text-primary">
                  <UsersRound className="h-[clamp(1.05rem,5vw,1.35rem)] w-[clamp(1.05rem,5vw,1.35rem)]" />
                </span>
              </span>
              <span className="sr-only">Pacientes</span>
            </button>
            <button
              type="button"
              className={`designlab-settings-mobile-item group relative flex min-w-0 flex-col items-center justify-center rounded-xl p-[1px] text-center transition-[filter,transform] duration-300 ease-out active:translate-y-0.5 ${
                listMode === "sessions" ? "is-active" : ""
              }`}
              onClick={() => setListMode("sessions")}
              aria-label="Atendimentos"
              aria-pressed={listMode === "sessions"}
            >
              <span className="designlab-settings-mobile-surface flex h-14 w-full items-center justify-center rounded-[0.68rem] border border-border/80 bg-card/92 text-muted-foreground transition-colors duration-300 group-[.is-active]:border-primary/45 group-[.is-active]:bg-primary/10 group-[.is-active]:text-primary">
                <span className="designlab-settings-mobile-icon grid h-8 w-8 place-items-center rounded-lg bg-muted/70 text-foreground transition-colors duration-300 group-[.is-active]:bg-primary/14 group-[.is-active]:text-primary">
                  <FileText className="h-[clamp(1.05rem,5vw,1.35rem)] w-[clamp(1.05rem,5vw,1.35rem)]" />
                </span>
              </span>
              <span className="sr-only">Atendimentos</span>
            </button>
            <button
              type="button"
              className="designlab-settings-mobile-item is-primary group relative flex min-w-0 flex-col items-center justify-center rounded-xl p-[1px] text-center transition-[filter,transform] duration-300 ease-out active:translate-y-0.5"
              onClick={() => navigate("/pacientes/novo")}
              aria-label="Novo paciente"
            >
              <span className="designlab-settings-mobile-surface flex h-14 w-full items-center justify-center rounded-[0.68rem] border border-primary/45 bg-primary/10 text-primary transition-colors duration-300">
                <span className="designlab-settings-mobile-icon grid h-8 w-8 place-items-center rounded-lg bg-primary/14 text-primary transition-colors duration-300">
                  <Plus className="h-[clamp(1.15rem,5.6vw,1.5rem)] w-[clamp(1.15rem,5.6vw,1.5rem)]" />
                </span>
              </span>
              <span className="sr-only">Novo paciente</span>
            </button>
            <button
              type="button"
              className="designlab-settings-mobile-item group relative flex min-w-0 flex-col items-center justify-center rounded-xl p-[1px] text-center transition-[filter,transform] duration-300 ease-out active:translate-y-0.5"
              onClick={() => setAgendaDialogOpen(true)}
              aria-label="Agenda"
            >
              <span className="designlab-settings-mobile-surface flex h-14 w-full items-center justify-center rounded-[0.68rem] border border-border/80 bg-card/92 text-muted-foreground transition-colors duration-300">
                <span className="designlab-settings-mobile-icon grid h-8 w-8 place-items-center rounded-lg bg-muted/70 text-foreground transition-colors duration-300">
                  <CalendarDays className="h-[clamp(1.05rem,5vw,1.35rem)] w-[clamp(1.05rem,5vw,1.35rem)]" />
                </span>
              </span>
              <span className="sr-only">Agenda</span>
            </button>
            <button
              type="button"
              className="designlab-settings-mobile-item group relative flex min-w-0 flex-col items-center justify-center rounded-xl p-[1px] text-center transition-[filter,transform] duration-300 ease-out active:translate-y-0.5 disabled:opacity-45"
              onClick={() => {
                if (canViewFinancialData) {
                  setDashboardDialogOpen(true);
                }
              }}
              disabled={!canViewFinancialData}
              aria-label="Estatísticas"
            >
              <span className="designlab-settings-mobile-surface flex h-14 w-full items-center justify-center rounded-[0.68rem] border border-border/80 bg-card/92 text-muted-foreground transition-colors duration-300">
                <span className="designlab-settings-mobile-icon grid h-8 w-8 place-items-center rounded-lg bg-muted/70 text-foreground transition-colors duration-300">
                  <BarChart3 className="h-[clamp(1.05rem,5vw,1.35rem)] w-[clamp(1.05rem,5vw,1.35rem)]" />
                </span>
              </span>
              <span className="sr-only">Estatísticas</span>
            </button>
          </div>
        </nav>
      ) : null}

      {filtersAreActive && (
        <div className="flex items-center gap-2 flex-wrap">
          {selectedGroupNames.length > 0 && (
            <Badge variant="secondary">Grupos: {selectedGroupNames.join(", ")}</Badge>
          )}
          {selectedColors.length > 0 && (
            <Badge variant="secondary">Cores: {selectedColors.join(", ")}</Badge>
          )}
          {selectedCollaboratorIds.length > 0 && (
            <Badge variant="secondary">
              Colaborador: {selectedCollaboratorIds
                .map((id) => collaborators.find((collaborator) => collaborator.id === id)?.full_name ?? collaborators.find((collaborator) => collaborator.id === id)?.email ?? id)
                .join(", ")}
            </Badge>
          )}
          {selectedStatuses.length > 0 && (
            <Badge variant="secondary">Status: {selectedStatuses.map((status) => PATIENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status).join(", ")}</Badge>
          )}
          {selectedOriginTypes.length > 0 && (
            <Badge variant="secondary">
              Origem: {PATIENT_ORIGIN_OPTIONS.filter((option) => selectedOriginTypes.includes(option.value)).map((option) => option.label).join(", ")}
            </Badge>
          )}
          {selectedPaymentStatuses.length > 0 && (
            <Badge variant="secondary">
              Pagamento: {HOME_PATIENT_PAYMENT_STATUS_OPTIONS.filter((option) => selectedPaymentStatuses.includes(option.value)).map((option) => option.label).join(", ")}
            </Badge>
          )}
          {selectedAgendaStatuses.length > 0 && (
            <Badge variant="secondary">
              Agendamento: {HOME_PATIENT_AGENDA_STATUS_OPTIONS.filter((option) => selectedAgendaStatuses.includes(option.value)).map((option) => option.label).join(", ")}
            </Badge>
          )}
          {selectedRecurrenceStatuses.length > 0 && (
            <Badge variant="secondary">
              Recorrência: {HOME_PATIENT_RECURRENCE_STATUS_OPTIONS.filter((option) => selectedRecurrenceStatuses.includes(option.value)).map((option) => option.label).join(", ")}
            </Badge>
          )}
          {selectedRecurringWeekdays.length > 0 && (
            <Badge variant="secondary">
              Dias recorrentes: {HOME_PATIENT_WEEKDAY_OPTIONS.filter((weekday) => selectedRecurringWeekdays.includes(weekday.value)).map((weekday) => weekday.label).join(", ")}
            </Badge>
          )}
          {(sessionDateFrom || sessionDateTo) && (
            <Badge variant="secondary">
              Período: {sessionDateFrom || "início"} até {sessionDateTo || "hoje"}
            </Badge>
          )}
          {selectedWeekdays.length > 0 && (
            <Badge variant="secondary">
              Dias dos atendimentos: {HOME_PATIENT_WEEKDAY_OPTIONS.filter((weekday) => selectedWeekdays.includes(weekday.value)).map((weekday) => weekday.label).join(", ")}
            </Badge>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4" />
            Limpar filtros
          </Button>
        </div>
      )}

      {listMode === "sessions" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Atendimentos</h2>
            <p className="text-sm text-muted-foreground">
              {visibleSessions.length} atendimento{visibleSessions.length !== 1 ? "s" : ""} encontrado{visibleSessions.length !== 1 ? "s" : ""}
            </p>
          </div>
          {visibleSessions.map((session) => (
            <motion.div key={session.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
              {renderSessionCard(session)}
            </motion.div>
          ))}
          {visibleSessions.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Nenhum atendimento encontrado.</p>
            </Card>
          )}
        </div>
      ) : isShowingPatientList ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">{selectedPatientSortLabel}</h2>
            <p className="text-sm text-muted-foreground">
              {visiblePatients.length} paciente{visiblePatients.length !== 1 ? "s" : ""} encontrado{visiblePatients.length !== 1 ? "s" : ""}
            </p>
          </div>
          {visiblePatients.map((patient) => (
            <motion.div key={patient.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
              <PatientCard patient={patient} />
            </motion.div>
          ))}
          {visiblePatients.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum paciente encontrado.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {recentPatients.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-muted-foreground">Pacientes recentes</h2>
                <p className="text-sm text-muted-foreground">
                  {recentPatients.length} paciente{recentPatients.length !== 1 ? "s" : ""} encontrado{recentPatients.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="space-y-2">
                {recentPatients.map((patient) => (
                  <PatientCard key={patient.id} patient={patient} />
                ))}
              </div>
            </div>
          )}
          {recentPatients.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Nenhum paciente cadastrado ainda.</p>
              <Button className="mt-4" onClick={() => navigate("/pacientes/novo")}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar primeiro paciente
              </Button>
            </Card>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default Index;
