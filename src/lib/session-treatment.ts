import type { Json } from "@/integrations/supabase/types";

export interface TreatmentBlock {
  duration: string;
  frequency: string;
  id: string;
  instructions: string;
  name: string;
  repetitions: string;
  series: string;
}

export interface TreatmentState {
  blocks: TreatmentBlock[];
  generalGuidance: string;
}

const isJsonObject = (value: Json | null): value is Record<string, Json | undefined> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJsonString = (value: Json | undefined) => (typeof value === "string" ? value.trim() : "");

const readJsonStringArray = (value: Json | undefined): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const normalizeBlock = (value: Json, index: number): TreatmentBlock | null => {
  if (!isJsonObject(value)) {
    return null;
  }

  return {
    duration: readJsonString(value.duration),
    frequency: readJsonString(value.frequency),
    id: readJsonString(value.id) || `treatment-block-${index + 1}`,
    instructions: readJsonString(value.instructions),
    name: readJsonString(value.name),
    repetitions: readJsonString(value.repetitions),
    series: readJsonString(value.series),
  };
};

const blockHasMeaningfulContent = (block: TreatmentBlock) =>
  [block.name, block.frequency, block.duration, block.series, block.repetitions, block.instructions].some(
    (value) => value.trim().length > 0
  );

const joinNonEmpty = (parts: string[]) => parts.filter(Boolean).join("\n\n");

export const createTreatmentBlock = (index: number): TreatmentBlock => ({
  duration: "",
  frequency: "",
  id: `treatment-block-${index + 1}`,
  instructions: "",
  name: "",
  repetitions: "",
  series: "",
});

export const readTreatmentState = (value: Json | null): TreatmentState => {
  if (isJsonObject(value) && Array.isArray(value.blocks)) {
    const blocks = value.blocks
      .map((block, index) => normalizeBlock(block, index))
      .filter((block): block is TreatmentBlock => !!block);

    return {
      blocks,
      generalGuidance: readJsonString(value.general_guidance),
    };
  }

  if (isJsonObject(value)) {
    const fallbackName = readJsonStringArray(value.techniques).join(", ");
    const fallbackDescription = readJsonString(value.descricao);
    const generalGuidance = readJsonString(value.orientacoes);
    const legacyBlock =
      fallbackName || fallbackDescription
        ? [
            {
              ...createTreatmentBlock(0),
              instructions: fallbackDescription,
              name: fallbackName || "Tratamento anterior",
            },
          ]
        : [];

    return {
      blocks: legacyBlock,
      generalGuidance,
    };
  }

  return {
    blocks: [],
    generalGuidance: "",
  };
};

export const buildTreatmentPayload = ({ blocks, generalGuidance }: TreatmentState) => {
  const normalizedBlocks = blocks
    .map((block, index) => ({
      duration: block.duration.trim(),
      frequency: block.frequency.trim(),
      id: block.id || `treatment-block-${index + 1}`,
      instructions: block.instructions.trim(),
      name: block.name.trim(),
      repetitions: block.repetitions.trim(),
      series: block.series.trim(),
    }))
    .filter(blockHasMeaningfulContent);

  const normalizedGuidance = generalGuidance.trim();

  if (normalizedBlocks.length === 0 && !normalizedGuidance) {
    return null;
  }

  return {
    blocks: normalizedBlocks,
    general_guidance: normalizedGuidance,
  };
};

export const formatTreatmentSummary = ({ blocks, generalGuidance }: TreatmentState) => {
  const blockLines = blocks
    .filter(blockHasMeaningfulContent)
    .map((block) =>
      [
        block.name.trim(),
        block.frequency.trim(),
        block.duration.trim(),
        block.series.trim() ? `${block.series.trim()} series` : "",
        block.repetitions.trim() ? `${block.repetitions.trim()} repeticoes` : "",
        block.instructions.trim(),
      ]
        .filter(Boolean)
        .join(" | ")
    );

  return joinNonEmpty([
    ...blockLines,
    generalGuidance.trim() ? `Orientacoes gerais: ${generalGuidance.trim()}` : "",
  ]);
};
