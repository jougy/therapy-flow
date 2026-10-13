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

/**
 * Mapeia a profissão do usuário para a categoria correspondente de formulários comunitários.
 */
export function mapProfessionToFormCategory(profession: string | null | undefined): string | null {
  if (!profession) return null;
  const normalized = profession.toLowerCase().trim();

  if (normalized.includes("fisioterap") || normalized === "fisioterapia") {
    return "Fisioterapia";
  }
  if (normalized.includes("ocupacional") || normalized === "terapia ocupacional") {
    return "Terapia Ocupacional";
  }
  if (normalized.includes("psicolog") || normalized === "psicologia") {
    return "Psicologia";
  }
  if (normalized.includes("fono") || normalized === "fonoaudiologia") {
    return "Fonoaudiologia";
  }
  if (normalized.includes("nutri") || normalized === "nutrição" || normalized === "nutricao") {
    return "Nutrição";
  }
  if (normalized.includes("psiquiatr") || normalized === "psiquiatria") {
    return "Psiquiatria";
  }
  if (normalized.includes("neuropsicolog") || normalized === "neuropsicologia") {
    return "Neuropsicologia";
  }
  if (normalized.includes("pediatr") || normalized === "pediatria") {
    return "Pediatria";
  }

  return null;
}
