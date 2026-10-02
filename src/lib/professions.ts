export interface ProfessionOption {
  value: string;
  label: string;
  councilName: string;
  councilPrefix: string;
  councilPlaceholder: string;
}

export const SUPPORTED_PROFESSIONS: readonly ProfessionOption[] = [
  {
    value: "fisioterapeuta",
    label: "Fisioterapeuta",
    councilName: "CREFITO",
    councilPrefix: "CREFITO",
    councilPlaceholder: "Ex: 123456-F",
  },
  {
    value: "terapeuta_ocupacional",
    label: "Terapeuta Ocupacional",
    councilName: "CREFITO",
    councilPrefix: "CREFITO",
    councilPlaceholder: "Ex: 123456-TO",
  },
] as const;

export type SupportedProfession = typeof SUPPORTED_PROFESSIONS[number]["value"];

export function getProfessionOption(value: string | null | undefined): ProfessionOption | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().trim();
  return SUPPORTED_PROFESSIONS.find(
    (p) => p.value === normalized || p.label.toLowerCase() === normalized
  );
}

export function getCouncilNameForProfession(value: string | null | undefined): string {
  const opt = getProfessionOption(value);
  return opt ? opt.councilName : "CREFITO";
}
