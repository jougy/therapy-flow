import { describe, expect, it } from "vitest";
import {
  AGENDA_PAST_EVENT_ERROR_MESSAGE,
  assertAgendaEventDateTimeIsFuture,
  buildAgendaEventPayload,
  resolvePatientSelection,
} from "@/lib/agenda-events";

describe("agenda event helpers", () => {
  it("builds an appointment payload from the selected patient", () => {
    const payload = buildAgendaEventPayload({
      clinicId: "clinic-1",
      eventType: "atendimento",
      selectedDate: new Date("2099-03-24T00:00:00.000Z"),
      selectedPatient: { id: "patient-1", name: "Ana Clara" },
      time: "09:30",
      title: "",
      userId: "user-1",
    });

    expect(payload).toMatchObject({
      clinic_id: "clinic-1",
      event_type: "atendimento",
      patient_id: "patient-1",
      title: "Ana Clara",
      user_id: "user-1",
    });
    const scheduledFor = new Date(payload.scheduled_for);
    expect(scheduledFor.getHours()).toBe(9);
    expect(scheduledFor.getMinutes()).toBe(30);
  });

  it("builds a free-text payload for non-appointment events", () => {
    const payload = buildAgendaEventPayload({
      clinicId: "clinic-1",
      eventType: "reuniao",
      selectedDate: new Date("2099-03-24T00:00:00.000Z"),
      selectedPatient: null,
      time: "14:00",
      title: "Reunião com parceiros",
      userId: "user-1",
    });

    expect(payload).toMatchObject({
      clinic_id: "clinic-1",
      event_type: "reuniao",
      patient_id: null,
      title: "Reunião com parceiros",
      user_id: "user-1",
    });
  });

  it("sanitizes hostile titles before saving agenda events", () => {
    const payload = buildAgendaEventPayload({
      clinicId: "clinic-1",
      eventType: "evento",
      selectedDate: new Date("2099-03-24T00:00:00.000Z"),
      selectedPatient: null,
      time: "14:00",
      title: `Consulta\u202e\n<script>${"x".repeat(300)}`,
      userId: "user-1",
    });

    expect(payload.title).not.toContain("\u202e");
    expect(payload.title).not.toContain("\n");
    expect(Array.from(payload.title).length).toBeLessThanOrEqual(160);
  });

  it("matches a patient by exact name in the search field", () => {
    const patient = resolvePatientSelection("ana clara", [
      { id: "patient-1", name: "Ana Clara" },
      { id: "patient-2", name: "Bruno Lima" },
    ]);

    expect(patient).toEqual({ id: "patient-1", name: "Ana Clara" });
  });

  it("rejects agenda events in the past", () => {
    expect(() =>
      assertAgendaEventDateTimeIsFuture(
        new Date("2026-05-20T08:59:00.000Z"),
        new Date("2026-05-20T09:00:00.000Z")
      )
    ).toThrow(AGENDA_PAST_EVENT_ERROR_MESSAGE);
  });

  it("sets duration_minutes with default 60 and custom positive values", () => {
    const defaultPayload = buildAgendaEventPayload({
      clinicId: "clinic-1",
      eventType: "reuniao",
      selectedDate: new Date("2099-03-24T00:00:00.000Z"),
      selectedPatient: null,
      time: "10:00",
      title: "Reunião de Equipe",
      userId: "user-1",
    });
    expect(defaultPayload.duration_minutes).toBe(60);

    const customPayload = buildAgendaEventPayload({
      clinicId: "clinic-1",
      durationMinutes: 45,
      eventType: "reuniao",
      selectedDate: new Date("2099-03-24T00:00:00.000Z"),
      selectedPatient: null,
      time: "10:00",
      title: "Reunião de Equipe",
      userId: "user-1",
    });
    expect(customPayload.duration_minutes).toBe(45);

    const fallbackPayload = buildAgendaEventPayload({
      clinicId: "clinic-1",
      durationMinutes: -10,
      eventType: "reuniao",
      selectedDate: new Date("2099-03-24T00:00:00.000Z"),
      selectedPatient: null,
      time: "10:00",
      title: "Reunião de Equipe",
      userId: "user-1",
    });
    expect(fallbackPayload.duration_minutes).toBe(60);
  });

  it("validates time formats and rejects impossible hours or minutes", async () => {
    const { isValidTimeString, getAgendaEventDateTime } = await import("@/lib/agenda-events");

    expect(isValidTimeString("00:00")).toBe(true);
    expect(isValidTimeString("09:30")).toBe(true);
    expect(isValidTimeString("23:59")).toBe(true);

    // Horários impossíveis
    expect(isValidTimeString("24:00")).toBe(false);
    expect(isValidTimeString("25:00")).toBe(false);
    expect(isValidTimeString("12:60")).toBe(false);
    expect(isValidTimeString("12:99")).toBe(false);
    expect(isValidTimeString("-01:00")).toBe(false);
    expect(isValidTimeString("abc")).toBe(false);
    expect(isValidTimeString("")).toBe(false);

    expect(() =>
      getAgendaEventDateTime(new Date("2099-01-01"), "25:00")
    ).toThrow(/horário válido/i);

    expect(() =>
      getAgendaEventDateTime(new Date("2099-01-01"), "12:75")
    ).toThrow(/horário válido/i);
  });

  it("validates duration boundaries and enforces patient selection on atendimento", () => {
    expect(() =>
      buildAgendaEventPayload({
        clinicId: "clinic-1",
        eventType: "atendimento",
        selectedDate: new Date("2099-03-24T00:00:00.000Z"),
        selectedPatient: null,
        time: "10:00",
        title: "Consulta",
        userId: "user-1",
      })
    ).toThrow(/Selecione um paciente/i);

    expect(() =>
      buildAgendaEventPayload({
        clinicId: "clinic-1",
        eventType: "atendimento",
        selectedDate: new Date("2099-03-24T00:00:00.000Z"),
        selectedPatient: { id: "   ", name: "Sem ID" },
        time: "10:00",
        title: "Consulta",
        userId: "user-1",
      })
    ).toThrow(/Selecione um paciente/i);

    // Duration out of bounds clamped strictly
    const excessivePayload = buildAgendaEventPayload({
      clinicId: "clinic-1",
      durationMinutes: 9999,
      eventType: "reuniao",
      selectedDate: new Date("2099-03-24T00:00:00.000Z"),
      selectedPatient: null,
      time: "10:00",
      title: "Reunião Longa",
      userId: "user-1",
    });
    expect(excessivePayload.duration_minutes).toBe(60);
  });
});

describe("session duration helpers", () => {
  it("parses duration from treatment blocks or explicit fields", async () => {
    const { parseDurationMinutesFromSession } = await import("@/lib/agenda-events");

    expect(
      parseDurationMinutesFromSession({
        treatment: { duration_minutes: 50 },
      })
    ).toBe(50);

    expect(
      parseDurationMinutesFromSession({
        treatment: { blocks: [{ duration: "45 minutos" }] },
      })
    ).toBe(45);

    expect(
      parseDurationMinutesFromSession({
        scheduled_start_at: "2026-09-26T10:00:00.000Z",
        updated_at: "2026-09-26T10:50:00.000Z",
      })
    ).toBe(50);
  });

  it("calculates average duration from multiple completed sessions", async () => {
    const { fetchPatientAverageSessionDurationMinutes } = await import("@/lib/agenda-events");

    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              in: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: [
                        { treatment: { duration_minutes: 50 } },
                        { treatment: { duration_minutes: 60 } },
                      ],
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const avg = await fetchPatientAverageSessionDurationMinutes("pat-1", {
      // @ts-expect-error mock supabase client
      supabaseClient: mockSupabase,
    });

    expect(avg).toBe(55);
  });

  it("falls back gracefully when patientId is missing or no sessions exist", async () => {
    const { fetchPatientAverageSessionDurationMinutes } = await import("@/lib/agenda-events");

    const fallback = await fetchPatientAverageSessionDurationMinutes("", { fallbackMinutes: 50 });
    expect(fallback).toBe(50);
  });

  it("handles graceMinutes correctly in isAgendaEventDateTimeInPast and assertAgendaEventDateTimeIsFuture", async () => {
    const { isAgendaEventDateTimeInPast, assertAgendaEventDateTimeIsFuture } = await import("@/lib/agenda-events");

    const now = new Date("2026-09-27T14:10:00.000Z");
    const fiveMinutesAgo = new Date("2026-09-27T14:05:00.000Z");
    const twentyMinutesAgo = new Date("2026-09-27T13:50:00.000Z");

    // With 0 grace minutes: fiveMinutesAgo is past
    expect(isAgendaEventDateTimeInPast(fiveMinutesAgo, now, 0)).toBe(true);

    // With 15 grace minutes: fiveMinutesAgo is NOT considered past
    expect(isAgendaEventDateTimeInPast(fiveMinutesAgo, now, 15)).toBe(false);
    expect(() => assertAgendaEventDateTimeIsFuture(fiveMinutesAgo, now, 15)).not.toThrow();

    // With 15 grace minutes: twentyMinutesAgo IS considered past
    expect(isAgendaEventDateTimeInPast(twentyMinutesAgo, now, 15)).toBe(true);
    expect(() => assertAgendaEventDateTimeIsFuture(twentyMinutesAgo, now, 15)).toThrow();
  });

  it("parses date string YYYY-MM-DD safely without UTC timezone shift", async () => {
    const { getAgendaEventDateTime } = await import("@/lib/agenda-events");

    const dt = getAgendaEventDateTime("2026-09-27", "14:30");
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(8); // September is index 8
    expect(dt.getDate()).toBe(27);
    expect(dt.getHours()).toBe(14);
    expect(dt.getMinutes()).toBe(30);
  });

  it("formats Supabase PostgREST and RLS error messages meaningfully", async () => {
    const { formatSupabaseErrorMessage } = await import("@/lib/agenda-events");

    expect(formatSupabaseErrorMessage(null)).toBe("Tente novamente.");
    expect(formatSupabaseErrorMessage("Erro direto")).toBe("Erro direto");

    // PostgREST error with message
    expect(formatSupabaseErrorMessage({ message: "new row violates row-level security policy for table agenda_events" }))
      .toBe("Permissão insuficiente ou clínica não identificada para criar este agendamento.");

    // Postgres 42501 error code
    expect(formatSupabaseErrorMessage({ code: "42501", message: "permission denied for table agenda_events" }))
      .toBe("Permissão insuficiente ou clínica não identificada para criar este agendamento.");

    // Regular error object
    expect(formatSupabaseErrorMessage({ message: "Horário em conflito com outro agendamento" }))
      .toBe("Horário em conflito com outro agendamento");

    // Object with only details
    expect(formatSupabaseErrorMessage({ details: "Detail text from Postgres" }))
      .toBe("Detail text from Postgres");
  });
});


