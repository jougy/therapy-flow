export type SearchablePatientGroup = {
  created_at: string;
  id: string;
  name: string;
  status: string | null;
};

export type SearchableSession = {
  group_id: string | null;
  id: string;
  session_date: string;
  status: string;
};

type SearchableOwnedSession = SearchableSession & {
  user_id: string;
};

export type SessionSearchFilters = {
  groupStatus: string;
  searchTerm: string;
  sessionStatus: string;
};

type BuildPatientSessionsViewArgs<TGroup extends SearchablePatientGroup, TSession extends SearchableSession> = {
  filters: SessionSearchFilters;
  getSessionText: (session: TSession) => string;
  groups: TGroup[];
  sessions: TSession[];
};

type SearchVisibilityArgs<TSession extends SearchableSession> = {
  groupName: string;
  searchTerm: string;
  session: TSession;
  textContent: string;
};

export type PatientSessionGroupView<TGroup extends SearchablePatientGroup, TSession extends SearchableSession> = {
  firstSessionDate: string | null;
  group: TGroup;
  latestSessionDate: string | null;
  sessionCount: number;
  sessions: TSession[];
};

const normalizeTerm = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const formatDateForSearch = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("pt-BR");
};

export const shouldSessionBeVisibleInSearch = <TSession extends SearchableSession>({
  groupName,
  searchTerm,
  session,
  textContent,
}: SearchVisibilityArgs<TSession>) => {
  const normalizedSearch = normalizeTerm(searchTerm);

  if (!normalizedSearch) {
    return true;
  }

  const haystack = normalizeTerm(
    [
      groupName,
      session.status,
      formatDateForSearch(session.session_date),
      textContent,
    ].join(" ")
  );

  return haystack.includes(normalizedSearch);
};

export const buildPatientSessionsView = <
  TGroup extends SearchablePatientGroup,
  TSession extends SearchableSession,
>({
  filters,
  getSessionText,
  groups,
  sessions,
}: BuildPatientSessionsViewArgs<TGroup, TSession>) => {
  const grouped = groups
    .filter((group) => filters.groupStatus === "all" || group.status === filters.groupStatus)
    .map<PatientSessionGroupView<TGroup, TSession>>((group) => {
      const visibleSessions = sessions.filter((session) => {
        if (session.group_id !== group.id) {
          return false;
        }

        if (filters.sessionStatus !== "all" && session.status !== filters.sessionStatus) {
          return false;
        }

        return shouldSessionBeVisibleInSearch({
          groupName: group.name,
          searchTerm: filters.searchTerm,
          session,
          textContent: getSessionText(session),
        });
      });

      const sessionDates = visibleSessions
        .map((session) => session.session_date)
        .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());

      return {
        group,
        sessions: visibleSessions,
        sessionCount: visibleSessions.length,
        firstSessionDate: sessionDates[0] ?? null,
        latestSessionDate: sessionDates.at(-1) ?? null,
      };
    })
    .filter((group) => {
      if (group.sessionCount > 0) {
        return true;
      }

      return filters.searchTerm.trim().length === 0 && filters.sessionStatus === "all";
    });

  const ungrouped = sessions.filter((session) => {
    if (filters.groupStatus !== "all") {
      return false;
    }

    if (session.group_id) {
      return false;
    }

    if (filters.sessionStatus !== "all" && session.status !== filters.sessionStatus) {
      return false;
    }

    return shouldSessionBeVisibleInSearch({
      groupName: "Sem grupo",
      searchTerm: filters.searchTerm,
      session,
      textContent: getSessionText(session),
    });
  });

  return {
    groups: grouped,
    ungrouped,
  };
};

export const canDeleteSelectedSessions = <TSession extends SearchableSession>(selectedSessions: TSession[]) =>
  selectedSessions.length > 0 && selectedSessions.every((session) => session.status === "rascunho");

export const filterSessionsForOperationalRole = <TSession extends SearchableOwnedSession>({
  currentUserId,
  operationalRole,
  sessions,
}: {
  currentUserId: string | null | undefined;
  operationalRole: "owner" | "admin" | "professional" | "assistant" | "estagiario" | null;
  sessions: TSession[];
}) => {
  if (operationalRole !== "estagiario" || !currentUserId) {
    return sessions;
  }

  return sessions.filter((session) => session.user_id === currentUserId);
};

export const shouldShowSessionCreatorInternBadge = (jobTitle: string | null | undefined) =>
  (jobTitle ?? "").trim().toLowerCase() === "estagiário";

export const shouldAutoCompleteInternDraft = ({
  createdAt,
  currentUserId,
  now = new Date(),
  operationalRole,
  sessionStatus,
  userId,
}: {
  createdAt: string | null | undefined;
  currentUserId: string | null | undefined;
  now?: Date;
  operationalRole: "owner" | "admin" | "professional" | "assistant" | "estagiario" | null;
  sessionStatus: string;
  userId: string;
}) => {
  if (operationalRole !== "estagiario" || !currentUserId || currentUserId !== userId || sessionStatus !== "rascunho" || !createdAt) {
    return false;
  }

  const createdAtMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtMs)) {
    return false;
  }

  return now.getTime() - createdAtMs >= 1000 * 60 * 60 * 24 * 2;
};
