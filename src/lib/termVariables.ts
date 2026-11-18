/**
 * Utilitários de interpolação e extração de variáveis em Termos e Documentos Clínicos.
 * Suporta o formato <nome_variavel> (ex: <nome_paciente>, <cpf_paciente>, etc.)
 * e renderização de Carimbo de Assinatura Eletrônica (estilo Gov.br).
 */

export {
  SUGGESTED_TERM_VARIABLES,
  type TermVariableCategory,
  type TermVariableDefinition,
} from "./termVariablesCatalog";

export type SignatureRole = "owner" | "colaborador" | "paciente" | "responsavel";

export interface ElectronicSignatureData {
  fullName?: string | null;
  cpf?: string | null;
  councilRegistration?: string | null;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  globalUserId?: string | null;
  signatureWebpUrl?: string | null;
}

export interface InterpolateTermOptions {
  signatures?: Partial<Record<SignatureRole, ElectronicSignatureData | null | undefined>>;
  now?: Date;
  stampFormat?: "markdown" | "html";
}

/**
 * Conjunto de tags HTML padrão para evitar falso-positivo na extração de variáveis
 */
const STANDARD_HTML_TAGS = new Set([
  "a", "abbr", "address", "area", "article", "aside", "audio", "b", "base", "bdi", "bdo",
  "blockquote", "body", "br", "button", "canvas", "caption", "cite", "code", "col", "colgroup",
  "data", "datalist", "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed",
  "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6",
  "head", "header", "hgroup", "hr", "html", "i", "iframe", "img", "input", "ins", "kbd",
  "label", "legend", "li", "link", "main", "map", "mark", "math", "menu", "meta", "meter",
  "nav", "noscript", "object", "ol", "optgroup", "option", "output", "p", "picture", "portal",
  "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "script", "search", "section",
  "select", "slot", "small", "source", "span", "strong", "style", "sub", "summary", "sup",
  "svg", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time",
  "title", "tr", "track", "u", "ul", "var", "video", "wbr", "w:p", "w:r", "w:t",
]);

const SIGNATURE_VAR_TO_ROLE: Record<string, SignatureRole> = {
  assinatura_owner: "owner",
  assinatura_colaborador: "colaborador",
  assinatura_paciente: "paciente",
  assinatura_responsavel: "responsavel",
};

const PT_BR_MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/**
 * Formata horário no padrão hh:mm
 */
export function formatCurrentTimeHHMM(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Formata data no padrão DD/MM/AAAA
 */
export function formatDateShortBr(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formata data por extenso em português (ex: "16 de novembro de 2026")
 */
export function formatDateExtenso(date: Date = new Date()): string {
  const day = date.getDate();
  const monthName = PT_BR_MONTHS[date.getMonth()] || "";
  const year = date.getFullYear();
  return `${day} de ${monthName} de ${year}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getDictValue(values: Record<string, string>, name: string): string | undefined {
  const bracketed = `<${name}>`;
  if (values[bracketed] !== undefined) return values[bracketed];
  if (values[name] !== undefined) return values[name];
  return undefined;
}

function hasSignatureData(data: ElectronicSignatureData | null | undefined): data is ElectronicSignatureData {
  if (!data || typeof data !== "object") return false;
  return Boolean(
    data.fullName?.trim() ||
      data.cpf?.trim() ||
      data.councilRegistration?.trim() ||
      data.globalUserId?.trim() ||
      data.signatureWebpUrl?.trim()
  );
}

function isSignatureImageUrl(value: string): boolean {
  const trimmed = value.trim();
  return (
    /^data:image\//i.test(trimmed) ||
    /^https?:\/\//i.test(trimmed) ||
    /^blob:/i.test(trimmed)
  );
}

/**
 * Renderiza o Carimbo de Assinatura Eletrônica (estilo Gov.br)
 * contendo Nome completo, CPF, Conselho Regional (se possuir), Data, Horário,
 * Local, ID Global na Pluri (usr_xxx), aviso "Documento assinado virtualmente"
 * e a imagem .webp da assinatura quando disponível.
 */
export function renderElectronicSignatureStamp(
  data: ElectronicSignatureData,
  format: "markdown" | "html" = "markdown"
): string {
  const fullName = data.fullName?.trim() || "Não informado";
  const cpf = data.cpf?.trim() || "Não informado";
  const council = data.councilRegistration?.trim();
  const date = data.date?.trim() || formatDateShortBr();
  const time = data.time?.trim() || formatCurrentTimeHHMM();
  const location = data.location?.trim() || "Não informado";
  const globalUserId = data.globalUserId?.trim() || "Não informado";
  const imageUrl = data.signatureWebpUrl?.trim();

  if (format === "html") {
    const imgHtml = imageUrl
      ? `<div class="mb-2"><img src="${escapeHtml(imageUrl)}" alt="Assinatura de ${escapeHtml(fullName)}" style="max-height:64px;max-width:240px;object-fit:contain;" /></div>`
      : "";
    const councilHtml = council
      ? `<div><strong>Conselho Regional:</strong> ${escapeHtml(council)}</div>`
      : "";

    return [
      `<div data-signature-stamp="govbr" style="border:1px solid #16a34a;border-left:4px solid #15803d;border-radius:8px;padding:12px 14px;background:#f0fdf4;color:#0f172a;font-size:12px;line-height:1.45;margin:8px 0;">`,
      `<div style="font-weight:700;color:#15803d;margin-bottom:6px;">Documento assinado virtualmente</div>`,
      imgHtml,
      `<div><strong>Nome completo:</strong> ${escapeHtml(fullName)}</div>`,
      `<div><strong>CPF:</strong> ${escapeHtml(cpf)}</div>`,
      councilHtml,
      `<div><strong>Data:</strong> ${escapeHtml(date)} &bull; <strong>Horário:</strong> ${escapeHtml(time)}</div>`,
      `<div><strong>Local:</strong> ${escapeHtml(location)}</div>`,
      `<div><strong>ID Global na Pluri:</strong> <code>${escapeHtml(globalUserId)}</code></div>`,
      `</div>`,
    ]
      .filter(Boolean)
      .join("");
  }

  const lines: string[] = [
    `> **Documento assinado virtualmente**`,
    `>`,
  ];

  if (imageUrl) {
    lines.push(`> ![Assinatura de ${fullName}](${imageUrl})`);
    lines.push(`>`);
  }

  lines.push(`> **Nome completo:** ${fullName}  `);
  lines.push(`> **CPF:** ${cpf}  `);
  if (council) {
    lines.push(`> **Conselho Regional:** ${council}  `);
  }
  lines.push(`> **Data:** ${date} • **Horário:** ${time}  `);
  lines.push(`> **Local:** ${location}  `);
  lines.push(`> **ID Global na Pluri:** \`${globalUserId}\``);

  return lines.join("\n");
}

function buildFallbackSignatureFromValues(
  role: SignatureRole,
  values: Record<string, string>,
  now: Date
): ElectronicSignatureData {
  const roleDefaults: Record<SignatureRole, { nameKey: string; cpfKey: string; councilKey?: string }> = {
    owner: { nameKey: "nome_owner", cpfKey: "cpf_owner", councilKey: "crm_owner" },
    colaborador: { nameKey: "nome_colaborador", cpfKey: "cpf_colaborador", councilKey: "crp_crm_colaborador" },
    paciente: { nameKey: "nome_paciente", cpfKey: "cpf_paciente" },
    responsavel: { nameKey: "nome_responsavel", cpfKey: "cpf_responsavel" },
  };
  const mapping = roleDefaults[role];
  const location =
    getDictValue(values, "cidade_clinica") ||
    getDictValue(values, "endereco_clinica") ||
    getDictValue(values, "local_assinatura");

  return {
    fullName: getDictValue(values, mapping.nameKey),
    cpf: getDictValue(values, mapping.cpfKey),
    councilRegistration: mapping.councilKey ? getDictValue(values, mapping.councilKey) : undefined,
    date: getDictValue(values, "data_atual") || formatDateShortBr(now),
    time: getDictValue(values, "horario_atual") || formatCurrentTimeHHMM(now),
    location,
    globalUserId: getDictValue(values, `id_global_${role}`) || getDictValue(values, "id_global_usuario"),
  };
}

/**
 * Extrai todas as variáveis no formato `<nome_variavel>` presentes em um texto Markdown.
 * Ignora automaticamente tags HTML conhecidas (ex: <br>, <p>, <strong>).
 * Retorna lista única (sem duplicatas) das variáveis encontradas com o delimitador.
 */
export function extractVariablesFromMarkdown(md: string): string[] {
  if (!md || typeof md !== "string") return [];

  const regex = /<([a-zA-Z0-9_]+)>/g;
  const found = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(md)) !== null) {
    const rawTag = match[0];
    const innerName = match[1];

    if (STANDARD_HTML_TAGS.has(innerName.toLowerCase())) {
      continue;
    }

    found.add(rawTag);
  }

  return Array.from(found);
}

/**
 * Interpola todas as ocorrências de `<variavel>` com os valores fornecidos.
 * Aceita o dicionário com chaves contendo ou não os delimitadores `<>`:
 * ex: `{ "<nome_paciente>": "João" }` ou `{ "nome_paciente": "João" }`.
 * Suporta carimbo de assinatura eletrônica (estilo Gov.br) via `options.signatures`
 * ou valores de assinatura fornecidos no dicionário.
 * Mantém inalterada qualquer variável que não conste no dicionário ou que seja tag HTML válida.
 */
export function interpolateTermVariables(
  md: string,
  values: Record<string, string>,
  options: InterpolateTermOptions = {}
): string {
  if (!md) return "";
  const safeValues = values && typeof values === "object" ? values : {};
  const now = options.now ?? new Date();
  const stampFormat = options.stampFormat ?? "markdown";

  return md.replace(/<([a-zA-Z0-9_]+)>/g, (match, innerName: string) => {
    if (STANDARD_HTML_TAGS.has(innerName.toLowerCase())) {
      return match;
    }

    const signatureRole = SIGNATURE_VAR_TO_ROLE[innerName];
    if (signatureRole) {
      const explicitStamp = options.signatures?.[signatureRole];
      const dictVal = getDictValue(safeValues, innerName);

      if (hasSignatureData(explicitStamp)) {
        const fallback = buildFallbackSignatureFromValues(signatureRole, safeValues, now);
        return renderElectronicSignatureStamp(
          {
            ...fallback,
            ...explicitStamp,
            signatureWebpUrl:
              explicitStamp.signatureWebpUrl ||
              (dictVal && isSignatureImageUrl(dictVal) ? dictVal : undefined),
          },
          stampFormat
        );
      }

      if (dictVal !== undefined) {
        const trimmed = dictVal.trim();
        if (trimmed.startsWith("{")) {
          try {
            const parsed = JSON.parse(trimmed) as ElectronicSignatureData;
            if (hasSignatureData(parsed)) {
              const fallback = buildFallbackSignatureFromValues(signatureRole, safeValues, now);
              return renderElectronicSignatureStamp({ ...fallback, ...parsed }, stampFormat);
            }
          } catch {
            // Não é JSON válido; segue fluxo padrão
          }
        }

        if (isSignatureImageUrl(trimmed)) {
          const fallback = buildFallbackSignatureFromValues(signatureRole, safeValues, now);
          return renderElectronicSignatureStamp(
            { ...fallback, signatureWebpUrl: trimmed },
            stampFormat
          );
        }

        return dictVal;
      }

      return match;
    }

    const directVal = getDictValue(safeValues, innerName);
    if (directVal !== undefined) {
      return directVal;
    }

    if (innerName === "horario_atual" || innerName === "horario") {
      return formatCurrentTimeHHMM(now);
    }
    if (innerName === "data_extenso") {
      return formatDateExtenso(now);
    }
    if (innerName === "data_atual" || innerName === "data") {
      return formatDateShortBr(now);
    }

    return match;
  });
}
