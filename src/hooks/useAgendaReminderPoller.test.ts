import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildReminderDedupKey,
  isReminderDue,
  parseReminderConfigs,
  useAgendaReminderPoller,
} from "./useAgendaReminderPoller";
import * as pwaModule from "@/lib/pwa-notifications";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    clinic: { id: "clinic-1", name: "Clínica Teste", route_key: "clinica-teste" },
    user: { id: "user-1" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

describe("useAgendaReminderPoller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Helper Functions", () => {
    it("isReminderDue calculates target time within 1 minute tolerance", () => {
      const now = new Date(2026, 9, 17, 10, 30, 0); // 10:30:00
      const exactEvent = new Date(2026, 9, 17, 10, 30, 20); // 10:30:20 (20s diff)
      const earlyEvent = new Date(2026, 9, 17, 10, 45, 0); // 10:45:00 with 15min before -> 10:30:00

      expect(isReminderDue(exactEvent, 0, now, 1)).toBe(true);
      expect(isReminderDue(earlyEvent, 15, now, 1)).toBe(true);

      const farEvent = new Date(2026, 9, 17, 11, 0, 0); // 30 min diff
      expect(isReminderDue(farEvent, 0, now, 1)).toBe(false);
    });

    it("parseReminderConfigs handles various shapes and defaults safely", () => {
      expect(parseReminderConfigs(null)).toEqual([{ minutesBefore: 0 }]);
      expect(parseReminderConfigs([])).toEqual([{ minutesBefore: 0 }]);
      expect(parseReminderConfigs([15, 0])).toEqual([
        { minutesBefore: 15 },
        { minutesBefore: 0 },
      ]);
      expect(
        parseReminderConfigs([{ minutesBefore: 10, soundKey: "chime" }]),
      ).toEqual([{ minutesBefore: 10, soundKey: "chime" }]);
      expect(parseReminderConfigs([{ minutes: 5 }])).toEqual([
        { minutesBefore: 5, soundKey: undefined },
      ]);
    });

    it("buildReminderDedupKey generates consistent key", () => {
      const key = buildReminderDedupKey("event-1", 15, "2026-10-17T10:30:00.000Z");
      expect(key).toBe("event-1_15_2026-10-17T10:30");
    });
  });

  describe("Hook Execution", () => {
    it("detects due events and triggers notification + alarm dialog", () => {
      const showNotificationSpy = vi
        .spyOn(pwaModule, "showAgendaReminderNotification")
        .mockResolvedValue(true);

      const now = new Date();
      const scheduledIso = now.toISOString();

      const testEvent = {
        id: "ev-due-1",
        title: "Atendimento Imediato",
        scheduledFor: scheduledIso,
        eventType: "atendimento",
        patientId: "pac-1",
        patientName: "Ana Clara",
        clinicName: "Clínica Teste",
        reminderConfigs: [{ minutesBefore: 0 }],
      };

      const onTrigger = vi.fn();

      const { result } = renderHook(() =>
        useAgendaReminderPoller({
          enabled: true,
          events: [testEvent],
          onReminderTriggered: onTrigger,
        }),
      );

      expect(result.current.isAlarmOpen).toBe(true);
      expect(result.current.activeAlarmEvent?.id).toBe("ev-due-1");
      expect(showNotificationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: "ev-due-1",
          title: "Lembrete de Agendamento",
        }),
      );
      expect(onTrigger).toHaveBeenCalledWith(testEvent);
    });

    it("allows manual closing and dismissing of alarm", () => {
      const { result } = renderHook(() =>
        useAgendaReminderPoller({ enabled: false }),
      );

      act(() => {
        result.current.openAlarm({
          id: "manual-1",
          title: "Alarme Manual",
          scheduledFor: new Date().toISOString(),
          eventType: "evento",
        });
      });

      expect(result.current.isAlarmOpen).toBe(true);

      act(() => {
        result.current.closeAlarm();
      });

      expect(result.current.isAlarmOpen).toBe(false);
    });
  });
});
