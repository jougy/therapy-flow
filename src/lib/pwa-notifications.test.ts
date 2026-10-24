import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALARM_BROADCAST_CHANNEL,
  ALARM_DISMISS_MESSAGE,
  buildReminderNotificationPayload,
  DEFAULT_REMINDER_ACTIONS,
  dismissAlarmNotification,
  getNotificationPermission,
  isNotificationSupported,
  isServiceWorkerSupported,
  requestNotificationPermission,
  showAgendaReminderNotification,
  subscribeToAlarmChannel,
} from "./pwa-notifications";
import * as soundModule from "./notification-sounds";

describe("PWA Notifications & Service Worker Integration", () => {
  const originalNotification = globalThis.Notification;
  const originalNavigator = globalThis.navigator;

  let postMessageSpy: ReturnType<typeof vi.fn>;
  let closeSpy: ReturnType<typeof vi.fn>;
  let registeredBroadcastChannels: Array<{
    name: string;
    onmessage: ((event: MessageEvent) => void) | null;
  }> = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    registeredBroadcastChannels = [];
    postMessageSpy = vi.fn();
    closeSpy = vi.fn();

    class MockBroadcastChannel {
      name: string;
      onmessage: ((event: MessageEvent) => void) | null = null;
      constructor(name: string) {
        this.name = name;
        registeredBroadcastChannels.push(this);
      }
      postMessage(msg: unknown) {
        postMessageSpy(msg);
      }
      close() {
        closeSpy();
      }
    }

    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
  });

  afterEach(() => {
    if (originalNotification) {
      vi.stubGlobal("Notification", originalNotification);
    }
  });

  describe("API Detection and Permissions", () => {
    it("detects Notification and ServiceWorker support correctly", () => {
      expect(typeof isNotificationSupported()).toBe("boolean");
      expect(typeof isServiceWorkerSupported()).toBe("boolean");
    });

    it("returns correct permission when Notification is supported", () => {
      const mockNotification = {
        permission: "granted" as NotificationPermission,
        requestPermission: vi.fn().mockResolvedValue("granted"),
      };
      vi.stubGlobal("Notification", mockNotification);

      expect(getNotificationPermission()).toBe("granted");
    });

    it("requests notification permission successfully", async () => {
      const mockNotification = {
        permission: "default" as NotificationPermission,
        requestPermission: vi.fn().mockResolvedValue("granted"),
      };
      vi.stubGlobal("Notification", mockNotification);

      const result = await requestNotificationPermission();
      expect(result).toBe("granted");
      expect(mockNotification.requestPermission).toHaveBeenCalled();
    });
  });

  describe("buildReminderNotificationPayload", () => {
    it("builds payload with default actions: iniciar, paciente, abrir", () => {
      const payload = buildReminderNotificationPayload({
        eventId: "event-123",
        title: "Consulta Inicial",
        eventType: "atendimento",
        patientId: "pac-99",
        patientName: "Maria Souza",
        clinicName: "Clínica Vida",
      });

      expect(payload.title).toBe("Consulta Inicial");
      expect(payload.options.body).toContain("Consulta Inicial");
      expect(payload.options.body).toContain("Maria Souza");
      expect(payload.options.body).toContain("Clínica Vida");
      expect(payload.options.tag).toBe("agenda-reminder-event-123");
      expect(payload.options.actions).toEqual(DEFAULT_REMINDER_ACTIONS);

      const data = payload.options.data as {
        eventId: string;
        patientId: string;
        iniciarUrl: string;
        pacienteUrl: string;
      };
      expect(data.eventId).toBe("event-123");
      expect(data.patientId).toBe("pac-99");
      expect(data.iniciarUrl).toBe("/sessao/nova?pacienteId=pac-99");
      expect(data.pacienteUrl).toBe("/pacientes/pac-99");
    });

    it("respects custom actions and explicit urls", () => {
      const customActions = [{ action: "custom", title: "Personalizado" }];
      const payload = buildReminderNotificationPayload({
        eventId: "event-456",
        title: "Reunião de Equipe",
        eventType: "reuniao",
        actions: customActions,
        url: "/clinica/agenda",
      });

      expect(payload.options.actions).toEqual(customActions);
      const data = payload.options.data as { url: string };
      expect(data.url).toBe("/clinica/agenda");
    });
  });

  describe("showAgendaReminderNotification", () => {
    it("dispatches notification via Service Worker registration if available", async () => {
      const showNotificationMock = vi.fn().mockResolvedValue(undefined);

      vi.stubGlobal("Notification", {
        permission: "granted" as NotificationPermission,
        requestPermission: vi.fn().mockResolvedValue("granted"),
      });

      Object.defineProperty(globalThis.navigator, "serviceWorker", {
        value: {
          getRegistration: vi.fn().mockResolvedValue({
            showNotification: showNotificationMock,
          }),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
        configurable: true,
      });

      const success = await showAgendaReminderNotification({
        eventId: "ev-789",
        title: "Avaliação Fisioterapêutica",
        patientId: "pac-01",
        patientName: "João Silva",
      });

      expect(success).toBe(true);
      expect(showNotificationMock).toHaveBeenCalledWith(
        "Avaliação Fisioterapêutica",
        expect.objectContaining({
          tag: "agenda-reminder-ev-789",
          actions: DEFAULT_REMINDER_ACTIONS,
        }),
      );
    });

    it("returns false if permission is denied", async () => {
      vi.stubGlobal("Notification", {
        permission: "denied" as NotificationPermission,
        requestPermission: vi.fn().mockResolvedValue("denied"),
      });

      const success = await showAgendaReminderNotification({
        eventId: "ev-000",
        title: "Compromisso",
      });

      expect(success).toBe(false);
    });
  });

  describe("dismissAlarmNotification and subscribeToAlarmChannel", () => {
    it("dismissAlarmNotification stops the sound loop with broadcast flag", () => {
      const stopAlarmLoopSpy = vi.spyOn(soundModule, "stopAlarmLoop");

      dismissAlarmNotification();

      expect(stopAlarmLoopSpy).toHaveBeenCalledWith({ broadcast: true });
    });

    it("subscribeToAlarmChannel listens to DISMISS_ALARM message", () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToAlarmChannel(callback);

      expect(registeredBroadcastChannels.length).toBeGreaterThan(0);
      const channel = registeredBroadcastChannels[0];

      // Dispara evento de teste
      channel.onmessage?.({
        data: ALARM_DISMISS_MESSAGE,
      } as MessageEvent);

      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      expect(closeSpy).toHaveBeenCalled();
    });
  });
});
