import type { AnamnesisTemplateSchema } from "./anamnesis-forms";

export type SearchablePatientGroup = {
  color?: string | null;
  created_at: string;
  id: string;
  name: string;
  status: string | null;
};

export type SearchableSession = {
  anamnesis?: unknown;
  anamnesis_form_response?: unknown;
  group_id: string | null;
  id: string;
  session_date: string;
  status: string;
  evolution_group_id?: string | null;
  parent_session_id?: string | null;
  payment_plan_id?: string | null;
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

export type EvolutionGroupMetadata = {
  id: string;
  custom_name: string | null;
};

type BuildPatientSessionsViewArgs<TGroup extends SearchablePatientGroup, TSession extends SearchableSession> = {
  filters: SessionSearchFilters;
  getSessionText: (session: TSession) => string;
  groups: TGroup[];
  sessions: TSession[];
  evolutionGroupsMetadata?: EvolutionGroupMetadata[];
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

export type PatientEvolutionGroupView<TGroup extends SearchablePatientGroup, TSession extends SearchableSession> = {
  id: string;
  customName: string | null;
  tagGroups: TGroup[];
  sessions: TSession[];
  sessionCount: number;
  firstSessionDate: string | null;
  latestSessionDate: string | null;
  paymentPlanIds: string[];
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

/**
 * Safely extracts unique, normalized string values from a session's anamnesis form response
 * or legacy anamnesis structure (e.g. sintomas, queixa).
 */
export const extractSessionFieldValues = (
  session: SearchableSession,
  fieldId: string,
  fieldLabel?: string
): string[] => {
  const result: string[] = [];

  const sessionRecord = session as unknown as Record<string, unknown>;
  const formResponse =
    sessionRecord.anamnesis_form_response &&
    typeof sessionRecord.anamnesis_form_response === "object" &&
    !Array.isArray(sessionRecord.anamnesis_form_response)
      ? (sessionRecord.anamnesis_form_response as Record<string, unknown>)
      : null;

  if (formResponse && fieldId in formResponse) {
    const raw = formResponse[fieldId];
    if (Array.isArray(raw)) {
      raw.forEach((item) => {
        if (typeof item === "string" && item.trim()) {
          result.push(item.trim());
        } else if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const strCandidate =
            (typeof obj.label === "string" ? obj.label : null) ??
            (typeof obj.name === "string" ? obj.name : null) ??
            (typeof obj.id === "string" ? obj.id : null);
          if (strCandidate && strCandidate.trim()) {
            result.push(strCandidate.trim());
          }
        }
      });
    } else if (typeof raw === "string" && raw.trim()) {
      raw
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => result.push(s));
    }
  }

  // Fallback for fields referencing symptoms or complaints in legacy anamnesis
  const lowerFieldId = fieldId.toLowerCase();
  const lowerLabel = (fieldLabel ?? "").toLowerCase();
  const isSymptomField = lowerFieldId === "sintomas" || lowerLabel.includes("sintoma");
  const isComplaintField = lowerFieldId === "queixa" || lowerLabel.includes("queixa");

  if (result.length === 0 && (isSymptomField || isComplaintField)) {
    const anamnesis =
      session.anamnesis && typeof session.anamnesis === "object" && !Array.isArray(session.anamnesis)
        ? (session.anamnesis as Record<string, unknown>)
        : null;

    if (anamnesis) {
      if (isSymptomField && anamnesis.sintomas) {
        const rawSintomas = anamnesis.sintomas;
        if (typeof rawSintomas === "string" && rawSintomas.trim()) {
          rawSintomas
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((s) => result.push(s));
        } else if (Array.isArray(rawSintomas)) {
          rawSintomas.forEach((item) => {
            if (typeof item === "string" && item.trim()) {
              result.push(item.trim());
            }
          });
        }
      }

      if (isComplaintField && typeof anamnesis.queixa === "string" && anamnesis.queixa.trim()) {
        result.push(anamnesis.queixa.trim());
      }
    }
  }

  return Array.from(new Set(result));
};

export const doesSessionMatchModularFilter = <TGroup extends SearchablePatientGroup>(
  session: SearchableSession,
  fieldId: string,
  filterValue: string,
  groups?: TGroup[]
): boolean => {
  const normTarget = normalizeTerm(filterValue);
  if (!normTarget) return true;

  const values = extractSessionFieldValues(session, fieldId);
  if (values.some((val) => normalizeTerm(val) === normTarget || normalizeTerm(val).includes(normTarget))) {
    return true;
  }

  const lowerFieldId = fieldId.toLowerCase();
  const isSymptomOrCareLineField =
    lowerFieldId === "sintomas" || lowerFieldId.includes("sintoma") || lowerFieldId === "care_line";

  // Check care lines / groups associated with this session (only for symptom or care line fields)
  if (isSymptomOrCareLineField && groups && groups.length > 0) {
    const careLineIds = getSessionCareLineIds(session);
    if (careLineIds.length > 0) {
      const careLineIdSet = new Set(careLineIds);
      if (groups.some((g) => careLineIdSet.has(g.id) && normalizeTerm(g.name) === normTarget)) {
        return true;
      }
    }
  }

  return false;
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
  evolutionGroupsMetadata,
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
        } else if (filters.selectedTagId.startsWith("modular:")) {
          const parts = filters.selectedTagId.split(":");
          const fieldId = parts[1];
          const filterValue = parts.slice(2).join(":");
          if (!doesSessionMatchModularFilter(session, fieldId, filterValue, groups)) {
            return false;
          }
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

  // Evolution Groups Grouping with Lineage Healing
  const evoMetaMap = new Map((evolutionGroupsMetadata ?? []).map((m) => [m.id, m]));
  const evoGroupSessionsMap = new Map<string, TSession[]>();
  const standaloneSessions: TSession[] = [];

  // Bidirectional Lineage Propagation:
  // Propagates evolution_group_id across parent_session_id connections in both directions
  const resolvedEvolutionGroupMap = new Map<string, string>();
  sessions.forEach((s) => {
    if (s.evolution_group_id) {
      resolvedEvolutionGroupMap.set(s.id, s.evolution_group_id);
    }
  });

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 10) {
    changed = false;
    iterations++;
    sessions.forEach((s) => {
      // 1. If child has no group but parent has a group, inherit parent's group
      if (!resolvedEvolutionGroupMap.has(s.id) && s.parent_session_id) {
        const parentGroupId = resolvedEvolutionGroupMap.get(s.parent_session_id);
        if (parentGroupId) {
          resolvedEvolutionGroupMap.set(s.id, parentGroupId);
          changed = true;
        }
      }
      // 2. If parent has no group but child has a group, propagate child's group to parent
      if (s.parent_session_id && resolvedEvolutionGroupMap.has(s.id)) {
        const childGroupId = resolvedEvolutionGroupMap.get(s.id);
        if (childGroupId && !resolvedEvolutionGroupMap.has(s.parent_session_id)) {
          resolvedEvolutionGroupMap.set(s.parent_session_id, childGroupId);
          changed = true;
        }
      }
    });
  }

  filteredChronological.forEach((session) => {
    const evoGroupId = resolvedEvolutionGroupMap.get(session.id) || session.evolution_group_id;
    if (evoGroupId) {
      const existing = evoGroupSessionsMap.get(evoGroupId) || [];
      existing.push(session);
      evoGroupSessionsMap.set(evoGroupId, existing);
    } else {
      standaloneSessions.push(session);
    }
  });

  const evolutionGroups: PatientEvolutionGroupView<TGroup, TSession>[] = Array.from(
    evoGroupSessionsMap.entries()
  ).map(([groupId, groupSessions]) => {
    const meta = evoMetaMap.get(groupId);
    const sessionDates = groupSessions
      .map((s) => s.session_date)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const uniqueCareLineIdSet = new Set<string>();
    groupSessions.forEach((s) => {
      getSessionCareLineIds(s).forEach((id) => uniqueCareLineIdSet.add(id));
    });

    const tagGroups = Array.from(uniqueCareLineIdSet)
      .map((id) => groupMap.get(id))
      .filter(Boolean) as TGroup[];

    const paymentPlanIds = Array.from(
      new Set(groupSessions.map((s) => s.payment_plan_id).filter(Boolean) as string[])
    );

    return {
      id: groupId,
      customName: meta?.custom_name ?? null,
      tagGroups,
      sessions: groupSessions,
      sessionCount: groupSessions.length,
      firstSessionDate: sessionDates[0] ?? null,
      latestSessionDate: sessionDates.at(-1) ?? null,
      paymentPlanIds,
    };
  }).sort((a, b) => {
    const timeA = a.latestSessionDate ? new Date(a.latestSessionDate).getTime() : 0;
    const timeB = b.latestSessionDate ? new Date(b.latestSessionDate).getTime() : 0;
    return timeB - timeA;
  });

  return {
    groups: grouped,
    ungrouped,
    chronologicalSessions: filteredChronological,
    evolutionGroups,
    standaloneSessions,
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

export interface ModularFieldDefinition {
  id: string;
  label: string;
}

export interface ModularGroupedSession<TSession extends SearchableSession = SearchableSession> {
  name: string;
  sessions: TSession[];
  count: number;
}

export interface ModularGroupedSessionsResult<TSession extends SearchableSession = SearchableSession> {
  groups: ModularGroupedSession<TSession>[];
  ungrouped: TSession[];
  fieldLabel: string;
}

export interface ModularFilterItem {
  filterKey: string;
  fieldLabel: string;
  value: string;
}

/**
 * Extracts unique fields matching a boolean flag across provided schemas
 */
export const extractModularFieldsByFlag = (
  schemas: Array<AnamnesisTemplateSchema | undefined | null>,
  flag: "enableFilter" | "enableGrouping" | "includeInGlobalDashboard"
): ModularFieldDefinition[] => {
  const fieldsMap = new Map<string, ModularFieldDefinition>();

  schemas.forEach((schema) => {
    if (!Array.isArray(schema)) return;
    schema.forEach((field) => {
      if (field && field[flag] && field.id && field.label) {
        fieldsMap.set(field.id, { id: field.id, label: field.label });
      }
    });
  });

  return Array.from(fieldsMap.values());
};

/**
 * Groups sessions by unique values extracted from a specified modular field.
 */
export const groupSessionsByModularField = <TSession extends SearchableSession>(
  sessions: TSession[],
  targetField: ModularFieldDefinition
): ModularGroupedSessionsResult<TSession> => {
  const groupsMap = new Map<string, TSession[]>();
  const ungroupedList: TSession[] = [];

  sessions.forEach((session) => {
    const values = extractSessionFieldValues(session, targetField.id, targetField.label);

    if (values.length === 0) {
      ungroupedList.push(session);
    } else {
      values.forEach((val) => {
        const list = groupsMap.get(val) ?? [];
        list.push(session);
        groupsMap.set(val, list);
      });
    }
  });

  return {
    groups: Array.from(groupsMap.entries()).map(([name, sessionList]) => ({
      name,
      sessions: sessionList,
      count: sessionList.length,
    })),
    ungrouped: ungroupedList,
    fieldLabel: targetField.label,
  };
};

/**
 * Extracts unique filterable options from modular fields present across sessions.
 */
export const extractFilterableModularItems = <TSession extends SearchableSession>(
  sessions: TSession[],
  filterableFields: ModularFieldDefinition[]
): ModularFilterItem[] => {
  if (filterableFields.length === 0 || sessions.length === 0) return [];

  const items: ModularFilterItem[] = [];
  const seen = new Set<string>();

  for (const session of sessions) {
    for (const field of filterableFields) {
      const vals = extractSessionFieldValues(session, field.id, field.label);
      for (const v of vals) {
        const uniqueKey = `${field.id}:${v.toLowerCase()}`;
        if (!seen.has(uniqueKey)) {
          seen.add(uniqueKey);
          items.push({
            filterKey: `modular:${field.id}:${v}`,
            fieldLabel: field.label,
            value: v,
          });
        }
      }
    }
  }

  return items;
};

