import { describe, expect, it } from "vitest";
import {
  buildPatientSessionsView,
  canDeleteSelectedSessions,
  shouldSessionBeVisibleInSearch,
  type SearchablePatientGroup,
  type SearchableSession,
} from "@/lib/patient-sessions-view";

const groups: SearchablePatientGroup[] = [
  { id: "group-default", name: "Grupo sem definicao", status: null, created_at: "2026-03-01T10:00:00.000Z" },
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
});

describe("canDeleteSelectedSessions", () => {
  it("only allows batch delete when every selected session is draft", () => {
    expect(canDeleteSelectedSessions([sessions[0], sessions[3]])).toBe(true);
    expect(canDeleteSelectedSessions([sessions[0], sessions[1]])).toBe(false);
    expect(canDeleteSelectedSessions([])).toBe(false);
  });
});

const session = sessions[0];
