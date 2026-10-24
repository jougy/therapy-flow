/**
 * Módulo de Geolocalização e Gestão de Fuso Horário Global
 * Suporte a horários relativos e compatibilidade entre regiões clínicas.
 */

export interface GeoLocationResolution {
  timezone: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
}

export interface RelativeTimezoneComparison {
  localTime: string;
  originTime: string | null;
  originTimezoneName: string | null;
  hasDifference: boolean;
  tooltip: string | null;
}

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/**
 * Retorna o fuso horário IANA atual do dispositivo de forma instantânea/síncrona.
 * Fallback seguro para "America/Sao_Paulo".
 */
export function getDeviceTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && typeof tz === "string" && tz.trim().length > 0) {
      return tz.trim();
    }
  } catch {
    // Ignora erro de ambiente restrito ou SSR e aplica fallback seguro
  }
  return DEFAULT_TIMEZONE;
}

/**
 * Formata um identificador IANA de fuso horário em nome amigável para exibição (ex: "Manaus", "Sao Paulo").
 */
export function formatTimezoneCity(timeZone: string): string {
  if (!timeZone || typeof timeZone !== "string") return "";
  const parts = timeZone.trim().split("/");
  const cityOrRegion = parts[parts.length - 1] || timeZone;
  return cityOrRegion.replace(/_/g, " ");
}

/**
 * Formata o horário HH:mm em um determinado fuso horário IANA.
 * Retorna null caso o fuso seja inválido ou ocorra erro.
 */
function formatTimeInTimezone(date: Date, timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    }).format(date);
  } catch {
    return null;
  }
}

/**
 * Obtém de forma assíncrona as coordenadas de geolocalização e o fuso horário atual.
 * Possui timeout estrito (3500ms) e fallback gracioso sem propagar exceções.
 */
export async function resolveCurrentGeoLocation(): Promise<GeoLocationResolution> {
  const timezone = getDeviceTimezone();

  if (typeof window === "undefined" || !navigator || !navigator.geolocation) {
    return { timezone, lat: null, lng: null, city: null };
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      let settled = false;
      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("Geolocation timeout"));
        }
      }, 3500);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            resolve(pos);
          }
        },
        (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            reject(err);
          }
        },
        { enableHighAccuracy: false, timeout: 3500, maximumAge: 60000 }
      );
    });

    const lat = position?.coords?.latitude ?? null;
    const lng = position?.coords?.longitude ?? null;

    return {
      timezone,
      lat: typeof lat === "number" && Number.isFinite(lat) ? lat : null,
      lng: typeof lng === "number" && Number.isFinite(lng) ? lng : null,
      city: null,
    };
  } catch {
    return {
      timezone,
      lat: null,
      lng: null,
      city: null,
    };
  }
}

/**
 * Compara o horário de um evento entre o fuso de origem e o fuso de destino (padrão: dispositivo).
 * Retorna se há diferença relativa perceptível, os horários e o tooltip contextual.
 */
export function getRelativeTimezoneComparison(
  scheduledForUtc: string | Date,
  originTimezone?: string | null,
  targetTimezone?: string | null
): RelativeTimezoneComparison {
  const targetTz = targetTimezone?.trim() || getDeviceTimezone();
  const date = scheduledForUtc instanceof Date ? scheduledForUtc : new Date(scheduledForUtc);

  if (Number.isNaN(date.getTime())) {
    return {
      localTime: "--:--",
      originTime: null,
      originTimezoneName: null,
      hasDifference: false,
      tooltip: null,
    };
  }

  const localTime =
    formatTimeInTimezone(date, targetTz) ||
    formatTimeInTimezone(date, DEFAULT_TIMEZONE) ||
    "--:--";

  if (!originTimezone || !originTimezone.trim()) {
    return {
      localTime,
      originTime: null,
      originTimezoneName: null,
      hasDifference: false,
      tooltip: null,
    };
  }

  const cleanOrigin = originTimezone.trim();
  if (cleanOrigin === targetTz) {
    return {
      localTime,
      originTime: null,
      originTimezoneName: null,
      hasDifference: false,
      tooltip: null,
    };
  }

  const originTime = formatTimeInTimezone(date, cleanOrigin);
  if (!originTime) {
    return {
      localTime,
      originTime: null,
      originTimezoneName: null,
      hasDifference: false,
      tooltip: null,
    };
  }

  const hasDifference = originTime !== localTime;
  if (!hasDifference) {
    return {
      localTime,
      originTime: null,
      originTimezoneName: null,
      hasDifference: false,
      tooltip: null,
    };
  }

  const originTimezoneName = formatTimezoneCity(cleanOrigin);
  const tooltip = `Agendado para ${originTime} no fuso de ${originTimezoneName} (${localTime} no seu horário local)`;

  return {
    localTime,
    originTime,
    originTimezoneName,
    hasDifference: true,
    tooltip,
  };
}
