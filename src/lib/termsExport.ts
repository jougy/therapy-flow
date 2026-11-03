/**
 * Utilitário modular para exportação e download de termos de uso e consentimento (.md, .docx e .zip).
 * 
 * Funcionalidades:
 * - Conversão limpa de Markdown para DOCX (Office Open XML) sem dependências externas pesadas.
 * - Geração de pacote .zip em memória com padrão ZIP Store (RFC 1951 / APPNOTE.TXT) e CRC-32.
 * - Trigger nativo de download no navegador.
 */

export interface ExportableTermDoc {
  key: string;
  label: string;
  filename: string;
  content: string;
}

// Tabela estática de lookup para CRC-32 (O(1) por byte)
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

export function computeCrc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Escapa caracteres reservados para XML
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Converte texto Markdown simples com estilos básicos para XML de parágrafos WordprocessingML (<w:p>)
 */
export function convertMarkdownToDocxParagraphs(markdown: string): string {
  const cleanMd = markdown.replace(/^---[\s\S]*?---[\r\n]+/, "");
  const lines = cleanMd.split(/\r?\n/);
  const xmlParagraphs: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith("# ")) {
      xmlParagraphs.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:spacing w:before="240" w:after="120"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="0F172A"/><w:sz w:val="34"/><w:szCs w:val="34"/></w:rPr><w:t xml:space="preserve">${escapeXml(line.slice(2))}</w:t></w:r></w:p>`
      );
    } else if (line.startsWith("## ")) {
      xmlParagraphs.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:before="200" w:after="100"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="1E293B"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t xml:space="preserve">${escapeXml(line.slice(3))}</w:t></w:r></w:p>`
      );
    } else if (line.startsWith("### ")) {
      xmlParagraphs.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading3"/><w:spacing w:before="160" w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="334155"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(line.slice(4))}</w:t></w:r></w:p>`
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const itemContent = line.slice(2);
      xmlParagraphs.push(
        `<w:p><w:pPr><w:ind w:left="420"/><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/></w:rPr><w:t xml:space="preserve">•  </w:t></w:r>${parseInlineMarkdownToRuns(itemContent)}</w:p>`
      );
    } else {
      xmlParagraphs.push(
        `<w:p><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr>${parseInlineMarkdownToRuns(line)}</w:p>`
      );
    }
  }

  return xmlParagraphs.join("\n    ");
}

function parseInlineMarkdownToRuns(text: string): string {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
        const inner = part.slice(2, -2);
        return `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`;
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
        const inner = part.slice(1, -1);
        return `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:i/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`;
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
        const inner = part.slice(1, -1);
        return `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="475569"/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`;
      }
      return `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`;
    })
    .join("");
}

export function buildDocxBlob(markdownContent: string): Blob {
  const encoder = new TextEncoder();
  const paragraphs = convertMarkdownToDocxParagraphs(markdownContent);

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const zipBytes = createZipArchive([
    { name: "[Content_Types].xml", data: encoder.encode(contentTypesXml) },
    { name: "_rels/.rels", data: encoder.encode(relsXml) },
    { name: "word/_rels/document.xml.rels", data: encoder.encode(wordRelsXml) },
    { name: "word/document.xml", data: encoder.encode(documentXml) },
  ]);

  return new Blob([zipBytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export interface ZipFileInput {
  name: string;
  data: Uint8Array;
}

export function createZipArchive(files: ZipFileInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = file.data;
    const fileCrc = computeCrc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes + name)
    const lh = new Uint8Array(30 + nameBytes.length);
    const dvLh = new DataView(lh.buffer);
    dvLh.setUint32(0, 0x04034b50, true);
    dvLh.setUint16(4, 20, true); // Version needed (2.0)
    dvLh.setUint16(6, 0x0800, true); // UTF-8 filename flag
    dvLh.setUint16(8, 0, true); // Stored (sem compressão)
    dvLh.setUint16(10, 0, true); // Time
    dvLh.setUint16(12, 0, true); // Date
    dvLh.setUint32(14, fileCrc, true);
    dvLh.setUint32(18, size, true);
    dvLh.setUint32(22, size, true);
    dvLh.setUint16(26, nameBytes.length, true);
    dvLh.setUint16(28, 0, true); // Extra field length
    lh.set(nameBytes, 30);

    chunks.push(lh);
    chunks.push(dataBytes);

    // Central directory file header (46 bytes + name)
    const ch = new Uint8Array(46 + nameBytes.length);
    const dvCh = new DataView(ch.buffer);
    dvCh.setUint32(0, 0x02014b50, true);
    dvCh.setUint16(4, 20, true); // Version made by
    dvCh.setUint16(6, 20, true); // Version needed
    dvCh.setUint16(8, 0x0800, true); // UTF-8 filename flag
    dvCh.setUint16(10, 0, true); // Stored
    dvCh.setUint16(12, 0, true); // Time
    dvCh.setUint16(14, 0, true); // Date
    dvCh.setUint32(16, fileCrc, true);
    dvCh.setUint32(20, size, true);
    dvCh.setUint32(24, size, true);
    dvCh.setUint16(28, nameBytes.length, true);
    dvCh.setUint16(30, 0, true);
    dvCh.setUint16(32, 0, true);
    dvCh.setUint16(34, 0, true); // Disk number start
    dvCh.setUint16(36, 0, true); // Internal attributes
    dvCh.setUint32(38, 0, true); // External attributes
    dvCh.setUint32(42, offset, true); // Offset of local header
    ch.set(nameBytes, 46);

    centralHeaders.push(ch);
    offset += lh.length + dataBytes.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) {
    centralDirSize += ch.length;
    chunks.push(ch);
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const dvEocd = new DataView(eocd.buffer);
  dvEocd.setUint32(0, 0x06054b50, true);
  dvEocd.setUint16(4, 0, true); // Disk number
  dvEocd.setUint16(6, 0, true); // Start disk
  dvEocd.setUint16(8, files.length, true);
  dvEocd.setUint16(10, files.length, true);
  dvEocd.setUint32(12, centralDirSize, true);
  dvEocd.setUint32(16, centralDirOffset, true);
  dvEocd.setUint16(20, 0, true); // Comment length

  chunks.push(eocd);

  // Unifica todos os buffers em um único Uint8Array contínuo
  const totalLength = chunks.reduce((acc, curr) => acc + curr.length, 0);
  const result = new Uint8Array(totalLength);
  let curPos = 0;
  for (const chunk of chunks) {
    result.set(chunk, curPos);
    curPos += chunk.length;
  }

  return result;
}

/**
 * Dispara o download de um Blob no navegador de forma limpa
 */
export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Faz o download individual de um termo de consentimento em .md ou .docx
 */
export async function downloadSingleTermDoc(doc: ExportableTermDoc, format: "md" | "docx"): Promise<void> {
  const baseName = doc.filename.replace(/\.(md|txt|docx)$/i, "");

  if (format === "md") {
    const blob = new Blob([doc.content], { type: "text/markdown;charset=utf-8" });
    triggerFileDownload(blob, `${baseName}.md`);
  } else {
    const blob = buildDocxBlob(doc.content);
    triggerFileDownload(blob, `${baseName}.docx`);
  }
}

/**
 * Empacota todos os termos fornecidos em um arquivo .zip e dispara o download
 */
export async function downloadAllTermsZip(
  docs: ExportableTermDoc[],
  format: "md" | "docx",
  zipFilename = "termos-plurihealth.zip"
): Promise<void> {
  const encoder = new TextEncoder();
  const zipFiles: ZipFileInput[] = [];

  for (const doc of docs) {
    const baseName = doc.filename.replace(/\.(md|txt|docx)$/i, "");
    if (format === "md") {
      zipFiles.push({
        name: `${baseName}.md`,
        data: encoder.encode(doc.content),
      });
    } else {
      const docxBlob = buildDocxBlob(doc.content);
      const docxArrayBuffer = await docxBlob.arrayBuffer();
      zipFiles.push({
        name: `${baseName}.docx`,
        data: new Uint8Array(docxArrayBuffer),
      });
    }
  }

  const zipBytes = createZipArchive(zipFiles);
  const zipBlob = new Blob([zipBytes], { type: "application/zip" });
  triggerFileDownload(zipBlob, zipFilename);
}
