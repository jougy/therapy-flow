import {
  ANAMNESIS_TEMPLATE_IMPORT_MAX_BYTES,
  buildAnamnesisTemplateExchangeFileName,
  buildAnamnesisTemplateExchangePayload,
  parseAnamnesisTemplateExchangePayload,
} from "@/lib/anamnesis-forms";
import { packPluriform } from "@/lib/pluriform/pluriform";
import { INPUT_LIMITS, sanitizeMultilineInput, sanitizeSingleLineInput } from "@/lib/input-security";
import { castDesignLabSchema, type DesignLabTemplateSchema } from "../types";

export interface ExportDraftModelParams {
  templateName: string;
  templateDescription: string;
  templateFields: DesignLabTemplateSchema;
  isBase: boolean;
}

export async function exportDraftModelAsPluriform({
  templateName,
  templateDescription,
  templateFields,
  isBase,
}: ExportDraftModelParams): Promise<void> {
  if (!templateFields || templateFields.length === 0) {
    throw new Error("O formulário não possui campos cadastrados.");
  }

  const payload = buildAnamnesisTemplateExchangePayload({
    description: templateDescription,
    kind: isBase ? "base" : "template",
    name: templateName,
    schema: templateFields,
  });

  const binaryBytes = await packPluriform(payload);
  const blob = new Blob([binaryBytes.buffer as ArrayBuffer], { type: "application/x-pluriform" });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = buildAnamnesisTemplateExchangeFileName(isBase ? "base" : "template", templateName, "pluriform");
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export interface ImportedDraftModelResult {
  name: string;
  description: string;
  fields: DesignLabTemplateSchema;
}

export async function importDraftModelFromFile(file: File): Promise<ImportedDraftModelResult> {
  if (file.size > ANAMNESIS_TEMPLATE_IMPORT_MAX_BYTES) {
    throw new Error("O arquivo excede o limite de tamanho permitido de 256KB.");
  }

  const buffer = await file.arrayBuffer();
  const imported = await parseAnamnesisTemplateExchangePayload(buffer);

  return {
    name: sanitizeSingleLineInput(imported.template.name, INPUT_LIMITS.formTemplateName),
    description: sanitizeMultilineInput(imported.template.description, INPUT_LIMITS.formDescription),
    fields: castDesignLabSchema(imported.template.schema),
  };
}
