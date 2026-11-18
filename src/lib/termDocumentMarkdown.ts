/**
 * Utilitário de Estruturação Inteligente de Texto para Markdown
 *
 * Transforma texto bruto (extraído de PDFs, OCR, DOCs legados ou texto puro)
 * em Markdown limpo, sem quebras de linha no meio de parágrafos,
 * estruturando títulos, cláusulas, artigos e listas.
 */

/**
 * Sugere um título amigável e formatado a partir do nome do arquivo
 */
export function suggestTitleFromFilename(filename: string): string {
  if (!filename) return "Novo Modelo de Documento";

  // Remove extensão do arquivo
  const withoutExt = filename.replace(/\.[^/.]+$/, "").trim();

  // Substitui hífens e underscores por espaços
  const withSpaces = withoutExt.replace(/[-_]+/g, " ");

  // Normaliza e capitaliza palavras
  const words = withSpaces.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Novo Modelo de Documento";

  const lowerPrepositions = new Set([
    "de", "da", "do", "das", "dos",
    "em", "no", "na", "nos", "nas",
    "e", "ou", "para", "por", "com",
    "a", "o", "as", "os", "ao", "aos",
  ]);

  const capitalized = words.map((word, index) => {
    const lower = word.toLowerCase();
    // Acrônimos comuns mantidos em maiúsculas
    if (/^(tcle|lgpd|cfm|rg|cpf|cnpj|sus)$/i.test(word)) {
      return word.toUpperCase();
    }
    // Preposições permanecem minúsculas, exceto na primeira palavra
    if (index > 0 && lowerPrepositions.has(lower)) {
      return lower;
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return capitalized.join(" ");
}

/**
 * Converte texto bruto em Markdown bem formatado e estruturado:
 * - Identifica títulos principais (# Título)
 * - Identifica cláusulas, artigos e subtítulos (## Cláusula, ## Art., ## 1. Subtítulo)
 * - Converte marcadores de lista (•, ▪, -, *, a), i)) em listas Markdown (- item)
 * - Junta linhas quebradas no meio da frase em parágrafos contínuos
 * - Preserva variáveis no padrão <nome_variavel>
 */
export function structureTextToMarkdown(rawText: string): string {
  if (!rawText || !rawText.trim()) {
    return "";
  }

  // 1. Normalização de quebras de linha (\r\n e \r para \n)
  let text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // De-hifenização de palavras quebradas por fim de linha (ex: "responsa-\nvel" -> "responsavel")
  text = text.replace(/(\b[a-zA-ZÀ-ÿ]+)-\n([a-zA-ZÀ-ÿ]+\b)/g, "$1$2");

  const rawLines = text.split("\n").map((l) => l.trim());

  const blocks: string[] = [];
  let currentParagraphLines: string[] = [];
  let hasMainTitle = false;

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const paragraph = currentParagraphLines.join(" ");
      blocks.push(paragraph);
      currentParagraphLines = [];
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    if (!line) {
      flushParagraph();
      continue;
    }

    // 1. Já é cabeçalho Markdown existente (#, ##, ###, etc.)
    if (/^#{1,6}\s+/.test(line)) {
      flushParagraph();
      blocks.push(line);
      if (/^#\s+/.test(line)) {
        hasMainTitle = true;
      }
      continue;
    }

    // 2. Tópicos e listas:
    // Símbolos: •, ▪, ●, ○, ■, –, —, *, -
    // Alfanuméricos: a), b), 1), i), ii), etc.
    const bulletMatch = line.match(
      /^([•▪●○■–—*]|-|\([a-zA-Z0-9]+\)|[a-zA-Z]\)|(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)\))\s*(.*)/i
    );
    if (bulletMatch) {
      flushParagraph();
      const marker = bulletMatch[1];
      const content = bulletMatch[2].trim();
      if (/^[•▪●○■–—*]$/.test(marker) || marker === "-") {
        blocks.push(`- ${content}`);
      } else {
        blocks.push(`- ${marker} ${content}`);
      }
      continue;
    }

    // 3. Cláusulas e Artigos jurídicos (ex: CLÁUSULA PRIMEIRA, CLÁUSULA 1ª, Art. 1º, Artigo 14)
    const isClause = /^(CL[AÁ]USULA|ARTIGO|ART\.?)(\s+|$)/i.test(line);
    if (isClause) {
      flushParagraph();
      blocks.push(`## ${line}`);
      continue;
    }

    // Parágrafos legais secundários (ex: Parágrafo Único, § 1º)
    const isSubLegal = /^(PAR[AÁ]GRAFO|\u00A7)(\s+|$)/i.test(line);
    if (isSubLegal) {
      flushParagraph();
      blocks.push(`### ${line}`);
      continue;
    }

    // 4. Seções numeradas (ex: "1.1 Do Objeto", "1. OBJETO")
    const subSecMatch = line.match(/^(\d+\.\d+(?:\.\d+)*)\s+(.+)$/);
    if (subSecMatch && line.length < 90) {
      flushParagraph();
      blocks.push(`### ${line}`);
      continue;
    }

    const secMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (
      secMatch &&
      line.length < 80 &&
      (!/[.?!]$/.test(line) || /^[A-Z0-9\s.,-]+$/.test(secMatch[2]))
    ) {
      flushParagraph();
      blocks.push(`## ${line}`);
      continue;
    }

    // 5. Títulos Principais:
    // Primeira linha não vazia ou linhas curtas em CAIXA ALTA
    const isAllCaps =
      line.length > 3 &&
      line.length < 80 &&
      line === line.toUpperCase() &&
      /[A-ZÀ-ÿ]{3,}/.test(line) &&
      !/[.?!]$/.test(line);

    const isDocumentTitleType =
      /^(TERMO|CONTRATO|DECLARA[CÇ][AÃ]O|ACORDO|CONSENTIMENTO|POL[IÍ]TICA)\b/i.test(
        line
      );

    if (!hasMainTitle && (isDocumentTitleType || (isAllCaps && i === 0))) {
      flushParagraph();
      blocks.push(`# ${line}`);
      hasMainTitle = true;
      continue;
    }

    if (isAllCaps) {
      flushParagraph();
      blocks.push(`## ${line}`);
      continue;
    }

    // 6. Subtítulo curto sem ponto final no início de seção
    const prevLineEmpty = i === 0 || !rawLines[i - 1];
    const isShortHeading =
      line.length < 50 &&
      !/[.:;,?!]$/.test(line) &&
      /^[A-ZÀ-ÿ]/.test(line) &&
      prevLineEmpty &&
      i + 1 < rawLines.length &&
      Boolean(rawLines[i + 1]);

    if (isShortHeading) {
      flushParagraph();
      blocks.push(`## ${line}`);
      continue;
    }

    // 7. Linha normal de texto: acumula no parágrafo corrente
    currentParagraphLines.push(line);
  }

  flushParagraph();

  // Agrupa itens de lista consecutivos com uma única quebra de linha (\n),
  // e separa parágrafos/títulos com duas quebras (\n\n).
  const formattedBlocks: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const cur = blocks[i];
    const prev = formattedBlocks[formattedBlocks.length - 1];

    if (cur.startsWith("- ") && prev && prev.startsWith("- ")) {
      formattedBlocks[formattedBlocks.length - 1] = `${prev}\n${cur}`;
    } else {
      formattedBlocks.push(cur);
    }
  }

  return formattedBlocks.join("\n\n").trim();
}
