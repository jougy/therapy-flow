import { describe, expect, it } from "vitest";
import {
  buildPatientSessionsView,
  canDeleteSelectedSessions,
  canDeleteSelectedSessionsForRole,
  doesSessionMatchModularFilter,
  extractFilterableModularItems,
  extractModularFieldsByFlag,
  getSessionCareLineIds,
  groupSessionsByModularField,
  filterSessionsForOperationalRole,
  shouldAutoCompleteInternDraft,
  shouldShowSessionCreatorInternBadge,
  shouldSessionBeVisibleInSearch,
  type SearchablePatientGroup,
  type SearchableSession,
} from "@/lib/patient-sessions-view";

const groups: SearchablePatientGroup[] = [
  { id: "group-default", name: "Sintomas não definidos", status: null, created_at: "2026-03-01T10:00:00.000Z" },
  { id: "group-lombar", name: "Lombalgia cronica", status: "em_andamento", created_at: "2026-03-05T10:00:00.000Z" },
  { id: "group-ombro", name: "Ombro", status: "pausado", created_at: "2026-03-06T10:00:00.000Z" },
];

const sessions: SearchableSession[] = [
  {
    id: "session-1",
    group_id: "group-lombar",
    session_date: "2026-03-10T10:00:00.000Z",
    status: "rascunho",
  },
  {
    id: "session-2",
    group_id: "group-lombar",
    session_date: "2026-03-18T10:00:00.000Z",
    status: "concluído",
  },
  {
    id: "session-3",
    group_id: "group-ombro",
    session_date: "2026-03-20T10:00:00.000Z",
    status: "cancelado",
  },
  {
    id: "session-4",
    group_id: null,
    session_date: "2026-03-22T10:00:00.000Z",
    status: "rascunho",
  },
];

const session = sessions[0];

describe("shouldSessionBeVisibleInSearch", () => {
  it("matches group name, session status and custom text", () => {
    expect(
      shouldSessionBeVisibleInSearch({
        groupName: "Lombalgia cronica",
        searchTerm: "lombalgia",
        session,
        textContent: "Dor irradiada para perna",
      })
    ).toBe(true);

    expect(
      shouldSessionBeVisibleInSearch({
        groupName: "Lombalgia cronica",
        searchTerm: "cancelado",
        session: sessions[0],
        textContent: "Dor irradiada para perna",
      })
    ).toBe(false);
  });
});

describe("buildPatientSessionsView", () => {
  it("builds groups with first and latest dates and preserves empty groups when there are no filters", () => {
    const view = buildPatientSessionsView({
      groups,
      sessions,
      filters: {
        searchTerm: "",
        sessionStatus: "all",
        groupStatus: "all",
      },
      getSessionText: (session) => (session.id === "session-1" ? "Dor lombar intensa" : ""),
    });

    expect(view.groups).toHaveLength(3);
    expect(view.groups[1].sessionCount).toBe(2);
    expect(view.groups[1].firstSessionDate).toBe("2026-03-10T10:00:00.000Z");
    expect(view.groups[1].latestSessionDate).toBe("2026-03-18T10:00:00.000Z");
    expect(view.ungrouped).toHaveLength(1);
  });

  it("filters groups and sessions by text, session status and group status", () => {
    const bySearch = buildPatientSessionsView({
      groups,
      sessions,
      filters: {
        searchTerm: "ombro",
        sessionStatus: "all",
        groupStatus: "all",
      },
      getSessionText: () => "",
    });

    expect(bySearch.groups).toHaveLength(1);
    expect(bySearch.groups[0].group.id).toBe("group-ombro");

    const byStatus = buildPatientSessionsView({
      groups,
      sessions,
      filters: {
        searchTerm: "",
        sessionStatus: "rascunho",
        groupStatus: "em_andamento",
      },
      getSessionText: () => "",
    });

    expect(byStatus.groups).toHaveLength(1);
    expect(byStatus.groups[0].group.id).toBe("group-lombar");
    expect(byStatus.groups[0].sessions).toHaveLength(1);
    expect(byStatus.ungrouped).toHaveLength(0);
  });

  it("groups sessions by evolution_group_id and supports custom names", () => {
    const sessionsWithEvolution = [
      {
        id: "evo-1",
        session_date: "2026-03-01T10:00:00.000Z",
        status: "concluído",
        group_id: "group-lombar",
        evolution_group_id: "evo-group-1",
      },
      {
        id: "evo-2",
        session_date: "2026-03-08T10:00:00.000Z",
        status: "concluído",
        group_id: "group-lombar",
        evolution_group_id: "evo-group-1",
        parent_session_id: "evo-1",
      },
      {
        id: "standalone-1",
        session_date: "2026-03-15T10:00:00.000Z",
        status: "rascunho",
        group_id: "group-ombro",
      },
    ];

    const view = buildPatientSessionsView({
      groups,
      sessions: sessionsWithEvolution,
      filters: {
        searchTerm: "",
        sessionStatus: "all",
        groupStatus: "all",
      },
      evolutionGroupsMetadata: [
        { id: "evo-group-1", custom_name: "Ciclo Lombalgia 2026" },
      ],
      getSessionText: () => "",
    });

    expect(view.evolutionGroups).toHaveLength(1);
    expect(view.evolutionGroups[0].id).toBe("evo-group-1");
    expect(view.evolutionGroups[0].customName).toBe("Ciclo Lombalgia 2026");
    expect(view.evolutionGroups[0].sessionCount).toBe(2);
    expect(view.evolutionGroups[0].firstSessionDate).toBe("2026-03-01T10:00:00.000Z");
    expect(view.evolutionGroups[0].latestSessionDate).toBe("2026-03-08T10:00:00.000Z");
    expect(view.standaloneSessions).toHaveLength(1);
    expect(view.standaloneSessions[0].id).toBe("standalone-1");
  });
});

describe("canDeleteSelectedSessions", () => {
  it("only allows batch delete when every selected session is draft", () => {
    expect(canDeleteSelectedSessions([sessions[0], sessions[3]])).toBe(true);
    expect(canDeleteSelectedSessions([sessions[0], sessions[1]])).toBe(false);
    expect(canDeleteSelectedSessions([])).toBe(false);
  });
});

describe("canDeleteSelectedSessionsForRole", () => {
  it("allows owner and admin to delete any selected sessions", () => {
    expect(
      canDeleteSelectedSessionsForRole({
        currentUserId: "owner-user",
        operationalRole: "owner",
        selectedSessions: [sessions[1], sessions[2]],
      })
    ).toBe(true);

    expect(
      canDeleteSelectedSessionsForRole({
        currentUserId: "admin-user",
        operationalRole: "admin",
        selectedSessions: [sessions[0], sessions[1]],
      })
    ).toBe(true);
  });

  it("allows professional to delete any status only when every selected session was created by them", () => {
    expect(
      canDeleteSelectedSessionsForRole({
        currentUserId: "professional-user",
        operationalRole: "professional",
        selectedSessions: [
          { ...sessions[0], user_id: "professional-user" },
          { ...sessions[1], user_id: "professional-user" },
        ],
      })
    ).toBe(true);

    expect(
      canDeleteSelectedSessionsForRole({
        currentUserId: "professional-user",
        operationalRole: "professional",
        selectedSessions: [
          { ...sessions[0], user_id: "professional-user" },
          { ...sessions[1], user_id: "other-user" },
        ],
      })
    ).toBe(false);
  });

  it("does not allow assistant or estagiario to delete sessions from the patient history", () => {
    expect(
      canDeleteSelectedSessionsForRole({
        currentUserId: "assistant-user",
        operationalRole: "assistant",
        selectedSessions: [{ ...sessions[0], user_id: "assistant-user" }],
      })
    ).toBe(false);

    expect(
      canDeleteSelectedSessionsForRole({
        currentUserId: "intern-user",
        operationalRole: "estagiario",
        selectedSessions: [{ ...sessions[0], user_id: "intern-user" }],
      })
    ).toBe(false);
  });
});

describe("filterSessionsForOperationalRole", () => {
  it("limits estagiario to sessions created by the current user", () => {
    expect(
      filterSessionsForOperationalRole({
        currentUserId: "intern-user",
        operationalRole: "estagiario",
        sessions: [
          { ...sessions[0], user_id: "intern-user" },
          { ...sessions[1], user_id: "other-user" },
        ],
      }).map((session) => session.id)
    ).toEqual(["session-1"]);
  });

  it("allows non-admin role to view all sessions when canReadAll is true", () => {
    expect(
      filterSessionsForOperationalRole({
        canReadAll: true,
        currentUserId: "intern-user",
        operationalRole: "estagiario",
        sessions: [
          { ...sessions[0], user_id: "intern-user" },
          { ...sessions[1], user_id: "other-user" },
        ],
      }).map((session) => session.id)
    ).toEqual(["session-1", "session-2"]);
  });

  it("keeps clinic-wide visibility for owner and admin", () => {
    expect(
      filterSessionsForOperationalRole({
        currentUserId: "intern-user",
        operationalRole: "admin",
        sessions: [
          { ...sessions[0], user_id: "intern-user" },
          { ...sessions[1], user_id: "other-user" },
        ],
      }).map((session) => session.id)
    ).toEqual(["session-1", "session-2"]);
  });

  it("limits professional visibility to own and explicitly shared sessions", () => {
    expect(
      filterSessionsForOperationalRole({
        currentUserId: "professional-user",
        operationalRole: "professional",
        sharedSessionIds: new Set(["session-2"]),
        sessions: [
          { ...sessions[0], user_id: "professional-user" },
          { ...sessions[1], user_id: "other-user" },
          { ...sessions[2], user_id: "other-user" },
        ],
      }).map((session) => session.id)
    ).toEqual(["session-1", "session-2"]);
  });

  it("keeps provider visibility when the responsible professional differs from the creator", () => {
    expect(
      filterSessionsForOperationalRole({
        currentUserId: "provider-user",
        operationalRole: "professional",
        sessions: [
          { ...sessions[0], user_id: "other-user", provider_id: "provider-user" },
          { ...sessions[1], user_id: "other-user", provider_id: "other-user" },
        ],
      }).map((session) => session.id)
    ).toEqual(["session-1"]);
  });
});

describe("shouldShowSessionCreatorInternBadge", () => {
  it("shows the extra Estagiario tag only when the creator cargo is Estagiário", () => {
    expect(shouldShowSessionCreatorInternBadge("Estagiário")).toBe(true);
    expect(shouldShowSessionCreatorInternBadge("estagiário")).toBe(true);
    expect(shouldShowSessionCreatorInternBadge("Assistente")).toBe(false);
    expect(shouldShowSessionCreatorInternBadge(null)).toBe(false);
  });
});

describe("shouldAutoCompleteInternDraft", () => {
  it("auto-completes drafts from estagiario after two days", () => {
    expect(
      shouldAutoCompleteInternDraft({
        createdAt: "2026-03-01T10:00:00.000Z",
        currentUserId: "intern-user",
        now: new Date("2026-03-03T10:00:01.000Z"),
        operationalRole: "estagiario",
        sessionStatus: "rascunho",
        userId: "intern-user",
      })
    ).toBe(true);
  });

  it("does not auto-complete sessions from other roles or other users", () => {
    expect(
      shouldAutoCompleteInternDraft({
        createdAt: "2026-03-01T10:00:00.000Z",
        currentUserId: "intern-user",
        now: new Date("2026-03-03T10:00:01.000Z"),
        operationalRole: "professional",
        sessionStatus: "rascunho",
        userId: "intern-user",
      })
    ).toBe(false);

    expect(
      shouldAutoCompleteInternDraft({
        createdAt: "2026-03-01T10:00:00.000Z",
        currentUserId: "intern-user",
        now: new Date("2026-03-03T10:00:01.000Z"),
        operationalRole: "estagiario",
        sessionStatus: "rascunho",
        userId: "other-user",
      })
    ).toBe(false);
  });
});

describe("buildPatientSessionsView - Evolution Lineage Healing", () => {
  it("propagates evolution group across parent_session_id chain even if child or parent has null evolution_group_id", () => {
    const parentSession = {
      ...sessions[0],
      id: "parent-1",
      evolution_group_id: "group-alpha",
      parent_session_id: null,
    };
    const childSession = {
      ...sessions[1],
      id: "child-2",
      evolution_group_id: null, // accidentally cleared on save
      parent_session_id: "parent-1",
    };
    const grandChildSession = {
      ...sessions[0],
      id: "child-3",
      evolution_group_id: null,
      parent_session_id: "child-2",
    };

    const result = buildPatientSessionsView({
      filters: { groupStatus: "all", searchTerm: "", selectedTagId: "all", sessionStatus: "all" },
      getSessionText: () => "",
      groups,
      sessions: [parentSession, childSession, grandChildSession],
      evolutionGroupsMetadata: [{ id: "group-alpha", custom_name: "Ciclo Coluna" }],
    });

    expect(result.evolutionGroups).toHaveLength(1);
    expect(result.evolutionGroups[0].id).toBe("group-alpha");
    expect(result.evolutionGroups[0].sessions).toHaveLength(3);
    expect(result.standaloneSessions).toHaveLength(0);
  });
});

describe("Modular Filter & Grouping Helpers", () => {
  it("matches session by modular form response field value", () => {
    const sessionWithModular = {
      ...sessions[0],
      anamnesis_form_response: {
        sintomas_list: ["Dor Cervical", "Rigidez"],
      },
    };

    expect(doesSessionMatchModularFilter(sessionWithModular, "sintomas_list", "Dor Cervical")).toBe(true);
    expect(doesSessionMatchModularFilter(sessionWithModular, "sintomas_list", "Lombalgia")).toBe(false);
  });

  it("prevents false-positive cross-field matching for non-symptom fields", () => {
    const sessionWithCareLine = {
      ...sessions[0],
      group_id: "group-lombar", // Care line name: "Lombalgia cronica"
      anamnesis: {
        queixa: "Lombalgia intensa",
        sintomas: "Dor e queimação",
      },
      anamnesis_form_response: {
        profissao: "Arquiteto",
      },
    };

    // If filtering by "profissao", it should NOT match "Lombalgia" even if care line or queixa mentions it
    expect(doesSessionMatchModularFilter(sessionWithCareLine, "profissao", "Lombalgia", groups)).toBe(false);
    expect(doesSessionMatchModularFilter(sessionWithCareLine, "profissao", "Arquiteto", groups)).toBe(true);

    // If filtering by a symptom field, it CAN match symptoms or care lines
    expect(doesSessionMatchModularFilter(sessionWithCareLine, "sintomas", "Lombalgia cronica", groups)).toBe(true);
  });

  it("extracts filterable modular items across sessions in a single pass without duplicates", () => {
    const s1 = {
      ...sessions[0],
      id: "s1",
      anamnesis_form_response: { sintomas_list: ["Cervicalgia", "Espasmo"] },
    };
    const s2 = {
      ...sessions[1],
      id: "s2",
      anamnesis_form_response: { sintomas_list: ["cervicalgia", "Edema"] },
    };

    const filterableFields = [{ id: "sintomas_list", label: "Sintomas Atuais" }];
    const items = extractFilterableModularItems([s1, s2], filterableFields);

    expect(items).toHaveLength(3);
    expect(items.map((i) => i.value)).toEqual(["Cervicalgia", "Espasmo", "Edema"]);
  });

  it("groups sessions by modular field correctly separating ungrouped sessions", () => {
    const s1 = {
      ...sessions[0],
      id: "s1",
      anamnesis_form_response: { sintomas_list: ["Dor no Ombro"] },
    };
    const s2 = {
      ...sessions[1],
      id: "s2",
      anamnesis_form_response: { sintomas_list: ["Dor no Ombro", "Cefaleia"] },
    };
    const s3 = {
      ...sessions[2],
      id: "s3",
      anamnesis_form_response: {},
    };

    const targetField = { id: "sintomas_list", label: "Sintomas" };
    const result = groupSessionsByModularField([s1, s2, s3], targetField);

    expect(result.groups).toHaveLength(2);
    const ombroGroup = result.groups.find((g) => g.name === "Dor no Ombro");
    expect(ombroGroup?.sessions).toHaveLength(2);
    expect(result.ungrouped).toHaveLength(1);
    expect(result.ungrouped[0].id).toBe("s3");
  });

  it("extracts modular fields by boolean flag like includeInGlobalDashboard, enableFilter, enableGrouping", () => {
    const schemaA = [
      { id: "f1", label: "Dor Principal", type: "text" as const, includeInGlobalDashboard: true },
      { id: "f2", label: "Histórico Familiar", type: "text" as const, enableFilter: true },
    ];
    const schemaB = [
      { id: "f1", label: "Dor Principal", type: "text" as const, includeInGlobalDashboard: true },
      { id: "f3", label: "Queixas Secundárias", type: "simple_list" as const, includeInGlobalDashboard: true, enableGrouping: true },
    ];

    const dashboardFields = extractModularFieldsByFlag([schemaA, schemaB, null], "includeInGlobalDashboard");
    expect(dashboardFields).toEqual([
      { id: "f1", label: "Dor Principal" },
      { id: "f3", label: "Queixas Secundárias" },
    ]);

    const groupingFields = extractModularFieldsByFlag([schemaA, schemaB], "enableGrouping");
    expect(groupingFields).toEqual([
      { id: "f3", label: "Queixas Secundárias" },
    ]);
  });
});

describe("getSessionCareLineIds backwards and forwards compatibility", () => {
  it("returns empty array when anamnesis.care_line_ids is explicitly empty even if group_id is present", () => {
    const session: SearchableSession = {
      ...sessions[0],
      group_id: "residual-group",
      anamnesis: {
        care_line_ids: [],
      },
    };

    expect(getSessionCareLineIds(session)).toEqual([]);
  });

  it("returns all care line ids when anamnesis.care_line_ids has multiple ids", () => {
    const session: SearchableSession = {
      ...sessions[0],
      group_id: "group-1",
      anamnesis: {
        care_line_ids: ["group-1", "group-2", "group-3"],
      },
    };

    expect(getSessionCareLineIds(session)).toEqual(["group-1", "group-2", "group-3"]);
  });

  it("falls back to session.group_id for legacy sessions where care_line_ids is undefined", () => {
    const session: SearchableSession = {
      ...sessions[0],
      group_id: "legacy-group-1",
      anamnesis: {
        queixa: "Dor no pescoço",
      },
    };

    expect(getSessionCareLineIds(session)).toEqual(["legacy-group-1"]);
  });

  it("returns empty array for legacy sessions where care_line_ids is undefined and group_id is null", () => {
    const session: SearchableSession = {
      ...sessions[0],
      group_id: null,
      anamnesis: null,
    };

    expect(getSessionCareLineIds(session)).toEqual([]);
  });
});

