/**
 * PWA Notifications & Service Worker Integration
 * Therapy-Flow (Pluri-Health)
 *
 * Responsável pelo disparo de notificações nativas de lembretes da agenda,
 * suporte a actions de atendimento/paciente e sincronização do canal de alarme.
 */

import {
  ALARM_BROADCAST_CHANNEL,
  ALARM_DISMISS_MESSAGE,
  stopAlarmLoop,
} from "./notification-sounds";

export { ALARM_BROADCAST_CHANNEL, ALARM_DISMISS_MESSAGE };

export interface ReminderNotificationAction {
  action: "iniciar" | "paciente" | "abrir" | string;
  title: string;
  icon?: string;
}

export const DEFAULT_REMINDER_ACTIONS: ReminderNotificationAction[] = [
  { action: "iniciar", title: "Iniciar" },
  { action: "paciente", title: "Paciente" },
  { action: "abrir", title: "Abrir App" },
];

export interface AgendaReminderNotificationOptions {
  eventId: string;
  title: string;
  body?: string;
  scheduledFor?: string | Date;
  eventType?: string;
  patientId?: string | null;
  patientName?: string | null;
  clinicName?: string | null;
  clinicRouteKey?: string | null;
  tag?: string;
  icon?: string;
  badge?: string;
  actions?: ReminderNotificationAction[];
  url?: string;
  iniciarUrl?: string;
  pacienteUrl?: string;
}

/**
 * Verifica se a API de Notificações do navegador está disponível.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Verifica se o Service Worker é suportado pelo ambiente atual.
 */
export function isServiceWorkerSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

/**
 * Retorna o status de permissão atual de notificações ou 'unsupported'.
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Solicita permissão para disparo de notificações do sistema operacional.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return "denied";
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return Notification.permission;
  }
}

/**
 * Constrói as URLs e payload estruturado para a notificação de lembrete.
 */
export function buildReminderNotificationPayload(options: AgendaReminderNotificationOptions): {
  title: string;
  options: NotificationOptions;
} {
  const patientSuffix = options.patientName ? ` • ${options.patientName}` : "";
  const clinicSuffix = options.clinicName ? ` (${options.clinicName})` : "";
  const defaultBody = `${options.title}${patientSuffix}${clinicSuffix}`;

  const patientId = options.patientId ?? undefined;
  const iniciarUrl =
    options.iniciarUrl ??
    (patientId ? `/sessao/nova?pacienteId=${patientId}` : "/");
  const pacienteUrl =
    options.pacienteUrl ??
    (patientId ? `/pacientes/${patientId}` : "/");
  const defaultUrl = options.url ?? "/";

  const data = {
    eventId: options.eventId,
    patientId: options.patientId ?? null,
    eventType: options.eventType ?? "atendimento",
    scheduledFor: options.scheduledFor,
    url: defaultUrl,
    iniciarUrl,
    pacienteUrl,
  };

  const notificationOptions: NotificationOptions = {
    body: options.body || defaultBody,
    tag: options.tag || `agenda-reminder-${options.eventId}`,
    icon: options.icon || "/brand/plurihealth-icon.png",
    badge: options.badge || "/brand/plurihealth-icon.png",
    data,
    requireInteraction: true,
    // Actions suportadas apenas quando disparadas via Service Worker Registration
    actions: (options.actions || DEFAULT_REMINDER_ACTIONS) as unknown as NotificationAction[],
  };

  return {
    title: options.title || "Lembrete de Agendamento",
    options: notificationOptions,
  };
}

/**
 * Dispara uma notificação nativa para o usuário usando Service Worker (se disponível)
 * ou a API padrão de Notification com fallback limpo.
 */
export async function showAgendaReminderNotification(
  options: AgendaReminderNotificationOptions,
): Promise<boolean> {
  if (!isNotificationSupported()) {
    return false;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await requestNotificationPermission();
  }

  if (permission !== "granted") {
    return false;
  }

  const { title, options: notificationOptions } = buildReminderNotificationPayload(options);

  // Tentativa primária: Service Worker registration (suporta actions 'iniciar', 'paciente', 'abrir')
  if (isServiceWorkerSupported()) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && "showNotification" in registration) {
        await registration.showNotification(title, notificationOptions);
        return true;
      }
    } catch {
      // Falha silenciosa no SW, fallback para API de Notificação tradicional
    }
  }

  // Fallback secundário: Notification constructor direto na janela
  try {
    const { actions: _actions, ...legacyOptions } = notificationOptions;
    const notification = new Notification(title, legacyOptions);

    notification.onclick = () => {
      window.focus();
      dismissAlarmNotification();
      if (notificationOptions.data && typeof notificationOptions.data === "object") {
        const data = notificationOptions.data as { iniciarUrl?: string; url?: string };
        const target = data.iniciarUrl || data.url || "/";
        if (target && target !== "/") {
          window.location.href = target;
        }
      }
      notification.close();
    };

    notification.onclose = () => {
      dismissAlarmNotification();
    };

    return true;
  } catch {
    return false;
  }
}

/**
 * Despacha aviso de encerramento do alarme para todas as abas e instâncias.
 */
export function dismissAlarmNotification(): void {
  stopAlarmLoop({ broadcast: true });
}

/**
 * Inscreve um ouvinte para encerramento de alarme emitido pelo SW ou abas secundárias.
 */
export function subscribeToAlarmChannel(onDismiss: () => void): () => void {
  let broadcastChannel: BroadcastChannel | null = null;

  if (typeof BroadcastChannel !== "undefined") {
    try {
      broadcastChannel = new BroadcastChannel(ALARM_BROADCAST_CHANNEL);
      broadcastChannel.onmessage = (event) => {
        if (
          event.data === ALARM_DISMISS_MESSAGE ||
          (typeof event.data === "object" &&
            event.data !== null &&
            "type" in event.data &&
            event.data.type === ALARM_DISMISS_MESSAGE)
        ) {
          onDismiss();
        }
      };
    } catch {
      broadcastChannel = null;
    }
  }

  const handleSwMessage = (event: MessageEvent) => {
    if (
      event.data === ALARM_DISMISS_MESSAGE ||
      (typeof event.data === "object" &&
        event.data !== null &&
        "type" in event.data &&
        event.data.type === ALARM_DISMISS_MESSAGE)
    ) {
      onDismiss();
    }
  };

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      navigator.serviceWorker.addEventListener("message", handleSwMessage);
    } catch {
      // Ignorar erros em ambiente mock
    }
  }

  return () => {
    if (broadcastChannel) {
      try {
        broadcastChannel.close();
      } catch {
        // Já fechado
      }
      broadcastChannel = null;
    }

    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      try {
        navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      } catch {
        // Ignorar
      }
    }
  };
}
