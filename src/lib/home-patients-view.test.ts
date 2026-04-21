import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOME_PATIENT_SORT_KEY,
  buildHomePatientViews,
  getActiveHomePatientFilterCount,
  hasActiveHomePatientFilters,
  type HomePatientFilters,
} from "@/lib/home-patients-view";

const patients = [
  {
    cpf: "12345678901",
    date_of_birth: "1990-01-10",
    gender: null,
    id: "patient-1",
    name: "Alice Araujo",
    phone: "11999990001",
    pronoun: null,
    status: "ativo",
    updated_at: "2026-04-14T10:00:00.000Z",
  },
  {
    cpf: "98765432100",
    date_of_birth: "2000-02-02",
    gender: null,
    id: "patient-2",
    name: "Bruno Braga",
    phone: "11999990002",
    pronoun: null,
    status: "pausado",
    updated_at: "2026-04-15T10:00:00.000Z",
  },
  {
    cpf: null,
    date_of_birth: null,
    gender: null,
    id: "patient-3",
    name: "Carla Campos",
    phone: null,
    pronoun: null,
    status: "alta",
    updated_at: "2026-04-13T10:00:00.000Z",
  },
];

const patientGroups = [
  { color: "lavender", name: "Coluna", patient_id: "patient-1", status: "em_andamento" },
  { color: "rose", name: "Pilates", patient_id: "patient-2", status: "concluido" },
];

const sessions = [
  { id: "session-1", patient_id: "patient-1", session_date: "2026-04-13T15:00:00.000Z", status: "concluído" },
  { id: "session-2", patient_id: "patient-1", session_date: "2026-04-10T15:00:00.000Z", status: "cancelado" },
  { id: "session-3", patient_id: "patient-2", session_date: "2026-04-14T15:00:00.000Z", status: "rascunho" },
];

const defaultFilters: HomePatientFilters = {
  searchTerm: "",
  sessionDateFrom: "",
  sessionDateTo: "",
  statuses: [],
  weekdays: [],
};

describe("home patients view", () => {
  it("derives card data and keeps the default updated_at sorting", () => {
    const result = buildHomePatientViews({
      filters: defaultFilters,
      patientGroups,
      patients,
      sessions,
      sortKey: DEFAULT_HOME_PATIENT_SORT_KEY,
    });

    expect(result.map((patient) => patient.name)).toEqual(["Bruno Braga", "Alice Araujo", "Carla Campos"]);
    expect(result[1]).toMatchObject({
      groups: [{ color: "lavender", name: "Coluna", status: "em_andamento" }],
      lastSessionDate: "2026-04-13T15:00:00.000Z",
      missedCount: 1,
      sessionCount: 2,
    });
  });

  it("applies search, status, date range and weekday filters with shared AND semantics", () => {
    const result = buildHomePatientViews({
      filters: {
        searchTerm: "alice",
        sessionDateFrom: "2026-04-12",
        sessionDateTo: "2026-04-13",
        statuses: ["ativo", "pausado"],
        weekdays: [1],
      },
      patientGroups,
      patients,
      sessions,
      sortKey: DEFAULT_HOME_PATIENT_SORT_KEY,
    });

    expect(result.map((patient) => patient.name)).toEqual(["Alice Araujo"]);
  });

  it("supports all requested sort orders with stable tie-breakers", () => {
    expect(
      buildHomePatientViews({
        filters: defaultFilters,
        patientGroups,
        patients,
        sessions,
        sortKey: "name_asc",
      }).map((patient) => patient.name),
    ).toEqual(["Alice Araujo", "Bruno Braga", "Carla Campos"]);

    expect(
      buildHomePatientViews({
        filters: defaultFilters,
        patientGroups,
        patients,
        sessions,
        sortKey: "birth_date_asc",
      }).map((patient) => patient.name),
    ).toEqual(["Alice Araujo", "Bruno Braga", "Carla Campos"]);

    expect(
      buildHomePatientViews({
        filters: defaultFilters,
        patientGroups,
        patients,
        sessions,
        sortKey: "last_session_desc",
      }).map((patient) => patient.name),
    ).toEqual(["Bruno Braga", "Alice Araujo", "Carla Campos"]);

    expect(
      buildHomePatientViews({
        filters: defaultFilters,
        patientGroups,
        patients,
        sessions,
        sortKey: "last_session_asc",
      }).map((patient) => patient.name),
    ).toEqual(["Alice Araujo", "Bruno Braga", "Carla Campos"]);

    expect(
      buildHomePatientViews({
        filters: defaultFilters,
        patientGroups,
        patients,
        sessions,
        sortKey: "session_count_desc",
      }).map((patient) => patient.name),
    ).toEqual(["Alice Araujo", "Bruno Braga", "Carla Campos"]);

    expect(
      buildHomePatientViews({
        filters: defaultFilters,
        patientGroups,
        patients,
        sessions,
        sortKey: "missed_count_desc",
      }).map((patient) => patient.name),
    ).toEqual(["Alice Araujo", "Bruno Braga", "Carla Campos"]);

    expect(
      buildHomePatientViews({
        filters: defaultFilters,
        patientGroups,
        patients,
        sessions,
        sortKey: "status_priority",
      }).map((patient) => patient.name),
    ).toEqual(["Alice Araujo", "Bruno Braga", "Carla Campos"]);
  });

  it("counts active filter criteria for the UI summary", () => {
    const filters: HomePatientFilters = {
      searchTerm: "",
      sessionDateFrom: "2026-04-12",
      sessionDateTo: "",
      statuses: ["ativo", "pausado"],
      weekdays: [1],
    };

    expect(hasActiveHomePatientFilters(filters)).toBe(true);
    expect(getActiveHomePatientFilterCount(filters)).toBe(4);
  });
});
