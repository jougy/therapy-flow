import type {
  HomePatientGroupRecord,
  HomePatientPaymentFilterStatus,
  HomePatientRecord,
  HomeSessionRecord,
  HomeSessionSortKey,
} from "@/lib/home-patients-view";
import { normalizePatientOriginType, type PatientOriginType } from "@/lib/patient-origin";
import { getPaymentMethodLabel, getPaymentStatusLabel, sanitizeDashboardCents } from "@/lib/session-operations";

export interface HomeSessionFilters {
  searchTerm?: string;
  selectedStatuses?: string[];
  selectedOriginTypes?: PatientOriginType[];
  selectedRecurrenceStatuses?: string[];
  selectedRecurringWeekdays?: number[];
  selectedCollaboratorIds?: string[];
  selectedGroupNames?: string[];
  selectedColors?: string[];
  selectedPaymentStatuses?: HomePatientPaymentFilterStatus[];
  sessionDateFrom?: string;
  sessionDateTo?: string;
  selectedWeekdays?: number[];
}

const normalize = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

export function filterAndSortHomeSessions({
  sessions,
  patientById,
  groupById,
  patientGroupsByPatientId,
  filters,
  sortKey,
  canViewFinancialData = true,
}: {
  sessions: HomeSessionRecord[];
  patientById: Map<string, HomePatientRecord>;
  groupById: Map<string, HomePatientGroupRecord>;
  patientGroupsByPatientId: Map<string, HomePatientGroupRecord[]>;
  filters: HomeSessionFilters;
  sortKey: HomeSessionSortKey;
  canViewFinancialData?: boolean;
}): HomeSessionRecord[] {
  const normalizedSearch = normalize(filters.searchTerm);
  const dateFrom = filters.sessionDateFrom ? new Date(`${filters.sessionDateFrom}T00:00:00`) : null;
  const dateTo = filters.sessionDateTo ? new Date(`${filters.sessionDateTo}T23:59:59`) : null;
  const statuses = filters.selectedStatuses ?? [];
  const originTypes = filters.selectedOriginTypes ?? [];
  const recurrenceStatuses = filters.selectedRecurrenceStatuses ?? [];
  const recurringWeekdays = filters.selectedRecurringWeekdays ?? [];
  const collaboratorIds = filters.selectedCollaboratorIds ?? [];
  const groupNames = filters.selectedGroupNames ?? [];
  const colors = filters.selectedColors ?? [];
  const paymentStatuses = filters.selectedPaymentStatuses ?? [];
  const weekdays = filters.selectedWeekdays ?? [];

  return sessions
    .filter((session) => {
      const patient = patientById.get(session.patient_id);
      const sessionDate = new Date(session.session_date);
      const hasValidDate = !Number.isNaN(sessionDate.getTime());
      const sessionGroup = session.group_id ? groupById.get(session.group_id) : null;
      const patientGroupsForSession = patientGroupsByPatientId.get(session.patient_id) ?? [];
      const groupsToSearch = sessionGroup ? [sessionGroup] : patientGroupsForSession;

      if (normalizedSearch) {
        const searchable = normalize(
          [
            patient?.name,
            patient?.cpf,
            patient?.phone,
            session.status,
            getPaymentStatusLabel(session.payment_status),
            getPaymentMethodLabel(session.payment_method),
            formatDateTime(session.session_date),
            ...groupsToSearch.map((group) => group.name),
          ]
            .filter(Boolean)
            .join(" ")
        );

        if (!searchable.includes(normalizedSearch)) {
          return false;
        }
      }

      if (statuses.length > 0 && (!patient || !statuses.includes(patient.status))) {
        return false;
      }

      if (
        originTypes.length > 0 &&
        (!patient || !originTypes.includes(normalizePatientOriginType(patient.origin_type)))
      ) {
        return false;
      }

      if (recurrenceStatuses.length > 0) {
        const hasRecurrence = (patient?.recurring_weekdays ?? []).length > 0;
        if (recurrenceStatuses.includes("recurring") && !hasRecurrence) {
          return false;
        }
        if (recurrenceStatuses.includes("not_recurring") && hasRecurrence) {
          return false;
        }
      }

      if (recurringWeekdays.length > 0) {
        const patientRecurringWeekdays = patient?.recurring_weekdays ?? [];
        if (!recurringWeekdays.some((weekday) => patientRecurringWeekdays.includes(weekday))) {
          return false;
        }
      }

      if (collaboratorIds.length > 0) {
        const sessionCollaborators = [session.provider_id, session.user_id].filter(Boolean);
        if (!sessionCollaborators.some((id) => collaboratorIds.includes(id as string))) {
          return false;
        }
      }

      if (groupNames.length > 0 && !groupsToSearch.some((group) => groupNames.includes(group.name))) {
        return false;
      }

      if (colors.length > 0 && !groupsToSearch.some((group) => colors.includes(group.color))) {
        return false;
      }

      if (canViewFinancialData && paymentStatuses.length > 0) {
        const charged = sanitizeDashboardCents(session.amount_charged_cents);
        const paid = sanitizeDashboardCents(session.amount_paid_cents);
        const balance = Math.max(0, charged - paid);
        const credit = Math.max(0, paid - charged);
        const status =
          session.payment_status === "cortesia"
            ? "courtesy"
            : charged <= 0 && paid <= 0
            ? "not_charged"
            : credit > 0
            ? "credit"
            : balance > 0 && paid > 0
            ? "debt"
            : balance > 0
            ? "pending"
            : "paid";

        if (!paymentStatuses.includes(status as HomePatientPaymentFilterStatus)) {
          return false;
        }
      }

      if (dateFrom && (!hasValidDate || sessionDate < dateFrom)) {
        return false;
      }

      if (dateTo && (!hasValidDate || sessionDate > dateTo)) {
        return false;
      }

      if (weekdays.length > 0 && (!hasValidDate || !weekdays.includes(sessionDate.getDay()))) {
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

      switch (sortKey) {
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
}
