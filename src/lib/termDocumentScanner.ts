/**
 * Utilitário de Scanner, Sanitização e Compressão de Termos de Consentimento
 * Suporta arquivos: .md, .txt, .doc, .docx
 *
 * Regras de Segurança e Conformidade:
 * - DOCX: parsing do XML interno (`word/document.xml`), extração de parágrafos/títulos e remoção forçada de nós de imagem (<w:drawing>, <w:pict>).
 * - DOC: extração de texto sanitizado.
 * - MD e TXT: leitura UTF-8 direta.
 * - Sanitização textual forçada: remoção de tags de imagem Markdown (![...](...)) e HTML (<img>).
 * - Compressão do Markdown sanitizado via CompressionStream('gzip') nativo do browser ou fallback.
 */

export interface ScannedTermResult {
  markdownText: string;
  compressedBlob: Blob;
  originalSize: number;
  compressedSize: number;
  hasRemovedImages: boolean;
}

/**
 * Lê o conteúdo em texto de um File ou Blob, com compatibilidade abrangente para jsdom/test runners
 */
export async function readFileAsText(file: File | Blob): Promise<string> {
  if (typeof file.text === "function") {
    return await file.text();
  }

  // Fallback com FileReader para ambientes jsdom ou navegadores legados
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Lê o ArrayBuffer de um File ou Blob
 */
export async function readFileAsArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return await file.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Remove qualquer tag de imagem Markdown (![alt](url)) ou tag de imagem HTML (<img ...>)
 */
export function sanitizeMarkdownImages(text: string): { cleanText: string; removedImages: boolean } {
  let removed = false;

  // Regex para tags Markdown de imagem: ![alt](url) ou ![alt][ref]
  const mdImageRegex = /!\[([^\]]*)\]\(([^)]*)\)/g;
  if (mdImageRegex.test(text)) {
    removed = true;
  }
  let cleanText = text.replace(mdImageRegex, "");

  // Regex para tags de imagem HTML: <img ... /> ou <img ...>
  const htmlImgRegex = /<img\b[^>]*\/?>/gi;
  if (htmlImgRegex.test(cleanText)) {
    removed = true;
  }
  cleanText = cleanText.replace(htmlImgRegex, "");

  // Normaliza espaços em branco extras criados por remoções
  cleanText = cleanText.replace(/\n{3,}/g, "\n\n").trim();

  return { cleanText, removedImages: removed };
}

/**
 * Extrai o texto de arquivos .docx descompactando e interpretando `word/document.xml`
 */
async function parseDocxFile(file: File | Blob): Promise<{ text: string; hasImages: boolean }> {
  let hasImages = false;

  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const bytes = new Uint8Array(arrayBuffer);

    // Localizar entradas no zip binário: Procurar por "word/document.xml"
    const docXmlContent = await extractDocxXml(bytes);
    if (docXmlContent) {
      if (
        docXmlContent.includes("<w:drawing") ||
        docXmlContent.includes("<w:pict") ||
        docXmlContent.includes("w:drawing>") ||
        docXmlContent.includes("w:pict>")
      ) {
        hasImages = true;
      }

      // Converte word/document.xml para Markdown
      const markdown = convertDocxXmlToMarkdown(docXmlContent);
      return { text: markdown, hasImages };
    }
  } catch (err) {
    console.warn("Falha no parsing detalhado do docx, usando fallback de texto:", err);
  }

  // Fallback se não conseguir extrair ZIP diretamente
  const textFallback = await readFileAsText(file);
  return { text: textFallback, hasImages };
}

/**
 * Utilitário leve para extrair o arquivo word/document.xml de dentro do PKZip em memória
 */
async function extractDocxXml(zipBytes: Uint8Array): Promise<string | null> {
  const dataView = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);

  let offset = 0;
  while (offset < zipBytes.length - 4) {
    // Assinatura de cabeçalho local de arquivo ZIP: 0x04034b50 (PK\x03\x04)
    if (
      zipBytes[offset] === 0x50 &&
      zipBytes[offset + 1] === 0x4b &&
      zipBytes[offset + 2] === 0x03 &&
      zipBytes[offset + 3] === 0x04
    ) {
      const compressionMethod = dataView.getUint16(offset + 8, true);
      const compressedSize = dataView.getUint32(offset + 18, true);
      const fileNameLength = dataView.getUint16(offset + 26, true);
      const extraFieldLength = dataView.getUint16(offset + 28, true);

      const fileNameBytes = zipBytes.subarray(offset + 30, offset + 30 + fileNameLength);
      const fileName = new TextDecoder("utf-8").decode(fileNameBytes);

      const fileDataStart = offset + 30 + fileNameLength + extraFieldLength;
      const fileDataEnd = fileDataStart + compressedSize;

      if (fileName === "word/document.xml") {
        const compressedData = zipBytes.subarray(fileDataStart, fileDataEnd);

        if (compressionMethod === 0) {
          // Não comprimido
          return new TextDecoder("utf-8").decode(compressedData);
        } else if (compressionMethod === 8) {
          // Comprimido via Deflate
          try {
            if (typeof DecompressionStream !== "undefined") {
              const decompStream = new DecompressionStream("deflate-raw");
              const writer = decompStream.writable.getWriter();
              writer.write(compressedData);
              writer.close();

              const res = new Response(decompStream.readable);
              return await res.text();
            }
          } catch {
            try {
              if (typeof DecompressionStream !== "undefined") {
                const decompStream2 = new DecompressionStream("deflate");
                const writer2 = decompStream2.writable.getWriter();
                writer2.write(compressedData);
                writer2.close();

                const res2 = new Response(decompStream2.readable);
                return await res2.text();
              }
            } catch (err2) {
              console.warn("DecompressionStream falhou:", err2);
            }
          }
        }
      }

      offset = fileDataEnd;
    } else {
      offset++;
    }
  }

  return null;
}

/**
 * Converte a estrutura de tags XML do Word (<w:p>, <w:t>, <w:r>, etc.) em Markdown limpo
 * Remove nós de imagem (<w:drawing>, <w:pict>)
 */
export function convertDocxXmlToMarkdown(xml: string): string {
  // Remove nós de imagem XML do Word
  let cleanedXml = xml.replace(/<w:drawing[\s\S]*?<\/w:drawing>/gi, "");
  cleanedXml = cleanedXml.replace(/<w:pict[\s\S]*?<\/w:pict>/gi, "");
  cleanedXml = cleanedXml.replace(/<w:drawing\b[^>]*\/>/gi, "");
  cleanedXml = cleanedXml.replace(/<w:pict\b[^>]*\/>/gi, "");

  // Extrai parágrafos <w:p>
  const paragraphRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/gi;
  const paragraphs: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = paragraphRegex.exec(cleanedXml)) !== null) {
    const pContent = match[1];

    // Detecta se é título (heading)
    const isHeading1 = /<w:pStyle\s+w:val="(?:Heading1|Titulo1|Title)"/i.test(pContent);
    const isHeading2 = /<w:pStyle\s+w:val="(?:Heading2|Titulo2)"/i.test(pContent);
    const isHeading3 = /<w:pStyle\s+w:val="(?:Heading3|Titulo3)"/i.test(pContent);

    // Extrai todo o texto contido nos nós <w:t>
    const textRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/gi;
    let paragraphText = "";
    let tMatch: RegExpExecArray | null;
    while ((tMatch = textRegex.exec(pContent)) !== null) {
      paragraphText += tMatch[1];
    }

    paragraphText = paragraphText.trim();
    if (paragraphText.length > 0) {
      if (isHeading1) {
        paragraphs.push(`# ${paragraphText}`);
      } else if (isHeading2) {
        paragraphs.push(`## ${paragraphText}`);
      } else if (isHeading3) {
        paragraphs.push(`### ${paragraphText}`);
      } else {
        paragraphs.push(paragraphText);
      }
    }
  }

  return paragraphs.join("\n\n");
}

/**
 * Sanitiza e extrai texto de arquivo legado .doc (formato binário OLE2)
 */
async function parseDocLegacy(file: File | Blob): Promise<{ text: string; hasImages: boolean }> {
  const buffer = await readFileAsArrayBuffer(file);
  const bytes = new Uint8Array(buffer);
  let hasImages = false;

  // Em arquivos .doc binários, o texto ASCII/UTF-16 pode ser extraído varrendo trechos imprimíveis
  const binaryString = new TextDecoder("latin1").decode(bytes);
  if (
    binaryString.includes("PNG") ||
    binaryString.includes("JFIF") ||
    binaryString.includes("Exif") ||
    binaryString.includes("Photo")
  ) {
    hasImages = true;
  }

  // Extrai strings legíveis de texto
  const textParts: string[] = [];
  let currentRun = "";

  for (let i = 0; i < bytes.length; i++) {
    const code = bytes[i];
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255) || code === 10 || code === 13) {
      currentRun += String.fromCharCode(code);
    } else {
      if (currentRun.trim().length >= 4) {
        textParts.push(currentRun.trim());
      }
      currentRun = "";
    }
  }

  if (currentRun.trim().length >= 4) {
    textParts.push(currentRun.trim());
  }

  const rawText = textParts.join("\n");
  return { text: rawText, hasImages };
}

/**
 * Comprime texto via gzip utilizando a API de streaming nativa do navegador
 */
export async function compressGzip(text: string): Promise<Blob> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  if (typeof CompressionStream !== "undefined") {
    try {
      const stream = new CompressionStream("gzip");
      const writer = stream.writable.getWriter();
      writer.write(data);
      writer.close();
      const response = new Response(stream.readable);
      const buffer = await response.arrayBuffer();
      return new Blob([buffer], { type: "application/gzip" });
    } catch (e) {
      console.warn("Falha no CompressionStream nativo, gerando fallback:", e);
    }
  }

  // Fallback padrão se não suportado
  return new Blob([data], { type: "text/plain" });
}

/**
 * Função Principal de Escaneamento, Sanitização e Compressão
 */
export async function scanAndCompressTermDocument(file: File): Promise<ScannedTermResult> {
  const originalSize = file.size;
  const fileName = file.name.toLowerCase();

  let rawContent = "";
  let fileHasImages = false;

  if (fileName.endsWith(".docx")) {
    const parsed = await parseDocxFile(file);
    rawContent = parsed.text;
    fileHasImages = parsed.hasImages;
  } else if (fileName.endsWith(".doc")) {
    const parsed = await parseDocLegacy(file);
    rawContent = parsed.text;
    fileHasImages = parsed.hasImages;
  } else if (fileName.endsWith(".md") || fileName.endsWith(".txt")) {
    rawContent = await readFileAsText(file);
  } else {
    // Tenta ler como texto caso tenha extensão diferente
    rawContent = await readFileAsText(file);
  }

  // Sanitização obrigatória de imagens (Markdown e HTML)
  const { cleanText, removedImages } = sanitizeMarkdownImages(rawContent);
  const hasRemovedImages = fileHasImages || removedImages;

  // Compressão nativa
  const compressedBlob = await compressGzip(cleanText);
  const compressedSize = compressedBlob.size;

  return {
    markdownText: cleanText,
    compressedBlob,
    originalSize,
    compressedSize,
    hasRemovedImages,
  };
}
