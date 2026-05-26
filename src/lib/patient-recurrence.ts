export const DEFAULT_PATIENT_RECURRENCE_TIME = "09:00";

export const PATIENT_RECURRENCE_WEEKDAY_OPTIONS = [
  { label: "Domingo", shortLabel: "Dom", value: 0 },
  { label: "Segunda-feira", shortLabel: "Seg", value: 1 },
  { label: "Terça-feira", shortLabel: "Ter", value: 2 },
  { label: "Quarta-feira", shortLabel: "Qua", value: 3 },
  { label: "Quinta-feira", shortLabel: "Qui", value: 4 },
  { label: "Sexta-feira", shortLabel: "Sex", value: 5 },
  { label: "Sábado", shortLabel: "Sáb", value: 6 },
] as const;

const RECURRENCE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const normalizePatientRecurringWeekdays = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((weekday) => Number(weekday))
        .filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6),
    ),
  ).sort((left, right) => left - right);
};

export const normalizePatientRecurringTime = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  return RECURRENCE_TIME_PATTERN.test(trimmed) ? trimmed : DEFAULT_PATIENT_RECURRENCE_TIME;
};

export const formatPatientRecurringWeekdays = (weekdays: number[]) => {
  const normalizedWeekdays = normalizePatientRecurringWeekdays(weekdays);

  return normalizedWeekdays
    .map((weekday) => PATIENT_RECURRENCE_WEEKDAY_OPTIONS.find((option) => option.value === weekday)?.shortLabel)
    .filter(Boolean)
    .join(", ");
};

export const getNextPatientRecurrenceDateTime = ({
  now = new Date(),
  time,
  weekdays,
}: {
  now?: Date;
  time: string;
  weekdays: number[];
}) => {
  const normalizedWeekdays = normalizePatientRecurringWeekdays(weekdays);

  if (normalizedWeekdays.length === 0) {
    return null;
  }

  const normalizedTime = normalizePatientRecurringTime(time);
  const [hours, minutes] = normalizedTime.split(":").map(Number);

  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + dayOffset);
    candidate.setHours(hours, minutes, 0, 0);

    if (normalizedWeekdays.includes(candidate.getDay()) && candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }

  return null;
};
