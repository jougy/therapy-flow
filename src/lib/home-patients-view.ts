import { comparePatientStatusPriority } from "@/lib/patient-statuses";
import { filterActivePatientGroups } from "@/lib/patient-groups";

export const DEFAULT_HOME_PATIENT_SORT_KEY = "updated_at_desc" as const;

export type HomePatientSortKey =
  | typeof DEFAULT_HOME_PATIENT_SORT_KEY
  | "name_asc"
  | "birth_date_asc"
  | "last_session_desc"
  | "last_session_asc"
  | "session_count_desc"
  | "missed_count_desc"
  | "status_priority";

export interface HomePatientFilters {
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
  name: string;
  phone: string | null;
  pronoun: string | null;
  status: string;
  updated_at: string;
}

export interface HomePatientGroupRecord {
  color: string;
  name: string;
  patient_id: string;
  status: string | null;
}

export interface HomeSessionRecord {
  id: string;
  patient_id: string;
  session_date: string;
  status: string;
}

export interface HomePatientView {
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
  phone: string | null;
  pronoun: string | null;
  searchableText: string;
  sessionCount: number;
  sessionWeekdays: number[];
  status: string;
  statusPriority: number;
  updatedAt: string;
}

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
  { label: "Padrão atual", value: DEFAULT_HOME_PATIENT_SORT_KEY },
  { label: "Nome", value: "name_asc" },
  { label: "Data de nascimento", value: "birth_date_asc" },
  { label: "Atendimento mais recente", value: "last_session_desc" },
  { label: "Atendimento mais antigo", value: "last_session_asc" },
  { label: "Quantidade de sessões", value: "session_count_desc" },
  { label: "Quantidade de faltas", value: "missed_count_desc" },
  { label: "Status de atividade", value: "status_priority" },
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
    case DEFAULT_HOME_PATIENT_SORT_KEY:
    default:
      return compareByDefault(left, right);
  }
};

export const hasActiveHomePatientFilters = (filters: HomePatientFilters) =>
  filters.statuses.length > 0 ||
  filters.weekdays.length > 0 ||
  filters.sessionDateFrom.length > 0 ||
  filters.sessionDateTo.length > 0;

export const getActiveHomePatientFilterCount = (filters: HomePatientFilters) =>
  filters.statuses.length +
  filters.weekdays.length +
  (filters.sessionDateFrom ? 1 : 0) +
  (filters.sessionDateTo ? 1 : 0);

export const buildHomePatientViews = ({
  filters,
  patientGroups,
  patients,
  sessions,
  sortKey,
}: {
  filters: HomePatientFilters;
  patientGroups: HomePatientGroupRecord[];
  patients: HomePatientRecord[];
  sessions: HomeSessionRecord[];
  sortKey: HomePatientSortKey;
}) => {
  const sessionsByPatientId = new Map<string, HomeSessionRecord[]>();

  sessions.forEach((session) => {
    const current = sessionsByPatientId.get(session.patient_id) ?? [];
    current.push(session);
    sessionsByPatientId.set(session.patient_id, current);
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

      return {
        cpf: patient.cpf,
        date_of_birth: patient.date_of_birth,
        firstSessionDate: patientFirstSession,
        gender: patient.gender,
        groups: filterActivePatientGroups(
          patientGroups
            .filter((group) => group.patient_id === patient.id)
            .map((group) => ({ color: group.color, name: group.name, status: group.status })),
        ),
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
        phone: patient.phone,
        pronoun: patient.pronoun,
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
