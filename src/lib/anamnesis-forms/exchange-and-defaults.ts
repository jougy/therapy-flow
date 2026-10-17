import { isPluriformBuffer, unpackPluriform } from "@/lib/pluriform/pluriform";
import { INPUT_LIMITS, sanitizeMultilineInput, sanitizeSingleLineInput } from "@/lib/input-security";
import type {
  AnamnesisTemplateExchangeKind,
  AnamnesisTemplateExchangePayload,
  AnamnesisTemplateSchema,
} from "./types";
import { ANAMNESIS_TEMPLATE_IMPORT_MAX_BYTES } from "./types";
import {
  compactAnamnesisTemplateSchema,
  isAnamnesisTemplateSchema,
  sanitizeAnamnesisTemplateSchema,
} from "./sanitizers";

export const DEFAULT_ANAMNESIS_TEMPLATE_SCHEMA: AnamnesisTemplateSchema = [
  {
    id: "section_main",
    label: "Anamnese inicial",
    type: "section",
    helpText: "Campos obrigatórios da primeira parte da anamnese.",
  },
  {
    groupKey: "section_main",
    id: "queixa",
    label: "Queixa principal",
    type: "long_text",
    required: true,
    showInPatientList: true,
    systemKey: "queixa",
  },
  {
    groupKey: "section_main",
    id: "sintomas",
    label: "Sintomas",
    type: "long_text",
    showInPatientList: true,
    systemKey: "sintomas",
  },
  {
    groupKey: "section_main",
    id: "pain_score",
    label: "Nota da dor",
    type: "slider",
    min: 0,
    max: 10,
    showInPatientList: false,
    systemKey: "pain_score",
  },
  {
    groupKey: "section_main",
    id: "complexity_score",
    label: "Nota de complexidade",
    type: "slider",
    min: 0,
    max: 10,
    showInPatientList: false,
    systemKey: "complexity_score",
  },
  {
    groupKey: "section_main",
    id: "observacoes",
    label: "Observações",
    type: "long_text",
    showInPatientList: true,
    systemKey: "observacoes",
  },
];


export const createDefaultTemplateSchema = () =>
  DEFAULT_ANAMNESIS_TEMPLATE_SCHEMA.map((field, index) => ({
    ...field,
    id: `${field.id}_${index}`,
  }));

const slugifyTemplateExchangeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

export const buildAnamnesisTemplateExchangeFileName = (
  kind: AnamnesisTemplateExchangeKind,
  name: string,
  extension: "pluriform" | "json" = "pluriform"
) => {
  const slug = slugifyTemplateExchangeName(name) || (kind === "base" ? "bloco-padrao" : "ficha");
  return `pronto-health-fisio-modelo-${slug}.${extension}`;
};

export const buildAnamnesisTemplateExchangePayload = ({
  description,
  exportedAt = new Date().toISOString(),
  kind,
  name,
  schema,
}: {
  description?: string | null;
  exportedAt?: string;
  kind: AnamnesisTemplateExchangeKind;
  name: string;
  schema: AnamnesisTemplateSchema;
}): AnamnesisTemplateExchangePayload => ({
  exportedAt,
  format: "pronto-health-fisio.anamnesis-template",
  kind,
  template: {
    description: sanitizeMultilineInput(description ?? "", INPUT_LIMITS.formDescription).trim(),
    name: sanitizeSingleLineInput(name, INPUT_LIMITS.formTemplateName).trim(),
    schema: sanitizeAnamnesisTemplateSchema(schema),
  },
  version: 1,
});

const isAnamnesisTemplateExchangePayload = (value: unknown): value is AnamnesisTemplateExchangePayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AnamnesisTemplateExchangePayload>;

  return (
    candidate.format === "pronto-health-fisio.anamnesis-template" &&
    candidate.version === 1 &&
    (candidate.kind === "base" || candidate.kind === "template") &&
    typeof candidate.exportedAt === "string" &&
    !!candidate.template &&
    typeof candidate.template === "object" &&
    typeof candidate.template.name === "string" &&
    typeof candidate.template.description === "string" &&
    isAnamnesisTemplateSchema(candidate.template.schema)
  );
};

export const parseAnamnesisTemplateExchangePayload = async (
  raw: string | ArrayBuffer | Uint8Array
): Promise<AnamnesisTemplateExchangePayload> => {
  let parsed: unknown;

  if (typeof raw !== "string") {
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    if (bytes.byteLength > ANAMNESIS_TEMPLATE_IMPORT_MAX_BYTES) {
      throw new Error("Arquivo de modelo muito grande");
    }
    if (isPluriformBuffer(bytes)) {
      parsed = await unpackPluriform(bytes);
    } else {
      // Tenta decodificar como texto UTF-8 JSON caso tenham passado ArrayBuffer de JSON
      try {
        const text = new TextDecoder().decode(bytes);
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Arquivo de modelo inválido");
      }
    }
  } else {
    if (raw.length > ANAMNESIS_TEMPLATE_IMPORT_MAX_BYTES) {
      throw new Error("Arquivo de modelo muito grande");
    }

    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Arquivo de modelo inválido");
    }
  }

  // Permite tanto o envelope oficial (format: "pronto-health-fisio.anamnesis-template")
  // quanto exportações/uploads JSON de templates comunitários ou esquemas diretos de campos.
  let candidatePayload = parsed;
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, any>;
    if (!isAnamnesisTemplateExchangePayload(parsed)) {
      if (Array.isArray(obj) && isAnamnesisTemplateSchema(obj)) {
        candidatePayload = {
          exportedAt: new Date().toISOString(),
          format: "pronto-health-fisio.anamnesis-template",
          kind: "template",
          template: {
            description: "",
            name: "Formulário Importado",
            schema: obj,
          },
          version: 1,
        };
      } else if (
        (obj.schema || obj.fields) &&
        (isAnamnesisTemplateSchema(obj.schema) || isAnamnesisTemplateSchema(obj.fields))
      ) {
        const schema = isAnamnesisTemplateSchema(obj.schema) ? obj.schema : obj.fields;
        candidatePayload = {
          exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : new Date().toISOString(),
          format: "pronto-health-fisio.anamnesis-template",
          kind: obj.kind === "base" ? "base" : "template",
          template: {
            description: typeof obj.description === "string" ? obj.description : "",
            name: typeof obj.name === "string" ? obj.name : typeof obj.title === "string" ? obj.title : "Formulário Importado",
            schema,
          },
          version: 1,
        };
      } else if (
        obj.template &&
        typeof obj.template === "object" &&
        isAnamnesisTemplateSchema(obj.template.schema)
      ) {
        candidatePayload = {
          exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : new Date().toISOString(),
          format: "pronto-health-fisio.anamnesis-template",
          kind: obj.kind === "base" ? "base" : "template",
          template: {
            description: typeof obj.template.description === "string" ? obj.template.description : "",
            name: typeof obj.template.name === "string" ? obj.template.name : typeof obj.template.title === "string" ? obj.template.title : "Formulário Importado",
            schema: obj.template.schema,
          },
          version: 1,
        };
      }
    }
  }

  if (!isAnamnesisTemplateExchangePayload(candidatePayload)) {
    throw new Error("Arquivo de modelo inválido");
  }

  return {
    ...candidatePayload,
    template: {
      ...candidatePayload.template,
      description: sanitizeMultilineInput(candidatePayload.template.description, INPUT_LIMITS.formDescription).trim(),
      name: sanitizeSingleLineInput(candidatePayload.template.name, INPUT_LIMITS.formTemplateName).trim(),
      schema: sanitizeAnamnesisTemplateSchema(candidatePayload.template.schema),
    },
  };
};

