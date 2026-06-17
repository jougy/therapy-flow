import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    is_recurring: true,
    name: "Alice Araujo",
    origin_type: "indicacao",
    phone: "11999990001",
    pronoun: null,
    recurring_time: "09:00",
    recurring_weekdays: [1, 3],
    status: "ativo",
    updated_at: "2026-04-14T10:00:00.000Z",
  },
  {
    cpf: "98765432100",
    date_of_birth: "2000-02-02",
    gender: null,
    id: "patient-2",
    is_recurring: false,
    name: "Bruno Braga",
    origin_type: "convenio",
    phone: "11999990002",
    pronoun: null,
    recurring_time: "09:00",
    recurring_weekdays: [],
    status: "pausado",
    updated_at: "2026-04-15T10:00:00.000Z",
  },
  {
    cpf: null,
    date_of_birth: null,
    gender: null,
    id: "patient-3",
    is_recurring: false,
    name: "Carla Campos",
    origin_type: null,
    phone: null,
    pronoun: null,
    recurring_time: "09:00",
    recurring_weekdays: [],
    status: "alta",
    updated_at: "2026-04-13T10:00:00.000Z",
  },
];

const patientGroups = [
  { color: "lavender", name: "Coluna", patient_id: "patient-1", status: "em_andamento" },
  { color: "rose", name: "Pilates", patient_id: "patient-2", status: "concluido" },
];

const sessions = [
  {
    amount_charged_cents: 12000,
    amount_paid_cents: 6000,
    id: "session-1",
    patient_id: "patient-1",
    payment_status: "parcial",
    provider_id: "collab-1",
    session_date: "2026-04-13T15:00:00.000Z",
    status: "concluído",
    user_id: "collab-1",
  },
  {
    amount_charged_cents: 0,
    amount_paid_cents: 0,
    id: "session-2",
    patient_id: "patient-1",
    payment_status: "nao_cobrado",
    provider_id: "collab-1",
    session_date: "2026-04-10T15:00:00.000Z",
    status: "cancelado",
    user_id: "collab-2",
  },
  {
    amount_charged_cents: 10000,
    amount_paid_cents: 12500,
    id: "session-3",
    patient_id: "patient-2",
    payment_status: "credito",
    provider_id: "collab-2",
    session_date: "2026-04-14T15:00:00.000Z",
    status: "rascunho",
    user_id: "collab-2",
  },
];

const agendaEvents = [
  {
    event_type: "atendimento",
    id: "agenda-1",
    patient_id: "patient-1",
    scheduled_for: "2099-04-15T14:30:00.000Z",
    status: "confirmado",
    title: "Alice Araujo",
  },
  {
    event_type: "atendimento",
    id: "agenda-2",
    patient_id: "patient-1",
    scheduled_for: "2099-04-20T14:30:00.000Z",
    status: "aguardando_confirmacao",
    title: "Alice Araujo",
  },
  {
    event_type: "atendimento",
    id: "agenda-3",
    patient_id: "patient-2",
    scheduled_for: "2099-04-10T14:30:00.000Z",
    status: "cancelado",
    title: "Bruno Braga",
  },
];

const defaultFilters: HomePatientFilters = {
  agendaStatuses: [],
  collaboratorIds: [],
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
};

describe("home patients view", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-04-14T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
      paymentSummary: {
        amountLabel: "R$ 60,00",
        label: "Devendo",
        tone: "debt",
      },
      sessionCount: 2,
    });

    expect(result[0].paymentSummary).toMatchObject({
      amountLabel: "R$ 25,00",
      label: "Crédito",
      tone: "credit",
    });
  });

  it("uses the net patient balance before showing debt or credit on patient cards", () => {
    const result = buildHomePatientViews({
      filters: defaultFilters,
      patientGroups,
      patients,
      sessions: [
        {
          amount_charged_cents: 10000,
          amount_paid_cents: 15000,
          id: "credit-session",
          patient_id: "patient-1",
          payment_status: "credito",
          session_date: "2026-04-13T15:00:00.000Z",
          status: "concluído",
        },
        {
          amount_charged_cents: 2000,
          amount_paid_cents: 0,
          id: "open-session",
          patient_id: "patient-1",
          payment_status: "pendente",
          session_date: "2026-04-14T15:00:00.000Z",
          status: "concluído",
        },
      ],
      sortKey: "name_asc",
    });

    expect(result[0].paymentSummary).toMatchObject({
      amountLabel: "R$ 30,00",
      label: "Crédito",
      tone: "credit",
    });
  });

  it("applies search, status, date range and weekday filters with shared AND semantics", () => {
    const result = buildHomePatientViews({
      filters: {
        agendaStatuses: [],
        searchTerm: "alice",
        collaboratorIds: [],
        colors: [],
        groupNames: [],
        originTypes: [],
        paymentStatuses: [],
        recurrenceStatuses: [],
        recurringWeekdays: [],
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

  it("adds the next non-canceled agenda event to patient cards", () => {
    const result = buildHomePatientViews({
      agendaEvents,
      filters: defaultFilters,
      patientGroups,
      patients,
      sessions,
      sortKey: "name_asc",
    });

    expect(result[0].nextAgendaSummary).toMatchObject({
      statusLabel: "Confirmado",
      tone: "next",
      title: "Alice Araujo",
    });
    expect(result[0].nextAgendaSummary?.description).toContain("mais 1 agendamento");
    expect(result[1].nextAgendaSummary).toBeNull();
  });

  it("colors agenda summaries by confirmation, next appointment and delay state", () => {
    const result = buildHomePatientViews({
      agendaEvents: [
        {
          event_type: "atendimento",
          id: "late-event",
          patient_id: "patient-1",
          scheduled_for: "2099-04-14T11:50:00.000Z",
          status: "confirmado",
          title: "Alice atrasada",
        },
        {
          event_type: "atendimento",
          id: "next-event",
          patient_id: "patient-2",
          scheduled_for: "2099-04-14T12:10:00.000Z",
          status: "aguardando_confirmacao",
          title: "Bruno próximo",
        },
        {
          event_type: "atendimento",
          id: "confirmed-event",
          patient_id: "patient-3",
          scheduled_for: "2099-04-14T13:00:00.000Z",
          status: "confirmado",
          title: "Carla confirmada",
        },
      ],
      filters: defaultFilters,
      patientGroups,
      patients,
      sessions,
      sortKey: "name_asc",
    });

    expect(result.find((patient) => patient.id === "patient-1")?.nextAgendaSummary?.tone).toBe("late");
    expect(result.find((patient) => patient.id === "patient-2")?.nextAgendaSummary?.tone).toBe("next");
    expect(result.find((patient) => patient.id === "patient-3")?.nextAgendaSummary?.tone).toBe("confirmed");
  });

  it("filters by group, color and collaborator with OR inside each block", () => {
    const result = buildHomePatientViews({
      filters: {
        agendaStatuses: [],
        collaboratorIds: ["collab-1"],
        colors: ["lavender"],
        groupNames: ["Coluna"],
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
    });

    expect(result.map((patient) => patient.name)).toEqual(["Alice Araujo"]);
  });

  it("filters by payment status", () => {
    expect(
      buildHomePatientViews({
        filters: { ...defaultFilters, paymentStatuses: ["credit"] },
        patientGroups,
        patients,
        sessions,
        sortKey: "name_asc",
      }).map((patient) => patient.name),
    ).toEqual(["Bruno Braga"]);

    expect(
      buildHomePatientViews({
        filters: { ...defaultFilters, paymentStatuses: ["debt"] },
        patientGroups,
        patients,
        sessions,
        sortKey: "name_asc",
      }).map((patient) => patient.name),
    ).toEqual(["Alice Araujo"]);
  });

  it("filters by agenda status", () => {
    expect(
      buildHomePatientViews({
        agendaEvents,
        filters: { ...defaultFilters, agendaStatuses: ["unconfirmed"] },
        patientGroups,
        patients,
        sessions,
        sortKey: "name_asc",
      }).map((patient) => patient.name),
    ).toEqual(["Alice Araujo"]);

    expect(
      buildHomePatientViews({
        agendaEvents,
        filters: { ...defaultFilters, agendaStatuses: ["no_agenda"] },
        patientGroups,
        patients,
        sessions,
        sortKey: "name_asc",
      }).map((patient) => patient.name),
    ).toEqual(["Bruno Braga", "Carla Campos"]);
  });

  it("filters by patient origin", () => {
    expect(
      buildHomePatientViews({
        filters: { ...defaultFilters, originTypes: ["indicacao"] },
        patientGroups,
        patients,
        sessions,
        sortKey: "name_asc",
      }).map((patient) => patient.name),
    ).toEqual(["Alice Araujo"]);

    expect(
      buildHomePatientViews({
        filters: { ...defaultFilters, originTypes: ["outros"] },
        patientGroups,
        patients,
        sessions,
        sortKey: "name_asc",
      }).map((patient) => patient.name),
    ).toEqual(["Carla Campos"]);
  });

  it("filters by patient recurrence and programmed weekdays", () => {
    expect(
      buildHomePatientViews({
        filters: { ...defaultFilters, recurrenceStatuses: ["recurring"] },
        patientGroups,
        patients,
        sessions,
        sortKey: "name_asc",
      }).map((patient) => patient.name),
    ).toEqual(["Alice Araujo"]);

    expect(
      buildHomePatientViews({
        filters: { ...defaultFilters, recurringWeekdays: [3] },
        patientGroups,
        patients,
        sessions,
        sortKey: "name_asc",
      }).map((patient) => patient.name),
    ).toEqual(["Alice Araujo"]);
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
        sortKey: "updated_at_asc",
      }).map((patient) => patient.name),
    ).toEqual(["Carla Campos", "Alice Araujo", "Bruno Braga"]);

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
      agendaStatuses: ["confirmed"],
      collaboratorIds: ["collab-1"],
      colors: ["lavender"],
      groupNames: ["Coluna"],
      originTypes: ["indicacao"],
      paymentStatuses: ["debt"],
      recurrenceStatuses: ["recurring"],
      recurringWeekdays: [1],
      searchTerm: "",
      sessionDateFrom: "2026-04-12",
      sessionDateTo: "",
      statuses: ["ativo", "pausado"],
      weekdays: [1],
    };

    expect(hasActiveHomePatientFilters(filters)).toBe(true);
    expect(getActiveHomePatientFilterCount(filters)).toBe(12);
  });
});
