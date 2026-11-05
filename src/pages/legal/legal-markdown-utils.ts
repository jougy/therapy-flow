export interface ParsedHeading {
  id: string;
  title: string;
  level: number;
}

/** Transforma um título em slug URL-friendly sem acentos */
export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
};

/**
 * Limpa YAML frontmatter (---\n...\n---) e metadados redundantes
 */
export const cleanDocumentMarkdown = (content: string): string => {
  let cleaned = content.replace(/^---[\s\S]*?---\s*/, "");
  cleaned = cleaned.replace(/^#\s+[^\r\n]+[\r\n]*/, "");
  cleaned = cleaned.replace(/^\s*\*\*Última atualização:\*\*.*[\r\n]*/gi, "");
  cleaned = cleaned.replace(/^\s*\*\*Versão:\*\*.*[\r\n]*/gi, "");
  cleaned = cleaned.replace(/^\s*---+\s*[\r\n]*/, "");
  return cleaned.trimStart();
};

/**
 * Extrai a lista de tópicos de um markdown gerado.
 * Quando maxLevel = 2 (ou includeSubsections = false), ignora subtópicos como "2.1", "2.2" (nível ###),
 * mantendo apenas os tópicos principais inteiros ("1", "2", "3", etc.).
 */
export const extractHeadings = (
  markdown: string,
  options?: { maxLevel?: number }
): ParsedHeading[] => {
  const maxLevel = options?.maxLevel ?? 3;
  const lines = markdown.split("\n");
  const headings: ParsedHeading[] = [];
  const usedIds = new Set<string>();

  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (!match) continue;

    const level = match[1].length;
    // Se o nível for maior que o máximo desejado (ex.: ### quando maxLevel = 2), ignora no sumário
    if (level > maxLevel) continue;

    // Remove marcações markdown inline do título (bold, links, etc.)
    const rawTitle = match[2].replace(/[*_`[\]]/g, "").trim();

    // Se estiver filtrando subtópicos e o título começar explicitamente com número decimal (ex: 2.1, 7.3), ignora
    if (maxLevel <= 2 && /^\d+\.\d+/.test(rawTitle)) {
      continue;
    }

    let baseId = slugify(rawTitle);
    if (!baseId) baseId = `secao-${headings.length + 1}`;

    let id = baseId;
    let counter = 1;
    while (usedIds.has(id)) {
      id = `${baseId}-${counter}`;
      counter++;
    }
    usedIds.add(id);

    headings.push({ id, title: rawTitle, level });
  }

  return headings;
};
