import { format, isToday, isTomorrow, isYesterday, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { OnboardingMeeting } from "./types";

/**
 * Normaliza número de telefone para o padrão do WhatsApp (55 + DDD + 9 dígitos)
 */
export const getWhatsAppLink = (phone: string, leadName?: string): string => {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "#";
  const fullDigits = digits.startsWith("55") ? digits : `55${digits}`;
  const greeting = leadName ? `Olá ${leadName}, tudo bem?` : "Olá, tudo bem?";
  const message = `${greeting} Aqui é da equipe Pluri-Health sobre a nossa reunião de onboarding.`;
  return `https://wa.me/${fullDigits}?text=${encodeURIComponent(message)}`;
};

/**
 * Gera link de disparo rápido de lembrete da reunião via WhatsApp
 */
export const getWhatsAppReminderLink = (meeting: OnboardingMeeting): string => {
  const digits = (meeting.phone || "").replace(/\D/g, "");
  if (!digits) return "#";
  const fullDigits = digits.startsWith("55") ? digits : `55${digits}`;
  const formattedDate = formatMeetingDateTimeFull(meeting.scheduled_at);
  const leadGreeting = meeting.lead_name ? `Olá, ${meeting.lead_name}!` : "Olá!";
  const meetInfo = meeting.meet_url ? `\n\nLink da sala: ${meeting.meet_url}` : "";

  const reminderText =
    `${leadGreeting} 👋\n\n` +
    `Lembramos da nossa reunião de onboarding e introdução da plataforma *Pluri-Health* agendada para:\n` +
    `🗓️ *${formattedDate}* (Duração: ${meeting.duration_minutes || 15} min)${meetInfo}\n\n` +
    `Podemos confirmar a sua presença? Responda com *1 para Confirmar* ou *2 para Remarcar*.`;

  return `https://wa.me/${fullDigits}?text=${encodeURIComponent(reminderText)}`;
};

/**
 * Identifica se a reunião foi originada ou confirmada via WhatsApp Copilot
 */
export const isWhatsAppCopilotOrigin = (meeting: OnboardingMeeting): boolean => {
  if (meeting.origin === "whatsapp_copilot" || meeting.origin === "whatsapp") return true;
  if (meeting.confirmation_channel === "whatsapp") return true;
  const notesLower = (meeting.notes || "").toLowerCase();
  return (
    notesLower.includes("whatsapp") ||
    notesLower.includes("copilot") ||
    notesLower.includes("wa bot") ||
    notesLower.includes("agendado via whatsapp")
  );
};

/**
 * Formata telefone amigavelmente: (11) 99999-9999
 */
export const formatPhoneDisplay = (phone: string): string => {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 13 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const num = digits.slice(4);
    return `+55 (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
  }
  return phone || "Sem telefone";
};

/**
 * Retorna URL do Google Calendar para a reunião (ou gera link de criação automática se não houver)
 */
export const getGoogleCalendarUrl = (meeting: OnboardingMeeting): string => {
  if (meeting.google_calendar_url && meeting.google_calendar_url.startsWith("http")) {
    return meeting.google_calendar_url;
  }

  try {
    const start = new Date(meeting.scheduled_at);
    const end = addMinutes(start, meeting.duration_minutes || 15);

    const formatGCalDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
    };

    const title = `Reunião Onboarding Pluri-Health - ${meeting.lead_name}${meeting.clinic_name ? ` (${meeting.clinic_name})` : ""}`;
    const details = [
      `Reunião de Onboarding e Introdução Pluri-Health`,
      `Lead/Profissional: ${meeting.lead_name}`,
      meeting.clinic_name ? `Clínica: ${meeting.clinic_name}` : null,
      `Telefone/WhatsApp: ${formatPhoneDisplay(meeting.phone)}`,
      meeting.email ? `E-mail: ${meeting.email}` : null,
      meeting.meet_url ? `Link da Chamada: ${meeting.meet_url}` : null,
      meeting.notes ? `\nAnotações: ${meeting.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${formatGCalDate(start)}/${formatGCalDate(end)}`,
      details,
      location: meeting.meet_url || "Online (Google Meet)",
    });

    if (meeting.email) {
      params.append("add", meeting.email);
    }

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  } catch {
    return "https://calendar.google.com";
  }
};

/**
 * Formata a data completa da reunião: "Quarta-feira, 15 de Outubro às 10:30"
 */
export const formatMeetingDateTimeFull = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    const raw = format(date, "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR });
    // Capitalizar a primeira letra do dia da semana
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  } catch {
    return isoString || "-";
  }
};

/**
 * Retorna rótulo relativo amigável: "Hoje às 14:00", "Amanhã às 10:30", "Ontem às 16:00" ou "15/10 às 10:30"
 */
export const formatMeetingRelative = (isoString: string): { label: string; isUpcoming: boolean; isToday: boolean } => {
  try {
    const date = new Date(isoString);
    const time = format(date, "HH:mm");
    const isNowUpcoming = date.getTime() >= Date.now();

    if (isToday(date)) {
      return { label: `Hoje às ${time}`, isUpcoming: isNowUpcoming, isToday: true };
    }
    if (isTomorrow(date)) {
      return { label: `Amanhã às ${time}`, isUpcoming: true, isToday: false };
    }
    if (isYesterday(date)) {
      return { label: `Ontem às ${time}`, isUpcoming: false, isToday: false };
    }

    return {
      label: `${format(date, "dd/MM 'às' HH:mm", { locale: ptBR })}`,
      isUpcoming: isNowUpcoming,
      isToday: false,
    };
  } catch {
    return { label: isoString || "-", isUpcoming: false, isToday: false };
  }
};
