import { format, isValid, parse } from "date-fns";

export const DATE_FIELD_PLACEHOLDER = "DD/MM/YYYY";

export const normalizeDateInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export const formatDateValue = (value: Date) => format(value, "dd/MM/yyyy");

export const parseDateInput = (value: string) => {
  const normalized = normalizeDateInput(value);

  if (normalized.length !== 10) {
    return null;
  }

  const parsed = parse(normalized, "dd/MM/yyyy", new Date());

  if (!isValid(parsed)) {
    return null;
  }

  return format(parsed, "dd/MM/yyyy") === normalized ? parsed : null;
};
