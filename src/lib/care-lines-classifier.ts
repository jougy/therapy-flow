import type { Database } from "@/integrations/supabase/types";

export type PatientGroup = Database["public"]["Tables"]["patient_groups"]["Row"];

export interface CareLinePresetDefinition {
  id: string;
  name: string;
  label: string;
  color: string;
  keywords: string[];
  description: string;
}

export const CARE_LINE_PRESETS: CareLinePresetDefinition[] = [
  {
    id: "coluna",
    name: "Coluna / Lombalgia",
    label: "Coluna / Lombalgia",
    color: "blue",
    keywords: [
      "lombar",
      "lombalgia",
      "ciatico",
      "ciático",
      "cervical",
      "cervicalgia",
      "hernia",
      "hérnia",
      "coluna",
      "postura",
      "escoliose",
      "dorsal",
      "costas",
      "lombar",
    ],
    description: "Tratamentos voltados para dor nas costas, hérnias e postura.",
  },
  {
    id: "ortopedia",
    name: "Reabilitação Ortopédica",
    label: "Reabilitação Ortopédica",
    color: "orange",
    keywords: [
      "ortopedica",
      "ortopédica",
      "fratura",
      "pos-operatorio",
      "pós-operatório",
      "cirurgia",
      "protese",
      "prótese",
      "entorse",
      "joelho",
      "ombro",
      "manguito",
      "tornozelo",
      "lca",
      "menisco",
      "tendinite",
      "bursite",
      "quadril",
    ],
    description: "Recuperação de lesões articulares, cirurgias e traumas ortopédicos.",
  },
  {
    id: "pelvica",
    name: "Fisioterapia Pélvica",
    label: "Fisioterapia Pélvica",
    color: "pink",
    keywords: [
      "pelvica",
      "pélvica",
      "assoalho pelvico",
      "assoalho pélvico",
      "incontinencia",
      "incontinência",
      "gestacao",
      "gestação",
      "gestante",
      "parto",
      "pos-parto",
      "pós-parto",
      "diastase",
      "diástase",
      "prolapso",
      "vaginismo",
      "bexiga",
    ],
    description: "Saúde íntima, preparação para parto, pós-parto e incontinência.",
  },
  {
    id: "pilates",
    name: "Pilates Clínico",
    label: "Pilates Clínico",
    color: "amber",
    keywords: [
      "pilates",
      "fortalecimento",
      "flexibilidade",
      "alongamento",
      "estabilizacao",
      "estabilização",
      "core",
      "tonus",
      "reeducacao postural",
      "reeducação postural",
    ],
    description: "Aulas de condicionamento físico direcionado e reabilitação postural.",
  },
  {
    id: "saude_mental",
    name: "Ansiedade & Saúde Mental",
    label: "Ansiedade & Saúde Mental",
    color: "purple",
    keywords: [
      "ansiedade",
      "estresse",
      "stress",
      "panico",
      "pânico",
      "insonia",
      "insônia",
      "burnout",
      "depressao",
      "depressão",
      "esgotamento",
      "angustia",
      "angústia",
      "emocional",
    ],
    description: "Acompanhamento de estresse, ansiedade e suporte emocional.",
  },
  {
    id: "dor_cronica",
    name: "Dores Crônicas & Fibromialgia",
    label: "Dores Crônicas & Fibromialgia",
    color: "red",
    keywords: [
      "fibromialgia",
      "dor cronica",
      "dor crônica",
      "dor difusa",
      "enxaqueca",
      "cefaleia",
      "cefaléia",
      "artrite",
      "artrose",
      "fadiga",
      "reumatismo",
    ],
    description: "Manejo da dor persistente, modulação e qualidade de vida.",
  },
  {
    id: "avaliacao_inicial",
    name: "Avaliação Inicial",
    label: "Avaliação Inicial",
    color: "emerald",
    keywords: [
      "avaliacao inicial",
      "avaliação inicial",
      "primeira consulta",
      "triagem",
      "anamnese inicial",
      "primeira vez",
    ],
    description: "Primeiro contato e mapeamento do quadro geral do paciente.",
  },
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export interface SuggestedCareLineResult {
  preset: CareLinePresetDefinition;
  matchedKeyword: string;
  matchedExistingGroup?: PatientGroup;
  confidenceScore: number;
}

/**
 * Detecta de forma inteligente e rápida se o texto da queixa principal ou anotação
 * contém termos associados a uma Linha de Cuidado recomendada.
 */
export function detectSuggestedCareLine(
  inputText: string | undefined | null,
  currentGroupId: string | null,
  existingGroups: PatientGroup[] = []
): SuggestedCareLineResult | null {
  if (!inputText || inputText.trim().length < 3) {
    return null;
  }

  const normalizedInput = normalizeText(inputText);

  // 1. Verifica se alguma linha existente no paciente já corresponde diretamente
  for (const group of existingGroups) {
    const normGroupName = normalizeText(group.name);
    if (normGroupName.length >= 3 && normalizedInput.includes(normGroupName)) {
      // Se o usuário já está com esse grupo selecionado, não precisa sugerir
      if (currentGroupId === group.id) {
        return null;
      }

      // Encontra um preset compatível se houver
      const matchedPreset = CARE_LINE_PRESETS.find(
        (p) => normalizeText(p.name) === normGroupName || normGroupName.includes(normalizeText(p.id))
      ) || {
        id: group.id,
        name: group.name,
        label: group.name,
        color: group.color || "blue",
        keywords: [normGroupName],
        description: `Linha de cuidado existente: ${group.name}`,
      };

      return {
        preset: matchedPreset,
        matchedKeyword: group.name,
        matchedExistingGroup: group,
        confidenceScore: 0.95,
      };
    }
  }

  // 2. Busca por palavras-chave dos presets catalogados
  let bestMatch: SuggestedCareLineResult | null = null;
  let highestScore = 0;

  for (const preset of CARE_LINE_PRESETS) {
    // Verifica se já está selecionado
    const existingMatchingGroup = existingGroups.find(
      (g) => normalizeText(g.name) === normalizeText(preset.name)
    );

    if (currentGroupId && existingMatchingGroup && currentGroupId === existingMatchingGroup.id) {
      continue;
    }

    for (const keyword of preset.keywords) {
      const normKeyword = normalizeText(keyword);
      // Busca por palavra inteira ou substring relevante
      const regex = new RegExp(`\\b${normKeyword}\\b`, "i");
      const matched = regex.test(normalizedInput) || normalizedInput.includes(normKeyword);

      if (matched) {
        // Pontuação baseada no tamanho do match
        const score = normKeyword.length > 5 ? 0.9 : 0.75;
        if (score > highestScore) {
          highestScore = score;
          bestMatch = {
            preset,
            matchedKeyword: keyword,
            matchedExistingGroup: existingMatchingGroup,
            confidenceScore: score,
          };
        }
      }
    }
  }

  return bestMatch;
}
