import type { ClinicalPortfolioItem, ClinicalPortfolioMetrics } from "@/types/clinicalPortfolio";

/**
 * Transforms a patient's full name into an LGPD-compliant pseudonym with initials.
 * Example: "Maria Rita Silva" -> "Paciente M. R. S."
 */
export function formatPatientPseudonym(fullName?: string | null): string {
  if (!fullName || !fullName.trim()) {
    return "Paciente Anônimo";
  }

  const cleaned = fullName.trim();
  if (cleaned.startsWith("Paciente ") && cleaned.includes(".")) {
    return cleaned;
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "Paciente Anônimo";
  }

  const initials = parts.map((part) => part[0].toUpperCase() + ".").join(" ");
  return `Paciente ${initials}`;
}

/**
 * Formats age and gender into a standardized demographic badge label.
 * Example: "34 anos • Feminino"
 */
export function formatDemographics(
  age?: number | null,
  gender?: string | null,
  dateOfBirth?: string | null
): string {
  const parts: string[] = [];

  let resolvedAge: number | null = typeof age === "number" && !isNaN(age) && age > 0 ? age : null;

  if (resolvedAge === null && dateOfBirth) {
    try {
      const birth = new Date(dateOfBirth);
      if (!isNaN(birth.getTime())) {
        const today = new Date();
        let calc = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
          calc--;
        }
        if (calc >= 0 && calc <= 130) {
          resolvedAge = calc;
        }
      }
    } catch {
      // Ignore date parsing issues
    }
  }

  if (typeof resolvedAge === "number" && resolvedAge > 0) {
    parts.push(`${resolvedAge} ${resolvedAge === 1 ? "ano" : "anos"}`);
  }

  if (gender && gender.trim()) {
    const g = gender.trim().toLowerCase();
    const formattedGender =
      g === "feminino" || g === "f"
        ? "Feminino"
        : g === "masculino" || g === "m"
        ? "Masculino"
        : gender.trim();
    parts.push(formattedGender);
  }

  return parts.length > 0 ? parts.join(" • ") : "Perfil não informado";
}

/**
 * Sanitizes sensitive personal identification data (CPF, phone, email) from clinical notes.
 * Defense-in-depth sanitization for LGPD compliance.
 */
export function sanitizeClinicalText(text?: string | null): string {
  if (!text) return "";

  return text
    // Mask CPFs (xxx.xxx.xxx-xx or 11 digits)
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF OMITIDO - LGPD]")
    // Mask Email addresses
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[E-MAIL OMITIDO - LGPD]")
    // Mask Phone numbers (e.g., (11) 98765-4321, 11987654321, etc.)
    .replace(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\d{4}|\d{4})[-\s]?\d{4}\b/g, "[CONTATO OMITIDO - LGPD]");
}

/**
 * Calculates aggregated metrics across technical portfolio items.
 */
export function calculatePortfolioMetrics(items: ClinicalPortfolioItem[]): ClinicalPortfolioMetrics {
  const totalAttendances = items.length;

  const clinicSet = new Set<string>();
  let totalPain = 0;
  let countPain = 0;
  let totalComplexity = 0;
  let countComplexity = 0;

  for (const item of items) {
    if (item.clinic_id) {
      clinicSet.add(item.clinic_id);
    }

    if (typeof item.pain_score === "number" && !isNaN(item.pain_score)) {
      totalPain += item.pain_score;
      countPain += 1;
    }

    if (typeof item.complexity_score === "number" && !isNaN(item.complexity_score)) {
      totalComplexity += item.complexity_score;
      countComplexity += 1;
    }
  }

  return {
    totalAttendances,
    totalClinics: clinicSet.size,
    averagePainScore: countPain > 0 ? Number((totalPain / countPain).toFixed(1)) : null,
    averageComplexityScore: countComplexity > 0 ? Number((totalComplexity / countComplexity).toFixed(1)) : null,
  };
}

/**
 * Formats session date and time for friendly display.
 */
export function formatSessionDateTime(dateString?: string | null): string {
  if (!dateString) return "Data não informada";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  } catch {
    return dateString;
  }
}
