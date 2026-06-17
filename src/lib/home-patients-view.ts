import { comparePatientStatusPriority } from "@/lib/patient-statuses";
import { filterActivePatientGroups } from "@/lib/patient-groups";
import { normalizePatientOriginType, type PatientOriginType } from "@/lib/patient-origin";
import { normalizePatientRecurringWeekdays } from "@/lib/patient-recurrence";
import { buildPatientOperationalSummary, formatMoneyCents } from "@/lib/session-operations";

export const DEFAULT_HOME_PATIENT_SORT_KEY = "updated_at_desc" as const;

export const DEFAULT_HOME_SESSION_SORT_KEY = "session_date_desc" as const;

export type HomePatientSortKey =
  | typeof DEFAULT_HOME_PATIENT_SORT_KEY
  | "updated_at_asc"
  | "name_asc"
  | "birth_date_asc"
  | "last_session_desc"
  | "last_session_asc"
  | "session_count_desc"
  | "missed_count_desc"
  | "status_priority";

export type HomeSessionSortKey =
  | typeof DEFAULT_HOME_SESSION_SORT_KEY
  | "session_date_asc"
  | "status_asc"
  | "patient_name_asc"
  | "amount_charged_desc"
  | "amount_paid_desc";


export interface HomePatientFilters {
  agendaStatuses: HomePatientAgendaFilterStatus[];
  collaboratorIds: string[];
  colors: string[];
  groupNames: string[];
  originTypes: PatientOriginType[];
  paymentStatuses: HomePatientPaymentFilterStatus[];
  recurrenceStatuses: HomePatientRecurrenceFilterStatus[];
  recurringWeekdays: number[];
  searchTerm: string;
  sessionDateFrom: string;
  sessionDateTo: string;
  statuses: string[];
  weekdays: number[];
}

export interface HomePatientRecord {
  cpf: string | null;
  date_of_birth: string | null;
  gender: string | null;
  id: string;
  is_recurring?: boolean | null;
  name: string;
  origin_type?: string | null;
  phone: string | null;
  pronoun: string | null;
  recurring_time?: string | null;
  recurring_weekdays?: number[] | null;
  status: string;
  updated_at: string;
}

export interface HomePatientGroupRecord {
  color: string;
  id?: string;
  name: string;
  patient_id: string;
  status: string | null;
}

export interface HomeSessionRecord {
  amount_charged_cents?: number | null;
  amount_paid_cents?: number | null;
  group_id?: string | null;
  id: string;
  patient_id: string;
  payment_method?: string | null;
  payment_status?: string | null;
  provider_id?: string | null;
  session_date: string;
  status: string;
  user_id?: string | null;
}

export interface HomeAgendaEventRecord {
  event_type: string;
  id: string;
  patient_id: string | null;
  scheduled_for: string;
  status: string;
  title: string;
}

export interface HomeCollaboratorFilterRecord {
  email: string | null;
  full_name: string | null;
  id: string;
  job_title: string | null;
  operational_role: string | null;
}

export interface HomePatientView {
  collaboratorIds: string[];
  colors: string[];
  cpf: string | null;
  date_of_birth: string | null;
  firstSessionDate: string | null;
  gender: string | null;
  groups: { color: string; name: string; status: string | null }[];
  hasSessionInDateRange: boolean;
  id: string;
  lastSessionDate: string | null;
  missedCount: number;
  name: string;
  originType: PatientOriginType;
  agendaFilterStatuses: HomePatientAgendaFilterStatus[];
  nextAgendaSummary: HomePatientAgendaSummary | null;
  paymentFilterStatus: HomePatientPaymentFilterStatus;
  paymentSummary: HomePatientPaymentSummary | null;
  phone: string | null;
  pronoun: string | null;
  recurrenceFilterStatus: HomePatientRecurrenceFilterStatus;
  recurringWeekdays: number[];
  searchableText: string;
  sessionCount: number;
  sessionWeekdays: number[];
  status: string;
  statusPriority: number;
  updatedAt: string;
}

export interface HomePatientPaymentSummary {
  amountLabel: string | null;
  description: string;
  label: string;
  tone: "credit" | "debt" | "paid" | "pending";
}

export interface HomePatientAgendaSummary {
  description: string;
  scheduledForLabel: string;
  statusLabel: string;
  tone: "confirmed" | "late" | "next" | "unconfirmed";
  title: string;
}

export type HomePatientPaymentFilterStatus =
  | "credit"
  | "debt"
  | "pending"
  | "paid"
  | "courtesy"
  | "not_charged"
  | "no_financial_record";

export type HomePatientAgendaFilterStatus =
  | "late"
  | "next"
  | "confirmed"
  | "unconfirmed"
  | "no_agenda";

export type HomePatientRecurrenceFilterStatus = "recurring" | "not_recurring";

export const HOME_PATIENT_PAYMENT_STATUS_OPTIONS: { label: string; value: HomePatientPaymentFilterStatus }[] = [
  { label: "Crédito", value: "credit" },
  { label: "Devendo", value: "debt" },
  { label: "Pendente", value: "pending" },
  { label: "Pago", value: "paid" },
  { label: "Cortesia", value: "courtesy" },
  { label: "Não cobrado", value: "not_charged" },
  { label: "Sem registro financeiro", value: "no_financial_record" },
];

export const HOME_PATIENT_AGENDA_STATUS_OPTIONS: { label: string; value: HomePatientAgendaFilterStatus }[] = [
  { label: "Atrasado", value: "late" },
  { label: "Próximo atendimento", value: "next" },
  { label: "Confirmado", value: "confirmed" },
  { label: "Aguardando confirmação", value: "unconfirmed" },
  { label: "Sem agendamento", value: "no_agenda" },
];

export const HOME_PATIENT_RECURRENCE_STATUS_OPTIONS: { label: string; value: HomePatientRecurrenceFilterStatus }[] = [
  { label: "Pacientes recorrentes", value: "recurring" },
  { label: "Sem recorrência", value: "not_recurring" },
];

export const HOME_PATIENT_WEEKDAY_OPTIONS = [
  { label: "Domingo", value: 0 },
  { label: "Segunda-feira", value: 1 },
  { label: "Terça-feira", value: 2 },
  { label: "Quarta-feira", value: 3 },
  { label: "Quinta-feira", value: 4 },
  { label: "Sexta-feira", value: 5 },
  { label: "Sábado", value: 6 },
] as const;

export const HOME_PATIENT_SORT_OPTIONS: { label: string; value: HomePatientSortKey }[] = [
  { label: "Pacientes mais recentes", value: DEFAULT_HOME_PATIENT_SORT_KEY },
  { label: "Pacientes mais antigos", value: "updated_at_asc" },
  { label: "Nome", value: "name_asc" },
  { label: "Data de nascimento", value: "birth_date_asc" },
  { label: "Atendimento mais recente", value: "last_session_desc" },
  { label: "Atendimento mais antigo", value: "last_session_asc" },
  { label: "Quantidade de sessões", value: "session_count_desc" },
  { label: "Quantidade de faltas", value: "missed_count_desc" },
  { label: "Status de atividade", value: "status_priority" },
];

export const HOME_SESSION_SORT_OPTIONS: { label: string; value: HomeSessionSortKey }[] = [
  { label: "Mais recentes", value: DEFAULT_HOME_SESSION_SORT_KEY },
  { label: "Mais antigos", value: "session_date_asc" },
  { label: "Status", value: "status_asc" },
  { label: "Paciente (A-Z)", value: "patient_name_asc" },
  { label: "Valor cobrado", value: "amount_charged_desc" },
  { label: "Valor pago", value: "amount_paid_desc" },
];


const toDigits = (value: string | null | undefined) => value?.replace(/\D/g, "") ?? "";

const toLocalDateKey = (value: string) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const compareText = (left: string, right: string) => left.localeCompare(right, "pt-BR", { sensitivity: "base" });

const compareNullableAsc = (left: string | null, right: string | null) => {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
};

const compareNullableDesc = (left: string | null, right: string | null) => {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return right.localeCompare(left);
};

const buildSearchableText = (patient: HomePatientRecord) =>
  [
    patient.name,
    patient.cpf ?? "",
    patient.phone ?? "",
    toDigits(patient.cpf),
    toDigits(patient.phone),
  ]
    .join(" ")
    .toLowerCase();

const isSessionInDateRange = (sessionDate: string, sessionDateFrom: string, sessionDateTo: string) => {
  const sessionDateKey = toLocalDateKey(sessionDate);

  if (sessionDateFrom && sessionDateKey < sessionDateFrom) {
    return false;
  }

  if (sessionDateTo && sessionDateKey > sessionDateTo) {
    return false;
  }

  return true;
};

const buildHomePatientPaymentSummary = (sessions: HomeSessionRecord[]): HomePatientPaymentSummary | null => {
  if (sessions.length === 0) {
    return null;
  }

  const summary = buildPatientOperationalSummary(sessions);
  const netCreditCents = Math.max(0, summary.paidCents - summary.chargedCents);
  const netOpenBalanceCents = Math.max(0, summary.chargedCents - summary.paidCents);

  if (netCreditCents > 0) {
    return {
      amountLabel: formatMoneyCents(netCreditCents),
      description: "O paciente tem valor pago a mais para usar como crédito.",
      label: "Crédito",
      tone: "credit",
    };
  }

  if (netOpenBalanceCents > 0) {
    const isPartiallyPaid = summary.paidCents > 0;

    return {
      amountLabel: formatMoneyCents(netOpenBalanceCents),
      description: isPartiallyPaid ? "Existe saldo em aberto após pagamento parcial." : "Ainda não há baixa de pagamento para valores cobrados.",
      label: isPartiallyPaid ? "Devendo" : "Pendente",
      tone: isPartiallyPaid ? "debt" : "pending",
    };
  }

  if (summary.chargedCents > 0) {
    return {
      amountLabel: null,
      description: "Os valores cobrados estão quitados.",
      label: "Pago",
      tone: "paid",
    };
  }

  if (sessions.some((session) => session.payment_status === "cortesia")) {
    return {
      amountLabel: null,
      description: "Este paciente possui atendimento de cortesia.",
      label: "Cortesia",
      tone: "paid",
    };
  }

  return {
    amountLabel: null,
    description: "Não há cobrança registrada nos atendimentos.",
    label: "Não cobrado",
    tone: "paid",
  };
};

const buildHomePatientPaymentFilterStatus = (sessions: HomeSessionRecord[]): HomePatientPaymentFilterStatus => {
  if (sessions.length === 0) {
    return "no_financial_record";
  }

  const summary = buildPatientOperationalSummary(sessions);
  const netCreditCents = Math.max(0, summary.paidCents - summary.chargedCents);
  const netOpenBalanceCents = Math.max(0, summary.chargedCents - summary.paidCents);

  if (netCreditCents > 0) {
    return "credit";
  }

  if (netOpenBalanceCents > 0) {
    return summary.paidCents > 0 ? "debt" : "pending";
  }

  if (summary.chargedCents > 0) {
    return "paid";
  }

  if (sessions.some((session) => session.payment_status === "cortesia")) {
    return "courtesy";
  }

  return "not_charged";
};

const agendaStatusLabels: Record<string, string> = {
  aguardando_confirmacao: "Aguardando confirmação",
  cancelado: "Cancelado",
  confirmado: "Confirmado",
  lembrete: "Lembrete",
};

const agendaTypeLabels: Record<string, string> = {
  atendimento: "Atendimento",
  evento: "Evento",
  reuniao: "Reunião",
};

const formatAgendaDateTimeLabel = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));

const getAgendaEventTime = (event: HomeAgendaEventRecord) => new Date(event.scheduled_for).getTime();

const getRelevantAgendaEvent = (agendaEvents: HomeAgendaEventRecord[], now: number) => {
  const activeEvents = agendaEvents
    .filter((event) => event.patient_id && event.status !== "cancelado" && !Number.isNaN(getAgendaEventTime(event)))
    .sort((left, right) => getAgendaEventTime(left) - getAgendaEventTime(right));
  const lateEvents = activeEvents
    .filter((event) => getAgendaEventTime(event) < now)
    .sort((left, right) => getAgendaEventTime(right) - getAgendaEventTime(left));

  return lateEvents[0] ?? activeEvents.find((event) => getAgendaEventTime(event) >= now) ?? null;
};

const getNextGlobalAgendaEventId = (agendaEvents: HomeAgendaEventRecord[], now: number) =>
  agendaEvents
    .filter((event) => event.patient_id && event.status !== "cancelado" && !Number.isNaN(getAgendaEventTime(event)) && getAgendaEventTime(event) >= now)
    .sort((left, right) => getAgendaEventTime(left) - getAgendaEventTime(right))[0]?.id ?? null;

const getAgendaSummaryTone = (event: HomeAgendaEventRecord, nextGlobalAgendaEventId: string | null, now: number): HomePatientAgendaSummary["tone"] => {
  if (getAgendaEventTime(event) < now) {
    return "late";
  }

  if (event.id === nextGlobalAgendaEventId) {
    return "next";
  }

  if (event.status === "confirmado") {
    return "confirmed";
  }

  return "unconfirmed";
};

const buildHomePatientAgendaSummary = (
  agendaEvents: HomeAgendaEventRecord[],
  nextGlobalAgendaEventId: string | null,
  now: number,
): HomePatientAgendaSummary | null => {
  const activeEvents = agendaEvents.filter((event) => event.patient_id && event.status !== "cancelado" && !Number.isNaN(getAgendaEventTime(event)));
  const nextEvent = getRelevantAgendaEvent(activeEvents, now);

  if (!nextEvent) {
    return null;
  }

  const extraEventsCount = activeEvents.length - 1;
  const eventTypeLabel = agendaTypeLabels[nextEvent.event_type] ?? "Agendamento";
  const statusLabel = agendaStatusLabels[nextEvent.status] ?? nextEvent.status;
  const eventIsLate = getAgendaEventTime(nextEvent) < now;

  return {
    description:
      eventIsLate
        ? `${eventTypeLabel} atrasado. Revise o horário ou atualize o status na agenda.`
        : extraEventsCount > 0
        ? `${eventTypeLabel} mais próximo. Há mais ${extraEventsCount} agendamento${extraEventsCount !== 1 ? "s" : ""} vinculado${extraEventsCount !== 1 ? "s" : ""} a este paciente.`
        : `${eventTypeLabel} futuro vinculado a este paciente.`,
    scheduledForLabel: formatAgendaDateTimeLabel(nextEvent.scheduled_for),
    statusLabel,
    tone: getAgendaSummaryTone(nextEvent, nextGlobalAgendaEventId, now),
    title: nextEvent.title,
  };
};

const buildHomePatientAgendaFilterStatuses = (
  agendaEvents: HomeAgendaEventRecord[],
  nextGlobalAgendaEventId: string | null,
  now: number,
): HomePatientAgendaFilterStatus[] => {
  const activeEvents = agendaEvents.filter((event) => event.patient_id && event.status !== "cancelado" && !Number.isNaN(getAgendaEventTime(event)));

  if (activeEvents.length === 0) {
    return ["no_agenda"];
  }

  return Array.from(
    new Set(
      activeEvents.map((event) => getAgendaSummaryTone(event, nextGlobalAgendaEventId, now)),
    ),
  );
};

const compareByName = (left: HomePatientView, right: HomePatientView) => compareText(left.name, right.name);

const compareByDefault = (left: HomePatientView, right: HomePatientView) =>
  right.updatedAt.localeCompare(left.updatedAt) || compareByName(left, right);

const comparePatientsForSort = (sortKey: HomePatientSortKey, left: HomePatientView, right: HomePatientView) => {
  switch (sortKey) {
    case "name_asc":
      return compareByName(left, right) || right.updatedAt.localeCompare(left.updatedAt);
    case "birth_date_asc":
      return compareNullableAsc(left.date_of_birth, right.date_of_birth) || compareByName(left, right);
    case "last_session_desc":
      return compareNullableDesc(left.lastSessionDate, right.lastSessionDate) || compareByName(left, right);
    case "last_session_asc":
      return compareNullableAsc(left.lastSessionDate, right.lastSessionDate) || compareByName(left, right);
    case "session_count_desc":
      return right.sessionCount - left.sessionCount || compareByName(left, right);
    case "missed_count_desc":
      return right.missedCount - left.missedCount || compareByName(left, right);
    case "status_priority":
      return comparePatientStatusPriority(left.status, right.status) || compareByName(left, right);
    case "updated_at_asc":
      return left.updatedAt.localeCompare(right.updatedAt) || compareByName(left, right);
    case DEFAULT_HOME_PATIENT_SORT_KEY:
    default:
      return compareByDefault(left, right);
  }
};

export const hasActiveHomePatientFilters = (filters: HomePatientFilters) =>
  filters.agendaStatuses.length > 0 ||
  filters.collaboratorIds.length > 0 ||
  filters.colors.length > 0 ||
  filters.groupNames.length > 0 ||
  filters.originTypes.length > 0 ||
  filters.paymentStatuses.length > 0 ||
  filters.recurrenceStatuses.length > 0 ||
  filters.recurringWeekdays.length > 0 ||
  filters.statuses.length > 0 ||
  filters.weekdays.length > 0 ||
  filters.sessionDateFrom.length > 0 ||
  filters.sessionDateTo.length > 0;

export const getActiveHomePatientFilterCount = (filters: HomePatientFilters) =>
  filters.agendaStatuses.length +
  filters.collaboratorIds.length +
  filters.colors.length +
  filters.groupNames.length +
  filters.originTypes.length +
  filters.paymentStatuses.length +
  filters.recurrenceStatuses.length +
  filters.recurringWeekdays.length +
  filters.statuses.length +
  filters.weekdays.length +
  (filters.sessionDateFrom ? 1 : 0) +
  (filters.sessionDateTo ? 1 : 0);

export const buildHomePatientViews = ({
  filters,
  agendaEvents = [],
  patientGroups,
  patients,
  sessions,
  sortKey,
  showFinancialData = true,
}: {
  filters: HomePatientFilters;
  agendaEvents?: HomeAgendaEventRecord[];
  patientGroups: HomePatientGroupRecord[];
  patients: HomePatientRecord[];
  sessions: HomeSessionRecord[];
  sortKey: HomePatientSortKey;
  showFinancialData?: boolean;
}) => {
  const sessionsByPatientId = new Map<string, HomeSessionRecord[]>();
  const agendaEventsByPatientId = new Map<string, HomeAgendaEventRecord[]>();
  const now = Date.now();
  const nextGlobalAgendaEventId = getNextGlobalAgendaEventId(agendaEvents, now);

  sessions.forEach((session) => {
    const current = sessionsByPatientId.get(session.patient_id) ?? [];
    current.push(session);
    sessionsByPatientId.set(session.patient_id, current);
  });

  agendaEvents.forEach((event) => {
    if (!event.patient_id) {
      return;
    }

    const current = agendaEventsByPatientId.get(event.patient_id) ?? [];
    current.push(event);
    agendaEventsByPatientId.set(event.patient_id, current);
  });

  return patients
    .map<HomePatientView>((patient) => {
      const patientSessions = (sessionsByPatientId.get(patient.id) ?? []).sort((left, right) =>
        left.session_date.localeCompare(right.session_date),
      );
      const patientLastSession = patientSessions.at(-1)?.session_date ?? null;
      const patientFirstSession = patientSessions[0]?.session_date ?? null;
      const sessionWeekdays = Array.from(new Set(patientSessions.map((session) => new Date(session.session_date).getDay()))).sort(
        (left, right) => left - right,
      );
      const groups = filterActivePatientGroups(
        patientGroups
          .filter((group) => group.patient_id === patient.id)
          .map((group) => ({ color: group.color, name: group.name, status: group.status })),
      );
      const collaboratorIds = Array.from(
        new Set(
          patientSessions.flatMap((session) =>
            [session.user_id, session.provider_id].filter((value): value is string => Boolean(value)),
          ),
        ),
      );

      return {
        agendaFilterStatuses: buildHomePatientAgendaFilterStatuses(agendaEventsByPatientId.get(patient.id) ?? [], nextGlobalAgendaEventId, now),
        collaboratorIds,
        colors: Array.from(new Set(groups.map((group) => group.color))),
        cpf: patient.cpf,
        date_of_birth: patient.date_of_birth,
        firstSessionDate: patientFirstSession,
        gender: patient.gender,
        groups,
        hasSessionInDateRange:
          !filters.sessionDateFrom && !filters.sessionDateTo
            ? true
            : patientSessions.some((session) =>
                isSessionInDateRange(session.session_date, filters.sessionDateFrom, filters.sessionDateTo),
              ),
        id: patient.id,
        lastSessionDate: patientLastSession,
        missedCount: patientSessions.filter((session) => session.status === "cancelado").length,
        name: patient.name,
        originType: normalizePatientOriginType(patient.origin_type),
        nextAgendaSummary: buildHomePatientAgendaSummary(agendaEventsByPatientId.get(patient.id) ?? [], nextGlobalAgendaEventId, now),
        paymentFilterStatus: showFinancialData ? buildHomePatientPaymentFilterStatus(patientSessions) : "no_financial_record",
        paymentSummary: showFinancialData ? buildHomePatientPaymentSummary(patientSessions) : null,
        phone: patient.phone,
        pronoun: patient.pronoun,
        recurrenceFilterStatus: patient.is_recurring ? "recurring" : "not_recurring",
        recurringWeekdays: normalizePatientRecurringWeekdays(patient.recurring_weekdays),
        searchableText: buildSearchableText(patient),
        sessionCount: patientSessions.length,
        sessionWeekdays,
        status: patient.status,
        statusPriority: comparePatientStatusPriority(patient.status, "desconhecido"),
        updatedAt: patient.updated_at,
      };
    })
    .filter((patient) => {
      const searchTerm = filters.searchTerm.trim().toLowerCase();

      if (searchTerm && !patient.searchableText.includes(searchTerm)) {
        return false;
      }

      if (filters.statuses.length > 0 && !filters.statuses.includes(patient.status)) {
        return false;
      }

      if (filters.originTypes.length > 0 && !filters.originTypes.includes(patient.originType)) {
        return false;
      }

      if (filters.paymentStatuses.length > 0 && !filters.paymentStatuses.includes(patient.paymentFilterStatus)) {
        return false;
      }

      if (filters.agendaStatuses.length > 0 && !patient.agendaFilterStatuses.some((status) => filters.agendaStatuses.includes(status))) {
        return false;
      }

      if (filters.recurrenceStatuses.length > 0 && !filters.recurrenceStatuses.includes(patient.recurrenceFilterStatus)) {
        return false;
      }

      if (filters.recurringWeekdays.length > 0 && !patient.recurringWeekdays.some((weekday) => filters.recurringWeekdays.includes(weekday))) {
        return false;
      }

      if (filters.groupNames.length > 0 && !patient.groups.some((group) => filters.groupNames.includes(group.name))) {
        return false;
      }

      if (filters.colors.length > 0 && !patient.colors.some((color) => filters.colors.includes(color))) {
        return false;
      }

      if (filters.collaboratorIds.length > 0 && !patient.collaboratorIds.some((id) => filters.collaboratorIds.includes(id))) {
        return false;
      }

      if ((filters.sessionDateFrom || filters.sessionDateTo) && !patient.hasSessionInDateRange) {
        return false;
      }

      if (filters.weekdays.length > 0 && !patient.sessionWeekdays.some((weekday) => filters.weekdays.includes(weekday))) {
        return false;
      }

      return true;
    })
    .sort((left, right) => comparePatientsForSort(sortKey, left, right));
};
