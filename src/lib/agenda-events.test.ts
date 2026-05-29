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
});
