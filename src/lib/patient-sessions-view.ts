export type SearchablePatientGroup = {
  color?: string | null;
  created_at: string;
  id: string;
  name: string;
  status: string | null;
};

export type SearchableSession = {
  anamnesis?: unknown;
  group_id: string | null;
  id: string;
  session_date: string;
  status: string;
};

type SearchableOwnedSession = SearchableSession & {
  provider_id?: string | null;
  user_id: string;
};

export type SessionSearchFilters = {
  groupStatus: string;
  searchTerm: string;
  sessionStatus: string;
  selectedTagId?: string | null;
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

export const getSessionCareLineIds = (session: SearchableSession): string[] => {
  const anamnesis = session.anamnesis && typeof session.anamnesis === "object" ? (session.anamnesis as Record<string, unknown>) : null;
  if (anamnesis && Array.isArray(anamnesis.care_line_ids)) {
    const list = anamnesis.care_line_ids as string[];
    if (list.length > 0) return list;
  }
  return session.group_id ? [session.group_id] : [];
};

export const doesSessionHaveCareLine = (session: SearchableSession, careLineId: string): boolean => {
  const ids = getSessionCareLineIds(session);
  return ids.includes(careLineId);
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
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const tagCountsMap = new Map<string, number>();
  let ungroupedCount = 0;

  sessions.forEach((session) => {
    const careLineIds = getSessionCareLineIds(session);
    if (careLineIds.length === 0) {
      ungroupedCount += 1;
    } else {
      careLineIds.forEach((id) => {
        tagCountsMap.set(id, (tagCountsMap.get(id) || 0) + 1);
      });
    }
  });

  const tagStats = groups.map((group) => ({
    group,
    count: tagCountsMap.get(group.id) || 0,
  }));

  const groupStatusFilter = filters.groupStatus ?? "all";

  const filteredChronological = sessions
    .filter((session) => {
      if (filters.sessionStatus !== "all" && session.status !== filters.sessionStatus) {
        return false;
      }

      const careLineIds = getSessionCareLineIds(session);
      if (filters.selectedTagId && filters.selectedTagId !== "all") {
        if (filters.selectedTagId === "none") {
          if (careLineIds.length > 0) return false;
        } else {
          if (!careLineIds.includes(filters.selectedTagId)) return false;
        }
      }

      if (groupStatusFilter !== "all") {
        const matchingGroups = careLineIds.map((id) => groupMap.get(id)).filter(Boolean) as TGroup[];
        if (matchingGroups.length === 0 || !matchingGroups.some((g) => g.status === groupStatusFilter)) {
          return false;
        }
      }

      const groupNames = careLineIds.map((id) => groupMap.get(id)?.name).filter(Boolean).join(" ");
      return shouldSessionBeVisibleInSearch({
        groupName: groupNames || "Sem grupo",
        searchTerm: filters.searchTerm,
        session,
        textContent: getSessionText(session),
      });
    })
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

  const grouped = groups
    .filter((group) => groupStatusFilter === "all" || group.status === groupStatusFilter)
    .map<PatientSessionGroupView<TGroup, TSession>>((group) => {
      const visibleSessions = sessions.filter((session) => {
        if (!doesSessionHaveCareLine(session, group.id)) {
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
    if (groupStatusFilter !== "all") {
      return false;
    }

    const careLineIds = getSessionCareLineIds(session);
    if (careLineIds.length > 0) {
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
    chronologicalSessions: filteredChronological,
    tagStats,
    ungroupedCount,
    totalCount: sessions.length,
  };
};

export const canDeleteSelectedSessions = <TSession extends SearchableSession>(selectedSessions: TSession[]) =>
  selectedSessions.length > 0 && selectedSessions.every((session) => session.status === "rascunho");

export const canDeleteSelectedSessionsForRole = <TSession extends SearchableOwnedSession>({
  currentUserId,
  operationalRole,
  selectedSessions,
}: {
  currentUserId: string | null | undefined;
  operationalRole: "owner" | "admin" | "professional" | "assistant" | "estagiario" | null;
  selectedSessions: TSession[];
}) => {
  if (operationalRole === "owner" || operationalRole === "admin") {
    return selectedSessions.length > 0;
  }

  if (operationalRole === "professional" && currentUserId) {
    return selectedSessions.length > 0 && selectedSessions.every((session) => session.user_id === currentUserId);
  }

  return false;
};

export const filterSessionsForOperationalRole = <TSession extends SearchableOwnedSession>({
  canReadAll,
  currentUserId,
  operationalRole,
  sharedSessionIds = new Set<string>(),
  sessions,
}: {
  canReadAll?: boolean;
  currentUserId: string | null | undefined;
  operationalRole: "owner" | "admin" | "professional" | "assistant" | "estagiario" | null;
  sharedSessionIds?: Set<string>;
  sessions: TSession[];
}) => {
  if (canReadAll || operationalRole === "owner" || operationalRole === "admin" || !currentUserId) {
    return sessions;
  }

  return sessions.filter(
    (session) => session.user_id === currentUserId || session.provider_id === currentUserId || sharedSessionIds.has(session.id)
  );
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
