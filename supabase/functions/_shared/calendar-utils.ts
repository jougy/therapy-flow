// supabase/functions/_shared/calendar-utils.ts

/**
 * Utilitários de Calendário, Agendamento e Disponibilidade para Reuniões de Onboarding (PluriFisio)
 * Fuso horário de referência: Horário de Brasília (America/Sao_Paulo, UTC-3).
 */

export interface TimeSlot {
  startMinutes: number; // Minutos a partir da meia-noite (ex: 9*60 = 540)
  endMinutes: number;   // Minutos a partir da meia-noite (ex: 9*60 + 15 = 555)
  formattedStart: string; // "09:00"
  formattedEnd: string;   // "09:15"
}

export interface TimeWindow {
  startMinutes: number;
  endMinutes: number;
  formattedStart: string;
  formattedEnd: string;
}

export interface DayOption {
  dateIso: string;       // "2026-10-13"
  displayDayOfWeek: string; // "Segunda-feira"
  displayDate: string;   // "13/10"
  fullLabel: string;     // "Segunda-feira (13/10)"
}

export interface GoogleCalendarEventParams {
  title: string;
  details: string;
  location?: string;
  startDate: Date;
  durationMinutes?: number;
}

export interface ExistingMeeting {
  scheduled_at: string | Date;
  duration_minutes: number;
  status?: string;
}

const BRASILIA_OFFSET_HOURS = -3; // UTC-3

/**
 * Converte data e hora em minutos locais (Brasília UTC-3) para Date UTC
 */
export function createBrasiliaDate(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  // UTC equivalent: subtract offset (-3 => +3 hours in UTC)
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours + 3, minutes, 0, 0));
  return utcDate;
}

/**
 * Extrai minutos a partir da meia-noite (0..1439) no horário de Brasília de um Date ou string ISO
 */
export function getBrasiliaMinutesOfDay(dateOrIso: Date | string): number {
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  // Converter para horário de Brasília (UTC-3)
  const brasiliaTime = new Date(d.getTime() + BRASILIA_OFFSET_HOURS * 60 * 60 * 1000);
  return brasiliaTime.getUTCHours() * 60 + brasiliaTime.getUTCMinutes();
}

/**
 * Extrai dia da semana no horário de Brasília (0 = Domingo, 1 = Segunda, ..., 4 = Quinta, 6 = Sábado)
 */
export function getBrasiliaDayOfWeek(dateOrIso: Date | string): number {
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  const brasiliaTime = new Date(d.getTime() + BRASILIA_OFFSET_HOURS * 60 * 60 * 1000);
  return brasiliaTime.getUTCDay();
}

/**
 * Formata minutos desde a meia-noite para formato "HH:MM"
 */
export function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Converte string "HH:MM" para minutos desde a meia-noite
 */
export function parseTimeToMinutes(timeStr: string): number | null {
  const trimmed = timeStr.trim().replace(/h/i, ':').replace(/\s+/g, '');
  const match = trimmed.match(/^([0-1]?[0-9]|2[0-3]):?([0-5][0-9])?$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const mins = match[2] ? parseInt(match[2], 10) : 0;
  if (isNaN(hours) || isNaN(mins)) return null;
  return hours * 60 + mins;
}

/**
 * Retorna os próximos N dias úteis (Segunda a Sexta) a partir da data de referência (hoje em Brasília)
 */
export function getNextBusinessDays(count = 5, fromDate?: Date): DayOption[] {
  const now = fromDate || new Date();
  const brasiliaNow = new Date(now.getTime() + BRASILIA_OFFSET_HOURS * 60 * 60 * 1000);
  
  const options: DayOption[] = [];
  const dayNames = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];

  let current = new Date(Date.UTC(
    brasiliaNow.getUTCFullYear(),
    brasiliaNow.getUTCMonth(),
    brasiliaNow.getUTCDate() + 1 // Começa a partir de amanhã por padrão se já no fim do dia, ou hoje se cedo
  ));

  // Se hoje for dia útil e ainda antes das 17h, inclui hoje
  const currentHour = brasiliaNow.getUTCHours();
  if (brasiliaNow.getUTCDay() >= 1 && brasiliaNow.getUTCDay() <= 5 && currentHour < 16) {
    current = new Date(Date.UTC(
      brasiliaNow.getUTCFullYear(),
      brasiliaNow.getUTCMonth(),
      brasiliaNow.getUTCDate()
    ));
  }

  while (options.length < count) {
    const dayOfWeek = current.getUTCDay();
    // Apenas Segunda (1) a Sexta (5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const yyyy = current.getUTCFullYear();
      const mm = String(current.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(current.getUTCDate()).padStart(2, '0');
      const dateIso = `${yyyy}-${mm}-${dd}`;
      const displayDayOfWeek = dayNames[dayOfWeek];
      const displayDate = `${dd}/${mm}`;

      options.push({
        dateIso,
        displayDayOfWeek,
        displayDate,
        fullLabel: `${displayDayOfWeek} (${displayDate})`,
      });
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return options;
}

/**
 * Calcula os blocos de horário ocupados/bloqueados para um determinado dia
 * Regras:
 * - Horário padrão comercial: 09:00 (540m) às 18:00 (1080m)
 * - Quintas-feiras: 07:00 às 12:00 bloqueado (disponível apenas das 12:00 às 18:00)
 * - Todos os dias: 13:00 às 14:00 bloqueado (almoço)
 * - Buffer de segurança: 30 minutos antes e depois de reuniões existentes ativas
 * Complexidade algorítmica: O(K log K) no número de reuniões (K) através de merge de intervalos ordenados.
 */
export function getAvailableWindowsForDay(
  dateIso: string,
  existingMeetings: ExistingMeeting[] = [],
  slotDurationMinutes = 15
): { availableWindows: TimeWindow[]; availableSlots: TimeSlot[] } {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return { availableWindows: [], availableSlots: [] };
  }

  const [year, month, day] = dateIso.split('-').map(Number);
  const targetDateUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (isNaN(targetDateUtc.getTime())) {
    return { availableWindows: [], availableSlots: [] };
  }

  const dayOfWeek = targetDateUtc.getUTCDay(); // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat

  // Finais de semana não têm atendimento
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { availableWindows: [], availableSlots: [] };
  }

  const startOfDayMinutes = 9 * 60; // 09:00 (540 min)
  const endOfDayMinutes = 18 * 60;   // 18:00 (1080 min)

  // 1. Coleta e normalização de intervalos bloqueados
  const rawBlockedIntervals: Array<{ start: number; end: number }> = [];

  // Bloqueio de Quinta-feira de manhã (até 12:00)
  if (dayOfWeek === 4) {
    rawBlockedIntervals.push({ start: startOfDayMinutes, end: 12 * 60 });
  }

  // Almoço diário: 13:00 às 14:00 (780m a 840m)
  rawBlockedIntervals.push({ start: 13 * 60, end: 14 * 60 });

  // Reuniões já agendadas + Buffer de 30min antes e depois
  for (const meeting of existingMeetings) {
    if (!meeting || meeting.status === 'canceled') continue;

    const meetingStartMinutes = getBrasiliaMinutesOfDay(meeting.scheduled_at);
    if (isNaN(meetingStartMinutes)) continue;

    const duration = Math.max(5, Math.min(meeting.duration_minutes || 15, 240));
    const meetingEndMinutes = meetingStartMinutes + duration;

    // Buffer defensivo de 30min antes e 30min depois
    const bufferBefore = 30;
    const bufferAfter = 30;

    const blockStart = Math.max(startOfDayMinutes, meetingStartMinutes - bufferBefore);
    const blockEnd = Math.min(endOfDayMinutes, meetingEndMinutes + bufferAfter);

    if (blockStart < blockEnd) {
      rawBlockedIntervals.push({ start: blockStart, end: blockEnd });
    }
  }

  // 2. Ordenação e Merge de intervalos bloqueados O(K log K)
  rawBlockedIntervals.sort((a, b) => a.start - b.start || a.end - b.end);

  const mergedBlocked: Array<{ start: number; end: number }> = [];
  for (const interval of rawBlockedIntervals) {
    if (mergedBlocked.length === 0) {
      mergedBlocked.push({ ...interval });
    } else {
      const last = mergedBlocked[mergedBlocked.length - 1];
      if (interval.start <= last.end) {
        last.end = Math.max(last.end, interval.end);
      } else {
        mergedBlocked.push({ ...interval });
      }
    }
  }

  // 3. Extração direta das janelas livres complementares O(K)
  const availableWindows: TimeWindow[] = [];
  let currentPointer = startOfDayMinutes;

  for (const blocked of mergedBlocked) {
    if (blocked.start > currentPointer) {
      const windowStart = currentPointer;
      const windowEnd = Math.min(blocked.start, endOfDayMinutes);
      if (windowEnd - windowStart >= slotDurationMinutes) {
        availableWindows.push({
          startMinutes: windowStart,
          endMinutes: windowEnd,
          formattedStart: formatMinutesToTime(windowStart),
          formattedEnd: formatMinutesToTime(windowEnd),
        });
      }
    }
    currentPointer = Math.max(currentPointer, blocked.end);
  }

  if (currentPointer < endOfDayMinutes && endOfDayMinutes - currentPointer >= slotDurationMinutes) {
    availableWindows.push({
      startMinutes: currentPointer,
      endMinutes: endOfDayMinutes,
      formattedStart: formatMinutesToTime(currentPointer),
      formattedEnd: formatMinutesToTime(endOfDayMinutes),
    });
  }

  // 4. Geração dos slots de 15 minutos dentro das janelas livres O(Slots)
  const availableSlots: TimeSlot[] = [];
  for (const win of availableWindows) {
    for (let min = win.startMinutes; min + slotDurationMinutes <= win.endMinutes; min += slotDurationMinutes) {
      availableSlots.push({
        startMinutes: min,
        endMinutes: min + slotDurationMinutes,
        formattedStart: formatMinutesToTime(min),
        formattedEnd: formatMinutesToTime(min + slotDurationMinutes),
      });
    }
  }

  return { availableWindows, availableSlots };
}

/**
 * Formata as janelas de disponibilidade em texto amigável para o WhatsApp
 * Exemplo: "Manhã: 09:30 às 11:30 | Tarde: 14:30 às 17:30"
 */
export function formatAvailableWindowsText(windows: TimeWindow[]): string {
  if (!windows || windows.length === 0) {
    return 'Não há horários livres disponíveis nesta data.';
  }

  const morningWindows = windows.filter((w) => w.startMinutes < 12 * 60);
  const afternoonWindows = windows.filter((w) => w.startMinutes >= 12 * 60);

  const parts: string[] = [];

  if (morningWindows.length > 0) {
    const morningStr = morningWindows
      .map((w) => `${w.formattedStart} às ${w.formattedEnd}`)
      .join(', ');
    parts.push(`*Manhã:* ${morningStr}`);
  }

  if (afternoonWindows.length > 0) {
    const afternoonStr = afternoonWindows
      .map((w) => `${w.formattedStart} às ${w.formattedEnd}`)
      .join(', ');
    parts.push(`*Tarde:* ${afternoonStr}`);
  }

  return parts.join(' | ');
}

/**
 * Valida se um horário digitado pelo usuário (ex: "10:30", "14h", "15:00") é válido e está livre
 */
export function validateSelectedTime(
  dateIso: string,
  userTimeInput: string,
  existingMeetings: ExistingMeeting[] = [],
  slotDurationMinutes = 15
): { isValid: boolean; normalizedTime: string; dateObj?: Date; errorMessage?: string } {
  const minutes = parseTimeToMinutes(userTimeInput);
  if (minutes === null) {
    return {
      isValid: false,
      normalizedTime: '',
      errorMessage: 'Formato de horário não reconhecido. Por favor, digite no formato HH:MM (ex: 10:30, 15:00).',
    };
  }

  const { availableSlots } = getAvailableWindowsForDay(dateIso, existingMeetings, slotDurationMinutes);
  const normalizedTime = formatMinutesToTime(minutes);

  // Verifica se o slot exato ou compatível está disponível
  const slotExists = availableSlots.some((s) => s.startMinutes === minutes);

  if (!slotExists) {
    return {
      isValid: false,
      normalizedTime,
      errorMessage: `O horário ${normalizedTime} não está disponível ou coincide com um intervalo bloqueado/reservado.`,
    };
  }

  const dateObj = createBrasiliaDate(dateIso, normalizedTime);

  return {
    isValid: true,
    normalizedTime,
    dateObj,
  };
}

/**
 * Formata um Date no formato ISO básico para Google Calendar UTC: YYYYMMDDTHHmmssZ
 */
export function formatToGoogleCalendarIso(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');

  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
}

/**
 * Gera URL direta de adição à Google Agenda (Google Calendar)
 */
export function generateGoogleCalendarUrl(params: GoogleCalendarEventParams): string {
  const duration = params.durationMinutes || 15;
  const startDate = params.startDate;
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  const startIso = formatToGoogleCalendarIso(startDate);
  const endIso = formatToGoogleCalendarIso(endDate);

  const title = encodeURIComponent(params.title);
  const details = encodeURIComponent(params.details);
  const location = encodeURIComponent(params.location || 'Online / WhatsApp (PluriFisio)');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
}

/**
 * Escapa texto de acordo com a especificação RFC 5545 para evitar injeção de cabeçalhos e corrupção de .ics
 */
function escapeIcsText(text: string): string {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Gera conteúdo de arquivo iCalendar (.ics) para download ou anexo
 */
export function generateIcsContent(params: GoogleCalendarEventParams): string {
  const duration = Math.max(5, Math.min(params.durationMinutes || 15, 240));
  const startDate = params.startDate instanceof Date && !isNaN(params.startDate.getTime())
    ? params.startDate
    : new Date();
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  const startIso = formatToGoogleCalendarIso(startDate);
  const endIso = formatToGoogleCalendarIso(endDate);
  const nowIso = formatToGoogleCalendarIso(new Date());
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const uid = `onboarding-${startDate.getTime()}-${randomSuffix}@plurifisio.com.br`;

  const safeTitle = escapeIcsText(params.title || 'Reunião de Onboarding PluriFisio');
  const safeDetails = escapeIcsText(params.details || '');
  const safeLocation = escapeIcsText(params.location || 'Online / WhatsApp (PluriFisio)');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PluriFisio//Onboarding Calendar//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowIso}`,
    `DTSTART:${startIso}`,
    `DTEND:${endIso}`,
    `SUMMARY:${safeTitle}`,
    `DESCRIPTION:${safeDetails}`,
    `LOCATION:${safeLocation}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Cache em memória para o feed iCal com TTL de 2 minutos para evitar requisições redundantes
 */
interface IcsCacheEntry {
  content: string;
  timestamp: number;
}
const icsCache = new Map<string, IcsCacheEntry>();
const ICS_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos

/**
 * Converte timestamp iCalendar (UTC, TZID ou DATE) para Date UTC
 */
export function parseIcsDate(rawDateStr: string): Date | null {
  if (!rawDateStr) return null;
  const trimmed = rawDateStr.trim();

  // Caso 1: UTC terminando em Z (ex: 20261014T130000Z)
  const utcMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utcMatch) {
    const [, y, m, d, hh, mm, ss] = utcMatch.map(Number);
    return new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
  }

  // Caso 2: Data e hora sem Z (assumindo Brasília UTC-3 padrão da conta do Google Agenda)
  const localMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (localMatch) {
    const [, y, m, d, hh, mm, ss] = localMatch.map(Number);
    // UTC-3 => +3 horas para UTC
    return new Date(Date.UTC(y, m - 1, d, hh + 3, mm, ss));
  }

  // Caso 3: Dia inteiro (ex: 20261014)
  const dateMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateMatch) {
    const [, y, m, d] = dateMatch.map(Number);
    // Começa à 00:00 de Brasília (+3h UTC)
    return new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
  }

  return null;
}

/**
 * Analisa o conteúdo de um arquivo .ics (RFC 5545) e extrai os compromissos ocupados para a data alvo
 */
export function parseIcsToBusySlots(icsContent: string, dateIso: string): ExistingMeeting[] {
  if (!icsContent || !dateIso) return [];

  // Alvo: Início e fim do dia em Brasília (UTC-3)
  const [targetY, targetM, targetD] = dateIso.split('-').map(Number);
  const dayStartUtc = new Date(Date.UTC(targetY, targetM - 1, targetD, 3, 0, 0)).getTime(); // 00:00 BRT
  const dayEndUtc = new Date(Date.UTC(targetY, targetM - 1, targetD + 1, 2, 59, 59, 999)).getTime(); // 23:59:59 BRT

  const busySlots: ExistingMeeting[] = [];

  // Separa eventos VEVENT
  const eventBlocks = icsContent.split('BEGIN:VEVENT');
  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i].split('END:VEVENT')[0];
    if (!block) continue;

    // Se estiver cancelado ou marcado como tempo livre (TRANSP:TRANSPARENT), ignora
    if (/STATUS:\s*CANCELLED/i.test(block) || /TRANSP:\s*TRANSPARENT/i.test(block)) {
      continue;
    }

    // Extrai DTSTART
    const dtStartMatch = block.match(/DTSTART(?:;[^:]+)?:([^\r\n]+)/);
    if (!dtStartMatch) continue;
    const startDate = parseIcsDate(dtStartMatch[1]);
    if (!startDate) continue;

    // Extrai DTEND ou DURATION
    let endDate: Date | null = null;
    const dtEndMatch = block.match(/DTEND(?:;[^:]+)?:([^\r\n]+)/);
    if (dtEndMatch) {
      endDate = parseIcsDate(dtEndMatch[1]);
    } else {
      // Duração padrão de 60 minutos se não especificado
      endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    }

    if (!endDate || endDate.getTime() <= startDate.getTime()) {
      endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
    }

    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    // Verifica sobreposição com a data alvo
    if (endMs > dayStartUtc && startMs < dayEndUtc) {
      const durationMinutes = Math.max(15, Math.round((endMs - startMs) / (60 * 1000)));
      busySlots.push({
        scheduled_at: startDate.toISOString(),
        duration_minutes: durationMinutes,
        status: 'google_calendar_busy',
      });
    }
  }

  return busySlots;
}

/**
 * Consulta o feed iCal do Google Calendar com cache em memória e fail-safe absoluto
 */
export async function fetchGoogleCalendarBusySlots(
  icalUrl: string,
  dateIso: string
): Promise<ExistingMeeting[]> {
  if (!icalUrl || !icalUrl.startsWith('http')) {
    return [];
  }

  try {
    let icsContent = '';
    const now = Date.now();
    const cached = icsCache.get(icalUrl);

    if (cached && now - cached.timestamp < ICS_CACHE_TTL_MS) {
      icsContent = cached.content;
    } else {
      // Fetch com timeout de 3.5 segundos para garantir velocidade da resposta do WhatsApp
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(icalUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'PluriFisio-Calendar-Sync/1.0',
          Accept: 'text/calendar, text/plain',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[calendar-utils] Falha ao consultar feed iCal (status ${response.status})`);
        return [];
      }

      icsContent = await response.text();
      icsCache.set(icalUrl, { content: icsContent, timestamp: now });
    }

    return parseIcsToBusySlots(icsContent, dateIso);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[calendar-utils] Erro defensivo ao buscar Google Calendar iCal: ${errorMsg}`);
    return [];
  }
}

